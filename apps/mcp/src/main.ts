import { loadConfig } from './config.js';
import { createMcpAnalytics } from './analytics.js';
import { createHttpServer } from './server.js';

const config = loadConfig();
const analytics = createMcpAnalytics(config);
const server = createHttpServer(config, { analytics });

server.listen(config.port, () => {
  console.log(`MCP server (${config.env}) on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close();
    void analytics.shutdown().finally(() => process.exit(0));
  });
}
