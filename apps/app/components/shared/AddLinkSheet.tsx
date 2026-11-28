import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, TextField } from '@cocon/ui';
import { normalizeLinkInput } from '../../lib/note-editing';
import { strings } from '../../strings';

const s = strings.notes.linkSheet;

export interface AddLinkSheetProps {
  /** The selected text, for Text. */
  initialText: string;
  /** The text and the address as the drawer will open it (`https://` added when it had no scheme). */
  onAdd: (link: { label: string; url: string }) => void;
  onClose: () => void;
}

/**
 * "Add a link" (OC-NoteEditor, spec 074 FR-004): Text, pre-filled with the selection, and Link,
 * focused first when Text already has something. Add link waits for a web or email address.
 * Mounted while open (as the sheets' date pickers), so each opening starts from the selection.
 */
export function AddLinkSheet({ initialText, onAdd, onClose }: AddLinkSheetProps) {
  const [label, setLabel] = useState(initialText);
  const [url, setUrl] = useState('');
  const link = normalizeLinkInput(url);
  const invalid = url.trim() !== '' && !link;
  const add = () => {
    if (link) onAdd({ label, url: link });
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={s.title}
      closeLabel={s.close}
      fieldFocus
      footer={
        <View className="flex-row gap-8">
          <Button label={s.cancel} variant="soft" onPress={onClose} className="flex-1" />
          <Button label={s.add} variant="olive" disabled={!link} onPress={add} className="flex-1" />
        </View>
      }
    >
      <View className="gap-14">
        <TextField label={s.text} value={label} onChangeText={setLabel} autoFocus={!initialText.trim()} returnKeyType="next" />
        <TextField
          label={s.link}
          value={url}
          onChangeText={setUrl}
          placeholder={s.placeholder}
          keyboardType="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="url"
          autoFocus={!!initialText.trim()}
          warning={invalid ? s.invalid : undefined}
          returnKeyType="done"
          onSubmitEditing={add}
        />
      </View>
    </BottomSheet>
  );
}
