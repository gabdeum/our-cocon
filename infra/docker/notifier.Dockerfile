# Notifier (spec 046): one bundled file on Node, running as the unprivileged `node` user.
FROM node:24.11-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cocon/notifier..." && pnpm --filter @cocon/notifier run build

FROM node:24.11-slim
ARG COMMIT
ENV NODE_ENV=production COCON_COMMIT=$COMMIT NOTIFIER_PORT=8789
WORKDIR /app
COPY --from=build /repo/apps/notifier/dist ./
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD ["node", "-e", "fetch('http://127.0.0.1:8789/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "main.js"]
