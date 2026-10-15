#!/bin/sh
# Writes window.__COCON__ from the container environment (see apps/app/lib/config.ts).
# Stops the container if a value is missing or could break out of the JS string.
set -eu

check() {
  case "$2" in
    *[!A-Za-z0-9._:/=+-]*)
      echo "write-config: $1 has unexpected characters" >&2
      exit 1
      ;;
  esac
}

case "${COCON_ENV:-}" in staging | prod) ;; *) echo "write-config: COCON_ENV must be staging or prod" >&2; exit 1 ;; esac
: "${SUPABASE_URL:?write-config: SUPABASE_URL is not set}"
: "${SUPABASE_ANON_KEY:?write-config: SUPABASE_ANON_KEY is not set}"
check SUPABASE_URL "$SUPABASE_URL"
check SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
check POSTHOG_KEY "${POSTHOG_KEY:-}"
check POSTHOG_HOST "${POSTHOG_HOST:-}"

html=/usr/share/nginx/html
commit=$(sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p' "$html/version.json")

cat > "$html/config.js" <<JS
window.__COCON__ = {
  env: "$COCON_ENV",
  commit: "$commit",
  supabaseUrl: "$SUPABASE_URL",
  supabaseAnonKey: "$SUPABASE_ANON_KEY",
  posthogKey: "${POSTHOG_KEY:-}" || undefined,
  posthogHost: "${POSTHOG_HOST:-}" || undefined
};
JS
