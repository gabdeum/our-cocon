import { z } from 'zod';

/** Read once at start-up. Every URL and key comes from the environment (FR-002). */
export const McpConfig = z.object({
  env: z.enum(['local', 'staging', 'prod']),
  commit: z.string().min(1),
  port: z.coerce.number().int().positive(),
  supabaseUrl: z.url(),
  posthogKey: z.string().optional(),
  posthogHost: z.url().optional(),
});
export type McpConfig = z.infer<typeof McpConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  return McpConfig.parse({
    env: env.COCON_ENV ?? 'local',
    commit: env.COCON_COMMIT ?? 'dev',
    port: env.MCP_PORT ?? 8787,
    supabaseUrl: env.SUPABASE_URL,
    posthogKey: env.POSTHOG_KEY || undefined,
    posthogHost: env.POSTHOG_HOST || undefined,
  });
}
