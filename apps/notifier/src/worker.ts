import { createServer, type Server } from 'node:http';

/** One thing the notifier does each minute (046: receipts; 049 adds event reminders). */
export type Job = { name: string; run: () => Promise<string | null> };

/**
 * Runs every job once per interval. A tick that's still running when the next is due is skipped,
 * so a slow Expo or database never piles up sends. A failing job is logged and the others still run.
 */
export function createWorker(jobs: Job[], intervalMs: number, log: (line: string) => void = console.log, now: () => number = Date.now) {
  let running = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastTickAt: number | null = null;

  async function tick() {
    if (running) return;
    running = true;
    try {
      for (const job of jobs) {
        try {
          const line = await job.run();
          if (line) log(`${job.name}: ${line}`);
        } catch (e) {
          // Supabase errors are plain objects with a message, not Errors.
          const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
          log(`${job.name} failed: ${message}`);
        }
      }
      lastTickAt = now();
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
    },
    /** Healthy once a tick has finished within the last three intervals. */
    healthy: () => lastTickAt !== null && now() - lastTickAt < intervalMs * 3,
  };
}
export type Worker = ReturnType<typeof createWorker>;

/** GET /health for deploys and the Docker health check: the env, the commit and whether ticks run. */
export function createHealthServer(worker: Pick<Worker, 'healthy'>, info: { env: string; commit: string }): Server {
  return createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const ok = worker.healthy();
      res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok, ...info }));
      return;
    }
    res.writeHead(404).end();
  });
}
