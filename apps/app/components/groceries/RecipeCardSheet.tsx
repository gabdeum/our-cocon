import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Card, SheetFooter, Stepper, Text, Thumb } from '@cocon/ui';
import { strings } from '../../strings/en';
import { useToast } from '../../lib/toast';
import type { RecipeCard } from '../../lib/groceries';
import { servingsMax, SERVINGS_MIN } from '../../lib/recipe-view';

const g = strings.groceries;

export interface RecipeCardSheetProps {
  card: RecipeCard;
  photoUri?: string;
  /** Offline: servings and Remove wait. */
  online: boolean;
  /** Rescales the recipe's items still to buy, then closes; false when it failed. */
  onSaveServings: (to: number) => Promise<boolean>;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * A recipe card's menu on the grocery list (spec 052 FR-008, OC-GroceryRecipeMenu): the recipe, the
 * servings it's on the list for (Save rescales its items still to buy, spec 022), and, in red,
 * "Remove its items" (with Undo). Cancel and Save are there from the start; Save waits for a change.
 * A recipe in Recently deleted only has "Remove its items".
 */
export function RecipeCardSheet({ card, photoUri, online, onSaveServings, onRemove, onClose }: RecipeCardSheetProps) {
  const [servings, setServings] = useState(card.serves);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const changed = servings !== card.serves;
  const save = async () => {
    setSaving(true);
    try {
      // A failure is a toast over the sheet, which stays open (spec 053 FR-015).
      if (!(await onSaveServings(servings))) toast.show({ text: g.syncFailed, tone: 'warn' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={card.name}
      lead={card.deleted ? g.fromDeletedRecipe : g.onTheList(card.count)}
      leading={<Thumb uri={photoUri} size="lg" />}
      closeLabel={g.close}
      dirty={changed}
      footer={
        card.deleted ? undefined : (
          <SheetFooter
            cancel={{ label: g.cancel, onPress: onClose }}
            primary={{ label: changed ? g.saveServings(servings) : g.save, onPress: () => void save(), disabled: !online || !changed, busy: saving }}
          />
        )
      }
    >
      {card.deleted ? null : (
        <View className="gap-8">
          <Text size={16} weight="900">
            {g.servings}
          </Text>
          <Card className="flex-row items-center gap-8 py-10 pl-16 pr-12">
            <Text size={15} weight="600" color="ink-muted" className="min-w-0 flex-1">
              {changed ? g.wasServings(card.serves) : g.onTheListFor(card.serves)}
            </Text>
            <Stepper
              value={servings}
              onChange={setServings}
              min={SERVINGS_MIN}
              max={Math.min(50, servingsMax(card.serves))}
              decreaseLabel={g.fewerServings}
              increaseLabel={g.moreServings}
            />
          </Card>
          <Text variant="caption" color="ink-muted">
            {g.servingsHint}
          </Text>
        </View>
      )}
      {/* Apart from the servings, in red: it takes the recipe's items off the list (with Undo). */}
      <Button label={g.removeRecipeItems} variant="danger-card" icon="trash" block disabled={!online} onPress={onRemove} />
    </BottomSheet>
  );
}
