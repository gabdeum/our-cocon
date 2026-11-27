// The notes field's text and selection, and the toolbar's and Enter's edits on them (spec 074).
import { useRef, useState } from 'react';
import { Platform, type TextInputInstance, type TextInputKeyPressEvent, type TextInputSelectionChangeEvent } from 'react-native';
import { NOTES_MAX } from '@cocon/schemas';
import { activeFormats, continueList, toggleBold, toggleList, type NoteEdit, type NoteFormat, type Selection } from './note-editing';

export interface NoteEditingOptions {
  value: string;
  onChange: (value: string) => void;
  /** A toolbar change was made: `note_format_applied`. */
  onApplied?: (format: NoteFormat, action: 'add' | 'remove') => void;
}

type Change = { text: string; selection: Selection };

/** The changed part of the text: what `insertText` replaces, so the browser's undo takes it back. */
function changedRange(prev: string, next: string) {
  let from = 0;
  while (from < prev.length && from < next.length && prev[from] === next[from]) from += 1;
  let tail = 0;
  while (tail < prev.length - from && tail < next.length - from && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
  return { from, to: prev.length - tail, put: next.slice(from, next.length - tail) };
}

/**
 * FR-001: holds the notes input's selection and makes the toolbar's changes (FR-003–FR-005) and
 * Enter's (FR-006). A change past NOTES_MAX isn't made: `tooLong` says so until the next edit.
 */
export function useNoteEditing({ value, onChange, onApplied }: NoteEditingOptions) {
  const inputRef = useRef<TextInputInstance>(null);
  const [selection, setSelection] = useState<Selection>({ start: value.length, end: value.length });
  // Set only after a change of ours, so the caret lands where it should; typing moves it freely.
  const [forced, setForced] = useState<Selection | undefined>(undefined);
  const [tooLong, setTooLong] = useState(false);
  const writing = useRef(false);

  const place = (sel: Selection) => {
    setSelection(sel);
    setForced(sel);
  };

  /**
   * FR-008: on the web the change goes in through the textarea's own editing (`insertText`), so the
   * browser's undo takes it back; elsewhere, or if the browser refuses, the value is set.
   */
  const write = (change: Change) => {
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (Platform.OS === 'web' && el && typeof el.setSelectionRange === 'function' && typeof document.execCommand === 'function') {
      const { from, to, put } = changedRange(value, change.text);
      el.focus();
      el.setSelectionRange(from, to);
      writing.current = true;
      let ok: boolean;
      try {
        ok = put ? document.execCommand('insertText', false, put) : document.execCommand('delete');
      } catch {
        ok = false;
      } finally {
        writing.current = false;
      }
      if (ok && el.value === change.text) {
        el.setSelectionRange(change.selection.start, change.selection.end);
        place(change.selection);
        return;
      }
    }
    onChange(change.text);
    place(change.selection);
  };

  const apply = (edit: NoteEdit) => {
    if (edit.text.length > NOTES_MAX) {
      setTooLong(true);
      return;
    }
    setTooLong(false);
    write(edit);
    onApplied?.(edit.format, edit.action);
  };

  const format = (f: Exclude<NoteFormat, 'link'>) => apply(f === 'bold' ? toggleBold(value, selection) : toggleList(value, selection, f));

  const onChangeText = (next: string) => {
    if (writing.current) {
      onChange(next);
      return;
    }
    setTooLong(false);
    const listed = continueList(value, next, selection);
    if (listed && listed.text.length <= NOTES_MAX) {
      onChange(listed.text);
      place(listed.selection);
    } else onChange(next);
  };

  // The web catches Enter before it types, so going on with a list is one step for its undo.
  const onKeyPress = (e: TextInputKeyPressEvent & { shiftKey?: boolean }) => {
    // Not while an input method is composing (Enter picks its word).
    if (Platform.OS !== 'web' || e.nativeEvent.key !== 'Enter' || e.shiftKey || (e.nativeEvent as { isComposing?: boolean }).isComposing) return;
    const typed = value.slice(0, selection.start) + '\n' + value.slice(selection.end);
    const listed = continueList(value, typed, selection);
    if (!listed || listed.text.length > NOTES_MAX) return;
    e.preventDefault();
    setTooLong(false);
    write(listed);
  };

  const onSelectionChange = (e: TextInputSelectionChangeEvent) => {
    setSelection(e.nativeEvent.selection);
    setForced(undefined);
  };

  return {
    inputRef,
    selection,
    active: activeFormats(value, selection),
    tooLong,
    format,
    apply,
    inputProps: { value, onChangeText, onKeyPress, onSelectionChange, selection: forced },
  };
}
