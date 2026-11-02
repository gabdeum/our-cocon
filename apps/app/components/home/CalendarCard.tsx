import { useState } from 'react';
import { View } from 'react-native';
import type { HomeCardState } from '@cocon/schemas';
import { Button, CalCard, CalCardBanner, EventListRow, Link, SegmentedControl, Text, WeekEventRow, WeekStrip } from '@cocon/ui';
import type { CardLayout } from '../../lib/home';
import { strings } from '../../strings/en';

const c = strings.calCard;

type CardView = 'today' | 'week';

export interface CalendarCardProps {
  layout: CardLayout;
  /** Offline: "+" is off (decision 11). */
  readOnly?: boolean;
  /** A row's occurrence key ("id|date") and the day it was tapped on. */
  onOpenEvent: (key: string, section: CardView, cardState: HomeCardState) => void;
  onOpenDay: (date: string) => void;
  onAdd: (date: string, cardState: HomeCardState) => void;
  onToggle: (to: CardView) => void;
  /** The Agenda: "See all" and the birthday banner. */
  onSeeAll: () => void;
  onOpenCalendar: () => void;
}

/**
 * Spec 028 FR-002 (CalCard): Today, This week or empty. The toggle shows only when there's
 * something today, and isn't remembered.
 */
export function CalendarCard({ layout, readOnly, onOpenEvent, onOpenDay, onAdd, onToggle, onSeeAll, onOpenCalendar }: CalendarCardProps) {
  const [picked, setPicked] = useState<CardView>('today');
  const { state } = layout;
  const view: CardView | 'empty' = state === 'today' ? picked : state;
  const shownState: HomeCardState = view === 'empty' ? 'empty' : view;
  const header =
    state === 'today' ? (
      <SegmentedControl
        label={c.show}
        segments={[
          { key: 'today', label: c.today },
          { key: 'week', label: c.thisWeek },
        ]}
        value={picked}
        onChange={(to: CardView) => {
          if (to === picked) return;
          setPicked(to);
          onToggle(to);
        }}
      />
    ) : (
      <Text role="heading" aria-level={2} size={20} weight="900">
        {state === 'week' ? c.thisWeek : c.calendar}
      </Text>
    );
  const addDate = view === 'week' ? layout.addDate.week : layout.addDate.today;
  const add = () => onAdd(addDate, shownState);

  return (
    <CalCard
      label={c.label}
      header={header}
      addLabel={c.addEvent}
      onAdd={add}
      addDisabled={readOnly}
      footer={view === 'empty' ? undefined : { label: c.openCalendar, onPress: onOpenCalendar }}
    >
      {view === 'today' ? (
        <View>
          {layout.birthdays.map((b) => (
            <View key={b.key} className="mb-4">
              <CalCardBanner icon="cake" text={b.text} onPress={onSeeAll} />
            </View>
          ))}
          <View role="list">
            {layout.today.map((e, i) => (
              <EventListRow key={e.key} size="sm" event={e} onPress={() => onOpenEvent(e.key, 'today', shownState)} last={i === layout.today.length - 1} />
            ))}
          </View>
        </View>
      ) : null}
      {view === 'week' ? (
        <View className="gap-10">
          <WeekStrip days={layout.strip} onDay={onOpenDay} />
          <View role="list">
            {layout.week.map((e, i) => (
              <WeekEventRow key={e.key} event={e} onPress={() => onOpenEvent(e.key, 'week', shownState)} last={i === layout.week.length - 1} />
            ))}
          </View>
          {layout.more > 0 ? <Link label={c.seeAll(layout.more)} onPress={onSeeAll} /> : null}
        </View>
      ) : null}
      {view === 'empty' ? (
        <View className="gap-12 pb-6 pt-4">
          <Text size={16} weight="700" color="ink-muted">
            {c.empty}
          </Text>
          <Button label={c.emptyAdd} variant="ink" onPress={add} disabled={readOnly} />
        </View>
      ) : null}
    </CalCard>
  );
}
