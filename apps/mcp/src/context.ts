import { createClient } from '@supabase/supabase-js';
import type { Db } from '@cocon/data';
import type { Database } from '@cocon/schemas';
import type { McpAnalytics } from './analytics.js';
import type { Caller } from './auth.js';
import type { McpConfig } from './config.js';
import { ToolError, type ToolContext } from './tools.js';

/** Supabase as the member: their token on every request, nothing kept between calls. */
export function memberClient(config: Pick<McpConfig, 'supabaseUrl' | 'supabaseAnonKey'>, token: string): Db {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });
}

/**
 * The context a tool runs in. The family and the assistant's name come from the database, from
 * the token alone (the same rule that stamps `source` on every write, spec 004).
 */
export async function toolContext(config: McpConfig, caller: Caller, analytics: McpAnalytics): Promise<ToolContext> {
  const db = memberClient(config, caller.token);
  const [family, source] = await Promise.all([db.rpc('my_family_id'), db.rpc('request_source')]);
  if (family.error || source.error) throw new Error('Could not read the caller’s family');
  const assistant = source.data ?? 'mcp';
  const familyId = family.data;
  if (!familyId) {
    throw new ToolError('This person isn’t in a family yet. Ask them to open the Our Cocon app and set up or join their family first.');
  }
  return { db, userId: caller.userId, familyId, assistant, appUrl: config.appUrl, tracker: analytics.forCaller(caller.userId, familyId) };
}
