// `pnpm theme`: regenerates packages/ui's theme and icons from design/system (spec 002, FR-001).
// `pnpm theme --check` changes nothing and fails if a generated file is out of date (CI runs it).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { iconsTsx, tailwindTheme, themeTs } from './theme-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const system = join(root, 'design/system');

export function generate() {
  const tokens = JSON.parse(readFileSync(join(system, 'tokens.json'), 'utf8'));
  const iconDir = join(system, 'assets/Icons');
  const icons = Object.fromEntries(
    readdirSync(iconDir)
      .filter((f) => f.endsWith('.svg'))
      .map((f) => [f.slice(0, -4), readFileSync(join(iconDir, f), 'utf8')]),
  );
  const logo = readFileSync(join(system, 'assets/Logos/our-cocon-mark.svg'), 'utf8');
  const brands = {
    apple: readFileSync(join(system, 'assets/Logos/apple.svg'), 'utf8'),
    google: readFileSync(join(system, 'assets/Logos/google.svg'), 'utf8'),
  };
  return {
    'packages/ui/theme.ts': themeTs(tokens),
    'packages/ui/tailwind.theme.cjs': tailwindTheme(tokens),
    'packages/ui/icons.generated.tsx': iconsTsx(icons, logo, brands),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, content] of Object.entries(generate())) {
    const path = join(root, file);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current === content) continue;
    if (check) stale.push(file);
    else writeFileSync(path, content);
  }
  if (stale.length > 0) {
    process.stderr.write(`Out of date with design/system/tokens.json: ${stale.join(', ')}\nRun \`pnpm theme\` and commit the result.\n`);
    process.exit(1);
  }
}
