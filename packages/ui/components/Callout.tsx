import { View } from 'react-native';
import { cn } from '../cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type CalloutVariant = 'tip' | 'temp' | 'ai' | 'info' | 'warn';

export interface CalloutProps {
  variant: CalloutVariant;
  text: string;
  /** tip: "Chef's tip" · temp: "Temperature check:" · ai: "AI" (badge). */
  label?: string;
  /** info only: optional icon. */
  icon?: IconName;
  /** Cooking mode: radius 18, tip text 16. */
  cook?: boolean;
  className?: string;
}

/** A tinted block of context (Callout README). One idea, at most two sentences. */
export function Callout({ variant, text, label, icon, cook, className }: CalloutProps) {
  const box = cn('px-14 py-12', cook ? 'rounded-[18px]' : 'rounded-lg', variant === 'tip' ? 'bg-surface-soft' : variant === 'warn' ? 'bg-warn-soft' : 'bg-sage', className);
  const lh = (size: number) => ({ lineHeight: size * 1.4 });

  if (variant === 'tip') {
    return (
      <View className={cn(box, 'gap-[2px]')}>
        {label ? (
          <Text size={12} weight="900" color="warn" uppercase style={{ letterSpacing: 0.7 }}>
            {label}
          </Text>
        ) : null}
        <Text size={cook ? 16 : 15} weight="600" style={lh(cook ? 16 : 15)}>
          {text}
        </Text>
      </View>
    );
  }

  const iconName: IconName | undefined = variant === 'temp' ? 'thermometer' : variant === 'warn' ? 'warning' : icon;
  return (
    <View className={cn(box, 'flex-row items-start gap-10')}>
      {variant === 'ai' && label ? (
        <View className="rounded-[8px] bg-surface-card px-[7px] py-[3px]">
          <Text size={12} weight="900">
            {label}
          </Text>
        </View>
      ) : null}
      {iconName ? <Icon name={iconName} color={variant === 'warn' ? 'warn' : 'ink'} /> : null}
      <Text size={variant === 'ai' ? 14 : 15} weight="700" color={variant === 'warn' ? 'warn' : 'ink'} className="flex-1" style={lh(variant === 'ai' ? 14 : 15)}>
        {variant === 'temp' && label ? (
          <Text size={15} weight="900">
            {label}{' '}
          </Text>
        ) : null}
        {text}
      </Text>
    </View>
  );
}
