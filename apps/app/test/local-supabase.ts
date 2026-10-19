/// <reference types="node" />
// Local Supabase for integration tests (constitution VII). `pnpm dev` starts it; CI starts it first.
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';

export type Client = SupabaseClient<Database>;

/** Local Supabase's URL and keys, from the CLI (local development values, never printed). */
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

export const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/** A new confirmed person, signed in through a magic link (no passwords, spec 003). Records their id in `userIds`. */
export async function signInPerson(admin: Client, url: string, anonKey: string, email: string, userIds: string[]): Promise<Client> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  userIds.push(created.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const client = createClient<Database>(url, anonKey, clientOptions);
  const signedIn = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' });
  if (signedIn.error) throw signedIn.error;
  return client;
}
