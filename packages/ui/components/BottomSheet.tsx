import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Dimensions, Easing, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View, type HostInstance } from 'react-native';
import { useReturnFocus } from '../a11y';
import { cn } from '../cn';
import { POPOVER, popoverPlacement, sheetPresentation, useLayoutTier, type Rect, type SheetKind, type SheetPresentation } from '../layout';
import { useReduceMotion } from '../reduceMotion';
import { theme } from '../theme';
import { Button, type ButtonProps } from './Button';
import { IconButton } from './IconButton';
import { SegmentedControl, type Segment } from './SegmentedControl';
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
  /** The button that opened the sheet: focus goes back to it on close (spec 030 FR-003). */
  returnFocusRef?: RefObject<HostInstance | null>;
  /**
   * What the sheet is for, which sets how it shows from 600 (spec 065): `menu` (short choices) is a
   * popover under the button that opened it; `flow` (the default) is a centred card.
   */
  kind?: SheetKind;
  /** The button a popover points at; defaults to `returnFocusRef`. Without one it opens as a card. */
  anchorRef?: RefObject<HostInstance | null>;
  /** A soft ✕ on the right of the title, at every size (a card always has one, in place of the handle). */
  closeButton?: boolean;
  /**
   * In place of the title, a pill SegmentedControl between related sheets: the calendar's "New event ·
   * New reminder". `title` still names the dialog for screen readers.
   */
  titleSwitch?: { label: string; segments: Segment<string>[]; value: string; onChange: (key: string) => void };
}

const SWIPE_CLOSE = 80;
const DURATION = 250;

/**
 * A sheet for one focused task (BottomSheet README). Below 600, over a dimmed screen: hugs its
 * content up to 92% of the screen; the body scrolls, the footer doesn't. Swipe down closes; Reduce
 * Motion skips the slide. On the iPhone the sheet rises above the keyboard, so the field being typed
 * in stays in view (spec 030, L98). From 600 (spec 065), a `menu` is a popover pointing at its
 * button and a `flow` a centred card; the content and buttons are the same. Focus moves to the
 * title on open, and back to `returnFocusRef` on close.
 */
export function BottomSheet(props: BottomSheetProps) {
  const { visible, onClose, dirty, fieldFocus = false, returnFocusRef, kind = 'flow', anchorRef } = props;
  const titleId = useId();
  useReturnFocus(visible, returnFocusRef);
  const titleRef = useRef<HostInstance>(null);
  const { tier } = useLayoutTier();
  const wanted = sheetPresentation(tier, kind);
  const anchor = useAnchorRect(visible && wanted === 'popover', anchorRef ?? returnFocusRef);
  // A menu with no button to point at opens as a card.
  const presentation: SheetPresentation = wanted === 'popover' && anchor === 'none' ? 'card' : wanted;
  const requestClose = useCallback(() => {
    if (!dirty) onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!visible || fieldFocus) return;
    const t = setTimeout(() => (titleRef.current as unknown as { focus?: () => void } | null)?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [visible, fieldFocus, presentation]);

  const parts: Parts = { ...props, titleId, titleRef, requestClose };
  if (presentation === 'popover') return <Popover {...parts} anchor={anchor === 'none' ? null : anchor} />;
  if (presentation === 'card') return <Card {...parts} />;
  return <Sheet {...parts} />;
}

type Parts = BottomSheetProps & { titleId: string; titleRef: RefObject<HostInstance | null>; requestClose: () => void };

/** The bottom sheet (below 600), as it has always been. */
function Sheet({ visible, onClose, children, footer, floating, dirty, closeLabel, closeButton, requestClose, ...header }: Parts) {
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
  }, [visible, reduce, offset]);

  return (
    <Modal transparent visible={visible} animationType={reduce || swiped ? 'none' : 'fade'} onRequestClose={requestClose}>
      <Frame>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim }]}>
          <Pressable role="button" aria-label={closeLabel} onPress={requestClose} className="absolute inset-0 bg-scrim" />
        </Animated.View>
        {/* NativeWind doesn't style Animated.View: it only slides; the View inside carries the look. */}
        <Animated.View style={{ width: '100%', maxWidth: theme.layout.phoneMax, maxHeight: '92%', alignSelf: 'center', transform: [{ translateY: offset }] }}>
          <View role="dialog" aria-modal {...dialogName(header)} testID="sheet" className="max-h-full gap-16 rounded-t-sheet bg-surface-page px-20 pb-28">
            {/* The drag strip starts at the sheet's top edge, so a finger just above the bar counts. */}
            <View {...pan.panHandlers} className="gap-16 pt-12">
              <View aria-hidden className="h-[5px] w-[44px] self-center rounded-[3px] bg-line-handle" />
              <Header {...header} close={closeButton ? <CloseButton label={closeLabel} onPress={onClose} /> : null} />
            </View>
            <Body floating={floating}>{children}</Body>
            {footer}
            {floating ? <View className="absolute bottom-[34px] right-20">{floating}</View> : null}
          </View>
        </Animated.View>
        {visible ? <ToastHost /> : null}
      </Frame>
    </Modal>
  );
}

