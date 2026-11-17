import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { formatTime } from '@cocon/calendar';
import { DefaultReminder, QuietHours, type NotificationPrefs, type Tracker } from '@cocon/schemas';
import { BottomSheet, Button, Card, cn, Lead, ListRow, PushedScreen, SegmentedSettingRow, SettingRow, Text, TimeRange } from '@cocon/ui';
import type { PermissionStatus } from '../../lib/notifications';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';

const s = strings.settings.notifications;

export interface NotificationSettingsProps {
  /** False on the web: the page says only "Notifications work in the iPhone app." */
  supported: boolean;
  status: PermissionStatus | null;
  /** This phone's switches (FR-003), saved at once. */
  prefs: NotificationPrefs;
  onPref: <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => void;
  /** The member's, on every phone. */
  defaultReminder: DefaultReminder;
  onDefaultReminder: (value: DefaultReminder) => Promise<'saved' | 'failed'>;
  /** Spec 059 FR-007: the member's quiet hours, on every phone, in their clock. */
  quietHours: QuietHours;
  onQuietHours: (value: QuietHours) => Promise<'saved' | 'failed'>;
  use24h: boolean;
  /** The family's members without the app (spec 033), for the hint under Event reminders. */
  managedNames: readonly string[];
  onTurnOn: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
  tracker: Tracker;
  readOnly?: boolean;
}

function Heading({ children }: { children: string }) {
  return (
    <Text size={18} weight="900" role="heading" aria-level={2}>
      {children}
    </Text>
  );
}

