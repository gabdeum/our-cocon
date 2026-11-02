import { View } from 'react-native';
import { BackHeader, Button, Callout, Overline, PersonPill, Pill, PillRow, PushedScreen, RecipeItemSkeleton, SegmentedControl, Text } from '@cocon/ui';
import { memberInitials, type ActivityEntry } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { ActivityFilter } from '../../lib/activity';
import { assistantName } from '../../lib/recipe-format';
import type { Member } from '../../lib/session';
import { OfflineBanner } from '../sync/OfflineBanner';
import { ActivityEntries, type ActivityEntriesProps } from './ActivityEntries';

const a = strings.activity;

export interface ActivityScreenProps extends Omit<ActivityEntriesProps, 'entries' | 'members'> {
  /** Undefined while loading. Newest first. */
  entries: ActivityEntry[] | undefined;
  members: readonly Pick<Member, 'id' | 'user_id' | 'display_name' | 'color' | 'joined_at'>[];
  /** Who and which assistants ('other' for any we can't name) have entries: the filter pills (none shown with fewer than 2). */
  actors: readonly string[];
  sources: readonly string[];
  filter: ActivityFilter;
  onFilter: (filter: ActivityFilter) => void;
  failed?: boolean;
  onRetry: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onShowMore: () => void;
  onBack: () => void;
}

/**
 * Activity (OC-Activity, spec 026 FR-002): every change by the family and their AI assistants,
 * newest first, or AI changes only ("All · AI only", opened with Home's choice, spec 028 FR-006);
 * filterable by person, and under AI only by assistant. AI changes have Undo for 7 days.
 */
export function ActivityScreen({ entries, members, actors, sources, filter, onFilter, failed, onRetry, hasMore, loadingMore, onShowMore, onBack, ...rest }: ActivityScreenProps) {
  const initials = memberInitials(members);
  const people = members.filter((m): m is typeof m & { user_id: string } => m.user_id !== null && actors.includes(m.user_id));
  const filtered = Boolean(filter.actor || filter.source);
  const ai = Boolean(filter.ai);

  let body;
  if (entries === undefined && failed) {
    body = (
      <View className="gap-12">
        <Callout variant="warn" text={a.loadFailed} />
        <Button label={a.tryAgain} variant="soft" onPress={onRetry} />
      </View>
    );
  } else if (entries === undefined) {
    body = (
      <View role="progressbar" aria-label={a.loading}>
        <RecipeItemSkeleton />
      </View>
    );
  } else if (entries.length === 0) {
    body = filtered ? (
      <Text color="ink-muted">{a.noMatches}</Text>
    ) : (
      <View className="gap-6">
        <Text size={17} weight="900">
          {ai ? a.emptyTitle : a.allEmptyTitle}
        </Text>
        <Text color="ink-muted">{ai ? a.emptyBody : a.allEmptyBody}</Text>
      </View>
    );
  } else {
    body = (
      <View className="gap-12">
        <ActivityEntries entries={entries} members={members} {...rest} />
        {hasMore ? <Button label={a.showMore} variant="soft" disabled={loadingMore} onPress={onShowMore} /> : null}
      </View>
    );
  }

  return (
    <PushedScreen className="gap-18">
      <BackHeader backLabel={a.back} onBack={onBack} title={a.screenTitle} />
      <OfflineBanner screen="home" tracker={rest.tracker} />
      <SegmentedControl
        variant="pill"
        label={a.show}
        segments={[
          { key: 'all', label: a.all },
          { key: 'ai', label: a.aiOnly },
        ]}
        value={ai ? 'ai' : 'all'}
        // An assistant pill only applies to AI only.
        onChange={(to: 'all' | 'ai') => onFilter(to === 'ai' ? { ...filter, ai: true } : { actor: filter.actor ?? null })}
      />
      {people.length > 1 ? (
        <View className="gap-6">
          <Overline>{a.people}</Overline>
          <PillRow>
            {people.map((m) => (
              <PersonPill
                key={m.id}
                label={m.display_name}
                initial={initials.get(m.id) ?? '?'}
                color={m.color}
                selected={filter.actor === m.user_id}
                onPress={() => onFilter({ ...filter, actor: filter.actor === m.user_id ? null : m.user_id })}
              />
            ))}
          </PillRow>
        </View>
      ) : null}
      {ai && sources.length > 1 ? (
        <View className="gap-6">
          <Overline>{a.assistants}</Overline>
          <PillRow>
            {sources.map((s) => (
              <Pill
                key={s}
                label={s === 'other' ? a.otherAssistant : (assistantName(s) ?? a.otherAssistant)}
                selected={filter.source === s}
                onPress={() => onFilter({ ...filter, source: filter.source === s ? null : s })}
              />
            ))}
          </PillRow>
        </View>
      ) : null}
      {body}
    </PushedScreen>
  );
}
