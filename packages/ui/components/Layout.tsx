import { useContext, useMemo, useState, type ReactNode, type Ref } from 'react';
import { Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { cn } from '../cn';
import { railInset, tabBottomPad, useLayoutTier } from '../layout';
import { theme } from '../theme';
import { Logo } from './Icon';
import { Tag } from './Tag';
import { Text } from './Text';
import { ToastHost } from './Toast';
import { TopBarHeadingProvider, useTopBar, useTopEdge, type TopBarConfig } from './TopBar';

/**
 * The app's frame: cream ground, everything (the tab bar and rail included) inside it. On the web
 * the phone layout is centred at max 560 below 600 wide, and wider windows grow up to 1200, then
 * centre (spec 063 FR-005); from 960 the rail is added to that, so content beside it still reaches
 * 1200 (spec 064). The iPhone and iPad app always fill the window.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { tier } = useLayoutTier();
  const maxWidth = Platform.OS !== 'web' ? undefined : tier === 'compact' ? theme.layout.phoneMax : theme.layout.maxContent + railInset(tier);
  return (
    <View className="flex-1 bg-surface-page" style={{ alignItems: 'center' }}>
      <View testID="app-frame" className="w-full flex-1 bg-surface-page" style={{ maxWidth }}>
        {children}
      </View>
    </View>
  );
}

/**
 * From 600 wide (spec 063 FR-003): the 24 gutter, and content 24 under the safe area. Null on the
 * phone, which keeps each screen's own top and 20 gutter.
 */
function useWideEdges() {
  const { tier } = useLayoutTier();
  const insets = useContext(SafeAreaInsetsContext);
  return tier === 'compact' ? null : { top: (insets?.top ?? 0) + theme.layout.topWide };
}

export interface TabScreenProps {
  children: ReactNode;
  className?: string;
  /** Above `pinned`, scrolling away: Recipes' and Groceries' title. */
  header?: ReactNode;
  /** Sticks under the status bar once it reaches it, with the TopBar's hairline and shadow (spec 050 FR-007). */
  pinned?: ReactNode;
}

/**
 * Tab screen (Patterns.md): 54 top, 20 sides, 180 bottom (room for the tab bar and timer pill; 28
 * beside the rail, spec 064). With `pinned`, the status bar area is the page's own band and
 * `pinned` sticks right under it.
 */
export function TabScreen({ children, className, header, pinned }: TabScreenProps) {
  const { tier } = useLayoutTier();
  const bottom = tabBottomPad(tier);
  const phoneTop = useTopEdge(54);
  const wide = useWideEdges();
  const top = wide?.top ?? phoneTop;
  const [at, setAt] = useState(0);
  const [stuck, setStuck] = useState(false);
  if (!pinned) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 bg-surface-page"
        contentContainerClassName={cn('gap-18', wide ? 'px-24' : 'px-20 pt-[54px]', className)}
        contentContainerStyle={wide ? { paddingTop: wide.top, paddingBottom: bottom } : { paddingBottom: bottom }}
      >
        {children}
      </ScrollView>
    );
  }
  // No null children: the sticky index counts them on the web, not on the iPhone.
  const parts = [
    ...(header ? [<View key="header">{header}</View>] : []),
    <View
      key="pinned"
      testID="tab-pinned"
      onLayout={(e) => setAt(e.nativeEvent.layout.y)}
      className={cn('gap-12 border-b-[1.5px] bg-surface-page pb-12', wide ? '-mx-24 px-24' : '-mx-20 px-20', stuck ? 'border-line' : 'border-transparent')}
      style={{ boxShadow: stuck ? theme.shadow.bar : undefined }}
    >
      {pinned}
    </View>,
    <View key="body" className={cn('gap-18', className)}>
      {children}
    </View>,
  ];
  return (
    <View className="flex-1 bg-surface-page">
      <View className="bg-surface-page" style={{ height: top }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 bg-surface-page"
        contentContainerClassName={cn('gap-18', wide ? 'px-24' : 'px-20')}
        contentContainerStyle={{ paddingBottom: bottom }}
        stickyHeaderIndices={[header ? 1 : 0]}
        // A tap on the pinned part (a quick filter) lands while the keyboard is up.
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => setStuck(e.nativeEvent.contentOffset.y > at)}
        scrollEventThrottle={16}
      >
        {parts}
      </ScrollView>
    </View>
  );
}

