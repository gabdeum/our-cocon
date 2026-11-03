import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

// Spec 001 SC-004: runs the real infra/bin/cocon-restore-test with stand-ins for docker, rclone,
// age and the other cocon-* commands on PATH. Every stand-in logs its call to one file, in order.
const infra = resolve(import.meta.dirname, '..');
const migrations = resolve(infra, '../supabase/migrations');
const SHA = 'd'.repeat(40);

const log = (name: string) => `echo "${name} $*" >> "$STUB_DIR/calls"`;
const stubs = {
  docker: `#!/usr/bin/env bash
${log('docker')}
case "$1" in
  ps) echo db-container ;;
  exec)
    case "$*" in
      *pg_restore*) cat >/dev/null; [ -n "\${STUB_FAIL_RESTORE:-}" ] && exit 1; exit 0 ;;
      *psql*)
        sql=$(cat)
        case "$sql" in
          *pg_roles*) printf '%s' "$sql" > "$STUB_DIR/roles.sql" ;;
          *) printf 'public.recipes\\t3\\n' ;;
        esac ;;
    esac ;;
esac
exit 0
`,
  'cocon-stack': `#!/usr/bin/env bash
${log('cocon-stack')}
[ "$2" = config ] && printf 'db\\nauth\\nrest\\n'
exit 0
`,
  rclone: `#!/usr/bin/env bash
${log('rclone')}
case "$*" in *lsf*) echo 2026-11-03T03-00/ ;; esac
exit 0
`,
  // Writes the manifest (STUB_MANIFEST, or one table) for any -o file; streams nothing for the dump.
  age: `#!/usr/bin/env bash
while [ $# -gt 0 ]; do [ "$1" = -o ] && printf '%b' "\${STUB_MANIFEST:-public.recipes\\t3\\n}" > "$2"; shift; done
exit 0
`,
  'cocon-secrets': '#!/usr/bin/env bash\nexit 0\n',
  'cocon-deploy': `#!/usr/bin/env bash\n${log('cocon-deploy')}\nexit 0\n`,
  setfattr: '#!/usr/bin/env bash\nexit 0\n',
  flock: '#!/usr/bin/env bash\nexit 0\n',
};

let dir: string;
const volumes = () => join(dir, 'srv/staging/supabase/volumes');

function restoreTest(env: Record<string, string> = {}) {
  const result = spawnSync('bash', [join(infra, 'bin/cocon-restore-test')], {
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

const calls = () => (existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8').split('\n') : []);
const indexOf = (pattern: RegExp) => calls().findIndex((line) => pattern.test(line));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cocon-restore-'));
  mkdirSync(join(dir, 'stubs'));
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(dir, 'stubs', name), body);
    chmodSync(join(dir, 'stubs', name), 0o755);
  }
  mkdirSync(join(dir, 'run'));
  mkdirSync(join(volumes(), 'db/data'), { recursive: true });
  mkdirSync(join(volumes(), 'storage'));
  writeFileSync(join(volumes(), 'db/data/staging-db'), '');
  writeFileSync(join(volumes(), 'storage/staging-photo'), '');
  writeFileSync(join(dir, 'srv/staging/current'), `${SHA}\n`);
});

describe('cocon-restore-test', () => {
  it("creates the app's roles before loading the dump, then deploys staging's commit on top", () => {
    const { status, stderr } = restoreTest();
    expect(status, stderr).toBe(0);
    expect(readFileSync(join(dir, 'roles.sql'), 'utf8')).toContain('create role cocon_assistant');
    expect(indexOf(/psql/)).toBeLessThan(indexOf(/pg_restore/));
    expect(calls()).toContain(`cocon-deploy staging ${SHA}`);
    expect(readdirSync(join(volumes(), 'db/data.before-restore'))).toEqual(['staging-db']);
  });

  it("puts staging's previous data back and starts it again when the restore fails", () => {
    const { status, stderr } = restoreTest({ STUB_FAIL_RESTORE: '1' });
    expect(status).not.toBe(0);
    expect(stderr).toContain("putting staging's previous data back");
    expect(readdirSync(join(volumes(), 'db/data'))).toEqual(['staging-db']);
    expect(readdirSync(join(volumes(), 'storage'))).toEqual(['staging-photo']);
    expect(existsSync(join(volumes(), 'db/data.before-restore'))).toBe(false);
    const lines = calls();
    expect(lines.at(-2)).toBe('cocon-stack staging up -d --wait --quiet-pull');
    expect(lines).not.toContain(`cocon-deploy staging ${SHA}`);
  });

  it('says so, and puts staging back, when the backup has no row counts', () => {
    const { status, stderr } = restoreTest({ STUB_MANIFEST: 'photos\\t5\\n' });
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/backup \S+ has no row counts to check against/);
    expect(readdirSync(join(volumes(), 'db/data'))).toEqual(['staging-db']);
  });
});

