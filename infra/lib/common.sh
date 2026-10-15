# Shared by the cocon-* commands. Sourced, not run. Bash 3.2 compatible (the tests run on macOS).
# shellcheck shell=bash

set -euo pipefail
umask 077

# Paths can be moved for tests only: under sudo (how CI runs these) they and PATH are fixed,
# whatever the caller's environment says.
if [ -n "${SUDO_USER:-}" ]; then
  unset COCON_HOME COCON_SRV COCON_CREDS COCON_RUN COCON_STATE COCON_HEALTH_TIMEOUT
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
fi
COCON_HOME=${COCON_HOME:-/opt/cocon/infra}
COCON_SRV=${COCON_SRV:-/srv/cocon}
COCON_CREDS=${COCON_CREDS:-/etc/cocon/creds}
COCON_RUN=${COCON_RUN:-/run/cocon}
COCON_STATE=${COCON_STATE:-/var/lib/cocon}

# shellcheck source=../config.env
. "$COCON_HOME/config.env"

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() {
  log "error: $*"
  exit 1
}

check_env() {
  case "${1:-}" in
    staging | prod) ;;
    *) die "the environment must be staging or prod" ;;
  esac
}

check_sha() {
  [[ ${1:-} =~ ^[0-9a-f]{40}$ ]] || die "the commit must be 40 lowercase hex characters"
}

# public_host <name> <env>: app → app.ourcocon.com (prod) or app-staging.ourcocon.com (staging).
public_host() {
  if [ "$2" = prod ]; then echo "$1.$COCON_DOMAIN"; else echo "$1-staging.$COCON_DOMAIN"; fi
}

# env_value <file> <KEY>. Supabase's .env can't be sourced (values contain spaces).
env_value() {
  grep -m1 "^$2=" "$1" | cut -d= -f2- || true
}

# use_env <env>: one operation per environment at a time (deploy, backup, restore, update),
# with its settings unlocked in /run. Commands started by another cocon-* command on the same
# environment share its lock. Call release_env from the script's EXIT trap.
use_env() {
  if [ "${COCON_LOCKED:-}" != "$1" ]; then
    mkdir -p "$COCON_RUN"
    exec 9>"$COCON_RUN/$1.lock"
    flock -w 900 9 || die "another operation on $1 is still running"
    export COCON_LOCKED=$1
    COCON_OWNS_LOCK=1
  fi
  cocon-secrets unlock "$1"
}

release_env() {
  if [ -n "${COCON_OWNS_LOCK:-}" ]; then cocon-secrets lock "$COCON_LOCKED"; fi
}

# stack_container <env> <service>: id of a running Supabase container.
stack_container() {
  local id
  id=$(docker ps -q --filter "label=com.docker.compose.project=cocon-$1" \
    --filter "label=com.docker.compose.service=$2")
  [ -n "$id" ] || die "Supabase $2 is not running in $1"
  echo "$id"
}

supabase_dir() { echo "$COCON_SRV/$1/supabase"; }
