// Shared by the signed-in functions (spec 045): JSON answers the app can call from the web too.

export const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Cache-Control': 'no-store',
};

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

/** The bearer token, or '' without one. */
export function bearer(request: Request): string {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? '';
}
