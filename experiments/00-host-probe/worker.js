const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebMCP host probe</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0b1118;color:#f7f9fb}body{max-width:44rem;margin:0 auto;padding:4rem 1.5rem}.eyebrow{font:600 .72rem ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#f7b53b}.card{margin-top:2rem;padding:1.5rem;border:1px solid rgba(174,196,216,.14);border-radius:.7rem;background:#111a24}dt{color:#9baaba}dd{margin:.35rem 0 1.2rem;font:600 1rem ui-monospace,monospace}button{background:#f6821f;color:#0b1118;border:0;border-radius:.45rem;padding:.75rem 1rem;font-weight:800}
</style>
</head>
<body>
<p class="eyebrow">[ host reality probe ]</p>
<h1>One page. One tool. One signal.</h1>
<p>This page registers <code>set_signal</code> when the native WebMCP host exists.</p>
<dl class="card">
<dt>document.modelContext</dt><dd id="document-support">checking</dd>
<dt>navigator.modelContext</dt><dd id="navigator-support">checking</dd>
<dt>registration</dt><dd id="registration">waiting</dd>
<dt>visible signal</dt><dd id="signal">idle</dd>
<dt>last call</dt><dd id="receipt">none</dd>
<button id="selftest" type="button">Run page self-test</button>
</dl>
<script type="module">
const documentSupport = document.querySelector('#document-support');
const navigatorSupport = document.querySelector('#navigator-support');
const registration = document.querySelector('#registration');
const signal = document.querySelector('#signal');
const receipt = document.querySelector('#receipt');
const modelContext = document.modelContext ?? navigator.modelContext;
const registrationController = new AbortController();
window.__revokeWebMCP = () => registrationController.abort();
documentSupport.textContent = document.modelContext ? 'present' : 'absent';
navigatorSupport.textContent = navigator.modelContext ? 'present' : 'absent';
const tool = {
  name: 'set_signal',
  description: 'Set the one visible signal on this host probe page.',
  inputSchema: {
    type: 'object',
    properties: { value: { type: 'string', maxLength: 80 } },
    required: ['value'],
    additionalProperties: false
  },
  execute: async ({ value }) => {
    signal.textContent = String(value).slice(0, 80);
    signal.dataset.source = 'webmcp';
    const result = { ok: true, callId: crypto.randomUUID(), value: signal.textContent };
    receipt.textContent = JSON.stringify(result);
    return JSON.stringify(result);
  }
};
if (modelContext) {
  try {
    await modelContext.registerTool(tool, { signal: registrationController.signal });
    registration.textContent = document.modelContext ? 'registered: document' : 'registered: navigator';
  } catch (error) {
    registration.textContent = 'rejected: ' + error.name;
  }
} else {
  registration.textContent = 'not attempted';
}
document.querySelector('#selftest').addEventListener('click', async () => {
  if (!modelContext) return;
  const tools = await modelContext.getTools();
  const registered = tools.find((candidate) => candidate.name === 'set_signal');
  if (registered) await modelContext.executeTool(registered, { value: 'page-self-test' });
});
</script>
</body>
</html>`;

async function equal(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

export default {
  async fetch(request, env) {
    const authorization = request.headers.get('Authorization') ?? '';
    const allowed = env.PROBE_AUTH && await equal(authorization, env.PROBE_AUTH);
    if (!allowed) return new Response('authentication required', { status: 401, headers: { 'www-authenticate': 'Basic realm="WebMCP host probe"' } });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  },
};
