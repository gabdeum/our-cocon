import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// infra/VERSION must change whenever the server scripts do, so cocon-deploy can tell when the
// server needs bootstrap-from-laptop.sh again.
const infra = resolve(import.meta.dirname, '..');
// What bootstrap-from-laptop.sh copies to the server (its rsync excludes), minus VERSION itself.
const skipped = /^(tests|docker|web)\/|^VERSION$/;

const read = (text: string) => ({
  version: Number(/^version=(\d+)$/m.exec(text)?.[1]),
  fingerprint: /^fingerprint=(\S+)$/m.exec(text)?.[1],
});

function fingerprint(): string {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '.'], { cwd: infra, encoding: 'utf8' });
  const files = listed.stdout.split('\0').filter((f) => f && !skipped.test(f)).sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(`${f}\0`).update(readFileSync(join(infra, f))).update('\0');
  return hash.digest('hex').slice(0, 16);
}

describe('infra/VERSION', () => {
  const current = read(readFileSync(join(infra, 'VERSION'), 'utf8'));

  it('matches the server scripts', () => {
    const now = fingerprint();
    expect(
      current.fingerprint,
      `The server scripts changed: in infra/VERSION, add 1 to version and set fingerprint=${now}`,
    ).toBe(now);
  });

  it('goes up when the server scripts differ from main', () => {
    const main = spawnSync('git', ['show', 'origin/main:infra/VERSION'], { cwd: infra, encoding: 'utf8' });
    // No main to compare with (a shallow CI checkout, or main before VERSION existed).
    if (main.status !== 0) return;
    const before = read(main.stdout);
    if (before.fingerprint === current.fingerprint) return;
    expect(current.version, `The server scripts changed since main: set version=${before.version + 1} in infra/VERSION`).toBeGreaterThan(before.version);
  });
});
