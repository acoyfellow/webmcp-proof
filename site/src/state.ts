export interface ScopeStateValue {
  requested: string[];
  offered: string[];
  accepted: string[];
  documents: Record<string, string>;
  writes: Array<{ documentId: string; value: string; allowed: boolean }>;
}

const initialState = (): ScopeStateValue => ({
  requested: [],
  offered: [],
  accepted: [],
  documents: { current: 'ready', other: 'sealed' },
  writes: [],
});

export class ScopeState {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request) {
    const url = new URL(request.url);
    const stored = (await this.state.storage.get<ScopeStateValue>('state')) ?? initialState();
    if (request.method === 'GET') return Response.json(stored);
    const input = (await request.json()) as Record<string, unknown>;
    if (url.pathname === '/request') {
      const requested = Array.isArray(input.scopes) ? input.scopes.map(String) : [];
      const offered = requested.filter((scope) =>
        ['documents:read', 'documents:write:current'].includes(scope),
      );
      const next = { ...stored, requested, offered };
      await this.state.storage.put('state', next);
      return Response.json(next);
    }
    if (url.pathname === '/accept') {
      const accepted = Array.isArray(input.scopes)
        ? input.scopes.map(String).filter((scope) => stored.offered.includes(scope))
        : [];
      const next = { ...stored, accepted };
      await this.state.storage.put('state', next);
      return Response.json(next);
    }
    if (url.pathname === '/write') {
      const documentId = String(input.documentId ?? '');
      const value = String(input.value ?? '');
      const allowed =
        documentId === 'current' && stored.accepted.includes('documents:write:current');
      const next = {
        ...stored,
        documents: allowed ? { ...stored.documents, current: value } : stored.documents,
        writes: [...stored.writes, { documentId, value, allowed }],
      };
      await this.state.storage.put('state', next);
      return Response.json(next, { status: allowed ? 200 : 403 });
    }
    if (url.pathname === '/reset') {
      const next = initialState();
      await this.state.storage.put('state', next);
      return Response.json(next);
    }
    return new Response('Not found', { status: 404 });
  }
}
