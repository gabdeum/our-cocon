#!/usr/bin/env bash
# CI → server, over SSH as `deploy`. Each environment has its own key, which the server pins to
# that environment (infra/bin/cocon-ci): the staging key can't deploy to prod.
#
#   .github/scripts/server.sh deploy <staging|prod> <commit>   Deploy, then check the public URLs
#   .github/scripts/server.sh restore-test                     Monthly restore of prod into staging
#
# Needs SSH_HOST, SSH_USER, SSH_PRIVATE_KEY and SSH_KNOWN_HOSTS (GitHub environment secrets).
set -euo pipefail
# shellcheck source=../../infra/config.env
. infra/config.env

: "${SSH_HOST:?}" "${SSH_USER:?}" "${SSH_PRIVATE_KEY:?}" "${SSH_KNOWN_HOSTS:?}"
mkdir -p ~/.ssh
chmod 700 ~/.ssh
printf '%s\n' "$SSH_KNOWN_HOSTS" >~/.ssh/known_hosts
key=$(mktemp)
trap 'rm -f "$key"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" >"$key"

remote() {
  ssh -i "$key" -o BatchMode=yes -o StrictHostKeyChecking=yes -o ServerAliveInterval=30 \
    "$SSH_USER@$SSH_HOST" "$@"
}

# serves <url> <commit>: the URL answers with the commit, within a minute.
serves() {
  for _ in $(seq 1 10); do
    if curl -fsS --max-time 10 "$1" 2>/dev/null | grep -q "\"$2\""; then
      echo "$1 serves ${2:0:7}"
      return 0
    fi
    sleep 6
  done
  echo "::error::$1 does not serve ${2:0:7}"
  return 1
}

case ${1:-} in
  deploy)
    env=${2:?staging or prod}
    sha=${3:?commit}
    remote deploy "$env" "$sha"
    if [ "$env" = prod ]; then suffix=; else suffix=-staging; fi
    serves "https://app$suffix.$COCON_DOMAIN/version.json" "$sha"
    serves "https://mcp$suffix.$COCON_DOMAIN/health" "$sha"
    ;;
  restore-test) remote restore-test ;;
  *) echo "usage: server.sh deploy <env> <commit> | restore-test" >&2; exit 2 ;;
esac
