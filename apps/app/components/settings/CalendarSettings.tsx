import { useState } from 'react';
import { View } from 'react-native';
import { SLOT_KEYS, type CalendarView, type SlotKey, type TimeFormatSetting, type WeekStartSetting } from '@cocon/schemas/calendar';
import type { MemberCalendarSettingsUpdate, Tracker } from '@cocon/schemas';
import { calendarWordsEn, checkSlotTimes, moveSlotEdge, slotNeighbour, toMinutes, type SlotTimes } from '@cocon/calendar';
import { BackHeader, BottomSheet, Button, Card, ListGroup, ListRow, PushedScreen, SegmentedSettingRow, SettingRow, SheetFooter, StatusBanner, Text, TextField } from '@cocon/ui';
import type { CalendarPrefs } from '../../lib/calendar-prefs';
import { clock, zoneLabel } from '../../lib/clock';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';

const s = strings.settings.calendar;
const slotName = (slot: SlotKey) => calendarWordsEn.slots[slot];
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface CalendarSettingsProps {
  /** The member's own settings (spec 029 FR-007). */
  prefs: CalendarPrefs;
  onChange: (change: MemberCalendarSettingsUpdate) => Promise<'saved' | 'failed'>;
  /** The family's (FR-009, FR-010); only the owner changes them. */
  slotTimes: SlotTimes;
  homeTimeZone: string | null;
  isOwner: boolean;
  ownerName: string;
  /** Throws when the database refuses. */
  onSaveSlots: (slotTimes: SlotTimes) => Promise<void>;
  onSetTimeZone: (timeZone: string) => Promise<void>;
  phoneTimeZone: string;
  onOpenAi: () => void;
  onBack: () => void;
  tracker: Tracker;
  readOnly?: boolean;
}

/** The slot sheet's fields as typed, with a warning on the one that's wrong. */
type SlotEdit = { slot: SlotKey; start: string; end: string; warning?: { field: 'start' | 'end'; text: string }; failed?: boolean };

/**
 * The slot edit's problem, if any: a time like 18:30, an end after the start, and room left for
 * the neighbour whose edge moves with it (Gabriel, 2026-11-02). Then the engine's rule (FR-009).
 */
function slotProblem(times: SlotTimes, e: SlotEdit): SlotEdit['warning'] {
  const endPattern = e.slot === 'evening' ? /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/ : CLOCK;
  if (!CLOCK.test(e.start)) return { field: 'start', text: s.badTime };
  if (!endPattern.test(e.end)) return { field: 'end', text: s.badTime };
  if (toMinutes(e.start) >= toMinutes(e.end)) return { field: 'end', text: s.endBeforeStart };
  const before = slotNeighbour(e.slot, 'start');
  const after = slotNeighbour(e.slot, 'end');
  if (before && toMinutes(e.start) <= toMinutes(times[before].start)) return { field: 'start', text: s.overlap(slotName(e.slot), slotName(before)) };
  if (after && toMinutes(e.end) >= toMinutes(times[after].end)) return { field: 'end', text: s.overlap(slotName(after), slotName(e.slot)) };
  const problem = checkSlotTimes(edited(times, e));
  return problem ? { field: 'start', text: s.overlap(slotName(problem.slot), slotName(problem.previous ?? problem.slot)) } : undefined;
}

const edited = (times: SlotTimes, e: SlotEdit) => moveSlotEdge(moveSlotEdge(times, e.slot, 'start', e.start), e.slot, 'end', e.end);

