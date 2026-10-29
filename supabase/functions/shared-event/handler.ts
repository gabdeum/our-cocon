// Spec 042 FR-005: the event share endpoint, the only public way to read a shared event date. Kept
// free of Deno and npm imports so the tests run it with fake dependencies; index.ts wires the real one.

/** A share token: 32 random bytes in base64url (packages/schemas/share.ts). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export interface Deps {
  /**
   * `shared_event(token)` with the service role: the title, day, time, place and first names
   * (SharedEventResponse), or null when the link is stopped, the event is over or deleted.
   */
  sharedEvent: (token: string) => Promise<Record<string, unknown> | null>;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return json(405, { status: 'method_not_allowed' });
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!TOKEN.test(token)) return json(404, { status: 'not_shared' });
  try {
    const shared = await deps.sharedEvent(token);
    return shared ? json(200, shared) : json(404, { status: 'not_shared' });
  } catch {
    return json(500, { status: 'error' });
  }
}
