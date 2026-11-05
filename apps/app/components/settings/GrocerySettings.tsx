import { View } from 'react-native';
import { Card, Lead, PushedScreen, SegmentedControl, SettingRow, Text } from '@cocon/ui';
import type { FamilySettings, FamilySettingsUpdate, StoreProfile, Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useToast } from '../../lib/toast';
import { OfflineBanner } from '../sync/OfflineBanner';

const s = strings.settings.groceries;

export interface GrocerySettingsProps {
  settings: FamilySettings;
  onChange: (change: FamilySettingsUpdate) => Promise<'saved' | 'failed'>;
  readOnly?: boolean;
  /** `sheet`: the Groceries tab's sheet (spec 021). `page`: Menu › Groceries, in white cards (spec 029). */
  layout?: 'sheet' | 'page';
}

/**
 * Spec 021: where the family shops and whether the list rounds up to store sizes, in the Groceries
 * tab's settings sheet. Laid out like the other sheets (Patterns.md › Bottom sheet, OC-Filters): a
 * 16/900 section heading and its control on the sheet itself, then the switch as a boxed
 * SettingRow. On Menu › Groceries (spec 029, OC-SettingsGroceries) the same controls and copy sit
 * in white cards under an 18/900 heading. Saved at once for the whole family; a failed save
 * reverts and says so.
 */
export function GrocerySettings({ settings, onChange, readOnly, layout = 'sheet' }: GrocerySettingsProps) {
  const toast = useToast();
  const page = layout === 'page';
  const change = async (update: FamilySettingsUpdate) => {
    if ((await onChange(update)) === 'failed') toast.show({ text: s.saveFailed, tone: 'warn' });
  };
  const shop = (
    <>
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
    </>
  );
  const round = (
    <SettingRow
      boxed={!page}
      label={s.roundLabel}
      hint={s.roundHint}
      value={settings.round_to_packs}
      onValueChange={(round_to_packs) => void change({ round_to_packs })}
      disabled={readOnly}
    />
  );
  return (
    <View className={page ? 'gap-18' : 'gap-16'}>
      <View className="gap-8">
        <View>
          <Text size={page ? 18 : 16} weight="900" role="heading" aria-level={page ? 2 : 3}>
            {s.shopLabel}
          </Text>
          <Text variant="caption" color="ink-muted">
            {s.shopHint}
          </Text>
        </View>
        {page ? <Card className="gap-10 p-16">{shop}</Card> : shop}
      </View>
      {page ? <Card className="gap-0 px-16 py-4">{round}</Card> : round}
    </View>
  );
}

/** Menu › Groceries (`/settings/groceries`, spec 029): the same family settings as the Groceries tab's sheet. */
export function GroceriesSettingsPage({ onBack, tracker, ...props }: Omit<GrocerySettingsProps, 'layout'> & { onBack: () => void; tracker: Tracker }) {
  return (
    <PushedScreen className="gap-18" topBar={{ back: { label: s.back, onPress: onBack }, title: s.title }}>
      <Lead>{s.lead}</Lead>
      <OfflineBanner screen="settings" tracker={tracker} />
      <GrocerySettings {...props} layout="page" />
    </PushedScreen>
  );
}
