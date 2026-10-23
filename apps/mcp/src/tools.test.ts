import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { QuantityError } from '@cocon/quantity';
import { callTool, defineTool, errorSentence, inputSentence, listing, ToolError, type ToolContext } from './tools.js';
import { rateLimit } from './rate-limit.js';

const echo = defineTool({
  name: 'echo_things',
  title: 'Echo',
  description: 'Echoes.',
  access: 'read',
  input: z.strictObject({ name: z.string().min(1), unit: z.enum(['g', 'ml'], { error: "Unknown unit. Use g or ml." }).optional() }),
  run: async (args) => ({ said: args.name }),
});
const remove = defineTool({ name: 'remove_thing', title: 'Remove', description: 'Removes.', access: 'delete', input: z.strictObject({}), run: async () => ({}) });

function context(): ToolContext & { track: ReturnType<typeof vi.fn> } {
  const track = vi.fn();
  return { db: {} as ToolContext['db'], userId: 'u', familyId: 'f', assistant: 'claude', appUrl: 'https://app', tracker: { track, identify: vi.fn(), reset: vi.fn() }, track };
}

describe('listing', () => {
  it('describes each tool’s input as JSON Schema, with hints from its access', () => {
    const [read, del] = listing([echo, remove]);
    expect(read).toMatchObject({ name: 'echo_things', inputSchema: { type: 'object', required: ['name'] }, annotations: { readOnlyHint: true, destructiveHint: false } });
    expect(del?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });
});

describe('errors read as one plain sentence (spec 023 Warnings and errors)', () => {
  const issue = (args: unknown) => inputSentence(echo.input.safeParse(args).error as z.ZodError);

  it('names a missing field', () => {
    expect(issue({})).toBe('name is missing. Add it and try again.');
  });

  it('uses the field’s own message when it has one', () => {
    expect(issue({ name: 'x', unit: 'cupz' })).toBe('unit: Unknown unit. Use g or ml.');
  });

  it('says what to remove for an unknown field', () => {
    expect(issue({ name: 'x', colour: 'red' })).toBe("Remove colour: it isn't something Our Cocon stores.");
  });

  it('keeps tool errors as written and hides internal ones', () => {
    expect(errorSentence(new ToolError('Pick one.'))).toBe('Pick one.');
    expect(errorSentence(new QuantityError('invalid_quantity', 'Amount must be a number'))).toBe('Amount must be a number. Check the amounts and units and try again.');
    expect(errorSentence(new Error('relation "recipes" does not exist'))).toBe("Something went wrong on Our Cocon's side. Try again in a moment.");
  });
});

describe('callTool', () => {
  it('answers with JSON and records the call, never its input (mcp_tool_called)', async () => {
    const ctx = context();
    const result = await callTool(echo, { name: 'Ratatouille' }, ctx);
    expect(result.structuredContent).toEqual({ said: 'Ratatouille' });
    expect(ctx.track).toHaveBeenCalledWith('mcp_tool_called', { tool: 'echo_things', assistant: 'claude', ok: true });
  });

  it('returns a failure as an error the assistant can read, recorded as not ok', async () => {
    const ctx = context();
    const result = await callTool(echo, { name: '' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'name: Too small: expected string to have >=1 characters.' }]);
    expect(ctx.track).toHaveBeenCalledWith('mcp_tool_called', { tool: 'echo_things', assistant: 'claude', ok: false });
  });
});

describe('rateLimit', () => {
  it('allows the limit per window, then refuses until the next one', () => {
    const limit = rateLimit(2, 1000);
    expect([limit.take('a', 0), limit.take('a', 1), limit.take('a', 2), limit.take('b', 2)]).toEqual([true, true, false, true]);
    expect(limit.take('a', 1000)).toBe(true);
  });

  it('never keeps more keys than it may, and a flood of new ones never locks a caller out', () => {
    const limit = rateLimit(1, 1000, 2);
    expect([limit.take('a', 0), limit.take('b', 0), limit.take('c', 0)]).toEqual([true, true, true]);
    // 'a' was dropped to make room, so it starts afresh; 'c' is still counted.
    expect([limit.take('a', 1), limit.take('c', 1)]).toEqual([true, false]);
  });
});
