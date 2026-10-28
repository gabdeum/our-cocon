// `pnpm dev`: local Supabase (Supabase CLI, in Docker), then the web app and MCP server.
// On first run it writes .env.local from env.example, filled with the local Supabase URL and key.
// Values are never printed.
// `pnpm dev:phone` (--phone) serves the app to Expo Go on an iPhone on the same Wi-Fi instead:
// the phone reaches local Supabase through this Mac's network name, not 127.0.0.1.
// Local Supabase (database, Studio, Mailpit) is then open to the whole Wi-Fi: use a trusted one.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const phone = process.argv.includes('--phone');
// --clear rebuilds Metro's cache, with .env.local loaded (a bare `expo start -c` would inline no Supabase address).
const clear = process.argv.includes('--clear') ? ' --clear' : '';

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
    SUPABASE_ANON_KEY: local.ANON_KEY,
  };
  const env = readFileSync('env.example', 'utf8').replace(/^([A-Z_]+)=$/gm, (line, key) =>
    fill[key] ? `${key}=${fill[key]}` : line,
  );
  writeFileSync('.env.local', env, { mode: 0o600 });
}

let env = process.env;
if (phone) {
  // The phone can only reach this Mac over a network (Wi-Fi or Ethernet).
  const nets = networkInterfaces();
  const lan = [nets.en0, nets.en1].flat().find((net) => net && net.family === 'IPv4' && !net.internal);
  if (!lan) {
    console.error('No network address found. Is this Mac on Wi-Fi?');
    process.exit(1);
  }
  // The Mac's Bonjour name (Name.local), not its IP: Supabase Auth refuses sign-in redirects to a
  // literal IP other than 127.0.0.1, and Expo Go's address (exp://…) is built from this host.
  const host = `${execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim()}.local`;
  // dotenv keeps variables that are already set, so these win over .env.local.
  env = { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: host, EXPO_PUBLIC_SUPABASE_URL: `http://${host}:54321` };
  console.log(`In Expo Go, open exp://${host}:8081 (or scan the QR code below).`);
  console.log(`Sign-in emails: http://${host}:54324. In the link, replace 127.0.0.1 with ${host}.`);
}

const child = spawn(
  'pnpm',
  [
    'exec', 'dotenv', '-e', '.env.local', '--',
    'concurrently', '-n', 'app,mcp', '-c', 'yellow,cyan',
    (phone ? 'pnpm --filter @cocon/app start' : 'pnpm --filter @cocon/app web') + clear, 'pnpm --filter @cocon/mcp dev',
  ],
  { stdio: 'inherit', env },
);
child.on('exit', (code) => process.exit(code ?? 0));
