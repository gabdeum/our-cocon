import { router } from 'expo-router';
import { TimersScreen } from '../components/timers/TimersScreen';
import { tracker } from '../lib/tracker';

/** /timers (spec 011): reachable from anywhere through the TimerPill or the done banner. */
export default function TimersRoute() {
  return <TimersScreen tracker={tracker} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
