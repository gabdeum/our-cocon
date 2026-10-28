import type { ReactNode, Ref } from 'react';
import { Platform, Pressable, ScrollView, View, type LayoutChangeEvent, type ScrollViewInstance, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { cn, focusRing } from '../cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

const web = Platform.OS === 'web';
// CSS scroll snapping on the web; `snapToOffsets` does it on the iPhone. Mandatory, and a swipe
// never skips a step's start; a step taller than the screen scrolls freely inside (CSS covering
// snap areas) and also rests with its end at the bottom (`snapEnd`).
const snapBox = (web ? { scrollSnapType: 'y mandatory' } : undefined) as ViewStyle | undefined;
const snapStart = (web ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : undefined) as ViewStyle | undefined;
const snapEndMark = (web ? { scrollSnapAlign: 'end', scrollSnapStop: 'always' } : undefined) as ViewStyle | undefined;

export interface CookLayoutProps {
  /** "Exit": closes cooking mode. */
  exitLabel: string;
  onExit: () => void;
  /** Right of Exit, before the options button: the TimerPill while timers run. */
  status?: ReactNode;
  /** The options button (settings icon, soft 44) on the right: "Cooking options". */
  optionsLabel: string;
  onOptions: () => void;
  /** The CookProgress bar with "Step N of M". */
  progress: ReactNode;
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
 * Cooking mode (Patterns.md › Cooking mode, OC-Cook): a fixed header (Exit, status, the step bar),
 * one scrolling column of steps with scroll-snap, and a fixed footer with a soft Back (⅓) and an
 * olive Next (⅔), both 60 tall. The buttons that leave cooking mode (Exit on the first step, Finish
 * on the last) are ink, so they never pass for Back or Next.
 */
export function CookLayout(props: CookLayoutProps) {
  const { exitLabel, onExit, status, optionsLabel, onOptions, progress, children, endLabel, backLabel, onBack, backExits, nextLabel, onNext, nextFinishes, scrollRef, onScroll, onViewportLayout, snapOffsets } = props;
  return (
    <View className="flex-1 bg-surface-page">
      <View className="gap-12 border-b-[1.5px] border-line bg-surface-page px-20 pb-12 pt-[50px]">
        <View className="flex-row items-center justify-between gap-8">
          <Pressable
            role="button"
            onPress={onExit}
            className={cn('h-control-md flex-row items-center gap-4 rounded-pill bg-surface-soft pl-8 pr-14 active:bg-surface-soft-pressed', focusRing)}
          >
            <Icon name="close" />
            <Text size={15} weight="800">
              {exitLabel}
            </Text>
          </Pressable>
          <View className="min-w-0 flex-shrink flex-row items-center justify-end gap-8">
            {status}
            <IconButton icon="settings" label={optionsLabel} variant="soft" onPress={onOptions} />
          </View>
        </View>
        {progress}
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="px-20"
        style={snapBox}
        snapToOffsets={web ? undefined : snapOffsets}
        decelerationRate={web ? undefined : 'fast'}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={onViewportLayout ? (e) => onViewportLayout(e.nativeEvent.layout.height) : undefined}
      >
        {children}
        <View className="h-[280px] items-center pt-30">
          <Text size={18} weight="900" color="olive">
            {endLabel}
          </Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-10 border-t-[1.5px] border-line bg-surface-page px-20 pb-28 pt-12">
        <Button label={backLabel} variant={backExits ? 'ink' : 'soft'} icon={backExits ? 'close' : undefined} size="lg" block className="flex-1" onPress={onBack} />
        <Button label={nextLabel} variant={nextFinishes ? 'ink' : 'olive'} icon={nextFinishes ? 'check' : undefined} size="lg" block className="flex-[2]" onPress={onNext} />
      </View>
    </View>
  );
}

export interface CookSectionProps {
  /** The step's name; left out when it has none. */
  title?: string;
  /** The current step is at full opacity; the others at `opacity-dimmed`. */
  current: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Taller than the screen: on the web it also snaps with its end at the bottom. */
  snapEnd?: boolean;
  /** Step text, then the dark TimerCard, the temperature check and the tip. */
  children: ReactNode;
  testID?: string;
}

/** One step in cooking mode: at least 500 tall, a dashed divider under it, dimmed unless current (250 ms). */
export function CookSection({ title, current, onLayout, snapEnd, children, testID }: CookSectionProps) {
  return (
    <View
      testID={testID}
      aria-current={current ? 'step' : undefined}
      onLayout={onLayout}
      className={cn(
        'min-h-[500px] gap-16 border-b-[1.5px] border-dashed border-line-strong pb-28 pt-24 transition-opacity duration-[250ms]',
        current ? 'opacity-100' : 'opacity-dimmed',
      )}
      style={snapStart}
    >
      {title ? (
        <Text size={28} weight="900" role="heading" aria-level={2} style={{ letterSpacing: -0.5 }}>
          {title}
        </Text>
      ) : null}
      {children}
      {web && snapEnd ? <View aria-hidden pointerEvents="none" className="absolute bottom-0 left-0 right-0 h-0" style={snapEndMark} /> : null}
    </View>
  );
}
