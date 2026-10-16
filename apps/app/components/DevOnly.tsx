import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { config } from '../lib/tracker';

/** Developer screens (/dev/…) exist on local and staging only; prod sends people home. */
export function DevOnly({ children }: { children: ReactNode }) {
  if (config.env === 'prod') return <Redirect href="/" />;
  return <>{children}</>;
}
