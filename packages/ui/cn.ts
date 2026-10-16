/** Joins class names, skipping empty ones. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Keyboard focus ring from Extending.md: 3 px olive outline, offset 2 (web only; iOS has none). */
export const focusRing =
  'web:focus-visible:outline web:focus-visible:outline-[3px] web:focus-visible:outline-olive web:focus-visible:outline-offset-2';
