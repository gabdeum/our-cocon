/** FR (Warnings and errors): why the engine refused. Callers show their own copy. */
export type CalendarErrorCode = 'NonAdjacentSlots' | 'InvalidRecurrence' | 'EndBeforeStart' | 'InvalidDate';

export class CalendarError extends Error {
  override readonly name = 'CalendarError';

  constructor(
    readonly code: CalendarErrorCode,
    message: string,
  ) {
    super(message);
  }
}
