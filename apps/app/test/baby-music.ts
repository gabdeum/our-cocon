import type { StoredEvent } from '@cocon/data';
import { gabriel, james, mia } from './fakes';

/** Spec 042 US1: Eva, Gabriel and James (without the app). */
export const eva = { ...mia, id: 'm-eva', user_id: 'u-eva', display_name: 'Eva', color: 'rose' as const };
export const members = [gabriel, eva, james];

/**
 * OC-CalEvent's "Baby music class": Eva added it two days before Oct 31; every Saturday morning
 * for James, Gabriel takes him, an hour's reminder and a "Bring" checklist with one item ticked.
 */
export function babyMusic(over: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: '00000000-0000-4000-8000-000000000042',
    title: 'Baby music class',
    category: 'social',
    location: 'Little Notes studio, 4 Elm St',
    notes: null,
    reminder: 'hour_before',
    starts_on: '2026-10-03',
    ends_on: '2026-10-03',
    time_type: 'slot',
    slots: ['morning'],
    start_time: null,
    end_time: null,
    recurrence: { freq: 'weekly', weekdays: [6], ends: { type: 'never' } },
    members: [james.id],
    responsible_member_id: gabriel.id,
    visibility: 'family',
    creator_member_id: eva.id,
    surprise: null,
    removed_members: [],
    exceptions: [],
    checklist: [
      { id: '00000000-0000-4000-8000-0000000000c1', position: 0, label: 'Diaper bag', done: true, done_by: gabriel.id },
      { id: '00000000-0000-4000-8000-0000000000c2', position: 1, label: 'Bottle', done: false, done_by: null },
      { id: '00000000-0000-4000-8000-0000000000c3', position: 2, label: 'Spare clothes', done: false, done_by: null },
    ],
    created_by: eva.user_id,
    updated_by: eva.user_id,
    source: 'app',
    created_at: '2026-10-29T09:00:00Z',
    updated_at: '2026-10-29T09:00:00Z',
    deleted_at: null,
    ...over,
  };
}

/** "Now" on the page: Oct 31, 2026, mid-morning. */
export const NOW = new Date('2026-10-31T10:00:00Z');
