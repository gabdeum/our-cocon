// `pnpm notify:test <email>`: sends one test notification to that person's phones, through Expo,
// on local Supabase only (it reads the local service role key from the Supabase CLI). Tapping it
// opens Timers (spec 046 US4).
import { createClient } from '@supabase/supabase-js';
import { createNotifier } from '@cocon/notify';
import type { Database } from '@cocon/schemas';
import { clientOptions, localSupabase } from '../test/local.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: pnpm notify:test <email of a signed-in person>');
  process.exit(1);
}
const local = localSupabase();
if (!local) {
  console.error('Local Supabase is not running (pnpm dev starts it).');
  process.exit(1);
}

const db = createClient<Database>(local.url, local.serviceKey, clientOptions);
const users = await db.auth.admin.listUsers({ perPage: 1000 });
if (users.error) throw users.error;
const user = users.data.users.find((u) => u.email?.toLowerCase() === email);
const member = user ? (await db.from('members').select('id').eq('user_id', user.id).maybeSingle()).data : null;
if (!member) {
  console.error(`No family member with the email ${email} on local Supabase.`);
  process.exit(1);
}

const accessToken = process.env.EXPO_ACCESS_TOKEN;
const notifier = createNotifier(db, { fetch, ...(accessToken ? { accessToken } : {}) });
const { sent, failed } = await notifier.send({
  kind: 'test',
  memberIds: [member.id],
  title: 'Test from Our Cocon',
  body: 'Tap to open Timers.',
  payload: { kind: 'reminder', route: '/timers' },
});
console.log(sent + failed === 0 ? 'No phone is registered for this person yet: open the app on the iPhone and turn on notifications.' : `Sent to ${sent} phone(s), ${failed} failed.`);
