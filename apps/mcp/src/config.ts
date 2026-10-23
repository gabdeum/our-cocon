import { z } from 'zod';

/** Read once at start-up. Every URL and key comes from the environment (spec 001 FR-002). */
export const McpConfig = z.object({
  env: z.enum(['local', 'staging', 'prod']),
  commit: z.string().min(1),
  port: z.coerce.number().int().positive(),
  supabaseUrl: z.url(),
  /** The public anon key: PostgREST wants it beside the member's token. */
  supabaseAnonKey: z.string().min(1),
  /** The web app, for recipe links in tool results (spec 023). */
  appUrl: z.url(),
  /** This server's own address, as assistants know it (OAuth protected-resource metadata). */
  mcpUrl: z.url(),
  posthogKey: z.string().optional(),
  posthogHost: z.url().optional(),
});
export type McpConfig = z.infer<typeof McpConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const name = env.COCON_ENV ?? 'local';
  const port = env.MCP_PORT ?? 8787;
  // Locally `pnpm dev` runs the app and this server from the same .env.local.
  const local = name === 'local';
  return McpConfig.parse({
    env: name,
    commit: env.COCON_COMMIT ?? 'dev',
    port,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || (local ? env.EXPO_PUBLIC_SUPABASE_ANON_KEY : undefined),
    appUrl: env.APP_URL || (local ? 'http://localhost:8081' : undefined),
    mcpUrl: env.MCP_URL || (local ? `http://localhost:${port}` : undefined),
    posthogKey: env.POSTHOG_KEY || undefined,
    posthogHost: env.POSTHOG_HOST || undefined,
  });
}
