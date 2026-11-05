import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { memberInitials, type ActivityEntry, type HomeCardState, type Tracker } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES, viewFor, type SlotTimes } from '@cocon/calendar';
import type { GroceryItem, HomeHero, StoredEvent } from '@cocon/data';
import { AvatarStack, BrandHeader, BrandRow, Button, Card, HeroCard, StatTile, TabScreen, Text, type AvatarColor } from '@cocon/ui';
import { ActivitySection, type ActivityShow } from '../activity/ActivitySection';
import { BusySheet } from '../calendar/BusySheet';
import { OfflineBanner } from '../sync/OfflineBanner';
import { combineRows, toBuyCount } from '../../lib/groceries';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import { eventOccurrence } from '../../lib/event-detail';
import { memberLook, parseOccurrenceKey } from '../../lib/calendar-month';
import { firstName, greeting, homeDate, layoutCalendarCard, recipeToBuy } from '../../lib/home';
import { formatTotalTime } from '../../lib/recipe-format';
import type { UndoOutcome } from '../../lib/activity';
import type { AccountMember, Member } from '../../lib/session';
import { strings } from '../../strings/en';
import { CalendarCard } from './CalendarCard';

const s = strings.home;

export interface HomeScreenProps {
  me: AccountMember;
  /** Every member, with the app and without, in member order. */
  members: Member[];
  /** Today and "HH:MM" now, in the family's home time zone. */
  today: string;
  now: string;
  slotTimes?: SlotTimes;
  /** Today to today + 6 (`cardWindow`); undefined while loading. */
  events?: StoredEvent[];
  /** The hero's recipe (`loadHomeHero`): null with no recipes; undefined while loading. */
  hero?: HomeHero | null;
  heroPhotoUri?: string;
  /** The grocery list, as the Groceries tab reads it. */
  groceries?: GroceryItem[];
  /** How many recipes the Recipes tab lists. */
  recipeCount?: number;
  /** The 4 newest entries for `activityShow`. */
  activity: readonly ActivityEntry[];
  activityShow: ActivityShow;
  onActivityShow: (to: ActivityShow) => void;
  onUndo: (entry: ActivityEntry, skipChanged: boolean) => Promise<UndoOutcome>;
  readOnly?: boolean;
  tracker: Tracker;
  /** Under everything: the debug footer. */
  footer?: ReactNode;
  navigate: {
    recipe: (id: string) => void;
    newRecipe: () => void;
    groceries: () => void;
    recipes: () => void;
    family: () => void;
    /** The activity list, with Home's filter. */
    activity: (show: ActivityShow) => void;
    event: (id: string, date: string) => void;
    agenda: () => void;
    calendar: () => void;
    addEvent: (date: string) => void;
  };
}

