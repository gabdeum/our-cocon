// `pnpm dev`: local Supabase (Supabase CLI, in Docker), then the web app and MCP server.
// On first run it writes .env.local from env.example, filled with the local Supabase URL and key.
// Values are never printed.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Supabase reads its Google sign-in credentials from .env.local when it exists (spec 003).
const supabaseStart = existsSync('.env.local') ? ['exec', 'dotenv', '-e', '.env.local', '--', 'supabase', 'start'] : ['exec', 'supabase', 'start'];
const start = spawnSync('pnpm', supabaseStart, { stdio: ['ignore', 'ignore', 'inherit'] });
if (start.status !== 0) {
  console.error('Local Supabase did not start. Is Docker running?');
  process.exit(1);
}

if (!existsSync('.env.local')) {
  const status = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
  const local = Object.fromEntries(
    status.stdout
      .split('\n')
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((match) => match !== null)
      .map(([, key, value]) => [key, value]),
  );
  if (!local.API_URL || !local.ANON_KEY) {
    console.error('Could not read the local Supabase URL and key from `supabase status`.');
    process.exit(1);
  }
  const fill = {
    EXPO_PUBLIC_SUPABASE_URL: local.API_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
    SUPABASE_URL: local.API_URL,
  };
  const env = readFileSync('env.example', 'utf8').replace(/^([A-Z_]+)=$/gm, (line, key) =>
    fill[key] ? `${key}=${fill[key]}` : line,
  );
  writeFileSync('.env.local', env, { mode: 0o600 });
}

const child = spawn(
  'pnpm',
  [
    'exec', 'dotenv', '-e', '.env.local', '--',
    'concurrently', '-n', 'app,mcp', '-c', 'yellow,cyan',
    'pnpm --filter @cocon/app web', 'pnpm --filter @cocon/mcp dev',
  ],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 0));
