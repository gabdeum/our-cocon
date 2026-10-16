import { Tabs } from 'expo-router';
import { AppTabBar } from '../../components/AppTabBar';
import { TABS } from '../../lib/navigation';
import { tracker } from '../../lib/tracker';

/** The four tab screens behind the floating tab bar (spec 002). Nothing else lives in (tabs). */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} tracker={tracker} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.route} name={t.route} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
