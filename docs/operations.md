# Running Our Cocon

How the server is set up, how changes reach it, and what to do when something needs attention. Each section is a short checklist; the commands are copied as is.

**Where things run.** One rented Hetzner server, `cocon-1`, runs two complete copies of Our Cocon: **staging** (a test copy, every change lands there first) and **prod** (the real app). Each copy has its own Supabase (database, sign-in, photo storage) and its own web app and MCP server, each in a **container** (a sealed box with everything one program needs, run by Docker). **Caddy**, the front door, receives every request from Cloudflare and passes it to the right container.

**Who does what.** GitHub (**CI**, its robots) tests, builds and deploys. You run the one-time setup and approve releases. Claude Code writes the scripts but never has access to the server.

## Words used here

| Word | Meaning |
| --- | --- |
| SSH | A secure way to type commands on the server from your Mac, using a key pair: the private half stays on your Mac, the public half is on the server. |
| `sudo` | Runs one command as the server's administrator (root). Asks for your server password. |
| Secret | A password or key. Never in the code or a chat; on the server it is **sealed**: encrypted with a key only the server has (`systemd-creds`), and decrypted into memory only while a command needs it. |
| age | A small encryption tool. Backups are locked with your **age public key** and can only be opened with the matching **age private key**, kept in your password manager. |
| R2 | Cloudflare's file storage, where backups go. |
| Migration | A file in `supabase/migrations` that changes the database's structure. Each runs once, in order; if one fails, none of that deploy's migrations are kept. |
| Timer | A scheduled job on the server (like a cron job): nightly backups, the 5-minute health check. |

## 1. First-time setup

### Before you start (about 30 minutes, once)

Save each result in your password manager. Nothing here goes into a chat.

1. **Backup key.** On your Mac: `brew install age`, then `age-keygen`. It prints a private key (`AGE-SECRET-KEY-…`) and its public key (`age1…`). Save both in your password manager, then clear the terminal (`clear`). The private key is the only way to open a backup.
2. **Photo backup passphrase.** Generate a long random password in your password manager, named "Our Cocon photo backup passphrase". Photos are encrypted with it.
3. **PostHog.** Create two projects, "Our Cocon staging" and "Our Cocon prod", in the EU region. Copy each project's API key (`phc_…`).
4. **SSH.** Check your Mac can log in as root: `ssh root@<server-ip> true` prints nothing when it works. If the login message says "System restart required", restart once first: `ssh root@<server-ip> reboot`, wait a minute. The setup asks for your SSH key's passphrase once, then remembers it in the Keychain.
5. **CI keys, one per environment.** GitHub logs into the server with an SSH key; staging and prod each get their own, so the staging key can never touch prod.
   - Staging: the key you already have. Download its public half, `cocon-deploy.pub`, from your password manager to `~/Downloads/cocon-deploy-staging.pub`.
   - Prod: make a new one on your Mac: `ssh-keygen -t ed25519 -N "" -C cocon-deploy-prod -f ~/Downloads/cocon-deploy-prod`. Save both files in your password manager. Paste the private one (`cocon-deploy-prod`, no `.pub`) into GitHub → Settings → Environments → **production** → `SSH_PRIVATE_KEY`, replacing the old value. Staging keeps the old key.

### Run the setup

From the repo on your Mac:

```sh
infra/bootstrap-from-laptop.sh <server-ip> --dry-run                                 # shows what it would do
infra/bootstrap-from-laptop.sh <server-ip> --staging-key ~/Downloads/cocon-deploy-staging.pub \
  --prod-key ~/Downloads/cocon-deploy-prod.pub
```

It copies `infra/` to the server and runs `infra/provision.sh`, which installs Docker, adds 4 GB of **swap** (disk used as emergency memory), turns on automatic security updates, sets the firewall, creates your login (`gabriel`) and GitHub's login (`deploy`, which can only deploy, never open a shell), installs both Supabase copies and the front door, and starts the backup and health-check timers. It asks, at hidden prompts (paste from your password manager; nothing shows):

