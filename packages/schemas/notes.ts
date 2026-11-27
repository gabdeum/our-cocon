// Checklist lines in event and reminder notes (spec 075): `- [ ] item` / `- [x] item`. Shared by
// the app (ticking in the drawers, the 073 parser) and `@cocon/data` (a split or a copy starts
// unticked), so the rule for what a checklist line is lives once.

/** A checklist line: indent and marker, the box's letter, then the item. `[X]` counts as ticked. */
export const CHECKLIST_LINE = /^(\s*[-*] \[)([ xX])\](?: (.*))?$/;

const LINE_BREAK = /\r?\n/;

/** The note's lines with each one's own break, so a note written on Windows keeps its `\r\n`. */
function lines(notes: string): { text: string; end: string }[] {
  const parts = notes.split(/(\r?\n)/);
  const out: { text: string; end: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ text: parts[i] ?? '', end: parts[i + 1] ?? '' });
  return out;
}

const join = (ls: readonly { text: string; end: string }[]) => ls.map((l) => l.text + l.end).join('');

/** The checklist item on that line (0-based, as the 073 parser counts), or null when it isn't one. */
export function checklistItemAt(notes: string, line: number): { done: boolean; label: string } | null {
  const m = CHECKLIST_LINE.exec(notes.split(LINE_BREAK)[line] ?? '');
  return m ? { done: m[2] !== ' ', label: m[3] ?? '' } : null;
}

/** The note with only that line's box flipped (FR-001); null when the line isn't a checklist item. */
export function toggleChecklistLine(notes: string, line: number): string | null {
  const ls = lines(notes);
  const l = ls[line];
  const m = l ? CHECKLIST_LINE.exec(l.text) : null;
  if (!l || !m) return null;
  l.text = l.text.replace(CHECKLIST_LINE, (_all, start: string, box: string, label?: string) =>
    `${start}${box === ' ' ? 'x' : ' '}]${label === undefined ? '' : ` ${label}`}`,
  );
  return join(ls);
}

/** Every box emptied: a split series or a copied event starts its checklist unticked (FR-008). */
export function untickChecklist(notes: string): string {
  const ls = lines(notes);
  for (const l of ls) {
    const m = CHECKLIST_LINE.exec(l.text);
    if (m && m[2] !== ' ') l.text = `${m[1]} ]${m[3] === undefined ? '' : ` ${m[3]}`}`;
  }
  return join(ls);
}

/** How many checklist items the note has and how many are ticked, for `note_checklist_toggled`. */
export function checklistCounts(notes: string): { total: number; checked: number } {
  let total = 0;
  let checked = 0;
  for (const l of notes.split(LINE_BREAK)) {
    const m = CHECKLIST_LINE.exec(l);
    if (!m) continue;
    total += 1;
    if (m[2] !== ' ') checked += 1;
  }
  return { total, checked };
}