/**
 * Pushed screen without photo (Patterns.md). With `topBar` the bar stays pinned above the scrolling
 * content (spec 050); without one, the content starts 54 from the top.
 */
export function PushedScreen({ children, className, topBar }: { children: ReactNode; className?: string; topBar?: TopBarConfig }) {
  const bar = useTopBar(topBar);
  const wide = useWideEdges();
  return (
    <View className="flex-1 bg-surface-page">
      {bar.node}
      <TopBarHeadingProvider value={bar.register}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={bar.onScroll}
          scrollEventThrottle={16}
          className="flex-1 bg-surface-page"
          contentContainerClassName={cn('gap-18 pb-28', wide ? 'px-24' : 'px-20', topBar ? 'pt-18' : !wide && 'pt-[54px]', className)}
          contentContainerStyle={wide && !topBar ? { paddingTop: wide.top } : undefined}
        >
          {children}
        </ScrollView>
      </TopBarHeadingProvider>
    </View>
  );
}

/**
 * Create/edit form (Patterns.md › Form): the form bar and Progress stay at the top (50 16 0), the
 * fields scroll under them (4 20 30, 18 apart). `scrollRef` lets Save bring a warned field into view;
 * `scrollEnabled` false holds the page still while a row is dragged. On the iPhone the fields
 * scroll clear of the keyboard (spec 030, L98).
 */
export function FormScreen({ bar, children, scrollRef, scrollEnabled = true }: { bar: ReactNode; children: ReactNode; scrollRef?: Ref<ScrollViewInstance>; scrollEnabled?: boolean }) {
  const wide = useWideEdges();
  return (
    <View className="flex-1 bg-surface-page">
      <View className={cn('pb-[14px]', wide ? 'px-24' : 'px-16 pt-[50px]')} style={wide ? { paddingTop: wide.top } : undefined}>
        {bar}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        className="flex-1"
        contentContainerClassName={cn('gap-18 pb-[30px] pt-4', wide ? 'px-24' : 'px-20')}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
      <ToastHost />
    </View>
  );
}

const PHOTO = 240;

export interface PhotoScreenProps {
  /** The photo, or a PhotoPlaceholder, filling the header. */
  photo: ReactNode;
  /** The header's height: 240, or 280 beside two columns (spec 067, `theme.layout.heroWide`). */
  photoHeight?: number;
  /** Over the photo, then pinned on the page background once the photo has scrolled away (spec 050). */
  topBar: TopBarConfig;
  /** Above the content, e.g. a StatusBanner. */
  banner?: ReactNode;
  /** Stays put while the page scrolls, centred 108 from the top: the TimerPill (spec 011). */
  floating?: ReactNode;
  /** Fixed at the bottom while the page scrolls under it, on a cream fade: the recipe page's action bar (spec 051 FR-014). */
  footer?: ReactNode;
  /** From 600 (spec 067 FR-006): the footer sits on the right, at most this wide. */
  footerMax?: number;
  children: ReactNode;
}

/**
 * Pushed screen with photo header (Patterns.md): photo 240 edge to edge under the TopBar, and the
 * content sheet overlapping it by 30 with a top radius of 30. An optional footer bar stays at the
 * bottom over the content (14 top, 16 sides, 28 bottom), on a fade from clear to the page
 * background by 26% of its height, so the page reads as it scrolls under it.
 */
export function PhotoScreen({ photo, photoHeight = PHOTO, topBar, banner, floating, footer, footerMax, children }: PhotoScreenProps) {
  const bar = useTopBar(topBar, photoHeight);
  const wide = useWideEdges();
  return (
    <View className="flex-1">
      <TopBarHeadingProvider value={bar.register}>
        <ScrollView showsVerticalScrollIndicator={false} onScroll={bar.onScroll} scrollEventThrottle={16} className="flex-1 bg-surface-page">
          <View className="overflow-hidden" style={{ height: photoHeight }}>
            {photo}
          </View>
          <View className={cn('-mt-[30px] gap-18 rounded-t-[30px] bg-surface-page pt-24', wide ? 'px-24' : 'px-20', footer ? 'pb-[120px]' : 'pb-[40px]')}>
            {banner}
            {children}
          </View>
        </ScrollView>
      </TopBarHeadingProvider>
      <View pointerEvents="box-none" className="absolute left-0 right-0 top-0">
        {bar.node}
      </View>
      {floating ? (
        <View pointerEvents="box-none" className="absolute left-0 right-0 top-[108px] items-center px-16">
          {floating}
        </View>
      ) : null}
      {footer ? (
        <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 z-[9] px-16 pb-28 pt-14">
          <FooterFade />
          {footerMax ? (
            <View testID="photo-screen-footer" style={{ width: '100%', maxWidth: footerMax, alignSelf: 'flex-end' }}>
              {footer}
            </View>
          ) : (
            footer
          )}
        </View>
      ) : null}
    </View>
  );
}

