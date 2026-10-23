import type { IncomingMessage, ServerResponse } from 'node:http';
import type { McpConfig } from './config.js';

/** Who is calling: a member, through an assistant they approved (spec 023 FR-001). */
export interface Caller {
  userId: string;
  /** The member's OAuth access token, passed on to Supabase so RLS applies. */
  token: string;
  /** The OAuth client (the assistant's registration). */
  clientId: string;
}

/** Where assistants find how to sign in (RFC 9728), under the server's own address. */
export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

/** RFC 9728: this server is protected by Supabase's OAuth server. */
export function resourceMetadata(config: Pick<McpConfig, 'mcpUrl' | 'supabaseUrl'>) {
  return {
    resource: `${config.mcpUrl}/mcp`,
    authorization_servers: [`${config.supabaseUrl}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'Our Cocon',
  };
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(header) : null;
  return match?.[1] ?? null;
}

/** The token's claims, unchecked: only read after Supabase has accepted the token. */
function claims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    return payload ? (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The caller, or null when the request has no valid assistant token. Supabase checks the token on
 * every call (not cached), so disconnecting an assistant (spec 025) stops it at once. App sessions
 * are refused: only tokens Supabase's OAuth server issued to a client may use this server.
 */
export async function authenticate(
  req: IncomingMessage,
  config: Pick<McpConfig, 'supabaseUrl' | 'supabaseAnonKey'>,
  fetchImpl: typeof fetch = fetch,
): Promise<Caller | null> {
  const token = bearer(req);
  if (!token) return null;
  const clientId = claims(token)?.client_id;
  if (typeof clientId !== 'string' || clientId.length === 0) return null;
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: config.supabaseAnonKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: unknown };
    return typeof user.id === 'string' ? { userId: user.id, token, clientId } : null;
  } catch {
    return null;
  }
}

/** 401 that tells the assistant where to sign in (MCP authorization, RFC 9728 §5.1). */
export function unauthorized(res: ServerResponse, config: Pick<McpConfig, 'mcpUrl'>): void {
  res.writeHead(401, {
    'content-type': 'application/json',
    'www-authenticate': `Bearer resource_metadata="${config.mcpUrl}${RESOURCE_METADATA_PATH}"`,
  });
  res.end(JSON.stringify({ error: 'Connect Our Cocon first: sign in and allow access.' }));
}
