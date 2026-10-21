import { useState } from 'react';
import { AISLE_ORDER, type Aisle, type SizeWord, type Unit } from '@cocon/schemas';
import { BottomSheet, Button, Choice, PillRow, TextField } from '@cocon/ui';
import { strings } from '../../../strings/en';

const f = strings.recipeForm;
const ing = f.ingredients;

/** The units a row can have (FR-001), in the order the list shows them. */
const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'piece', 'pinch'];

/** A unit's label in the row and the list: "g", "L", "pieces", or a size ("small"). */
export function unitText(unit: Unit | null, size: SizeWord | null): string | null {
  if (!unit) return null;
  if (unit === 'piece' && size) return ing.sizes[size];
  return strings.unitShort[unit];
}

/**
 * The unit list (OC-EditIngredients): "No unit", the units, and for catalog items with sizes,
 * "small", "medium" and "large" pieces ("1 small onion"). Picking one closes it.
 */
export function UnitSheet({
  visible,
  unit,
  size,
  sizes,
  onPick,
  onClose,
}: {
  visible: boolean;
  unit: Unit | null;
  size: SizeWord | null;
  sizes: SizeWord[];
  onPick: (unit: Unit | null, size: SizeWord | null) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} title={ing.unit} closeLabel={f.close} onClose={onClose}>
      <PillRow>
        {/* Nothing is picked until someone picks: a new row has no unit yet, not "No unit". */}
        <Choice label={ing.noUnit} selected={false} onPress={() => onPick(null, null)} />
        {UNITS.map((u) => (
          <Choice key={u} label={strings.unitShort[u]} selected={unit === u && !(u === 'piece' && size)} onPress={() => onPick(u, null)} />
        ))}
        {sizes.map((s) => (
          <Choice key={s} label={ing.sizes[s]} selected={unit === 'piece' && size === s} onPress={() => onPick('piece', s)} />
        ))}
      </PillRow>
    </BottomSheet>
  );
}

/** "New ingredient. Pick its aisle:" (spec 031): the aisles in store order. */
export function AisleSheet({ visible, value, onPick, onClose }: { visible: boolean; value: Aisle | null; onPick: (aisle: Aisle) => void; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} title={ing.aisle} closeLabel={f.close} onClose={onClose}>
      <PillRow>
        {AISLE_ORDER.map((a) => (
          <Choice key={a} label={strings.aisles[a]} selected={value === a} onPress={() => onPick(a)} />
        ))}
      </PillRow>
    </BottomSheet>
  );
}

/** "Paste a list" (US1): the pasted text, split into rows by the form when "Add ingredients" is tapped. */
export function PasteSheet({ visible, onAdd, onClose }: { visible: boolean; onAdd: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const close = () => {
    setText('');
    onClose();
  };
  return (
    <BottomSheet
      visible={visible}
      title={ing.pasteTitle}
      closeLabel={f.close}
      onClose={close}
      dirty={text.trim() !== ''}
      footer={
        <Button
          label={ing.pasteAdd}
          variant="ink"
          block
          disabled={text.trim() === ''}
          onPress={() => {
            onAdd(text);
            setText('');
          }}
        />
      }
    >
      <TextField label={ing.pasteField} hint={ing.pasteHint} value={text} onChangeText={setText} multiline maxLength={5000} autoFocus />
    </BottomSheet>
  );
}
