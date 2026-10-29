import { describe, expect, it } from 'vitest';
import { expand } from './recurrence';
import { EVA, GABRIEL, JAMES, event } from './event.fixture';
import { viewFor } from './visibility';

describe('viewFor (FR-009)', () => {
  it('shows a family event in full to everyone', () => {
    const v = viewFor(event(), EVA);
    expect(v).toMatchObject({ view: 'full', is_surprise: false, title: 'Football', notes: 'Bring water' });
  });

  describe('private', () => {
    const therapy = event({ title: 'Therapy', members: [EVA], visibility: 'private', creator_member_id: EVA, responsible_member_id: EVA });

    it('shows the creator everything', () => {
      expect(viewFor(therapy, EVA)).toMatchObject({ view: 'full', title: 'Therapy', location: 'Riverside park' });
    });

    it('shows others "Busy" with the members, day and time, and nothing else', () => {
      expect(viewFor(therapy, GABRIEL)).toEqual({
        id: 'e1',
        starts_on: '2026-10-31',
        ends_on: '2026-10-31',
        time_type: 'slot',
        slots: ['morning'],
        start_time: null,
        end_time: null,
        recurrence: null,
        members: [EVA],
        visibility: 'private',
        creator_member_id: EVA,
        view: 'busy',
        title: 'Busy',
        location: null,
        notes: null,
        is_surprise: false,
      });
    });

    it('never passes on fields a caller adds', () => {
      const withChecklist = { ...therapy, checklist: ['Insurance card'], source: 'Claude' };
      expect(viewFor(withChecklist, GABRIEL)).not.toHaveProperty('checklist');
      expect(viewFor(withChecklist, GABRIEL)).not.toHaveProperty('source');
    });

    it('hides an occurrence’s changed title too', () => {
      const occurrences = expand(therapy, '2026-10-31', '2026-10-31', [{ occurrence_date: '2026-10-31', override: { title: 'Dentist', notes: 'Root canal' } }]);
      expect(occurrences.map((o) => viewFor(o, GABRIEL))[0]).toMatchObject({ title: 'Busy', notes: null, occurrence_date: '2026-10-31', is_exception: true });
    });
  });

  describe('surprise', () => {
    const dinner = event({
      title: 'Eva’s birthday dinner',
      category: 'Social',
      location: 'Café Lalo',
      notes: 'Book the back table',
      members: ['everyone'],
      visibility: 'surprise',
      creator_member_id: GABRIEL,
      surprise: { hidden_from: [EVA], cover_title: 'Dinner out', cover_note: 'Meet at Café Lalo at 19:30. Dress nice!' },
    });

    it('shows the person it’s hidden from only the cover, the time and the place', () => {
      const v = viewFor(dinner, EVA);
      expect(v).toMatchObject({ view: 'cover', title: 'Dinner out', location: 'Café Lalo', notes: 'Meet at Café Lalo at 19:30. Dress nice!', slots: ['morning'], is_surprise: false });
      expect(v.visibility).toBe('family');
      expect(v).not.toHaveProperty('surprise');
      expect(v).not.toHaveProperty('category');
      expect(v).not.toHaveProperty('responsible_member_id');
      expect(JSON.stringify(v)).not.toContain('birthday');
    });

    it('shows an empty cover note as none', () => {
      const plain = { ...dinner, surprise: { hidden_from: [EVA], cover_title: 'Dinner out' } };
      expect(viewFor(plain, EVA)).toMatchObject({ notes: null });
    });

    it('shows everyone else the real event, tagged Surprise', () => {
      expect(viewFor(dinner, JAMES)).toMatchObject({ view: 'full', title: 'Eva’s birthday dinner', is_surprise: true });
      expect(viewFor(dinner, GABRIEL)).toMatchObject({ view: 'full', is_surprise: true });
    });

    it('shows "Busy" to others when the cover is missing', () => {
      expect(viewFor({ ...dinner, surprise: null }, EVA)).toMatchObject({ view: 'busy', title: 'Busy', location: null });
      expect(viewFor({ ...dinner, surprise: null }, GABRIEL)).toMatchObject({ view: 'full' });
    });
  });

  it('shows a hidden event as "Busy" when the viewer or the creator is unknown', () => {
    const secret = event({ visibility: 'private', creator_member_id: EVA });
    expect(viewFor(secret, '')).toMatchObject({ view: 'busy' });
    expect(viewFor({ ...secret, creator_member_id: '' }, '')).toMatchObject({ view: 'busy' });
    expect(viewFor({ ...secret, creator_member_id: undefined as unknown as string }, undefined as unknown as string)).toMatchObject({ view: 'busy' });
    expect(viewFor(event(), '')).toMatchObject({ view: 'full' });
  });

  describe("a row events_visible already masked (spec 043)", () => {
    // Eva's copy of Gabriel's surprise: the database put the cover's fields in and says so.
    const cover = event({ title: 'Dinner out', location: 'Café Lalo', notes: 'Dress nice!', category: null, members: [EVA], view: 'cover' });

    it('keeps a cover a cover, with only its title, place and note', () => {
      const v = viewFor(cover, EVA);
      expect(v).toMatchObject({ view: 'cover', visibility: 'family', title: 'Dinner out', location: 'Café Lalo', notes: 'Dress nice!', is_surprise: false });
      expect(v).not.toHaveProperty('category');
      expect(v).not.toHaveProperty('responsible_member_id');
    });

    it('keeps Busy as Busy', () => {
      expect(viewFor(event({ visibility: 'private', creator_member_id: EVA, view: 'busy' }), GABRIEL)).toMatchObject({ view: 'busy', title: 'Busy', location: null });
    });

    it('decides the rest as before', () => {
      expect(viewFor(event({ view: 'full' }), EVA)).toMatchObject({ view: 'full', title: 'Football' });
    });
  });
});
