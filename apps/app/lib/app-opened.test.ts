import { beforeEach, expect, it, vi } from 'vitest';
import { createTracker } from '@cocon/schemas';
import { resetAppOpenedForTests, trackAppOpened } from './app-opened';

const transport = () => ({ capture: vi.fn(), identify: vi.fn(), group: vi.fn() });

beforeEach(resetAppOpenedForTests);

it('sends app_opened once per launch with platform and version', () => {
  const t = transport();
  const tracker = createTracker(t);
  trackAppOpened(tracker, 'web', '0.1.0');
  trackAppOpened(tracker, 'web', '0.1.0');
  expect(t.capture).toHaveBeenCalledTimes(1);
  expect(t.capture).toHaveBeenCalledWith('app_opened', { platform: 'web', app_version: '0.1.0' });
});

it('reports iOS as ios', () => {
  const t = transport();
  trackAppOpened(createTracker(t), 'ios', '0.1.0');
  expect(t.capture).toHaveBeenCalledWith('app_opened', { platform: 'ios', app_version: '0.1.0' });
});
