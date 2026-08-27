import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const page = { origin: 'https://experiment.invalid', signal: 'idle' };
let bound = true;
async function runPlan(plan) {
  if (!bound) return { ok: false, error: 'session_unbound' };
  const tab = Object.freeze({
    execute: async ({ origin, value }) => {
      if (origin !== page.origin) return { ok: false, error: 'origin_mismatch' };
      page.signal = String(value);
      return { ok: true, value: page.signal };
    },
  });
  return { ok: true, result: await plan({ tab }) };
}
const first = await runPlan(({ tab }) => tab.execute({ origin: page.origin, value: 'bound-call' }));
const wrongOrigin = await runPlan(({ tab }) => tab.execute({ origin: 'https://other.invalid', value: 'escape' }));
bound = false;
const afterUnbind = await runPlan(({ tab }) => tab.execute({ origin: page.origin, value: 'late-call' }));
const receipt = {
  schema: 'webmcp-lab.synthetic-result.v0',
  id: '03-echo-self-bound',
  synthetic: true,
  observed: {
    first,
    wrongOrigin,
    afterUnbind,
    visibleMutation: page.signal,
    elapsedMs: Math.ceil(performance.now() - started),
  },
  gate: {
    normalUrl: 'not-tested',
    toolDiscovery: 'not-tested',
    agentCall: 'simulated',
    sharedMutation: page.signal === 'bound-call' ? 'passed' : 'failed',
    cloudflareLoadBearing: 'not-tested',
    authorityVisible: wrongOrigin.result?.error === 'origin_mismatch' && afterUnbind.error === 'session_unbound' ? 'passed' : 'failed',
  },
};
writeFileSync(new URL('./result.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log('ECHO_SYNTHETIC_OK');
