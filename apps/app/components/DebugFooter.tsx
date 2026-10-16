import { Text } from '@cocon/ui';
import { strings } from '../strings/en';
import type { AppConfig } from '../lib/config';

/** Shows the running commit on local and staging so a deploy can be checked at a glance. Hidden on prod. */
export function DebugFooter({ config }: { config: Pick<AppConfig, 'env' | 'commit'> }) {
  if (config.env === 'prod') return null;
  return (
    <Text variant="caption" color="ink-muted" testID="debug-footer">
      {strings.debug.build(config.commit.slice(0, 7))}
    </Text>
  );
}
