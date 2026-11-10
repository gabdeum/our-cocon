import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, type HostInstance } from 'react-native';
import { cn } from '../cn';
import { useReduceMotion } from '../reduceMotion';
import { theme } from '../theme';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';
import { ToastHost } from './Toast';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  lead?: string;
  /** Before the title, centred on it: OC-CalBusy's 48 avatar (spec 043). */
  leading?: ReactNode;
  /** Above the title, with the title and lead centred under it: OC-NotifAsk's bell (spec 046). */
  hero?: ReactNode;
  /** Close IconButton (soft) or a "Clear all" Link on the right of the title. */
  headerAction?: ReactNode;
  children: ReactNode;
  /** Fixed footer: one ink Button, or SheetFooter (Cancel + primary). */
  footer?: ReactNode;
  /** A round button over the bottom-right of the sheet, 20 from the side and 34 from the bottom (the month's day sheet). */
  floating?: ReactNode;
  /** Unsaved changes: tapping the scrim or swiping down doesn't close the sheet. */
  dirty?: boolean;
  /** Screen-reader name of the scrim: "Close". */
  closeLabel: string;
  /** A field inside takes focus on open (`autoFocus`), so the title doesn't: the add sheet's keyboard opens at once. */
  fieldFocus?: boolean;
}

const SWIPE_CLOSE = 80;
const DURATION = 250;

/**
 * A sheet over a dimmed screen for one focused task (BottomSheet README). Hugs its content up to
 * 92% of the screen; the body scrolls, the footer doesn't. Swipe down closes; focus moves to the
 * title on open; Reduce Motion skips the slide.
 */
export function BottomSheet({ visible, onClose, title, lead, leading, hero, headerAction, children, footer, floating, dirty, closeLabel, fieldFocus = false }: BottomSheetProps) {
  const titleId = useId();
  const titleRef = useRef<HostInstance>(null);
  const reduce = useReduceMotion();
  const [offset] = useState(() => new Animated.Value(0));
  // The dim follows the sheet: it lightens as the sheet is dragged down and is gone when it's off the screen.
  const [scrim] = useState(() => offset.interpolate({ inputRange: [0, Dimensions.get('window').height], outputRange: [1, 0], extrapolate: 'clamp' }));
  // Swiped away, the sheet and the dim are already gone: the Modal closes without fading out again.
  const [swiped, setSwiped] = useState(false);
  const [shown, setShown] = useState(visible);
  if (shown !== visible) {
    setShown(visible);
    if (visible) setSwiped(false);
  }
  const requestClose = useCallback(() => {
    if (!dirty) onClose();
  }, [dirty, onClose]);

  const pan = useMemo(() => {
    const slide = (toValue: number, done?: () => void) =>
      Animated.timing(offset, { toValue, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: false }).start(done);
    return PanResponder.create({
      // The strip takes the touch as soon as it lands, as the photo crop and reorder handles do:
      // on the iPhone, waiting for a move left the drag to nobody. Its close button still gets taps.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy <= SWIPE_CLOSE || dirty) return slide(0);
        // Let go past the threshold: the sheet carries on down off the screen, then closes.
        if (reduce) return onClose();
        slide(Dimensions.get('window').height, () => {
          setSwiped(true);
          onClose();
        });
      },
      // iOS can still cancel a drag: the sheet goes back up instead of staying part-way.
      onPanResponderTerminate: () => slide(0),
    });
  }, [offset, dirty, onClose, reduce]);

  useEffect(() => {
    if (!visible) return;
    offset.setValue(reduce ? 0 : 600);
    if (!reduce) Animated.timing(offset, { toValue: 0, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    if (fieldFocus) return;
    const t = setTimeout(() => (titleRef.current as unknown as { focus?: () => void } | null)?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [visible, reduce, offset, fieldFocus]);

  return (
    <Modal transparent visible={visible} animationType={reduce || swiped ? 'none' : 'fade'} onRequestClose={requestClose}>
      <View className="flex-1 justify-end">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim }]}>
          <Pressable role="button" aria-label={closeLabel} onPress={requestClose} className="absolute inset-0 bg-scrim" />
        </Animated.View>
        {/* NativeWind doesn't style Animated.View: it only slides; the View inside carries the look. */}
        <Animated.View style={{ width: '100%', maxWidth: theme.layout.maxWidth, maxHeight: '92%', alignSelf: 'center', transform: [{ translateY: offset }] }}>
          <View role="dialog" aria-modal aria-labelledby={titleId} className="max-h-full gap-16 rounded-t-sheet bg-surface-page px-20 pb-28">
            {/* The drag strip starts at the sheet's top edge, so a finger just above the bar counts. */}
            <View {...pan.panHandlers} className="gap-16 pt-12">
              <View aria-hidden className="h-[5px] w-[44px] self-center rounded-[3px] bg-line-handle" />
              <View className={cn(hero != null ? 'items-center gap-14' : 'flex-row gap-12', !hero && (leading ? 'items-center' : 'items-start'))}>
                {hero ?? leading}
                <View ref={titleRef} tabIndex={-1} className={cn('min-w-0 web:outline-none', hero == null && 'flex-1')}>
                  <Text variant="titleLg" role="heading" nativeID={titleId} align={hero != null ? 'center' : undefined}>
                    {title}
                  </Text>
                  {lead ? (
                    <Text size={15} weight="600" color="ink-muted" className="mt-4" align={hero != null ? 'center' : undefined} style={{ lineHeight: 15 * 1.45 }}>
                      {lead}
                    </Text>
                  ) : null}
                </View>
                {headerAction}
              </View>
            </View>
            {/* The body scrolls clear of the floating button (60 + 12). */}
            <ScrollView showsVerticalScrollIndicator={false} className="shrink" contentContainerClassName={cn('gap-16', floating != null && 'pb-[72px]')}>
              {children}
            </ScrollView>
            {footer}
            {floating ? <View className="absolute bottom-[34px] right-20">{floating}</View> : null}
          </View>
        </Animated.View>
        {visible ? <ToastHost /> : null}
      </View>
    </Modal>
  );
}

export interface SheetFooterProps {
  /** Soft Cancel (≈110 wide) on the left. */
  cancel?: { label: string; onPress: () => void };
  /** Ink primary that fills the rest; its label states the result: "Show 12 recipes". */
  primary: Omit<ButtonProps, 'variant' | 'block'>;
}

/** Sheet footer (Patterns.md › Bottom sheet): one full-width ink button, or Cancel + primary. */
export function SheetFooter({ cancel, primary }: SheetFooterProps) {
  return (
    <View className="flex-row gap-10">
      {cancel ? <Button label={cancel.label} variant="soft" onPress={cancel.onPress} className="w-[110px]" /> : null}
      <Button {...primary} variant="ink" className={cn('flex-1', primary.className)} />
    </View>
  );
}
