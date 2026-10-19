// `pnpm check`: lint, type check and tests for what changed against origin/main (commits,
// uncommitted edits and new files), plus the packages that depend on it. A root config change, or
// no origin/main, checks everything. Prints only failures.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';

const ROOT_CONFIG = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'eslint.config.mjs',
  'vitest.config.ts',
  'scripts/vitest-quiet-reporter.ts',
];

function git(...args) {
  try {
    const out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

const packages = ['apps', 'packages']
  .flatMap((dir) => readdirSync(dir).map((name) => `${dir}/${name}`))
  .filter((dir) => existsSync(`${dir}/package.json`));
const units = [...packages, 'scripts', 'infra'];

const base = git('merge-base', 'origin/main', 'HEAD')?.[0];
const changed = base ? [...(git('diff', '--name-only', base) ?? []), ...(git('ls-files', '--others', '--exclude-standard') ?? [])] : null;

let selected;
if (!changed || changed.some((file) => ROOT_CONFIG.includes(file))) {
  selected = new Set(units);
} else {
  selected = new Set(units.filter((unit) => changed.some((file) => file.startsWith(`${unit}/`))));
  // The ingredient catalog's data is tested by the schemas and the catalog generator (spec 031).
  if (changed.some((file) => file.startsWith('data/catalog/'))) ['packages/schemas', 'scripts'].forEach((unit) => selected.add(unit));
  // Packages that use a changed package are checked too.
  const manifest = (dir) => JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const nameToDir = new Map(packages.map((dir) => [manifest(dir).name, dir]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const dir of packages) {
      if (selected.has(dir)) continue;
      const { dependencies = {}, devDependencies = {} } = manifest(dir);
      const uses = Object.keys({ ...dependencies, ...devDependencies }).some((dep) => selected.has(nameToDir.get(dep)));
      if (uses) {
        selected.add(dir);
        grew = true;
      }
    }
  }
}

const shellChanged = !changed || changed.some((file) => /^(infra|\.github|\.claude\/hooks)\//.test(file));
if (selected.size === 0 && !shellChanged) process.exit(0);

let failed = false;
function run(label, cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`✗ ${label}\n${result.stdout}${result.stderr}`.trimEnd() + '\n\n');
  }
}

const dirs = [...selected];
if (dirs.length > 0) {
  run('lint', 'pnpm', ['exec', 'eslint', '--quiet', ...dirs]);
  for (const dir of dirs.filter((d) => existsSync(`${d}/tsconfig.json`))) {
    run(`types: ${dir}`, 'pnpm', ['exec', 'tsc', '--noEmit', '--pretty', 'false', '-p', dir]);
  }
  const projects = dirs.filter((d) => readdirSync(d).some((f) => f.startsWith('vitest.config.')));
  if (projects.length > 0) {
    const flags = projects.flatMap((d) => ['--project', basename(d)]);
    run('tests', 'pnpm', ['exec', 'vitest', 'run', '--reporter=./scripts/vitest-quiet-reporter.ts', ...flags]);
  }
}

// Shell scripts: CI always runs ShellCheck; locally only when it is installed.
if (shellChanged && spawnSync('shellcheck', ['--version']).status === 0) {
  const scripts = (git('ls-files', 'infra/*.sh', 'infra/lib/*.sh', 'infra/bin/*', 'infra/web/*.sh', '.claude/hooks/*.sh', '.github/scripts/*.sh') ?? []);
  run('shellcheck', 'shellcheck', ['-x', '-P', 'infra:infra/lib:infra/bin', ...scripts]);
}

process.exit(failed ? 1 : 0);
