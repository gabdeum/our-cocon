import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UndoToast } from '@cocon/ui';
import { strings } from '../strings/en';

/** Toast README: 5 s, then it goes. */
export const TOAST_MS = 5000;

export interface ToastRequest {
  text: string;
  /**
   * Undo; the toast closes as soon as it's tapped. When its promise fails, a toast says so
   * (032-later L99). Without it the toast only tells.
   */
  onUndo?: () => Promise<unknown>;
}

interface ToastApi {
  show: (toast: ToastRequest) => void;
  /** A toast is showing: the calendar hides its floating add button meanwhile (Toast README). */
  visible: boolean;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined, visible: false });

/**
 * The ink Undo toast above the tab bar (spec 041 FR-009), shown by a screen that's closing (the
 * add sheet, the event page), so it stays up over whatever screen is under it. One at a time: a new
 * one replaces it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastRequest & { key: number }) | null>(null);
  const next = useRef(0);
  const show = useCallback((t: ToastRequest) => setToast({ ...t, key: ++next.current }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show, visible: toast !== null }), [show, toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <UndoToast
          key={toast.key}
          text={toast.text}
          undoLabel={strings.calendar.add.undo}
          onUndo={
            toast.onUndo
              ? () => {
                  setToast(null);
                  toast.onUndo?.().catch(() => show({ text: strings.calendar.add.undoFailed }));
                }
              : undefined
          }
        />
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
