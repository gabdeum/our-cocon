// Spec 075: ticking a checklist item in a note from the event page or the reminder drawer. The
// tick shows at once, then the note is saved with the notes as they were seen as the lock (FR-002);
// if someone changed them since, the tick goes onto the latest notes when that line is still the
// same item, otherwise the latest notes show (FR-003).
import { useEffect, useRef, useState } from 'react';
import { checklistCounts, checklistItemAt, toggleChecklistLine } from '@cocon/schemas';
import type { Tracker } from '@cocon/schemas';
import { useToast } from './toast';
import { strings } from '../strings/en';

/** How a screen saves its notes; given to `Notes` as `checklist`. */
export interface NoteChecklistSave {
  /** Saves `to` only if the notes are still `from`. */
  save: (from: string, to: string) => Promise<'saved' | 'changed'>;
  /** The notes as they are now (null: gone, or no notes any more). */
  reload: () => Promise<string | null>;
  /** Offline: the items show but can't be ticked. */
  disabled?: boolean;
  /** After a save, so lists and other screens refetch. */
  onSaved?: () => void;
}

export type ToggleResult =
  | { kind: 'saved'; notes: string; checked: boolean }
  | { kind: 'changed'; notes: string | null }
  | { kind: 'failed' };

/**
 * Flips the item on `line` of `notes` and saves it. On a lock conflict, reloads: the same item
 * (same text) on that line gets the tick on the latest notes, saved once more, or counts as done
 * when someone already ticked it the same way; anything else is 'changed', with the latest notes.
 * Errors (offline, server) are 'failed': the caller undoes the tick.
 */
export async function toggleAndSave(notes: string, line: number, io: Pick<NoteChecklistSave, 'save' | 'reload'>): Promise<ToggleResult> {
  const item = checklistItemAt(notes, line);
  const to = toggleChecklistLine(notes, line);
  if (!item || to === null) return { kind: 'changed', notes };
  const checked = !item.done;
  try {
    if ((await io.save(notes, to)) === 'saved') return { kind: 'saved', notes: to, checked };
    const fresh = await io.reload();
    const now = fresh === null ? null : checklistItemAt(fresh, line);
    if (fresh === null || !now || now.label !== item.label) return { kind: 'changed', notes: fresh };
    if (now.done === checked) return { kind: 'saved', notes: fresh, checked };
    const again = toggleChecklistLine(fresh, line);
    if (again !== null && (await io.save(fresh, again)) === 'saved') return { kind: 'saved', notes: again, checked };
    return { kind: 'changed', notes: await io.reload() };
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * The notes to show and the tap handler. Taps save one at a time, each on the notes the one before
 * left; new notes from the screen (a refetch) replace what's shown once nothing is saving.
 */
export function useNoteChecklist(notes: string, entity: 'event' | 'reminder', tracker: Tracker, io: NoteChecklistSave | undefined) {
  const toast = useToast();
  const [shown, show] = useState(notes);
  const latest = useRef(notes);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saving = useRef(0);
  useEffect(() => {
    if (saving.current > 0) return;
    latest.current = notes;
    show(notes);
  }, [notes]);

  const toggle = (line: number) => {
    if (!io || io.disabled) return;
    show((s) => toggleChecklistLine(s, line) ?? s);
    saving.current += 1;
    queue.current = queue.current.then(async () => {
      const r = await toggleAndSave(latest.current, line, io);
      saving.current -= 1;
      if (r.kind === 'saved') {
        latest.current = r.notes;
        if (saving.current === 0) show(r.notes);
        const counts = checklistCounts(r.notes);
        tracker.track('note_checklist_toggled', { entity, checked: r.checked, items_total: counts.total, items_checked: counts.checked });
        io.onSaved?.();
        return;
      }
      if (r.kind === 'changed' && r.notes !== null) latest.current = r.notes;
      show(latest.current);
      toast.show({ text: r.kind === 'failed' ? strings.notes.saveFailed : strings.notes.changed, tone: 'warn' });
      if (r.kind === 'changed') io.onSaved?.();
    });
  };

  return { shown, toggle, disabled: !io || io.disabled };
}
