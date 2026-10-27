import { z } from 'zod';

/**
 * Where a write came from (spec 004 FR-003): 'app', or the assistant's name ('claude', 'chatgpt',
 * 'gemini', any other MCP client). The database decides it from the token (`_request_source`),
 * so the app can never record a write as an assistant's.
 */
export const WriteSource = z.string().regex(/^[a-z0-9-]{1,40}$/);
export type WriteSource = z.infer<typeof WriteSource>;

/** The assistants Settings › AI assistants lists, in its order (spec 025 FR-001). */
export const KnownAssistant = z.enum(['claude', 'chatgpt', 'gemini']);
export type KnownAssistant = z.infer<typeof KnownAssistant>;
/** An assistant in OC-Connect's events: a listed one, or 'other' for an app the database can't name. */
export const ConnectionAssistant = z.enum([...KnownAssistant.options, 'other']);
export type ConnectionAssistant = z.infer<typeof ConnectionAssistant>;
