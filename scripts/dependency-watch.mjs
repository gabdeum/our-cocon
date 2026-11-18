// Weekly (.github/workflows/dependency-watch.yml): say when a security workaround in
// pnpm-workspace.yaml can go, as a GitHub issue.
// - auditConfig.ignoreGhsas: the advisory now has a fix the installed version can take (same
//   major: add an override), or nothing installed is affected any more (remove the line).
// - overrides: a fresh install without the override no longer picks a version it covers (the
//   tools pinning old versions have updated: remove the line).
//
//   node scripts/dependency-watch.mjs            Open an issue per finding (skips ones already open)
//   node scripts/dependency-watch.mjs --dry-run  Only print the findings
//
// Needs the GitHub CLI, signed in (GH_TOKEN in CI).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');

/** The indented lines under a top-level key of pnpm-workspace.yaml. */
function section(key) {
  const lines = workspace.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim() && !line.startsWith(' ') && !line.startsWith('#'));
  return end < 0 ? rest : rest.slice(0, end);
}

const ignored = section('auditConfig')
  .map((line) => /^\s+- (GHSA-[\w-]+)/.exec(line)?.[1])
  .filter((id) => id !== undefined);

const overrideLines = section('overrides').filter((line) => /^ {2}\S/.test(line));
const overrides = overrideLines.map((line) => {
  const key = /^ {2}'?(.+?)'?: /.exec(line)?.[1] ?? '';
  const at = key.lastIndexOf('@');
  return { line, key, name: key.slice(0, at), range: key.slice(at + 1) };
});

// Versions, as numbers, without a prerelease (the lockfile has none we care about).
const parse = (version) => version.split('-')[0].split('.').map(Number).concat([0, 0, 0]).slice(0, 3);
function compare(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** "< 4.0.8", ">= 3.0.0, < 3.3.20" (advisories) or ">=3 <3.3.20" (overrides). */
function satisfies(version, range) {
  return range
    .split(/[,\s]+(?=[<>=])/)
    .map((part) => /^\s*(>=|<=|>|<|=)?\s*v?([\d.]+)/.exec(part))
    .every((match) => {
      if (!match) return true;
      const order = compare(version, match[2]);
      switch (match[1]) {
        case '>=': return order >= 0;
        case '<=': return order <= 0;
        case '>': return order > 0;
        case '<': return order < 0;
        default: return order === 0;
      }
    });
}

/** Every version of each package a lockfile resolves to. */
function lockedVersions(lockfile) {
  const versions = new Map();
  for (const [, name, version] of lockfile.matchAll(/^ {2}'?((?:@[^/\s']+\/)?[^@\s'/]+)@(\d[^(:'\s]*)/gm)) {
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(version);
  }
  return versions;
}

const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] });

/** @type {{ title: string; body: string }[]} */
const findings = [];
const installed = lockedVersions(readFileSync('pnpm-lock.yaml', 'utf8'));

for (const id of ignored) {
  const advisory = JSON.parse(gh(['api', `/advisories/${id}`]));
  const line = `\`${id}\` in \`auditConfig.ignoreGhsas\` (pnpm-workspace.yaml)`;
  if (advisory.withdrawn_at) {
    findings.push({ title: `Dependency watch: ${id} was withdrawn`, body: `GitHub withdrew this advisory. Remove ${line}.` });
    continue;
  }
  const affected = [];
  const fixes = [];
  for (const { package: pkg, vulnerable_version_range: range, first_patched_version: patched } of advisory.vulnerabilities) {
    if (pkg.ecosystem !== 'npm') continue;
    for (const version of installed.get(pkg.name) ?? []) {
      if (!satisfies(version, range)) continue;
      affected.push(`${pkg.name}@${version}`);
      // A fix in the same major: an override can apply it without breaking the tool that pins it.
      if (patched && parse(patched)[0] === parse(version)[0] && compare(patched, version) > 0) fixes.push({ name: pkg.name, version, patched });
    }
  }
  const link = `https://github.com/advisories/${id}`;
  if (affected.length === 0) {
    findings.push({
      title: `Dependency watch: ${id} no longer applies`,
      body: `No installed package is affected by [${id}](${link}) any more (the tools that pulled it in have updated). Remove ${line}, then check that \`pnpm audit --audit-level high\` passes.`,
    });
  } else if (fixes.length > 0) {
    const lines = [...new Set(fixes.map(({ name, version, patched }) => `  ${name.startsWith('@') ? `'${name}@<${patched}'` : `${name}@<${patched}`}: ^${patched} # was ${version}`))];
    findings.push({
      title: `Dependency watch: ${id} has a fix`,
      body: [
        `[${id}](${link}) now has a fixed version in the same major version as what's installed (${affected.join(', ')}).`,
        '',
        `Add to \`overrides\` in pnpm-workspace.yaml, remove ${line}, run \`pnpm install\`, then check that \`pnpm audit --audit-level high\` and \`pnpm test:all\` pass:`,
        '',
        '```yaml',
        ...lines,
        '```',
      ].join('\n'),
    });
  }
}

if (overrides.length > 0) {
  // A fresh resolve, in a copy of the workspace without the overrides: what would the tools pick?
  const dir = mkdtempSync(join(tmpdir(), 'dependency-watch-'));
  try {
    for (const file of ['package.json', 'patches', ...['apps', 'packages'].flatMap((parent) => readdirSync(parent).map((name) => join(parent, name, 'package.json')))]) {
      if (existsSync(file)) cpSync(file, join(dir, file), { recursive: true });
    }
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), workspace.split('\n').filter((line) => !/^overrides:/.test(line) && !overrideLines.includes(line)).join('\n'));
    execFileSync('pnpm', ['install', '--lockfile-only', '--ignore-scripts', '--silent'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
    const fresh = lockedVersions(readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8'));
    for (const { line, key, name, range } of overrides) {
      if (dryRun) console.log(`Without overrides, ${name} resolves to ${[...(fresh.get(name) ?? [])].join(', ') || 'nothing'}`);
      if ([...(fresh.get(name) ?? [])].some((version) => satisfies(version, range))) continue;
      findings.push({
        title: `Dependency watch: the ${name} override is no longer needed`,
        body: `Without it, a fresh install no longer picks a version in \`${range}\`: the tools that pinned an old ${name} have updated. Remove this line from \`overrides\` in pnpm-workspace.yaml, run \`pnpm install\`, then check that \`pnpm audit --audit-level high\` passes:\n\n\`\`\`yaml\n${line.trim()}\n\`\`\`\n\n(Override \`${key}\`.)`,
      });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (findings.length === 0) console.log('Nothing to change: every ignored advisory and override is still needed.');
const open = dryRun ? [] : JSON.parse(gh(['issue', 'list', '--state', 'open', '--search', 'Dependency watch in:title', '--limit', '100', '--json', 'title'])).map((issue) => issue.title);
for (const { title, body } of findings) {
  if (dryRun) {
    console.log(`## ${title}\n${body}\n`);
  } else if (open.includes(title)) {
    console.log(`Already open: ${title}`);
  } else {
    gh(['issue', 'create', '--title', title, '--body-file', '-'], body);
    console.log(`Opened: ${title}`);
  }
}
