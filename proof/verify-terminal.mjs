import { existsSync, readFileSync, readdirSync } from 'node:fs';

const status = JSON.parse(readFileSync('status.json', 'utf8'));
const terminal = new Set(['shipped-live', 'claim-died']);
if (!terminal.has(status.state)) {
  console.error(`NOT_TERMINAL:${status.state}`);
  process.exit(1);
}
const experimentNames = Object.keys(status.experiments ?? {});
if (experimentNames.length !== 6) throw new Error(`expected 6 experiments, got ${experimentNames.length}`);
if (experimentNames.some((name) => status.experiments[name] === 'unrun')) throw new Error('unrun experiment remains');
const receipts = readdirSync('receipts').filter((name) => name.endsWith('.json'));
if (receipts.length < 5) throw new Error(`expected at least 5 receipts, got ${receipts.length}`);
for (const name of receipts) {
  const text = readFileSync(`receipts/${name}`, 'utf8');
  if (/replace-me|example\.invalid|TODO|TBD/i.test(text)) throw new Error(`placeholder in ${name}`);
  JSON.parse(text);
}
if (status.state === 'shipped-live') {
  for (const path of [
    'proof/live.json',
    'proof/browser.json',
    'proof/consumer.json',
    'proof/package.json',
    'proof/review.json',
    'proof/deploy-button.json',
  ]) {
    if (!existsSync(path)) throw new Error(`missing ${path}`);
  }
  const live = JSON.parse(readFileSync('proof/live.json', 'utf8'));
  if (!/^https:\/\/[^/]+\.coey\.dev\/?$/.test(live.url) || live.status !== 200) throw new Error('invalid live proof');
  const browser = JSON.parse(readFileSync('proof/browser.json', 'utf8'));
  for (const fact of ['toolsDiscovered', 'agentToolCalled', 'sharedMutationObserved', 'authorityBoundaryObserved']) {
    if (browser[fact] !== true) throw new Error(`browser proof missing ${fact}`);
  }
  const consumer = JSON.parse(readFileSync('proof/consumer.json', 'utf8'));
  if (consumer.cleanInstall !== true || consumer.proofPassed !== true)
    throw new Error('consumer proof failed');
  const packageProof = JSON.parse(readFileSync('proof/package.json', 'utf8'));
  if (
    packageProof.assetStatus !== 200 ||
    packageProof.cleanNpmInstall !== true ||
    packageProof.sourceVisibility !== 'public'
  )
    throw new Error('public package proof failed');
  const review = JSON.parse(readFileSync('proof/review.json', 'utf8'));
  if (review.mustFix !== 0) throw new Error('review has must-fix findings');
  const deployButton = JSON.parse(readFileSync('proof/deploy-button.json', 'utf8'));
  if (deployButton.status !== 200 || deployButton.targetVerified !== true) throw new Error('deploy button proof failed');
}
if (status.state === 'claim-died') {
  if (Object.values(status.experiments).some((value) => !['falsified', 'blocked'].includes(value))) throw new Error('claim-died requires every experiment falsified or blocked');
  if (existsSync('proof/live.json') || existsSync('proof/consumer.json')) throw new Error('claim-died cannot claim live extraction');
}
console.log(`TERMINAL_OK:${status.state}`);
