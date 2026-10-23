// Local Supabase for the MCP server's integration tests (constitution VII): people, families and
// a real OAuth connection, as an assistant gets one. `pnpm dev` starts Supabase; CI starts it first.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Db } from '@cocon/data';
import type { Database } from '@cocon/schemas';

export function localSupabase(): { url: string; anonKey: string; serviceKey: string } | null {
  try {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const status = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, string | undefined>;
    if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) return null;
    return { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY };
  } catch {
    return null;
  }
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** A new confirmed person, signed in to the app through a magic link. Records their id in `userIds`. */
export async function signInPerson(admin: Db, url: string, anonKey: string, email: string, userIds: string[]): Promise<Db> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  userIds.push(created.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const client = createClient<Database>(url, anonKey, options);
  const signedIn = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' });
  if (signedIn.error) throw signedIn.error;
  return client;
}

export const adminClient = (url: string, serviceKey: string): Db => createClient<Database>(url, serviceKey, options);

/**
 * What an assistant does to connect (spec 023 FR-001): register itself (dynamic registration),
 * send the member to approve (here: the member's app session approves, as /oauth/consent does),
 * then swap the code for a token with PKCE.
 */
export interface Connection {
  token: string;
  refreshToken: string;
  clientId: string;
}

export async function connectAssistant(url: string, member: Db, redirectUri = 'https://claude.ai/api/mcp/auth_callback'): Promise<Connection> {
  const registered = await fetch(`${url}/auth/v1/oauth/clients/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'Claude', redirect_uris: [redirectUri], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }),
  });
  if (!registered.ok) throw new Error(`register: ${registered.status}`);
  const { client_id } = (await registered.json()) as { client_id: string };
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authorize = await fetch(
    `${url}/auth/v1/oauth/authorize?${new URLSearchParams({ client_id, redirect_uri: redirectUri, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 's' })}`,
    { redirect: 'manual' },
  );
  const authorizationId = new URL(authorize.headers.get('location') ?? 'http://x').searchParams.get('authorization_id');
  if (!authorizationId) throw new Error(`authorize: ${authorize.status}`);
  // The consent page reads the request first; that ties it to the signed-in member.
  const details = await member.auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error) throw details.error;
  const approved = await member.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (approved.error) throw approved.error;
  const code = new URL(approved.data.redirect_url).searchParams.get('code');
  if (!code) throw new Error('approve: no code');
  const token = await fetch(`${url}/auth/v1/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id, redirect_uri: redirectUri }),
  });
  if (!token.ok) throw new Error(`token: ${token.status}`);
  const t = (await token.json()) as { access_token: string; refresh_token: string };
  return { token: t.access_token, refreshToken: t.refresh_token, clientId: client_id };
}

/** A new access token from the refresh token, as an assistant gets one every hour. */
export async function refreshAssistant(url: string, c: Connection): Promise<string> {
  const res = await fetch(`${url}/auth/v1/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refreshToken, client_id: c.clientId }),
  });
  if (!res.ok) throw new Error(`refresh: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** The token's claims (tests only: never trust them unverified). */
export const claimsOf = (token: string) => JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as Record<string, unknown>;
