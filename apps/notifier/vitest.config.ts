import { defineProject } from 'vitest/config';

// Tests against local Supabase: 5 s (Vitest's default) is too tight while the whole suite runs.
export default defineProject({ test: { name: 'notifier', environment: 'node', testTimeout: 20_000 } });
