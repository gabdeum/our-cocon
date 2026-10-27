import type { CalendarEvent } from './types';

export const GABRIEL = '0b8e6a1e-0000-4000-8000-000000000001';
export const EVA = '0b8e6a1e-0000-4000-8000-000000000002';
export const JAMES = '0b8e6a1e-0000-4000-8000-000000000003';

/** A one-off family event on Sat, Oct 31 2026, Morning, for James; override what a test needs. */
export function event(fields: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Football',
    category: 'Sport',
    location: 'Riverside park',
    notes: 'Bring water',
    starts_on: '2026-10-31',
    ends_on: '2026-10-31',
    time_type: 'slot',
    slots: ['morning'],
    start_time: null,
    end_time: null,
    recurrence: null,
    members: [JAMES],
    responsible_member_id: GABRIEL,
    visibility: 'family',
    creator_member_id: GABRIEL,
    surprise: null,
    ...fields,
  };
}
