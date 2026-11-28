import type { CalendarWords } from './words.en';

const list = (names: readonly string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? ''));

/** Spec 076: the calendar's words in Spanish. */
export const es: CalendarWords = {
  locale: 'es-ES',
  slots: { early_morning: 'Madrugada', morning: 'Mañana', lunch: 'Mediodía', afternoon: 'Tarde', evening: 'Noche' },
  allDay: 'Todo el día',
  busy: 'Ocupado',
  months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  monthsShort: ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'],
  weekdays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  weekdaysShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  am: 'a. m.',
  pm: 'p. m.',
  monthDay: (month, day) => `${day} de ${month}`,
  weekdayDate: (weekday, month, day) => `${weekday}, ${day} de ${month}`,
  dayRange: (month, day, endMonth, endDay) => (endMonth ? `${day} de ${month} – ${endDay} de ${endMonth}` : `${day} – ${endDay} de ${month}`),
  yearSuffix: (year) => ` de ${year}`,
  list,
  everyone: 'Todos',
  takes: (driver, names) => `${driver} lleva a ${list(names)}`,
  drives: (driver) => `${driver} conduce`,
  reminders: {
    minutes_15: (title) => `${title} en 15 minutos`,
    hour_before: (title) => `${title} en 1 hora`,
    at: (title, time) => `${title} a las ${time}`,
    inSlot: {
      early_morning: (title) => `${title} esta madrugada`,
      morning: (title) => `${title} esta mañana`,
      lunch: (title) => `${title} a mediodía`,
      afternoon: (title) => `${title} esta tarde`,
      evening: (title) => `${title} esta noche`,
    },
    today: (title) => `Hoy: ${title}`,
    tomorrow: (title) => `Mañana: ${title}`,
  },
};
