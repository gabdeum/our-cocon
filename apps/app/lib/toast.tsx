import { useMemo } from 'react';
import { useToast as useUiToast } from '@cocon/ui';
import { strings } from '../strings/en';

export { TOAST_ACTION_MS, TOAST_MS, ToastProvider } from '@cocon/ui';

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
      show: ({ text, tone, onUndo, undoFailed, action }: ToastRequest) =>
        toast.show({
          text,
          tone,
          actionLabel: onUndo ? strings.toast.undo : action?.label,
          onAction: onUndo ? () => void onUndo().catch(() => toast.show({ text: undoFailed ?? strings.toast.undoFailed, tone: 'warn' })) : action?.onPress,
        }),
    }),
    [toast],
  );
}
