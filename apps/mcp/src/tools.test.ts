import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { QuantityError } from '@cocon/quantity';
import { callTool, defineTool, errorSentence, inputSentence, listing, notAllowedSentence, ToolError, type ToolContext } from './tools.js';
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

const tick = defineTool({ name: 'tick_thing', title: 'Tick', description: 'Ticks.', access: 'write', needs: 'groceries', input: z.strictObject({}), run: vi.fn(async () => ({ ticked: true })) });

/** `allowed`: what the database's ai_allowed answers (spec 024). */
function context(allowed = true): ToolContext & { track: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> } {
  const track = vi.fn();
  const rpc = vi.fn(async () => ({ data: allowed, error: null }));
  return { db: { rpc } as unknown as ToolContext['db'], userId: 'u', familyId: 'f', assistant: 'claude', appUrl: 'https://app', tracker: { track, identify: vi.fn(), reset: vi.fn() }, track, rpc };
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

describe('permissions (spec 024 FR-002)', () => {
  it('asks the database before a tool that needs one runs', async () => {
    const ctx = context(true);
    const result = await callTool(tick, {}, ctx);
    expect(ctx.rpc).toHaveBeenCalledWith('ai_allowed', { permission: 'groceries' });
    expect(result.structuredContent).toEqual({ ticked: true });
  });

  it('Not allowed: a polite refusal the assistant can relay, tracked as not ok, and the tool never runs', async () => {
    const ctx = context(false);
    vi.mocked(tick.run).mockClear();
    const result = await callTool(tick, {}, ctx);
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'This member hasn’t allowed AI to change the grocery list. They can change it in Settings › AI assistants.' }] });
    expect(tick.run).not.toHaveBeenCalled();
    expect(ctx.track).toHaveBeenCalledWith('mcp_tool_called', { tool: 'tick_thing', assistant: 'claude', ok: false });
  });

  it('reads tools without a permission straight away', async () => {
    const ctx = context(false);
    await callTool(echo, { name: 'x' }, ctx);
    expect(ctx.rpc).not.toHaveBeenCalled();
  });

  it('turns the database’s own refusal into the same sentence', () => {
    expect(errorSentence({ code: '42501', hint: 'ai_not_allowed', message: 'recipes_delete' })).toBe(notAllowedSentence('recipes_delete'));
    expect(notAllowedSentence('recipes_edit')).toBe('This member hasn’t allowed AI to create or edit recipes. They can change it in Settings › AI assistants.');
    // Spec 044 Warnings and errors.
    expect(errorSentence({ code: '42501', hint: 'ai_not_allowed', message: 'events' })).toBe('This member hasn’t allowed AI to change the calendar. They can change it in Settings › AI assistants.');
    expect(errorSentence({ code: '42501', message: 'permission denied for table recipes' })).toBe("Something went wrong on Our Cocon's side. Try again in a moment.");
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
