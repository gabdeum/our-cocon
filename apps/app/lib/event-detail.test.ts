// Spec 042 FR-001, FR-004 and FR-006: what the event page says. Each row from the event's fields,
// hidden when there's nothing to say, and the delete Dialog's body.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { gabriel, james } from '../test/fakes';
import { NOW, babyMusic, eva, members } from '../test/baby-music';
import { addedLine, deleteBody, eventOccurrence, mapsUrl, memberBadges, reminderLines, repeatLine, responsibleLine, whenLines } from './event-detail';

const music = babyMusic();
const oct31 = eventOccurrence(music, '2026-10-31');

describe('the event page rows (FR-001)', () => {
  it('reads OC-CalEvent for Baby music class', () => {
    expect(oct31).not.toBeNull();
    if (!oct31) return;
    expect(whenLines(oct31, DEFAULT_SLOT_TIMES)).toEqual({ title: 'Saturday, Oct 31', sub: 'Morning · about 09:00–12:00' });
    expect(repeatLine(music)).toBe('Every Saturday');
    expect(responsibleLine(oct31.responsible_member_id, oct31.members, members)).toBe('Gabriel takes James');
    expect(reminderLines(oct31, members)).toEqual({ title: '1 hour before', sub: 'Shows on Home for Gabriel' });
    expect(memberBadges(oct31, members)).toEqual([{ key: james.id, name: 'James', initial: 'J', color: 'mint' }]);
  });

  it('says custom times, all day and several days as they are', () => {
    expect(whenLines({ ...music, time_type: 'custom', slots: [], start_time: '14:30', end_time: '15:30' }, DEFAULT_SLOT_TIMES).sub).toBe('14:30–15:30');
    expect(whenLines({ ...music, time_type: 'all_day', slots: [] }, DEFAULT_SLOT_TIMES).sub).toBe('All day');
    expect(whenLines({ ...music, starts_on: '2026-10-31', ends_on: '2026-11-02', time_type: 'all_day', slots: [] }, DEFAULT_SLOT_TIMES).title).toBe('Sat, Oct 31 – Mon, Nov 2');
  });

  it('names every repeat, and none for a one-off event', () => {
    const r = (recurrence: NonNullable<ReturnType<typeof babyMusic>['recurrence']>) => repeatLine(babyMusic({ recurrence }));
    expect(r({ freq: 'weekly', weekdays: [4, 2], ends: { type: 'never' } })).toBe('Every Tuesday and Thursday');
    expect(r({ freq: 'weekly', ends: { type: 'never' } })).toBe('Every Saturday');
    expect(r({ freq: 'biweekly', ends: { type: 'never' } })).toBe('Every other Saturday');
    expect(r({ freq: 'daily', ends: { type: 'never' } })).toBe('Every day');
    expect(r({ freq: 'yearly', ends: { type: 'never' } })).toBe('Every year');
    expect(repeatLine(babyMusic({ recurrence: null }))).toBeNull();
  });

  it('says who drives when nobody without the app is on it, and hides the row with nobody responsible', () => {
    expect(responsibleLine(gabriel.id, [eva.id], members)).toBe('Gabriel drives');
    expect(responsibleLine(null, [james.id], members)).toBeNull();
  });

  it('shows the reminder on Home for those with the app on the event, Everyone being all of them', () => {
    expect(reminderLines(babyMusic({ members: ['everyone'], responsible_member_id: null }), members)?.sub).toBe('Shows on Home for Gabriel and Eva');
    expect(reminderLines(babyMusic({ members: ['others'], responsible_member_id: null }), members)).toEqual({ title: '1 hour before' });
    expect(reminderLines(babyMusic({ reminder: 'none' }), members)).toBeNull();
  });

  it('opens the place in the phone’s maps app', () => {
    expect(mapsUrl('4 Elm St', 'ios')).toBe('https://maps.apple.com/?q=4%20Elm%20St');
    expect(mapsUrl('4 Elm St', 'web')).toBe('https://www.google.com/maps/search/?api=1&query=4%20Elm%20St');
  });

  it('badges Everyone and Others too', () => {
    expect(memberBadges(babyMusic({ members: ['everyone', 'others'] }), members).map((b) => [b.name, b.initial, b.color])).toEqual([
      ['Everyone', 'All', 'everyone'],
      ['Others', '', 'others'],
    ]);
  });
});

describe('Added by (FR-006)', () => {
  it('names who added it and when, or the assistant', () => {
    expect(addedLine(music, members, NOW)).toBe('Added by Eva · 2 days ago');
    expect(addedLine(babyMusic({ source: 'claude', created_at: '2026-10-31T09:00:00Z' }), members, NOW)).toBe('Added via Claude · 1 h ago');
    expect(addedLine(babyMusic({ created_by: 'someone-who-left' }), members, NOW)).toBe('Added by Former member · 2 days ago');
  });
});

describe('the occurrence shown', () => {
  it('is null for a date that is not in the series, or cancelled', () => {
    expect(eventOccurrence(music, '2026-11-01')).toBeNull();
    expect(eventOccurrence(babyMusic({ exceptions: [{ occurrence_date: '2026-10-31', cancelled: true }] }), '2026-10-31')).toBeNull();
  });

  it('follows a date moved to another day and keeps the event', () => {
    const moved = eventOccurrence(babyMusic({ exceptions: [{ occurrence_date: '2026-10-31', override: { starts_on: '2026-11-01', ends_on: '2026-11-01', location: 'Town hall' } }] }), '2026-10-31');
    expect(moved).toMatchObject({ id: music.id, starts_on: '2026-11-01', location: 'Town hall', checklist: music.checklist });
  });
});

describe('the delete Dialog (FR-004)', () => {
  it('says who added someone else’s event, and which choices a repeating one has', () => {
    expect(deleteBody(music, gabriel.id, members)).toBe("Eva added this. Delete only this one, or this and all future ones? It's removed for the whole family.");
    expect(deleteBody(babyMusic({ recurrence: null }), gabriel.id, members)).toBe('Eva added this. This removes it for the whole family.');
    expect(deleteBody(babyMusic({ recurrence: null }), eva.id, members)).toBe('This removes it for the whole family.');
  });
});
