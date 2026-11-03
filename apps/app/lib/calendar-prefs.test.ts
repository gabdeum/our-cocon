// Spec 046 FR-003: the default reminder is saved with the member's calendar settings, and tracked as
// a notification setting (calendar_settings_changed doesn't take it).
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fakeTracker } from '../test/fakes';
import { changeCalendarPrefs, memberCalendarSettingsKey } from './calendar-prefs';

describe('changeCalendarPrefs', () => {
  it('saves the default reminder and sends notification_settings_changed', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const tracker = fakeTracker();
    const queryClient = new QueryClient();
    const result = await changeCalendarPrefs({ queryClient, client: { from: () => ({ upsert }) } as never, tracker, familyId: 'f1', userId: 'u1' }, { default_reminder: 'minutes_15' });
    expect(result).toBe('saved');
    expect(upsert).toHaveBeenCalledWith({ default_reminder: 'minutes_15', family_id: 'f1' }, { onConflict: 'family_id,user_id' });
    expect(queryClient.getQueryData(memberCalendarSettingsKey('u1'))).toMatchObject({ default_reminder: 'minutes_15' });
    expect(tracker.track).toHaveBeenCalledWith('notification_settings_changed', { setting: 'default_reminder', value: 'minutes_15' });
    expect(tracker.track).not.toHaveBeenCalledWith('calendar_settings_changed', expect.anything());
  });
});
