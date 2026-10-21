import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

// Runs the real infra/bin/cocon-deploy with stand-ins for docker, flock and systemd-creds on PATH.
// The docker stand-in logs every call and pretends the app serves whichever commit was started last.
const infra = resolve(import.meta.dirname, '..');
const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

const stubs = {
  docker: `#!/usr/bin/env bash
echo "docker $*" >> "$STUB_DIR/calls"
case "$1" in
  pull) [ -n "\${STUB_FAIL_PULL:-}" ] && [[ "$*" == *"$STUB_FAIL_PULL"* ]] && exit 1; exit 0 ;;
  ps) echo db-container ;;
  run) [ -n "\${STUB_FAIL_MIGRATE:-}" ] && exit 1; exit 0 ;;
  create) echo fn-container ;;
  cp) mkdir -p "$3/shared-recipe" "$3/main" && echo new > "$3/shared-recipe/index.ts" && echo theirs > "$3/main/index.ts" ;;
  compose) echo "$COCON_SHA" > "$STUB_DIR/running" ;;
  exec)
    running=$(cat "$STUB_DIR/running" 2>/dev/null)
    [ "$running" = "\${STUB_BROKEN_SHA:-}" ] && exit 1
    echo "{\\"commit\\":\\"$running\\"}" ;;
esac
exit 0
`,
  flock: '#!/usr/bin/env bash\nexit 0\n',
  'systemd-creds': '#!/usr/bin/env bash\n# systemd-creds <encrypt|decrypt> --name=… <in> <out>\ncp "$3" "$4"\n',
};

let dir: string;

function deploy(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync('bash', [join(infra, 'bin/cocon-deploy'), ...args], {
    encoding: 'utf8',
    env: {
      PATH: `${join(dir, 'stubs')}:${join(infra, 'bin')}:${process.env.PATH}`,
      HOME: dir,
      COCON_HOME: infra,
      COCON_SRV: join(dir, 'srv'),
      COCON_CREDS: join(dir, 'creds'),
      COCON_RUN: join(dir, 'run'),
      COCON_STATE: join(dir, 'state'),
      COCON_HEALTH_TIMEOUT: '1',
      STUB_DIR: dir,
      ...env,
    },
  });
  return { status: result.status, stderr: result.stderr };
}

const calls = () => (existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8') : '');
const current = () => readFileSync(join(dir, 'srv/staging/current'), 'utf8').trim();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cocon-deploy-'));
  mkdirSync(join(dir, 'stubs'));
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(dir, 'stubs', name), body);
    chmodSync(join(dir, 'stubs', name), 0o755);
  }
  mkdirSync(join(dir, 'creds'));
  writeFileSync(join(dir, 'creds/staging-supabase.env.cred'), 'POSTGRES_PASSWORD=pw\nSMTP_SENDER_NAME=Our Cocon\n');
  writeFileSync(join(dir, 'creds/staging-app.env.cred'), 'SUPABASE_URL=https://api-staging.example.com\n');
  // OLD is live.
  mkdirSync(join(dir, 'srv/staging'), { recursive: true });
  writeFileSync(join(dir, 'srv/staging/current'), `${OLD}\n`);
  writeFileSync(join(dir, 'running'), OLD);
  // Supabase's own router and an older copy of our function.
  mkdirSync(join(dir, 'srv/staging/supabase/volumes/functions/main'), { recursive: true });
  writeFileSync(join(dir, 'srv/staging/supabase/volumes/functions/main/index.ts'), 'upstream');
  mkdirSync(join(dir, 'srv/staging/supabase/volumes/functions/shared-recipe'), { recursive: true });
  writeFileSync(join(dir, 'srv/staging/supabase/volumes/functions/shared-recipe/old.ts'), 'old');
});

describe('cocon-deploy', () => {
  it('pulls, migrates, switches and records the new commit', () => {
    const { status, stderr } = deploy(['staging', NEW]);
    expect(stderr).toContain('is live on staging');
    expect(status).toBe(0);
    expect(current()).toBe(NEW);
    expect(readFileSync(join(dir, 'srv/staging/previous'), 'utf8').trim()).toBe(OLD);
    const log = calls();
    expect(log).toContain(`pull -q ghcr.io/gabdeum/our-cocon-migrate:${NEW}`);
    expect(log).toMatch(/run --rm --network cocon-staging_default --env-file \S+migrate\.env/);
    expect(log.indexOf('docker run')).toBeLessThan(log.indexOf('docker compose'));
  });

  it('keeps the database password off the command line and locks secrets again', () => {
    deploy(['staging', NEW]);
    expect(calls()).not.toContain('pw');
    expect(existsSync(join(dir, 'run/staging/supabase.env'))).toBe(false);
    expect(existsSync(join(dir, 'run/staging/migrate.env'))).toBe(false);
  });

  it('stops before migrating when an image cannot be pulled', () => {
    const { status, stderr } = deploy(['staging', NEW], { STUB_FAIL_PULL: 'our-cocon-mcp' });
    expect(status).not.toBe(0);
    expect(stderr).toContain('staging is unchanged');
    expect(calls()).not.toContain('docker run');
    expect(calls()).not.toContain('docker compose');
    expect(current()).toBe(OLD);
  });

  it('stops before switching when a migration fails', () => {
    const { status, stderr } = deploy(['staging', NEW], { STUB_FAIL_MIGRATE: '1' });
    expect(status).not.toBe(0);
    expect(stderr).toContain('migrations failed');
    expect(calls()).not.toContain('docker compose');
    expect(current()).toBe(OLD);
  });

  it('goes back to the previous commit when the new one does not come up', () => {
    const { status, stderr } = deploy(['staging', NEW], { STUB_BROKEN_SHA: NEW });
    expect(status).not.toBe(0);
    expect(stderr).toContain('going back to aaaaaaa');
    expect(readFileSync(join(dir, 'running'), 'utf8').trim()).toBe(OLD);
    expect(current()).toBe(OLD);
  });

  it.each([
    [['dev', NEW]],
    [['staging', 'abc123']],
    [['staging', `${NEW};id`]],
    [['prod']],
    [['staging', NEW, 'extra']],
  ])('refuses bad arguments %j before touching anything', (args) => {
    const { status } = deploy(args);
    expect(status).not.toBe(0);
    expect(calls()).toBe('');
  });

  it('installs the commit\'s Edge Functions next to Supabase\'s router and reloads them (spec 019)', () => {
    const { status } = deploy(['staging', NEW]);
    expect(status).toBe(0);
    const fns = join(dir, 'srv/staging/supabase/volumes/functions');
    expect(readFileSync(join(fns, 'shared-recipe/index.ts'), 'utf8').trim()).toBe('new');
    expect(existsSync(join(fns, 'shared-recipe/old.ts'))).toBe(false);
    expect(readFileSync(join(fns, 'main/index.ts'), 'utf8')).toBe('upstream');
    expect(calls()).toContain('docker restart db-container');
  });
});
