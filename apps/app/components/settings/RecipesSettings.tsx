import { useState } from 'react';
import { View } from 'react-native';
import { BackHeader, Card, PushedScreen, SegmentedControl, SettingRow, StatusBanner, Text } from '@cocon/ui';
import type { FamilySettings, FamilySettingsUpdate, Tracker, UnitSystem } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';

const s = strings.settings.recipes;

export interface RecipesSettingsProps {
  settings: FamilySettings;
  onChange: (change: FamilySettingsUpdate) => Promise<'saved' | 'failed'>;
  onBack: () => void;
  tracker: Tracker;
  /** Offline: the settings show, but can't change (decision 11). */
  readOnly?: boolean;
}

/**
 * Spec 027 FR-006 (design/ui/OC-SettingsRecipes.md): the family's cooking defaults, used by every
 * recipe that hasn't changed them in its own settings. Saved at once for the whole family; a
 * failed save reverts and says so.
 */
export function RecipesSettings({ settings, onChange, onBack, tracker, readOnly }: RecipesSettingsProps) {
  const [failed, setFailed] = useState(false);
  const change = async (update: FamilySettingsUpdate) => {
    setFailed((await onChange(update)) === 'failed');
  };
  return (
    <PushedScreen className="gap-18">
      <BackHeader backLabel={s.back} onBack={onBack} title={s.title} lead={s.lead} />
      <OfflineBanner screen="settings" tracker={tracker} />
      <View role="region" aria-label={s.cookingDefaults} className="gap-8">
        <Text size={18} weight="900" role="heading" aria-level={2}>
          {s.cookingDefaults}
        </Text>
        <Card className="gap-0 px-16 py-4">
          <SettingRow label={s.keepAwake} hint={s.keepAwakeHint} value={settings.keep_awake} onValueChange={(on) => void change({ keep_awake: on })} disabled={readOnly} />
          <SettingRow label={s.kitchenScale} hint={s.kitchenScaleHint} value={settings.has_scale} onValueChange={(on) => void change({ has_scale: on })} disabled={readOnly} />
          <SettingRow
            label={s.thermometer}
            hint={s.thermometerHint}
            value={settings.has_thermometer}
            onValueChange={(on) => void change({ has_thermometer: on })}
            disabled={readOnly}
          />
          <View className="gap-10 py-14">
            <Text size={16} weight="800">
              {s.units}
            </Text>
            <SegmentedControl<UnitSystem>
              label={s.units}
              value={settings.units}
              onChange={(units) => void change({ units })}
              segments={[
                { key: 'metric', label: s.metric },
                { key: 'imperial', label: s.imperial },
              ]}
              disabled={readOnly}
            />
          </View>
        </Card>
      </View>
      {failed && !readOnly ? <StatusBanner tone="warn" message={s.saveFailed} /> : null}
    </PushedScreen>
  );
}
