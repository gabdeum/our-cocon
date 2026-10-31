// Spec 045 FR-009: "Delete my account" (spec 003). Deletes the account as the member, through
// `delete_my_account` and every check it makes, then revokes their Sign in with Apple at Apple.
// Apple never holds up the deletion: what it doesn't take stays queued for the nightly retry.
// Kept free of Deno and npm imports so the tests run it with fake dependencies; index.ts wires the real ones.
import { claimsOf, revokeQueued, type Apple, type RevocationQueue } from '../_shared/apple.ts';
import { bearer, headers, json } from '../_shared/http.ts';

export interface Deps extends RevocationQueue {
  apple: Apple | null;
  /** `delete_my_account()` with the member's own token; its error message as the app knows it (familyErrorOf). */
  deleteAccount(jwt: string): Promise<{ ok: true } | { ok: false; status: number; message: string }>;
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { status: 'method_not_allowed' });
  const token = bearer(request);
  if (!token) return json(401, { message: 'not_signed_in' });
  let deleted;
  try {
    deleted = await deps.deleteAccount(token);
  } catch {
    return json(500, { message: 'failed' });
  }
  if (!deleted.ok) return json(deleted.status, { message: deleted.message });
  // The database accepted the token, so its `sub` is the person just deleted.
  const userId = claimsOf(token)?.sub;
  if (deps.apple && typeof userId === 'string') await revokeQueued(deps.apple, deps, userId).catch(() => undefined);
  return json(200, { status: 'deleted' });
}
