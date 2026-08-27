import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const requested = ['document:read', 'document:write', 'admin'];
const offered = requested.flatMap((scope) => scope === 'document:write' ? ['document:write:current'] : scope === 'document:read' ? [scope] : []);
const grant = Object.freeze({ documentId: 'current', scopes: offered, revoked: false });
const calls = [];
function authorize(scope, documentId) {
  const allowed = !grant.revoked && grant.documentId === documentId && grant.scopes.includes(scope);
  const call = { scope, documentId, status: allowed ? 200 : 403 };
  calls.push(call);
  return call;
}
const accepted = authorize('document:write:current', 'current');
const denied = authorize('admin', 'current');
const receipt = {
  schema: 'webmcp-lab.synthetic-result.v0',
  id: '02-scope-negotiator',
  synthetic: true,
  observed: {
    columns: { requested, offered, granted: grant.scopes },
    calls,
    visibleMutation: accepted.status === 200 ? 'current document changed' : null,
    elapsedMs: Math.ceil(performance.now() - started),
  },
  gate: {
    normalUrl: 'not-tested',
    toolDiscovery: 'not-tested',
    agentCall: 'simulated',
    sharedMutation: accepted.status === 200 ? 'passed' : 'failed',
    cloudflareLoadBearing: 'not-tested',
    authorityVisible: denied.status === 403 ? 'passed' : 'failed',
  },
};
writeFileSync(new URL('./result.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log('SCOPE_SYNTHETIC_OK');