/** Menu › Notifications (`/settings/notifications`, spec 046; design/ui/OC-SettingsNotif.md). */
export function NotificationSettings(p: NotificationSettingsProps) {
  const { prefs, status } = p;
  const [picking, setPicking] = useState(false);
  const [quiet, setQuiet] = useState<QuietHours | null>(null);
  const toast = useToast();
  const denied = status === 'denied';
  const notAsked = p.supported && status === 'undetermined';
  const off = denied || p.readOnly;

  // FR-002: the page's "Turn on notifications" is the third way to be asked.
  useEffect(() => {
    if (notAsked) p.tracker.track('notifications_ask_shown', { trigger: 'settings' });
    // Once per visit, when the card first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notAsked]);

  const pick = async (value: DefaultReminder) => {
    setPicking(false);
    // A failed save is a warn toast (spec 053 FR-015).
    if (value !== p.defaultReminder && (await p.onDefaultReminder(value)) === 'failed') toast.show({ text: s.saveFailed, tone: 'warn' });
  };

  const saveQuiet = async () => {
    const value = QuietHours.safeParse(quiet);
    setQuiet(null);
    if (!value.success || (value.data.from === p.quietHours.from && value.data.to === p.quietHours.to)) return;
    if ((await p.onQuietHours(value.data)) === 'failed') toast.show({ text: s.saveFailed, tone: 'warn' });
  };
  const time = (t: string) => formatTime(t, p.use24h);

  return (
    <PushedScreen className="gap-18" topBar={{ back: { label: s.back, onPress: p.onBack }, title: s.title }}>
      {p.supported ? <Lead>{s.lead}</Lead> : null}
      {!p.supported ? (
        <Text size={15} weight="600" color="ink-muted">
          {s.web}
        </Text>
      ) : (
        <>
          <OfflineBanner screen="settings" tracker={p.tracker} />
          {denied ? (
            <View role="status">
              <Card tone="warn">
              <Text size={16} weight="900" color="warn">
                {s.offTitle}
              </Text>
              <Text size={14} weight="600" color="warn" style={{ lineHeight: 14 * 1.4 }}>
                {s.offBody}
              </Text>
              <Button label={s.openSettings} variant="ink" size="sm" className="self-start" onPress={p.onOpenSettings} />
              </Card>
            </View>
          ) : null}
          {notAsked ? (
            <Card className="gap-14 px-16 py-14">
              <Text size={15} weight="600" color="ink-muted">
                {s.askBody}
              </Text>
              <Button label={s.turnOn} variant="ink" block onPress={p.onTurnOn} />
            </Card>
          ) : null}

          {/* Off in iPhone Settings: everything below is dimmed and inert. */}
          <View className={cn('gap-18', denied && 'opacity-dimmed')} pointerEvents={denied ? 'none' : 'auto'} aria-disabled={denied}>
            <View role="region" aria-label={s.timers} className="gap-8">
              <Heading>{s.timers}</Heading>
              <Card className="gap-0 px-16 py-4">
                <SettingRow label={s.timersLive} hint={s.timersLiveHint} value={prefs.timers_live} onValueChange={(on) => p.onPref('timers_live', on)} disabled={off} />
                <SettingRow label={s.timersAlert} hint={s.timersAlertHint} value={prefs.timers_alert} onValueChange={(on) => p.onPref('timers_alert', on)} disabled={off} last />
              </Card>
            </View>

            <View role="region" aria-label={s.reminders} className="gap-8">
              <Heading>{s.reminders}</Heading>
              <Card className="gap-0 px-16 py-4">
                <SettingRow label={s.remindersOn} hint={s.remindersOnHint} value={prefs.reminders_on} onValueChange={(on) => p.onPref('reminders_on', on)} disabled={off} last={!prefs.reminders_on} />
                {prefs.reminders_on ? (
                  <>
                    <SegmentedSettingRow<'mine' | 'all'>
                      label={s.remindMe}
                      value={prefs.reminders_scope}
                      segments={(['mine', 'all'] as const).map((key) => ({ key, label: s.scopes[key] }))}
                      onChange={(scope) => scope !== prefs.reminders_scope && p.onPref('reminders_scope', scope)}
                      disabled={off}
                    />
                    <ListRow
                      title={s.defaultReminder}
                      sub={s.defaultReminderHint}
                      trailing={{ kind: 'chevron', text: s.reminderChoices[p.defaultReminder] }}
                      onPress={off ? undefined : () => setPicking(true)}
                      disabled={off}
                      flush
                      last
                    />
                  </>
                ) : null}
              </Card>
              {p.managedNames.length > 0 ? (
                <Text size={14} weight="600" color="ink-muted" style={{ lineHeight: 14 * 1.4 }}>
                  {s.managedHint(p.managedNames)}
                </Text>
              ) : null}
            </View>

            <View role="region" aria-label={s.todo} className="gap-8">
              <Heading>{s.todo}</Heading>
              <Card className="gap-0 px-16 py-4">
                <SettingRow label={s.todoOn} hint={s.todoOnHint} value={prefs.todo_on} onValueChange={(on) => p.onPref('todo_on', on)} disabled={off} />
                <ListRow
                  title={s.quietHours}
                  trailing={{ kind: 'chevron', text: s.quietValue(time(p.quietHours.from), time(p.quietHours.to)) }}
                  onPress={off ? undefined : () => setQuiet(p.quietHours)}
                  disabled={off}
                  flush
                  last
                />
              </Card>
            </View>
          </View>
        </>
      )}

      <BottomSheet visible={quiet !== null} onClose={() => setQuiet(null)} title={s.quietTitle} closeLabel={s.close}>
        <View className="gap-14">
          <Text size={15} weight="600" color="ink-muted">
            {s.quietHint}
          </Text>
          <TimeRange
            startLabel={s.quietFrom}
            endLabel={s.quietTo}
            start={quiet?.from ?? p.quietHours.from}
            end={quiet?.to ?? p.quietHours.to}
            onChange={(field, value) => setQuiet((q) => q && (field === 'start' ? { ...q, from: value } : { ...q, to: value }))}
            use24h={p.use24h}
            format={time}
            fallback={{ start: p.quietHours.from, end: p.quietHours.to }}
          />
          <Button label={s.quietSave} variant="ink" block disabled={!QuietHours.safeParse(quiet).success} onPress={() => void saveQuiet()} />
        </View>
      </BottomSheet>

      <BottomSheet visible={picking} onClose={() => setPicking(false)} title={s.defaultReminder} closeLabel={s.close}>
        <View role="radiogroup" aria-label={s.defaultReminder} className="overflow-hidden rounded-xl bg-surface-card">
          {DefaultReminder.options.map((value, i) => (
            <ListRow
              key={value}
              title={s.reminderChoices[value]}
              leading={{ kind: 'radio', checked: value === p.defaultReminder }}
              onPress={() => void pick(value)}
              last={i === DefaultReminder.options.length - 1}
            />
          ))}
        </View>
      </BottomSheet>
    </PushedScreen>
  );
}
