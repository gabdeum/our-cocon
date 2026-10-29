import { View } from 'react-native';
import type { SlotTimes } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { BackLink, Card, IconRow, ListGroup, MemberBadge, PushedScreen, Text } from '@cocon/ui';
import { addedLine, mapsUrl, memberBadges, whenLines } from '../../lib/event-detail';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

const e = strings.calendar.event;
const a = strings.calendar.add;

export interface SurpriseDetailProps {
  /** The cover, as `events_visible` gives it to the person the surprise is hidden from. */
  occurrence: StoredEvent;
  members: readonly Member[];
  slotTimes: SlotTimes;
  /** 'ios', 'web'…: which maps app "Open in Maps" opens. */
  os: string;
  now?: Date;
  onBack: () => void;
  onOpenUrl: (url: string) => void;
}

/**
 * OC-CalSurprise (spec 043): a surprise as the person it's kept from sees it. The cover title, who
 * it's for, the time, the place and the creator's note; nothing to edit, copy, share or delete
 * (they don't know there's anything else, FR-005).
 */
export function SurpriseDetail({ occurrence: o, members, slotTimes, os, now, onBack, onOpenUrl }: SurpriseDetailProps) {
  const when = whenLines(o, slotTimes);
  const badges = memberBadges(o, members);
  const creator = members.find((m) => m.id === o.creator_member_id)?.display_name ?? strings.recipe.formerMember;
  const rows = [
    { icon: 'clock' as const, title: when.title, sub: when.sub },
    o.location ? { icon: 'pin' as const, title: o.location, action: { label: e.openInMaps, accessibilityLabel: e.openInMapsA11y(o.location), onPress: () => onOpenUrl(mapsUrl(o.location ?? '', os)) } } : null,
  ].filter((r) => r !== null);

  return (
    <PushedScreen className="gap-16">
      <BackLink label={e.back} onPress={onBack} />
      <View className="gap-10">
        <Text size={30} weight="900" role="heading" aria-level={1}>
          {o.title}
        </Text>
        {badges.length ? (
          <View role="list" aria-label={a.who} className="flex-row flex-wrap gap-8">
            {badges.map((b) => (
              <MemberBadge key={b.key} name={b.name} initial={b.initial} color={b.color} />
            ))}
          </View>
        ) : null}
      </View>

      <ListGroup inset>
        {rows.map((r, i) => (
          <IconRow key={r.icon} {...r} last={i === rows.length - 1} />
        ))}
      </ListGroup>

      {o.notes ? (
        <Card tone="sage">
          <Text variant="overline" color="olive-deep" uppercase role="heading" aria-level={2}>
            {e.noteFrom(creator)}
          </Text>
          <Text size={18} weight="800" style={{ lineHeight: 18 * 1.4 }}>
            {o.notes}
          </Text>
        </Card>
      ) : null}

      <Text size={14} weight="700" color="ink-muted">
        {addedLine(o, members, now)}
      </Text>
    </PushedScreen>
  );
}
