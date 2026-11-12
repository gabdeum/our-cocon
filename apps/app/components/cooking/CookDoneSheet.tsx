import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { announce, BottomSheet, Button, IconTile, Link, Text } from '@cocon/ui';
import { strings } from '../../strings/en';

const d = strings.cookDone;

export interface CookDoneSheetProps {
  /** Null: closed. */
  done: { recipeName: string; member: string; times: number; step: number } | null;
  /** Back in progress at the same step; false when it couldn't save. */
  onUndo: () => Promise<boolean>;
  /** "Mark as done" after Undo. */
  onMarkDone: () => Promise<boolean>;
  /** "Back to the recipe", the scrim or a swipe. */
  onClose: () => void;
}

/** OC-CookDone (spec 051 FR-005): the cook is logged; Undo puts it back in progress. */
export function CookDoneSheet({ done, onUndo, onMarkDone, onClose }: CookDoneSheetProps) {
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = done ? (undone ? d.undoneTitle : d.title(done.recipeName)) : '';
  const body = done ? (undone ? d.undoneBody(done.step) : d.body(done.member, done.times)) : '';
  // The sheet is a status: what it says is read out when it opens and after Undo or Mark as done.
  useEffect(() => {
    if (title) announce(`${title} ${body}`);
  }, [title, body]);
  if (!done) return null;
  const toggle = async () => {
    setBusy(true);
    const saved = await (undone ? onMarkDone() : onUndo());
    setBusy(false);
    setFailed(!saved);
    if (saved) setUndone(!undone);
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={title}
      lead={body}
      hero={<IconTile icon="check" tone="sage" size="xl" className="mt-8" />}
      closeLabel={d.close}
      footer={<Button label={d.back} variant="ink" block onPress={onClose} />}
    >
      <View role="status" className="items-center gap-8">
        <Link label={undone ? d.markDone : d.undo} size={15} weight="900" tone="ink" underline disabled={busy} className="self-center" onPress={() => void toggle()} />
        {failed ? (
          <Text size={14} weight="700" color="warn" align="center">
            {d.failed}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
