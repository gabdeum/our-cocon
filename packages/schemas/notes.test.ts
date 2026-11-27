import { describe, expect, it } from 'vitest';
import { checklistCounts, checklistItemAt, toggleChecklistLine, untickChecklist } from './notes';

const note = '- [ ] Onion\n- [x] Leek\n- [ ] Carrot';

describe('toggleChecklistLine (spec 075 FR-001, FR-007)', () => {
  it('ticks the first line and leaves the others', () => {
    expect(toggleChecklistLine(note, 0)).toBe('- [x] Onion\n- [x] Leek\n- [ ] Carrot');
  });

  it('unticks a middle line', () => {
    expect(toggleChecklistLine(note, 1)).toBe('- [ ] Onion\n- [ ] Leek\n- [ ] Carrot');
  });

  it('ticks the last line', () => {
    expect(toggleChecklistLine(note, 2)).toBe('- [ ] Onion\n- [x] Leek\n- [x] Carrot');
  });

  it('reads an uppercase [X] as ticked', () => {
    expect(toggleChecklistLine('* [X] Onion', 0)).toBe('* [ ] Onion');
  });

  it('keeps Windows line breaks', () => {
    expect(toggleChecklistLine('Bring:\r\n- [ ] Onion\r\n- [ ] Leek\r\n', 2)).toBe('Bring:\r\n- [ ] Onion\r\n- [x] Leek\r\n');
  });

  it('keeps the indent, the label as typed and an empty item', () => {
    expect(toggleChecklistLine('  - [ ] **Onion**  ', 0)).toBe('  - [x] **Onion**  ');
    expect(toggleChecklistLine('- [ ]', 0)).toBe('- [x]');
  });

  it('refuses a line that is no longer a checklist item', () => {
    expect(toggleChecklistLine('Onion\n- Leek', 0)).toBeNull();
    expect(toggleChecklistLine('Onion\n- Leek', 1)).toBeNull();
    expect(toggleChecklistLine(note, 7)).toBeNull();
  });
});

describe('checklistItemAt', () => {
  it('gives the item on that line, or null', () => {
    expect(checklistItemAt('Hi\r\n- [X] Leek', 1)).toEqual({ done: true, label: 'Leek' });
    expect(checklistItemAt(note, 0)).toEqual({ done: false, label: 'Onion' });
    expect(checklistItemAt('Hi', 0)).toBeNull();
  });
});

describe('untickChecklist (FR-008)', () => {
  it('empties every box and keeps the rest', () => {
    expect(untickChecklist('Bring:\r\n- [x] Onion\r\n* [X] Leek\r\n- [ ] Carrot\r\n- [x]')).toBe(
      'Bring:\r\n- [ ] Onion\r\n* [ ] Leek\r\n- [ ] Carrot\r\n- [ ]',
    );
  });
});

describe('checklistCounts', () => {
  it('counts items and ticked items', () => {
    expect(checklistCounts(`Hello\n${note}`)).toEqual({ total: 3, checked: 1 });
    expect(checklistCounts('')).toEqual({ total: 0, checked: 0 });
  });
});
