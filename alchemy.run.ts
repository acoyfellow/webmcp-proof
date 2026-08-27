import alchemy from 'alchemy';
import { DurableObjectNamespace, Worker } from 'alchemy/cloudflare';

const app = await alchemy('webmcp-proof');
const demoAuth = process.env.DEMO_AUTH;
if (!demoAuth) throw new Error('DEMO_AUTH is required');
const scope = DurableObjectNamespace('webmcp-proof-scope', {
  className: 'ScopeState',
  sqlite: true,
});
const worker = await Worker('webmcp-proof-worker', {
  name: 'webmcp-proof',
  entrypoint: './site/build/worker.bundled.mjs',
  adopt: true,
  compatibilityDate: '2026-08-27',
  compatibilityFlags: ['nodejs_compat'],
  url: false,
  domains: [{ domainName: 'webmcp-proof.coey.dev', adopt: true }],
  bindings: {
    SCOPE: scope,
    DEMO_AUTH: alchemy.secret(demoAuth),
  },
});

await app.finalize();
export { app, worker };
