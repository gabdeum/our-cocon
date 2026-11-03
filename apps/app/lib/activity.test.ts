// Specs 026 and 028 (FR-006, FR-009): how an entry reads (OC-Home › Latest activity and States), AI
// or the family's own, and the "Mia ticked 2 of these items" message.
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
  from_recipe_name: null,
  event_id: null,
  event_name: null,
  event_when: null,
  event_secret: false,
  undone_by: null,
  undone_at: null,
  undo_action: null,
  can_undo: true,
  can_restore: false,
  ...over,
});
const members = [gabriel, alex, mia];

describe('describeEntry', () => {
  it('US1 (026): "Alex added 6 items · Groceries · via ChatGPT · 4 h ago", an AI badge in Alex\'s color, Undo', () => {
    expect(describeEntry(entry(), members, now)).toEqual({
      title: 'Alex added 6 items',
      sub: 'Groceries · via ChatGPT · 4 h ago',
      badge: { kind: 'ai', label: 'AI', color: 'rose' },
      action: 'undo',
    });
  });

  it('FR-009 (028): the family\'s own change has the person\'s avatar, no "via" and no Undo', () => {
    expect(describeEntry(entry({ source: 'app', actor_id: gabriel.user_id, kind: 'groceries_ticked', count: 4, can_undo: false }), members, now)).toEqual({
      title: 'Gabriel ticked 4 items',
      sub: 'Groceries · 4 h ago',
      badge: { kind: 'person', initial: 'G', color: 'honey' },
      action: null,
    });
  });

  it('items added from a recipe, and an event with when it is', () => {
    expect(describeEntry(entry({ source: 'app', from_recipe_name: 'Leek & bacon quiche', can_undo: false }), members, now).sub).toBe('Groceries · from Leek & bacon quiche · 4 h ago');
    const event = entry({
      source: 'claude',
      kind: 'event_created',
      count: 1,
      event_name: 'Pediatrician',
      event_when: { starts_on: '2026-10-28', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00' },
    });
    expect(describeEntry(event, members, now)).toMatchObject({ title: 'Alex added Pediatrician', sub: 'Calendar · Wed, 10:00 · via Claude · 4 h ago' });
  });

  it('US2 (026): once undone, "Undone by Gabriel" and no Undo', () => {
    expect(describeEntry(entry({ undone_by: gabriel.user_id, undo_action: 'undo', can_undo: false }), members, now)).toMatchObject({ sub: 'Undone by Gabriel', action: null });
  });

  it('FR-004 (026): an AI delete reads "Alex deleted …" with Restore, then "Restored by …"', () => {
    const deleted = entry({ kind: 'recipe_deleted', count: 1, names: [], recipe_name: 'Pumpkin soup', can_undo: false, can_restore: true });
    expect(describeEntry(deleted, members, now)).toMatchObject({ title: 'Alex deleted Pumpkin soup', sub: 'Recipes · via ChatGPT · 4 h ago', action: 'restore' });
    expect(describeEntry({ ...deleted, undone_by: mia.user_id, undo_action: 'restore', can_restore: false }, members, now).sub).toBe('Restored by Mia');
  });

  it('after 7 days the entry stays, without Undo', () => {
    expect(describeEntry(entry({ created_at: '2026-10-18T12:00:00Z', can_undo: false }), members, now)).toMatchObject({ sub: 'Groceries · via ChatGPT · 8 days ago', action: null });
  });

  it('a person who left, and an assistant we can’t name', () => {
    expect(describeEntry(entry({ actor_id: 'u-gone', source: 'mcp' }), members, now)).toMatchObject({
      title: 'Former member added 6 items',
      sub: 'Groceries · via an AI assistant · 4 h ago',
      badge: { kind: 'ai', label: 'AI', color: 'removed' },
    });
  });
});

describe('entryTitle', () => {
  it.each([
    [{ kind: 'recipe_created', recipe_name: 'Pumpkin soup' }, 'Eva added Pumpkin soup'],
    [{ kind: 'recipe_edited', recipe_name: 'Leek & bacon quiche' }, 'Eva edited Leek & bacon quiche'],
    [{ kind: 'recipe_restored', recipe_name: 'Pumpkin soup' }, 'Eva restored Pumpkin soup'],
    [{ kind: 'groceries_added', count: 1, names: ['Onion'] }, 'Eva added Onion'],
    [{ kind: 'groceries_ticked', count: 2 }, 'Eva ticked 2 items'],
    [{ kind: 'groceries_unticked', count: 1, names: ['Onion'] }, 'Eva put back Onion'],
    [{ kind: 'groceries_removed', count: 1, names: ['Onion'] }, 'Eva removed Onion'],
    [{ kind: 'groceries_cleared', count: 4 }, 'Eva cleared 4 done items'],
    [{ kind: 'event_created', count: 2, event_name: 'Pediatrician' }, 'Eva added Pediatrician'],
    [{ kind: 'event_created', count: 1, event_secret: true }, 'Eva added a private event'],
    [{ kind: 'event_deleted', count: 1 }, 'Eva deleted an event'],
    [{ kind: 'event_edited', count: 1, event_name: 'Baby music class' }, 'Eva edited Baby music class'],
    [{ kind: 'event_date_deleted', count: 1, event_name: 'Swim' }, 'Eva deleted one date of Swim'],
    [{ kind: 'other', count: 3 }, 'Eva made 3 changes'],
  ] as [Partial<ActivityEntry>, string][])('%o reads "%s"', (over, title) => {
    expect(entryTitle(entry(over), 'Eva')).toBe(title);
  });
});

it('conflictText: who changed what, and that it stays', () => {
  expect(conflictText([{ kind: 'ticked', by: mia.user_id, count: 2 }], members)).toBe("Mia ticked 2 of these items. They'll stay as they are.");
  expect(conflictText([{ kind: 'edited', by: gabriel.user_id, count: 1 }, { kind: 'gone', by: null, count: 1 }], members)).toBe(
    "Gabriel changed 1 of these things since. 1 of these is gone for good. They'll stay as they are.",
  );
});
