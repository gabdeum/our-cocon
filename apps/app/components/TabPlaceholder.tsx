import { TabHeader, TabScreen } from '@cocon/ui';
import { DebugFooter } from './DebugFooter';
import { config } from '../lib/tracker';

/** A tab screen until its spec builds it (Home 028, Recipes 006, Groceries 020, Settings 029). */
export function TabPlaceholder({ title }: { title: string }) {
  return (
    <TabScreen>
      <TabHeader title={title} />
      <DebugFooter config={config} />
    </TabScreen>
  );
}
