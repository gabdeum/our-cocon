/**
 * Spec 046 FR-005: the Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Expo forwards each message to Apple (and later Google); a ticket says it was accepted, and its
 * receipt, about 15 minutes later, whether Apple took it.
 */
const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Expo's limits per request. */
export const SEND_BATCH = 100;
export const RECEIPT_BATCH = 1000;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: 'default';
  /** iOS: how the notification breaks through Focus and the Lock Screen. */
  interruptionLevel?: 'active' | 'passive' | 'time-sensitive';
  categoryId?: string;
};

export type PushError = { message: string; error?: string };
export type PushTicket = { ok: true; id: string } | ({ ok: false } & PushError);
export type PushReceipt = { ok: true } | ({ ok: false } & PushError);

export type ExpoOptions = {
  fetch: typeof fetch;
  /** Needed once "Enhanced push security" is on for the Expo project (staging and prod). */
  accessToken?: string;
};

type RawTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function post(url: string, body: unknown, o: ExpoOptions): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (o.accessToken) headers.authorization = `Bearer ${o.accessToken}`;
  const res = await o.fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Expo push ${res.status}`);
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Expo push: ${json.errors.map((e) => e.message).join('; ')}`);
  return json.data;
}

function toResult(raw: RawTicket | { status: 'ok' } | undefined): PushTicket | PushReceipt {
  if (!raw) return { ok: false, message: 'No answer from Expo' };
  if (raw.status === 'ok') return 'id' in raw ? { ok: true, id: raw.id } : { ok: true };
  return { ok: false, message: raw.message, ...(raw.details?.error ? { error: raw.details.error } : {}) };
}

/** Sends in batches of 100. One ticket per message, in order; a failed batch gives error tickets. */
export async function sendPushes(messages: PushMessage[], o: ExpoOptions): Promise<PushTicket[]> {
  const tickets: PushTicket[] = [];
  for (const batch of chunks(messages, SEND_BATCH)) {
    try {
      const data = (await post(SEND_URL, batch, o)) as RawTicket[];
      batch.forEach((_, i) => tickets.push(toResult(data[i]) as PushTicket));
    } catch (e) {
      batch.forEach(() => tickets.push({ ok: false, message: e instanceof Error ? e.message : 'Expo push failed' }));
    }
  }
  return tickets;
}

/** Receipts for ticket ids, in batches of 1000. Ids Expo no longer knows (after 24 h) are left out. */
export async function getReceipts(ids: string[], o: ExpoOptions): Promise<Map<string, PushReceipt>> {
  const receipts = new Map<string, PushReceipt>();
  for (const batch of chunks(ids, RECEIPT_BATCH)) {
    const data = (await post(RECEIPTS_URL, { ids: batch }, o)) as Record<string, RawTicket>;
    for (const [id, raw] of Object.entries(data ?? {})) receipts.set(id, toResult(raw) as PushReceipt);
  }
  return receipts;
}
