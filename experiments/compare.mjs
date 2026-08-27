import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const required = ['normalUrl', 'toolDiscovery', 'agentCall', 'sharedMutation', 'cloudflareLoadBearing', 'authorityVisible'];
const syntheticIds = ['01-room-code-mode', '02-scope-negotiator', '03-echo-self-bound', '05-sandbox-rehearsal'];
function lines(paths) {
  return paths.filter(existsSync).flatMap((path) => readFileSync(path, 'utf8').split('\n')).filter((line) => line.trim()).length;
}
const rows = syntheticIds.map((id) => {
  const result = JSON.parse(readFileSync(`experiments/${id}/result.json`, 'utf8'));
  return {
    id,
    evidence: 'synthetic',
    gate: result.gate,
    candidateOwnedLines: lines([`experiments/${id}/run.mjs`]),
    elapsedMs: result.observed.elapsedMs,
  };
});
const host = JSON.parse(readFileSync('proof/native-host.json', 'utf8'));
rows.push({
  id: '00-host-probe',
  evidence: 'native',
  gate: {
    normalUrl: 'passed',
    toolDiscovery: host.toolsDiscovered ? 'passed' : 'failed',
    agentCall: host.agentToolCalled ? 'passed' : 'failed',
    sharedMutation: host.sharedMutationObserved ? 'passed' : 'failed',
    cloudflareLoadBearing: 'failed',
    authorityVisible: host.authorityBoundaryObserved ? 'passed' : 'failed',
  },
  candidateOwnedLines: lines(['experiments/00-host-probe/worker.js', 'experiments/00-host-probe/native-proof.mjs']),
  elapsedMs: null,
});
rows.push({
  id: '04-lifo-promotion',
  evidence: 'blocked',
  gate: Object.fromEntries(required.map((key) => [key, 'not-tested'])),
  candidateOwnedLines: 0,
  elapsedMs: null,
});
const scope = JSON.parse(readFileSync('proof/scope-native.json', 'utf8'));
const scopeRow = rows.find(({ id }) => id === '02-scope-negotiator');
scopeRow.evidence = 'native';
scopeRow.gate = {
  normalUrl: 'passed',
  toolDiscovery: scope.toolsDiscovered ? 'passed' : 'failed',
  agentCall: scope.agentToolCalled ? 'passed' : 'failed',
  sharedMutation: scope.sharedMutationObserved ? 'passed' : 'failed',
  cloudflareLoadBearing: scope.cloudflareLoadBearingObserved ? 'passed' : 'failed',
  authorityVisible: scope.authorityBoundaryObserved ? 'passed' : 'failed',
};
scopeRow.candidateOwnedLines = lines(['experiments/02-scope-negotiator/worker.js', 'experiments/02-scope-negotiator/native-proof.mjs']);
scopeRow.elapsedMs = scope.elapsedMs;
for (const row of rows) {
  row.passed = required.filter((key) => row.gate[key] === 'passed').length;
  row.eligible = required.every((key) => row.gate[key] === 'passed');
}
rows.sort((left, right) => left.id.localeCompare(right.id));
const eligible = rows.filter((row) => row.eligible).sort((left, right) => left.candidateOwnedLines - right.candidateOwnedLines || left.elapsedMs - right.elapsedMs);
const comparison = {
  schema: 'webmcp-lab.comparison.v0',
  frozenGateDigest: `sha256:${createHash('sha256').update(readFileSync('experiments/gate.v0.json')).digest('hex')}`,
  rows,
  eligible: eligible.map(({ id }) => id),
  winner: eligible[0]?.id ?? null,
  extractionEarned: eligible.length > 0,
  conclusion: eligible.length > 0 ? `${eligible[0].id} passed every frozen requirement with native evidence.` : 'No candidate passed every frozen requirement.',
};
writeFileSync('experiments/comparison.json', `${JSON.stringify(comparison, null, 2)}\n`);
console.log(JSON.stringify({ eligible: comparison.eligible, winner: comparison.winner, extractionEarned: comparison.extractionEarned }));
