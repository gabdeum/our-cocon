import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { modules } from '../tools/index.js';
import { createMcpAnalytics, type McpAnalytics } from './analytics.js';
import { authenticate, RESOURCE_METADATA_PATH, resourceMetadata, unauthorized, type Caller } from './auth.js';
import type { McpConfig } from './config.js';
import { toolContext } from './context.js';
import { rateLimit } from './rate-limit.js';
import { callTool, errorSentence, listing, type Module, type ToolContext } from './tools.js';

/** What the server tells every assistant on connecting: Our Cocon first, then each module. */
export function instructions(list: readonly Module[]): string {
  return [
    'Our Cocon is a family household app. You act as the member who connected you: you see and change only their family’s things, and every change shows in the app as made through you.',
    'Ask the member when something you need is missing (an amount, a unit, how many it serves) rather than guessing. When a tool returns an error, it says what to fix: fix it and call again.',
    ...list.map((m) => m.instructions),
  ].join('\n\n');
}

/** The MCP server for one caller (stateless: one per request). Tools come from the modules. */
export function createMcp(config: McpConfig, list: readonly Module[], context: (tool: string) => Promise<ToolContext>): Server {
  const server = new Server({ name: 'our-cocon', title: 'Our Cocon', version: config.commit }, { capabilities: { tools: {} }, instructions: instructions(list) });
  const tools = list.flatMap((m) => m.tools);
  const byName = new Map(tools.map((t) => [t.name, t]));
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listing(tools) }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name);
    if (!tool) return { content: [{ type: 'text', text: `There's no tool called ${request.params.name}.` }], isError: true };
    let ctx: ToolContext;
    try {
      ctx = await context(tool.name);
    } catch (error) {
      return { content: [{ type: 'text', text: errorSentence(error) }], isError: true };
    }
    return callTool(tool, request.params.arguments, ctx);
  });
  return server;
}

/** The client's address: Caddy replaces X-Forwarded-For with Cloudflare's CF-Connecting-IP (infra/edge/Caddyfile). */
function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

export interface ServerDeps {
  modules?: readonly Module[];
  analytics?: McpAnalytics;
  /** Supabase calls for checking tokens (tests pass a fake). */
  fetch?: typeof fetch;
}

/**
 * Streamable HTTP on /mcp (stateless), the OAuth protected-resource metadata assistants read
 * before signing in, and /health for deploys. Every /mcp request needs an assistant's token.
 */
export function createHttpServer(config: McpConfig, deps: ServerDeps = {}): HttpServer {
  const list = deps.modules ?? modules;
  const analytics = deps.analytics ?? createMcpAnalytics(config);
  // Per member: generous for a conversation, low enough to stop a runaway loop.
  const perMember = rateLimit(120, 60_000);
  // Per address, before a token is checked: stops anyone hammering Supabase through us.
  const perAddress = rateLimit(300, 60_000);

  return createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };

    if (path === '/health' && req.method === 'GET') return json(200, { ok: true, env: config.env, commit: config.commit });

    // RFC 9728, at the root and with the resource's path appended.
    if ((path === RESOURCE_METADATA_PATH || path === `${RESOURCE_METADATA_PATH}/mcp`) && req.method === 'GET') {
      return json(200, resourceMetadata(config), { 'access-control-allow-origin': '*' });
    }

    if (path === '/mcp') {
      if (!perAddress.take(clientIp(req))) return json(429, { error: 'Too many requests. Wait a minute and try again.' }, { 'retry-after': '60' });
      void authenticate(req, config, deps.fetch).then((caller: Caller | null) => {
        if (!caller) return unauthorized(res, config);
        if (!perMember.take(caller.userId)) return json(429, { error: 'Too many requests. Wait a minute and try again.' }, { 'retry-after': '60' });

        const mcp = createMcp(config, list, (tool) => toolContext(config, caller, analytics, tool));
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => {
          void transport.close();
          void mcp.close();
        });
        mcp
          .connect(transport)
          .then(() => transport.handleRequest(req, res))
          .catch(() => {
            if (!res.headersSent) json(500, { error: 'Internal error' });
            else res.end();
          });
      });
      return;
    }

    json(404, { error: 'Not found' });
  });
}
