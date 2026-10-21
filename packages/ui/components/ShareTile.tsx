import { Pressable, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ShareTileProps extends Omit<PressableProps, 'children' | 'style'> {
  /** "Message": also its screen-reader name. */
  label: string;
  icon: IconName;
  /** Honey for the first, most likely way to send; soft for the others. */
  tone?: 'honey' | 'soft';
  className?: string;
}

/**
 * A way to send something, in a row of three (ShareTile README; OC-Share › Message, Email, More):
 * 76 tall, radius 18, a 22 px icon over a 14/800 label.
 */
export function ShareTile({ label, icon, tone = 'soft', disabled, className, ...props }: ShareTileProps) {
  const off = disabled === true;
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={off}
      disabled={off}
      className={cn(
        'h-[76px] min-w-0 flex-1 items-center justify-center gap-6 rounded-[18px] px-6',
        off ? 'bg-on-ink' : tone === 'honey' ? 'bg-honey active:bg-honey-pressed' : 'bg-surface-soft active:bg-surface-soft-pressed',
        focusRing,
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={22} color={off ? 'inkMuted' : 'ink'} />
      <Text size={14} weight="800" color={off ? 'ink-muted' : 'ink'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
