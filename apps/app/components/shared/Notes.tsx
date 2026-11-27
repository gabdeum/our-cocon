import { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';
import type { Tracker } from '@cocon/schemas';
import { NoteText } from '@cocon/ui';
import { useNoteChecklist, type NoteChecklistSave } from '../../lib/note-checklist';
import { linkScheme, noteFormats, openNoteLink, readNotes } from '../../lib/notes';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';

export interface NotesProps {
  notes: string;
  entity: 'event' | 'reminder';
  /** The event or reminder: `note_viewed_formatted` goes once per one opened. */
  itemId: string;
  tracker: Tracker;
  /** Opens a link in the system browser (react-native-web: a new tab, `noopener`). */
  openUrl?: (url: string) => unknown;
  /** Spec 075: how ticking a checklist item saves the note. Left out: the items only show. */
  checklist?: NoteChecklistSave;
}

/**
 * Spec 073: an event's or reminder's notes with their formatting (design/ui/note-formatting-ui.md).
 * Notes stay plain text; links open outside the app, and say so when they can't. Checklist items
 * tick in place when the screen says how to save (spec 075).
 */
export function Notes({ notes, entity, itemId, tracker, openUrl = (url) => Linking.openURL(url), checklist }: NotesProps) {
  const toast = useToast();
  const ticking = useNoteChecklist(notes, entity, tracker, checklist);
  const { blocks, failed } = useMemo(() => readNotes(ticking.shown), [ticking.shown]);

  useEffect(() => {
    if (failed) tracker.track('note_parse_failed', { entity });
    const formats = noteFormats(blocks);
    if (formats) tracker.track('note_viewed_formatted', { entity, ...formats });
    // Once per opened event or reminder, not on every edit of its notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const open = (url: string) => {
    tracker.track('note_link_opened', { entity, scheme: linkScheme(url) });
    void openNoteLink(url, { openUrl, failed: () => toast.show({ text: strings.notes.linkFailed, tone: 'warn' }) });
  };
  return <NoteText blocks={blocks} onOpenLink={open} onToggleCheck={checklist ? ticking.toggle : undefined} checksDisabled={ticking.disabled} />;
}
