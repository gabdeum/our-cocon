import { router } from 'expo-router';
import { RecipesSettings } from '../../components/settings/RecipesSettings';
import { useFamilySettings, useMyRecipeSettings } from '../../lib/family-settings';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/recipes (spec 027, OC-SettingsRecipes): the member's own units (spec 051) and the family's cooking defaults, pushed from the Menu. */
export default function RecipesSettingsRoute() {
  const { tracker } = useSession();
  const online = useOnline();
  const { settings, change } = useFamilySettings();
  const { settings: mine, changeUnits } = useMyRecipeSettings();
  return (
    <RecipesSettings
      settings={settings}
      onChange={change}
      units={mine.units ?? settings.units}
      onUnitsChange={changeUnits}
      tracker={tracker}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu'))}
      readOnly={!online}
    />
  );
}
