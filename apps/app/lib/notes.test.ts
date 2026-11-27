// Spec 073 FR-008: the notes parser, every supported form and what stays as typed.
import { describe, expect, it, vi } from 'vitest';
import { linkScheme, noteFormats, notesToPlainText, openNoteLink, parseNotes, readNotes, safeUrl } from './notes';

const t = (text: string) => ({ kind: 'text', text });

describe('parseNotes', () => {
  it('reads nothing from an empty note', () => {
    expect(parseNotes('')).toEqual([]);
    expect(parseNotes('  \n ')).toEqual([]);
    expect(parseNotes(null)).toEqual([]);
  });

  it('keeps single line breaks in a paragraph and splits at blank lines', () => {
    expect(parseNotes('Transfer before 18:00.\nReference: November\n\nThanks')).toEqual([
      { kind: 'paragraph', spans: [t('Transfer before 18:00.\nReference: November')] },
      { kind: 'paragraph', spans: [t('Thanks')] },
    ]);
  });

  it('reads Windows line breaks', () => {
    expect(parseNotes('- onion\r\n- leek')).toEqual([
      { kind: 'bullet', spans: [t('onion')] },
      { kind: 'bullet', spans: [t('leek')] },
    ]);
  });

  it('reads bold, italic and links inline', () => {
    expect(parseNotes('**40 nights**, *late* _check-in_ on [Airbnb](https://airbnb.com/help)')).toEqual([
      {
        kind: 'paragraph',
        spans: [
          { kind: 'bold', children: [t('40 nights')] },
          t(', '),
          { kind: 'italic', children: [t('late')] },
          t(' '),
          { kind: 'italic', children: [t('check-in')] },
          t(' on '),
          { kind: 'link', url: 'https://airbnb.com/help', children: [t('Airbnb')] },
        ],
      },
    ]);
  });

  it('makes bare web addresses links, leaving trailing punctuation out', () => {
    expect(parseNotes('See https://example.com/a?b=1. Or http://x.fr!')[0]).toEqual({
      kind: 'paragraph',
      spans: [t('See '), { kind: 'link', url: 'https://example.com/a?b=1', children: [t('https://example.com/a?b=1')] }, t('. Or '), { kind: 'link', url: 'http://x.fr', children: [t('http://x.fr')] }, t('!')],
    });
  });

  it('reads mailto links', () => {
    expect(parseNotes('[Write](mailto:eva@example.com)')[0]?.spans).toEqual([{ kind: 'link', url: 'mailto:eva@example.com', children: [t('Write')] }]);
  });

  it('nests bold inside a list item and a link inside bold', () => {
    expect(parseNotes('- Buy **[flour](https://shop.fr)** today')).toEqual([
      { kind: 'bullet', spans: [t('Buy '), { kind: 'bold', children: [{ kind: 'link', url: 'https://shop.fr', children: [t('flour')] }] }, t(' today')] },
    ]);
  });

  it('leaves unclosed markers as typed', () => {
    expect(parseNotes('**oops and *this and _that')).toEqual([{ kind: 'paragraph', spans: [t('**oops and *this and _that')] }]);
  });

  it('keeps underscores inside words', () => {
    expect(parseNotes('file_name_here')).toEqual([{ kind: 'paragraph', spans: [t('file_name_here')] }]);
  });

  it('shows unsafe links as plain text (SC-003)', () => {
    expect(parseNotes('[x](javascript:alert(1))')).toEqual([{ kind: 'paragraph', spans: [t('[x](javascript:alert(1))')] }]);
    expect(parseNotes('[x](example.com)')[0]?.spans).toEqual([t('[x](example.com)')]);
  });

  it('reads bulleted, numbered and checklist items, numbering by position', () => {
    expect(parseNotes('1. Feed the starter\n1. Mix\n\n7. Bake\n* Onions\n- [ ] Milk\n- [x] Eggs\n* [X] Leeks')).toEqual([
      { kind: 'number', n: 1, spans: [t('Feed the starter')] },
      { kind: 'number', n: 2, spans: [t('Mix')] },
      { kind: 'number', n: 3, spans: [t('Bake')] },
      { kind: 'bullet', spans: [t('Onions')] },
      { kind: 'check', done: false, line: 5, spans: [t('Milk')] },
      { kind: 'check', done: true, line: 6, spans: [t('Eggs')] },
      { kind: 'check', done: true, line: 7, spans: [t('Leeks')] },
    ]);
  });

  it('starts a new count after something else', () => {
    expect(parseNotes('1. a\nthen\n1. b').map((b) => (b.kind === 'number' ? b.n : b.kind))).toEqual([1, 'paragraph', 1]);
  });

  it('shows indented items as normal items', () => {
    expect(parseNotes('- a\n    - b')).toEqual([
      { kind: 'bullet', spans: [t('a')] },
      { kind: 'bullet', spans: [t('b')] },
    ]);
  });

  it('shows headings of any level as a bold line', () => {
    expect(parseNotes('# Steps\n###### Small')).toEqual([
      { kind: 'boldLine', spans: [t('Steps')] },
      { kind: 'boldLine', spans: [t('Small')] },
    ]);
  });

  it('shows tables and code blocks exactly as typed (SC-002)', () => {
    const table = '| Day | Who |\n|---|---|\n| Mon | **Eva** |';
    const code = '```\n- not a list\n**not bold**\n```';
    expect(parseNotes(`${table}\n${code}\nAfter`)).toEqual([
      { kind: 'paragraph', spans: [t(table)] },
      { kind: 'paragraph', spans: [t(code)] },
      { kind: 'paragraph', spans: [t('After')] },
    ]);
    expect(parseNotes('```\nnever closed\n- x')).toEqual([{ kind: 'paragraph', spans: [t('```\nnever closed\n- x')] }]);
  });

  it('reads a 5,000-character note', () => {
    const note = Array.from({ length: 200 }, (_, i) => `- [ ] **item** ${i} https://a.fr`).join('\n').padEnd(5000, '*');
    const blocks = parseNotes(note);
    expect(blocks.filter((b) => b.kind === 'check')).toHaveLength(200);
  });

  it('falls back to one plain paragraph and reports it on an internal error', () => {
    const split = vi.spyOn(String.prototype, 'split').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(readNotes('**a**')).toEqual({ blocks: [{ kind: 'paragraph', spans: [t('**a**')] }], failed: true });
    split.mockRestore();
    expect(readNotes('**a**').failed).toBe(false);
  });
});

