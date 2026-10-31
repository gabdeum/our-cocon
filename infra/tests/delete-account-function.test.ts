import { expect, it, vi } from 'vitest';
import type { Apple } from '../../supabase/functions/_shared/apple';
import { handle, type Deps } from '../../supabase/functions/delete-account/handler';

// Spec 045 FR-009: "Delete my account" deletes as the member, then revokes Sign in with Apple at
// Apple, never held up by Apple (fake database and Apple).
const jwt = `h.${Buffer.from(JSON.stringify({ sub: 'user-eva', role: 'authenticated' })).toString('base64url')}.s`;
const apple = (revoke: Apple['revoke'] = vi.fn(async () => true)): Apple => ({ exchange: vi.fn(), revoke });
const deps = (over: Partial<Deps> = {}): Deps => ({
  apple: apple(),
  deleteAccount: vi.fn(async () => ({ ok: true as const })),
  toRevoke: vi.fn(async () => [{ id: 7, refresh_token: 'r-eva' }]),
  tried: vi.fn(async () => undefined),
  ...over,
});
const post = (token?: string) =>
  new Request('http://kong:8000/functions/v1/delete-account', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });

it('deletes the account as the member, then revokes their Apple sign-in', async () => {
  const d = deps();
  const res = await handle(post(jwt), d);
  expect(res.status).toBe(200);
  expect(d.deleteAccount).toHaveBeenCalledWith(jwt);
  expect(d.toRevoke).toHaveBeenCalledWith('user-eva');
  expect(d.tried).toHaveBeenCalledWith(7, true);
});

it("still deletes when Apple can't be reached, and keeps the token for the nightly retry", async () => {
  const d = deps({ apple: apple(async () => Promise.reject(new Error('timeout'))) });
  expect((await handle(post(jwt), d)).status).toBe(200);
  expect(d.tried).toHaveBeenCalledWith(7, false);
  const broken = deps({ toRevoke: async () => Promise.reject(new Error('db down')) });
  expect((await handle(post(jwt), broken)).status).toBe(200);
});

it("passes on the database's refusal, and revokes nothing then", async () => {
  const d = deps({ deleteAccount: async () => ({ ok: false, status: 400, message: 'owner_must_delete_family' }) });
  const res = await handle(post(jwt), d);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ message: 'owner_must_delete_family' });
  expect(d.toRevoke).not.toHaveBeenCalled();
});

it('needs a signed-in member', async () => {
  const d = deps();
  expect((await handle(post(), d)).status).toBe(401);
  expect(d.deleteAccount).not.toHaveBeenCalled();
  expect((await handle(new Request('http://kong:8000/functions/v1/delete-account'), d)).status).toBe(405);
});

it('works without Apple set up (locally)', async () => {
  const d = deps({ apple: null });
  expect((await handle(post(jwt), d)).status).toBe(200);
  expect(d.toRevoke).not.toHaveBeenCalled();
});