/**
 * A flow from 600 (spec 065 FR-003): a centred card, 540 wide (at most the window less 48), at most
 * the window less 96 tall with the body scrolling. The same scrim; a ✕ in place of the handle. On
 * the iPad it moves up above the keyboard, the body scrolling if it must (FR-004).
 */
function Card({ visible, onClose, children, footer, floating, closeLabel, requestClose, ...header }: Parts) {
  const reduce = useReduceMotion();
  const { width } = useLayoutTier();
  return (
    <Modal transparent visible={visible} animationType={reduce ? 'none' : 'fade'} onRequestClose={requestClose}>
      <View className="flex-1">
        {/* The ✕ is the named way out; the scrim closes too. */}
        <Pressable aria-hidden onPress={requestClose} className="absolute inset-0 bg-scrim" />
        <KeyboardFrame>
          <View
            role="dialog"
            aria-modal
            {...dialogName(header)}
            testID="sheet-card"
            className="max-h-full gap-16 rounded-sheet bg-surface-page px-24 pb-[22px] pt-20"
            style={{ width: Math.min(theme.layout.card, width - 48) }}
          >
            <Header {...header} close={<CloseButton label={closeLabel} onPress={onClose} />} />
            <Body floating={floating}>{children}</Body>
            {footer}
            {floating ? <View className="absolute bottom-[34px] right-20">{floating}</View> : null}
          </View>
        </KeyboardFrame>
        {visible ? <ToastHost /> : null}
      </View>
    </Modal>
  );
}

/**
 * A menu from 600 (spec 065 FR-002): a popover 12 under the button that opened it, its arrow on the
 * button's centre. No dim, so the screen behind stays readable; an outside tap or Escape closes it.
 * It opens above the button when there's more room there, and keeps clear of the keyboard.
 */
function Popover({ visible, children, footer, closeLabel, requestClose, anchor, ...header }: Parts & { anchor: Rect | null }) {
  const { width, height } = useLayoutTier();
  const keyboard = useKeyboardHeight(visible);
  // Its own height, measured once before it shows, decides whether it fits below.
  const [natural, setNatural] = useState<number | null>(null);
  // Measured again on each opening: its content may have changed since.
  if (!visible && natural !== null) setNatural(null);
  const at = anchor ? popoverPlacement(anchor, { width, height: height - keyboard }, natural ?? undefined) : null;
  const arrow = { left: at?.arrowLeft ?? 0, width: POPOVER.arrow, height: POPOVER.arrow, transform: [{ rotate: '45deg' }] };
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={requestClose}>
      <Pressable role="button" aria-label={closeLabel} onPress={requestClose} className="absolute inset-0" />
      {at ? (
        <View
          role="dialog"
          aria-modal
          {...dialogName(header)}
          testID="sheet-popover"
          onLayout={(e) => natural ?? setNatural(e.nativeEvent.layout.height)}
          className="absolute gap-12 rounded-xl border-[1.5px] border-line bg-surface-page p-16"
          style={{ left: at.left, top: at.top, width: at.width, maxHeight: natural == null ? undefined : at.maxHeight, opacity: natural == null ? 0 : 1, boxShadow: theme.shadow.float }}
        >
          <View
            aria-hidden
            className={cn('absolute border-line bg-surface-page', at.above ? 'bottom-[-8.5px] border-b-[1.5px] border-r-[1.5px]' : 'top-[-8.5px] border-l-[1.5px] border-t-[1.5px]')}
            style={arrow}
          />
          <Header {...header} small close={null} />
          <Body>{children}</Body>
          {footer}
        </View>
      ) : null}
      {visible ? <ToastHost /> : null}
    </Modal>
  );
}

/** The dialog's name: its title, or the title as a label when a switch shows in its place. */
const dialogName = ({ title, titleId, titleSwitch }: Pick<Parts, 'title' | 'titleId' | 'titleSwitch'>) => (titleSwitch ? { 'aria-label': title } : { 'aria-labelledby': titleId });

