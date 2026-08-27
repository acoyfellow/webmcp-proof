import { Hono } from 'hono';
import { attachSvelteRoutes, svelteRenderer } from 'svelte-hono';
import { bundles } from './bundles.generated';
import Home from './src/Home.generated.svelte';
import { ScopeState } from './src/state';

interface Env {
  Bindings: {
    SCOPE: DurableObjectNamespace;
    DEMO_AUTH: string;
  };
}

const app = new Hono<Env>();
attachSvelteRoutes(app as unknown as Hono, { bundles });

function sameText(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

app.use('*', async (context, next) => {
  if (
    !context.env.DEMO_AUTH ||
    context.env.DEMO_AUTH === 'webmcp:replace-with-a-long-random-password'
  ) {
    return context.text('Replace the DEMO_AUTH placeholder before using this deployment', 503);
  }
  const supplied = context.req.raw.headers.get('Authorization') ?? '';
  const expected = `Basic ${btoa(context.env.DEMO_AUTH)}`;
  if (!sameText(supplied, expected)) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="webmcp-proof"' },
    });
  }
  const origin = context.req.raw.headers.get('Origin');
  if (origin && origin !== new URL(context.req.url).origin) {
    return context.text('Cross-origin mutation refused', 403);
  }
  await next();
});

function scopeStub(context: { env: Env['Bindings'] }) {
  return context.env.SCOPE.get(context.env.SCOPE.idFromName('shared'));
}

app.get(
  '/',
  svelteRenderer(Home, {
    hydrateAs: 'home',
    title: 'webmcp-proof — native browser tools with a durable boundary',
    cacheControl: 'private, max-age=0, must-revalidate',
  }),
);
app.get('/api/state', (context) => scopeStub(context).fetch('https://scope/state'));
app.post('/api/request', (context) =>
  scopeStub(context).fetch('https://scope/request', context.req.raw),
);
app.post('/api/accept', (context) =>
  scopeStub(context).fetch('https://scope/accept', context.req.raw),
);
app.post('/api/write', (context) =>
  scopeStub(context).fetch('https://scope/write', context.req.raw),
);
app.post('/api/reset', (context) =>
  scopeStub(context).fetch('https://scope/reset', context.req.raw),
);
app.get('/health', (context) => context.json({ ok: true, service: 'webmcp-proof' }));

export { ScopeState };
export default app;
