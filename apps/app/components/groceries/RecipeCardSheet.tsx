import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Card, ListGroup, ListRow, SheetFooter, Stepper, Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import type { RecipeCard } from '../../lib/groceries';
import { servingsMax, SERVINGS_MIN } from '../../lib/recipe-view';

const g = strings.groceries;

export interface RecipeCardSheetProps {
  card: RecipeCard;
  /** Offline: Open recipe still works; servings and Remove wait. */
  online: boolean;
  onOpen: () => void;
  /** Rescales the recipe's items still to buy, then closes; false when it failed. */
  onSaveServings: (to: number) => Promise<boolean>;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * A recipe card's menu on the grocery list (spec 022, OC-Groceries › Recipe card menu): Open
 * recipe, the servings it's on the list for (Save rescales its items still to buy), and, in red,
 * "Remove its items" (with Undo).
 */
export function RecipeCardSheet({ card, online, onOpen, onSaveServings, onRemove, onClose }: RecipeCardSheetProps) {
  const [servings, setServings] = useState(card.serves);
  const [saving, setSaving] = useState(false);
  const changed = servings !== card.serves;
  const save = async () => {
    setSaving(true);
    try {
      await onSaveServings(servings);
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={g.forRecipe(card.name)}
      lead={g.recipeMeta(card.count, card.serves)}
      closeLabel={g.close}
      dirty={changed}
      footer={
        changed ? (
          <SheetFooter cancel={{ label: g.cancel, onPress: onClose }} primary={{ label: g.saveServings(servings), onPress: () => void save(), disabled: !online, busy: saving }} />
        ) : undefined
      }
    >
      <ListGroup>
        <ListRow title={g.openRecipeRow} trailing={{ kind: 'chevron' }} onPress={onOpen} last />
      </ListGroup>
      <View className="gap-6">
        <Card className="flex-row items-center gap-8 py-12 pl-16 pr-12">
          <Text size={17} weight="900" className="flex-1">
            {g.servings}
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
      {/* Apart from the options, in red: it takes the recipe's items off the list (with Undo). */}
      <Button label={g.removeRecipeItems} variant="danger" icon="trash" block disabled={!online} onPress={onRemove} />
    </BottomSheet>
  );
}
