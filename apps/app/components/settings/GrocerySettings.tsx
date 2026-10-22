import { useState } from 'react';
import { View } from 'react-native';
import { ListGroup, SegmentedControl, SettingChoice, SettingRow, StatusBanner, Text } from '@cocon/ui';
import type { FamilySettings, FamilySettingsUpdate, StoreProfile } from '@cocon/schemas';
import { strings } from '../../strings/en';

const s = strings.settings.groceries;

export interface GrocerySettingsProps {
  settings: FamilySettings;
  onChange: (change: FamilySettingsUpdate) => Promise<'saved' | 'failed'>;
  readOnly?: boolean;
}

/**
 * OC-Settings › Groceries (spec 021): where the family shops and whether the list rounds up to
 * store sizes. Saved at once for the whole family; a failed save reverts and says so.
 */
export function GrocerySettings({ settings, onChange, readOnly }: GrocerySettingsProps) {
  const [failed, setFailed] = useState(false);
  const change = async (update: FamilySettingsUpdate) => {
    setFailed((await onChange(update)) === 'failed');
  };
  return (
    <View className="gap-8">
      <Text size={18} weight="900" role="heading" aria-level={2}>
        {s.heading}
      </Text>
      <ListGroup>
        <SettingChoice
          label={s.shopLabel}
          hint={s.shopHint}
          example={{ lead: s.exampleNeed, strong: s.exampleAmount, result: s.exampleBuy[settings.store_profile] }}
          disabled={readOnly}
        >
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
        </SettingChoice>
        <SettingRow
          label={s.roundLabel}
          hint={s.roundHint}
          value={settings.round_to_packs}
          onValueChange={(round_to_packs) => void change({ round_to_packs })}
          disabled={readOnly}
          last
        />
      </ListGroup>
      {failed && !readOnly ? <StatusBanner tone="warn" message={s.saveFailed} /> : null}
    </View>
  );
}
