/**
 * A fixed-window request limit per key (constitution VI: rate limits on the MCP server). In memory:
 * one server process per environment, so that's enough; a restart starts every window afresh.
 */
export interface RateLimit {
  /** True when this request is allowed. */
  take(key: string, now?: number): boolean;
}

export function rateLimit(limit: number, windowMs: number, maxKeys = 10_000): RateLimit {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key, now = Date.now()) {
      let w = windows.get(key);
      if (!w || now >= w.resetAt) {
        if (windows.size >= maxKeys) for (const [k, old] of windows) if (now >= old.resetAt) windows.delete(k);
        // Still full: drop the oldest window (a Map keeps insertion order) rather than refuse
        // everyone new, so a flood of addresses can't lock real callers out.
        if (windows.size >= maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest !== undefined) windows.delete(oldest);
        }
        w = { count: 0, resetAt: now + windowMs };
        // Re-insert, so the Map's order stays oldest window first.
        windows.delete(key);
        windows.set(key, w);
      }
      w.count += 1;
      return w.count <= limit;
    },
  };
}
