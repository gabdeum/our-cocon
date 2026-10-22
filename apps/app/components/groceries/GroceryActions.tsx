import { useState } from 'react';
import { BottomSheet, ListGroup, ListRow, SheetFooter, TextField } from '@cocon/ui';
import { AISLE_ORDER, type Aisle } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { editText, type GroceryItem } from '../../lib/groceries';

const g = strings.groceries;

export type ActionView = 'menu' | 'move' | 'edit';

export interface GroceryActionsProps {
  /** The row whose menu is open, or null when closed. */
  item: GroceryItem | null;
  view: ActionView;
  onView: (view: ActionView) => void;
  onClose: () => void;
  onRemove: (item: GroceryItem) => void;
  onMove: (item: GroceryItem, aisle: Aisle) => void;
  /** Resolves false when the text has no name, so the sheet stays open. */
  onEdit: (item: GroceryItem, text: string) => Promise<boolean>;
}

/**
 * FR-006 and OC-Groceries › Interactions: a row's menu (long-press, swipe left or the screen
 * reader's actions). "Edit" reads the text again; "Move to…" lists the aisles and is remembered for
 * the family; "Remove" takes it off the list, with Undo on the screen.
 */
export function GroceryActions({ item, view, onView, onClose, onRemove, onMove, onEdit }: GroceryActionsProps) {
  if (!item) return null;

  if (view === 'move') {
    const current = item.aisle ?? 'other';
    return (
      <BottomSheet visible onClose={onClose} title={g.moveTo} lead={g.moveLead(item.name)} closeLabel={g.close}>
        <ListGroup>
          {AISLE_ORDER.map((aisle, i) => (
            <ListRow
              key={aisle}
              title={strings.aisles[aisle]}
              leading={{ kind: 'radio', checked: aisle === current }}
              onPress={() => onMove(item, aisle)}
              last={i === AISLE_ORDER.length - 1}
            />
          ))}
        </ListGroup>
      </BottomSheet>
    );
  }

  if (view === 'edit') return <EditSheet key={item.id} item={item} onClose={onClose} onEdit={onEdit} />;

  return (
    <BottomSheet visible onClose={onClose} title={item.name} closeLabel={g.close}>
      <ListGroup>
        <ListRow title={g.edit} trailing={{ kind: 'chevron' }} onPress={() => onView('edit')} />
        <ListRow title={g.moveTo} trailing={{ kind: 'chevron', text: strings.aisles[item.aisle ?? 'other'] }} onPress={() => onView('move')} />
        <ListRow title={g.remove} onPress={() => onRemove(item)} last />
      </ListGroup>
    </BottomSheet>
  );
}

/** Edit: the amount and name as one line, read again on Save ("2 lemons"). */
function EditSheet({ item, onClose, onEdit }: Pick<GroceryActionsProps, 'onClose' | 'onEdit'> & { item: GroceryItem }) {
  const [text, setText] = useState(() => editText(item));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onEdit(item, text);
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={g.editTitle}
      closeLabel={g.close}
      dirty={text !== editText(item)}
      footer={<SheetFooter cancel={{ label: g.cancel, onPress: onClose }} primary={{ label: g.save, onPress: () => void save(), disabled: !text.trim(), busy: saving }} />}
    >
      <TextField label={g.editLabel} hint={g.editHint} value={text} onChangeText={setText} onSubmitEditing={() => void save()} autoFocus maxLength={200} />
    </BottomSheet>
  );
}
