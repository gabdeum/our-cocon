import { useState } from 'react';
import { View } from 'react-native';
import type { HomeCardState } from '@cocon/schemas';
import { Button, CalCard, CalCardBanner, EventListRow, Link, SegmentedControl, Text, WeekEventGroup, WeekStrip } from '@cocon/ui';
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
  /** FR-008: a strip day was picked (0 today … 6), for `homepage_calendar_day_picked`. */
  onPickDay: (offset: number) => void;
  onAdd: (date: string, cardState: HomeCardState) => void;
  onToggle: (to: CardView) => void;
  /** The Agenda: "See all" and the birthday banner. */
  onSeeAll: () => void;
  onOpenCalendar: () => void;
}

/**
 * Spec 028 FR-002 (CalCard): Today, This week or empty. The toggle shows only when there's
 * something today, and isn't remembered. In This week, a strip day shows only that day (FR-008),
 * not remembered either.
 */
export function CalendarCard({ layout, readOnly, onOpenEvent, onPickDay, onAdd, onToggle, onSeeAll, onOpenCalendar }: CalendarCardProps) {
  const [picked, setPicked] = useState<CardView>('today');
  const [dayPicked, setDayPicked] = useState<string | null>(null);
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
          setDayPicked(null);
          onToggle(to);
        }}
      />
    ) : (
      <Text role="heading" aria-level={2} size={20} weight="900">
        {state === 'week' ? c.thisWeek : c.calendar}
      </Text>
    );
  const day = view === 'week' ? (layout.days.find((d) => d.date === dayPicked) ?? null) : null;
  const addDate = day ? day.date : view === 'week' ? layout.addDate.week : layout.addDate.today;
  const add = () => onAdd(addDate, shownState);
  const pickDay = (date: string) => {
    if (date === dayPicked) return setDayPicked(null);
    setDayPicked(date);
    onPickDay(layout.days.findIndex((d) => d.date === date));
  };

  return (
    <CalCard
      label={c.label}
      header={header}
      addLabel={day ? day.addLabel : c.addEvent}
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
          <WeekStrip days={layout.strip} picked={day?.date ?? null} onDay={pickDay} />
          {day ? (
            <View>
              <View className="flex-row items-center justify-between gap-10">
                <Text role="heading" aria-level={3} size={15} weight="900" className="min-w-0 flex-1">
                  {day.title}
                </Text>
                <Link label={c.wholeWeek} onPress={() => setDayPicked(null)} />
              </View>
              {day.items.length ? (
                <View role="list">
                  {day.items.map((e, i) => (
                    <EventListRow key={e.key} size="sm" event={e} onPress={() => onOpenEvent(e.key, 'week', shownState)} last={i === day.items.length - 1} />
                  ))}
                </View>
              ) : (
                <Text size={15} weight="700" color="ink-muted" className="mb-4 mt-6">
                  {day.empty}
                </Text>
              )}
            </View>
          ) : (
            <>
              <View>
                {layout.week.map((g, i) => (
                  <WeekEventGroup key={g.date} group={g} first={i === 0} onPress={(key) => onOpenEvent(key, 'week', shownState)} />
                ))}
              </View>
              {layout.more > 0 ? <Link label={c.seeAll(layout.more)} onPress={onSeeAll} /> : null}
            </>
          )}
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
