import { TabHeader, TabScreen } from '@cocon/ui';
import { DebugFooter } from './DebugFooter';
import { OfflineBanner, type OfflineScreen } from './sync/OfflineBanner';
import { config, tracker } from '../lib/tracker';

/** A tab screen until its spec builds it (Home 028, Groceries 020). */
export function TabPlaceholder({ title, screen }: { title: string; screen: OfflineScreen }) {
  return (
    <TabScreen>
      <TabHeader title={title} />
      <OfflineBanner screen={screen} tracker={tracker} />
      <DebugFooter config={config} />
    </TabScreen>
  );
}