// cocon-backup reads the row counts from a coprocess (bash 4+): CI's Ubuntu runs this, macOS's
// bash 3.2 can't. The docker stand-in answers like psql: a snapshot id, then the counts and `end`.
const backupStubs = {
  docker: `#!/usr/bin/env bash
case "$1" in
  ps) echo db-container ;;
  exec)
    case "$*" in
      *pg_dump*) echo dump ;;
      *psql*)
        while read -r line; do
          case "$line" in
            *pg_export_snapshot*) echo snapshot-1 ;;
            *'$$end$$'*) [ -z "\${STUB_NO_COUNTS:-}" ] && printf 'public.recipes\\t3\\n'; echo end ;;
          esac
        done ;;
    esac ;;
esac
exit 0
`,
  // Keeps a copy of what is uploaded (the script deletes its folder afterwards).
  rclone: `#!/usr/bin/env bash
prev=
for arg in "$@"; do
  [ "$prev" = copy ] && cp -R "$arg" "$STUB_DIR/uploaded"
  prev=$arg
done
exit 0
`,
  age: '#!/usr/bin/env bash\ncat\n',
  getfattr: '#!/usr/bin/env bash\nexit 0\n',
  'cocon-secrets': '#!/usr/bin/env bash\nexit 0\n',
  flock: '#!/usr/bin/env bash\nexit 0\n',
};
const oldBash = !/version [4-9]/.test(spawnSync('bash', ['--version'], { encoding: 'utf8' }).stdout);

describe.skipIf(oldBash)('cocon-backup', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cocon-backup-'));
    mkdirSync(join(dir, 'stubs'));
    for (const [name, body] of Object.entries(backupStubs)) {
      writeFileSync(join(dir, 'stubs', name), body);
      chmodSync(join(dir, 'stubs', name), 0o755);
    }
    mkdirSync(join(dir, 'run'));
    mkdirSync(join(dir, 'srv/prod/supabase/volumes/storage'), { recursive: true });
    writeFileSync(join(dir, 'srv/prod/supabase/volumes/storage/photo-1'), '');
    writeFileSync(join(dir, 'srv/prod/supabase/volumes/storage/photo-2'), '');
  });

  function backup(env: Record<string, string> = {}) {
    const result = spawnSync('bash', [join(infra, 'bin/cocon-backup'), 'prod'], {
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

  it("writes every table's row count and the photo count to the manifest", () => {
    const { status, stderr } = backup();
    expect(status, stderr).toBe(0);
    expect(readFileSync(join(dir, 'uploaded/manifest.tsv.age'), 'utf8')).toBe('public.recipes\t3\nphotos\t2\n');
  });

  it('fails, uploading nothing, when it gets no row counts', () => {
    const { status, stderr } = backup({ STUB_NO_COUNTS: '1' });
    expect(status).not.toBe(0);
    expect(stderr).toContain("could not count the rows of prod's tables");
    expect(existsSync(join(dir, 'uploaded'))).toBe(false);
  });
});

// A role, a role membership or a role setting made by a migration isn't in pg_dump's backup, so
// ROLES_SQL must repeat it, or the next restore fails (or quietly loses a setting). Compared as
// whole statements, so an attribute on a later line counts too.
const statementsOf = (sql: string) =>
  sql
    .replace(/--.*$/gm, '')
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, (block) => (block.startsWith('$$') && !block.includes('\n') ? `'${block.slice(2, -2)}'` : ''))
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);

describe('ROLES_SQL', () => {
  // One normalised string: its create role sits inside a do block, so it is matched as text.
  const rolesSql = spawnSync('bash', ['-c', `. "${join(infra, 'lib/backup.sh')}"; printf %s "$ROLES_SQL"`], {
    encoding: 'utf8',
  })
    .stdout.replace(/\$\$/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const statements = readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .flatMap((file) => statementsOf(readFileSync(join(migrations, file), 'utf8')))
    // Grants on tables, schemas or functions (`grant … on … to`) are in the dump; memberships aren't.
    .filter((statement) => /^((create|alter) (role|user)|grant [a-z_, ]+ to |alter database)/.test(statement))
    .filter((statement) => !/^grant .* on /.test(statement));

  it('finds the role statements in the migrations', () => {
    expect(statements).toContain('create role cocon_assistant nologin noinherit');
  });

  it.each(statements)('repeats %s', (statement) => {
    expect(rolesSql).toContain(`${statement};`);
  });
});
