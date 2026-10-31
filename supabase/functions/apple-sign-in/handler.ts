// Spec 045 FR-009: keeps what deleting an account made with Apple needs to revoke it at Apple, and
// retries the revokes Apple didn't take. Kept free of Deno and npm imports so the tests run it with
// fake dependencies; index.ts wires the real ones.
//
//   POST { code }          a member's token: right after Sign in with Apple, the app sends Apple's
//                          one-time code; the server swaps it for a refresh token and keeps it.
//   POST { retry: true }   the service key: the nightly purge revokes what's still queued.
import { claimsOf, revokeQueued, type Apple, type RevocationQueue } from '../_shared/apple.ts';
import { bearer, headers, json } from '../_shared/http.ts';

export interface Deps extends RevocationQueue {
  serviceKey: string;
  /** Null when Sign in with Apple isn't set up (locally): nothing to keep or revoke. */
  apple: Apple | null;
  /** The person behind a member's token, with their Apple account (`sub`); null for a token Auth refuses. */
  member(jwt: string): Promise<{ id: string; appleSub: string | null } | null>;
  keepToken(userId: string, refreshToken: string): Promise<void>;
}

/** Apple's codes are short base64url-ish strings; anything else isn't one. */
const CODE = /^[A-Za-z0-9._-]{10,512}$/;

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { status: 'method_not_allowed' });
  const token = bearer(request);
  const body = (await request.json().catch(() => null)) as { code?: unknown; retry?: unknown } | null;
  try {
    if (body?.retry === true) {
      if (!token || token !== deps.serviceKey) return json(401, { status: 'unauthorized' });
      if (!deps.apple) return json(200, { revoked: 0, left: (await deps.toRevoke()).length });
      return json(200, await revokeQueued(deps.apple, deps));
    }
    if (typeof body?.code !== 'string' || !CODE.test(body.code)) return json(400, { status: 'bad_request' });
    // Members only: an AI assistant's token (role cocon_assistant) is refused, like on account
    // changes. `member` then has Auth check the token itself.
    const member = token && claimsOf(token)?.role === 'authenticated' ? await deps.member(token) : null;
    if (!member) return json(401, { status: 'unauthorized' });
    if (!member.appleSub) return json(403, { status: 'not_apple' });
    if (!deps.apple) return json(200, { status: 'not_configured' });
    const exchanged = await deps.apple.exchange(body.code);
    if (!exchanged) return json(502, { status: 'apple_refused' });
    // A code for another Apple account is never kept on this one.
    if (exchanged.sub !== member.appleSub) return json(403, { status: 'not_apple' });
    await deps.keepToken(member.id, exchanged.refreshToken);
    return json(200, { status: 'kept' });
  } catch {
    return json(500, { status: 'error' });
  }
}
