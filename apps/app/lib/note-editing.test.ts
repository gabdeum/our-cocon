// Spec 074 FR-009: the notes toolbar's and Enter's edits on the text and its selection.
import { describe, expect, it } from 'vitest';
import { activeFormats, continueList, insertLink, normalizeLinkInput, toggleBold, toggleList } from './note-editing';
import { parseNotes } from './notes';

const at = (start: number, end = start) => ({ start, end });
/** The selection of `|` marks in a sample: one for a caret, two for a range. */
function marked(s: string) {
  const a = s.indexOf('|');
  const b = s.indexOf('|', a + 1);
  return b === -1 ? { text: s.replace('|', ''), sel: at(a) } : { text: s.replace(/\|/g, ''), sel: at(a, b - 1) };
}
function show(r: { text: string; selection: { start: number; end: number } }) {
  const { start, end } = r.selection;
  return start === end ? r.text.slice(0, start) + '|' + r.text.slice(start) : r.text.slice(0, start) + '|' + r.text.slice(start, end) + '|' + r.text.slice(end);
}

describe('toggleBold', () => {
  const bold = (s: string) => {
    const { text, sel } = marked(s);
    const r = toggleBold(text, sel);
    return [show(r), r.action];
  };

  it('wraps the selection, keeping it on the words', () => {
    expect(bold('Buy |onion| today')).toEqual(['Buy **|onion|** today', 'add']);
  });

  it('leaves spaces at the ends outside the markers', () => {
    expect(bold('Buy| onion |today')).toEqual(['Buy **|onion|** today', 'add']);
  });

  it('unwraps a selection with its markers inside or just outside', () => {
    expect(bold('Buy |**onion**| today')).toEqual(['Buy |onion| today', 'remove']);
    expect(bold('Buy **|onion|** today')).toEqual(['Buy |onion| today', 'remove']);
  });

  it('puts the caret between four stars with nothing selected', () => {
    expect(bold('Buy |')).toEqual(['Buy **|**', 'add']);
  });

  it('takes the bold off the text the caret is in, empty pairs included', () => {
    expect(bold('Buy **oni|on** today')).toEqual(['Buy oni|on today', 'remove']);
    expect(bold('Buy **|**')).toEqual(['Buy |', 'remove']);
  });

  it('keeps emoji and accents whole', () => {
    expect(bold('|Crème brûlée 🍮| tonight')).toEqual(['**|Crème brûlée 🍮|** tonight', 'add']);
    expect(bold('**|Crème brûlée 🍮|** tonight')).toEqual(['|Crème brûlée 🍮| tonight', 'remove']);
  });

  it('reads back as bold in the drawer', () => {
    const { text, sel } = marked('Feed at a |1:1:1 ratio| by weight');
    expect(parseNotes(toggleBold(text, sel).text)[0]).toEqual({
      kind: 'paragraph',
      spans: [{ kind: 'text', text: 'Feed at a ' }, { kind: 'bold', children: [{ kind: 'text', text: '1:1:1 ratio' }] }, { kind: 'text', text: ' by weight' }],
    });
  });
});

describe('toggleList', () => {
  const list = (s: string, kind: 'bullet' | 'number' | 'check') => {
    const { text, sel } = marked(s);
    const r = toggleList(text, sel, kind);
    return [show(r), r.action];
  };

  it("puts the caret's line in a list and back", () => {
    expect(list('onion|', 'bullet')).toEqual(['- onion|', 'add']);
    expect(list('- onion|', 'bullet')).toEqual(['onion|', 'remove']);
    expect(list('|', 'check')).toEqual(['- [ ] |', 'add']);
  });

  it('applies to every line the selection touches, skipping blank ones', () => {
    expect(list('Groceries\n|onion\n\nleek|\nrice', 'check')).toEqual(['Groceries\n- [ ] |onion\n\n- [ ] leek|\nrice', 'add']);
  });

  it("doesn't touch the line a selection ends at the start of", () => {
    expect(list('|onion\n|leek', 'bullet')).toEqual(['- |onion\n|leek', 'add']);
  });

  it('removes the prefix only when every line has it', () => {
    expect(list('|- onion\nleek|', 'bullet')).toEqual(['- |onion\n- leek|', 'add']);
    expect(list('|- onion\n- leek|', 'bullet')).toEqual(['|onion\nleek|', 'remove']);
  });

  it('swaps another list prefix for this one', () => {
    expect(list('|- onion\n1. leek\n- [x] rice|', 'number')).toEqual(['1. |onion\n2. leek\n3. rice|', 'add']);
    expect(list('|1. onion\n2. leek|', 'check')).toEqual(['- [ ] |onion\n- [ ] leek|', 'add']);
  });

  it('renumbers the numbered run it joins', () => {
    expect(list('1. Feed\n|Leave|\n2. Fridge', 'number')).toEqual(['1. Feed\n2. |Leave|\n3. Fridge', 'add']);
    expect(list('1. Feed\n2. |Leave|\n3. Fridge', 'number')).toEqual(['1. Feed\n|Leave|\n1. Fridge', 'remove']);
  });

  it('keeps a caret inside the old prefix just after the new one', () => {
    expect(list('-| onion', 'number')).toEqual(['1. |onion', 'add']);
  });
});