/** Spec 028 (OC-Home): brand row (pinned, spec 050 FR-007), greeting, calendar card, the two tiles, latest recipe, Latest activity. */
export function HomeScreen({
  me,
  members,
  today,
  now,
  slotTimes = DEFAULT_SLOT_TIMES,
  events,
  hero,
  heroPhotoUri,
  groceries,
  recipeCount,
  activity,
  activityShow,
  onActivityShow,
  onUndo,
  readOnly,
  tracker,
  footer,
  navigate,
}: HomeScreenProps) {
  const look = useMemo(() => memberLook(members), [members]);
  const { use24h, show_birthdays: showBirthdays } = useCalendarDisplay().prefs;
  const layout = useMemo(
    () => layoutCalendarCard(events ?? [], { today, now, look, slotTimes, members, me, use24h, showBirthdays }),
    [events, today, now, look, slotTimes, members, me, use24h, showBirthdays],
  );
  // OC-CalBusy (spec 043, 032 L107): someone else's private event opens a sheet, not the event page.
  const [busy, setBusy] = useState<StoredEvent | null>(null);
  const initials = memberInitials(members);
  const toBuy = groceries ? toBuyCount(combineRows(groceries)) : 0;
  const heroToBuy = hero && groceries ? recipeToBuy(hero.ingredients, groceries) : 0;

  const openEvent = (key: string, section: 'today' | 'week', cardState: HomeCardState) => {
    tracker.track('homepage_calendar_event_tapped', { section, card_state: cardState });
    const { id, date } = parseOccurrenceKey(key);
    const event = events?.find((e) => e.id === id);
    const occurrence = event ? eventOccurrence(event, date) : null;
    if (occurrence && viewFor(occurrence, me.id).view === 'busy') setBusy(occurrence);
    else navigate.event(id, date);
  };

  return (
    <TabScreen
      pinned={
        <BrandRow
          brand={s.brand}
          avatars={
            <AvatarStack
              members={members.map((m) => ({ initial: initials.get(m.id) ?? '?', color: m.color as AvatarColor }))}
              moreLabel={s.moreMembers}
              label={s.family(members.map((m) => m.display_name))}
              onPress={navigate.family}
            />
          }
        />
      }
    >
      <BrandHeader date={homeDate(today)} greeting={greeting(now, firstName(me.display_name))} />
      <OfflineBanner screen="home" tracker={tracker} />
      <CalendarCard
        layout={layout}
        readOnly={readOnly}
        onOpenEvent={openEvent}
        onPickDay={(offset) => tracker.track('homepage_calendar_day_picked', { day_offset: offset })}
        onAdd={(date, cardState) => {
          tracker.track('homepage_calendar_add_tapped', { card_state: cardState });
          navigate.addEvent(date);
        }}
        onToggle={(to) => tracker.track('homepage_calendar_toggled', { to })}
        onSeeAll={navigate.agenda}
        onOpenCalendar={navigate.calendar}
      />
      <View className="flex-row gap-12">
        <StatTile
          icon="groceries"
          value={toBuy}
          label={s.toBuy}
          tone="honey"
          className="flex-1"
          onPress={() => {
            tracker.track('home_tile_tapped', { tile: 'groceries' });
            navigate.groceries();
          }}
        />
        <StatTile
          icon="recipes"
          value={recipeCount ?? 0}
          label={s.familyRecipes}
          tone="sage"
          className="flex-1"
          onPress={() => {
            tracker.track('home_tile_tapped', { tile: 'recipes' });
            navigate.recipes();
          }}
        />
      </View>
      {hero ? (
        <HeroCard
          title={hero.name}
          badge={s.latestRecipe}
          photoUri={heroPhotoUri}
          chips={[
            ...(hero.total_minutes ? [{ label: formatTotalTime(hero.total_minutes) }] : []),
            { label: s.serves(hero.serves) },
            ...(heroToBuy > 0 ? [{ label: s.toBuyChip(heroToBuy), tone: 'warn' as const }] : []),
          ]}
          onPress={() => {
            tracker.track('home_hero_opened', {});
            navigate.recipe(hero.id);
          }}
        />
      ) : hero === null ? (
        <Card tone="soft">
          <Text variant="titleMd">{s.noRecipes.title}</Text>
          <Text size={15} weight="600" color="ink-muted">
            {s.noRecipes.body}
          </Text>
          <Button
            label={s.noRecipes.action}
            variant="olive"
            onPress={() => {
              tracker.track('first_recipe_cta_tapped', {});
              navigate.newRecipe();
            }}
          />
          <Text size={14} weight="600" color="ink-muted">
            {s.noRecipes.hint}
          </Text>
        </Card>
      ) : null}
      <ActivitySection
        entries={activity}
        members={members}
        tracker={tracker}
        readOnly={readOnly}
        onUndo={onUndo}
        use24h={use24h}
        show={activityShow}
        onShow={(to) => {
          tracker.track('homepage_activity_filter_changed', { to });
          onActivityShow(to);
        }}
        onSeeAll={() => navigate.activity(activityShow)}
      />
      {members.length === 1 ? (
        <Card tone="soft">
          <Text size={18} weight="900">
            {s.invite.title}
          </Text>
          <Text size={15} weight="600" color="ink-muted">
            {s.invite.body}
          </Text>
          <Button label={s.invite.action} variant="olive" onPress={navigate.family} />
        </Card>
      ) : null}
      {footer}
      {busy ? <BusySheet occurrence={busy} members={members} slotTimes={slotTimes} onClose={() => setBusy(null)} /> : null}
    </TabScreen>
  );
}
