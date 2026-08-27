# Runtime availability

Verified on 2026-08-27.

- The WebMCP specification at `webmachinelearning/webmcp@41d12f057167ccf5954dbcf49d99502cb6c84491` defines secure-context methods on `document.modelContext`: `registerTool`, `getTools`, and `executeTool`.
- `@cloudflare/sandbox@0.12.9` is public. Source at `cloudflare/sandbox-sdk@20f9da4a9eb297db64375c0a98753626e91b52ac` exposes `getSandbox`, `proxyToSandbox`, `exec`, `writeFile`, and `readFile`.
- `@cloudflare/computer@0.2.1` is public preview. It is not required for the smallest rehearsal.
- The public npm package `lifo@0.0.2` is a 2014 stack package and is unrelated.
- GitHub code and repository searches did not locate the browser-native Unix described in the intake. No source, immutable revision, package, owner, or authentication path is available.
- The configured scoped npm registry redirects public `@cloudflare/*` lookups through an expired Access path. Direct `registry.npmjs.org` metadata works. Any extracted public package must keep the project-local registry override.
