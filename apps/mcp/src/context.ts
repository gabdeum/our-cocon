import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadCalendarSettings, type Db } from '@cocon/data';
import { hemisphereOf, type Database, type Hemisphere } from '@cocon/schemas';
import type { McpAnalytics } from './analytics.js';
import type { Caller } from './auth.js';
import type { McpConfig } from './config.js';
import { ToolError, type ToolContext } from './tools.js';

/**
 * Supabase as the member: their token on every request, nothing kept between calls. A tool call
 * tags its requests (x-cocon-call, x-cocon-tool), so the database's activity log groups what one
 * call changed (migration mcp_recipe_writes).
 */
export function memberClient(config: Pick<McpConfig, 'supabaseUrl' | 'supabaseAnonKey'>, token: string, tool?: string): Db {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { authorization: `Bearer ${token}`, ...(tool ? { 'x-cocon-call': randomUUID(), 'x-cocon-tool': tool } : {}) } },
  });
}

/**
 * The context a tool runs in. The family and the assistant's name come from the database, from
 * the token alone (the same rule that stamps `source` on every write, spec 004).
 */
export async function toolContext(config: McpConfig, caller: Caller, analytics: McpAnalytics, tool: string): Promise<ToolContext> {
  const db = memberClient(config, caller.token, tool);
  const [family, source] = await Promise.all([db.rpc('my_family_id'), db.rpc('request_source')]);
  if (family.error || source.error) throw new Error('Could not read the caller’s family');
  const assistant = source.data ?? 'mcp';
  const familyId = family.data;
  if (!familyId) {
    throw new ToolError('This person isn’t in a family yet. Ask them to open the Our Cocon app and set up or join their family first.');
  }
  return { db, userId: caller.userId, familyId, assistant, appUrl: config.appUrl, tracker: analytics.forCaller(caller.userId, familyId) };
}

/** Spec 025: "Connected · used {time}" in Settings › AI assistants. At most a write a minute (the database decides). */
export async function touchAssistant(config: Pick<McpConfig, 'supabaseUrl' | 'supabaseAnonKey'>, caller: Caller): Promise<void> {
  const { error } = await memberClient(config, caller.token).rpc('touch_assistant');
  if (error) throw new Error(error.message);
}

const hemispheres = new Map<string, { value: Hemisphere; until: number }>();

/**
 * Spec 055 FR-005: where the caller's family has its seasons, from its home time zone. Kept an hour
 * per member, as it only changes when the family moves. Northern if it can't be read within 2 s,
 * kept a minute only, so a slow or failed read never holds up the request or sticks.
 */
export async function familyHemisphere(config: Pick<McpConfig, 'supabaseUrl' | 'supabaseAnonKey'>, caller: Caller, now = Date.now()): Promise<Hemisphere> {
  const kept = hemispheres.get(caller.userId);
  if (kept && kept.until > now) return kept.value;
  const read = await Promise.race([
    loadCalendarSettings(memberClient(config, caller.token)).then((s) => hemisphereOf(s.homeTimeZone)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000).unref()),
  ]).catch(() => null);
  // One entry per member who connected; expired ones go before the list grows past a few thousand.
  if (hemispheres.size > 5000) for (const [id, entry] of hemispheres) if (entry.until <= now) hemispheres.delete(id);
  hemispheres.set(caller.userId, { value: read ?? 'northern', until: now + (read ? 60 : 1) * 60_000 });
  return read ?? 'northern';
}
