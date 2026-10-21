// Spec 019: the share endpoint, the only public way to read a shared recipe (FR-002). Kept free of
// Deno and npm imports so the tests run it with fake dependencies; index.ts wires the real ones.

/** A share token: 32 random bytes in base64url (packages/schemas/share.ts). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** A stored photo (packages/schemas/recipes.ts PhotoPath). */
const PHOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|webp)$/;
/** Signed photo links last an hour, like the app's own (032-later L26). */
export const SIGNED_SECONDS = 60 * 60;

export interface Shared {
  photo_prefix: string;
  recipe: {
    photo_path: string | null;
    steps: { photo_path: string | null }[];
    variants: { changes: unknown }[];
  } & Record<string, unknown>;
}

export interface Deps {
  /** `shared_recipe(token)` with the service role: null when the link isn't shared. */
  sharedRecipe: (token: string) => Promise<Shared | null>;
  /**
   * Signed links by path, as `/storage/v1/object/sign/…?token=…`: inside Supabase the function
   * only knows an internal address, so callers put their own public Supabase URL in front.
   * Paths it can't sign are left out.
   */
  signPhotos: (paths: string[], seconds: number) => Promise<Record<string, string>>;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

/** Every photo the page can show: the header, the steps and the steps variants add. */
export function photoPaths(shared: Shared): string[] {
  const added = shared.recipe.variants.flatMap((v) =>
    Array.isArray(v.changes)
      ? v.changes.flatMap((c: unknown) => {
          const step = (c as { type?: unknown; step?: { photo_path?: unknown } } | null)?.step;
          return (c as { type?: unknown })?.type === 'add_step' && typeof step?.photo_path === 'string' ? [step.photo_path] : [];
        })
      : [],
  );
  const all = [shared.recipe.photo_path, ...shared.recipe.steps.map((s) => s.photo_path), ...added];
  // Only this recipe's own folder, whatever a row says.
  return [...new Set(all.filter((p): p is string => typeof p === 'string' && PHOTO.test(p) && p.startsWith(shared.photo_prefix)))];
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return json(405, { status: 'method_not_allowed' });
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!TOKEN.test(token)) return json(404, { status: 'not_shared' });
  try {
    const shared = await deps.sharedRecipe(token);
    if (!shared) return json(404, { status: 'not_shared' });
    const paths = photoPaths(shared);
    const signedPhotos = paths.length > 0 ? await deps.signPhotos(paths, SIGNED_SECONDS) : {};
    // `photo_prefix` stays here; photo paths (and their signed links) are the only place ids show.
    return json(200, { recipe: shared.recipe, signedPhotos });
  } catch {
    return json(500, { status: 'error' });
  }
}
