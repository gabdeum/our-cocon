import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Tracker } from '@cocon/schemas';
import { AppGrid, ListGroup, ListRow, TabHeader, TabScreen, Text } from '@cocon/ui';
import { APPS, SETTINGS_PAGES, type AppKey, type SettingsPage } from '../../lib/apps';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';

const m = strings.menu;

export interface MenuScreenProps {
  /** Each tile's live detail ("3 today"); none while it loads. */
  details: Partial<Record<AppKey, string>>;
  /** Settings rows: "Gabriel, Eva, James", how many assistants are connected and items deleted (undefined while loading). */
  memberNames: readonly string[];
  connected?: number;
  deleted?: number;
  tracker: Tracker;
  /** A tile switches tabs (or opens Timers); a row pushes its settings page. */
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
export function MenuScreen({ details, memberNames, connected, deleted, tracker, onNavigate, footer }: MenuScreenProps) {
  const openApp = (app: (typeof APPS)[number]) => {
    tracker.track('menu_app_opened', { app: app.key });
    onNavigate(app.href);
  };
  const open = (row: SettingsPage) => {
    tracker.track('settings_row_opened', { row });
    onNavigate(SETTINGS_PAGES[row]);
  };
  const row = (key: SettingsPage, icon: 'people' | 'sparkle' | 'calendar' | 'recipes' | 'groceries', title: string, sub: string | undefined, last = false, subTone?: 'olive') => (
    <ListRow key={key} title={title} sub={sub} subTone={subTone} leading={{ kind: 'icon', icon }} trailing={{ kind: 'chevron' }} onPress={() => open(key)} last={last} />
  );
  return (
    <TabScreen>
      <TabHeader title={m.title} />
      <OfflineBanner screen="menu" tracker={tracker} />
      <View className="gap-10">
        <Heading>{m.apps}</Heading>
        <AppGrid label={m.apps} apps={APPS.map((app) => ({ key: app.key, icon: app.icon, name: app.name, detail: details[app.key], onPress: () => openApp(app) }))} />
      </View>
      <View className="gap-10">
        <Heading>{m.settings}</Heading>
        <ListGroup>
          {row('family', 'people', m.family, m.familyDetail(memberNames))}
          {connected === undefined
            ? row('ai', 'sparkle', m.aiAssistants, undefined, true)
            : connected > 0
              ? row('ai', 'sparkle', m.aiAssistants, m.connected(connected), true, 'olive')
              : row('ai', 'sparkle', m.aiAssistants, m.notConnected, true)}
        </ListGroup>
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
      {footer}
    </TabScreen>
  );
}
