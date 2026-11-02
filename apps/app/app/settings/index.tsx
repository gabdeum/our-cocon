import { Redirect, type Href } from 'expo-router';

/** The old /settings (spec 029 FR-001): Settings became the Menu tab. */
export default function SettingsRedirect() {
  return <Redirect href={'/menu' as Href} />;
}
