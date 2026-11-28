import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Tracker } from '@cocon/schemas';
import { AppGrid, cn, ListGroup, ListRow, TabHeader, TabScreen, Text, useLayoutTier } from '@cocon/ui';
import { APPS, SETTINGS_PAGES, type AppKey, type SettingsPage } from '../../lib/apps';
import { strings } from '../../strings';
import { OfflineBanner } from '../sync/OfflineBanner';

const m = strings.menu;

export interface MenuScreenProps {
  /** Each tile's live detail ("3 today"); none while it loads. */
  details: Partial<Record<AppKey, string>>;
  /** Settings rows: "Gabriel, Eva, James", how many assistants are connected and items deleted (undefined while loading). */
  memberNames: readonly string[];
  connected?: number;
  deleted?: number;
  /** Notifications are off for the app in iPhone Settings: the row's detail reads "Off" (spec 046). */
  notificationsOff?: boolean;
  /** Spec 076: the language the app is in, in its own words. */
  languageName?: string;
  tracker: Tracker;
  /** A tile switches tabs (or opens Timers or Reminders); a row pushes its settings page. */
  onNavigate: (href: string) => void;
  footer?: ReactNode;
}

function Heading({ children }: { children: string }) {
  return (
    <Text size={18} weight="900" role="heading" aria-level={2}>
      {children}
    </Text>
  );
}

/** The Menu tab (spec 029, design/ui/OC-Menu.md): Apps, then Settings. */
export function MenuScreen({ details, memberNames, connected, deleted, notificationsOff, languageName, tracker, onNavigate, footer }: MenuScreenProps) {
  const wide = useLayoutTier().tier !== 'compact';
  const openApp = (app: (typeof APPS)[number]) => {
    tracker.track('menu_app_opened', { app: app.key });
    onNavigate(app.href);
  };
  const open = (row: SettingsPage) => {
    tracker.track('settings_row_opened', { row });
    onNavigate(SETTINGS_PAGES[row]);
  };
  const row = (key: SettingsPage, icon: 'people' | 'sparkle' | 'bell' | 'message' | 'calendar' | 'recipes' | 'groceries', title: string, sub: string | undefined, last = false, subTone?: 'olive' | 'warn') => (
    <ListRow key={key} title={title} sub={sub} subTone={subTone} leading={{ kind: 'icon', icon }} trailing={{ kind: 'chevron' }} onPress={() => open(key)} last={last} />
  );
  return (
    <TabScreen pinned={<TabHeader title={m.title} />}>
      <OfflineBanner screen="menu" tracker={tracker} />
      <View className="gap-10">
        <Heading>{m.apps}</Heading>
        <AppGrid label={m.apps} apps={APPS.map((app) => ({ key: app.key, icon: app.icon, name: app.name, detail: details[app.key], onPress: () => openApp(app) }))} />
      </View>
      <View className="gap-10">
        <Heading>{m.settings}</Heading>
        {/* From 600, two columns: you and your family, then each app's settings and Recently deleted. */}
        <View className={wide ? 'flex-row items-start gap-14' : 'gap-10'}>
          <View className={wide ? 'flex-1 basis-0' : undefined}>
            <ListGroup>
              {row('family', 'people', m.family, m.familyDetail(memberNames))}
              {connected === undefined
                ? row('ai', 'sparkle', m.aiAssistants, undefined)
                : connected > 0
                  ? row('ai', 'sparkle', m.aiAssistants, m.connected(connected), false, 'olive')
                  : row('ai', 'sparkle', m.aiAssistants, m.notConnected)}
              {notificationsOff
                ? row('notifications', 'bell', m.notifications, m.notificationsOff, false, 'warn')
                : row('notifications', 'bell', m.notifications, m.notificationsDetail)}
              {row('language', 'message', m.language, languageName, true)}
            </ListGroup>
          </View>
          <View className={cn('gap-10', wide && 'flex-1 basis-0')}>
            <ListGroup>
              {row('calendar', 'calendar', m.calendar, m.calendarDetail)}
              {row('recipes', 'recipes', m.recipes, m.recipesDetail)}
              {row('groceries', 'groceries', m.groceries, m.groceriesDetail, true)}
            </ListGroup>
            <ListGroup>
              <ListRow
                title={m.recentlyDeleted}
                trailing={{ kind: 'chevron', text: deleted === undefined ? undefined : m.items(deleted) }}
                onPress={() => open('deleted')}
                last
              />
            </ListGroup>
          </View>
        </View>
      </View>
      {footer}
    </TabScreen>
  );
}
