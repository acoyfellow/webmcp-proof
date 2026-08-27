import vm from 'node:vm';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const messages = [{ role: 'human', body: 'Name the shared signal.' }];
const tools = Object.freeze({
  read_messages: async () => structuredClone(messages),
  append_message: async ({ body }) => {
    const message = { role: 'agent', body: String(body) };
    messages.push(message);
    return message;
  },
});
const context = vm.createContext({ tools });
const source = `(async () => {
  const prior = await tools.read_messages();
  await tools.append_message({ body: 'signal:' + prior.length });
  return { ambientFetch: typeof fetch, count: prior.length };
})()`;
const result = await new vm.Script(source).runInContext(context);
const receipt = {
  schema: 'webmcp-lab.synthetic-result.v0',
  id: '01-room-code-mode',
  synthetic: true,
  observed: {
    visibleMutation: messages.at(-1),
    toolSurface: ['run_code'],
    guestTools: Object.keys(tools),
    ambientFetch: result.ambientFetch,
    elapsedMs: Math.ceil(performance.now() - started),
  },
  gate: {
    normalUrl: 'not-tested',
    toolDiscovery: 'not-tested',
    agentCall: 'simulated',
    sharedMutation: messages.at(-1)?.body === 'signal:1' ? 'passed' : 'failed',
    cloudflareLoadBearing: 'not-tested',
    authorityVisible: result.ambientFetch === 'undefined' ? 'partial' : 'failed',
  },
};
writeFileSync(new URL('./result.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log('ROOM_SYNTHETIC_OK');
