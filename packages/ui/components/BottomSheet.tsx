import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, View, type HostInstance } from 'react-native';
import { cn } from '../cn';
import { useReduceMotion } from '../reduceMotion';
import { theme } from '../theme';
import { Button, type ButtonProps } from './Button';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  lead?: string;
  /** Close IconButton (soft) or a "Clear all" Link on the right of the title. */
  headerAction?: ReactNode;
  children: ReactNode;
  /** Fixed footer: one ink Button, or SheetFooter (Cancel + primary). */
  footer?: ReactNode;
  /** Unsaved changes: tapping the scrim or swiping down doesn't close the sheet. */
  dirty?: boolean;
  /** Screen-reader name of the scrim: "Close". */
  closeLabel: string;
}

const SWIPE_CLOSE = 80;
const DURATION = 250;

/**
 * A sheet over a dimmed screen for one focused task (BottomSheet README). Hugs its content up to
 * 92% of the screen; the body scrolls, the footer doesn't. Swipe down closes; focus moves to the
 * title on open; Reduce Motion skips the slide.
 */
export function BottomSheet({ visible, onClose, title, lead, headerAction, children, footer, dirty, closeLabel }: BottomSheetProps) {
  const titleId = useId();
  const titleRef = useRef<HostInstance>(null);
  const reduce = useReduceMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const requestClose = useCallback(() => {
    if (!dirty) onClose();
  }, [dirty, onClose]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > SWIPE_CLOSE) requestClose();
          Animated.timing(offset, { toValue: 0, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
        },
      }),
    [offset, requestClose],
  );

  useEffect(() => {
    if (!visible) return;
    offset.setValue(reduce ? 0 : 600);
    if (!reduce) Animated.timing(offset, { toValue: 0, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    const t = setTimeout(() => (titleRef.current as unknown as { focus?: () => void } | null)?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [visible, reduce, offset]);

  return (
    <Modal transparent visible={visible} animationType={reduce ? 'none' : 'fade'} onRequestClose={requestClose}>
      <View className="flex-1 justify-end">
        <Pressable role="button" aria-label={closeLabel} onPress={requestClose} className="absolute inset-0 bg-scrim" />
        {/* NativeWind doesn't style Animated.View: it only slides; the View inside carries the look. */}
        <Animated.View style={{ width: '100%', maxWidth: theme.layout.maxWidth, maxHeight: '92%', alignSelf: 'center', transform: [{ translateY: offset }] }}>
          <View role="dialog" aria-modal aria-labelledby={titleId} className="max-h-full gap-16 rounded-t-sheet bg-surface-page px-20 pb-28 pt-12">
            <View {...pan.panHandlers} className="gap-16">
              <View aria-hidden className="h-[5px] w-[44px] self-center rounded-[3px] bg-line-handle" />
              <View className="flex-row items-start gap-12">
                <View ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 web:outline-none">
                  <Text variant="titleLg" role="heading" nativeID={titleId}>
                    {title}
                  </Text>
                  {lead ? (
                    <Text size={15} weight="600" color="ink-muted" className="mt-4" style={{ lineHeight: 15 * 1.45 }}>
                      {lead}
                    </Text>
                  ) : null}
                </View>
                {headerAction}
              </View>
            </View>
            <ScrollView className="shrink" contentContainerClassName="gap-16">
              {children}
            </ScrollView>
            {footer}
          </View>
        </Animated.View>
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
