#!/usr/bin/env bash
# Run from your Mac, in the repo, to set up or repair the server:
#
#   infra/bootstrap-from-laptop.sh <server-ip> --staging-key <.pub> --prod-key <.pub>     (first time)
#   infra/bootstrap-from-laptop.sh <server-ip>                                             (later)
#   infra/bootstrap-from-laptop.sh <server-ip> --dry-run                                   (show only)
#
# The keys are the public halves of GitHub's two SSH keys (docs/operations.md, section 1).
#
# 1. Copies infra/ to the server and runs provision.sh there (it asks for secrets).
# 2. Checks that you can log in as ADMIN_USER with your key.
# 3. Only then runs provision.sh --harden-ssh, which turns off root and password logins.
# The first time it logs in as root; once root is off, as ADMIN_USER with sudo.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=config.env
. "$here/config.env"

host=${1:-}
if [ -z "$host" ] || [ "${host#-}" != "$host" ]; then
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
fi
shift
staging_key=
prod_key=
dry=
while [ $# -gt 0 ]; do
  case $1 in
    --staging-key) staging_key=${2:?path to cocon-deploy-staging.pub}; shift 2 ;;
    --prod-key) prod_key=${2:?path to cocon-deploy-prod.pub}; shift 2 ;;
    --dry-run) dry=--dry-run; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

# The checks below can't ask for your key's passphrase, so the key goes into the SSH agent first
# (asks for the passphrase once; on a Mac, remembered in the Keychain).
if ! ssh-add -l >/dev/null 2>&1; then
  echo "Unlocking your SSH key for this session:"
  if [ "$(uname)" = Darwin ]; then ssh-add --apple-use-keychain; else ssh-add; fi
fi

if ssh -o BatchMode=yes -o ConnectTimeout=10 "root@$host" true 2>/dev/null; then
  login=root@$host sudo=
else
  login=$ADMIN_USER@$host sudo="sudo"
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$login" true || {
    echo "Can't log in as root or $ADMIN_USER on $host with your SSH key." >&2
    exit 1
  }
fi
echo "Logging in as $login"

rsync -a --delete --exclude tests/ --exclude docker/ --exclude web/ "$here/" "$login:cocon-infra/"
if [ -n "$staging_key$prod_key" ]; then
  if [ -z "$staging_key" ] || [ -z "$prod_key" ]; then
    echo "pass both --staging-key and --prod-key" >&2
    exit 2
  fi
  ssh "$login" 'mkdir -p cocon-infra/keys'
  scp -q "$staging_key" "$login:cocon-infra/keys/cocon-deploy-staging.pub"
  scp -q "$prod_key" "$login:cocon-infra/keys/cocon-deploy-prod.pub"
fi

ssh -t "$login" "$sudo bash cocon-infra/provision.sh $dry"
[ -z "$dry" ] || exit 0

echo
echo "Checking that $ADMIN_USER can log in with your key before turning root login off..."
ssh -o BatchMode=yes "$ADMIN_USER@$host" true || {
  echo "$ADMIN_USER can't log in, so SSH was left as it is. Nothing is locked." >&2
  exit 1
}
ssh -t "$login" "$sudo bash cocon-infra/provision.sh --harden-ssh"
