// Spec 071: when the app asks about a new time zone, and when the member's own times go back.
import { describe, expect, it } from 'vitest';
import { cityOf, familyTimeHere, sameClock, travelStep, zoneDifference } from './travel';

const WINTER = new Date('2026-12-10T12:00:00Z');
const PARIS = 'Europe/Paris';
const NY = 'America/New_York';
const none = { awayTimeZone: null, askedTimeZone: null };

describe('travelStep', () => {
  it('FR-001: asks on another clock; never before the family has a time zone, nor on its clock', () => {
    expect(travelStep(PARIS, none, NY, WINTER)).toEqual({ kind: 'ask', zone: NY });
    expect(travelStep(null, none, NY, WINTER)).toEqual({ kind: 'none' });
    expect(travelStep(PARIS, none, PARIS, WINTER)).toEqual({ kind: 'none' });
    // Berlin shows Paris's time: not a new zone.
    expect(travelStep(PARIS, none, 'Europe/Berlin', WINTER)).toEqual({ kind: 'none' });
  });

  it('doesn’t ask again where the times already follow, nor where the member said no; asks again somewhere else', () => {
    expect(travelStep(PARIS, { awayTimeZone: NY, askedTimeZone: NY }, NY, WINTER)).toEqual({ kind: 'none' });
    expect(travelStep(PARIS, { awayTimeZone: null, askedTimeZone: NY }, NY, WINTER)).toEqual({ kind: 'none' });
    expect(travelStep(PARIS, { awayTimeZone: NY, askedTimeZone: NY }, 'America/Los_Angeles', WINTER)).toEqual({ kind: 'ask', zone: 'America/Los_Angeles' });
    expect(travelStep(PARIS, { awayTimeZone: null, askedTimeZone: NY }, 'Asia/Tokyo', WINTER)).toEqual({ kind: 'ask', zone: 'Asia/Tokyo' });
  });

  it('FR-007: once the family has moved, its new zone is the one compared: nobody there is asked', () => {
    expect(travelStep(NY, none, NY, WINTER)).toEqual({ kind: 'none' });
    // Back in Paris after the family moved to New York: asked, to move it back.
    expect(travelStep(NY, none, PARIS, WINTER)).toEqual({ kind: 'ask', zone: PARIS });
  });

  it('FR-005: on the family’s clock again, the member’s own times go back (and the "no" is forgotten for next time)', () => {
    expect(travelStep(PARIS, { awayTimeZone: NY, askedTimeZone: NY }, PARIS, WINTER)).toEqual({ kind: 'back' });
    expect(travelStep(PARIS, { awayTimeZone: null, askedTimeZone: NY }, PARIS, WINTER)).toEqual({ kind: 'back' });
  });
});

describe('the drawer’s numbers', () => {
  it('how far apart, and what 4 PM on the family’s clock is on the phone', () => {
    expect(zoneDifference(NY, PARIS, WINTER)).toBe(-360);
    expect(zoneDifference('Asia/Kolkata', PARIS, WINTER)).toBe(270);
    expect(sameClock(PARIS, 'Europe/Berlin', WINTER)).toBe(true);
    expect(familyTimeHere(PARIS, NY, '16:00', WINTER)).toBe('10:00');
    expect(cityOf(NY)).toBe('New York');
  });
});
