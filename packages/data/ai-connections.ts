import { KnownAssistant } from '@cocon/schemas';
import type { Db } from './client';

/** One assistant as Settings › AI assistants shows it: all the OAuth clients it connected with. */
export interface AssistantConnection {
  clientIds: string[];
  /** The latest call to the MCP server, or when it was allowed if it hasn't called yet. */
  lastUsed: Date;
}

export interface AssistantConnections {
  known: Partial<Record<KnownAssistant, AssistantConnection>>;
  /** Apps the database can't name (spec 025): grouped by the name they gave themselves. */
  others: (AssistantConnection & { name: string | null })[];
}

interface Row {
  client_id: string;
  assistant: string | null;
  client_name: string | null;
  granted_at: string;
  last_used_at: string | null;
}

/**
 * Spec 025: the signed-in member's connected assistants (`my_assistants`: their own active grants).
 * Each connection registers its own OAuth client, so one assistant can hold several.
 */
export async function loadAssistants(client: Pick<Db, 'rpc'>): Promise<AssistantConnections> {
  const { data, error } = await client.rpc('my_assistants');
  if (error) throw error;
  return groupAssistants(data ?? []);
}

export function groupAssistants(rows: Row[]): AssistantConnections {
  const known: AssistantConnections['known'] = {};
  const others = new Map<string | null, AssistantConnection & { name: string | null }>();
  for (const row of rows) {
    const used = new Date(row.last_used_at ?? row.granted_at);
    const key = KnownAssistant.safeParse(row.assistant);
    let entry: AssistantConnection;
    if (key.success) {
      entry = known[key.data] ??= { clientIds: [], lastUsed: used };
    } else {
      const other = others.get(row.client_name) ?? { name: row.client_name, clientIds: [], lastUsed: used };
      others.set(row.client_name, other);
      entry = other;
    }
    entry.clientIds.push(row.client_id);
    if (used > entry.lastUsed) entry.lastUsed = used;
  }
  return { known, others: [...others.values()] };
}

/**
 * Disconnect (spec 025 US2): revokes every grant the assistant holds. Supabase ends its sessions with
 * the grant, and the MCP server checks the token on every call, so it stops at once.
 */
export async function disconnectAssistant(oauth: Pick<Db['auth']['oauth'], 'revokeGrant'>, clientIds: string[]): Promise<{ error: unknown }> {
  const results = await Promise.all(clientIds.map((clientId) => oauth.revokeGrant({ clientId })));
  return { error: results.find((r) => r.error)?.error ?? null };
}
