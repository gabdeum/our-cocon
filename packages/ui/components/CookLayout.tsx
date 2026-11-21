import type { ReactNode, Ref } from 'react';
import { Platform, ScrollView, View, type HostInstance, type LayoutChangeEvent, type ScrollViewInstance, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { useReduceMotion } from '../reduceMotion';
import { cn } from '../cn';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { useTopEdge, useWideTop } from './TopBar';
import { theme } from '../theme';
import { useLayoutTier, type LayoutTier } from '../layout';
import { ToastHost } from './Toast';

const web = Platform.OS === 'web';
// CSS scroll snapping on the web; `snapToOffsets` does it on the iPhone. Mandatory, and a swipe
// never skips a step's start; a step taller than the screen scrolls freely inside (CSS covering
// snap areas) and also rests with its end at the bottom (`snapEnd`).
const snapBox = (web ? { scrollSnapType: 'y mandatory' } : undefined) as ViewStyle | undefined;
const snapStart = (web ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : undefined) as ViewStyle | undefined;
const snapEndMark = (web ? { scrollSnapAlign: 'end', scrollSnapStop: 'always' } : undefined) as ViewStyle | undefined;

export interface CookLayoutProps {
  /** "Exit cooking mode": the round ✕ that closes cooking mode (spec 050). */
  exitLabel: string;
  onExit: () => void;
  /** From 600, right of Exit: the recipe's name (20/900) and "Serves 6 · Classic" under it (spec 066). */
  title?: string;
  subtitle?: string;
  /** Below 600: the TimerPill, floating centred 12 above Back / Next while timers run (spec 066 FR-001). */
  pill?: ReactNode;
  /** The round timer button left of the options button: "Timers" (spec 062). Below 600 only: the panel shows them from 600. */
  timersLabel?: string;
  onTimers?: () => void;
  /** The timers button, so its sheet can give focus back to it. */
  timersRef?: Ref<HostInstance>;
  /** The options button (round settings, like the TopBar's) on the right: "Cooking options". */
  optionsLabel: string;
  onOptions: () => void;
  /** The options button, so its sheet can give focus back to it (spec 030 FR-003). */
  optionsRef?: Ref<HostInstance>;
  /** Its popover is open (honey fill, spec 065). */
  optionsExpanded?: boolean;
  /** The CookProgress bar with "Step N of M"; left out beside the step list, which says where you are. */
  progress?: ReactNode;
  /** From 600: the timers panel on the right (`cookColumns`), full height; it brings its own scrolling (spec 066 FR-002). */
  panel?: ReactNode;
  /** From 960: the CookStepList on the left (spec 066 FR-003), `cookColumns` wide. */
  stepList?: ReactNode;
  /** The CookSections. */
  children: ReactNode;
  /** "Bon appétit!", under the last step. */
  endLabel: string;
  /** "Back", or "Exit" on the first step (`backExits`). */
  backLabel: string;
  onBack: () => void;
  /** On the first step Back leaves cooking mode: ink, with a close icon. */
  backExits?: boolean;
  /** "Next step", or "Finish" on the last step (`nextFinishes`). */
  nextLabel: string;
  onNext: () => void;
  /** On the last step Next leaves cooking mode: ink, with a check icon. */
  nextFinishes?: boolean;
  scrollRef?: Ref<ScrollViewInstance>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The scroll area's height, measured. */
  onViewportLayout?: (height: number) => void;
  /** Where scrolling rests, for snapping on the iPhone. */
  snapOffsets?: number[];
}

/**
 * Cooking mode (Patterns.md › Cooking mode, OC-Cook, OC-CookResponsive): a fixed header (Exit, the
 * step bar), one scrolling column of steps with scroll-snap, and a soft Back (⅓) and an olive Next
 * (⅔), both 60 tall. The buttons that leave cooking mode (Exit on the first step, Finish on the last)
 * are ink, so they never pass for Back or Next.
 *
 * By width (spec 066): below 600 the phone layout, the TimerPill floating above Back / Next; from
 * 600 the recipe's name in the header, the steps in a column up to 640 with Back / Next under it,
 * and the timers panel on the right; from 960 the step list on the left too. The tree is the same at
 * every width, so the steps' scroll and everything in them stay when the window changes tier.
 */
export function CookLayout(props: CookLayoutProps) {
  const { exitLabel, onExit, title, subtitle, pill, timersLabel, onTimers, timersRef, optionsLabel, onOptions, optionsRef, optionsExpanded, progress, panel, stepList, children, endLabel, backLabel, onBack, backExits, nextLabel, onNext, nextFinishes, scrollRef, onScroll, onViewportLayout, snapOffsets } = props;
  const { tier, width } = useLayoutTier();
  const columns = cookColumns(tier, width);
  const wide = tier !== 'compact';
  // The ✕ sits where the TopBar of the loading state put it (16 from the side at every size, not the
  // mockup's 20 from 600), so it doesn't jump when the steps arrive. From 600: where every screen
  // starts (spec 063, 032-later L158). It keeps to the top of its row: from 600 the name and
  // "Serves 6" under it make the row taller than the loading bar's, and centring would drop it.
  const phoneTop = useTopEdge();
  const wideTop = useWideTop();
  return (
    <View className="flex-1 bg-surface-page">
      <View className="gap-12 border-b-[1.5px] border-line bg-surface-page px-16 pb-12" style={{ paddingTop: wide ? wideTop : phoneTop }}>
        <View className="flex-row items-center justify-between gap-12">
          <IconButton variant="round" icon="close" iconSize={20} label={exitLabel} onPress={onExit} className="self-start" />
          {wide && title ? (
            <View className="min-w-0 flex-1">
              <Text size={20} weight="900" role="heading" aria-level={1} numberOfLines={1} style={{ letterSpacing: -0.3 }}>
                {title}
              </Text>
              {subtitle ? (
                <Text size={14} weight="700" color="ink-muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View className="flex-none flex-row items-center gap-8 self-start">
            {!wide && timersLabel && onTimers ? <IconButton ref={timersRef} variant="round" icon="timer" label={timersLabel} onPress={onTimers} /> : null}
            <IconButton ref={optionsRef} variant="round" icon="settings" label={optionsLabel} expanded={optionsExpanded} onPress={onOptions} />
          </View>
        </View>
        {progress ? <View className="px-4">{progress}</View> : null}
      </View>

      <View className={cn('flex-1 flex-row', wide && 'gap-16 px-20 pb-20 pt-16')}>
        {wide && stepList ? <View className="flex-none" style={{ width: columns.stepList }}>{stepList}</View> : null}
        <View className="min-w-0 flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName={wide ? 'px-8' : 'px-20'}
            style={snapBox}
            snapToOffsets={web ? undefined : snapOffsets}
            // The iPhone rests on the offset past where the swipe would stop; 'fast' keeps that the next
            // one. (`disableIntervalMomentum` only works with `snapToInterval`, not `snapToOffsets`.)
            decelerationRate={web ? undefined : 'fast'}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onLayout={onViewportLayout ? (e) => onViewportLayout(e.nativeEvent.layout.height) : undefined}
          >
            <View className="w-full self-center" style={wide ? { maxWidth: theme.layout.reading } : undefined}>
              {children}
              <View className="h-[280px] items-center pt-30">
                <Text size={18} weight="900" color="olive" align="center">
                  {endLabel}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* No height: the pill floats 12 above Back / Next, over the steps (SC-003). */}
          {!wide && pill ? (
            <View testID="cook-pill" pointerEvents="box-none" className="z-10 h-0">
              <View pointerEvents="box-none" className="absolute bottom-12 left-0 right-0 items-center">
                {pill}
              </View>
            </View>
          ) : null}

          <View className={cn('bg-surface-page', wide ? 'px-8 pt-12' : 'border-t-[1.5px] border-line px-20 pb-28 pt-12')}>
            <View className="w-full flex-row gap-10 self-center" style={wide ? { maxWidth: theme.layout.reading } : undefined}>
              <Button label={backLabel} variant={backExits ? 'ink' : 'soft'} icon={backExits ? 'close' : undefined} size="lg" block className="flex-1" onPress={onBack} />
              <Button label={nextLabel} variant={nextFinishes ? 'ink' : 'olive'} icon={nextFinishes ? 'check' : undefined} size="lg" block className="flex-[2]" onPress={onNext} />
            </View>
          </View>
        </View>
        {wide && panel ? (
          <View className="flex-none" style={{ width: columns.panel }}>
            {panel}
          </View>
        ) : null}
      </View>
      <ToastHost />
    </View>
  );
}

export interface CookSectionProps {
  /** The step's name; left out when it has none. */
  title?: string;
  /** The step's photo (StepPhoto), right of the title, top-aligned (spec 066 FR-004). */
  photo?: ReactNode;
  /** The current step is at full opacity; the others at `opacity-dimmed`. */
  current: boolean;
  /** 500, or 60 % of the window from 600 so the next step peeks below (spec 066 FR-007). */
  minHeight?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Taller than the screen: on the web it also snaps with its end at the bottom. */
  snapEnd?: boolean;
  /** Step text, then the dark TimerCard, the temperature check and the tip. */
  children: ReactNode;
  testID?: string;
}

/** One step in cooking mode: at least 500 tall, a dashed divider under it, dimmed unless current (250 ms). */
export function CookSection({ title, photo, current, minHeight = MIN_STEP, onLayout, snapEnd, children, testID }: CookSectionProps) {
  const reduceMotion = useReduceMotion();
  return (
    <View
      testID={testID}
      aria-current={current ? 'step' : undefined}
      onLayout={onLayout}
      className={cn(
        'gap-16 border-b-[1.5px] border-dashed border-line-strong pb-28 pt-24',
        !reduceMotion && 'transition-opacity duration-[250ms]',
        current ? 'opacity-100' : 'opacity-dimmed',
      )}
      style={[{ minHeight }, snapStart]}
    >
      {title || photo ? (
        <View className="flex-row items-start gap-14">
          <View className="min-w-0 flex-1">
            {title ? (
              <Text size={28} weight="900" role="heading" aria-level={2} style={{ letterSpacing: -0.5 }}>
                {title}
              </Text>
            ) : null}
          </View>
          {photo}
        </View>
      ) : null}
      {children}
      {web && snapEnd ? <View aria-hidden pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-0" style={snapEndMark} /> : null}
    </View>
  );
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

/**
 * The side columns from 600 (spec 066): they grow a little with the window so the steps fill the
 * middle instead of centring on a large iPad, and stay the widest column. Step list (960+): 18 % of
 * the window, 260 to 300. Timers panel: 24 %, from 290 (320 from 960) to 380. The steps take the
 * rest, up to `layout-reading`.
 */
export function cookColumns(tier: LayoutTier, windowWidth: number): { stepList: number; panel: number } {
  const { stepList, stepListMax, panelMedium, panelExpanded, panelMax } = theme.layout;
  return {
    stepList: clamp(stepList, windowWidth * 0.18, stepListMax),
    panel: clamp(tier === 'expanded' ? panelExpanded : panelMedium, windowWidth * 0.24, panelMax),
  };
}

/** A step section's least height (OC-Cook): 500. */
const MIN_STEP = 500;

/** Spec 066 FR-007: 500 below 600; from 600, 60 % of the window's height, never under 500. */
export function cookStepHeight(tier: LayoutTier, windowHeight: number): number {
  return tier === 'compact' ? MIN_STEP : Math.max(MIN_STEP, Math.round(windowHeight * 0.6));
}
