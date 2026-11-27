// The notes editor's toolbar and Enter (spec 074): pure edits on the plain text and its selection.
// The field shows the markers as typed; these only add, remove or move them.
import { safeUrl } from './notes';

export interface Selection {
  start: number;
  end: number;
}
export type NoteFormat = 'bold' | 'link' | 'bullet' | 'number' | 'check';
export type ListKind = 'bullet' | 'number' | 'check';
/** A toolbar change: the new text and selection, and what `note_format_applied` says. */
export interface NoteEdit {
  text: string;
  selection: Selection;
  format: NoteFormat;
  action: 'add' | 'remove';
}

// A list item's prefix, as the drawer reads it (lib/notes.ts): `- [ ] `, `- `, `1. `.
const PREFIX = /^(\s*)(?:([-*]) \[[ xX]\](?: |$)|([-*]) |(\d+)\. )/;

interface Prefix {
  kind: ListKind;
  length: number;
  /** `-` or `*`, kept when the list goes on. */
  marker: string;
  indent: string;
}

function prefixOf(line: string): Prefix | null {
  const m = PREFIX.exec(line);
  if (!m) return null;
  const indent = m[1] ?? '';
  const length = m[0].length;
  if (m[2]) return { kind: 'check', length, marker: m[2], indent };
  if (m[3]) return { kind: 'bullet', length, marker: m[3], indent };
  return { kind: 'number', length, marker: '', indent };
}

const newPrefix = (kind: ListKind, n: number, marker = '-') => (kind === 'bullet' ? `${marker} ` : kind === 'check' ? `${marker} [ ] ` : `${n}. `);

/** The line each position is on, and where each line starts. */
function linesOf(text: string) {
  const lines = text.split('\n');
  const starts: number[] = [];
  let at = 0;
  for (const l of lines) {
    starts.push(at);
    at += l.length + 1;
  }
  const lineAt = (p: number) => {
    let i = 0;
    while (i + 1 < starts.length && (starts[i + 1] ?? Infinity) <= p) i += 1;
    return i;
  };
  return { lines, starts, lineAt };
}

/**
 * Rewrites the prefixes of some lines (`prefixes[i]`: how many characters to drop and what to put
 * instead; absent = unchanged) and moves the selection with the text: a position inside a dropped
 * prefix lands just after the new one.
 */
function rewrite(text: string, sel: Selection, prefixes: Map<number, { drop: number; put: string }>): { text: string; selection: Selection } {
  const { lines, starts, lineAt } = linesOf(text);
  const newStarts: number[] = [];
  let at = 0;
  const out = lines.map((l, i) => {
    newStarts.push(at);
    const p = prefixes.get(i);
    const line = p ? p.put + l.slice(p.drop) : l;
    at += line.length + 1;
    return line;
  });
  const move = (pos: number) => {
    const i = lineAt(pos);
    const offset = pos - (starts[i] ?? 0);
    const p = prefixes.get(i);
    const start = newStarts[i] ?? 0;
    return p ? start + p.put.length + Math.max(offset - p.drop, 0) : start + offset;
  };
  return { text: out.join('\n'), selection: { start: move(sel.start), end: move(sel.end) } };
}

/** Numbers every numbered run touching lines first…last again from 1 (the drawer counts by position). */
function renumber(lines: readonly string[], prefixes: Map<number, { drop: number; put: string }>, first: number, last: number) {
  const kindAt = (i: number) => {
    const p = prefixes.get(i);
    const line = p ? p.put + (lines[i] ?? '').slice(p.drop) : (lines[i] ?? '');
    return prefixOf(line)?.kind;
  };
  let from = Math.max(first - 1, 0);
  while (from > 0 && kindAt(from - 1) === 'number') from -= 1;
  let n = 0;
  for (let i = from; i < lines.length && (i <= last + 1 || kindAt(i) === 'number'); i += 1) {
    if (kindAt(i) !== 'number') {
      n = 0;
      continue;
    }
    n += 1;
    const old = prefixOf(lines[i] ?? '');
    const p = prefixes.get(i);
    if (p) prefixes.set(i, { drop: p.drop, put: p.put.replace(/\d+/, String(n)) });
    else if (old) prefixes.set(i, { drop: old.length, put: `${old.indent}${n}. ` });
  }
}

