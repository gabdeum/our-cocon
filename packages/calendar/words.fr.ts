import type { CalendarWords } from './words.en';

const list = (names: readonly string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : (names[0] ?? ''));

/** Spec 076: the calendar's words in French. */
export const fr: CalendarWords = {
  locale: 'fr-FR',
  slots: { early_morning: 'Tôt le matin', morning: 'Matin', lunch: 'Midi', afternoon: 'Après-midi', evening: 'Soir' },
  allDay: 'Toute la journée',
  busy: 'Occupé',
  months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  weekdays: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  weekdaysShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  am: 'AM',
  pm: 'PM',
  monthDay: (month, day) => `${day === 1 ? '1er' : day} ${month}`,
  weekdayDate: (weekday, month, day) => `${weekday} ${day === 1 ? '1er' : day} ${month}`,
  dayRange: (month, day, endMonth, endDay) => (endMonth ? `${day} ${month} – ${endDay} ${endMonth}` : `${day} – ${endDay} ${month}`),
  yearSuffix: (year) => ` ${year}`,
  list,
  everyone: 'Tout le monde',
  takes: (driver, names) => `${driver} emmène ${list(names)}`,
  drives: (driver) => `${driver} conduit`,
  reminders: {
    minutes_15: (title) => `${title} dans 15 minutes`,
    hour_before: (title) => `${title} dans 1 heure`,
    at: (title, time) => `${title} à ${time}`,
    inSlot: {
      early_morning: (title) => `${title} tôt ce matin`,
      morning: (title) => `${title} ce matin`,
      lunch: (title) => `${title} ce midi`,
      afternoon: (title) => `${title} cet après-midi`,
      evening: (title) => `${title} ce soir`,
    },
    today: (title) => `Aujourd’hui : ${title}`,
    tomorrow: (title) => `Demain : ${title}`,
  },
};
