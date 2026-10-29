// Spec 026: how an AI entry reads (OC-Home › Activity card and States), and the "Mia ticked 2 of
// these items" message.
import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '@cocon/schemas';
import { alex, gabriel, mia } from '../test/fakes';
import { conflictText, describeEntry, entryTitle } from './activity';

const now = new Date('2026-10-26T16:00:00Z');
const entry = (over: Partial<ActivityEntry> = {}): ActivityEntry => ({
  key: '11111111-1111-4111-8111-111111111111',
  actor_id: alex.user_id,
  source: 'chatgpt',
  kind: 'groceries_added',
  created_at: '2026-10-26T12:00:00Z',
  count: 6,
  names: ['Bread', 'Butter', 'Carrots'],
  recipe_id: null,
  recipe_name: null,
  event_id: null,
  event_name: null,
  undone_by: null,
  undone_at: null,
  undo_action: null,
  can_undo: true,
  can_restore: false,
  ...over,
});
const members = [gabriel, alex, mia];

describe('describeEntry', () => {
  it('US1: "6 items added to Groceries · Added by Alex via ChatGPT · 4 h ago" with Undo', () => {
    expect(describeEntry(entry(), members, now)).toEqual({ title: '6 items added to Groceries', sub: 'Added by Alex via ChatGPT · 4 h ago', action: 'undo' });
  });

  it('US2: once undone, "Undone by Gabriel" and no Undo', () => {
    expect(describeEntry(entry({ undone_by: gabriel.user_id, undo_action: 'undo', can_undo: false }), members, now)).toMatchObject({ sub: 'Undone by Gabriel', action: null });
  });

  it('FR-004: an AI delete reads "Deleted by …" with Restore, then "Restored by …"', () => {
    const deleted = entry({ kind: 'recipe_deleted', count: 1, names: [], recipe_name: 'Pumpkin soup', can_undo: false, can_restore: true });
    expect(describeEntry(deleted, members, now)).toEqual({ title: 'Deleted: Pumpkin soup', sub: 'Deleted by Alex via ChatGPT · 4 h ago', action: 'restore' });
    expect(describeEntry({ ...deleted, undone_by: mia.user_id, undo_action: 'restore', can_restore: false }, members, now).sub).toBe('Restored by Mia');
  });

  it('after 7 days the entry stays, without Undo', () => {
    expect(describeEntry(entry({ created_at: '2026-10-18T12:00:00Z', can_undo: false }), members, now)).toMatchObject({ sub: 'Added by Alex via ChatGPT · 8 days ago', action: null });
  });

  it('a person who left, and an assistant we can’t name', () => {
    expect(describeEntry(entry({ actor_id: 'u-gone', source: 'mcp' }), members, now).sub).toBe('Added by Former member via an AI assistant · 4 h ago');
  });
});

it.each([
  ['event_created', 'Added'],
  ['event_edited', 'Changed'],
  ['event_deleted', 'Deleted'],
  ['event_date_deleted', 'Deleted'],
] as const)('spec 044: %s reads "%s by …"', (kind, verb) => {
  expect(describeEntry(entry({ kind, event_name: 'Swim' }), members, now).sub).toBe(`${verb} by Alex via ChatGPT · 4 h ago`);
});

describe('entryTitle', () => {
  it.each([
    [{ kind: 'recipe_created', recipe_name: 'Pumpkin soup' }, 'New: Pumpkin soup'],
    [{ kind: 'recipe_edited', recipe_name: 'Pumpkin soup' }, 'Edited: Pumpkin soup'],
    [{ kind: 'groceries_added', count: 1, names: ['Milk'] }, 'Milk added to Groceries'],
    [{ kind: 'groceries_ticked', count: 2 }, '2 items ticked'],
    [{ kind: 'groceries_unticked', count: 1, names: ['Milk'] }, 'Milk put back on the list'],
    [{ kind: 'groceries_removed', count: 1, names: ['Milk'] }, 'Milk removed from Groceries'],
    [{ kind: 'groceries_cleared', count: 4 }, '4 done items cleared'],
    [{ kind: 'event_created', count: 2, event_name: 'Pediatrician' }, 'New event: Pediatrician'],
    [{ kind: 'event_edited', count: 1, event_name: 'Baby music class' }, 'Edited event: Baby music class'],
    [{ kind: 'event_deleted', count: 1, event_name: 'Swim' }, 'Deleted event: Swim'],
    [{ kind: 'event_date_deleted', count: 1, event_name: 'Swim' }, 'Deleted one date: Swim'],
    [{ kind: 'other', count: 3 }, '3 changes'],
  ] as [Partial<ActivityEntry>, string][])('%o reads "%s"', (over, title) => {
    expect(entryTitle(entry(over))).toBe(title);
  });
});

it('conflictText: who changed what, and that it stays', () => {
  expect(conflictText([{ kind: 'ticked', by: mia.user_id, count: 2 }], members)).toBe("Mia ticked 2 of these items. They'll stay as they are.");
  expect(conflictText([{ kind: 'edited', by: gabriel.user_id, count: 1 }, { kind: 'gone', by: null, count: 1 }], members)).toBe(
    "Gabriel changed 1 of these things since. 1 of these is gone for good. They'll stay as they are.",
  );
});
