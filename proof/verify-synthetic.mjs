import { readFileSync } from 'node:fs';

const ids = ['01-room-code-mode', '02-scope-negotiator', '03-echo-self-bound', '05-sandbox-rehearsal'];
const required = ['normalUrl', 'toolDiscovery', 'agentCall', 'sharedMutation', 'cloudflareLoadBearing', 'authorityVisible'];
const allowed = new Set(['passed', 'failed', 'partial', 'not-tested', 'simulated']);
for (const id of ids) {
  const result = JSON.parse(readFileSync(`experiments/${id}/result.json`, 'utf8'));
  if (result.schema !== 'webmcp-lab.synthetic-result.v0' || result.synthetic !== true || result.id !== id) throw new Error(`invalid identity ${id}`);
  for (const key of required) if (!allowed.has(result.gate[key])) throw new Error(`invalid ${id}.${key}`);
  for (const key of ['normalUrl', 'toolDiscovery', 'cloudflareLoadBearing']) if (result.gate[key] === 'passed') throw new Error(`synthetic result laundered ${id}.${key}`);
  if (result.gate.agentCall === 'passed') throw new Error(`synthetic agent call laundered ${id}`);
}
console.log(`SYNTHETIC_RESULTS_OK:${ids.length}`);
