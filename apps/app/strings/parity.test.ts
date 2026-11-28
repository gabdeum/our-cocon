import { describe, expect, it } from 'vitest';
import { strings as en } from './en';
import { getLanguage, languages, setLanguage, strings, stringsFor } from './index';

// Spec 076 FR-004: every language has the keys, arrays and function arguments of en.ts, every
// function gives text, and nothing is left in English by mistake.

type Node = unknown;
const isTree = (v: Node): v is Record<string, Node> => typeof v === 'object' && v !== null;

/** Every leaf, by its path ("menu.title", "calendar.months.0"). */
function leaves(node: Node, path = ''): [string, Node][] {
  if (!isTree(node)) return [[path, node]];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

/** Calls `fn` with the first set of sample arguments it accepts (numbers, text, lists of names). */
function call(fn: (...a: unknown[]) => unknown): [unknown, unknown[]] {
  const shapes = [[2, ['James', 'Lou'], 'Eva', 1], ['Eva'], [['James', 'Lou']], [2], [null]];
  for (const shape of shapes) {
    const args = Array.from({ length: fn.length }, (_, i) => shape[i % shape.length]);
    try {
      return [fn(...args), args];
    } catch {
      // Not this shape; try the next.
    }
  }
  throw new Error('No sample arguments fit');
}

/** Words spelled the same in French or Spanish. */
const SAME_EVERYWHERE = new Set([
  'Our Cocon', 'English', 'Français', 'Español', 'Claude', 'ChatGPT', 'Gemini', 'Menu', 'Notes', 'Pause', 'Agenda', 'Apps', 'Assistants', 'Color', 'Cuisine', 'Imperial', 'Imperial · oz, °F', 'Instructions', 'Message',
  'Notifications', 'Photo', 'Rose', 'Social', 'Source', 'Sport', 'Suggestions', 'Surprise', 'Type', 'Version', 'Volume',
]);
/** No word to translate: symbols, joins, "8 min". */
const wordless = (v: string) => !/\p{L}{4,}/u.test(v.replace(/https?/g, ''));

const enLeaves = leaves(en);

describe.each(languages.filter((l) => l !== 'en'))('%s', (language) => {
  const other = stringsFor(language);
  const otherLeaves = new Map(leaves(other));

  it('has every key of en.ts, and no other', () => {
    expect([...otherLeaves.keys()].sort()).toEqual(enLeaves.map(([p]) => p).sort());
  });

  it('keeps the kind of every value and the arguments of every function', () => {
    for (const [path, value] of enLeaves) {
      const mine = otherLeaves.get(path);
      expect(typeof mine, path).toBe(typeof value);
      if (typeof value === 'function') expect((mine as () => void).length, path).toBe((value as () => void).length);
    }
  });

  it('gives text from every function where English does', () => {
    const english = new Map(enLeaves);
    for (const [path, value] of otherLeaves) {
      if (typeof value !== 'function') continue;
      const [out, args] = call(value as (...a: unknown[]) => unknown);
      const englishOut = ((...a: unknown[]) => {
        try {
          return (english.get(path) as (...b: unknown[]) => unknown)(...a);
        } catch {
          return '';
        }
      })(...args);
      if (typeof out === 'string' && typeof englishOut === 'string' && englishOut.trim()) expect(out.trim(), path).not.toBe('');
    }
  });

  it('leaves no English behind', () => {
    const same = enLeaves.filter(([path, value]) => typeof value === 'string' && !wordless(value) && !SAME_EVERYWHERE.has(value) && otherLeaves.get(path) === value);
    expect(same.map(([p, v]) => `${p}: ${String(v)}`)).toEqual([]);
  });
});

describe('setLanguage', () => {
  it('changes the words in place, so aliases taken before follow', () => {
    const menu = strings.menu;
    setLanguage('fr');
    expect(getLanguage()).toBe('fr');
    expect(menu.reminders).toBe(stringsFor('fr').menu.reminders);
    setLanguage('en');
    expect(menu.reminders).toBe(en.menu.reminders);
  });
});