describe('notesToPlainText (SC-005)', () => {
  it('strips every marker', () => {
    const plain = notesToPlainText('# Groceries\n- [ ] **Milk**\n1. [Shop](https://shop.fr)\n* _eggs_\nhttps://a.fr');
    expect(plain).toBe('Groceries\nMilk\nShop\neggs\nhttps://a.fr');
    expect(plain).not.toMatch(/\*\*|- \[ \]|\]\(/);
  });
});

describe('noteFormats', () => {
  it('says which formats a note uses', () => {
    expect(noteFormats(parseNotes('**a** [b](https://b.fr)\n- c\n- [ ] d'))).toEqual({ has_bold: true, has_link: true, has_list: true, has_checklist: true });
    expect(noteFormats(parseNotes('1. a'))).toEqual({ has_bold: false, has_link: false, has_list: true, has_checklist: false });
  });

  it('is null for a note without formatting', () => {
    expect(noteFormats(parseNotes('Just text\nover two lines'))).toBeNull();
  });
});

describe('links', () => {
  it('accepts only web and email addresses', () => {
    expect(safeUrl(' https://a.fr/x ')).toBe('https://a.fr/x');
    expect(safeUrl('mailto:a@b.fr')).toBe('mailto:a@b.fr');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc', 'ftp://a.fr', 'https://', 'a.fr']) expect(safeUrl(bad)).toBeNull();
  });

  it('names the scheme', () => {
    expect([linkScheme('http://a'), linkScheme('HTTPS://a'), linkScheme('mailto:a@b')]).toEqual(['http', 'https', 'mailto']);
  });

  it('tells the caller when a link cannot open', async () => {
    const failed = vi.fn();
    await openNoteLink('https://a.fr', { openUrl: () => Promise.reject(new Error('no')), failed });
    expect(failed).toHaveBeenCalledOnce();
    const opened = vi.fn();
    await openNoteLink('https://a.fr', { openUrl: opened, failed });
    expect(opened).toHaveBeenCalledWith('https://a.fr');
    expect(failed).toHaveBeenCalledOnce();
  });
});
