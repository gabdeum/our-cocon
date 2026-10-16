import { Text } from 'react-native';
import { strings } from '../strings/en';
import type { AppConfig } from '../lib/config';

/**
 * Shows the running commit on local and staging so a deploy can be checked at a glance.
 * Hidden on prod. Bare `Text` until packages/ui has a text component (spec 002).
 */
export function DebugFooter({ config }: { config: Pick<AppConfig, 'env' | 'commit'> }) {
  if (config.env === 'prod') return null;
  return (
    <Text accessibilityRole="text" testID="debug-footer">
      {strings.debug.build(config.commit.slice(0, 7))}
    </Text>
  );
}
