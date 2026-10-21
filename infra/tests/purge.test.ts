import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

// Spec 018 FR-002: runs the real infra/bin/cocon-purge with stand-ins for docker, flock and
// systemd-creds on PATH. The docker stand-in logs every call and keeps the env file it was given.
const infra = resolve(import.meta.dirname, '..');
const SHA = 'c'.repeat(40);

const stubs = {
  docker: `#!/usr/bin/env bash
echo "docker $*" >> "$STUB_DIR/calls"
case "$1" in
  ps) echo api-gw-container ;;
  run)
    while [ $# -gt 0 ]; do [ "$1" = --env-file ] && cp "$2" "$STUB_DIR/seen.env"; shift; done
    [ -n "\${STUB_FAIL_RUN:-}" ] && exit 1; exit 0 ;;
esac
exit 0
`,
  flock: '#!/usr/bin/env bash\nexit 0\n',
  'systemd-creds': '#!/usr/bin/env bash\n# systemd-creds <encrypt|decrypt> --name=… <in> <out>\ncp "$3" "$4"\n',
};

let dir: string;

function purge(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync('bash', [join(infra, 'bin/cocon-purge'), ...args], {
    encoding: 'utf8',
    env: {
      PATH: `${join(dir, 'stubs')}:${join(infra, 'bin')}:${process.env.PATH}`,
      HOME: dir,
      COCON_HOME: infra,
      COCON_SRV: join(dir, 'srv'),
      COCON_CREDS: join(dir, 'creds'),
      COCON_RUN: join(dir, 'run'),
      COCON_STATE: join(dir, 'state'),
      STUB_DIR: dir,
      ...env,
    },
  });
  return { status: result.status, stderr: result.stderr };
}

const calls = () => (existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8') : '');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cocon-purge-'));
  mkdirSync(join(dir, 'stubs'));
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(dir, 'stubs', name), body);
    chmodSync(join(dir, 'stubs', name), 0o755);
  }
  mkdirSync(join(dir, 'creds'));
  writeFileSync(join(dir, 'creds/staging-supabase.env.cred'), 'POSTGRES_PASSWORD=pw\nSERVICE_ROLE_KEY=service-key\n');
  writeFileSync(join(dir, 'creds/staging-app.env.cred'), 'SUPABASE_URL=https://api-staging.example.com\n');
  mkdirSync(join(dir, 'srv/staging'), { recursive: true });
  writeFileSync(join(dir, 'srv/staging/current'), `${SHA}\n`);
});

describe('cocon-purge', () => {
  it("runs the purge from the live commit's migrate image, inside the stack's network", () => {
    const { status } = purge(['staging']);
    expect(status).toBe(0);
    expect(calls()).toMatch(new RegExp(`run --rm --network cocon-staging_default --env-file \\S+purge\\.env ghcr\\.io/gabdeum/our-cocon-migrate:${SHA} node purge\\.mjs`));
    expect(readFileSync(join(dir, 'seen.env'), 'utf8')).toBe('SUPABASE_URL=http://api-gw:8000\nSUPABASE_SERVICE_ROLE_KEY=service-key\n');
  });

  it('keeps the service key off the command line and locks secrets again', () => {
    purge(['staging']);
    expect(calls()).not.toContain('service-key');
    expect(existsSync(join(dir, 'run/staging/purge.env'))).toBe(false);
    expect(existsSync(join(dir, 'run/staging/supabase.env'))).toBe(false);
  });

  it('fails, so systemd sends the alert, when the purge fails', () => {
    const { status, stderr } = purge(['staging'], { STUB_FAIL_RUN: '1' });
    expect(status).not.toBe(0);
    expect(stderr).toContain('the purge of deleted recipes failed in staging');
  });

  it('does nothing before the first deploy', () => {
    writeFileSync(join(dir, 'srv/staging/current'), '');
    const { status, stderr } = purge(['staging']);
    expect(status).not.toBe(0);
    expect(stderr).toContain('staging has no deployed commit yet');
    expect(calls()).not.toContain('docker run');
  });
});
