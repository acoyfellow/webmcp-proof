import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../../', import.meta.url);
const proofDir = new URL('../../proof/', import.meta.url);
const userDataDir = new URL('./.chrome-webmcp/', import.meta.url);
const browser = '/Users/jcoeyman/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const url = 'https://webmcp-host-probe.coy.workers.dev/';
const credential = readFileSync(new URL('./probe-auth.secret', import.meta.url), 'utf8').trim();
const authorization = `Basic ${Buffer.from(credential).toString('base64')}`;
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

try {
  await send('Network.enable');
  await send('Network.setExtraHTTPHeaders', { headers: { Authorization: authorization } });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('WebMCP.enable');
  const navigation = await send('Page.navigate', { url });
  await waitEvent('Page.loadEventFired');
  const added = await waitEvent('WebMCP.toolsAdded', ({ tools }) => tools?.some((tool) => tool.name === 'set_signal'));
  const tool = added.tools.find((candidate) => candidate.name === 'set_signal');
  const support = await evaluate(`({ document: typeof document.modelContext, navigator: typeof navigator.modelContext, secure: isSecureContext, registration: document.querySelector('#registration').textContent })`);
  const invocation = await send('WebMCP.invokeTool', { frameId: tool.frameId ?? navigation.frameId, toolName: tool.name, input: { value: 'chrome-native-ok' } });
  const invoked = await waitEvent('WebMCP.toolInvoked', ({ invocationId }) => invocationId === invocation.invocationId);
  const responded = await waitEvent('WebMCP.toolResponded', ({ invocationId }) => invocationId === invocation.invocationId);
  const visible = await evaluate(`({ signal: document.querySelector('#signal').textContent, receipt: document.querySelector('#receipt').textContent })`);
  const visibleReceipt = JSON.parse(visible.receipt);
  const responseOutput = typeof responded.output === 'string' ? JSON.parse(responded.output) : responded.output;
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotBytes = Buffer.from(screenshot.data, 'base64');
  writeFileSync(new URL('native-host.png', proofDir), screenshotBytes);
  await evaluate(`window.__revokeWebMCP()`);
  const removed = await waitEvent('WebMCP.toolsRemoved', ({ tools }) => tools?.some((candidate) => candidate.name === 'set_signal'));
  let denied;
  try {
    await send('WebMCP.invokeTool', { frameId: tool.frameId ?? navigation.frameId, toolName: tool.name, input: { value: 'after-revoke' } });
    denied = { denied: false };
  } catch (error) {
    denied = { denied: true, error: String(error) };
  }
  const afterRevoke = await evaluate(`document.querySelector('#signal').textContent`);
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
  const receipt = {
    schema: 'webmcp-lab.native-host-proof.v0',
    host: 'Chrome for Testing with the documented WebMCP testing feature',
    browser: version.Browser,
    commandFeatures: ['WebMCP', 'DevToolsWebMCPSupport'],
    url,
    secureContext: support.secure,
    api: support,
    tool: { name: tool.name, frameId: tool.frameId ?? navigation.frameId, description: tool.description },
    invocation: { invocationId: invocation.invocationId, invoked, responded, responseOutput },
    visible: { ...visible, parsedReceipt: visibleReceipt },
    revocation: { removed, denied, afterRevoke },
    screenshot: { path: 'proof/native-host.png', sha256: createHash('sha256').update(screenshotBytes).digest('hex') },
    toolsDiscovered: true,
    agentToolCalled: responded.status === 'Completed',
    sharedMutationObserved: visible.signal === 'chrome-native-ok' && visibleReceipt.callId === responseOutput?.callId,
    authorityBoundaryObserved: denied.denied === true && afterRevoke === 'chrome-native-ok',
  };
  writeFileSync(new URL('native-host.json', proofDir), `${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.toolsDiscovered || !receipt.agentToolCalled || !receipt.sharedMutationObserved || !receipt.authorityBoundaryObserved) throw new Error(JSON.stringify(receipt));
  console.log(`NATIVE_WEBMCP_OK:${invocation.invocationId}`);
} finally {
  socket.close();
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
  rmSync(userDataDir, { recursive: true, force: true });
}
