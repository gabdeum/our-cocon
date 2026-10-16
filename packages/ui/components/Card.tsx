import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Meta } from './Tag';
import { Text } from './Text';

export type CardTone = 'default' | 'soft';

export interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  /** 2 px olive border: the step or variant being edited. */
  selected?: boolean;
  /** 2 px warn-border: a row with a problem. */
  attention?: boolean;
  /** A card that links somewhere is entirely tappable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
}

/** Flat rounded container (Card README): radius 22, padding 16, gap 12, never a shadow. */
export function Card({ children, tone = 'default', selected, attention, onPress, accessibilityLabel, className }: CardProps) {
  const box = cn(
    'gap-12 rounded-xl p-16',
    tone === 'soft' ? 'bg-surface-soft' : 'bg-surface-card',
    selected && 'border-2 border-olive',
    attention && 'border-2 border-warn-border',
    className,
  );
  if (!onPress) return <View className={box}>{children}</View>;
  return (
    <Pressable role="link" aria-label={accessibilityLabel} onPress={onPress} className={cn(box, focusRing)}>
      {children}
    </Pressable>
  );
}

/** Peach photo placeholder with a peach-ink label (Card README › oc-photo). */
export function PhotoPlaceholder({ label, className }: { label?: string; className?: string }) {
  return (
    <View className={cn('items-center justify-center bg-peach', className)}>
      {label ? (
        <Text size={14} weight="700" color="peach-ink">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export interface HeroCardProps {
  title: string;
  /** "Latest recipe". */
  badge: string;
  /** Meta chips: white, or warn for things to act on ("2 to buy"). */
  chips: { label: string; tone?: 'white' | 'warn' }[];
  photoUri?: string;
  photoLabel?: string;
  onPress: () => void;
}

/** The photo hero card on Home (Card README › Hero): radius 28, photo 170, white badge at 14,14. */
export function HeroCard({ title, badge, chips, photoUri, photoLabel, onPress }: HeroCardProps) {
  return (
    <Pressable role="link" onPress={onPress} className={cn('overflow-hidden rounded-2xl bg-surface-soft', focusRing)}>
      <View className="h-[170px]">
        {photoUri ? (
          <Image source={{ uri: photoUri }} resizeMode="cover" className="h-full w-full" />
        ) : (
          <PhotoPlaceholder label={photoLabel} className="h-full w-full" />
        )}
        {/* Card preview: the badge is a white tag at 13 px, padding 6 12. */}
        <View className="absolute left-14 top-14 rounded-pill bg-surface-card px-12 py-6">
          <Text size={13} weight="800">
            {badge}
          </Text>
        </View>
      </View>
      <View className="px-18 pb-16 pt-14">
        <Text variant="titleMd">{title}</Text>
        <View className="mt-10 flex-row flex-wrap gap-8">
          {chips.map((c) => (
            <Meta key={c.label} label={c.label} tone={c.tone ?? 'white'} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}
