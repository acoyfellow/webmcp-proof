# Findings

## Iteration 1

- The first dependency is the browser host, not a Cloudflare backend.
- The experiments must compete against one gate. Combining them before comparison would hide which interaction works.
- `mcp-code-mode` is a Node/Bun MCP wrapper. It is not the WebMCP runtime for this notebook.
- Echo's extension is part of its general tab-pinning trust model. The experiment may bind its own page, but must not claim that the extension became unnecessary for arbitrary tabs.
- Room already has disposable URLs, shared Durable Object state, and Worker Loader execution without ambient network. It is reference material, not a dependency copied by default.

## Iteration 2

- Reuse Room and Echo contracts, not their runtime bindings or deployments.
- Room Code Mode can stay one page tool: `run_code`, with only `read_messages` and `append_message` inside guest code.
- Echo self-binding may target one experiment-owned page. It cannot replace Echo's extension for arbitrary tabs.
- Passing an Echo bearer token through Room would cross both published boundaries and kills the experiment.
- Both candidates need an observed denial or revocation. Isolation configuration alone is a claim, not the authority proof.

## Iteration 3

- The current specification uses secure-context `document.modelContext`, not `navigator.modelContext`.
- The native browser host is early-preview infrastructure. A shim can test app behavior but cannot prove challenge-host compatibility.
- `@cloudflare/sandbox@0.12.9` is the smallest verified runtime for rehearsal. `@cloudflare/computer@0.2.1` is public preview but adds no value to that first proof.
- The configured scoped npm registry intercepts public `@cloudflare/*` queries. Direct public registry metadata works; the extracted repo will need its project-local override.
- The Lifo candidate is blocked, not disproved. No source or immutable revision has been identified, and the public npm package with that name is unrelated.

## Iteration 4

- OpenAI's challenge page confirms ChatGPT's in-app browser supports WebMCP and Chrome may use an experimental flag or origin trial.
- The host research child timed out without output. It is an execution failure, not research evidence, and was not retried.
- The one-file probe deployed successfully to the personal account.
- Guardrail then observed the live endpoint returning unauthenticated HTTP 200 and rejected it. The Worker was immediately deleted.
- A public challenge URL and the standing Access/code-auth requirement are in direct tension. The experiment cannot silently choose which security policy loses.
- Local candidate behavior can continue, but native host discovery remains blocked until the demo authentication model is chosen.

## Iteration 5

- Four synthetic behavior spikes share one result shape that prevents simulation from satisfying native-host or Cloudflare requirements.
- Scope Negotiator, Echo self-binding, and Sandbox Rehearsal each produced a visible denial. Room Code Mode produced only a partial local boundary because Node VM is not Worker Loader.
- No candidate is eligible. Scope Negotiator is only the smallest provisional interaction shape.
- Five hard receipt classes now fit one schema: mechanical gate, verified disproval, surface deletion, reusable hammer, and negative result.

## Iteration 6

- HTTP Basic authentication resolves the deployment-policy conflict without an override.
- The host probe is live on the personal account. Unauthenticated root returns 401; authenticated root returns 200; Guardrail reports `code-auth`.
- Preview URLs are disabled to avoid an extra surface.
- Native WebMCP discovery and tool invocation still require one observation in ChatGPT's in-app browser. Server proof cannot substitute for that host proof.
