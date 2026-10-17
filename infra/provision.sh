#!/usr/bin/env bash
# Sets up, or repairs, the Our Cocon server (Ubuntu 26.04 LTS; 24.04 also works). Started by
# infra/bootstrap-from-laptop.sh as root, from a copy of infra/ on the server.
# Safe to run again: every step checks what is already there and only does what's missing,
# so it can also rebuild a new server from scratch.
#
#   provision.sh [--dry-run]        Everything except locking down SSH
#   provision.sh --harden-ssh       Then: no root login, no passwords, keys only
#
# Secrets are asked for at hidden prompts (paste them from your password manager) and sealed
# with systemd-creds. --dry-run prints what would change and asks for nothing.
set -euo pipefail
umask 022

src=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=config.env
. "$src/config.env"

dry=0
harden=0
for arg in "$@"; do
  case $arg in
    --dry-run) dry=1 ;;
    --harden-ssh) harden=1 ;;
    *) echo "usage: provision.sh [--dry-run] [--harden-ssh]" >&2; exit 2 ;;
  esac
done

home=/opt/cocon/infra
export PATH="/usr/local/bin:$PATH"

step() { printf '\n== %s\n' "$*"; }
note() { printf '   %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
run() {
  if [ $dry = 1 ]; then note "would run: $*"; else "$@"; fi
}
# write <path> <mode>: stdin becomes the file, only if the content changed. Returns 1 if unchanged.
write() {
  local tmp
  tmp=$(mktemp)
  cat >"$tmp"
  if [ -f "$1" ] && cmp -s "$tmp" "$1"; then rm -f "$tmp"; return 1; fi
  if [ $dry = 1 ]; then note "would write $1"; rm -f "$tmp"; return 0; fi
  mkdir -p "$(dirname "$1")"
  install -m "$2" "$tmp" "$1"
  rm -f "$tmp"
  note "wrote $1"
}
has_secret() { [ -f "/etc/cocon/creds/$1.cred" ]; }
hidden() { # hidden <question> → stdout
  local value
  read -r -s -p "   $1: " value </dev/tty
  echo >/dev/tty
  [ -n "$value" ] || die "nothing entered"
  printf '%s' "$value"
}

[ "$(id -u)" = 0 ] || die "run as root (bootstrap-from-laptop.sh does this for you)"
# shellcheck source=/dev/null
. /etc/os-release
case "${ID:-}-${VERSION_ID:-}" in
  ubuntu-24.04 | ubuntu-26.04) ;;
  *) die "this script expects Ubuntu 26.04 or 24.04 LTS" ;;
esac
# Temporary files (some hold secrets before they are sealed) stay in memory.
install -d -m 700 /run/cocon
export TMPDIR=/run/cocon

# --- SSH lockdown (second pass) ----------------------------------------------------------------
if [ $harden = 1 ]; then
  step "SSH: keys only, no root login"
  [ -s "/home/$ADMIN_USER/.ssh/authorized_keys" ] || die "$ADMIN_USER has no SSH key yet; run provision.sh first"
  [ -s /home/deploy/.ssh/authorized_keys ] || die "deploy has no SSH key yet; run provision.sh first"
  passwd -S "$ADMIN_USER" | awk '{exit ($2 == "P") ? 0 : 1}' || die "$ADMIN_USER has no password for sudo yet"
  if write /etc/ssh/sshd_config.d/10-cocon.conf 644 <<EOF; then
# Our Cocon (provision.sh --harden-ssh). Read before 50-cloud-init.conf, so these win.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers $ADMIN_USER deploy
EOF
    if [ $dry = 0 ] && ! sshd -t; then
      rm -f /etc/ssh/sshd_config.d/10-cocon.conf
      die "the SSH settings didn't validate; removed them, SSH is unchanged"
    fi
    run systemctl reload ssh
  fi
  note "done. From now on: ssh $ADMIN_USER@<server>, then sudo for admin commands"
  exit 0
fi

