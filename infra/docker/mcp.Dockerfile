# MCP server: one bundled file on Node, running as the unprivileged `node` user.
FROM node:24.11-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cocon/mcp..." && pnpm --filter @cocon/mcp run build

FROM node:24.11-slim
ARG COMMIT
ENV NODE_ENV=production COCON_COMMIT=$COMMIT MCP_PORT=8787
WORKDIR /app
COPY --from=build /repo/apps/mcp/dist ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s CMD ["node", "-e", "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "main.js"]