/**
 * FR-005: Bulleted, Numbered or Checklist on every line the selection touches (the caret's line
 * with nothing selected). All already that kind: the prefixes go. Otherwise each line gets it, in
 * place of any other list prefix. Blank lines inside a selection stay blank.
 */
export function toggleList(text: string, sel: Selection, kind: ListKind): NoteEdit {
  const { lines, lineAt } = linesOf(text);
  const first = lineAt(sel.start);
  // A selection ending at the start of a line doesn't touch that line.
  let last = lineAt(sel.end);
  if (last > first && text[sel.end - 1] === '\n') last -= 1;
  const touched: number[] = [];
  for (let i = first; i <= last; i += 1) if (first === last || (lines[i] ?? '').trim() !== '') touched.push(i);
  const remove = touched.length > 0 && touched.every((i) => prefixOf(lines[i] ?? '')?.kind === kind);
  const prefixes = new Map<number, { drop: number; put: string }>();
  touched.forEach((i, k) => {
    const old = prefixOf(lines[i] ?? '');
    const drop = old?.length ?? 0;
    prefixes.set(i, { drop, put: remove ? '' : (old?.indent ?? '') + newPrefix(kind, k + 1) });
  });
  renumber(lines, prefixes, first, last);
  return { ...rewrite(text, sel, prefixes), format: kind, action: remove ? 'remove' : 'add' };
}

/**
 * FR-006: Enter on a list item goes on with the list (`- `, the next number, `- [ ] `); Enter on an
 * empty item drops its prefix and ends the list. `next` is the text after the change, `sel` the
 * selection before it. Null when it wasn't an Enter on a list item: the change stays as typed.
 */
export function continueList(prev: string, next: string, sel: Selection): { text: string; selection: Selection } | null {
  if (next.length !== prev.length - (sel.end - sel.start) + 1) return null;
  // Some platforms move the selection before the text changes: the caret may already be after the break.
  const at = [sel.start, sel.start - 1].find((s) => s >= 0 && s + sel.end - sel.start <= prev.length && next === prev.slice(0, s) + '\n' + prev.slice(s + sel.end - sel.start));
  if (at === undefined) return null;
  const lineStart = prev.lastIndexOf('\n', at - 1) + 1;
  const lineEnd = prev.indexOf('\n', at);
  const line = prev.slice(lineStart, lineEnd === -1 ? prev.length : lineEnd);
  const p = prefixOf(line);
  if (!p || at - lineStart < p.length) return null;
  if (line.slice(p.length).trim() === '') {
    // An empty item: it stops being one, and the caret stays on it.
    return { text: prev.slice(0, lineStart) + prev.slice(lineStart + line.length), selection: { start: lineStart, end: lineStart } };
  }
  const n = p.kind === 'number' ? Number(/\d+/.exec(line)?.[0] ?? 0) + 1 : 0;
  const put = p.indent + newPrefix(p.kind, n, p.marker);
  const caret = at + 1 + put.length;
  const typed = next.slice(0, at + 1) + put + next.slice(at + 1);
  if (p.kind !== 'number') return { text: typed, selection: { start: caret, end: caret } };
  const { lines, lineAt } = linesOf(typed);
  const prefixes = new Map<number, { drop: number; put: string }>();
  const here = lineAt(caret);
  renumber(lines, prefixes, here, here);
  return rewrite(typed, { start: caret, end: caret }, prefixes);
}

