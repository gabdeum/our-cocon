import { loadConfig } from './config.js';
import { createMcpTracker } from './analytics.js';
import { createHttpServer } from './server.js';

const config = loadConfig();
const { shutdown } = createMcpTracker(config);
const server = createHttpServer(config);

server.listen(config.port, () => {
  console.log(`MCP server (${config.env}) on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close();
    void shutdown().finally(() => process.exit(0));
  });
}
