import { LatestActivityCard, Link, SegmentedControl, Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import { ActivityEntries, type ActivityEntriesProps } from './ActivityEntries';

const a = strings.activity;

export type ActivityShow = 'all' | 'ai';

export interface ActivitySectionProps extends ActivityEntriesProps {
  /** "All" or "AI only": not remembered, All each time Home opens. */
  show: ActivityShow;
  onShow: (to: ActivityShow) => void;
  /** The activity list, with the same filter. */
  onSeeAll: () => void;
}

/**
 * Home's "Latest activity" (OC-Home › 6, spec 028 FR-006): the 4 newest changes by anyone, or by AI
 * assistants only, AI ones with Undo, then "See all activity". Hidden while the log is empty.
 */
export function ActivitySection({ show, onShow, onSeeAll, ...props }: ActivitySectionProps) {
  if (show === 'all' && props.entries.length === 0) return null;
  return (
    <LatestActivityCard
      title={a.latest}
      toggle={
        <SegmentedControl
          variant="pill"
          label={a.show}
          segments={[
            { key: 'all', label: a.all },
            { key: 'ai', label: a.aiOnly },
          ]}
          value={show}
          onChange={(to: ActivityShow) => {
            if (to !== show) onShow(to);
          }}
        />
      }
      footer={<Link label={a.seeAll} onPress={onSeeAll} />}
    >
      {props.entries.length ? (
        <ActivityEntries {...props} />
      ) : (
        <Text size={15} weight="700" color="ink-muted">
          {a.noAi}
        </Text>
      )}
    </LatestActivityCard>
  );
}
