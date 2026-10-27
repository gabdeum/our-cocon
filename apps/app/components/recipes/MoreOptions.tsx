import { View } from 'react-native';
import { ListRow, SegmentedControl, SettingRow } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeChoices } from '../../lib/recipe-choices';
import type { FormatOptions } from '@cocon/quantity';
import { formatOf } from '../../lib/recipe-view';

const more = strings.recipePage.more;

/**
 * The "…" options (spec 013, OC-Recipe): the kitchen scale and units are quick toggles for this
 * recipe on this device; the two sheets sit between them, as drawn. Shown under Servings on the
 * recipe page and in cooking mode's options sheet (OC-Cook).
 */
export function MoreOptions({
  choices,
  settings,
  tracker,
  onChange,
  onScaleByIngredient,
  onConvert,
}: {
  choices: RecipeChoices;
  /** The recipe's units and kitchen scale in force (spec 027), under the toggles. */
  settings: FormatOptions;
  tracker: Tracker;
  /** Only called when a toggle changes what's in force. */
  onChange: (next: RecipeChoices) => void;
  onScaleByIngredient: () => void;
  onConvert: () => void;
}) {
  // What's in force: the toggles, else the settings.
  const format = formatOf(choices, settings);
  const change = (next: RecipeChoices) => {
    // Tapping what's already in force changes nothing, and keeps following the settings.
    if (next.kitchenScale !== null && next.kitchenScale !== format.scale) tracker.track('kitchen_scale_toggled', { on: next.kitchenScale });
    else if (next.system !== null && next.system !== format.system) tracker.track('units_toggled', { system: next.system });
    else return;
    onChange(next);
  };
  return (
    <View>
      <SettingRow
        label={more.kitchenScale}
        hint={format.scale ? more.scaleOnHint : more.scaleOffHint}
        value={format.scale}
        onValueChange={(on) => change({ ...choices, kitchenScale: on })}
      />
      <ListRow flush title={more.scaleByIngredient} trailing={{ kind: 'chevron' }} onPress={onScaleByIngredient} />
      <ListRow flush title={more.converter} trailing={{ kind: 'chevron' }} onPress={onConvert} />
      <ListRow
        flush
        last
        title={more.units}
        trailing={{
          kind: 'node',
          node: (
            <SegmentedControl
              variant="pill"
              label={more.units}
              value={format.system}
              onChange={(system) => change({ ...choices, system })}
              segments={[
                { key: 'metric', label: more.metric },
                { key: 'imperial', label: more.imperial },
              ]}
            />
          ),
        }}
      />
    </View>
  );
}
