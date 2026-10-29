import { View } from 'react-native';
import { Button, IconRow, ListGroup, PublicScreen, Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import type { SharedEventLoad } from '../../lib/shared-event';

const v = strings.sharedView;
const e = strings.calendar.event;

export interface SharedEventProps {
  /** Undefined while loading; 'failed' when the endpoint couldn't be reached. */
  load: SharedEventLoad | 'failed' | undefined;
  onRetry: () => void;
}

/**
 * The public shared event page `/e/[token]` (spec 042 FR-005; OC-CalEvent.md › Shared event
 * page): the title, day, time, place and first names, view only. No notes, checklist or names in full.
 */
export function SharedEvent({ load, onRetry }: SharedEventProps) {
  if (load === undefined) {
    return (
      <PublicScreen brand={v.brand} tag={v.viewOnly}>
        <View role="progressbar" aria-label={e.loading} className="gap-12">
          <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
          {[0, 1].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PublicScreen>
    );
  }
  if (load === 'failed') {
    return (
      <PublicScreen brand={v.brand} tag={v.viewOnly}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {e.sharedLoadFailedTitle}
        </Text>
        <Text color="ink-muted">{e.sharedLoadFailedBody}</Text>
        <Button label={e.retry} variant="soft" onPress={onRetry} />
      </PublicScreen>
    );
  }
  if (load.kind === 'not_shared') {
    return (
      <PublicScreen brand={v.brand} tag={v.viewOnly}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {e.noLongerTitle}
        </Text>
        <Text color="ink-muted">{e.noLongerBody}</Text>
      </PublicScreen>
    );
  }
  const ev = load.event;
  return (
    <PublicScreen brand={v.brand} tag={v.viewOnly}>
      <View className="gap-8">
        <Text size={30} weight="900" role="heading" aria-level={1}>
          {ev.title}
        </Text>
        {ev.with ? (
          <Text size={16} weight="700" color="ink-muted">
            {ev.with}
          </Text>
        ) : null}
      </View>
      <ListGroup inset>
        <IconRow icon="clock" title={ev.when.title} sub={ev.when.sub} last={!ev.place} />
        {ev.place ? <IconRow icon="pin" title={ev.place} last /> : null}
      </ListGroup>
    </PublicScreen>
  );
}
