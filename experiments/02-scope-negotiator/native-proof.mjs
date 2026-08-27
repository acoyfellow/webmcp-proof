import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

const proofDir = new URL('../../proof/', import.meta.url);
const userDataDir = new URL('./.chrome-webmcp/', import.meta.url);
const browser = '/Users/jcoeyman/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const url = 'https://webmcp-scope-negotiator.coy.workers.dev/';
const credential = readFileSync(new URL('../00-host-probe/probe-auth.secret', import.meta.url), 'utf8').trim();
const authorization = `Basic ${Buffer.from(credential).toString('base64')}`;
await fetch(`${url}api/reset`, { method: 'POST', headers: { Authorization: authorization } });
rmSync(userDataDir, { recursive: true, force: true });
mkdirSync(userDataDir, { recursive: true });
mkdirSync(proofDir, { recursive: true });
const child = spawn(browser, [
  '--headless',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${userDataDir.pathname}`,
  '--remote-debugging-port=0',
  '--enable-features=WebMCP,DevToolsWebMCPSupport',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let browserLog = '';
child.stdout.on('data', (chunk) => { browserLog += chunk; });
child.stderr.on('data', (chunk) => { browserLog += chunk; });

async function activePort() {
  const path = new URL('DevToolsActivePort', userDataDir);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = readFileSync(path, 'utf8').trim().split('\n');
      if (port) return Number(port);
    } catch {}
    await delay(50);
  }
  throw new Error(`DevToolsActivePort missing: ${browserLog}`);
}

const port = await activePort();
const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const events = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(String(data));
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${waiter.method}: ${JSON.stringify(message.error)}`));
    else waiter.resolve(message.result ?? {});
    return;
  }
  if (message.method) events.push(message);
});
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function waitEvent(method, predicate = () => true, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const index = events.findIndex((event) => event.method === method && predicate(event.params ?? {}));
    if (index >= 0) return events.splice(index, 1)[0].params;
    await delay(20);
  }
  throw new Error(`event timeout ${method}: ${JSON.stringify(events.slice(-10))}`);
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function invoke(tool, input) {
  const command = await send('WebMCP.invokeTool', { frameId: tool.frameId, toolName: tool.name, input });
  const invoked = await waitEvent('WebMCP.toolInvoked', ({ invocationId }) => invocationId === command.invocationId);
  const responded = await waitEvent('WebMCP.toolResponded', ({ invocationId }) => invocationId === command.invocationId);
  const output = typeof responded.output === 'string' ? JSON.parse(responded.output) : responded.output;
  return { invocationId: command.invocationId, invoked, responded, output };
}

try {
  await send('Network.enable');
  await send('Network.setExtraHTTPHeaders', { headers: { Authorization: authorization } });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('WebMCP.enable');
  await send('Page.navigate', { url });
  const started = performance.now();
  await waitEvent('Page.loadEventFired');
  const names = new Set(['request_scopes', 'accept_offer', 'write_document', 'read_document']);
  const discovered = new Map();
  while (discovered.size < names.size) {
    const added = await waitEvent('WebMCP.toolsAdded');
    for (const tool of added.tools ?? []) if (names.has(tool.name)) discovered.set(tool.name, tool);
  }
  const request = await invoke(discovered.get('request_scopes'), { scopes: ['document:read', 'document:write', 'admin'] });
  const accept = await invoke(discovered.get('accept_offer'), {});
  const allowedWrite = await invoke(discovered.get('write_document'), { documentId: 'current', value: 'native-scope-ok' });
  const deniedWrite = await invoke(discovered.get('write_document'), { documentId: 'other', value: 'escape' });
  const read = await invoke(discovered.get('read_document'), {});
  const elapsedMs = Math.ceil(performance.now() - started);
  const visible = await evaluate(`({ requested:document.querySelector('#requested').textContent, offered:document.querySelector('#offered').textContent, granted:document.querySelector('#granted').textContent, document:document.querySelector('#document').textContent, events:document.querySelector('#events').textContent, lastCall:document.querySelector('#last-call').textContent })`);
  const durableState = await fetch(`${url}api/state`, { headers: { Authorization: authorization } }).then((response) => response.json());
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotBytes = Buffer.from(screenshot.data, 'base64');
  writeFileSync(new URL('scope-native.png', proofDir), screenshotBytes);
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
  const receipt = {
    schema: 'webmcp-lab.scope-native-proof.v0',
    host: 'Chrome for Testing with the documented WebMCP testing feature',
    browser: version.Browser,
    url,
    tools: [...discovered.keys()],
    calls: { request, accept, allowedWrite, deniedWrite, read },
    visible,
    durableState,
    elapsedMs,
    cloudflarePrimitive: 'Durable Object binding SCOPE',
    screenshot: { path: 'proof/scope-native.png', sha256: createHash('sha256').update(screenshotBytes).digest('hex') },
    toolsDiscovered: discovered.size === 4,
    agentToolCalled: [request, accept, allowedWrite, deniedWrite, read].every((call) => call.responded.status === 'Completed'),
    sharedMutationObserved: visible.document === 'native-scope-ok' && durableState.document.body === 'native-scope-ok',
    authorityBoundaryObserved: deniedWrite.output.status === 403 && visible.events.includes('write_document → 403 (other)') && durableState.document.body === 'native-scope-ok',
    cloudflareLoadBearingObserved: durableState.granted.includes('document:write:current') && durableState.events.length === 4,
    withinSixtySeconds: elapsedMs <= 60000,
  };
  writeFileSync(new URL('scope-native.json', proofDir), `${JSON.stringify(receipt, null, 2)}\n`);
  for (const key of ['toolsDiscovered', 'agentToolCalled', 'sharedMutationObserved', 'authorityBoundaryObserved', 'cloudflareLoadBearingObserved', 'withinSixtySeconds']) if (!receipt[key]) throw new Error(`${key} failed`);
  console.log(`SCOPE_NATIVE_OK:${allowedWrite.invocationId}:${elapsedMs}ms`);
} finally {
  socket.close();
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
  rmSync(userDataDir, { recursive: true, force: true });
}