function Header({
  title,
  lead,
  leading,
  hero,
  headerAction,
  titleSwitch,
  titleId,
  titleRef,
  small,
  close,
}: Pick<Parts, 'title' | 'lead' | 'leading' | 'hero' | 'headerAction' | 'titleSwitch' | 'titleId' | 'titleRef'> & { small?: boolean; close: ReactNode }) {
  const heading = titleSwitch ? (
    <SegmentedControl variant="pill" label={titleSwitch.label} segments={titleSwitch.segments} value={titleSwitch.value} onChange={titleSwitch.onChange} />
  ) : small ? (
    <Text size={18} weight="900" role="heading" nativeID={titleId}>
      {title}
    </Text>
  ) : (
    <Text variant="titleLg" role="heading" nativeID={titleId} align={hero != null ? 'center' : undefined}>
      {title}
    </Text>
  );
  if (hero != null || leading != null)
    return (
      <View className={cn(hero != null ? 'items-center gap-14' : 'flex-row items-center gap-12')}>
        {hero ?? leading}
        <View ref={titleRef} tabIndex={-1} className={cn('min-w-0 web:outline-none', hero == null && 'flex-1')}>
          {heading}
          {lead ? (
            <Text size={15} weight="600" color="ink-muted" className="mt-4" align={hero != null ? 'center' : undefined} style={{ lineHeight: 15 * 1.45 }}>
              {lead}
            </Text>
          ) : null}
        </View>
        {headerAction}
        {/* Under a hero the row is a column: the ✕ goes to the top right instead. */}
        {hero != null && close ? <View className="absolute right-0 top-0">{close}</View> : close}
      </View>
    );
  // The title and its button (✕, "Edit") centred on each other; the lead runs under both.
  return (
    <View>
      <View className="flex-row items-center gap-12">
        <View ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 web:outline-none">
          {heading}
        </View>
        {headerAction}
        {close}
      </View>
      {lead ? (
        <Text size={15} weight="600" color="ink-muted" className="mt-4" style={{ lineHeight: 15 * 1.45 }}>
          {lead}
        </Text>
      ) : null}
    </View>
  );
}

function CloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <IconButton icon="close" label={label} variant="soft" onPress={onPress} />;
}

function Body({ floating, children }: { floating?: ReactNode; children: ReactNode }) {
  // The body scrolls clear of the floating button (60 + 12).
  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="shrink" contentContainerClassName={cn('gap-16', floating != null && 'pb-[72px]')}>
      {children}
    </ScrollView>
  );
}

/** The anchor's place in the window, measured on open and on resizing; 'none' when it can't be. */
function useAnchorRect(active: boolean, ref: RefObject<HostInstance | null> | undefined): Rect | 'none' | null {
  const [rect, setRect] = useState<Rect | 'none' | null>(null);
  const { width, height } = useLayoutTier();
  useEffect(() => {
    if (!active) return;
    const node = ref?.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null | undefined;
    if (!node?.measureInWindow) {
      setRect('none');
      return;
    }
    let live = true;
    node.measureInWindow((x, y, w, h) => live && setRect({ x, y, width: w, height: h }));
    return () => {
      live = false;
    };
  }, [active, ref, width, height]);
  return active ? rect : null;
}

/** How much of the window the iPad's keyboard covers (0 elsewhere). */
function useKeyboardHeight(active: boolean): number {
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    if (!active || Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setCovered(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setCovered(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active]);
  return covered;
}

/** The sheet's place on screen. On the iPhone it rises with the keyboard (L98); elsewhere it needn't. */
function Frame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') return <View className="flex-1 justify-end">{children}</View>;
  // NativeWind doesn't style KeyboardAvoidingView.
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      {children}
    </KeyboardAvoidingView>
  );
}

/** The card, centred 48 from the top and bottom and 24 from the sides; on the iPad, above the keyboard (FR-004). */
function KeyboardFrame({ children }: { children: ReactNode }) {
  const inner = (
    <View pointerEvents="box-none" className="flex-1 items-center justify-center px-24 py-[48px]">
      {children}
    </View>
  );
  if (Platform.OS !== 'ios') return inner;
  return (
    <KeyboardAvoidingView testID="sheet-keyboard" pointerEvents="box-none" behavior="padding" style={styles.centre}>
      {inner}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, justifyContent: 'flex-end' }, centre: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } });

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
