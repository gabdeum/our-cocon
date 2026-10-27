import type { IconTileTone, StepTextPart } from '@cocon/ui';
import type { KnownAssistant } from '@cocon/schemas';

export interface AssistantEntry {
  key: KnownAssistant;
  letters: string;
  tone: IconTileTone;
  /** False while an assistant can't connect to an MCP server like ours: its row reads "Not available yet" (spec 025). */
  available: boolean;
}

/** Settings › AI assistants, in the screen's order (OC-Connect). All three connect as of 2026-10-26 (spec 025 FR-005). */
export const ASSISTANTS: readonly AssistantEntry[] = [
  { key: 'claude', letters: 'C', tone: 'peach', available: true },
  { key: 'chatgpt', letters: 'G', tone: 'sage', available: true },
  { key: 'gemini', letters: 'Ge', tone: 'soft', available: true },
];

/** Whole minutes from `then` to `now`, for "used 2 h ago". Never negative (clocks drift). */
export function minutesSince(then: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 60_000));
}

/** The member's connections (spec 025): Settings' count and the AI assistants screen share it. */
export const aiConnectionsKey = (userId: string) => ['ai_connections', userId] as const;

/**
 * A connection step's text with its menu and button names, written `**Plugins**` in the strings
 * file, as highlighted parts: the same look as amounts in recipe steps (StepText).
 */
export function highlightParts(text: string): StepTextPart[] {
  return text.split('**').flatMap((piece, i): StepTextPart[] => (piece === '' ? [] : i % 2 === 1 ? [{ amount: piece }] : [piece]));
}