describe('continueList (Enter)', () => {
  /** Types Enter at the caret in `s`. */
  const enter = (s: string) => {
    const { text, sel } = marked(s);
    const next = text.slice(0, sel.start) + '\n' + text.slice(sel.end);
    const r = continueList(text, next, sel);
    return r ? show(r) : null;
  };

  it('goes on with each kind of list', () => {
    expect(enter('- onion|')).toBe('- onion\n- |');
    expect(enter('* onion|')).toBe('* onion\n* |');
    expect(enter('- [x] onion|')).toBe('- [x] onion\n- [ ] |');
    expect(enter('1. Feed|')).toBe('1. Feed\n2. |');
  });

  it('goes on in the middle of a list and renumbers what follows', () => {
    expect(enter('1. Feed|\n2. Fridge')).toBe('1. Feed\n2. |\n3. Fridge');
    expect(enter('- onion|\n- leek')).toBe('- onion\n- |\n- leek');
  });

  it('ends the list on an empty item', () => {
    expect(enter('- onion\n- |')).toBe('- onion\n|');
    expect(enter('1. Feed\n2. |')).toBe('1. Feed\n|');
    expect(enter('- [ ] onion\n- [ ] |')).toBe('- [ ] onion\n|');
  });

  it('leaves Enter alone outside a list or inside a prefix', () => {
    expect(enter('Groceries|')).toBeNull();
    expect(enter('-| onion')).toBeNull();
  });

  it('works when the platform moved the caret before the text changed', () => {
    const text = '- onion';
    expect(continueList(text, '- onion\n', at(8))).toEqual({ text: '- onion\n- ', selection: at(10) });
  });

  it("ignores changes that aren't one Enter", () => {
    expect(continueList('- onion', '- onions', at(7))).toBeNull();
    expect(continueList('- onion', '- onion\n\n', at(7))).toBeNull();
  });
});

describe('insertLink', () => {
  it('replaces the selection with a link the drawer reads back', () => {
    const r = insertLink('Use bread flour', at(4, 15), { label: 'bread flour', url: 'https://example.com/flour' });
    expect(r.text).toBe('Use [bread flour](https://example.com/flour)');
    expect(r.selection).toEqual(at(r.text.length));
    expect(parseNotes(r.text)[0]?.kind).toBe('paragraph');
  });

  it('puts the address on its own with no text', () => {
    expect(insertLink('See ', at(4), { label: ' ', url: 'https://example.com' }).text).toBe('See https://example.com');
  });

  it('keeps brackets out of the text and escapes the address', () => {
    expect(insertLink('', at(0), { label: 'a [b]', url: 'https://x.com/a b)' }).text).toBe('[a b](https://x.com/a%20b%29)');
  });
});

describe('normalizeLinkInput', () => {
  it('adds https:// to an address with no scheme', () => {
    expect(normalizeLinkInput(' example.com ')).toBe('https://example.com');
    expect(normalizeLinkInput('example.com:8080/a')).toBe('https://example.com:8080/a');
  });

  it('keeps web and email addresses, and makes a bare email a mailto', () => {
    expect(normalizeLinkInput('http://example.com')).toBe('http://example.com');
    expect(normalizeLinkInput('mailto:ana@example.com')).toBe('mailto:ana@example.com');
    expect(normalizeLinkInput('ana@example.com')).toBe('mailto:ana@example.com');
  });

  it('refuses anything else', () => {
    expect(normalizeLinkInput('')).toBeNull();
    expect(normalizeLinkInput('hello')).toBeNull();
    expect(normalizeLinkInput('hello world.com')).toBeNull();
    expect(normalizeLinkInput('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkInput('https://')).toBeNull();
  });
});

describe('activeFormats', () => {
  it('shows bold inside bold text and the list of the caret line', () => {
    expect(activeFormats('Buy **onion** today', at(8))).toMatchObject({ bold: true });
    expect(activeFormats('Buy **onion** today', at(15))).toMatchObject({ bold: false });
    expect(activeFormats('1. Feed\n- [ ] onion', at(12))).toEqual({ bold: false, bullet: false, number: false, check: true });
    expect(activeFormats('1. Feed', at(5))).toMatchObject({ number: true });
  });
});
