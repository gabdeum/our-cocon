import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadCalendarSettings, setAwayTimeZone } from '@cocon/data';
import { calendarSettingsKey } from '../../lib/calendar-header';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import { clock, deviceTimeZone } from '../../lib/clock';
import { useSession } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { cityOf, familyTimeHere, memberTravelKey, travelStep, useMemberTravel, zoneDifference } from '../../lib/travel';
import { strings } from '../../strings';
import { TravelSheet } from './TravelSheet';

const EXAMPLE = '16:00';

/**
 * Spec 071, mounted once at the root: when the app opens or comes back, checks this phone's time
 * zone against the family's and the member's own. Another zone: the drawer (FR-001); back on the
 * family's clock: the member's own times go back without asking (FR-005).
 */
export function TravelHost() {
  const { state, client, tracker } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { prefs } = useCalendarDisplay();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const userId = state.status === 'ready' ? state.userId : '';
  const settings = useQuery({ queryKey: calendarSettingsKey(familyId ?? ''), queryFn: () => loadCalendarSettings(client), enabled: familyId !== null });
  const travel = useMemberTravel();
  const home = settings.data?.homeTimeZone ?? null;
  const [device, setDevice] = useState(deviceTimeZone);
  const [busy, setBusy] = useState<'keep' | 'family' | 'home' | null>(null);
  const ending = useRef(false);
  const asked = useRef<string | null>(null);

  // The zone can change while the app sleeps (a flight): read it again when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setDevice(deviceTimeZone());
    });
    return () => sub.remove();
  }, []);

  const step = travel.data && settings.data ? travelStep(home, travel.data, device) : null;
  const asking = step?.kind === 'ask' ? step.zone : null;

  const saved = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: memberTravelKey(userId) }),
      queryClient.invalidateQueries({ queryKey: ['reminders'] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: calendarSettingsKey(familyId ?? '') }),
    ]);
  }, [queryClient, userId, familyId]);

  useEffect(() => {
    if (asking && asked.current !== asking) tracker.track('travel_time_zone_asked', {});
    asked.current = asking;
  }, [asking, tracker]);

  // FR-005: back on the family's clock: the member's own times go back, without asking.
  const back = step?.kind === 'back';
  useEffect(() => {
    if (!back || ending.current) return;
    ending.current = true;
    setAwayTimeZone(client, null, null)
      .then(async (moved) => {
        tracker.track('travel_time_zone_ended', { reminders_moved: moved });
        await saved();
      })
      .catch(() => undefined)
      .finally(() => {
        ending.current = false;
      });
  }, [back, client, tracker, saved]);

  const choose = async (choice: 'keep' | 'family' | 'home') => {
    if (!asking || busy) return;
    setBusy(choice);
    try {
      const moved = await setAwayTimeZone(client, choice === 'home' ? null : asking, asking, choice === 'family' ? 'family' : 'me');
      tracker.track('travel_time_zone_chosen', { choice, reminders_moved: moved });
      await saved();
    } catch {
      toast.show({ text: strings.travel.failed, tone: 'warn' });
    } finally {
      setBusy(null);
    }
  };

  const ask =
    asking && home
      ? {
          city: cityOf(asking),
          home: cityOf(home),
          gap: zoneDifference(asking, home),
          time: clock(EXAMPLE, prefs.use24h),
          here: clock(familyTimeHere(home, asking, EXAMPLE), prefs.use24h),
        }
      : null;
  return <TravelSheet ask={ask} busy={busy} onKeep={() => void choose('keep')} onKeepFamily={() => void choose('family')} onStay={() => void choose('home')} />;
}
