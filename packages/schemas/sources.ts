import { z } from 'zod';

/**
 * Where a write came from (spec 004 FR-003): 'app', or the assistant's name ('claude', 'chatgpt',
 * 'gemini', any other MCP client). The database decides it from the token (`_request_source`),
 * so the app can never record a write as an assistant's.
 */
export const WriteSource = z.string().regex(/^[a-z0-9-]{1,40}$/);
export type WriteSource = z.infer<typeof WriteSource>;
