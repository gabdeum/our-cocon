# Moving to Supabase Cloud

Our Cocon runs its own Supabase on `cocon-1`. Supabase Cloud is the same software run by Supabase, for a monthly fee. Move when running it yourself takes more than an hour or two a month, or a monthly restore test fails.

The app only knows Supabase through settings (its URL and public key), so moving means: create the Cloud project, copy the database and photos, then change the settings. Members sign in once more (their sessions were signed by the old server), and AI assistants reconnect.

Plan about two hours, at a quiet time. Do it on staging first, then prod. Ask Claude Code to go through it with you; the steps below are the checklist.

## 1. Create the Cloud project

1. supabase.com → New project, organisation "Our Cocon", name "our-cocon-prod" (or "-staging"), region **Frankfurt (eu-central-1)**. Save the database password in your password manager.
2. Project Settings → API: note the project URL (`https://<ref>.supabase.co`) and the anon key.
3. Project Settings → Database → Connection string (session mode): save it in your password manager as the Cloud database URL.

## 2. Create the tables

On your Mac, in the repo:

```sh
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

This applies every file in `supabase/migrations`, in order, and records them in the same history table our server uses.

## 3. Pause the app

So nothing changes while data is copied: on the server, stop the app containers.

```sh
sudo docker stop prod-web prod-mcp
```

## 4. Copy the database, accounts included

On the server, dump the data only (the structure came from step 2). Supabase's own bookkeeping tables are left out because the Cloud project has its own:

```sh
umask 077  # the dump holds member emails: readable by you only
db=$(sudo docker ps -q --filter label=com.docker.compose.project=cocon-prod --filter label=com.docker.compose.service=db)
sudo docker exec "$db" pg_dump -U supabase_admin -d postgres --data-only --column-inserts \
  --schema=auth --schema=public --schema=storage \
  --exclude-table=auth.schema_migrations --exclude-table=storage.migrations --exclude-table=storage.objects \
  > ~/cloud-data.sql
```

Copy it to your Mac (`scp gabriel@<server-ip>:cloud-data.sql .`), then load it in one go:

```sh
psql "<Cloud database URL>" --single-transaction -v ON_ERROR_STOP=1 \
  -c 'set session_replication_role = replica' -f cloud-data.sql
```

`session_replication_role = replica` loads rows without running triggers twice. Delete `cloud-data.sql` from both machines afterwards: it contains member emails.

## 5. Copy the photos

`storage.objects` (the list of photos) was left out above, because uploading a photo through Supabase's API creates its row again, with the right metadata. Photos are files under `/srv/cocon/prod/supabase/volumes/storage/stub/stub/<bucket>/<path>/<version>`, with their content type in the file's extended attributes. Ask Claude Code for a small script that uploads each one to the same bucket and path, with the service key of the Cloud project. Check the counts match: `select bucket_id, count(*) from storage.objects group by 1` on both sides.

## 6. Sign-in settings

In the Cloud dashboard → Authentication:

- URL Configuration: Site URL `https://app.ourcocon.com`, redirect URL `https://app.ourcocon.com/**` (the app's `/auth/callback?next=…`, spec 003).
- Sessions: inactivity timeout 90 days (`2160h`, spec 003 FR-001b). On Cloud this setting needs the Pro plan; on the Free plan people would stay signed in until they sign out.
- Emails → Templates: Magic link and Confirm signup both use the subject "Your Our Cocon sign-in link" and the body of `apps/app/public/email/sign-in.html`. Email OTP expiry: 3600 seconds.
- Emails → SMTP: host `smtp.resend.com`, port 465, user `resend`, password your Resend API key, sender `no-reply@ourcocon.com`, name "Our Cocon".
- Sign In / Providers: Google (spec 003), with the same Google client; add the Cloud project's callback URL to the Google client.

## 7. Switch the app

1. On the server: `sudo cocon-secrets edit prod-app.env` and set `SUPABASE_URL` to the Cloud project URL and `SUPABASE_ANON_KEY` to its anon key.
2. Re-run the last Release workflow on GitHub (or tag a new version). It restarts the web app and MCP server with the new settings and checks they answer.
3. In GitHub → Settings → Environments → production, add the Cloud database URL as `DATABASE_URL` if future migrations should run from CI (ask Claude Code to switch the deploy's migration step to it).

`api.ourcocon.com` now has nothing behind it. Keep it pointing at the server until everyone has the new app, then remove the DNS record (a custom domain on Supabase Cloud is a paid add-on; the app doesn't need one).

## 8. Afterwards

- Members sign in again; AI assistants reconnect (Settings → AI connections).
- Stop the old stack after a week of normal use: `sudo cocon-stack prod down` and `sudo systemctl disable --now cocon-backup@prod.timer`. Its last backups stay in R2 for 30 days.
- Supabase Cloud backs up the database daily on paid plans; check what your plan includes.