/** Menu › Calendar (`/settings/calendar`, spec 029; design/ui/OC-CalSettings.md). */
export function CalendarSettings(p: CalendarSettingsProps) {
  const { prefs, slotTimes, readOnly } = p;
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<SlotEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneFailed, setZoneFailed] = useState(false);
  const hours = (slot: SlotKey) => s.hours(clock(slotTimes[slot].start, prefs.use24h), clock(slotTimes[slot].end, prefs.use24h));
  const change = async (update: MemberCalendarSettingsUpdate) => setFailed((await p.onChange(update)) === 'failed');
  const ownerEdits = p.isOwner && !readOnly;

  async function saveSlot() {
    if (!editing) return;
    const warning = slotProblem(slotTimes, editing);
    if (warning) return setEditing({ ...editing, warning });
    setSaving(true);
    try {
      await p.onSaveSlots(edited(slotTimes, editing));
      p.tracker.track('calendar_settings_changed', { setting: 'times_of_day', value: editing.slot });
      setEditing(null);
    } catch {
      setEditing({ ...editing, failed: true });
    } finally {
      setSaving(false);
    }
  }

  async function applyPhoneZone() {
    setSaving(true);
    try {
      await p.onSetTimeZone(p.phoneTimeZone);
      p.tracker.track('calendar_settings_changed', { setting: 'home_time_zone', value: 'phone' });
      setZoneOpen(false);
    } catch {
      setZoneFailed(true);
    } finally {
      setSaving(false);
    }
  }

  // What moves with the edge being typed: "Afternoon will end at 18:30."
  const movesWith = (e: SlotEdit, edge: 'start' | 'end') => {
    const neighbour = slotNeighbour(e.slot, edge);
    const time = edge === 'start' ? e.start : e.end;
    if (!neighbour || time === slotTimes[e.slot][edge] || !CLOCK.test(time)) return undefined;
    return s.movesWith(slotName(neighbour), edge === 'start' ? 'end' : 'start', clock(time, prefs.use24h));
  };

  return (
    <PushedScreen className="gap-18">
      <BackHeader backLabel={s.back} onBack={p.onBack} title={s.title} lead={s.lead} />
      <OfflineBanner screen="settings" tracker={p.tracker} />

      <View role="region" aria-label={s.forYou} className="gap-8">
        <Heading>{s.forYou}</Heading>
        <Card className="gap-0 px-16 py-4">
          <SegmentedSettingRow<CalendarView>
            label={s.opensOn}
            value={prefs.opens_on}
            segments={(['month', 'week', 'day', 'agenda'] as const).map((key) => ({ key, label: s.views[key] }))}
            onChange={(opens_on) => opens_on !== prefs.opens_on && void change({ opens_on })}
            disabled={readOnly}
          />
          <SegmentedSettingRow<WeekStartSetting>
            label={s.weekStart}
            hint={s.weekStartHint}
            value={prefs.week_start}
            segments={(['automatic', 'sunday', 'monday'] as const).map((key) => ({ key, label: s.weekStarts[key] }))}
            onChange={(week_start) => week_start !== prefs.week_start && void change({ week_start })}
            disabled={readOnly}
          />
          <SegmentedSettingRow<TimeFormatSetting>
            label={s.timeFormat}
            hint={s.timeFormatHint}
            value={prefs.time_format}
            segments={(['automatic', '24h', '12h'] as const).map((key) => ({ key, label: s.timeFormats[key] }))}
            onChange={(time_format) => time_format !== prefs.time_format && void change({ time_format })}
            disabled={readOnly}
          />
          <SettingRow label={s.birthdays} hint={s.birthdaysHint} value={prefs.show_birthdays} onValueChange={(on) => void change({ show_birthdays: on })} disabled={readOnly} />
          <SettingRow label={s.fadePast} hint={s.fadePastHint} value={prefs.fade_past} onValueChange={(on) => void change({ fade_past: on })} disabled={readOnly} last />
        </Card>
      </View>
      {failed && !readOnly ? <StatusBanner tone="warn" message={s.saveFailed} /> : null}

      <View role="region" aria-label={s.timesOfDay} className="gap-8">
        <Heading>{s.timesOfDay}</Heading>
        <Text size={14} weight="600" color="ink-muted">
          {s.timesOfDayLead(p.ownerName)}
        </Text>
        <ListGroup>
          {SLOT_KEYS.map((slot, i) => (
            <ListRow
              key={slot}
              title={slotName(slot)}
              trailing={ownerEdits ? { kind: 'chevron', text: hours(slot) } : { kind: 'value', text: hours(slot) }}
              accessibilityLabel={s.slotLabel(slotName(slot), hours(slot))}
              onPress={ownerEdits ? () => setEditing({ slot, start: slotTimes[slot].start, end: slotTimes[slot].end }) : undefined}
              last={i === SLOT_KEYS.length - 1}
            />
          ))}
        </ListGroup>
      </View>

      <View role="region" aria-label={s.family} className="gap-8">
        <Heading>{s.family}</Heading>
        <ListGroup>
          <ListRow
            title={s.homeTimeZone}
            sub={p.homeTimeZone ? zoneLabel(p.homeTimeZone) : s.notSet}
            trailing={ownerEdits ? { kind: 'chevron' } : undefined}
            onPress={
              ownerEdits
                ? () => {
                    setZoneFailed(false);
                    setZoneOpen(true);
                  }
                : undefined
            }
          />
          <ListRow title={s.aiAssistants} sub={s.aiAssistantsSub} trailing={{ kind: 'chevron' }} onPress={p.onOpenAi} last />
        </ListGroup>
      </View>

      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? slotName(editing.slot) : ''}
        closeLabel={s.cancel}
        dirty={editing !== null && (editing.start !== slotTimes[editing.slot].start || editing.end !== slotTimes[editing.slot].end)}
        footer={
          <SheetFooter
            cancel={{ label: s.cancel, onPress: () => setEditing(null) }}
            primary={{ label: s.save, busy: saving, busyLabel: s.saving, onPress: () => void saveSlot() }}
          />
        }
      >
        {editing ? (
          <View className="gap-14">
            <View className="flex-row gap-8">
              {(['start', 'end'] as const).map((field) => (
                <TextField
                  key={field}
                  className="flex-1"
                  label={field === 'start' ? s.starts : s.ends}
                  value={editing[field]}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  hint={movesWith(editing, field)}
                  warning={editing.warning?.field === field ? editing.warning.text : field === 'end' && editing.failed ? s.saveFailed : undefined}
                  onChangeText={(v) => setEditing({ ...editing, [field]: v, warning: undefined, failed: false })}
                />
              ))}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={zoneOpen} onClose={() => setZoneOpen(false)} title={s.homeTimeZone} closeLabel={s.close}>
        <View className="gap-14">
          <Text size={15} weight="600" color="ink-muted">
            {s.timeZoneLead}
          </Text>
          <Text size={16} weight="800">
            {p.homeTimeZone ? zoneLabel(p.homeTimeZone) : s.notSet}
          </Text>
          {p.homeTimeZone === p.phoneTimeZone ? (
            <Text size={15} weight="700" color="olive-deep">
              {s.sameZone}
            </Text>
          ) : (
            <Button label={s.usePhoneZone(zoneLabel(p.phoneTimeZone))} block busy={saving} busyLabel={s.saving} onPress={() => void applyPhoneZone()} />
          )}
          {zoneFailed ? <StatusBanner tone="warn" message={s.saveFailed} /> : null}
        </View>
      </BottomSheet>
    </PushedScreen>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <Text size={18} weight="900" role="heading" aria-level={2}>
      {children}
    </Text>
  );
}
