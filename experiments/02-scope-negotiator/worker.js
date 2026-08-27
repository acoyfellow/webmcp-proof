const initial = { requested: [], offered: [], granted: [], document: { id: 'current', body: 'unchanged' }, events: [] };

export class ScopeState {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async state() {
    return await this.ctx.storage.get('state') ?? structuredClone(initial);
  }

  async save(state) {
    await this.ctx.storage.put('state', state);
    return state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/reset') {
      await this.ctx.storage.deleteAll();
      return Response.json(await this.state());
    }
    const state = await this.state();
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    if (url.pathname === '/request') {
      state.requested = Array.isArray(body.scopes) ? body.scopes.map(String) : [];
      state.offered = state.requested.flatMap((scope) => scope === 'document:read' ? [scope] : scope === 'document:write' ? ['document:write:current'] : []);
      state.events.push({ action: 'request_scopes', status: 200, scopes: state.requested });
      return Response.json(await this.save(state));
    }
    if (url.pathname === '/accept') {
      state.granted = [...state.offered];
      state.events.push({ action: 'accept_offer', status: 200, scopes: state.granted });
      return Response.json(await this.save(state));
    }
    if (url.pathname === '/write') {
      const documentId = String(body.documentId ?? '');
      const allowed = documentId === state.document.id && state.granted.includes('document:write:current');
      const event = { action: 'write_document', documentId, status: allowed ? 200 : 403 };
      state.events.push(event);
      if (allowed) state.document.body = String(body.value ?? '');
      await this.save(state);
      return Response.json({ ...state, call: event }, { status: event.status });
    }
    return Response.json(state);
  }
}

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

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scope Negotiator</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0b1118;color:#f7f9fb}body{max-width:64rem;margin:0 auto;padding:3rem 1.5rem}.eyebrow{font:600 .72rem ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#f7b53b}.columns{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:2rem 0}.card{padding:1.25rem;border:1px solid rgba(174,196,216,.14);border-radius:.7rem;background:#111a24;min-height:8rem}h2{font-size:.8rem;color:#9baaba;text-transform:uppercase;letter-spacing:.12em}.mono{font-family:ui-monospace,monospace}.event-403{color:#ff7d68}.event-200{color:#63d5a2}@media(max-width:700px){.columns{grid-template-columns:1fr}}
</style></head><body><p class="eyebrow">[ scope negotiator ]</p><h1>Authority is a counter-offer.</h1><p>The agent asks broadly. Policy narrows. The human sees both.</p><div class="columns"><section class="card"><h2>Requested</h2><div id="requested" class="mono">none</div></section><section class="card"><h2>Offered</h2><div id="offered" class="mono">none</div></section><section class="card"><h2>Granted</h2><div id="granted" class="mono">none</div></section></div><section class="card"><h2>Current document</h2><div id="document" class="mono">unchanged</div></section><section class="card"><h2>Calls</h2><div id="events" class="mono">none</div><h2>Last WebMCP result</h2><div id="last-call" class="mono">none</div></section><script type="module">
const ids = ['requested','offered','granted','document','events','last-call'];
const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
async function api(path, body) {
  const response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, state: await response.json() };
}
function render(result) {
  const state = result.state ?? result;
  for (const key of ['requested','offered','granted']) elements[key].textContent = state[key].join(' · ') || 'none';
  elements.document.textContent = state.document.body;
  elements.events.innerHTML = state.events.map((event) => '<div class="event-' + event.status + '">' + event.action + ' → ' + event.status + (event.documentId ? ' (' + event.documentId + ')' : '') + '</div>').join('') || 'none';
  if (result.status) elements['last-call'].textContent = JSON.stringify(result);
  return result;
}
render((await api('state')).state);
const tools = [
  { name:'request_scopes', description:'Ask for document capabilities. Policy will visibly counter-offer.', inputSchema:{type:'object',properties:{scopes:{type:'array',items:{type:'string'}}},required:['scopes']}, execute:async({scopes})=>JSON.stringify(render(await api('request',{scopes}))) },
  { name:'accept_offer', description:'Accept the visible deterministic counter-offer.', inputSchema:{type:'object',properties:{}}, execute:async()=>JSON.stringify(render(await api('accept',{}))) },
  { name:'write_document', description:'Write a named document only when the grant permits it.', inputSchema:{type:'object',properties:{documentId:{type:'string'},value:{type:'string'}},required:['documentId','value']}, execute:async(input)=>JSON.stringify(render(await api('write',input))) },
  { name:'read_document', description:'Read the current document and visible authority ledger.', inputSchema:{type:'object',properties:{}}, annotations:{readOnly:true}, execute:async()=>JSON.stringify(render(await api('state'))) }
];
const modelContext = document.modelContext ?? navigator.modelContext;
if (modelContext) for (const tool of tools) await modelContext.registerTool(tool);
</script></body></html>`;

export default {
  async fetch(request, env) {
    const authorization = request.headers.get('Authorization') ?? '';
    if (!env.DEMO_AUTH || !await equal(authorization, env.DEMO_AUTH)) return new Response('authentication required', { status: 401, headers: { 'www-authenticate': 'Basic realm="Scope Negotiator"' } });
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const stub = env.SCOPE.getByName('demo');
      const path = url.pathname.slice('/api'.length);
      return stub.fetch(new Request(`https://scope.internal${path}`, request));
    }
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  },
};