/** The footer's backdrop: surface-page from clear to full by 26% (OC-Recipe's action bar). */
function FooterFade() {
  const page = theme.color.surfacePage;
  return (
    <View pointerEvents="none" aria-hidden className="absolute inset-0">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="footer-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={page} stopOpacity={0} />
            <Stop offset="0.26" stopColor={page} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#footer-fade)" />
      </Svg>
    </View>
  );
}

export interface SplitViewProps {
  /** From 960: the NavRail, in its 104 slot. */
  rail?: ReactNode;
  /** From 960: a list beside the detail (a ColumnScreen), 320 wide. Without it the detail fills the screen. */
  list?: ReactNode;
  /** The detail: a whole screen (PhotoScreen, PushedScreen). */
  children: ReactNode;
}

const PANEL_MARGIN = 12;

/**
 * A list beside its detail from 960 (SplitView README, spec 067 FR-005): rail · list 320 · the detail
 * in a framed panel (12 margin top, right and bottom, or the safe area when larger; radius 28, 2 px
 * `line-strong`), scrolling inside. The panel already clears the safe area, so the screen inside it
 * sees none. Without `list` the detail fills the screen as before; it keeps its place in the tree
 * either way, so crossing 960 never remounts it or loses its scroll.
 */
export function SplitView({ rail, list, children }: SplitViewProps) {
  const insets = useContext(SafeAreaInsetsContext);
  const split = list != null;
  const inner = useMemo(() => (split && insets ? { ...insets, top: 0, bottom: 0, left: 0, right: 0 } : insets), [split, insets]);
  return (
    <View className="flex-1 flex-row bg-surface-page">
      {rail ? <View style={{ width: theme.layout.rail }}>{rail}</View> : null}
      {split ? (
        <View testID="split-list" style={{ width: theme.layout.panelExpanded }}>
          {list}
        </View>
      ) : null}
      <View
        testID="split-detail"
        className={cn('min-w-0 flex-1 bg-surface-page', split && 'overflow-hidden rounded-2xl border-2 border-line-strong')}
        style={
          split
            ? {
                marginTop: Math.max(PANEL_MARGIN, insets?.top ?? 0),
                marginBottom: Math.max(PANEL_MARGIN, insets?.bottom ?? 0),
                marginRight: Math.max(PANEL_MARGIN, insets?.right ?? 0),
              }
            : undefined
        }
      >
        <SafeAreaInsetsContext.Provider value={inner}>{children}</SafeAreaInsetsContext.Provider>
      </View>
    </View>
  );
}

/**
 * The list column beside a detail (SplitView README): padding 28 (under the safe area) / 12 / 16 /
 * 20; `header` and `pinned` stay, the rest scrolls, 12 apart.
 */
export function ColumnScreen({ header, pinned, children }: { header?: ReactNode; pinned?: ReactNode; children: ReactNode }) {
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <View className="flex-1 gap-12 pb-16 pl-20 pr-12" style={{ paddingTop: (insets?.top ?? 0) + 28 }}>
      {/* Only as tall as they are: a horizontal pill row (a ScrollView) would otherwise grow into the list's room. */}
      <View testID="column-top" className="flex-none gap-12">
        {header}
        {pinned}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerClassName="gap-8 pb-8" keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
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
  const wide = useWideEdges();
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-surface-page">
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
      <View className={cn('gap-16 pb-[40px] pt-20', wide ? 'px-24' : 'px-20')}>{children}</View>
    </ScrollView>
  );
}

