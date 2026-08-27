<script lang="ts">
import { onMount } from 'svelte';
import type { ScopeStateValue } from './state';

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};
type ModelContext = { registerTool: (tool: Tool) => void };

let state = $state<ScopeStateValue>({
  requested: [],
  offered: [],
  accepted: [],
  documents: { current: 'ready', other: 'sealed' },
  writes: [],
});
let host = $state<'checking' | 'native' | 'absent'>('checking');
let busy = $state(false);
let lastCall = $state('waiting for a person or agent');

async function call(path: string, input: Record<string, unknown> = {}) {
  busy = true;
  try {
    const response = await fetch(`/api${path}`, {
      method: path === '/state' ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: path === '/state' ? undefined : JSON.stringify(input),
    });
    const next = (await response.json()) as ScopeStateValue;
    state = next;
    lastCall = `${path} → ${response.status}`;
    return { status: response.status, state: next };
  } finally {
    busy = false;
  }
}

function register(modelContext: ModelContext) {
  const tools: Tool[] = [
    {
      name: 'request_scopes',
      description: 'Request document scopes. Policy may return a narrower offer.',
      inputSchema: {
        type: 'object',
        properties: { scopes: { type: 'array', items: { type: 'string' } } },
        required: ['scopes'],
      },
      execute: (input) => call('/request', input),
    },
    {
      name: 'accept_scopes',
      description: 'Accept only scopes from the current offer.',
      inputSchema: {
        type: 'object',
        properties: { scopes: { type: 'array', items: { type: 'string' } } },
        required: ['scopes'],
      },
      execute: (input) => call('/accept', input),
    },
    {
      name: 'write_document',
      description: 'Write one document when the accepted scope allows it.',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['documentId', 'value'],
      },
      execute: (input) => call('/write', input),
    },
    {
      name: 'read_scope_state',
      description: 'Read the current scope offer, acceptance, and document state.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => call('/state'),
    },
  ];
  for (const tool of tools) modelContext.registerTool(tool);
}

async function runDemo() {
  await call('/reset');
  await call('/request', {
    scopes: ['documents:read', 'documents:write:current', 'admin'],
  });
  await call('/accept', {
    scopes: ['documents:read', 'documents:write:current'],
  });
  await call('/write', { documentId: 'current', value: 'shared-state-ok' });
  await call('/write', { documentId: 'other', value: 'must-stay-sealed' });
}

onMount(async () => {
  await call('/state');
  const page = document as Document & { modelContext?: ModelContext };
  const legacy = navigator as Navigator & { modelContext?: ModelContext };
  const modelContext = page.modelContext ?? legacy.modelContext;
  if (modelContext) {
    register(modelContext);
    host = 'native';
  } else {
    host = 'absent';
  }
});
</script>

<svelte:head>
  <meta name="description" content="Native WebMCP proof for Cloudflare applications." />
  <meta property="og:title" content="webmcp-proof" />
  <meta property="og:description" content="An agent asks. Policy narrows. Shared state changes. Excess authority fails." />
</svelte:head>

<main class="min-h-screen bg-ink px-5 py-6 text-slate-100 sm:px-8 lg:px-12">
  <nav class="mx-auto flex max-w-6xl items-center justify-between border-b border-line pb-5 font-mono text-xs uppercase tracking-[0.18em] text-fog">
    <a class="text-slate-100 no-underline" href="/">webmcp-proof</a>
    <div class="flex gap-5">
      <a class="hover:text-white" href="https://github.com/acoyfellow/webmcp-proof/releases/tag/v0.0.1">release</a>
      <a class="hover:text-white" href="https://github.com/acoyfellow/webmcp-proof">source</a>
    </div>
  </nav>

  <section class="mx-auto grid max-w-6xl gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
    <div>
      <p class="mb-5 font-mono text-xs uppercase tracking-[0.22em] text-signal">native browser tools · durable policy</p>
      <h1 class="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl">Let the agent ask.<br />Keep the boundary.</h1>
      <p class="mt-7 max-w-2xl text-lg leading-8 text-fog">A page exposes tools through native WebMCP. The Cloudflare application narrows the request. A Durable Object holds the accepted scope. The same visible state belongs to the person and the agent.</p>
      <div class="mt-9 flex flex-wrap gap-3">
        <button class="rounded-md bg-signal px-5 py-3 font-mono text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50" onclick={runDemo} disabled={busy}>Run the boundary</button>
        <a class="rounded-md border border-line px-5 py-3 font-mono text-sm text-slate-200 hover:border-fog" href="https://deploy.workers.cloudflare.com/?url=https://github.com/acoyfellow/webmcp-proof">Deploy to Cloudflare</a>
      </div>
      <p class="mt-5 font-mono text-xs text-fog">public package · v0.0.1</p>
    </div>

    <div class="rounded-xl border border-line bg-panel p-5 shadow-2xl shadow-black/30">
      <div class="flex items-center justify-between border-b border-line pb-4">
        <span class="font-mono text-xs uppercase tracking-[0.18em] text-fog">live contract</span>
        <span class:!text-mint={host === 'native'} class:!text-signal={host === 'absent'} class="font-mono text-xs text-fog">{host}</span>
      </div>
      <div class="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-line mt-5">
        <article class="bg-panel p-4"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">requested</p><p id="requested" class="mt-3 break-words font-mono text-sm">{state.requested.join(' · ') || 'none'}</p></article>
        <article class="bg-panel p-4"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">offered</p><p id="offered" class="mt-3 break-words font-mono text-sm text-mint">{state.offered.join(' · ') || 'none'}</p></article>
        <article class="bg-panel p-4"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">current</p><p id="current" class="mt-3 break-words font-mono text-sm">{state.documents.current}</p></article>
        <article class="bg-panel p-4"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">other</p><p id="other" class="mt-3 break-words font-mono text-sm">{state.documents.other}</p></article>
      </div>
      <div class="mt-5 flex items-center justify-between font-mono text-xs">
        <span id="last-call" class="text-fog">{lastCall}</span>
        <span id="denials" class="text-signal">{state.writes.filter((write) => !write.allowed).length} denied</span>
      </div>
    </div>
  </section>

  <section class="mx-auto max-w-6xl border-t border-line py-14">
    <div class="grid gap-8 md:grid-cols-3">
      <article><p class="font-mono text-xs text-signal">01 / discover</p><h2 class="mt-3 text-xl font-semibold">Native, not simulated.</h2><p class="mt-3 leading-7 text-fog">The package starts Chrome with WebMCP enabled and speaks the browser protocol directly.</p></article>
      <article><p class="font-mono text-xs text-signal">02 / share</p><h2 class="mt-3 text-xl font-semibold">One visible state.</h2><p class="mt-3 leading-7 text-fog">The person sees the same Durable Object mutation that the agent caused.</p></article>
      <article><p class="font-mono text-xs text-signal">03 / refuse</p><h2 class="mt-3 text-xl font-semibold">Authority stays narrow.</h2><p class="mt-3 leading-7 text-fog">The request can include admin. The offer does not. A write outside the accepted document fails.</p></article>
    </div>
  </section>

  <footer class="mx-auto flex max-w-6xl flex-col gap-3 border-t border-line py-7 font-mono text-xs text-fog sm:flex-row sm:items-center sm:justify-between">
    <span>webmcp-proof · MIT</span>
    <span>native proof: 1.737 sec · Cloudflare Durable Object</span>
  </footer>
</main>

<style>
__WEBMCP_TAILWIND_CSS__
</style>
