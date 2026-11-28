import { afterEach, describe, expect, it } from 'vitest';
import { dateLabel, dayTitles, formatTime, monthTitles, weekTitles } from './labels';
import { calendarWordsByLanguage, setCalendarWords } from './words';

// Spec 076 FR-008/009: dates in each language's order, times with its AM/PM.

afterEach(() => setCalendarWords(calendarWordsByLanguage.en));
const today = '2026-11-28';

describe('French', () => {
  it('puts the day before the month, in lowercase, with "1er"', () => {
    setCalendarWords(calendarWordsByLanguage.fr);
    expect(dayTitles('2026-11-01', today)[0]).toBe('dimanche 1er novembre');
    expect(dateLabel('2026-11-28')).toBe('sam. 28 nov');
    expect(weekTitles('2026-11-22', '2026-11-28', today)[0]).toBe('22 – 28 novembre');
    expect(weekTitles('2026-11-29', '2026-12-05', today)[0]).toBe('29 novembre – 5 décembre');
    expect(monthTitles(2027, 1, today)[0]).toBe('janvier 2027');
    expect(dayTitles('2027-01-04', today)[0]).toBe('lundi 4 janvier 2027');
  });
});

describe('Spanish', () => {
  it('writes "de" between day, month and year', () => {
    setCalendarWords(calendarWordsByLanguage.es);
    expect(dayTitles('2026-11-28', today)[0]).toBe('sábado, 28 de noviembre');
    expect(weekTitles('2026-11-22', '2026-11-28', today)[0]).toBe('22 – 28 de noviembre');
    expect(dayTitles('2027-01-04', today)[0]).toBe('lunes, 4 de enero de 2027');
    expect(formatTime('14:30', false)).toBe('2:30 p. m.');
  });
});

describe('English', () => {
  it('stays as drawn', () => {
    expect(dayTitles('2026-11-01', today)[0]).toBe('Sunday, November 1');
    expect(dateLabel('2026-11-28')).toBe('Sat, Nov 28');
    expect(formatTime('14:30', false)).toBe('2:30 PM');
  });
});
