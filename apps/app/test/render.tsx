// Testing Library's render with the app's toast around it: failures are toasts (spec 053 FR-015),
// so a screen's tests read them where the person sees them.
import type { ReactElement, ReactNode } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { ToastProvider } from '@cocon/ui';

export function render(ui: ReactElement, options: RenderOptions = {}) {
  const Inner = options.wrapper;
  const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{Inner ? <Inner>{children}</Inner> : children}</ToastProvider>;
  return rtlRender(ui, { ...options, wrapper });
}
