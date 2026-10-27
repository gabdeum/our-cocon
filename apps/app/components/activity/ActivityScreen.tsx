import { View } from 'react-native';
import { BackHeader, Button, Callout, Overline, PersonPill, Pill, PillRow, PushedScreen, RecipeItemSkeleton, Text } from '@cocon/ui';
import type { ActivityEntry } from '@cocon/schemas';
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
  members: readonly Pick<Member, 'user_id' | 'display_name' | 'avatar_tone'>[];
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
 * AI activity (OC-Activity, spec 026 FR-002): every AI change, newest first, filterable by the
 * person who asked and the assistant, each with Undo for 7 days.
 */
export function ActivityScreen({ entries, members, actors, sources, filter, onFilter, failed, onRetry, hasMore, loadingMore, onShowMore, onBack, ...rest }: ActivityScreenProps) {
  const people = members.filter((m) => actors.includes(m.user_id));
  const filtered = Boolean(filter.actor || filter.source);

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
          {a.emptyTitle}
        </Text>
        <Text color="ink-muted">{a.emptyBody}</Text>
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
      {people.length > 1 ? (
        <View className="gap-6">
          <Overline>{a.people}</Overline>
          <PillRow>
            {people.map((m) => (
              <PersonPill
                key={m.user_id}
                label={m.display_name}
                initial={m.display_name.charAt(0).toUpperCase()}
                tone={m.avatar_tone}
                selected={filter.actor === m.user_id}
                onPress={() => onFilter({ ...filter, actor: filter.actor === m.user_id ? null : m.user_id })}
              />
            ))}
          </PillRow>
        </View>
      ) : null}
      {sources.length > 1 ? (
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
