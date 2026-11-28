// Spec 059 FR-001: the words of reminder notifications, one file per language (spec 076). The
// notifier has no app strings, so they live here, beside the rules that pick them (as `@cocon/calendar`'s words.en.ts for event reminders).
export interface ReminderWords {
  before: (title: string) => string;
  dueTimed: (title: string) => string;
  dueDay: (title: string) => string;
  nudge: (title: string) => string;
  dueAt: (time: string) => string;
  everyHour: string;
  dueNow: string;
  dueToday: string;
  hoursLate: (time: string, hours: number) => string;
  wasDue: (day: string) => string;
  yesterday: string;
  forName: (name: string) => string;
  everyone: string;
}

export const en: ReminderWords = {
  before: (title) => `In 1 hour: ${title}`,
  dueTimed: (title) => `Now: ${title}`,
  dueDay: (title) => `Today: ${title}`,
  nudge: (title) => `Still to do: ${title}`,
  dueAt: (time) => `Due at ${time}`,
  everyHour: 'Nudges every hour until it’s done.',
  dueNow: 'Due now',
  dueToday: 'Due today',
  hoursLate: (time, hours) => `Was due at ${time} · ${hours} ${hours === 1 ? 'hour' : 'hours'} late`,
  wasDue: (day) => `Was due ${day}`,
  yesterday: 'yesterday',
  forName: (name) => `for ${name}`,
  everyone: 'everyone',
};
