import { calendarWordsEn, formatTime } from '@cocon/calendar';

/**
 * Spec 029 Time format (032-later L95): times in the member's clock. `formatTime` for a full time
 * ("14:30" or "2:30 PM"); the hour alone where space is short: Add event's slot chips ("18–22" or
 * "6 PM–10 PM") and the week's hour column ("06:00" stays as drawn; "6 AM").
 */
export const clock = formatTime;

export function hourOnly(time: string, use24h: boolean): string {
  if (use24h) return time.slice(0, 2);
  const h = Number(time.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 && h < 24 ? calendarWordsEn.pm : calendarWordsEn.am}`;
}

/** "America/New_York" → "New York (Eastern Time)" (OC-CalSettings › Home time zone); the city alone when the device can't name the zone. */
export function zoneLabel(timeZone: string): string {
  const city = (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value;
    return name && !name.startsWith('GMT') ? `${city} (${name})` : city;
  } catch {
    return city;
  }
}

/** This device's time zone ("Use this phone's time zone"). */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
