import type { ReminderWords } from './words.en';

/** Spec 076: reminder notifications in French. */
export const fr: ReminderWords = {
  before: (title) => `Dans 1 heure : ${title}`,
  dueTimed: (title) => `Maintenant : ${title}`,
  dueDay: (title) => `Aujourd’hui : ${title}`,
  nudge: (title) => `Toujours à faire : ${title}`,
  dueAt: (time) => `À faire à ${time}`,
  everyHour: 'Rappel toutes les heures jusqu’à ce que ce soit fait.',
  dueNow: 'À faire maintenant',
  dueToday: 'À faire aujourd’hui',
  hoursLate: (time, hours) => `Prévu à ${time} · ${hours} ${hours <= 1 ? 'heure' : 'heures'} de retard`,
  wasDue: (day) => `Prévu ${day}`,
  yesterday: 'hier',
  forName: (name) => `pour ${name}`,
  everyone: 'tout le monde',
};
