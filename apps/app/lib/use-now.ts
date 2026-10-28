import { useEffect, useState } from 'react';
import { timeIn } from '@cocon/calendar';

/** The time now in the home time zone, "HH:MM", moving each minute (Week's now line, Day's "Now"). */
export function useNow(timeZone: string): string {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return timeIn(timeZone, clock);
}
