// Spec 045 FR-009: what the server needs to revoke a Sign in with Apple when its account is deleted
// (App Store rules). Used by the apple-sign-in and delete-account functions. Kept free of Deno and
// npm imports (Web Crypto and fetch only) so the tests run it as is.

export interface AppleConfig {
  teamId: string;
  /** The app's bundle ID: Apple issues the app's tokens to it. */
  clientId: string;
  keyId: string;
  /** The Sign in with Apple key (.p8), PEM text. */
  privateKey: string;
}

/** From the function's settings (infra/supabase/cocon.override.yml); null when Apple isn't set up (locally). */
export function appleConfig(env: (name: string) => string | undefined): AppleConfig | null {
  const teamId = env('APPLE_TEAM_ID');
  const clientId = env('APPLE_CLIENT_ID');
  const keyId = env('APPLE_KEY_ID');
  const key = env('APPLE_PRIVATE_KEY');
  if (!teamId || !clientId || !keyId || !key) return null;
  // provision.sh stores the key as base64, one line.
  return { teamId, clientId, keyId, privateKey: atob(key) };
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

/** The claims of a JWT, unchecked: only for tokens already checked elsewhere, or that came straight from Apple. */
export function claimsOf(jwt: string): Record<string, unknown> | null {
  try {
    const payload = jwt.split('.')[1] ?? '';
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Apple's client secret: a short-lived ES256 JWT signed with the key (Apple allows up to 6 months). */
export async function clientSecret(config: AppleConfig, now = Date.now()): Promise<string> {
  const der = Uint8Array.from(atob(config.privateKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const iat = Math.floor(now / 1000);
  const unsigned = `${text({ alg: 'ES256', kid: config.keyId })}.${text({ iss: config.teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: config.clientId })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

export interface Apple {
  /** Swaps the app's one-time code for a refresh token, with the Apple account (`sub`) it belongs to. Null if Apple refuses. */
  exchange(code: string): Promise<{ refreshToken: string; sub: string } | null>;
  /** True once Apple has revoked it. */
  revoke(refreshToken: string): Promise<boolean>;
}

export function appleApi(config: AppleConfig, http: typeof fetch = fetch): Apple {
  const post = async (path: string, fields: Record<string, string>) =>
    http(`https://appleid.apple.com/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: await clientSecret(config), ...fields }),
    });
  return {
    async exchange(code) {
      const res = await post('token', { code, grant_type: 'authorization_code' });
      if (!res.ok) return null;
      const body = (await res.json()) as { refresh_token?: string; id_token?: string };
      const sub = claimsOf(body.id_token ?? '')?.sub;
      return body.refresh_token && typeof sub === 'string' ? { refreshToken: body.refresh_token, sub } : null;
    },
    async revoke(refreshToken) {
      const res = await post('revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
      return res.ok;
    },
  };
}

/** The queue of tokens to revoke (migration apple_sign_in), through the service key. */
export interface RevocationQueue {
  toRevoke(userId?: string): Promise<{ id: number; refresh_token: string }[]>;
  tried(id: number, revoked: boolean): Promise<void>;
}

/** Tries each queued token (one person's, or all); what Apple doesn't take stays for the next night. */
export async function revokeQueued(apple: Apple, queue: RevocationQueue, userId?: string): Promise<{ revoked: number; left: number }> {
  let revoked = 0;
  let left = 0;
  for (const { id, refresh_token } of await queue.toRevoke(userId)) {
    const ok = await apple.revoke(refresh_token).catch(() => false);
    await queue.tried(id, ok);
    if (ok) revoked += 1;
    else left += 1;
  }
  return { revoked, left };
}
