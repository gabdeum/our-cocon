import { z } from 'zod';
import type { CallToolResult, Tool as McpTool } from '@modelcontextprotocol/sdk/types.js';
import { QuantityError } from '@cocon/quantity';
import type { Db } from '@cocon/data';
import type { Tracker } from '@cocon/schemas';

/**
 * What a tool does to the family's data. Sets the MCP hints assistants show before running it.
 * Permissions are not checked here: an assistant's token works on Supabase's API directly too, so
 * what it may do lives in the database (the cocon_assistant role, and spec 024's per-person
 * permissions in its policies). Refusals still go through callTool, so they're tracked.
 */
export type Access = 'read' | 'write' | 'delete';

/** One call, acting as the member who connected the assistant. */
export interface ToolContext {
  /** Supabase with the member's token: RLS decides what they see and change. */
  db: Db;
  userId: string;
  familyId: string;
  /** 'claude', 'chatgpt', 'gemini', or 'mcp' for any other assistant. */
  assistant: string;
  /** The web app, for links. */
  appUrl: string;
  tracker: Tracker;
}

/** A failure the assistant can fix: its message is the one plain sentence it reads. */
export class ToolError extends Error {
  override readonly name = 'ToolError';
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  access: Access;
  input: z.ZodType<Record<string, unknown>>;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

/** A module's tool (apps/mcp/tools/<module>). Names read `<verb>_<thing>`: search_recipes, list_events. */
export function defineTool<S extends z.ZodObject>(tool: {
  name: string;
  title: string;
  description: string;
  access: Access;
  input: S;
  run(input: z.output<S>, ctx: ToolContext): Promise<unknown>;
}): Tool {
  return tool as unknown as Tool;
}

/** A module plugged into the server: its tools and what assistants should know about it. */
export interface Module {
  name: string;
  /** One paragraph for the server's instructions. */
  instructions: string;
  tools: readonly Tool[];
}

/** tools/list: each tool's input as JSON Schema, and hints from its access. */
export function listing(tools: readonly Tool[]): McpTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.input, { io: 'input', unrepresentable: 'any' }) as McpTool['inputSchema'],
    annotations: {
      title: tool.title,
      readOnlyHint: tool.access === 'read',
      destructiveHint: tool.access === 'delete',
      idempotentHint: tool.access === 'read',
      openWorldHint: false,
    },
  }));
}

function fieldName(path: readonly PropertyKey[]): string {
  return path.map((part) => (typeof part === 'number' ? `#${part + 1}` : String(part))).join(' › ');
}

/** One plain sentence for the first thing wrong with the input, saying where. */
export function inputSentence(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Something in the input is wrong. Check it and try again.';
  const where = fieldName(issue.path);
  if (issue.code === 'invalid_type' && issue.input === undefined) return where ? `${where} is missing. Add it and try again.` : 'The input is missing.';
  if (issue.code === 'unrecognized_keys') return `Remove ${issue.keys.join(', ')}${where ? ` from ${where}` : ''}: it isn't something Our Cocon stores.`;
  const message = issue.message.replace(/\.$/, '');
  return where ? `${where}: ${message}.` : `${message}.`;
}

/** What the assistant reads when a call fails. Never internals: only what it can act on. */
export function errorSentence(error: unknown): string {
  if (error instanceof ToolError) return error.message;
  if (error instanceof z.ZodError) return inputSentence(error);
  if (error instanceof QuantityError) return `${error.message.replace(/\.$/, '')}. Check the amounts and units and try again.`;
  return "Something went wrong on Our Cocon's side. Try again in a moment.";
}

/** tools/call: validate, run, answer with JSON, and record that it was called (never its input). */
export async function callTool(tool: Tool, args: unknown, ctx: ToolContext): Promise<CallToolResult> {
  let ok = false;
  try {
    const parsed = tool.input.safeParse(args ?? {});
    if (!parsed.success) throw parsed.error;
    const result = await tool.run(parsed.data, ctx);
    ok = true;
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    // Codes only: a database error's details can quote the row, and so the family's recipe text.
    if (!(error instanceof ToolError || error instanceof z.ZodError || error instanceof QuantityError)) {
      const e = error as { code?: unknown; name?: unknown };
      console.error(`${tool.name} failed`, { code: e?.code ?? null, name: e?.name ?? null });
    }
    return { content: [{ type: 'text', text: errorSentence(error) }], isError: true };
  } finally {
    ctx.tracker.track('mcp_tool_called', { tool: tool.name, assistant: ctx.assistant, ok });
  }
}
