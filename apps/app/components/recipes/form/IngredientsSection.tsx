import { useState } from 'react';
import { amountInput } from '@cocon/quantity';
import { View } from 'react-native';
import type { IngredientFacts } from '@cocon/schemas';
import { Button, IngredientEditCard, Link, ListRow, ReorderList, StatusBanner, Text, type IngredientEditField } from '@cocon/ui';
import { strings } from '../../../strings/en';
import type { IngredientDraft, IngredientWarning } from '../../../lib/recipe-ingredients';
import { unitText } from './IngredientSheets';

const ing = strings.recipeForm.ingredients;

const fieldOf: Record<IngredientWarning, IngredientEditField> = {
  unitMissing: 'unit',
  quantityInvalid: 'quantity',
  amountMissing: 'quantity',
  weightInvalid: 'weight',
  nameMissing: 'name',
};

export interface IngredientsSectionProps {
  drafts: IngredientDraft[];
  warnings: Record<string, IngredientWarning>;
  /** "For {n} servings", from Details. */
  servings: number;
  /** "Added 3 ingredients. Check the amounts." after a paste. */
  banner: string | null;
  /** The row whose name is focused, with what the catalog suggests for it. */
  suggestions: { key: string; items: IngredientFacts[] } | null;
  onChangeRow: (key: string, patch: Partial<Pick<IngredientDraft, 'quantity' | 'weight'>>) => void;
  onNameChange: (key: string, name: string) => void;
  onNameFocus: (key: string) => void;
  onNameBlur: (key: string) => void;
  onPickSuggestion: (key: string, facts: IngredientFacts) => void;
  onOpenUnit: (key: string) => void;
  onOpenAisle: (key: string) => void;
  onRemove: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  onOpenPaste: () => void;
  onDragChange: (dragging: boolean) => void;
  /** Where each row sits in the scroll (from the section's top), so Save can bring the first warned one into view. */
  onRowLayout: (key: string, y: number) => void;
  /** Where the section starts in the scroll. */
  onSectionLayout: (y: number) => void;
}

/** The Ingredients section of the recipe form (spec 015, OC-EditIngredients › Layout), in the screen's order. */
export function IngredientsSection(p: IngredientsSectionProps) {
  const [listY, setListY] = useState(0);
  return (
    <View className="gap-12" onLayout={(e) => p.onSectionLayout(e.nativeEvent.layout.y)}>
      <View className="flex-row items-baseline justify-between gap-8">
        <Text size={24} weight="900" role="heading" aria-level={1}>
          {ing.title}
        </Text>
        <Text size={14} weight="700" color="ink-muted">
          {ing.servings(p.servings)}
        </Text>
      </View>
      <Text size={14} weight="600" color="ink-muted">
        {ing.lead}
      </Text>
      {p.banner ? <StatusBanner message={p.banner} /> : null}

      <View
        onLayout={(e) => setListY(e.nativeEvent.layout.y)}
      >
        <ReorderList
          items={p.drafts}
          keyOf={(d) => d.key}
          gap={12}
          handleLabel={ing.handle}
          moveUpLabel={ing.moveUp}
          moveDownLabel={ing.moveDown}
          onMove={p.onMove}
          onDragChange={p.onDragChange}
          onItemLayout={(key, y) => p.onRowLayout(key, listY + y)}
          renderItem={(d, _i, handle) => {
            const warning = p.warnings[d.key];
            const piece = d.unit === 'piece';
            const suggested = p.suggestions?.key === d.key ? p.suggestions.items : [];
            return (
              <IngredientEditCard
                handle={handle}
                name={d.name}
                onNameChange={(t) => p.onNameChange(d.key, t)}
                nameLabel={ing.name}
                namePlaceholder={ing.namePlaceholder}
                onNameFocus={() => p.onNameFocus(d.key)}
                onNameBlur={() => p.onNameBlur(d.key)}
                quantity={d.quantity}
                onQuantityChange={(t) => p.onChangeRow(d.key, { quantity: amountInput(t) })}
                quantityLabel={ing.quantity}
                quantityPlaceholder={ing.quantityPlaceholder}
                unit={unitText(d.unit, d.sizeWord)}
                unitPlaceholder={warning === 'unitMissing' ? ing.unitMissingButton : ing.unit}
                unitLabel={ing.unit}
                onUnitPress={() => p.onOpenUnit(d.key)}
                weight={
                  piece
                    ? { value: d.weight, onChange: (t) => p.onChangeRow(d.key, { weight: amountInput(t, { fractions: false }) }), label: ing.weight, prefix: ing.each, suffix: ing.grams, placeholder: ing.weightPlaceholder }
                    : null
                }
                removeLabel={ing.remove(d.name.trim())}
                onRemove={() => p.onRemove(d.key)}
                warning={warning ? ing.warnings[warning] : null}
                warningField={warning ? fieldOf[warning] : null}
              >
                {suggested.length > 0 ? (
                  <View role="list" aria-label={ing.suggestions}>
                    {suggested.map((s, i) => (
                      <ListRow
                        key={s.catalog_key ?? s.family_ingredient_id ?? s.name}
                        title={s.name}
                        flush
                        last={i === suggested.length - 1}
                        onPress={() => p.onPickSuggestion(d.key, s)}
                      />
                    ))}
                  </View>
                ) : null}
                {d.isNew && d.name.trim() ? (
                  <View className="flex-row flex-wrap items-center gap-x-8">
                    <Text variant="caption" color="ink-muted">
                      {ing.newIngredient}
                    </Text>
                    <Link
                      label={d.newAisle ? strings.aisles[d.newAisle] : ing.pickAisle}
                      onPress={() => p.onOpenAisle(d.key)}
                      aria-label={`${ing.aisle}: ${d.newAisle ? strings.aisles[d.newAisle] : ing.pickAisle}`}
                    />
                  </View>
                ) : null}
              </IngredientEditCard>
            );
          }}
        />
      </View>

      <View className="flex-row gap-10">
        <Button label={ing.add} variant="dashed" onPress={p.onAdd} className="flex-1" />
        <Button label={ing.paste} variant="soft" onPress={p.onOpenPaste} className="flex-1" />
      </View>
      <Text variant="caption" color="ink-muted">
        {ing.tip}
      </Text>
    </View>
  );
}
