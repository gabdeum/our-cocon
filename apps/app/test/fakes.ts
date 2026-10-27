import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { Tracker } from '@cocon/schemas';
import type { FamilyApi } from '../lib/family';
import type { AccountMember, Family, Member } from '../lib/session';
import type { GroceryItem, PackData } from '../lib/groceries';

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
    acceptInvite: vi.fn(() => ok({ days_since_sent: 2 })),
    removeMember: vi.fn(() => ok(undefined)),
    makeOwner: vi.fn(() => ok(undefined)),
    setDisplayName: vi.fn(() => ok(undefined)),
    deleteFamily: vi.fn(() => ok(3)),
    deleteMyAccount: vi.fn(() => ok(undefined)),
    addManagedMember: vi.fn(() => ok('m-new')),
    renameManagedMember: vi.fn(() => ok(undefined)),
    removeManagedMember: vi.fn(() => ok(undefined)),
    managedMemberUpcomingEvents: vi.fn(() => ok(0)),
    setMemberColor: vi.fn(() => ok(undefined)),
    claimHomeTimeZone: vi.fn(() => ok(undefined)),
    ...overrides,
  } as unknown as { [K in keyof FamilyApi]: FamilyApi[K] & ReturnType<typeof vi.fn> };
}

export const family: Family = {
  id: '5f3e2d1c-0b9a-4876-9543-210fedcba987',
  name: 'The Demanges',
  owner_id: 'u-gabriel',
  created_by: 'u-gabriel',
  updated_by: 'u-gabriel',
  source: 'app',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
};

function member(user_id: string, display_name: string, role: Member['role'], color: Member['color'], joined_at: string): AccountMember {
  return {
    id: `m-${user_id}`,
    user_id,
    managed_by: null,
    display_name,
    role,
    color,
    joined_at,
    family_id: family.id,
    created_by: user_id,
    updated_by: user_id,
    source: 'app',
    created_at: joined_at,
    updated_at: joined_at,
  };
}

export const gabriel = member('u-gabriel', 'Gabriel', 'owner', 'honey', '2026-10-01T10:00:00Z');
export const alex = member('u-alex', 'Alex', 'editor', 'rose', '2026-10-02T10:00:00Z');
export const mia = member('u-mia', 'Mia', 'editor', 'sky', '2026-10-03T10:00:00Z');
/** Spec 033: a member without the app, added by Gabriel. */
export const james: Member = { ...member('none', 'James', 'editor', 'mint', '2026-10-04T10:00:00Z'), id: 'm-james', user_id: null, managed_by: gabriel.id, created_by: 'u-gabriel', updated_by: 'u-gabriel' };

/** The last match: a Dialog's confirm button repeats the label of the button that opened it. */
export function last<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error('no match');
  return item;
}

/** A grocery list row (spec 020): 2 Lemons in Produce, added by Gabriel in the app. */
export function groceryItem(over: Partial<GroceryItem>): GroceryItem {
  return {
    id: 'i1',
    name: 'Lemons',
    catalog_key: 'lemon',
    quantity: 2,
    unit: null,
    aisle: 'produce',
    checked: false,
    checked_by: null,
    checked_at: null,
    recipe_id: null,
    from_recipe: false,
    created_by: gabriel.user_id,
    source: 'app',
    created_at: '2026-10-21T10:00:00Z',
    recipes: null,
    ...over,
  };
}

/** Spec 021: one catalog entry's packs and facts, from the real catalog, as loadPacks returns them. */
export async function packData(keys: string[], corrected: Record<string, string> = {}): Promise<Record<string, PackData>> {
  const { facts, packsOf } = await import('@cocon/quantity/catalog.fixture');
  return Object.fromEntries(keys.map((k) => [k, { packs: { us: packsOf(k, 'us'), eu: packsOf(k, 'eu') }, facts: facts(k), corrected: corrected[k] ?? null }]));
}
