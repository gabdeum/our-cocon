import type { ReactNode, Ref } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { cn } from '../cn';
import { theme } from '../theme';
import { Logo } from './Icon';
import { Tag } from './Tag';
import { Text } from './Text';

/**
 * The app's frame: cream ground, and on the web the mobile layout centred at max 720 wide
 * (constitution, Layout decision). Everything, the tab bar included, sits inside it.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 bg-surface-page" style={{ alignItems: 'center' }}>
      <View testID="app-frame" className="w-full flex-1 bg-surface-page" style={{ maxWidth: theme.layout.maxWidth }}>
        {children}
      </View>
    </View>
  );
}

/** Tab screen (Patterns.md): 54 top, 20 sides, 180 bottom (room for the tab bar and timer pill). */
export function TabScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView className="flex-1 bg-surface-page" contentContainerClassName={cn('gap-18 px-20 pb-[180px] pt-[54px]', className)}>
      {children}
    </ScrollView>
  );
}

/** Pushed screen without photo (Patterns.md): back link at the top, no tab bar. */
export function PushedScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView className="flex-1 bg-surface-page" contentContainerClassName={cn('gap-18 px-20 pb-28 pt-[54px]', className)}>
      {children}
    </ScrollView>
  );
}

/**
 * Create/edit form (Patterns.md › Form): the form bar and Progress stay at the top (50 16 0), the
 * fields scroll under them (4 20 30, 18 apart). `scrollRef` lets Save bring a warned field into view;
 * `scrollEnabled` false holds the page still while a row is dragged.
 */
export function FormScreen({ bar, children, scrollRef, scrollEnabled = true }: { bar: ReactNode; children: ReactNode; scrollRef?: Ref<ScrollViewInstance>; scrollEnabled?: boolean }) {
  return (
    <View className="flex-1 bg-surface-page">
      <View className="px-16 pb-[14px] pt-[50px]">{bar}</View>
      <ScrollView ref={scrollRef} scrollEnabled={scrollEnabled} className="flex-1" contentContainerClassName="gap-18 px-20 pb-[30px] pt-4" keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export interface PhotoScreenProps {
  /** The photo, or a PhotoPlaceholder, filling the 240 header. */
  photo: ReactNode;
  /** Round IconButtons on the photo: back on the left, actions on the right (8 apart). */
  left?: ReactNode;
  right?: ReactNode;
  /** Above the content, e.g. a StatusBanner. */
  banner?: ReactNode;
  /** Stays put while the page scrolls, centred 108 from the top: the TimerPill (spec 011). */
  floating?: ReactNode;
  /** Fixed at the bottom while the page scrolls under it: the recipe page's "Start cooking". */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Pushed screen with photo header (Patterns.md): photo 240 edge to edge, buttons 52 from the top and
 * 16 from the sides, and the content sheet overlapping it by 30 with a top radius of 30. An optional
 * footer bar stays at the bottom (page background, top border, 20 sides, 12 top, 28 bottom).
 */
export function PhotoScreen({ photo, left, right, banner, floating, footer, children }: PhotoScreenProps) {
  const page = (
    <ScrollView className="flex-1 bg-surface-page">
      <View className="h-[240px] overflow-hidden">
        {photo}
        {left ? <View className="absolute left-16 top-[52px]">{left}</View> : null}
        {right ? <View className="absolute right-16 top-[52px] flex-row gap-8">{right}</View> : null}
      </View>
      <View className="-mt-[30px] gap-18 rounded-t-[30px] bg-surface-page px-20 pb-[40px] pt-24">
        {banner}
        {children}
      </View>
    </ScrollView>
  );
  if (!floating && !footer) return page;
  return (
    <View className="flex-1">
      {page}
      {floating ? (
        <View pointerEvents="box-none" className="absolute left-0 right-0 top-[108px] items-center px-16">
          {floating}
        </View>
      ) : null}
      {footer ? <View className="border-t-[1.5px] border-line bg-surface-page px-20 pb-28 pt-12">{footer}</View> : null}
    </View>
  );
}

export interface PublicScreenProps {
  /** "Our Cocon", next to the mark. */
  brand: string;
  /** The sage tag on the right: "View only". */
  tag: string;
  /** Photo 220 tall, edge to edge; left out on a state with no recipe ("no longer shared"). */
  photo?: ReactNode;
  children: ReactNode;
}

/**
 * A page anyone can open without an account (Patterns.md › Public page; OC-SharedView): a white
 * header bar with the mark, the name and a tag, then an optional photo and the content. No tab bar.
 */
export function PublicScreen({ brand, tag, photo, children }: PublicScreenProps) {
  return (
    <ScrollView className="flex-1 bg-surface-page">
      <View className="h-[64px] flex-row items-center justify-between border-b-[1.5px] border-line bg-surface-card px-16">
        <View className="flex-row items-center gap-8">
          <Logo size={30} />
          <Text size={16} weight="900">
            {brand}
          </Text>
        </View>
        {/* Tag aligns itself to the top; its wrapper lets the bar centre it. */}
        <View>
          <Tag label={tag} tone="sage" />
        </View>
      </View>
      {photo ? <View className="h-[220px] overflow-hidden">{photo}</View> : null}
      <View className="gap-16 px-20 pb-[40px] pt-20">{children}</View>
    </ScrollView>
  );
}

