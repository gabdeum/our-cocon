import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { Tracker } from '@cocon/schemas';
import type { FamilyApi } from '../lib/family';
import type { Family, Member } from '../lib/session';

export const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

export function fakeTracker() {
  return { track: vi.fn(), identify: vi.fn(), reset: vi.fn() } satisfies Tracker;
}

const ok = <T>(data: T) => Promise.resolve({ ok: true as const, data });

/** Every family function succeeding; override one with `vi.fn().mockResolvedValue(...)`. */
export function fakeApi(overrides: Partial<Record<keyof FamilyApi, unknown>> = {}) {
  return {
    createFamily: vi.fn(() => ok('f1')),
    createInvite: vi.fn(() => ok('a'.repeat(43))),
    inviteStatus: vi.fn(() => ok({ status: 'valid' as const, family_name: 'The Demanges', inviter_name: 'Gabriel' })),
    acceptInvite: vi.fn(() => ok(2)),
    removeMember: vi.fn(() => ok(undefined)),
    makeOwner: vi.fn(() => ok(undefined)),
    setDisplayName: vi.fn(() => ok(undefined)),
    deleteFamily: vi.fn(() => ok(3)),
    deleteMyAccount: vi.fn(() => ok(undefined)),
    ...overrides,
  } as unknown as { [K in keyof FamilyApi]: FamilyApi[K] & ReturnType<typeof vi.fn> };
}

export const family: Family = {
  id: '5f3e2d1c-0b9a-4876-9543-210fedcba987',
  name: 'The Demanges',
  owner_id: 'u-gabriel',
  joined_count: 3,
  created_by: 'u-gabriel',
  source: 'app',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
};

function member(user_id: string, display_name: string, role: Member['role'], avatar_tone: Member['avatar_tone'], joined_at: string): Member {
  return { user_id, display_name, role, avatar_tone, joined_at, family_id: family.id, created_by: user_id, source: 'app', created_at: joined_at, updated_at: joined_at };
}

export const gabriel = member('u-gabriel', 'Gabriel', 'owner', 'honey', '2026-10-01T10:00:00Z');
export const alex = member('u-alex', 'Alex', 'editor', 'sage', '2026-10-02T10:00:00Z');
export const mia = member('u-mia', 'Mia', 'editor', 'peach', '2026-10-03T10:00:00Z');

/** The last match: a Dialog's confirm button repeats the label of the button that opened it. */
export function last<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error('no match');
  return item;
}
