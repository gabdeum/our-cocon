import { describe, expect, it } from 'vitest';
import { parseMinutes } from './time-input';

describe('parseMinutes (spec 014 FR-003)', () => {
  it.each([
    ['70', 70],
    ['70 min', 70],
    ['70min', 70],
    ['25 minutes', 25],
    ['1 h 10', 70],
    ['1h10', 70],
    ['1 h 10 min', 70],
    ['1 h 05', 65],
    ['2 h', 120],
    ['2 hours', 120],
    ['1 hr 30 mins', 90],
    ['1:10', 70],
    ['  1  H  10 ', 70],
    ['10080', 10080],
  ])('reads "%s" as %i minutes', (text, minutes) => {
    expect(parseMinutes(text)).toBe(minutes);
  });

  it('reads an empty field as no time', () => {
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes('   ')).toBeNull();
  });

  it.each(['soon', '0', '0 min', '10081', '1 h 75', '1.5 h', '-5', 'h', '1 day', '1:7'])('refuses "%s"', (text) => {
    expect(parseMinutes(text)).toBe('invalid');
  });
});
