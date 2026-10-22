import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Callout, ListGroup, ListRow, SheetFooter, SuccessPanel } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { AddedFromRecipe, RecipeGroceryLine } from '../../lib/add-from-recipe';
import { mergeNotes } from '../../lib/add-from-recipe';
import type { GroceryItem } from '../../lib/groceries';
import { useOnline } from '../../lib/online';
import { OfflineBanner } from '../sync/OfflineBanner';

const a = strings.addGroceries;

export interface AddGroceriesApi {
  add: (lines: RecipeGroceryLine[]) => Promise<AddedFromRecipe | null>;
  undo: (added: AddedFromRecipe) => Promise<boolean>;
}

export interface AddGroceriesSheetProps {
  recipeName: string;
  /** "6", "7½": the page's servings now. */
  servings: string;
  lines: RecipeGroceryLine[];
  /** The list as it stands, for "Already on the list (100 ml) → will be 400 ml". */
  list: readonly GroceryItem[];
  api: AddGroceriesApi;
  tracker: Tracker;
  onClose: () => void;
  onSeeList: () => void;
}

/** Add to groceries (spec 022; design/ui/OC-AddGroceries.md). No pantry: everything starts ticked. */
export function AddGroceriesSheet({ recipeName, servings, lines, list, api, tracker, onClose, onSeeList }: AddGroceriesSheetProps) {
  const online = useOnline();
  // FR-001: every ingredient ticked to start; ids that are unticked.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; added: AddedFromRecipe } | null>(null);

  const ticked = useMemo(() => new Set(lines.filter((l) => !off.has(l.id)).map((l) => l.id)), [lines, off]);
  const notes = useMemo(() => mergeNotes(list, lines, ticked), [list, lines, ticked]);
  const count = ticked.size;

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = async () => {
    if (count === 0 || busy) return;
    setBusy(true);
    setFailed(null);
    const added = await api.add(lines.filter((l) => ticked.has(l.id)));
    setBusy(false);
    if (!added) {
      setFailed(a.addFailed);
      return;
    }
    tracker.track('groceries_added_from_recipe', { ingredient_count: count, unticked_count: lines.length - count });
    setDone({ count, added });
  };

  const undo = async () => {
    if (!done || busy) return;
    setBusy(true);
    setFailed(null);
    const ok = await api.undo(done.added);
    setBusy(false);
    if (ok) setDone(null);
    else setFailed(a.undoFailed);
  };

  const footer = done ? (
    <View className="flex-row gap-10">
      <Button label={a.backToRecipe} variant="soft" onPress={onClose} className="flex-1" />
      <Button label={a.seeList} variant="ink" onPress={onSeeList} className="flex-1" />
    </View>
  ) : (
    <SheetFooter
      cancel={{ label: a.cancel, onPress: onClose }}
      primary={{ label: count === 0 ? a.nothingSelected : a.add(count), onPress: () => void add(), disabled: count === 0 || !online, busy, busyLabel: a.adding }}
    />
  );

  return (
    <BottomSheet visible title={a.title} lead={a.lead(recipeName, servings)} closeLabel={a.close} onClose={onClose} footer={footer}>
      <OfflineBanner screen="recipe" tracker={tracker} />
      {failed ? <Callout variant="warn" text={failed} /> : null}
      {done ? (
        <SuccessPanel title={a.added(done.count)} body={a.addedBody} undoLabel={a.undo} onUndo={() => void undo()} actions={null} />
      ) : (
        <ListGroup title={a.group} note={a.groupNote}>
          {lines.map((line, i) => {
            const on = ticked.has(line.id);
            const note = on ? notes.get(line.id) : undefined;
            return (
              <ListRow
                key={line.id}
                title={line.name}
                dim={!on}
                sub={note}
                subTone="warn"
                leading={{ kind: 'checkbox', checked: on }}
                trailing={line.shown ? { kind: 'value', text: line.shown } : undefined}
                onPress={() => toggle(line.id)}
                last={i === lines.length - 1}
              />
            );
          })}
        </ListGroup>
      )}
    </BottomSheet>
  );
}
