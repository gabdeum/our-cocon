import { createServer, type Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpConfig } from './config.js';

/** The MCP server. Tools are registered per module from spec 023 on. */
export function createMcp(config: McpConfig): McpServer {
  return new McpServer({ name: 'our-cocon', version: config.commit });
}

/** Streamable HTTP on /mcp (stateless: one server per request) and a /health check for deploys. */
export function createHttpServer(config: McpConfig): Server {
  return createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, env: config.env, commit: config.commit }));
      return;
    }

    if (path === '/mcp') {
      const mcp = createMcp(config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        void transport.close();
        void mcp.close();
      });
      mcp
        .connect(transport)
        .then(() => transport.handleRequest(req, res))
        .catch(() => {
          if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal error' }));
        });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}