| Prompt | From |
| --- | --- |
| sudo password for gabriel | New: generate one, save it as "cocon-1 sudo" |
| Resend API key | Resend → API keys (sending access) |
| Cloudflare origin certificate, then its private key | Your password manager (paste from `-----BEGIN` to `-----END`) |
| R2 access key ID, secret, endpoint | Your password manager (R2 token) |
| Photo backup passphrase | Step 2 above |
| Your age public key | Step 1 above (`age1…`) |
| PostHog project key, staging then prod | Step 3 above |

Last, it checks you can log in as `gabriel`, and only then turns off root and password logins. From then on: `ssh gabriel@<server-ip>`.

Afterwards, delete the key files from `~/Downloads` (`rm ~/Downloads/cocon-deploy-*`) and save each Studio password (Supabase's admin screens):

```sh
ssh gabriel@<server-ip> sudo cocon-secrets get staging DASHBOARD_PASSWORD
ssh gabriel@<server-ip> sudo cocon-secrets get prod DASHBOARD_PASSWORD
```

The Studio user name is `supabase`.

**How you know it worked:** `https://api-staging.ourcocon.com/auth/v1/health` answers (a 401 "no API key" error is fine: it means Supabase is up) and `https://studio-staging.ourcocon.com` asks for the Cloudflare PIN, then the Studio password. The app addresses answer 502 until the first deploy.

The script is safe to run again at any time (`infra/bootstrap-from-laptop.sh <server-ip>`): it only does what's missing. It can also set up a brand new server.

### After the first deploy

1. **GitHub images.** The first CI run on `main` creates three packages under github.com/gabdeum → Packages (`our-cocon-web`, `-mcp`, `-migrate`). Open each → Package settings → Change visibility → Public (the code is public; the server downloads them without a password).
2. **Uptime monitoring.** In UptimeRobot (free), add HTTPS monitors every 5 minutes, alerting your email:
   `https://app.ourcocon.com/version.json`, `https://mcp.ourcocon.com/health`, `https://api.ourcocon.com/auth/v1/health` (expect 401), and the same three with `-staging`.
3. **HSTS** (tells browsers to always use HTTPS): Cloudflare → SSL/TLS → Edge Certificates → HSTS → on, 12 months, include subdomains.
4. **Branch protection**: GitHub → Settings → Branches → add a rule for `main`: require a pull request, and require the status check **Check** to pass.

## 2. Deploying and releasing

- **Staging:** merge a pull request into `main`. CI tests, builds and deploys in about 10 minutes. The footer of `app-staging.ourcocon.com` shows **Build** and the first 7 characters of the commit.
- **Prod:** on GitHub → Releases → Draft a new release → new tag like `v1.0.0` on `main` → Publish. The Release workflow waits for your approval (GitHub emails you), then installs the exact images staging got.
- **If a deploy fails** the previous version keeps running: images that don't download or migrations that fail stop the deploy before anything changes, and an app that doesn't answer within a minute is replaced by the previous one. The error is in the GitHub Actions log.
- **Going back** to an older version: release its commit again (tag it `v1.0.1`). Database migrations only go forward, so a migration must never break the version before it.

## 3. Secrets

All secrets are sealed in `/etc/cocon/creds` on the server. To change one, log in (`ssh gabriel@<server-ip>`), then:

| To change | Command | Then |
| --- | --- | --- |
| A Supabase setting (SMTP, URLs, …) | `sudo cocon-secrets edit staging-supabase.env` | `sudo cocon-stack staging up -d` |
| App settings (PostHog key, …) | `sudo cocon-secrets edit prod-app.env` | Redeploy (re-run the last workflow) |
| Resend key | `sudo rm /etc/cocon/creds/resend-api-key.cred` and re-run the setup | Also update `SMTP_PASS` in both Supabase settings |
| Origin certificate | `sudo rm /etc/cocon/creds/origin.*.cred` and re-run the setup | |

The editor is nano: change the line, Ctrl+O, Enter, Ctrl+X.

## 4. Backups

Every night (between 02:00 and 03:30 UTC), for each copy:

- the whole database, accounts included, encrypted with age, to `cocon-backups/<env>/db/<date>/` in R2;
- the photos, encrypted with the photo passphrase, to `cocon-backups/photos/<env>/storage/` (photos changed or deleted that night go to `storage-old/<date>/`);
- a manifest: how many rows each table has, to check restores.

Anything older than 30 days is deleted. Backups are encrypted to two keys: yours (for a disaster) and the server's own (for the monthly test).

**Monthly restore test.** On the 3rd of each month, GitHub restores the latest prod backup into staging and checks every table's row count and the photos. It replaces staging's data with a copy of prod's, so staging then holds real family data. To run it now: GitHub → Actions → Restore test → Run workflow. If it fails, GitHub emails you.

**Run a backup now:** `sudo systemctl start cocon-backup@prod` (watch it: `journalctl -fu cocon-backup@prod`).

### If the server is lost

1. In Hetzner, restore the server from its daily backup (Server → Backups). That's the quickest way. If that isn't possible, create a new Ubuntu 26.04 LTS server, point the 8 Cloudflare DNS records at it, and update `SSH_HOST` and `SSH_KNOWN_HOSTS` in both GitHub environments.
2. On a new server, run the setup (section 1) with the **same** photo passphrase and age public key.
3. Ask Claude Code to walk you through restoring prod from R2 with your age private key. The steps are those of `infra/bin/cocon-restore-test`, applied to prod and using your key.
4. Release the last version again. Members sign in again.

## 5. Alerts

Emails come to `hello@ourcocon.com`, at most every 6 hours per problem.

| Alert | What to do |
| --- | --- |
| Disk over 80% full | `sudo docker system df` shows what uses space; `sudo docker image prune -a` removes unused images. If data has grown, resize the disk in Hetzner. |
| Memory over 90% used, or swap over 50% | See which container uses most: `sudo docker stats --no-stream`. If it lasts, rescale the server (section 7). |
| Unhealthy: \<containers> | `sudo cocon-stack prod ps` and `sudo cocon-stack prod logs --tail 100 <service>`. Often `sudo cocon-stack prod restart <service>` fixes it. |
| cocon-backup@… failed | The email holds the last log lines. Re-run it: `sudo systemctl start cocon-backup@prod`. |
| UptimeRobot: down | Check GitHub Actions (a deploy in progress?), then the containers as above. |

## 6. Updating Supabase

Every month or two, when [Supabase's self-hosted releases](https://github.com/supabase/supabase/releases?q=self-hosted) list a new `self-hosted/v…` tag. Read its notes first, then on the server:

```sh
sudo cocon-supabase-update staging self-hosted/v0.9.0
```

It merges the new release into the staging copy (keeping our settings), checks our overrides still fit, and restarts staging. Try the staging app. A few days later, do the same with `prod`. Then ask Claude Code to update `SUPABASE_REF` in `infra/config.env`.

## 7. If the server gets too small

Hetzner → Servers → cocon-1 → Rescale → a larger type, choosing **CPU and RAM only** (so you can scale back). It takes a few minutes, with the server off. Everything starts again by itself.

## 8. Moving to Supabase Cloud

When running Supabase yourself takes more than an hour or two a month, or a restore test fails: [move-to-supabase-cloud.md](move-to-supabase-cloud.md).

## Commands on the server

| Command | Does |
| --- | --- |
| `sudo cocon-stack <env> ps` | Lists that copy's Supabase containers (any `docker compose` command works) |
| `sudo cocon-stack <env> logs --tail 100 <service>` | Recent logs of `auth`, `rest`, `storage`, `db`, … |
| `sudo docker ps` | Every container, with its health |
| `sudo cocon-secrets get <env> <KEY>` | One Supabase setting |
| `sudo cocon-secrets edit <name>` | Change sealed settings |
| `sudo systemctl start cocon-backup@<env>` | Backup now |
| `systemctl list-timers 'cocon*'` | When backups and health checks run next |
| `cat /srv/cocon/<env>/current` | The commit running on that copy |
