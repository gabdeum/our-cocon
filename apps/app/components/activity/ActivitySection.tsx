import { View } from 'react-native';
import { Link } from '@cocon/ui';
import { strings } from '../../strings/en';
import { ActivityEntries, type ActivityEntriesProps } from './ActivityEntries';

/**
 * Home's activity card (OC-Home › 5, spec 026 FR-002): the latest 2 AI changes with Undo, then
 * "See all" for the whole list. Hidden while there is no AI activity (OC-Home › States).
 */
export function ActivitySection({ onSeeAll, ...props }: ActivityEntriesProps & { onSeeAll: () => void }) {
  if (props.entries.length === 0) return null;
  return (
    <View className="gap-4">
      <ActivityEntries {...props} />
      <Link label={strings.activity.seeAll} onPress={onSeeAll} />
    </View>
  );
}
