// `pnpm notify:dev`: the notifier against local Supabase, every minute, so reminders reach a phone
// running `pnpm dev:phone` (spec 049). Reads the local service role key from the Supabase CLI.
import { localSupabase } from '../test/local.js';

const local = localSupabase();
if (!local) {
  console.error('Local Supabase is not running (pnpm dev starts it).');
  process.exit(1);
}
process.env.SUPABASE_URL = local.url;
process.env.SERVICE_ROLE_KEY = local.serviceKey;
await import('./main.js');
