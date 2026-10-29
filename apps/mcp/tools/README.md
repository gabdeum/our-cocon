# MCP tools

One folder per module (`recipes/`, `groceries/`, then `calendar/`, …). Each exports a `Module` (`src/tools.ts`): its tools and a paragraph for the server's instructions. `tools/index.ts` lists the modules; adding one is a folder and a line there.

- Define tools with `defineTool`: a `<verb>_<thing>` name, `access` (`read`, `write` or `delete`: the hints assistants show). A tool that changes something sets `needs`, the member's permission it needs (`recipes_edit`, `groceries`, `events`, `recipes_delete`, specs 024 and 044): `callTool` asks the database first and returns the refusal, and the database refuses the write anyway (`_check_ai_permission`). What a tool may touch is granted to the `cocon_assistant` database role, table by table (032-later L58); the database is the boundary, not this code, a Zod input and `run`.
- Tools act as the member who connected the assistant: `ctx.db` carries their OAuth token, so RLS applies. Never the service role.
- Validate with `@cocon/schemas`, read and write through `@cocon/data`, write amounts with `@cocon/quantity`, and place, label and mask events with `@cocon/calendar`, so assistants and the app agree.
- A failure the assistant can fix throws `ToolError` with one plain sentence saying what to fix. Anything else reads as "Something went wrong on Our Cocon's side".
- Results are JSON. Every call sends `mcp_tool_called` (tool, assistant, ok), never its input.
