import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DefaultReminder, type NotificationPrefs, type Tracker } from '@cocon/schemas';
import { BackHeader, BottomSheet, Button, Card, cn, ListRow, PushedScreen, SegmentedSettingRow, SettingRow, StatusBanner, Text } from '@cocon/ui';
import type { PermissionStatus } from '../../lib/notifications';
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
  const [failed, setFailed] = useState(false);
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
    if (value !== p.defaultReminder) setFailed((await p.onDefaultReminder(value)) === 'failed');
  };

  return (
    <PushedScreen className="gap-18">
      <BackHeader backLabel={s.back} onBack={p.onBack} title={s.title} lead={p.supported ? s.lead : undefined} />
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
          </View>
          {failed && !p.readOnly ? <StatusBanner tone="warn" message={s.saveFailed} /> : null}
        </>
      )}

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
