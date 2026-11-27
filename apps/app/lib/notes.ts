// Event and reminder notes with basic formatting (spec 073). Notes stay plain text in the
// database; this reads a small markdown subset into NoteText's blocks. No library, no HTML:
// anything it doesn't know (code, quotes) stays as typed.
import type { NoteAlign, NoteBlock, NoteSpan } from '@cocon/ui';

export type NoteLinkScheme = 'http' | 'https' | 'mailto';

const WEB = /^(https?):\/\/[^\s/?#@]+\S*$/i;
const MAIL = /^mailto:[^\s@]+@[^\s@]+$/i;

/** The link if it's a web or email address (FR-004), anything else (`javascript:`…) null. */
export function safeUrl(raw: string): string | null {
  const url = raw.trim();
  return WEB.test(url) || MAIL.test(url) ? url : null;
}

/** For `note_link_opened`: the scheme only, never the address. */
export function linkScheme(url: string): NoteLinkScheme {
  const s = url.slice(0, url.indexOf(':')).toLowerCase();
  return s === 'http' || s === 'mailto' ? s : 'https';
}

const CHECK = /^\s*[-*] \[([ xX])\](?: (.*))?$/;
const BULLET = /^\s*[-*] (.*)$/;
const NUMBER = /^\s*\d+\. (.*)$/;
const HEADING = /^\s*#{1,6} (.*)$/;
const FENCE = /^\s*```/;
const TABLE = /^\s*\|/;
// A table's second line, trimmed first: | --- | :-: | --: |
const SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
// Bigger tables show as typed: a few characters of pipes would otherwise draw a million cells.
const MAX_COLUMNS = 12;
const MAX_CELLS = 600;

const ITALIC_STAR = /\*(?![\s*])([^*\n]*?[^\s*])\*(?!\*)/y;
const ITALIC_UNDER = /_(?![\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/uy;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/y;
const BARE = /https?:\/\/[^\s<>[\]]+/iy;
const WORD = /[\p{L}\p{N}_]/u;

const text = (t: string): NoteSpan => ({ kind: 'text', text: t });

/** Bold, italic and links in a paragraph or item; unclosed markers stay as typed. */
function inline(s: string, inLink = false): NoteSpan[] {
  const out: NoteSpan[] = [];
  let plain = '';
  const push = (span: NoteSpan) => {
    if (plain) out.push(text(plain));
    plain = '';
    out.push(span);
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '*' && s[i + 1] === '*') {
      const end = s.indexOf('**', i + 2);
      if (end > i + 2 && s.slice(i + 2, end).trim() !== '') {
        push({ kind: 'bold', children: inline(s.slice(i + 2, end), inLink) });
        i = end + 2;
        continue;
      }
      plain += '**';
      i += 2;
      continue;
    }
    if (c === '*' || (c === '_' && !WORD.test(s[i - 1] ?? ''))) {
      const re = c === '*' ? ITALIC_STAR : ITALIC_UNDER;
      re.lastIndex = i;
      const m = re.exec(s);
      if (m) {
        push({ kind: 'italic', children: inline(m[1] ?? '', inLink) });
        i = re.lastIndex;
        continue;
      }
    }
    if (c === '[' && !inLink) {
      LINK.lastIndex = i;
      const m = LINK.exec(s);
      if (m) {
        const url = safeUrl(m[2] ?? '');
        if (url) push({ kind: 'link', url, children: inline(m[1] ?? '', true) });
        else plain += m[0];
        i = LINK.lastIndex;
        continue;
      }
    }
    if ((c === 'h' || c === 'H') && !inLink && !WORD.test(s[i - 1] ?? '')) {
      BARE.lastIndex = i;
      const m = BARE.exec(s);
      if (m) {
        const raw = m[0].replace(/[.,;:!?)"']+$/, '');
        const url = safeUrl(raw);
        if (url) {
          push({ kind: 'link', url, children: [text(raw)] });
          i += raw.length;
          continue;
        }
      }
    }
    plain += c;
    i += 1;
  }
  if (plain) out.push(text(plain));
  return out;
}

/** A table row's cells: outer pipes dropped, `\\|` kept as a pipe inside a cell. */
function cells(line: string): string[] {
  const row = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return row.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

const align = (sep: string): NoteAlign => (sep.endsWith(':') ? (sep.startsWith(':') ? 'center' : 'right') : 'left');

/**
 * A table starting at line i: a header row, a separator with as many columns, then the rows that
 * start with a pipe (cut or padded to the header's columns). Null when it isn't one, or is over
 * MAX_COLUMNS or MAX_CELLS: it shows as typed.
 */
function table(lines: readonly string[], i: number): { block: NoteBlock; end: number } | null {
  const sep = (lines[i + 1] ?? '').trim();
  if (!sep.includes('|') || !SEPARATOR.test(sep)) return null;
  const header = cells(lines[i] ?? '');
  const aligns = cells(sep).map(align);
  if (aligns.length !== header.length || header.length > MAX_COLUMNS) return null;
  const rows: NoteSpan[][][] = [];
  let end = i + 1;
  while (TABLE.test(lines[end + 1] ?? '')) {
    end += 1;
    if ((rows.length + 2) * header.length > MAX_CELLS) return null;
    const row = cells(lines[end] ?? '');
    rows.push(header.map((_, c) => inline(row[c] ?? '')));
  }
  return { block: { kind: 'table', align: aligns, header: header.map((c) => inline(c)), rows }, end };
}

function parse(notes: string): NoteBlock[] {
  const lines = notes.split(/\r?\n/);
  const blocks: NoteBlock[] = [];
  let para: string[] = [];
  // Raw paragraphs (code, tables) show exactly as typed.
  let raw = false;
  let n = 0;
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', spans: raw ? [text(para.join('\n'))] : inline(para.join('\n')) });
    para = [];
    raw = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (FENCE.test(line)) {
      flush();
      const end = lines.findIndex((l, j) => j > i && FENCE.test(l));
      const last = end === -1 ? lines.length - 1 : end;
      para = lines.slice(i, last + 1);
      raw = true;
      flush();
      i = last;
      n = 0;
      continue;
    }
    const t = TABLE.test(line) ? table(lines, i) : null;
    if (t) {
      flush();
      blocks.push(t.block);
      i = t.end;
      n = 0;
      continue;
    }
    // Pipe lines with no separator under them stay as typed.
    if (TABLE.test(line)) {
      if (!raw) flush();
      raw = true;
      para.push(line);
      n = 0;
      continue;
    }
    if (raw) flush();
    // A blank line between numbered items keeps counting ("1. a", "", "2. b").
    if (line.trim() === '') {
      flush();
      continue;
    }
    const check = CHECK.exec(line);
    const number = check ? null : NUMBER.exec(line);
    const bullet = check || number ? null : BULLET.exec(line);
    const heading = check || number || bullet ? null : HEADING.exec(line);
    if (check || number || bullet || heading) flush();
    if (check) blocks.push({ kind: 'check', done: check[1] !== ' ', line: i, spans: inline(check[2] ?? '') });
    else if (number) blocks.push({ kind: 'number', n: ++n, spans: inline(number[1] ?? '') });
    else if (bullet) blocks.push({ kind: 'bullet', spans: inline(bullet[1] ?? '') });
    else if (heading) blocks.push({ kind: 'boldLine', spans: inline(heading[1] ?? '') });
    else para.push(line);
    if (!number) n = 0;
  }
  flush();
  return blocks;
}

/**
 * The note as NoteText's blocks (FR-002, FR-003). Never throws: on any internal error the whole
 * note is one plain paragraph and `failed` says so (for `note_parse_failed`, no note text).
 */
export function readNotes(notes: string | null | undefined): { blocks: NoteBlock[]; failed: boolean } {
  if (!notes || notes.trim() === '') return { blocks: [], failed: false };
  try {
    return { blocks: parse(notes), failed: false };
  } catch {
    return { blocks: [{ kind: 'paragraph', spans: [text(notes)] }], failed: true };
  }
}

export const parseNotes = (notes: string | null | undefined): NoteBlock[] => readNotes(notes).blocks;

function spanText(spans: readonly NoteSpan[]): string {
  return spans.map((s) => (s.kind === 'text' ? s.text : spanText(s.children))).join('');
}

/** The note with every marker gone, for one-line previews (FR-005): a table's cells joined by " · ". */
export function notesToPlainText(notes: string | null | undefined): string {
  return parseNotes(notes)
    .map((b) => (b.kind === 'table' ? [b.header, ...b.rows].map((r) => r.map(spanText).join(' · ')).join('\n') : spanText(b.spans)))
    .join('\n');
}

export interface NoteFormats {
  has_bold: boolean;
  has_link: boolean;
  has_list: boolean;
  has_checklist: boolean;
  has_table: boolean;
}

/** What `note_viewed_formatted` reports; null when the note has no formatting at all. */
export function noteFormats(blocks: readonly NoteBlock[]): NoteFormats | null {
  const kinds = new Set<string>();
  const walk = (spans: readonly NoteSpan[]) =>
    spans.forEach((s) => {
      kinds.add(s.kind);
      if (s.kind !== 'text') walk(s.children);
    });
  for (const b of blocks) {
    kinds.add(b.kind);
    if (b.kind === 'table') [b.header, ...b.rows].forEach((r) => r.forEach(walk));
    else walk(b.spans);
  }
  const f = {
    has_bold: kinds.has('bold') || kinds.has('boldLine'),
    has_link: kinds.has('link'),
    has_list: kinds.has('bullet') || kinds.has('number'),
    has_checklist: kinds.has('check'),
    has_table: kinds.has('table'),
  };
  return f.has_bold || f.has_link || f.has_list || f.has_checklist || f.has_table || kinds.has('italic') ? f : null;
}

/** Opens a note's link in the system browser; if it can't, the caller's toast says so (FR-004). */
export async function openNoteLink(url: string, on: { openUrl: (url: string) => unknown; failed: () => void }): Promise<void> {
  try {
    await on.openUrl(url);
  } catch {
    on.failed();
  }
}
