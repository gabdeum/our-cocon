import { useMemo, useState } from 'react';
import { BottomSheet, Link, ListGroup, ListRow, SheetFooter, useSheetPresentation } from '@cocon/ui';
import type { IngredientFactsInput } from '@cocon/quantity';
import type { Tracker, UnitSystem } from '@cocon/schemas';
import { useToast } from '../../lib/toast';
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
  /** The recipe's catalog facts, so the notes add up pieces and grams as the list does. */
  facts: Readonly<Record<string, IngredientFactsInput>>;
  /** The family's units (spec 027), so "Already on the list" reads as the list does. */
  units?: UnitSystem;
  api: AddGroceriesApi;
  tracker: Tracker;
  onClose: () => void;
  /** The toast's "See the list", once the sheet has closed. */
  onSeeList: () => void;
}

/**
 * Add to groceries (spec 022; design/ui/OC-AddGroceries.md). No pantry: everything starts ticked.
 * Once added the sheet closes on a toast: "Added 3 items to groceries", See the list, Undo.
 */
export function AddGroceriesSheet({ recipeName, servings, lines, list, facts, units = 'metric', api, tracker, onClose, onSeeList }: AddGroceriesSheetProps) {
  const online = useOnline();
  const toast = useToast();
  const presentation = useSheetPresentation('flow');
  // FR-001: every ingredient ticked to start; ids that are unticked.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [sent, setSent] = useState(false);
  // On the web a Modal can stay over the next screen while this one leaves: take it away first.
  const [leaving, setLeaving] = useState(false);
  const leave = (go: () => void) => () => {
    setLeaving(true);
    go();
  };

  const ticked = useMemo(() => new Set(lines.filter((l) => !off.has(l.id)).map((l) => l.id)), [lines, off]);
  const notes = useMemo(() => mergeNotes(list, lines, ticked, facts, units), [list, lines, ticked, facts, units]);
  const count = ticked.size;

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The sheet closes at once; the list shows the recipe's items on their way (`api.add`), then the
  // toast says they're in, or that they couldn't be added, with Try again.
  const add = () => {
    if (count === 0 || sent) return;
    setSent(true);
    const picked = lines.filter((l) => ticked.has(l.id));
    const unticked = lines.length - count;
    const send = () =>
      void api.add(picked).then((added) => {
        if (!added) {
          toast.show({ text: a.addFailed, tone: 'warn', retry: send });
          return;
        }
        tracker.track('groceries_added_from_recipe', { ingredient_count: picked.length, unticked_count: unticked, presentation });
        toast.show({
          text: a.added(picked.length),
          onUndo: () => undo(added),
          undoFailed: a.undoFailed,
          action: { label: a.seeList, onPress: onSeeList },
        });
      });
    send();
    close();
  };

  // From the toast, after the sheet has gone: a rejection shows "Couldn't undo".
  const undo = async (added: AddedFromRecipe) => {
    if (!(await api.undo(added))) throw new Error('undo failed');
  };

  const close = leave(onClose);
  const footer = (
    <SheetFooter
      cancel={{ label: a.cancel, onPress: close }}
      primary={{ label: count === 0 ? a.nothingSelected : a.add(count), onPress: add, disabled: count === 0 || !online }}
    />
  );

  // "Untick all" when anything is ticked, else "Tick all".
  const tickAll = lines.length > 0 ? <Link label={count > 0 ? a.untickAll : a.tickAll} onPress={() => setOff(count > 0 ? new Set(lines.map((l) => l.id)) : new Set())} /> : undefined;

  if (leaving) return null;
  return (
    <BottomSheet visible title={a.title} lead={a.lead(recipeName, servings)} headerAction={tickAll} closeLabel={a.close} onClose={close} footer={footer}>
      <OfflineBanner screen="recipe" tracker={tracker} />
      <ListGroup title={a.group} note={a.groupNote}>
        {lines.map((line, i) => {
          const on = ticked.has(line.id);
          const note = on ? notes.get(line.id) : undefined;
          return (
            <ListRow
              key={line.id}
              title={line.name}
              dim={!on}
              detail={line.detail ? strings.groceries.inRecipe(line.detail) : undefined}
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
    </BottomSheet>
  );
}
