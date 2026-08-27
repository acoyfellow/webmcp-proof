# Existing seams

Verified against local source on 2026-08-27.

## Room

- `room/src/worker.ts:191` wraps an async function receiving `{ log, messages }`.
- `runTurn` creates a Worker Loader isolate with `globalOutbound: null` and a 10-second CPU limit.
- The isolate receives only normalized room messages.
- `room_run` writes the isolate result back as a normal `turn` message.
- The experiment should reproduce this narrow contract, not import Room's deployment or bindings.

## Echo

- `echo/src/index.ts` mints an HMAC-signed session for one canonical origin and rejects path, session, and origin mismatches.
- `EchoAgent.bootPlan` and `runPlan` give the Loader exactly one `TAB` binding with `globalOutbound: null`.
- The extension stores one `tabId`, executes in that tab's main world, and closes its local session when that tab closes.
- A self-bound WebMCP experiment may target only its own harmless page. It must not claim to replace Echo's extension for arbitrary tabs.

## Boundary

Room and Echo remain separate experiments. Room must not carry an Echo bearer token, call Echo, or receive an Echo binding. Echo must not receive a Room, host, network, or Pantry binding. A result must remain tied to the native room message or Echo workflow plan receipt.
