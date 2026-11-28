import { router } from 'expo-router';
import { LanguageSettings } from '../../components/settings/LanguageSettings';
import { useLanguage } from '../../lib/language';

/** /settings/language (spec 076): the language the app is in, pushed from the Menu. */
export default function LanguageSettingsRoute() {
  const { setting, deviceLanguage, choose } = useLanguage();
  return (
    <LanguageSettings
      setting={setting}
      deviceLanguage={deviceLanguage}
      onChoose={choose}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu'))}
    />
  );
}
