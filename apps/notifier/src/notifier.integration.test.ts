// Spec 046 FR-004 and FR-005 against local Supabase: phones registered by the app are sent to, each
// send is logged, receipts are read after 15 minutes, and phones Apple no longer accepts are turned
// off. Expo itself is a fake. Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createNotifier } from '@cocon/notify';
import type { Database, Json } from '@cocon/schemas';
import { clientOptions, localSupabase, signInPerson, type Client } from '../test/local';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the notifier integration test');
if (!local) console.warn('notifier.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('notifier against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, clientOptions);
  const run = randomUUID().slice(0, 8);
  const ref = `test-${run}`;
  const userIds: string[] = [];
  let gabriel: Client;
  let gabrielId: string;
  const token = (name: string) => `ExponentPushToken[${name}${run}]`;
  const device = (name: string) => `${name}-${run}-device`;
  const sentTo: string[] = [];
  let now = new Date();

  // Expo: accepts every token but "gone…", whose ticket says DeviceNotRegistered. While `flaky`
  // is set, the first try of any batch fails as a whole.
  let flaky = false;
  const fetch = (async (input: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (String(input).endsWith('/send')) {
      sentTo.push(...body.map((m: { to: string }) => m.to));
      if (flaky) {
        flaky = false;
        return new Response('busy', { status: 503 });
      }
      return new Response(JSON.stringify({ data: body.map((m: { to: string }) => (m.to.includes('gone') ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: `ticket-${m.to}` })) }));
    }
    return new Response(JSON.stringify({ data: Object.fromEntries(body.ids.map((id: string) => [id, id.includes('ipad') ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' }])) }));
  }) as unknown as typeof globalThis.fetch;
  const notifier = createNotifier(admin, { fetch }, () => now);

  const register = async (name: string, prefs: Json = {}) => {
    const { error } = await gabriel.rpc('register_push_device', { p_device_id: device(name), p_platform: 'ios', p_token: token(name), p_prefs: prefs, p_app_version: '1.0.0' });
    if (error) throw error;
  };

  beforeAll(async () => {
    gabriel = await signInPerson(admin, url, anonKey, `notifier-gabriel-${run}@example.com`, userIds);
    const fam = await gabriel.rpc('create_family', { family_name: 'Notifier test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    const me = await admin.from('members').select('id').eq('user_id', userIds[0] as string).single();
    if (me.error) throw me.error;
    gabrielId = me.data.id;
    await register('iphone', { reminders_scope: 'all' });
    await register('ipad');
    await register('gone');
    await register('quiet', { reminders_on: false });
  }, 30_000);

  afterAll(async () => {
    await admin.from('notification_log').delete().eq('ref', ref);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('sends a reminder to every enabled phone that has reminders on, and logs each send', async () => {
    const result = await notifier.send({ kind: 'reminder', memberIds: [gabrielId], title: 'Test', body: 'Body', payload: { kind: 'reminder', route: '/timers' }, ref });
    expect(sentTo.sort()).toEqual([token('gone'), token('ipad'), token('iphone')].sort());
    expect(result).toEqual({ sent: 2, failed: 1 });
    const log = await admin.from('notification_log').select('status, error, ticket_id').eq('ref', ref);
    expect(log.data?.map((r) => r.status).sort()).toEqual(['error', 'sent', 'sent']);
  });

  it('turns off a phone whose ticket says it is no longer registered', async () => {
    const { data } = await admin.from('push_devices').select('device_id, disabled_at').eq('member_id', gabrielId);
    expect(data?.filter((d) => d.disabled_at).map((d) => d.device_id)).toEqual([device('gone')]);
  });

  it('reads receipts only after 15 minutes, then marks them delivered or failed', async () => {
    expect(await notifier.checkReceipts()).toEqual({ checked: 0, failed: 0 });
    now = new Date(now.getTime() + 16 * 60 * 1000);
    const result = await notifier.checkReceipts();
    expect(result.failed).toBeGreaterThanOrEqual(1);
    const log = await admin.from('notification_log').select('status').eq('ref', ref);
    expect(log.data?.map((r) => r.status).sort()).toEqual(['delivered', 'error', 'failed']);
    const ipad = await admin.from('push_devices').select('disabled_at').eq('device_id', device('ipad')).single();
    expect(ipad.data?.disabled_at).not.toBeNull();
  });

  it('sends timer and test notifications even with reminders off, and nothing to disabled phones', async () => {
    sentTo.length = 0;
    await notifier.send({ kind: 'test', memberIds: [gabrielId], title: 'Test', body: 'Body', payload: { kind: 'reminder', route: '/timers' }, ref });
    expect(sentTo.sort()).toEqual([token('iphone'), token('quiet')].sort());
  });

  it('spec 049: a failed send is tried once more', async () => {
    sentTo.length = 0;
    flaky = true;
    const result = await notifier.send({ kind: 'test', memberIds: [gabrielId], title: 'Test', body: 'Body', payload: { kind: 'reminder', route: '/timers' }, ref });
    expect(sentTo.sort()).toEqual([token('iphone'), token('iphone'), token('quiet'), token('quiet')].sort());
    expect(result).toEqual({ sent: 2, failed: 0 });
  });

  it('spec 049: "All family events" members get it only on phones set that way, worded per phone', async () => {
    sentTo.length = 0;
    const words: string[] = [];
    await notifier.send({
      kind: 'reminder',
      memberIds: [gabrielId],
      allFamilyOnly: [gabrielId],
      text: (d) => {
        words.push(String(d.prefs.reminders_scope));
        return { title: 'T', body: 'B' };
      },
      payload: { kind: 'reminder', route: '/timers' },
      ref,
    });
    expect(sentTo).toEqual([token('iphone')]);
    expect(words).toEqual(['all']);
  });

  it('registering again turns a phone back on', async () => {
    await register('gone');
    const { data } = await admin.from('push_devices').select('disabled_at').eq('device_id', device('gone')).single();
    expect(data?.disabled_at).toBeNull();
  });
});
