import { router, type Href } from 'expo-router';
import { NotificationSettings } from '../../components/settings/NotificationSettings';
import { useCalendarPrefs } from '../../lib/calendar-prefs';
import { useNotifications } from '../../lib/notifications-context';
import { useOnline } from '../../lib/online';
import { useSession } from '../../lib/session';

/** /settings/notifications (spec 046, OC-SettingsNotif): this phone's switches and the member's default reminder. */
export default function NotificationSettingsRoute() {
  const { state, tracker } = useSession();
  const online = useOnline();
  const notifications = useNotifications();
  const { prefs, change } = useCalendarPrefs();
  if (state.status !== 'ready') return null;
  return (
    <NotificationSettings
      supported={notifications.supported}
      status={notifications.status}
      prefs={notifications.prefs}
      onPref={notifications.setPref}
      defaultReminder={prefs.default_reminder}
      onDefaultReminder={(default_reminder) => change({ default_reminder })}
      managedNames={state.members.filter((m) => m.user_id === null).map((m) => m.display_name)}
      onTurnOn={() => void notifications.turnOn('settings')}
      onOpenSettings={notifications.openSettings}
      tracker={tracker}
      readOnly={!online}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu' as Href))}
    />
  );
}
