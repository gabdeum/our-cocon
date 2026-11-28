import type { ReminderWords } from './words.en';

/** Spec 076: reminder notifications in Spanish. */
export const es: ReminderWords = {
  before: (title) => `En 1 hora: ${title}`,
  dueTimed: (title) => `Ahora: ${title}`,
  dueDay: (title) => `Hoy: ${title}`,
  nudge: (title) => `Todavía pendiente: ${title}`,
  dueAt: (time) => `Para las ${time}`,
  everyHour: 'Te avisa cada hora hasta que esté hecho.',
  dueNow: 'Para ahora',
  dueToday: 'Para hoy',
  hoursLate: (time, hours) => `Era para las ${time} · ${hours} ${hours === 1 ? 'hora' : 'horas'} de retraso`,
  wasDue: (day) => `Era para ${day}`,
  yesterday: 'ayer',
  forName: (name) => `para ${name}`,
  everyone: 'todos',
};
