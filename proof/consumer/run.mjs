import { runWebMcpProof } from 'webmcp-proof';

const browserPath = process.env.BROWSER_PATH;
const targetUrl = process.env.TARGET_URL;
const credential = process.env.DEMO_AUTH;
if (!browserPath || !targetUrl || !credential) {
  throw new Error('BROWSER_PATH, TARGET_URL, and DEMO_AUTH are required');
}
const receipt = await runWebMcpProof({
  browserPath,
  url: targetUrl,
  headers: { Authorization: `Basic ${Buffer.from(credential).toString('base64')}` },
  requiredToolNames: [
    'request_scopes',
    'accept_scopes',
    'write_document',
    'read_scope_state',
  ],
  calls: [
    {
      toolName: 'request_scopes',
      input: {
        scopes: ['documents:read', 'documents:write:current', 'admin'],
      },
    },
    {
      toolName: 'accept_scopes',
      input: {
        scopes: ['documents:read', 'documents:write:current'],
      },
    },
    {
      toolName: 'write_document',
      input: { documentId: 'current', value: 'clean-consumer-ok' },
    },
    {
      toolName: 'write_document',
      input: { documentId: 'other', value: 'must-not-land' },
    },
    { toolName: 'read_scope_state', input: {} },
  ],
  inspectExpression: `({ current: document.querySelector('#current').textContent, other: document.querySelector('#other').textContent, denials: document.querySelector('#denials').textContent })`,
  browserArgs: process.env.DOGFOOD_IP
    ? [`--host-resolver-rules=MAP webmcp-proof.coey.dev ${process.env.DOGFOOD_IP}`]
    : [],
  screenshotPath: 'consumer.png',
});
const [request, , allowed, denied] = receipt.calls;
if (request.output.state.offered.includes('admin')) throw new Error('admin scope was offered');
if (allowed.output.status !== 200) throw new Error('allowed write failed');
if (denied.output.status !== 403) throw new Error('other-document write was not denied');
if (receipt.inspected.current !== 'clean-consumer-ok') throw new Error('visible mutation missing');
if (receipt.inspected.other !== 'sealed') throw new Error('denied mutation changed state');
console.log(`CLEAN_CONSUMER_OK:${allowed.invocationId}:${denied.invocationId}`);
