import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { IconButton } from './IconButton';
import { StatusBanner } from './StatusBanner';
import { Text } from './Text';

export interface ToastProps {
  text: string;
  /** "Got it". */
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/**
 * Toast README › Hint: a sage card with one line of help and a white "Got it" button, floating
 * over the screen (the month view's first-visit hint, spec 037). Confirmations are `useToast()`.
 */
export function Toast({ text, actionLabel, onAction, className }: ToastProps) {
  return (
    <View role="status" className={cn('flex-row items-center gap-10 rounded-[20px] bg-sage px-14 py-12', className)} style={{ boxShadow: theme.shadow.lift }}>
      <Text size={14} weight="800" className="flex-1" style={{ lineHeight: 14 * 1.35 }}>
        {text}
      </Text>
      <Pressable role="button" onPress={onAction} className={cn('h-control-md flex-none items-center justify-center rounded-pill bg-surface-card px-14 active:bg-surface-card-pressed', focusRing)}>
        <Text size={15} weight="900">
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export interface ToastRequest {
  /** "Leek & bacon quiche removed." */
  text: string;
  /** `warn` when something failed. */
  tone?: 'sage' | 'warn';
  /** "Undo", "Open timers". The toast closes as soon as it's tapped. */
  actionLabel?: string;
  onAction?: () => void;
}

/** Toast README › Timing: 5 s, or 8 s with a button to give time to reach it. */
export const TOAST_MS = 5000;
export const TOAST_ACTION_MS = 8000;

interface ToastApi {
  /** Replaces the toast that's showing: never two at once. */
  show: (toast: ToastRequest) => void;
  hide: () => void;
}

interface HostApi {
  toast: (ToastRequest & { key: number }) | null;
  hide: () => void;
  /** The newest host draws the toast: the one on the sheet or modal that's on top. */
  register: (id: string, base: boolean) => () => void;
  top: string | null;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined, hide: () => undefined });
const HostContext = createContext<HostApi | null>(null);

/**
 * The one toast (Toast README): a sage card (warn when something failed) floating just below the
 * status bar, over any screen, that goes by itself. Wrap the app once; BottomSheet, Dialog,
 * FormScreen and CookLayout carry a ToastHost so it also shows over a modal.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<HostApi['toast']>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const next = useRef(0);
  const show = useCallback((t: ToastRequest) => setToast({ ...t, key: ++next.current }), []);
  const hide = useCallback(() => setToast(null), []);
  const register = useCallback((id: string, base: boolean) => {
    setHosts((h) => (base ? [id, ...h] : [...h, id]));
    return () => setHosts((h) => h.filter((x) => x !== id));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.onAction ? TOAST_ACTION_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show, hide }), [show, hide]);
  const host = useMemo(() => ({ toast, hide, register, top: hosts.at(-1) ?? null }), [toast, hide, register, hosts]);
  return (
    <ToastContext.Provider value={api}>
      <HostContext.Provider value={host}>
        {children}
        <ToastHost base />
      </HostContext.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Where the toast draws: fills its parent, so place it last in a full-screen view. */
export function ToastHost({ base = false }: { base?: boolean }) {
  const ctx = useContext(HostContext);
  const id = useId();
  // No SafeAreaProvider (a test, the gallery): no notch.
  const insets = useContext(SafeAreaInsetsContext);
  const register = ctx?.register;
  useEffect(() => register?.(id, base), [register, id, base]);
  const toast = ctx?.toast;
  if (!ctx || !toast || ctx.top !== id) return null;
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 top-12 z-50 items-center px-16" style={{ marginTop: insets?.top ?? 0 }}>
      <View className="w-full rounded-[18px]" style={{ maxWidth: theme.layout.maxWidth - 32, boxShadow: theme.shadow.lift }}>
        <StatusBanner
          key={toast.key}
          message={toast.text}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={
            toast.onAction
              ? () => {
                  ctx.hide();
                  toast.onAction?.();
                }
              : undefined
          }
        />
      </View>
    </View>
  );
}

export interface FloatingAddProps {
  /** "Add event". */
  label: string;
  onPress: () => void;
  /** A hint card to its left (the month's first-visit hint). */
  hint?: ToastProps | null;
}

/**
 * The calendar's floating olive add button, 20 from the right and 112 from the bottom (above the
 * tab bar), with an optional hint card to its left (OC-CalMonth). Place it last in a full-height screen.
 */
export function FloatingAdd({ label, onPress, hint }: FloatingAddProps) {
  return (
    <>
      {hint ? <Toast {...hint} className="absolute bottom-[112px] left-16 right-[92px] z-20" /> : null}
      <IconButton variant="fab" icon="plus" iconSize={28} label={label} onPress={onPress} className="absolute bottom-[112px] right-20 z-20" />
    </>
  );
}
