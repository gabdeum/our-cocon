import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AmountField, BottomSheet, Card, Link, RadioCard, SheetFooter, Text } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import type { Unit } from '@cocon/schemas/recipes';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import type { RecipeChoices, ScaledBy } from '../../lib/recipe-choices';
import type { FormatOptions } from '@cocon/quantity';
import { defaultFormat, formatOf } from '../../lib/recipe-view';
import { INGREDIENTS_SHOWN, parseAmount, scaleCandidates, scalePreview } from '../../lib/scale-by-ingredient';

const s = strings.scaleSheet;

export interface ScaleSheetProps {
  recipe: RecipeDetail;
  /** The page's choices on this device: variants, units and kitchen scale, and any scale already applied. */
  choices: RecipeChoices;
  /** The recipe's units and kitchen scale in force (spec 027), under the page's toggles. */
  settings?: FormatOptions;
  tracker: Tracker;
  onApply: (scaledBy: ScaledBy) => void;
  onClose: () => void;
}

/** Scale by an ingredient (spec 013 US2; design/ui/OC-ScaleIng.md). */
export function ScaleSheet({ recipe, choices, settings = defaultFormat, tracker, onApply, onClose }: ScaleSheetProps) {
  const options = formatOf(choices, settings);
  const candidates = useMemo(() => scaleCandidates(recipe, choices, options), [recipe, choices, options.system, options.scale]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opens on what was applied last, else the first ingredient.
  const applied = choices.scaledBy && candidates.find((c) => c.id === choices.scaledBy?.ingredientId) ? choices.scaledBy : null;
  const [picked, setPicked] = useState(applied?.ingredientId ?? candidates[0]?.id ?? null);
  const [text, setText] = useState(applied ? String(applied.amount) : '');
  const [unit, setUnit] = useState<Unit | null>(applied?.unit ?? candidates[0]?.unit ?? null);
  const [expanded, setExpanded] = useState(false);

  const candidate = candidates.find((c) => c.id === picked) ?? null;
  const amount = parseAmount(text);
  const by = candidate && unit && amount ? { ingredientId: candidate.id, amount, unit } : null;
  const preview = by ? scalePreview(recipe, choices, by, options) : null;
  // The first 3, plus the chosen one if it's further down (FR-003).
  const shown = expanded ? candidates : candidates.filter((c, i) => i < INGREDIENTS_SHOWN || c.id === picked);

  const pick = (id: string) => {
    if (id === picked) return;
    setPicked(id);
    setUnit(candidates.find((c) => c.id === id)?.unit ?? null);
    setText('');
  };
  const apply = () => {
    if (!by || !preview) return;
    tracker.track('scaled_by_ingredient', {});
    onApply(by);
  };

  return (
    <BottomSheet
      visible
      title={s.title}
      lead={s.lead}
      closeLabel={s.close}
      onClose={onClose}
      footer={<SheetFooter cancel={{ label: s.cancel, onPress: onClose }} primary={{ label: s.apply, onPress: apply, disabled: !preview }} />}
    >
      <View role="radiogroup" aria-label={s.which} className="gap-8">
        <Text size={15} weight="900">
          {s.which}
        </Text>
        {shown.map((c) => (
          <RadioCard key={c.id} label={c.name} value={c.current} selected={c.id === picked} onPress={() => pick(c.id)} />
        ))}
        {!expanded && shown.length < candidates.length ? <Link label={s.showAll(candidates.length)} size={14} onPress={() => setExpanded(true)} /> : null}
      </View>

      {candidate && unit ? (
        <AmountField
          label={s.howMuch}
          value={text}
          onChangeText={setText}
          unit={unit}
          units={candidate.units}
          onUnitChange={setUnit}
          unitLabel={(u) => strings.unitShort[u]}
          unitA11y={s.unit}
          hint={amount ? undefined : s.enterAmount}
        />
      ) : null}

      {preview ? (
        <Card tone="sage">
          <Text size={16} weight="900" aria-live="polite">
            {preview.result}
          </Text>
          <Text size={14} weight="600" style={{ lineHeight: 14 * 1.5 }}>
            {preview.amounts}
          </Text>
          {preview.warning ? (
            <Text size={13} weight="700" color="warn">
              {preview.warning}
            </Text>
          ) : null}
          <Text size={13} weight="700" color="olive-deep">
            {preview.note}
          </Text>
        </Card>
      ) : null}
    </BottomSheet>
  );
}
