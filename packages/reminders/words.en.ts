// Spec 059 FR-001: the words of reminder notifications. The notifier has no app strings, so they
// live here, beside the rules that pick them (as `@cocon/calendar`'s words.en.ts for event reminders).
export const en = {
  before: (title: string) => `In 1 hour: ${title}`,
  dueTimed: (title: string) => `Now: ${title}`,
  dueDay: (title: string) => `Today: ${title}`,
  nudge: (title: string) => `Still to do: ${title}`,
  dueAt: (time: string) => `Due at ${time}`,
  everyHour: 'Nudges every hour until it’s done.',
  dueNow: 'Due now',
  dueToday: 'Due today',
  hoursLate: (time: string, hours: number) => `Was due at ${time} · ${hours} ${hours === 1 ? 'hour' : 'hours'} late`,
  wasDue: (day: string) => `Was due ${day}`,
  yesterday: 'yesterday',
  forName: (name: string) => `for ${name}`,
  everyone: 'everyone',
};
