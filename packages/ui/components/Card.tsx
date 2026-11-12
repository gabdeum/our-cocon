import { Children, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { cn, focusRing } from '../cn';
import { Button } from './Button';
import type { IconName } from './Icon';
import { Meta } from './Tag';
import { Text } from './Text';

/**
 * sage: calm results (OC-ScaleIng's preview, OC-Units' "For this recipe"). ink: a promo block,
 * text in on-olive / on-ink (OC-SharedView's "Keep your family's recipes together"). warn: something
 * that stops a feature, text in warn (OC-SettingsNotif's "Notifications are off for Our Cocon").
 */
export type CardTone = 'default' | 'soft' | 'sage' | 'ink' | 'warn';

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
    tone === 'sage'
      ? 'gap-6 rounded-[20px] bg-sage px-16 py-14'
      : tone === 'warn'
        ? 'gap-10 rounded-[20px] bg-warn-soft px-16 py-14'
      : tone === 'ink'
        ? 'gap-10 rounded-[24px] bg-ink p-18'
        : cn('gap-12 rounded-xl p-16', tone === 'soft' ? 'bg-surface-soft' : 'bg-surface-card'),
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

/**
 * Peach photo placeholder with a peach-ink label (Card README › oc-photo), or, for a recipe with no
 * photo, its first letter at 32/900 (OC-Recipe › No photo).
 */
export function PhotoPlaceholder({ label, initial, className }: { label?: string; initial?: string; className?: string }) {
  return (
    <View className={cn('items-center justify-center bg-peach', className)} aria-hidden={initial ? true : undefined}>
      {initial ? (
        <Text size={32} weight="900" color="peach-ink">
          {initial}
        </Text>
      ) : label ? (
        <Text size={14} weight="700" color="peach-ink">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** A stored photo filling its box (cover): recipe headers and step photos. Read out by its label. */
/** Without `label` the photo is decoration, skipped by screen readers (its text says the same, spec 030). */
export function Photo({ uri, label, className }: { uri: string; label?: string; className?: string }) {
  if (!label) return <Image source={{ uri }} resizeMode="cover" aria-hidden className={cn('h-full w-full', className)} />;
  return <Image source={{ uri }} resizeMode="cover" role="img" aria-label={label} className={cn('h-full w-full', className)} />;
}

/** 40 × 40, radius 12: a recipe's photo on a grocery recipe card (OC-Groceries), peach when it has none. */
export function Thumb({ uri, label }: { uri?: string; label?: string }) {
  return <View className="h-[40px] w-[40px] overflow-hidden rounded-[12px]">{uri ? <Photo uri={uri} label={label} /> : <PhotoPlaceholder className="h-full w-full" />}</View>;
}

export interface HeroAction {
  label: string;
  /** Screen-reader name, naming the recipe ("Resume Leek & bacon quiche, step 3 of 6"). */
  a11y?: string;
  /** danger (Cancel, red outline), white (Done) or ink (Resume, the main one: wider, with its icon). */
  tone: 'danger' | 'white' | 'ink';
  icon?: IconName;
  onPress: () => void;
}

export interface HeroCardProps {
  title: string;
  /** "Latest recipe", "Cooking now: step 3/10". */
  badge: string;
  /** Meta chips: white, or warn for things to act on ("2 to buy"). */
  chips: { label: string; tone?: 'white' | 'warn' }[];
  photoUri?: string;
  photoLabel?: string;
  /** Screen-reader name of the tappable part, when it says more than the title ("Resume …"). */
  openLabel?: string;
  onPress: () => void;
  /** Small buttons under the chips (a cook: Cancel · Done · Resume, spec 028). The photo and title still open. */
  actions?: HeroAction[];
  /** Offline: the actions can't save. */
  actionsDisabled?: boolean;
}

/**
 * The photo hero card on Home (Card README › Hero): radius 28, photo 170, white badge at 14,14.
 * With `actions`, the photo and title are the link and the buttons sit under them (never a button
 * inside a link).
 */
export function HeroCard({ title, badge, chips, photoUri, photoLabel, openLabel, onPress, actions, actionsDisabled }: HeroCardProps) {
  const top = (
    <>
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
      <View className={cn('px-18 pt-14', actions ? 'pb-0' : 'pb-16')}>
        <Text variant="titleMd">{title}</Text>
        {chips.length > 0 ? (
          <View className="mt-10 flex-row flex-wrap gap-8">
            {chips.map((c) => (
              <Meta key={c.label} label={c.label} tone={c.tone ?? 'white'} />
            ))}
          </View>
        ) : null}
      </View>
    </>
  );
  if (!actions) {
    return (
      <Pressable role="link" aria-label={openLabel} onPress={onPress} className={cn('overflow-hidden rounded-2xl bg-surface-soft', focusRing)}>
        {top}
      </Pressable>
    );
  }
  return (
    <View className="overflow-hidden rounded-2xl bg-surface-soft">
      <Pressable role="link" aria-label={openLabel} onPress={onPress} className={cn('rounded-2xl', focusRing)}>
        {top}
      </Pressable>
      <View className="flex-row gap-6 px-14 pb-16 pt-12">
        {actions.map((a) => (
          <View key={a.label} className={a.tone === 'ink' ? 'flex-[1.3]' : 'flex-1'}>
            <Button label={a.label} aria-label={a.a11y} icon={a.icon} variant={a.tone === 'danger' ? 'danger-outline' : a.tone} size="compact" block disabled={actionsDisabled} onPress={a.onPress} />
          </View>
        ))}
      </View>
    </View>
  );
}

export interface HeroCarouselProps {
  /** "2 recipes cooking". */
  label: string;
  /** Each dot's screen-reader name: "Show Leek & bacon quiche". */
  pageLabels: string[];
  children: ReactNode;
}

/**
 * Hero cards side by side, one per screen width: swipe for the next (Card README › Hero carousel).
 * Dots under them say which one shows; tapping a dot goes there (the web has no swipe with a mouse).
 * One card shows on its own, without dots.
 */
/** The space between two cards. Each page is a card and this gap, so a swipe stops on the next card. */
const CAROUSEL_GAP = 12;

export function HeroCarousel({ label, pageLabels, children }: HeroCarouselProps) {
  const pages = Children.toArray(children);
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const page = width + CAROUSEL_GAP;
  if (pages.length <= 1) return <>{pages}</>;
  return (
    <View role="region" aria-label={label} className="gap-6" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        // A gap wider than the card, out into the screen's side margin, so pages are card + gap.
        className="-mr-12"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => width > 0 && setIndex(Math.round(e.nativeEvent.contentOffset.x / page))}
      >
        {pages.map((card, i) => (
          // A width only known once laid out: the card is the carousel's width, then the gap.
          <View key={i} className="pr-12" style={{ width: width ? page : undefined }}>
            {card}
          </View>
        ))}
      </ScrollView>
      <View className="flex-row justify-center gap-4">
        {pages.map((_, i) => (
          <Pressable
            key={i}
            role="button"
            aria-label={pageLabels[i]}
            // 20 tall so the list below stays close; the target still reaches 44.
            hitSlop={{ top: 12, bottom: 12 }}
            aria-current={i === index ? true : undefined}
            onPress={() => {
              scroller.current?.scrollTo({ x: i * page, animated: true });
              setIndex(i);
            }}
            className={cn('h-[20px] w-[28px] items-center justify-center rounded-pill', focusRing)}
          >
            <View className={cn('h-[8px] rounded-pill', i === index ? 'w-[20px] bg-olive' : 'w-[8px] bg-line-strong')} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
