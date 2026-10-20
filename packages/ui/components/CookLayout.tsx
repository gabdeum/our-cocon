import type { ReactNode, Ref } from 'react';
import { Platform, Pressable, ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { cn, focusRing } from '../cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

const web = Platform.OS === 'web';
// CSS scroll snapping on the web; `snapToOffsets` does it on the iPhone.
const snapBox = (web ? { scrollSnapType: 'y proximity' } : undefined) as ViewStyle | undefined;
const snapStart = (web ? { scrollSnapAlign: 'start' } : undefined) as ViewStyle | undefined;

export interface CookLayoutProps {
  /** "Exit": closes cooking mode. */
  exitLabel: string;
  onExit: () => void;
  /** Right of Exit: the TimerPill, else the "Screen stays on" chip. */
  status?: ReactNode;
  /** The CookProgress bar with "Step N of M". */
  progress: ReactNode;
  /** The CookSections. */
  children: ReactNode;
  /** "Bon appétit!", under the last step. */
  endLabel: string;
  backLabel: string;
  onBack: () => void;
  /** "Next step", or "Finish" on the last step. */
  nextLabel: string;
  onNext: () => void;
  scrollRef?: Ref<ScrollView>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The sections' tops, for snapping on the iPhone. */
  snapOffsets?: number[];
}

/**
 * Cooking mode (Patterns.md › Cooking mode, OC-Cook): a fixed header (Exit, status, the step bar),
 * one scrolling column of steps with scroll-snap, and a fixed footer with a soft Back (⅓) and an
 * olive Next (⅔), both 60 tall.
 */
export function CookLayout(props: CookLayoutProps) {
  const { exitLabel, onExit, status, progress, children, endLabel, backLabel, onBack, nextLabel, onNext, scrollRef, onScroll, snapOffsets } = props;
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
          <View className="min-w-0 flex-shrink items-end">{status}</View>
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
      >
        {children}
        <View className="h-[280px] items-center pt-30">
          <Text size={18} weight="900" color="olive">
            {endLabel}
          </Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-10 border-t-[1.5px] border-line bg-surface-page px-20 pb-28 pt-12">
        <Button label={backLabel} variant="soft" size="lg" block className="flex-1" onPress={onBack} />
        <Button label={nextLabel} variant="olive" size="lg" block className="flex-[2]" onPress={onNext} />
      </View>
    </View>
  );
}

export interface CookSectionProps {
  /** "Step 3". */
  overline: string;
  /** The step's name; left out when it has none. */
  title?: string;
  /** The current step is at full opacity; the others at `opacity-dimmed`. */
  current: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** Step text, then the dark TimerCard, the temperature check and the tip. */
  children: ReactNode;
  testID?: string;
}

/** One step in cooking mode: at least 500 tall, a dashed divider under it, dimmed unless current (250 ms). */
export function CookSection({ overline, title, current, onLayout, children, testID }: CookSectionProps) {
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
      <Text size={13} weight="900" color="olive" uppercase style={{ letterSpacing: 0.8 }}>
        {overline}
      </Text>
      {title ? (
        <Text size={28} weight="900" role="heading" aria-level={2} style={{ letterSpacing: -0.5 }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
