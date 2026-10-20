import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AmountField, BottomSheet, Card, IconButton, ResultTile, SegmentedControl, Text } from '@cocon/ui';
import { CONVERTER_UNITS, type ConverterTab, type ConverterUnit } from '@cocon/quantity';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import type { RecipeChoices } from '../../lib/recipe-choices';
import { converterStart, converterView, recipeIngredient, tabStartUnit } from '../../lib/converter-view';
import { parseAmount } from '../../lib/scale-by-ingredient';

const c = strings.convertSheet;
/** `unit_converter_used` waits for typing to settle, like `servings_changed`. */
export const CONVERT_SETTLE_MS = 800;

export interface ConvertSheetProps {
  recipe: RecipeDetail;
  /** The page's variants on this device, so "For this recipe" talks about what's cooked. */
  choices: RecipeChoices;
  tracker: Tracker;
  onClose: () => void;
}

/** The unit converter (spec 013 US3; design/ui/OC-Units.md). Results update as you type. */
export function ConvertSheet({ recipe, choices, tracker, onClose }: ConvertSheetProps) {
  const [tab, setTab] = useState<ConverterTab>(converterStart.tab);
  const [unit, setUnit] = useState<ConverterUnit>(converterStart.unit);
  const [text, setText] = useState('');
  const amount = parseAmount(text);

  const ingredient = useMemo(() => {
    const ing = recipeIngredient(recipe, choices, tab);
    return ing ? { name: ing.name, density: ing.facts?.density_g_per_ml ?? 0 } : null;
  }, [recipe, choices, tab]);
  const view = converterView(amount, unit, ingredient);
  const main = view.tiles[0]?.unit;

  // FR: one event once the value settles; the unit typed in and the main result's.
  useEffect(() => {
    if (amount === null || !main) return;
    const timer = setTimeout(() => tracker.track('unit_converter_used', { from_unit: unit, to_unit: main }), CONVERT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [amount, unit, main, tracker]);

  const switchTab = (next: ConverterTab) => {
    setTab(next);
    setUnit(tabStartUnit[next]);
  };
  const rows = [view.tiles.slice(0, 2), view.tiles.slice(2, 4)].filter((r) => r.length > 0);

  return (
    <BottomSheet visible title={c.title} closeLabel={c.close} onClose={onClose} headerAction={<IconButton icon="close" label={c.close} variant="soft" onPress={onClose} />}>
      <SegmentedControl
        label={c.tabsLabel}
        value={tab}
        onChange={switchTab}
        segments={[
          { key: 'weight', label: c.weight },
          { key: 'volume', label: c.volume },
          { key: 'oven', label: c.oven },
        ]}
      />
      <AmountField
        size="xl"
        label={c.convert}
        value={text}
        onChangeText={setText}
        unit={unit}
        units={CONVERTER_UNITS[tab]}
        onUnitChange={setUnit}
        unitLabel={(u) => strings.unitShort[u]}
        unitA11y={c.unit}
      />
      {rows.length > 0 ? (
        <View role="list" aria-live="polite" className="gap-10">
          {rows.map((row, r) => (
            <View key={r} className="flex-row gap-10">
              {row.map((t, i) => (
                <View key={t.unit} role="listitem" className="flex-1">
                  <ResultTile value={t.value} label={t.label} main={r === 0 && i === 0} />
                </View>
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
      ) : null}
      {view.forRecipe ? (
        <Card tone="sage">
          <Text variant="overline" uppercase color="olive-deep">
            {c.forRecipe}
          </Text>
          <Text size={15} weight="700" style={{ lineHeight: 15 * 1.45 }}>
            {view.forRecipe}
          </Text>
        </Card>
      ) : null}
      <Text size={13} weight="600" color="ink-muted">
        {c.footnote}
      </Text>
    </BottomSheet>
  );
}
