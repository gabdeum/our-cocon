import { describe, expect, it, vi } from 'vitest';
import { handle, photoPaths, SIGNED_SECONDS, type Deps, type Shared } from '../../supabase/functions/shared-recipe/handler';

// Spec 019: the share endpoint (supabase/functions/shared-recipe), with fake database and storage.
const token = 'a'.repeat(43);
const fam = '11111111-1111-4111-8111-111111111111';
const rec = '22222222-2222-4222-8222-222222222222';
const photo = (folder: string, n: number) => `${folder}/${String(n).repeat(8)}-0000-4000-8000-000000000000.jpg`;
const own = `${fam}/${rec}`;
const other = `${fam}/33333333-3333-4333-8333-333333333333`;

const shared = (over: Partial<Shared['recipe']> = {}): Shared => ({
  photo_prefix: `${own}/`,
  recipe: { name: 'Quiche', photo_path: photo(own, 1), steps: [{ photo_path: photo(own, 2) }, { photo_path: null }], variants: [], ...over },
});

function deps(found: Shared | null = shared()): Deps & { signPhotos: ReturnType<typeof vi.fn> } {
  return {
    sharedRecipe: vi.fn(async () => found),
    signPhotos: vi.fn(async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, `/storage/v1/object/sign/recipe-photos/${p}?token=t`]))),
  };
}

type Body = { signedPhotos: Record<string, string> };
const get = (query: string) => new Request(`http://kong:8000/functions/v1/shared-recipe${query}`);

describe('shared-recipe endpoint', () => {
  it('returns the shared fields and signed photo links, never the photo folder (FR-002, L26)', async () => {
    const d = deps();
    const res = await handle(get(`?token=${token}`), d);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(Object.keys(body).sort()).toEqual(['recipe', 'signedPhotos']);
    expect(JSON.stringify(body)).not.toContain('photo_prefix');
    expect(Object.keys(body.signedPhotos).sort()).toEqual([photo(own, 1), photo(own, 2)].sort());
    expect(d.signPhotos).toHaveBeenCalledWith(expect.any(Array), SIGNED_SECONDS);
  });

  it('is never cached or indexed (FR-005)', async () => {
    const res = await handle(get(`?token=${token}`), deps());
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('answers the same "not shared" for a stopped link, a deleted recipe or a guess (US3, L38)', async () => {
    for (const query of [`?token=${token}`, '?token=short', '', `?token=${'%'.repeat(43)}`]) {
      const d = deps(null);
      const res = await handle(get(query), d);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ status: 'not_shared' });
    }
  });

  it('does not ask the database about a malformed token', async () => {
    const d = deps();
    await handle(get('?token=../../etc'), d);
    expect(d.sharedRecipe).not.toHaveBeenCalled();
  });

  it('signs only photos in the recipe\'s own folder (SC-001)', () => {
    const paths = photoPaths(
      shared({
        photo_path: photo(other, 1),
        steps: [{ photo_path: photo(own, 2) }, { photo_path: '../secret.jpg' }],
        variants: [{ changes: [{ type: 'add_step', step: { photo_path: photo(own, 3) } }, { type: 'add_step', step: { photo_path: photo(other, 4) } }] }],
      }),
    );
    expect(paths.sort()).toEqual([photo(own, 2), photo(own, 3)].sort());
  });

  it('skips signing when there are no photos', async () => {
    const d = deps(shared({ photo_path: null, steps: [] }));
    const body = (await (await handle(get(`?token=${token}`), d)).json()) as Body;
    expect(body.signedPhotos).toEqual({});
    expect(d.signPhotos).not.toHaveBeenCalled();
  });

  it('answers preflight requests and refuses writes', async () => {
    expect((await handle(new Request('http://x/', { method: 'OPTIONS' }), deps())).status).toBe(204);
    expect((await handle(new Request('http://x/', { method: 'POST' }), deps())).status).toBe(405);
  });

  it('says only "error" when the database fails', async () => {
    const d = deps();
    d.sharedRecipe = vi.fn(async () => {
      throw new Error('connection refused at 10.0.0.3');
    });
    const res = await handle(get(`?token=${token}`), d);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: 'error' });
  });
});
