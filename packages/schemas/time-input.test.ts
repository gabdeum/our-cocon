import { describe, expect, it } from 'vitest';
import { parseMinutes, stepTimerFrom } from './time-input';

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

describe('stepTimerFrom (spec 023 US1)', () => {
  it('reads the one duration a step mentions, in seconds', () => {
    expect(stepTimerFrom('Bake for 25 minutes until golden.')).toBe(1500);
    expect(stepTimerFrom('Simmer 1½ hours.')).toBe(5400);
    expect(stepTimerFrom('Roast 1 hr 20 min.')).toBe(4800);
    expect(stepTimerFrom('Rest 30 s.')).toBe(30);
  });

  it('takes the shorter end of a range', () => {
    expect(stepTimerFrom('Cook 20–25 minutes.')).toBe(1200);
    expect(stepTimerFrom('Cook 8 to 10 mins.')).toBe(480);
  });

  it('gives no timer for none or several', () => {
    expect(stepTimerFrom('Season to taste.')).toBeNull();
    expect(stepTimerFrom('Fry 5 minutes, then bake 20 minutes.')).toBeNull();
    expect(stepTimerFrom('Use 2 large eggs.')).toBeNull();
  });
});
