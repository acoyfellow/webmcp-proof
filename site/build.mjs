import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildHonoSvelte } from 'svelte-hono/build';

execFileSync(
  './node_modules/.bin/tailwindcss',
  ['-i', './site/src/app.css', '-o', './site/src/tailwind.generated.css', '--minify'],
  { stdio: 'inherit' },
);
const template = readFileSync('./site/src/Home.svelte', 'utf8');
const css = readFileSync('./site/src/tailwind.generated.css', 'utf8');
writeFileSync('./site/src/Home.generated.svelte', template.replace('__WEBMCP_TAILWIND_CSS__', css));
const result = await buildHonoSvelte({
  workerEntry: './site/worker.ts',
  outDir: './site/build',
  components: { home: './src/Home.generated.svelte' },
});
console.log(`SITE_BUILD_OK:${result.workerBytes}`);
