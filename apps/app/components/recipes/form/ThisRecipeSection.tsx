import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { resolveCooking, type FamilySettings, type RecipeOverrides, type RecipeOverridesUpdate } from '@cocon/schemas';
import { Card, SettingRow, Text } from '@cocon/ui';
import { strings } from '../../../strings/en';

const f = strings.recipeForm;
const r = strings.recipeSettings;

export interface ThisRecipeSectionProps {
  /** The recipe's own settings as edited; null ones follow the family's defaults. */
  overrides: RecipeOverrides;
  defaults: FamilySettings;
  /** A change to the form: saved with the form's Save, like every other field. */
  onChange: (change: RecipeOverridesUpdate) => void;
  readOnly?: boolean;
  /** "Delete recipe" (spec 018) under the settings. */
  deleteButton?: ReactNode;
  /** Where it sits in the scroll, so "Units: Metric" on the recipe page can open the form here. */
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * Spec 051 FR-013 (OC-EditBasics › This recipe), editing only: spec 027's settings, each "Same as
 * default" until changed ("Changed for this recipe · Reset"), then Delete recipe. Units aren't a
 * recipe's: each member picks their own (Menu › Recipes), and switches for a visit in "…".
 */
export function ThisRecipeSection({ overrides, defaults, onChange, readOnly, deleteButton, onLayout }: ThisRecipeSectionProps) {
  const inForce = resolveCooking(defaults, overrides);
  const row = (setting: 'keep_awake' | 'has_scale' | 'has_thermometer', label: string, value: boolean, hint: string = r.sameAsDefault, last = false) => {
    const changed = overrides[setting] !== null;
    return (
      <SettingRow
        label={label}
        hint={hint}
        value={value}
        // Turning it back to the default's value is a change too: it stays this recipe's own until Reset.
        onValueChange={(on) => onChange({ [setting]: on })}
        changedHint={changed ? r.changed : undefined}
        resetLabel={changed && !readOnly ? r.reset : undefined}
        onReset={changed && !readOnly ? () => onChange({ [setting]: null }) : undefined}
        disabled={readOnly}
        last={last}
      />
    );
  };
  return (
    <View onLayout={onLayout} role="region" aria-labelledby="this-recipe" className="mt-6 gap-10">
      <Text nativeID="this-recipe" size={20} weight="900" role="heading" aria-level={2}>
        {f.thisRecipe}
      </Text>
      <Text size={14} weight="600" color="ink-muted">
        {f.thisRecipeLead}
      </Text>
      <Card className="gap-0 px-16 py-4">
        {row('keep_awake', r.keepAwake, inForce.keepAwake)}
        {/* Drawn with what the scale does, rather than "Same as default". */}
        {row('has_scale', r.kitchenScale, inForce.scale, r.kitchenScaleHint)}
        {row('has_thermometer', r.thermometer, inForce.thermometer, r.sameAsDefault, true)}
      </Card>
      {deleteButton}
    </View>
  );
}
