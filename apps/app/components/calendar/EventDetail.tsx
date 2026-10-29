import { useState } from 'react';
import { View } from 'react-native';
import { dateLabel, viewFor, type SlotTimes, type WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import type { Tracker } from '@cocon/schemas';
import { BackLink, BottomSheet, Button, ChecklistRow, DateGrid, Dialog, IconRow, Link, ListGroup, MemberBadge, PushedScreen, Tag, Text } from '@cocon/ui';
import { firstOfMonth, weekdayLetters } from '../../lib/calendar-month';
import type { DeleteScope } from '../../lib/event-delete';
import { addedLine, deleteBody, mapsUrl, memberBadges, reminderLines, repeatLine, responsibleLine, whenLines } from '../../lib/event-detail';
import { dateGridMonth, shiftMonth } from '../../lib/event-form';
import type { Member } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';

const e = strings.calendar.event;
const a = strings.calendar.add;

export interface EventDetailProps {
  /** The event as loaded (the series, for Delete). */
  event: StoredEvent;
  /** The date shown: `event` with its occurrence's day and "this event only" changes. */
  occurrence: StoredEvent;
  /** The occurrence's series date (`?date=`). */
  date: string;
  members: readonly Member[];
  myMemberId: string;
  slotTimes: SlotTimes;
  today: string;
  weekStartsOn: WeekStartsOn;
  tracker: Tracker;
  /** 'ios', 'web'…: which maps app "Open in Maps" opens. */
  os: string;
  /** Offline: readable, nothing changes (decision 11). */
  readOnly?: boolean;
  now?: Date;
  onBack: () => void;
  onEdit: () => void;
  onShare: () => void;
  onOpenUrl: (url: string) => void;
  onTick: (itemId: string, done: boolean) => Promise<void>;
  /** Deletes for the scope and returns the Undo; the page then closes. */
  onDelete: (scope: DeleteScope) => Promise<() => Promise<void>>;
  /** Copies the occurrence to `date` and returns the Undo. */
  onDuplicate: (date: string) => Promise<() => Promise<void>>;
  /** After an Undo, so the calendar shows it. */
  onChanged: () => void;
}

/**
 * OC-CalEvent (spec 042): everything about one date of an event, its live "Bring" checklist, and
 * Edit, Duplicate, Share and Delete (OC-CalEventDelete). Rows without a value are hidden (FR-001).
 */
export function EventDetail(p: EventDetailProps) {
  const { event, occurrence: o, members } = p;
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Ticks shown at once, until the next load (a new checklist) brings them back from the database.
  const [pending, setPending] = useState<{ of: StoredEvent['checklist']; done: Record<string, boolean> }>({ of: event.checklist, done: {} });
  const ticks = pending.of === event.checklist ? pending.done : {};
  const setTick = (id: string, done: boolean) => setPending((t) => ({ of: event.checklist, done: { ...(t.of === event.checklist ? t.done : {}), [id]: done } }));

  const when = whenLines(o, p.slotTimes);
  const repeat = repeatLine(event);
  const responsible = responsibleLine(o.responsible_member_id, o.members, members);
  const reminder = reminderLines(o, members);
  const badges = memberBadges(o, members);
  const checklist = event.checklist ?? [];
  const ownEvent = event.creator_member_id === p.myMemberId;
  const shareable = event.visibility === 'family' && o.ends_on >= p.today;
  const surprise = viewFor(o, p.myMemberId).is_surprise;
  const off = p.readOnly || busy;

  const rows = [
    { icon: 'clock' as const, title: when.title, sub: when.sub },
    repeat ? { icon: 'repeat' as const, title: repeat } : null,
    o.location
      ? { icon: 'pin' as const, title: o.location, action: { label: e.openInMaps, accessibilityLabel: e.openInMapsA11y(o.location), onPress: () => p.onOpenUrl(mapsUrl(o.location ?? '', p.os)) } }
      : null,
    responsible ? { icon: 'car' as const, title: responsible } : null,
    reminder ? { icon: 'bell' as const, ...reminder } : null,
  ].filter((r) => r !== null);

  const tick = async (id: string, done: boolean) => {
    setTick(id, done);
    try {
      await p.onTick(id, done);
      if (done) p.tracker.track('event_checklist_ticked', {});
    } catch {
      setTick(id, !done);
      toast.show({ text: e.tickFailed, tone: 'warn' });
    }
  };

  const remove = async (scope: DeleteScope) => {
    setDialog(false);
    setBusy(true);
    try {
      const undo = await p.onDelete(scope);
      p.tracker.track('event_deleted', { scope, own_event: ownEvent, undone: false });
      toast.show({
        text: e.deleted,
        onUndo: () =>
          undo()
            .then(() => p.tracker.track('event_deleted', { scope, own_event: ownEvent, undone: true }))
            .finally(p.onChanged),
      });
    } catch {
      setBusy(false);
      toast.show({ text: e.deleteFailed, tone: 'warn' });
    }
  };

  const duplicate = async (date: string) => {
    setPicking(null);
    setBusy(true);
    try {
      const undo = await p.onDuplicate(date);
      p.tracker.track('event_duplicated', {});
      toast.show({ text: e.copied(dateLabel(date)), onUndo: () => undo().finally(p.onChanged) });
    } catch {
      toast.show({ text: e.duplicateFailed, tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const grid = picking ? dateGridMonth(picking, p.today, p.weekStartsOn) : null;

  return (
    <PushedScreen className="gap-16">
      <BackLink label={e.back} onPress={p.onBack} />
      <OfflineBanner screen="calendar" tracker={p.tracker} />

      <View className="gap-10">
        {o.category || surprise ? (
          <View className="flex-row gap-8 self-start">
            {o.category ? <Tag label={a.types[o.category]} tone="soft" size="md" /> : null}
            {/* Spec 043: only those in on it see the event itself, so they're the ones who get the tag. */}
            {surprise ? <Tag label={e.surprise} tone="sage" size="md" /> : null}
          </View>
        ) : null}
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

      {checklist.length ? (
        <View className="gap-8">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {e.bring}
          </Text>
          <ListGroup inset>
            {checklist.map((c, i) => {
              const done = ticks[c.id] ?? c.done;
              return <ChecklistRow key={c.id} label={c.label} done={done} onToggle={() => void tick(c.id, !done)} disabled={off} last={i === checklist.length - 1} />;
            })}
          </ListGroup>
          <Text size={14} weight="600" color="ink-muted">
            {e.bringHint}
          </Text>
        </View>
      ) : null}

      <Text size={14} weight="700" color="ink-muted">
        {addedLine(event, members, p.now)}
      </Text>

      <View className="gap-10">
        <View className="flex-row gap-10">
          <View className="flex-1">
            <Button label={e.edit} variant="olive" size="dialog" block disabled={off} onPress={p.onEdit} />
          </View>
          <View className="flex-1">
            <Button label={e.duplicate} variant="soft" size="dialog" block disabled={off} onPress={() => setPicking(firstOfMonth(o.starts_on))} />
          </View>
        </View>
        {shareable ? <Button label={e.share} variant="soft" size="dialog" block disabled={off} onPress={p.onShare} /> : null}
        <View className="items-center">
          <Link label={e.delete} tone="danger" size={16} disabled={off} onPress={() => setDialog(true)} />
        </View>
      </View>

      {grid && picking ? (
        <BottomSheet visible onClose={() => setPicking(null)} title={a.pickDateTitle} closeLabel={a.close}>
          <DateGrid
            title={grid.title}
            weekdays={weekdayLetters(p.weekStartsOn)}
            weeks={grid.weeks}
            selected={null}
            onSelect={(date) => void duplicate(date)}
            previous={{ label: a.previousMonth, onPress: () => setPicking(shiftMonth(picking, -1)) }}
            next={{ label: a.nextMonth, onPress: () => setPicking(shiftMonth(picking, 1)) }}
          />
        </BottomSheet>
      ) : null}

      <Dialog
        visible={dialog}
        title={e.deleteTitle(o.title)}
        body={deleteBody(event, p.myMemberId, members)}
        confirmLabel={event.recurrence ? e.onlyThis : e.deleteConfirm}
        onConfirm={() => void remove(event.recurrence ? 'this' : 'all')}
        {...(event.recurrence ? { secondaryLabel: e.thisAndFuture, onSecondary: () => void remove('future') } : {})}
        cancelLabel={e.keep}
        onCancel={() => setDialog(false)}
      />
    </PushedScreen>
  );
}
