# webmcp-proof

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/acoyfellow/webmcp-proof)

Prove that a browser found and called a native WebMCP tool. Keep the browser event, tool result, visible page state, screenshot, and authority denial in one receipt.

The package drives Chrome through the documented WebMCP DevTools protocol. The included Cloudflare application is the dogfood target. It narrows an agent's scope request, stores the accepted scope in a Durable Object, allows one document write, and refuses the same write against another document.

Live dogfood: <https://webmcp-proof.coey.dev>

## Install

```bash
npm install webmcp-proof
```

The caller supplies a Chrome or Chrome for Testing binary that contains the WebMCP testing feature.

```js
import { runWebMcpProof } from 'webmcp-proof';

const receipt = await runWebMcpProof({
  browserPath: process.env.CHROME_PATH,
  url: 'https://your-application.example',
  calls: [
    {
      toolName: 'set_signal',
      input: { value: 'agent-called-this' },
    },
  ],
  inspectExpression: `document.querySelector('#signal').textContent`,
  screenshotPath: 'proof.png',
});

console.log(receipt.tools);
console.log(receipt.calls[0].output);
console.log(receipt.inspected);
```

`runWebMcpProof` starts an isolated browser profile with `WebMCP` and `DevToolsWebMCPSupport`. It enables the native `WebMCP` protocol domain before navigation. It waits for tool discovery, invokes each requested tool, records the invocation and response events, evaluates the visible state, and closes the browser.

## The common path

| Journey | Starts when | Success leaves | Failure leaves | Checked how |
| --- | --- | --- | --- | --- |
| Discover | The page registers a tool | The receipt contains the native tool descriptor | The run ends with a discovery timeout | `tools` in the receipt |
| Call | The caller names a discovered tool | The receipt joins the invocation ID to its response | The run throws the protocol error | `calls` in the receipt |
| Inspect | Calls finish | The receipt contains a value read from the rendered page | The run throws the page exception | `inspected` in the receipt |
| Revoke | The caller runs an `after` action | The tool removal event arrives and a later call fails | The run says which event timed out | `after` in the receipt |
| Capture | The caller supplies a screenshot path | PNG bytes and their SHA-256 digest remain | No screenshot receipt is returned | `screenshot` in the receipt |

## What happens step by step

### Starting

The caller gives the package a browser path, URL, tool calls, and optional HTTP headers. The package creates a temporary browser profile. It does not reuse the person's browser session.

### Ending immediately

A missing browser, unreachable page, absent WebMCP implementation, or missing tool ends the run. The package kills the browser and removes its temporary profile in all cases. Earlier tool mutations may still exist in the target application.

### Beginning the work

The browser opens the page with native WebMCP support enabled. The package listens for `WebMCP.toolsAdded`. A page self-call does not satisfy this step.

### While it runs

Calls run in the supplied order. Each call keeps the protocol invocation ID, the browser's input event, the browser's response event, and the returned output. The package does not decide whether the output is safe. The caller checks the returned state and status.

### Finishing

The package can read one rendered expression and capture one screenshot. It closes the DevTools socket, terminates Chrome, and deletes the isolated profile before it returns the receipt.

## The Cloudflare dogfood application

The included Svelte-Hono and Tailwind application exposes four native tools:

| Tool | Success | Refusal |
| --- | --- | --- |
| `request_scopes` | Records the request and returns a narrower offer | Unknown scopes do not enter the offer |
| `accept_scopes` | Accepts scopes that exist in the current offer | Extra scopes are dropped |
| `write_document` | Writes `current` after its write scope is accepted | Returns 403 for `other` |
| `read_scope_state` | Returns the shared Durable Object state | Requires application authentication |

The person and the agent use the same HTTP routes and see the same durable state. Refreshing the page does not clear it. Reset is explicit. Ending the browser does not undo a completed write.

The dogfood site requires HTTP Basic authentication. An unauthenticated request returns 401. The public deploy template includes a visible placeholder credential so Cloudflare can build the template. The Worker returns 503 while that placeholder remains. Replace `DEMO_AUTH` before using or sharing the deployment.

## Deploy to Cloudflare

Use the button at the top of this page. Cloudflare clones the repository, builds the Svelte-Hono Worker, creates the Durable Object namespace, applies its migration, and deploys the Worker.

During setup, replace `DEMO_AUTH` with `webmcp:` followed by a long random password. The repository cannot include `.dev.vars.example` because the local secret-path policy refuses that filename. The binding description carries the same setup instruction into the deploy form.

For the personal dogfood target:

```bash
bun run site:build
wrangler secret put DEMO_AUTH --config site/wrangler.dogfood.jsonc
wrangler deploy --config site/wrangler.dogfood.jsonc
```

## What changes the result

- `headers` can authenticate the top page and its bundles.
- `requiredToolNames` can require discovery beyond the tools that will be called.
- `featureNames` can pin a different supported Chrome feature set.
- `browserArgs` can add browser launch arguments, including a test DNS mapping.
- `after.expression` can trigger application-owned revocation.
- `after.removedToolNames` requires native removal events.
- `after.deniedCall` requires a later protocol call to fail.

## If they stop or something fails

A normal return or thrown error terminates the child browser and removes its profile. An abrupt caller exit can leave both the browser and its temporary `.webmcp-proof-*` directory. The operator must terminate that browser and remove that directory. The package does not roll back target-side mutations. A network failure after a tool mutates state can leave the mutation without a returned receipt. Applications need their own idempotency and audit rules.

## What this is not

- It is not a WebMCP polyfill.
- It is not a page self-test.
- It is not an AI agent or a ChatGPT host.
- It does not grant, narrow, or revoke authority for the application.
- It does not turn a 200 response into proof of safe behavior.
- It does not bypass page authentication.
- It does not drive the operator's normal browser profile.
- The dogfood policy is an example, not part of the package API.

## Proof

Local package and site checks:

```bash
bun run check
bun run build
```

A clean consumer installs the packed tarball and runs five native WebMCP calls against the live dogfood site:

```bash
bun run build
rm -rf .pack && mkdir .pack
npm pack --pack-destination .pack
cd proof/consumer
bun install
BROWSER_PATH=/path/to/chrome \
TARGET_URL=https://webmcp-proof.coey.dev/ \
DEMO_AUTH='webmcp:your-password' \
bun run proof
```

The current receipts are in `proof/consumer.json`, `proof/native-host.json`, and `proof/scope-native.json`. The first native host proved discovery, visible mutation, removal, and denial after revocation. The Scope Negotiator proved a narrowed offer, an allowed shared mutation, and a 403 outside that scope.

## Experiment exhaust

This repository began as one notebook with six independent lanes. The host probe established native protocol access. Room Code Mode reached only a partial synthetic boundary. Scope Negotiator won the frozen comparison. Echo self-binding and Sandbox Rehearsal remain bounded experiments. Lifo stayed blocked because no matching public source and immutable revision were available.

The extracted package is the earned native browser proof seam. It does not merge the six runtimes or claim that synthetic runs were native evidence.

## Known gaps

- Chrome WebMCP remains an early preview. Protocol names can change.
- The package supports Chromium's DevTools WebMCP domain only.
- A hard-killed caller can leave a temporary profile directory.
- The live dogfood uses one shared Durable Object instance for all authenticated callers.
- The deploy template starts with a documented placeholder credential. The deployer must replace it.

## License

MIT
