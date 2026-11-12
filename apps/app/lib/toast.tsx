import { useEffect, useEffectEvent, useMemo, type ReactNode } from 'react';
import { ToastProvider as UiToastProvider, useToast as useUiToast } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';

export { TOAST_ACTION_MS, TOAST_MS } from '@cocon/ui';

/** The one toast, with its ✕ named and counted (`toast_dismissed`, spec 053). */
export function ToastProvider({ children, tracker }: { children: ReactNode; tracker?: Pick<Tracker, 'track'> }) {
  return (
    <UiToastProvider dismissLabel={strings.toast.dismiss} onDismiss={(tone) => tracker?.track('toast_dismissed', { tone })}>
      {children}
    </UiToastProvider>
  );
}

export interface ToastRequest {
  text: string;
  /** `warn` when something failed. */
  tone?: 'sage' | 'warn';
  /**
   * Undo; the toast closes as soon as it's tapped. When its promise fails, a toast says so
   * (032-later L99): `undoFailed`, or "Couldn't undo. Check your connection and try again."
   */
  onUndo?: () => Promise<unknown>;
  undoFailed?: string;
  /** A round "Try again" (retry icon), for something that failed and can be retried (spec 053 FR-015). */
  retry?: () => void;
  /** Another button than Undo: "Open timers". */
  action?: { label: string; onPress: () => void };
}

/**
 * The app's one toast (Toast README), shown from any screen, a closing one included (the add sheet,
 * the event page): it stays up over whatever screen is under it. A new one replaces it.
 */
export function useToast() {
  const toast = useUiToast();
  return useMemo(
    () => ({
      hide: toast.hide,
      show: ({ text, tone, onUndo, undoFailed, retry, action }: ToastRequest) =>
        toast.show({
          text,
          tone,
          actionLabel: onUndo ? strings.toast.undo : retry ? strings.toast.tryAgain : action?.label,
          actionIcon: onUndo ? 'undo' : retry ? 'retry' : undefined,
          onAction: onUndo ? () => void onUndo().catch(() => toast.show({ text: undoFailed ?? strings.toast.undoFailed, tone: 'warn' })) : (retry ?? action?.onPress),
        }),
    }),
    [toast],
  );
}

/**
 * Spec 053 FR-015: a failure is a warn toast, never a message in the layout. Shows `text` each time
 * it turns non-empty (the screen clears it when it tries again), with a round Try again when `retry` is given.
 */
export function useFailureToast(text: string | null | false | undefined, retry?: () => void) {
  const toast = useToast();
  const show = useEffectEvent((message: string) => toast.show({ text: message, tone: 'warn', retry }));
  useEffect(() => {
    if (text) show(text);
  }, [text]);
}
