import { router, type Href } from 'expo-router';
import { GroceriesSettingsPage } from '../../components/settings/GrocerySettings';
import { useFamilySettings } from '../../lib/family-settings';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/groceries (spec 029, OC-SettingsGroceries): the same family settings as the Groceries tab's sheet. */
export default function GroceriesSettingsRoute() {
  const { tracker } = useSession();
  const online = useOnline();
  const { settings, change } = useFamilySettings();
  return (
    <GroceriesSettingsPage
      settings={settings}
      onChange={change}
      tracker={tracker}
      readOnly={!online}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu' as Href))}
    />
  );
}
