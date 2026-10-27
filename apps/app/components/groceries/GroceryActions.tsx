import { useState } from 'react';
import { BottomSheet, Button, Link, ListGroup, ListRow, SheetFooter, TextField } from '@cocon/ui';
import { AISLE_ORDER, type Aisle, type UnitSystem } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { editText, type GroceryItem } from '../../lib/groceries';

const g = strings.groceries;

export type ActionView = 'menu' | 'move' | 'packs';

/** Spec 021 FR-004: the item's store size, when it's a catalog item with packs. */
export interface ItemPacks {
  /** The size the list buys first now ("20 cl"), shown after "Store size". */
  label: string | null;
  /** The family's own size, when it has one: Edit starts from it and offers the usual sizes back. */
  corrected: { text: string } | null;
}

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
  /** Null for items with no catalog packs: no "Store size" row. */
  packs?: ItemPacks | null;
  /** Null text puts the usual sizes back. Resolves 'invalid' to keep the sheet open with a warning. */
  onSavePacks?: (item: GroceryItem, text: string | null) => Promise<'saved' | 'invalid' | 'failed'>;
  /** The family's units (spec 027): the Edit field shows the amount in them. */
  units?: UnitSystem;
}

/**
 * FR-006 and OC-Groceries › Interactions: a row's menu (long-press, swipe left or the screen
 * reader's actions) opens straight on Edit, which reads the text again on Save; below it, "Move to…"
 * lists the aisles and is remembered for the family, and "Remove" takes it off the list, with Undo.
 */
export function GroceryActions({ item, view, onView, onClose, onRemove, onMove, onEdit, packs, onSavePacks, units = 'metric' }: GroceryActionsProps) {
  if (!item) return null;

  if (view === 'packs' && packs && onSavePacks) return <PackSheet key={item.id} item={item} packs={packs} onClose={onClose} onSave={onSavePacks} />;

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

  return <MenuSheet key={item.id} item={item} units={units} onView={onView} onClose={onClose} onRemove={onRemove} onEdit={onEdit} packs={packs && onSavePacks ? packs : null} />;
}

/** The first sheet: the item as one line to edit ("2 lemons", read again on Save), then Move to… and Remove. */
function MenuSheet({
  item,
  onView,
  onClose,
  onRemove,
  onEdit,
  packs,
  units,
}: Pick<GroceryActionsProps, 'onView' | 'onClose' | 'onRemove' | 'onEdit'> & { item: GroceryItem; packs: ItemPacks | null; units: UnitSystem }) {
  const [text, setText] = useState(() => editText(item, units));
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
      dirty={text !== editText(item, units)}
      footer={<SheetFooter cancel={{ label: g.cancel, onPress: onClose }} primary={{ label: g.save, onPress: () => void save(), disabled: !text.trim(), busy: saving }} />}
    >
      <TextField label={g.editLabel} hint={g.editHint} value={text} onChangeText={setText} onSubmitEditing={() => void save()} maxLength={200} />
      <ListGroup>
        <ListRow title={g.moveTo} trailing={{ kind: 'chevron', text: strings.aisles[item.aisle ?? 'other'] }} onPress={() => onView('move')} last={!packs} />
        {packs ? <ListRow title={g.storeSize} trailing={{ kind: 'chevron', text: packs.label ?? undefined }} onPress={() => onView('packs')} last /> : null}
      </ListGroup>
      {/* Apart from the options, in red: it takes the item off the list (with Undo). */}
      <Button label={g.remove} variant="danger" icon="trash" block onPress={() => onRemove(item)} />
    </BottomSheet>
  );
}

/**
 * FR-004 (not drawn; OC-Groceries › Row menu): the family's own pack size for this item, for both
 * stores. "Use the usual sizes" goes back to the catalog's.
 */
function PackSheet({ item, packs, onClose, onSave }: { item: GroceryItem; packs: ItemPacks; onClose: () => void; onSave: NonNullable<GroceryActionsProps['onSavePacks']> }) {
  const start = packs.corrected?.text ?? '';
  const [text, setText] = useState(start);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const save = async (value: string | null) => {
    setSaving(true);
    try {
      setInvalid((await onSave(item, value)) === 'invalid');
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={g.storeSize}
      lead={g.storeSizeLead(item.name)}
      closeLabel={g.close}
      dirty={text !== start}
      footer={<SheetFooter cancel={{ label: g.cancel, onPress: onClose }} primary={{ label: g.save, onPress: () => void save(text), disabled: !text.trim(), busy: saving }} />}
    >
      <TextField
        label={g.storeSizeLabel}
        hint={g.storeSizeHint}
        warning={invalid ? g.storeSizeInvalid : undefined}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setInvalid(false);
        }}
        onSubmitEditing={() => void save(text)}
        maxLength={30}
      />
      {packs.corrected ? <Link label={g.storeSizeReset} onPress={() => void save(null)} disabled={saving} /> : null}
    </BottomSheet>
  );
}
