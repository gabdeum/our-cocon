import { useState } from 'react';
import { View } from 'react-native';
import { SegmentedControl, SettingRow, StatusBanner, Text } from '@cocon/ui';
import type { FamilySettings, FamilySettingsUpdate, StoreProfile } from '@cocon/schemas';
import { strings } from '../../strings/en';

const s = strings.settings.groceries;

export interface GrocerySettingsProps {
  settings: FamilySettings;
  onChange: (change: FamilySettingsUpdate) => Promise<'saved' | 'failed'>;
  readOnly?: boolean;
}

/**
 * Spec 021: where the family shops and whether the list rounds up to store sizes, in the Groceries
 * tab's settings sheet. Laid out like the other sheets (Patterns.md › Bottom sheet, OC-Filters): a
 * 16/900 section heading and its control on the sheet itself, then the switch as a boxed
 * SettingRow. Saved at once for the whole family; a failed save reverts and says so.
 */
export function GrocerySettings({ settings, onChange, readOnly }: GrocerySettingsProps) {
  const [failed, setFailed] = useState(false);
  const change = async (update: FamilySettingsUpdate) => {
    setFailed((await onChange(update)) === 'failed');
  };
  return (
    <View className="gap-16">
      <View className="gap-8">
        <View>
          <Text size={16} weight="900" role="heading" aria-level={3}>
            {s.shopLabel}
          </Text>
          <Text variant="caption" color="ink-muted">
            {s.shopHint}
          </Text>
        </View>
        <SegmentedControl<StoreProfile>
          label={s.shopLabel}
          segments={[
            { key: 'us', label: s.usStores },
            { key: 'eu', label: s.euStores },
          ]}
          value={settings.store_profile}
          onChange={(store_profile) => {
            if (store_profile !== settings.store_profile) void change({ store_profile });
          }}
          disabled={readOnly}
        />
        <Text size={14} weight="700" color="ink-muted">
          {s.exampleNeed}
          <Text size={14} weight="900" color="ink-muted">
            {s.exampleAmount}
          </Text>
          {' → '}
          <Text size={14} weight="900" color="olive-deep">
            {s.exampleBuy[settings.store_profile]}
          </Text>
        </Text>
      </View>
      <SettingRow
        boxed
        label={s.roundLabel}
        hint={s.roundHint}
        value={settings.round_to_packs}
        onValueChange={(round_to_packs) => void change({ round_to_packs })}
        disabled={readOnly}
      />
      {failed && !readOnly ? <StatusBanner tone="warn" message={s.saveFailed} /> : null}
    </View>
  );
}