/** The `**…**` pair around position p on its line (`****` counts), as [open, close]. */
function boldAround(text: string, p: number): [number, number] | null {
  const lineStart = text.lastIndexOf('\n', p - 1) + 1;
  const end = text.indexOf('\n', p);
  const line = text.slice(lineStart, end === -1 ? text.length : end);
  let i = line.indexOf('**');
  while (i !== -1) {
    const close = line.indexOf('**', i + 2);
    if (close === -1) return null;
    if (p - lineStart >= i + 2 && p - lineStart <= close) return [lineStart + i, lineStart + close];
    i = line.indexOf('**', close + 2);
  }
  return null;
}

/**
 * FR-003: Bold wraps the selection in `**…**`, or takes the markers off when it's already wrapped
 * (markers selected or just outside). With nothing selected: inside bold text, that bold goes;
 * otherwise `****` with the caret in the middle.
 */
export function toggleBold(text: string, sel: Selection): NoteEdit {
  const { start: s, end: e } = sel;
  const done = (t: string, start: number, end: number, action: 'add' | 'remove'): NoteEdit => ({ text: t, selection: { start, end }, format: 'bold', action });
  if (s === e) {
    const pair = boldAround(text, s);
    if (pair) {
      const [open, close] = pair;
      return done(text.slice(0, open) + text.slice(open + 2, close) + text.slice(close + 2), s - 2, s - 2, 'remove');
    }
    return done(text.slice(0, s) + '****' + text.slice(s), s + 2, s + 2, 'add');
  }
  const picked = text.slice(s, e);
  if (picked.length >= 4 && picked.startsWith('**') && picked.endsWith('**')) {
    return done(text.slice(0, s) + picked.slice(2, -2) + text.slice(e), s, e - 4, 'remove');
  }
  if (text.slice(s - 2, s) === '**' && text.slice(e, e + 2) === '**' && s >= 2) {
    return done(text.slice(0, s - 2) + picked + text.slice(e + 2), s - 2, e - 2, 'remove');
  }
  // Spaces at either end stay outside the markers, or the drawer wouldn't read them as bold.
  const lead = picked.length - picked.trimStart().length;
  const inner = picked.trim();
  if (!inner) return done(text.slice(0, s) + '****' + text.slice(s), s + 2, s + 2, 'add');
  const from = s + lead;
  return done(text.slice(0, from) + `**${inner}**` + text.slice(from + inner.length), from + 2, from + 2 + inner.length, 'add');
}

/**
 * FR-004: `[text](url)` in place of the selection (or at the caret); no text, the address on its
 * own. Brackets leave the text and spaces and `)` are escaped in the address, so the drawer reads
 * it back as one link.
 */
export function insertLink(text: string, sel: Selection, link: { label: string; url: string }): NoteEdit {
  const label = link.label.replace(/[[\]\n\r]/g, '').trim();
  const url = link.url.replace(/\s/g, '%20').replace(/\)/g, '%29');
  const put = label ? `[${label}](${url})` : url;
  const caret = sel.start + put.length;
  return { text: text.slice(0, sel.start) + put + text.slice(sel.end), selection: { start: caret, end: caret }, format: 'link', action: 'add' };
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EMAIL = /^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/;
const HOST = /^[^\s/?#@]+\.[^\s/?#@]+/;

/**
 * The "Add a link" sheet's Link (FR-004): a web or email address as the drawer opens it, or null.
 * No scheme: an email address gets `mailto:`, anything that looks like a site `https://`.
 */
export function normalizeLinkInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (EMAIL.test(t)) return safeUrl(`mailto:${t}`);
  if (SCHEME.test(t) && !HOST.test(t)) return safeUrl(t);
  return HOST.test(t) ? safeUrl(`https://${t}`) : null;
}

/** FR-007: which toolbar buttons show as active for this selection. */
export function activeFormats(text: string, sel: Selection): { bold: boolean; bullet: boolean; number: boolean; check: boolean } {
  const pair = boldAround(text, sel.start);
  const bold = pair !== null && sel.end <= pair[1];
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  const end = text.indexOf('\n', sel.start);
  const kind = prefixOf(text.slice(lineStart, end === -1 ? text.length : end))?.kind;
  return { bold, bullet: kind === 'bullet', number: kind === 'number', check: kind === 'check' };
}
