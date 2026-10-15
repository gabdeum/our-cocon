import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// cocon-ci is the forced command of each GitHub key: it must keep each key to its own environment.
// A sudo stand-in prints what would run.
const script = resolve(import.meta.dirname, '../bin/cocon-ci');
const SHA = 'c'.repeat(40);

function ci(keyEnv: string, request: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cocon-ci-'));
  writeFileSync(join(dir, 'sudo'), '#!/usr/bin/env bash\necho "sudo $*"\n');
  chmodSync(join(dir, 'sudo'), 0o755);
  // cocon-ci sets its own PATH; the test points it at the stand-in first.
  const result = spawnSync('bash', ['-c', `sed "s|^PATH=.*|PATH=${dir}:/usr/bin:/bin|" "$0" | bash -s "$@"`, script, keyEnv], {
    encoding: 'utf8',
    env: { SSH_ORIGINAL_COMMAND: request, PATH: process.env.PATH },
  });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

describe('cocon-ci', () => {
  it('lets each key deploy its own environment', () => {
    expect(ci('staging', `deploy staging ${SHA}`).out).toBe(`sudo -n /usr/local/bin/cocon-deploy staging ${SHA}\n`);
    expect(ci('prod', `deploy prod ${SHA}`).out).toBe(`sudo -n /usr/local/bin/cocon-deploy prod ${SHA}\n`);
  });

  it('lets only the staging key run the restore test', () => {
    expect(ci('staging', 'restore-test').out).toBe('sudo -n /usr/local/bin/cocon-restore-test\n');
    expect(ci('prod', 'restore-test').status).not.toBe(0);
  });

  it.each([
    ['staging', `deploy prod ${SHA}`],
    ['prod', `deploy staging ${SHA}`],
    ['staging', 'deploy staging abc'],
    ['staging', `deploy staging ${SHA} extra`],
    ['staging', `deploy staging ${SHA};id`],
    ['staging', 'bash'],
    ['staging', ''],
    ['', `deploy staging ${SHA}`],
  ])('refuses key %s asking for %j', (keyEnv, request) => {
    const { status, out } = ci(keyEnv, request);
    expect(status).not.toBe(0);
    expect(out).toBe('');
  });
});
