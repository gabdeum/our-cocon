import { railInset, useLayoutTier } from '@cocon/ui';
import { Tabs, router } from 'expo-router';
import { AppTabBar } from '../../components/AppTabBar';
import { RAIL_PAGES, TABS } from '../../lib/navigation';
import { tracker } from '../../lib/tracker';

/**
 * The tab screens behind the floating tab bar (spec 002), or beside the side rail from 960 wide
 * (spec 064): their content then starts after the rail. Nothing else lives in (tabs).
 */
export default function TabsLayout() {
  const { tier } = useLayoutTier();
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} tracker={tracker} onOpenTimers={() => router.push('/timers')} onOpenPage={(key) => router.push(RAIL_PAGES[key])} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent', paddingLeft: railInset(tier) } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.route} name={t.route} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
