# Host deployment exhaust

The single-file host probe deployed to the personal account as `webmcp-host-probe.coy.workers.dev`, version `84861b74-f4eb-41ea-a12e-35c13052ee56`.

Guardrail then fetched the live root, observed HTTP 200 without authentication, and rejected the deployment as open. The Worker was immediately deleted. No override was used.

This separates two facts:

- OpenAI documents that its in-app browser supports WebMCP.
- This notebook has not observed an agent in that host discover or call this page's tool.

The remaining choice is a security-product decision: protect the demo with Access or explicit code authentication, or explicitly approve a public non-sensitive challenge surface. The experiment cannot decide that policy by itself.
