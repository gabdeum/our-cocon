// Spec 072: the grocery share endpoint, the only public way to read or change a shared list
// (FR-003). Kept free of Deno and npm imports so the tests run it with fake dependencies; index.ts
// wires the real ones. The database checks the link on every call; this only checks shapes.

/** A share token: 32 random bytes in base64url (packages/schemas/share.ts). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** As the database's own checks: a row at most 80 characters, at most 500 rows at once. */
const MAX_NAME = 80;
const MAX_IDS = 500;

/**
 * A database refusal the page tells apart: the migration's `raise exception` names, and `invalid`
 * for a row the table's own checks refuse (an unknown unit, a blank name).
 */
export type Refusal = 'not_shared' | 'read_only' | 'too_many' | 'invalid';

export interface Deps {
  /** A service-role RPC: its result, or the refusal's name (any other failure throws). */
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown } | { refused: Refusal }>;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const refusedStatus: Record<Refusal, number> = { not_shared: 404, read_only: 403, too_many: 429, invalid: 400 };

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= MAX_IDS && v.every((i) => typeof i === 'string' && ID.test(i));

/** A write's RPC and arguments, or null when the body isn't one. */
function write(body: Record<string, unknown>, token: string): { fn: string; args: Record<string, unknown> } | null {
  switch (body.op) {
    case 'add': {
      const { name, quantity, unit, full, core } = body;
      if (!text(name, MAX_NAME) || !name.trim() || !text(full, MAX_NAME) || !text(core, MAX_NAME)) return null;
      if (quantity !== null && (typeof quantity !== 'number' || !Number.isFinite(quantity))) return null;
      if (unit !== null && !text(unit, 20)) return null;
      return { fn: 'shared_grocery_add', args: { p_token: token, p_name: name, p_quantity: quantity, p_unit: unit, p_full: full, p_core: core } };
    }
    case 'check':
      if (!ids(body.ids) || typeof body.checked !== 'boolean') return null;
      return { fn: 'shared_grocery_check', args: { p_token: token, p_ids: body.ids, p_checked: body.checked } };
    case 'clear':
    case 'restore':
      if (!ids(body.ids)) return null;
      return { fn: `shared_grocery_${body.op}`, args: { p_token: token, p_ids: body.ids } };
    default:
      return null;
  }
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    if (request.method === 'GET') {
      const token = new URL(request.url).searchParams.get('token') ?? '';
      if (!TOKEN.test(token)) return json(404, { status: 'not_shared' });
      const result = await deps.rpc('shared_groceries', { p_token: token });
      if ('refused' in result) return json(refusedStatus[result.refused], { status: result.refused });
      if (!result.data) return json(404, { status: 'not_shared' });
      return json(200, result.data);
    }
    if (request.method !== 'POST') return json(405, { status: 'method_not_allowed' });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json(400, { status: 'bad_request' });
    const { token } = body as { token?: unknown };
    if (typeof token !== 'string' || !TOKEN.test(token)) return json(404, { status: 'not_shared' });
    const call = write(body as Record<string, unknown>, token);
    if (!call) return json(400, { status: 'bad_request' });
    const result = await deps.rpc(call.fn, call.args);
    if ('refused' in result) return json(refusedStatus[result.refused], { status: result.refused });
    return json(200, { status: 'ok', result: result.data });
  } catch {
    return json(500, { status: 'error' });
  }
}
