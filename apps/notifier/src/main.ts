import { createClient } from '@supabase/supabase-js';
import { createNotifier } from '@cocon/notify';
import type { Database } from '@cocon/schemas';
import { loadConfig } from './config.js';
import { createHealthServer, createWorker, type Job } from './worker.js';

const config = loadConfig();
const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const notifier = createNotifier(db, { fetch, ...(config.expoAccessToken ? { accessToken: config.expoAccessToken } : {}) });

const jobs: Job[] = [
  {
    name: 'receipts',
    run: async () => {
      const { checked, failed } = await notifier.checkReceipts();
      return checked ? `${checked} checked, ${failed} failed` : null;
    },
  },
];

const worker = createWorker(jobs, config.intervalMs);
const health = createHealthServer(worker, { env: config.env, commit: config.commit });
worker.start();
// Only the deploy check and Docker's health check ask, from inside the container.
health.listen(config.port, '127.0.0.1', () => {
  console.log(`Notifier (${config.env}) on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    worker.stop();
    health.close();
    process.exit(0);
  });
}
