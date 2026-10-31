// `pnpm update:prod`: publish the app's JavaScript to iPhones already running a production build
// (EAS Update), without a new App Store build. Steps: docs/operations.md, "iPhone app".
// `eas update` ignores a build profile's `env` in eas.json, and Expo would otherwise inline
// .env.local (local Supabase). So the profile's values are passed explicitly, .env.local is
// switched off, and the keys come from the EAS environment of the same name.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const build = JSON.parse(readFileSync('apps/app/eas.json', 'utf8')).build.production;

// The update is bundled from the files on disk, so publish only what is committed.
const dirty = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim();
if (dirty) {
  console.error('Uncommitted changes would ship in the update. Commit or stash them first.');
  process.exit(1);
}

const message = spawnSync('git', ['log', '-1', '--format=%h %s'], { encoding: 'utf8' }).stdout.trim();
const result = spawnSync(
  'pnpm',
  ['--dir', 'apps/app', 'exec', 'eas', 'update', '--channel', build.channel, '--environment', build.environment, '--platform', 'ios', '--message', message],
  { stdio: 'inherit', env: { ...process.env, ...build.env, EXPO_NO_DOTENV: '1' } },
);
process.exit(result.status ?? 1);
