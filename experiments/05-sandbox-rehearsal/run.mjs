import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const work = new URL('./.tmp/', import.meta.url);
mkdirSync(work, { recursive: true });
const live = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
const proposal = { operation: 'delete', index: 2, before: live, after: live.filter((_, index) => index !== 2) };
const serialized = JSON.stringify(proposal);
const digest = createHash('sha256').update(serialized).digest('hex');
writeFileSync(new URL('rehearsal.json', work), serialized);
const replay = JSON.parse(readFileSync(new URL('rehearsal.json', work), 'utf8'));
const unchangedDuringRehearsal = live.length === 5 && live[2] === 'gamma';
function apply(candidate, candidateDigest) {
  if (createHash('sha256').update(JSON.stringify(candidate)).digest('hex') !== candidateDigest || candidateDigest !== digest) return { ok: false, status: 403 };
  return { ok: true, status: 200, rows: candidate.after };
}
const denied = apply({ ...replay, index: 1 }, digest);
const applied = apply(replay, digest);
rmSync(work, { recursive: true, force: true });
const receipt = {
  schema: 'webmcp-lab.synthetic-result.v0',
  id: '05-sandbox-rehearsal',
  synthetic: true,
  observed: {
    digest,
    unchangedDuringRehearsal,
    denied,
    applied,
    temporarySurfaceDeleted: true,
    elapsedMs: Math.ceil(performance.now() - started),
  },
  gate: {
    normalUrl: 'not-tested',
    toolDiscovery: 'not-tested',
    agentCall: 'simulated',
    sharedMutation: applied.ok ? 'passed' : 'failed',
    cloudflareLoadBearing: 'not-tested',
    authorityVisible: denied.status === 403 ? 'passed' : 'failed',
  },
};
writeFileSync(new URL('./result.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log('REHEARSAL_SYNTHETIC_OK');
