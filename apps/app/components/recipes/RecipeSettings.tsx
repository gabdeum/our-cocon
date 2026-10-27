import { useState } from 'react';
import { View } from 'react-native';
import { MAX_VARIANTS, resolveCooking, type FamilySettings, type RecipeOverrides, type RecipeOverridesUpdate } from '@cocon/schemas';
import { BackHeader, Button, Card, IconTile, Link, ListGroup, ListRow, PushedScreen, SegmentedControl, SettingRow, StatusBanner, Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { variantSummary, type SummaryBase } from '../../lib/recipe-variants';
import { DeleteRecipe } from './DeleteRecipe';

const r = strings.recipeSettings;

export interface RecipeSettingsProps {
  /** Undefined while loading; null when there's no such recipe for this family. */
  recipe: RecipeDetail | null | undefined;
  failed?: boolean;
  onRetry?: () => void;
  onBack: () => void;
  /** "Edit recipe": the form at Details (032-later L25). */
  onEditRecipe: () => void;
  /** The form at Variants: all of them, one (its id), or a new one ("new"). */
  onEditVariants: (variant?: string) => void;
  /** Spec 018: "Delete this recipe" at the bottom; throws when deleting failed. */
  onDelete?: () => Promise<void>;
  /** Spec 027: the family's defaults, which the recipe's own settings change. */
  defaults: FamilySettings;
  /** Saves one of the recipe's settings (null: back to the default) at once. */
  onChangeSettings: (change: RecipeOverridesUpdate) => Promise<'saved' | 'failed'>;
  /** Offline: the settings show, but can't change (decision 11). */
  readOnly?: boolean;
}

/** What the one-line summaries need from the recipe. */
function summaryBase(recipe: RecipeDetail): SummaryBase {
  const names = new Map(recipe.ingredients.map((i) => [i.id, i.name]));
  for (const v of recipe.variants)
    for (const c of v.changes) for (const i of c.type === 'swap_ingredient' ? c.with : c.type === 'add_ingredient' ? [c.ingredient] : []) names.set(i.id, i.name);
  return { ingredients: recipe.ingredients, steps: recipe.steps, names, facts: (key) => recipe.facts[key] };
}

/**
 * Recipe settings (OC-RecipeSettings): the "Edit recipe" row, this recipe's own cooking settings
 * (spec 027), the Variants list (spec 017), and "Delete this recipe" (018).
 */
export function RecipeSettings({ recipe, failed, onRetry, onBack, onEditRecipe, onEditVariants, onDelete, defaults, onChangeSettings, readOnly }: RecipeSettingsProps) {
  if (recipe === undefined && !failed) {
    return (
      <PushedScreen className="gap-18">
        <BackHeader backLabel={r.back} onBack={onBack} title={r.title} />
        <View role="progressbar" aria-label={r.loading} className="gap-12">
          {[0, 1, 2].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PushedScreen>
    );
  }
  if (!recipe) {
    return (
      <PushedScreen className="gap-18">
        <BackHeader backLabel={r.back} onBack={onBack} title={r.loadFailedTitle} lead={r.loadFailedBody} />
        {onRetry ? <Button label={r.retry} variant="soft" onPress={onRetry} /> : null}
      </PushedScreen>
    );
  }
  const base = summaryBase(recipe);
  return (
    <PushedScreen className="gap-18">
      <BackHeader backLabel={recipe.name} onBack={onBack} title={r.title} lead={r.lead} />
      <ListGroup>
        <ListRow title={r.editRecipe} trailing={{ kind: 'chevron' }} onPress={onEditRecipe} last />
      </ListGroup>
      <CookingSettingsCard overrides={recipe.overrides} defaults={defaults} onChange={onChangeSettings} readOnly={readOnly} />
      <View role="region" aria-label={r.variants} className="gap-10">
        <View className="flex-row items-baseline justify-between">
          <Text size={20} weight="900" role="heading" aria-level={2}>
            {r.variants}
          </Text>
          <Link label={r.edit} aria-label={r.editA11y} onPress={() => onEditVariants()} />
        </View>
        <Text size={14} weight="600" color="ink-muted">
          {r.variantsLead}
        </Text>
        {recipe.variants.map((v) => {
          const summary = variantSummary(v.changes, base);
          return (
            <Card key={v.id} onPress={() => onEditVariants(v.id)} accessibilityLabel={r.variantA11y(v.name, summary)} className="px-16 py-14">
              <View className="flex-row items-start gap-12">
                <IconTile icon={v.kind === 'version' ? 'swap' : 'plus'} tone={v.kind === 'version' ? 'sage' : 'honey'} />
                <View className="min-w-0 flex-1">
                  <Text size={16} weight="900">
                    {v.name}
                  </Text>
                  <Text size={14} weight="600" color="ink-muted">
                    {summary}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
        {recipe.variants.length < MAX_VARIANTS ? <Button label={r.addVariant} variant="dashed" icon="plus" block onPress={() => onEditVariants('new')} /> : null}
      </View>
      {onDelete ? <DeleteRecipe name={recipe.name} variants={recipe.variants.length} onDelete={onDelete} /> : null}
    </PushedScreen>
  );
}

/**
 * Spec 027 FR-002: each setting follows the family's default ("Same as default") until it's changed
 * here ("Changed for this recipe · Reset"); units pick Default, Metric or Imperial. Saved at once; a
 * failed save reverts and says so.
 */
function CookingSettingsCard({
  overrides,
  defaults,
  onChange,
  readOnly,
}: {
  overrides: RecipeOverrides;
  defaults: FamilySettings;
  onChange: RecipeSettingsProps['onChangeSettings'];
  readOnly?: boolean;
}) {
  const [saveFailed, setSaveFailed] = useState(false);
  const change = async (update: RecipeOverridesUpdate) => {
    setSaveFailed((await onChange(update)) === 'failed');
  };
  const inForce = resolveCooking(defaults, overrides);
  const row = (setting: 'keep_awake' | 'has_scale' | 'has_thermometer', label: string, value: boolean, hint: string = r.sameAsDefault) => {
    const changed = overrides[setting] !== null;
    return (
      <SettingRow
        label={label}
        hint={hint}
        value={value}
        // Turning it back to the default's value is a change too: it stays this recipe's own until Reset.
        onValueChange={(on) => void change({ [setting]: on })}
        changedHint={changed ? r.changed : undefined}
        resetLabel={changed && !readOnly ? r.reset : undefined}
        onReset={changed && !readOnly ? () => void change({ [setting]: null }) : undefined}
        disabled={readOnly}
      />
    );
  };
  return (
    <View className="gap-10">
      <Card className="gap-0 px-16 py-4">
        {row('keep_awake', r.keepAwake, inForce.keepAwake)}
        {/* Drawn with what the scale does, rather than "Same as default". */}
        {row('has_scale', r.kitchenScale, inForce.scale, r.kitchenScaleHint)}
        {row('has_thermometer', r.thermometer, inForce.thermometer)}
        <View className="gap-10 py-14">
          <Text size={16} weight="800">
            {r.units}
          </Text>
          <SegmentedControl<'default' | 'metric' | 'imperial'>
            label={r.units}
            value={overrides.units ?? 'default'}
            onChange={(key) => void change({ units: key === 'default' ? null : key })}
            segments={[
              { key: 'default', label: r.unitsDefault },
              { key: 'metric', label: r.metric },
              { key: 'imperial', label: r.imperial },
            ]}
            disabled={readOnly}
          />
        </View>
      </Card>
      {saveFailed && !readOnly ? <StatusBanner tone="warn" message={r.saveFailed} /> : null}
    </View>
  );
}
