import { useEffect, useId, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, View } from 'react-native';
import { NOTES_MAX, type Tracker } from '@cocon/schemas';
import { FieldWarning, NoteFormattingToolbar, Text, TextField, type NoteToolbarFormat } from '@cocon/ui';
import { insertLink, type Selection } from '../../lib/note-editing';
import { useNoteEditing } from '../../lib/use-note-editing';
import { strings } from '../../strings';
import { AddLinkSheet } from './AddLinkSheet';

const n = strings.notes;
// After the link sheet has slid away, the notes field takes the keyboard back.
const REFOCUS_MS = Platform.OS === 'web' ? 0 : 350;

export interface NotesFieldProps {
  label: string;
  /** "(optional)" after the label. */
  optionalLabel?: string;
  placeholder: string;
  value: string;
  onChange: (notes: string) => void;
  entity: 'event' | 'reminder';
  tracker?: Tracker;
  autoFocus?: boolean;
}

/**
 * Spec 074: the event and reminder sheets' Notes, with the formatting toolbar (OC-NoteEditor). The
 * field stays plain text showing the markers. iPhone: the toolbar rides on the keyboard while this
 * field has focus. Web: it sits between the label and the field, always there.
 */
export function NotesField({ label, optionalLabel, placeholder, value, onChange, entity, tracker, autoFocus }: NotesFieldProps) {
  const accessoryId = `notes-toolbar-${useId().replace(/\W/g, '')}`;
  const ios = Platform.OS === 'ios';
  const { inputRef, inputProps, tooLong, active, selection, format, apply } = useNoteEditing({ value, onChange, onApplied: (format, action) => tracker?.track('note_format_applied', { entity, format, action }) });
  // Where the link goes: the selection when Link was tapped (the field loses it to the sheet).
  const [linkAt, setLinkAt] = useState<Selection | null>(null);
  const refocus = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refocus.current) clearTimeout(refocus.current);
  }, []);

  const closeLink = () => {
    setLinkAt(null);
    refocus.current = setTimeout(() => inputRef.current?.focus(), REFOCUS_MS);
  };
  const press = (f: NoteToolbarFormat) => (f === 'link' ? setLinkAt(selection) : format(f));
  const toolbar = (
    <NoteFormattingToolbar active={{ ...active, link: linkAt !== null }} onPress={press} onHideKeyboard={ios ? Keyboard.dismiss : undefined} labels={n.toolbar} />
  );

  return (
    <View className="gap-6">
      <Text size={15} weight="900" aria-hidden>
        {label}
        {optionalLabel ? (
          <Text size={15} weight="600" color="ink-muted">
            {' '}
            {optionalLabel}
          </Text>
        ) : null}
      </Text>
      {ios ? <InputAccessoryView nativeID={accessoryId}>{toolbar}</InputAccessoryView> : toolbar}
      <TextField
        ref={inputRef}
        label={label}
        labelHidden
        placeholder={placeholder}
        maxLength={NOTES_MAX}
        multiline
        autoFocus={autoFocus}
        inputAccessoryViewID={ios ? accessoryId : undefined}
        {...inputProps}
      />
      {tooLong ? <FieldWarning text={n.tooLong} /> : null}
      {linkAt ? (
        <AddLinkSheet
          initialText={value.slice(linkAt.start, linkAt.end)}
          onClose={closeLink}
          onAdd={(link) => {
            apply(insertLink(value, linkAt, link));
            closeLink();
          }}
        />
      ) : null}
    </View>
  );
}
