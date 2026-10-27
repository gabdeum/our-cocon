import { describe, expect, it } from 'vitest';
import { layoutDay } from './layout';

const item = (id: string, start: string, end: string) => ({ id, start, end });
const lanes = (result: ReturnType<typeof layoutDay>) => Object.fromEntries(result.map((r) => [r.id, [r.lane, r.lanes]]));

describe('layoutDay (FR-005)', () => {
  it.each([
    ['nothing', [], {}],
    ['one event takes the whole width', [item('a', '09:00', '12:00')], { a: [0, 1] }],
    ['touching events don’t overlap', [item('a', '09:00', '10:00'), item('b', '10:00', '11:00')], { a: [0, 1], b: [0, 1] }],
    ['two overlapping events sit side by side', [item('a', '09:00', '12:00'), item('b', '10:00', '11:00')], { a: [0, 2], b: [1, 2] }],
    ['the longer one goes left when they start together', [item('short', '09:00', '10:00'), item('long', '09:00', '12:00')], { long: [0, 2], short: [1, 2] }],
    [
      'a chain shares a group and reuses free lanes',
      [item('a', '09:00', '11:00'), item('b', '10:00', '13:00'), item('c', '11:00', '12:00')],
      { a: [0, 2], b: [1, 2], c: [0, 2] },
    ],
    [
      'three at once take three lanes; a later event starts a new group',
      [item('a', '14:00', '18:00'), item('b', '14:30', '16:00'), item('c', '15:00', '17:00'), item('d', '18:00', '22:00')],
      { a: [0, 3], b: [1, 3], c: [2, 3], d: [0, 1] },
    ],
  ])('%s', (_, items, expected) => {
    expect(lanes(layoutDay(items))).toEqual(expected);
  });
});
