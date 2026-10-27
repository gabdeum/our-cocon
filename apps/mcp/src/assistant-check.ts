import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';

/** Where Caddy asks (infra/edge/Caddyfile, forward_auth). */
export const ASSISTANT_CHECK_PATH = '/assistant-check';

/**
 * Whether to let a request through: no token at all, or a token whose claims read cleanly and name
 * no OAuth client (the app's sessions, the anon key). Anything else is refused, including a header
 * this can't read: Supabase Auth accepts more spellings than the MCP server does ("bearer", long
 * tokens), so this fails closed rather than reusing that parser.
 */
export function allowed(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (header === undefined) return true;
  const token = /^bearer\s+(\S+)\s*$/i.exec(header)?.[1];
  const payload = token?.split('.')[1];
  if (!payload) return false;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims) && !('client_id' in claims);
  } catch {
    return false;
  }
}

/**
 * 032-later L62: Supabase Auth ignores a token's role, so an assistant's token could sign the member
 * out everywhere, approve or revoke assistants (undoing a Disconnect, spec 025) or change their
 * account. Caddy asks this before passing those addresses on: 403 for an assistant's token, 200 for
 * the app's (Supabase then checks the token itself). The signature isn't checked: the only thing this
 * can do is refuse. Listens on its own port, reachable only inside Docker.
 */
export function createAssistantCheckServer(): HttpServer {
  return createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const status = path !== ASSISTANT_CHECK_PATH ? 404 : allowed(req) ? 200 : 403;
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(
      JSON.stringify(
        status === 403 ? { code: 403, error_code: 'assistant_not_allowed', msg: 'AI assistants can’t do this. The member can, in the Our Cocon app.' } : {},
      ),
    );
  });
}
