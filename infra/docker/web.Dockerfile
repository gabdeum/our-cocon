# Web app: static Expo export served by unprivileged nginx. One build for staging and prod;
# per-environment settings are written to /config.js when the container starts.
FROM node:24.11-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cocon/app..." \
 && pnpm --filter @cocon/app exec expo export -p web --output-dir /out
ARG COMMIT
RUN test -n "$COMMIT" && printf '{"commit":"%s"}\n' "$COMMIT" > /out/version.json

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY --from=build --chown=nginx:nginx /out /usr/share/nginx/html
COPY infra/web/nginx.main.conf /etc/nginx/nginx.conf
COPY infra/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/web/shared-preview.js /etc/nginx/njs/shared-preview.js
COPY --chmod=755 infra/web/write-config.sh /docker-entrypoint.d/40-cocon-config.sh
EXPOSE 8080
