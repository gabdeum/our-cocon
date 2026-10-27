import { Image, View } from 'react-native';
import { cn } from '../cn';
import { Text } from './Text';

/** The member palette (tokens `member-*`, spec 033), plus Everyone, Others and a member who left. */
export type MemberColor = 'honey' | 'rose' | 'sky' | 'mint' | 'lilac' | 'peach' | 'pistachio' | 'clay';
export type AvatarColor = MemberColor | 'everyone' | 'others' | 'removed';
export type AvatarSize = 'md' | 'lg' | 'sm';

export const avatarFills: Record<AvatarColor, string> = {
  honey: 'bg-member-honey',
  rose: 'bg-member-rose',
  sky: 'bg-member-sky',
  mint: 'bg-member-mint',
  lilac: 'bg-member-lilac',
  peach: 'bg-member-peach',
  pistachio: 'bg-member-pistachio',
  clay: 'bg-member-clay',
  everyone: 'bg-member-everyone',
  // Light sand: a line-handle outline so it shows on white (tokens.json).
  others: 'bg-member-others border border-line-handle',
  removed: 'bg-member-removed',
};

// bundle.css › Avatar: 36 with a 2 px surface-page ring · lg 40 · sm 32, no ring.
const sizes: Record<AvatarSize, { box: string; px: number; font: number }> = {
  md: { box: 'h-[36px] w-[36px] border-2 border-surface-page', px: 36, font: 14 },
  lg: { box: 'h-[40px] w-[40px]', px: 40, font: 16 },
  sm: { box: 'h-[32px] w-[32px]', px: 32, font: 14 },
};

export interface AvatarProps {
  /** One letter, or two when two members share it ("Ev", "El"). */
  initial: string;
  color: AvatarColor;
  size?: AvatarSize;
  /** The member's photo, shown at the same size when they've uploaded one. */
  photoUri?: string;
  className?: string;
}

/** A family member's initial in their member color. */
export function Avatar({ initial, color, size = 'md', photoUri, className }: AvatarProps) {
  const s = sizes[size];
  return (
    <View aria-hidden className={cn('items-center justify-center overflow-hidden rounded-full', s.box, avatarFills[color], className)}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: s.px, height: s.px }} />
      ) : (
        <Text size={s.font} weight="900">
          {initial}
        </Text>
      )}
    </View>
  );
}

export interface AvatarStackProps {
  /** Most recent first. */
  members: { initial: string; color: AvatarColor }[];
  /** "+N" when more than 4 (copy from the caller, e.g. `(n) => \`+${n}\``). */
  moreLabel: (n: number) => string;
  /** Screen-reader summary, e.g. "Gabriel, Alex and Mia". */
  label: string;
}

/** Stacked avatars, overlapping by 10, up to 4 then "+N". */
export function AvatarStack({ members, moreLabel, label }: AvatarStackProps) {
  const shown = members.slice(0, 4);
  const more = members.length - shown.length;
  return (
    <View role="img" aria-label={label} className="flex-row">
      {shown.map((m, i) => (
        <Avatar key={i} initial={m.initial} color={m.color} className={i > 0 ? '-ml-10' : undefined} />
      ))}
      {more > 0 ? (
        <View aria-hidden className="-ml-10 h-[36px] w-[36px] items-center justify-center rounded-full border-2 border-surface-page bg-surface-soft">
          <Text size={13} weight="900">
            {moreLabel(more)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