# --- Packages ----------------------------------------------------------------------------------
step "Packages"
packages=(ca-certificates curl jq age rclone attr unattended-upgrades ufw git openssl rsync)
missing=()
for p in "${packages[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
if [ ${#missing[@]} -gt 0 ]; then
  run apt-get update -q
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y -q "${missing[@]}"
else note "all installed"; fi

step "Docker"
if ! command -v docker >/dev/null; then
  run install -m 0755 -d /etc/apt/keyrings
  run curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  write /etc/apt/sources.list.d/docker.list 644 <<EOF || true
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable
EOF
  run apt-get update -q
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
else note "installed"; fi
# Container logs are capped, or they slowly fill the disk.
if write /etc/docker/daemon.json 644 <<'EOF'; then
{ "log-driver": "local", "log-opts": { "max-size": "10m", "max-file": "3" } }
EOF
  run systemctl restart docker
fi
# One network per environment; only Caddy joins both, so staging can't reach prod directly.
for env in staging prod; do
  docker network inspect "cocon-edge-$env" >/dev/null 2>&1 || run docker network create "cocon-edge-$env"
done

step "Swap ($SWAP_SIZE), used only when memory runs out"
if [ ! -f /swapfile ]; then
  run fallocate -l "$SWAP_SIZE" /swapfile
  run chmod 600 /swapfile
  run mkswap /swapfile
  run swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || run sh -c 'echo "/swapfile none swap sw 0 0" >> /etc/fstab'
if write /etc/sysctl.d/90-cocon.conf 644 <<<'vm.swappiness=10'; then run sysctl -q --system; fi

step "Automatic security updates (reboots at 04:30 UTC when needed)"
write /etc/apt/apt.conf.d/20auto-upgrades 644 <<'EOF' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
write /etc/apt/apt.conf.d/52cocon-unattended 644 <<'EOF' || true
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF

step "Firewall"
# SSH only. Caddy's 80/443 are Docker-published, which bypasses ufw: the Hetzner firewall
# cocon-web limits them to Cloudflare, and Caddy itself drops anything else.
if ! ufw status 2>/dev/null | grep -q 'Status: active'; then
  run ufw default deny incoming
  run ufw default allow outgoing
  run ufw allow 22/tcp
  run ufw --force enable
else note "active"; fi

# --- Users -------------------------------------------------------------------------------------
step "Your admin login ($ADMIN_USER)"
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  run useradd -m -s /bin/bash -G sudo "$ADMIN_USER"
fi
if [ ! -s "/home/$ADMIN_USER/.ssh/authorized_keys" ]; then
  [ -s /root/.ssh/authorized_keys ] || die "no key in /root/.ssh/authorized_keys to copy"
  run install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
  run install -m 600 -o "$ADMIN_USER" -g "$ADMIN_USER" /root/.ssh/authorized_keys "/home/$ADMIN_USER/.ssh/authorized_keys"
fi
if [ $dry = 0 ] && ! passwd -S "$ADMIN_USER" | awk '{exit ($2 == "P") ? 0 : 1}'; then
  note "Choose a password for sudo on the server and save it in your password manager."
  pw=$(hidden "sudo password for $ADMIN_USER")
  [ "$pw" = "$(hidden "same password again")" ] || die "the two passwords differ"
  printf '%s:%s\n' "$ADMIN_USER" "$pw" | chpasswd
  unset pw
fi

step "CI login (deploy): may only run cocon-deploy and cocon-restore-test"
id deploy >/dev/null 2>&1 || run useradd -m -s /bin/bash deploy
# One key per GitHub environment, each pinned to cocon-ci for its own environment: no shell, and
# the staging key can't deploy to prod.
keys="$src/keys/cocon-deploy-staging.pub $src/keys/cocon-deploy-prod.pub"
if [ -f "$src/keys/cocon-deploy-staging.pub" ] && [ -f "$src/keys/cocon-deploy-prod.pub" ]; then
  for k in $keys; do
    grep -q '^ssh-' "$k" || die "$k is not an SSH public key"
  done
  run install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
  for env in staging prod; do
    printf 'restrict,command="/usr/local/bin/cocon-ci %s" %s\n' "$env" "$(head -n 1 "$src/keys/cocon-deploy-$env.pub")"
  done | write /home/deploy/.ssh/authorized_keys 600 || true
  run chown deploy:deploy /home/deploy/.ssh/authorized_keys
elif [ $dry = 1 ]; then
  note "CI keys: unchanged (pass --staging-key and --prod-key to replace them)"
elif [ ! -s /home/deploy/.ssh/authorized_keys ]; then
  die "pass both CI public keys: bootstrap-from-laptop.sh <host> --staging-key … --prod-key …"
fi
sudoers=$(mktemp)
cat >"$sudoers" <<'EOF'
# CI deploys through these two commands only (called by cocon-ci); they check their own arguments.
Defaults:deploy env_reset
Defaults:deploy secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
deploy ALL=(root) NOPASSWD: /usr/local/bin/cocon-deploy staging *, /usr/local/bin/cocon-deploy prod *, /usr/local/bin/cocon-restore-test ""
EOF
if [ $dry = 0 ]; then visudo -cqf "$sudoers" || die "sudoers check failed"; fi
write /etc/sudoers.d/cocon-deploy 440 <"$sudoers" || true
rm -f "$sudoers"

# --- Our files ---------------------------------------------------------------------------------
step "Our Cocon commands and services"
if [ "$src" != "$home" ]; then
  run mkdir -p "$home"
  run rsync -a --delete --exclude keys/ --exclude tests/ "$src/" "$home/"
  run chown -R root:root "$home"
fi
for f in "$src"/bin/cocon-*; do
  dest=/usr/local/bin/${f##*/}
  write "$dest" 755 <"$f" || true
done
units_changed=0
for f in "$src"/systemd/*; do
  dest=/etc/systemd/system/${f##*/}
  if write "$dest" 644 <"$f"; then units_changed=1; fi
done
[ $units_changed = 1 ] && run systemctl daemon-reload
run install -d -m 700 /etc/cocon /etc/cocon/creds
run install -d -m 755 /etc/cocon/edge

step "Cloudflare address ranges (only they may reach Caddy)"
ips=$(curl -fsS https://www.cloudflare.com/ips-v4; echo; curl -fsS https://www.cloudflare.com/ips-v6)
ips=$(echo "$ips" | grep -E '^[0-9a-f.:]+/[0-9]+$' | tr '\n' ' ' | sed 's/ $//')
[ -n "$ips" ] || die "could not download Cloudflare's address ranges"
write /etc/cocon/edge/cloudflare.env 644 <<<"CLOUDFLARE_IPS=\"$ips\"" || true

# --- Secrets -----------------------------------------------------------------------------------
step "Secrets (paste each from your password manager; nothing shows on screen)"
ask() { # ask <name> <question>
  if has_secret "$1"; then note "$1: already set"; return; fi
  if [ $dry = 1 ]; then note "would ask for $2"; return; fi
  cocon-secrets ask "$1" "   $2"
}
# pem_tidy <file> <label>: keeps the "-----BEGIN <label>-----" block and rebuilds its line breaks,
# which password managers often turn into spaces. Also undoes look-alike characters that text
# fields substitute (smart dashes, non-breaking spaces) and terminal paste markers.
# Fails if there is no such block.
pem_tidy() {
  local raw body
  raw=$(LC_ALL=C sed -e 's/\xe2\x80[\x90-\x95]/-/g' -e 's/\xc2\xa0/ /g' -e 's/\xe2\x80[\xaf\x8b]/ /g' \
    -e 's/\x1b\[20[01]~//g' "$1" | tr '\r\n\t' '   ' | tr -s ' ')
  case $raw in *"-----BEGIN $2-----"*"-----END $2-----"*) ;; *) return 1 ;; esac
  body=${raw#*"-----BEGIN $2-----"}
  body=${body%%"-----END $2-----"*}
  {
    echo "-----BEGIN $2-----"
    printf '%s' "$body" | tr -d ' \t' | fold -w 64
    echo
    echo "-----END $2-----"
  } >"$1"
}
ask_pem() { # ask_pem <name> <question> <PEM label> <openssl command>
  if has_secret "$1"; then note "$1: already set"; return; fi
  if [ $dry = 1 ]; then note "would ask for $2"; return; fi
  local tmp
  tmp=$(mktemp)
  note "$2: paste all of it, from -----BEGIN $3----- to -----END $3-----, then press Enter"
  stty -echo </dev/tty
  sed '/-----END /q' </dev/tty >"$tmp"
  stty echo </dev/tty
  if ! pem_tidy "$tmp" "$3"; then
    # The first characters only: the BEGIN line, never the secret part.
    note "Expected the paste to start with: -----BEGIN $3-----"
    note "It started with:                  $(head -c 32 "$tmp" | LC_ALL=C cat -v)"
    rm -f "$tmp"
    die "no '-----BEGIN $3-----' block found in what was pasted. Run the setup again."
  fi
  $4 -noout -in "$tmp" 2>/dev/null || { rm -f "$tmp"; die "the $2 looks incomplete. Copy all of it and run the setup again."; }
  cocon-secrets seal "$1" "$tmp"
}

ask resend-api-key "Resend API key (sign-in emails and alerts)"
ask_pem origin.pem "Cloudflare origin certificate" CERTIFICATE "openssl x509"
ask_pem origin.key "Cloudflare origin private key" "PRIVATE KEY" "openssl pkey"

if ! has_secret rclone.conf; then
  if [ $dry = 1 ]; then note "would ask for the R2 access key, secret, endpoint and photo backup passphrase"; else
    key_id=$(hidden "R2 access key ID")
    key_secret=$(hidden "R2 secret access key")
    endpoint=$(hidden "R2 endpoint (https://<account>.r2.cloudflarestorage.com)")
    passphrase=$(hidden "Photo backup passphrase (new: generate one in your password manager)")
    tmp=$(mktemp)
    cat >"$tmp" <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = $key_id
secret_access_key = $key_secret
endpoint = $endpoint
no_check_bucket = true

[crypt]
type = crypt
remote = r2:$R2_BUCKET/photos
filename_encryption = standard
directory_name_encryption = false
password = $(printf '%s' "$passphrase" | rclone obscure -)
EOF
    unset key_id key_secret passphrase
    cocon-secrets seal rclone.conf "$tmp"
  fi
fi

# Backups are encrypted to your key (for disaster recovery) and the server's (restore tests).
if ! has_secret backup-identity && [ $dry = 0 ]; then
  tmp=$(mktemp)
  rm -f "$tmp"
  age-keygen -o "$tmp" 2>/dev/null
  cocon-secrets seal backup-identity "$tmp"
fi
if [ ! -s /etc/cocon/backup-recipients.txt ]; then
  if [ $dry = 1 ]; then note "would ask for your age public key (age1...)"; else
    read -r -p "   Your age public key for backups (age1..., from your password manager): " mine </dev/tty
    [[ $mine =~ ^age1[0-9a-z]{58}$ ]] || die "an age public key starts with age1 and has 62 characters"
    tmp=$(mktemp)
    cocon-secrets open backup-identity "$tmp"
    server_key=$(age-keygen -y "$tmp")
    rm -f "$tmp"
    printf '# Gabriel (password manager)\n%s\n# This server (restore tests)\n%s\n' "$mine" "$server_key" |
      write /etc/cocon/backup-recipients.txt 644 || true
  fi
fi

# --- Supabase, one stack per environment ------------------------------------------------------
set_env() { # set_env <file> <KEY> <value>. The value goes through the environment, not argv.
  k=$2 v=$3 awk 'BEGIN { FS = OFS = "="; k = ENVIRON["k"]; v = ENVIRON["v"] }
    $1 == k { print k "=" v; found = 1; next } { print } END { if (!found) print k "=" v }' "$1" >"$1.new" &&
    mv "$1.new" "$1"
}
host_for() { if [ "$2" = prod ]; then echo "$1.$COCON_DOMAIN"; else echo "$1-staging.$COCON_DOMAIN"; fi; }

# Settings, database files and photos: root only (containers are started by root's Docker).
run install -d -m 700 /srv/cocon
run chmod 700 /srv/cocon
for env in staging prod; do
  step "Supabase $env ($SUPABASE_REF)"
  dir=/srv/cocon/$env/supabase
  if ! has_secret "$env-supabase.env"; then
    if [ $dry = 1 ]; then note "would install Supabase in $dir and generate its keys"; continue; fi
    if [ ! -f "$dir/.env" ]; then
      [ ! -e "$dir" ] || die "$dir exists without settings; move it away and run again"
      mkdir -p "/srv/cocon/$env"
      setup=$(mktemp)
      curl -fsSL "https://raw.githubusercontent.com/supabase/supabase/refs/tags/$SUPABASE_REF/docker/setup.sh" -o "$setup"
      # Its output includes the generated keys, so it stays off the screen.
      (cd "/srv/cocon/$env" && sh "$setup" --skip-deps --yes --ref "$SUPABASE_REF" --project-dir supabase >/dev/null)
      rm -f "$setup"
      chmod 600 "$dir/.env"
    fi
    smtp_pass=$(mktemp)
    cocon-secrets open resend-api-key "$smtp_pass"
    api="https://$(host_for api "$env")"
    set_env "$dir/.env" SUPABASE_PUBLIC_URL "$api"
    set_env "$dir/.env" API_EXTERNAL_URL "$api/auth/v1"
    set_env "$dir/.env" SITE_URL "https://$(host_for app "$env")"
    set_env "$dir/.env" SMTP_HOST "$SMTP_HOST"
    set_env "$dir/.env" SMTP_PORT "$SMTP_PORT"
    set_env "$dir/.env" SMTP_USER "$SMTP_USER"
    set_env "$dir/.env" SMTP_PASS "$(cat "$smtp_pass")"
    set_env "$dir/.env" SMTP_ADMIN_EMAIL "$MAIL_FROM_ADDRESS"
    set_env "$dir/.env" SMTP_SENDER_NAME "$MAIL_FROM_NAME"
    rm -f "$smtp_pass"
    cocon-secrets seal "$env-supabase.env" "$dir/.env"
  else note "settings: already set"; fi

  if ! has_secret "$env-app.env"; then
    if [ $dry = 1 ]; then note "would ask for the PostHog project key of $env"; continue; fi
    posthog=$(hidden "PostHog project key for $env (phc_..., or - for none)")
    [ "$posthog" = - ] && posthog=
    tmp=$(mktemp)
    cat >"$tmp" <<EOF
SUPABASE_URL=https://$(host_for api "$env")
SUPABASE_ANON_KEY=$(cocon-secrets get "$env" ANON_KEY)
POSTHOG_KEY=$posthog
POSTHOG_HOST=$POSTHOG_HOST
EOF
    cocon-secrets seal "$env-app.env" "$tmp"
  else note "app settings: already set"; fi

  # Spec 003: Sign in with Google and the app's sign-in redirects, asked once per environment
  # (docs/operations.md › Google sign-in). Change them later with `cocon-secrets edit <env>-supabase.env`.
  settings=$(mktemp)
  if [ $dry = 1 ] && ! has_secret "$env-supabase.env"; then :
  elif cocon-secrets open "$env-supabase.env" "$settings" && grep -q '^GOOGLE_SIGN_IN=' "$settings"; then
    note "Google sign-in: already set"
  elif [ $dry = 1 ]; then note "would ask for the Google sign-in client of $env"
  else
    google_id=$(hidden "Google OAuth client ID for $env (ends in .apps.googleusercontent.com, or - to skip)")
    if [ "$google_id" = - ]; then
      set_env "$settings" GOOGLE_SIGN_IN false
    else
      set_env "$settings" GOOGLE_SIGN_IN true
      set_env "$settings" GOOGLE_CLIENT_ID "$google_id"
      set_env "$settings" GOOGLE_SECRET "$(hidden "Google OAuth client secret for $env")"
    fi
    set_env "$settings" ADDITIONAL_REDIRECT_URLS "https://$(host_for app "$env")/**"
    cocon-secrets seal "$env-supabase.env" "$settings"
  fi
  rm -f "$settings"

  run cocon-stack "$env" up -d --wait --quiet-pull
done

# --- Front door and timers ---------------------------------------------------------------------
step "Front door and timers"
run systemctl enable --now cocon-edge.service
run systemctl restart cocon-edge.service
run systemctl enable --now cocon-backup@staging.timer cocon-backup@prod.timer cocon-healthcheck.timer

step "Done"
note "Studio password (save it in your password manager): sudo cocon-secrets get <env> DASHBOARD_PASSWORD"
note "Next: bootstrap-from-laptop.sh locks down SSH once your own login is confirmed."
