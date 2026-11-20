import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, ScrollView, type ScrollViewInstance, type ScrollViewProps } from 'react-native';

/**
 * A row that scrolls sideways (Pill README: filter, suggestion and slot rows), without a scroll bar.
 * Swipes scroll it on a touch screen and a trackpad; on the web a mouse wheel turns into a sideways
 * scroll too while the pointer is over it, until the row reaches its end and the page scrolls again.
 */
export function RowScroll({ children, ...props }: Omit<ScrollViewProps, 'horizontal'> & { children: ReactNode }) {
  const ref = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current?.getScrollableNode() as HTMLElement | undefined;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      // A sideways swipe already scrolls it; only a vertical wheel is turned.
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = node.scrollWidth - node.clientWidth;
      const room = e.deltaY > 0 ? node.scrollLeft < max : node.scrollLeft > 0;
      if (max <= 0 || !room) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} {...props}>
      {children}
    </ScrollView>
  );
}
