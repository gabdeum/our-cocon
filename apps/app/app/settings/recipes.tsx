import { router } from 'expo-router';
import { RecipesSettings } from '../../components/settings/RecipesSettings';
import { useFamilySettings } from '../../lib/family-settings';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/recipes (spec 027, OC-SettingsRecipes): the family's cooking defaults, pushed from Settings › More. */
export default function RecipesSettingsRoute() {
  const { tracker } = useSession();
  const online = useOnline();
  const { settings, change } = useFamilySettings();
  return (
    <RecipesSettings
      settings={settings}
      onChange={change}
      tracker={tracker}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      readOnly={!online}
    />
  );
}
