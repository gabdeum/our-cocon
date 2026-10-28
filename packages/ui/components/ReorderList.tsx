import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, View, type AccessibilityActionEvent, type KeyDownEvent, type LayoutChangeEvent } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

/**
 * Where a dragged row lands: after every other row whose middle it has passed. `tops` and `heights`
 * are each row's measured place; `dy` is how far the dragged row moved.
 */
export function dropIndex(from: number, dy: number, tops: number[], heights: number[]): number {
  const middle = (tops[from] ?? 0) + (heights[from] ?? 0) / 2 + dy;
  let index = 0;
  for (let i = 0; i < tops.length; i += 1) {
    if (i !== from && (tops[i] ?? 0) + (heights[i] ?? 0) / 2 < middle) index += 1;
  }
  return index;
}

export interface ReorderListProps<T> {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Each row, given its drag handle to place where the design puts it. */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  onMove: (from: number, to: number) => void;
  /** "Drag to reorder" */
  handleLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  /** While a row is dragged, so the screen can stop scrolling. */
  onDragChange?: (dragging: boolean) => void;
  /** Space between rows (spacing scale). */
  gap?: 8 | 10 | 12;
  /** Each row's top within the list, so a screen can scroll to one. */
  onItemLayout?: (key: string, y: number) => void;
}

interface DragState {
  tops: number[];
  heights: number[];
  /** The row being dragged and how far; `dropped` once it was let go (then it shows as no drag). */
  drag: { from: number; dy: number; dropped: boolean } | null;
}

/**
 * Rows reordered by dragging their handle (ReorderList README; spec 015 FR-002). The handle also
 * moves its row with Move up / Move down (screen readers) and the arrow keys (keyboard).
 */
export function ReorderList<T>({ items, keyOf, renderItem, onMove, handleLabel, moveUpLabel, moveDownLabel, onDragChange, gap = 12, onItemLayout }: ReorderListProps<T>) {
  // One state, so the drag handlers (made once per row) always update from the latest values.
  const [state, setState] = useState<DragState>({ tops: [], heights: [], drag: null });
  const count = items.length;

  const responders = useMemo(
    () =>
      Array.from({ length: count }, (_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => setState((s) => ({ ...s, drag: { from: index, dy: 0, dropped: false } })),
          // Read dy now: the gesture state is reset once the handler returns, before React runs the update.
          onPanResponderMove: (_e, g) => {
            const { dy } = g;
            setState((s) => ({ ...s, drag: { from: index, dy, dropped: false } }));
          },
          onPanResponderRelease: (_e, g) => {
            const { dy } = g;
            setState((s) => ({ ...s, drag: { from: index, dy, dropped: true } }));
          },
          onPanResponderTerminate: () => setState((s) => ({ ...s, drag: { from: index, dy: 0, dropped: true } })),
        }),
      ),
    [count],
  );

  const { tops, heights } = state;
  const drag = state.drag && !state.drag.dropped ? state.drag : null;
  const dragging = drag !== null;
  useEffect(() => {
    onDragChange?.(dragging);
  }, [dragging, onDragChange]);

  // Let go: report the move once (the effect can run again with a new onMove).
  const reported = useRef<DragState['drag']>(null);
  useEffect(() => {
    const done = state.drag;
    if (!done?.dropped || reported.current === done) return;
    reported.current = done;
    const to = dropIndex(done.from, done.dy, tops, heights);
    if (to !== done.from) onMove(done.from, to);
  }, [state.drag, tops, heights, onMove]);

  const target = drag ? dropIndex(drag.from, drag.dy, tops, heights) : null;
  const shiftOf = (i: number): number => {
    if (!drag || target === null) return 0;
    if (i === drag.from) return drag.dy;
    const moved = (heights[drag.from] ?? 0) + gap;
    if (drag.from < target && i > drag.from && i <= target) return -moved;
    if (target < drag.from && i >= target && i < drag.from) return moved;
    return 0;
  };

  const move = (from: number, to: number) => {
    if (to >= 0 && to < count && to !== from) onMove(from, to);
  };

  const measure = (index: number, key: string) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    onItemLayout?.(key, y);
    setState((s) => {
      if (s.tops[index] === y && s.heights[index] === height) return s;
      const nextTops = [...s.tops];
      const nextHeights = [...s.heights];
      nextTops[index] = y;
      nextHeights[index] = height;
      return { ...s, tops: nextTops, heights: nextHeights };
    });
  };

  return (
    <View style={{ gap }}>
      {items.map((item, index) => {
        const handle = (
          <View
            role="button"
            aria-label={handleLabel}
            accessible
            focusable
            accessibilityActions={[
              { name: 'moveUp', label: moveUpLabel },
              { name: 'moveDown', label: moveDownLabel },
            ]}
            onAccessibilityAction={(e: AccessibilityActionEvent) => move(index, e.nativeEvent.actionName === 'moveUp' ? index - 1 : index + 1)}
            {...{
              // react-native-web: the arrow keys on the focused handle.
              tabIndex: 0,
              onKeyDown: (e: KeyDownEvent) => {
                const { key } = e.nativeEvent;
                if (key === 'ArrowUp' || key === 'ArrowDown') {
                  e.preventDefault();
                  move(index, key === 'ArrowUp' ? index - 1 : index + 1);
                }
              },
            }}
            className={cn('h-control-md w-[22px] items-center justify-center rounded-md web:cursor-grab', focusRing)}
            {...responders[index]?.panHandlers}
          >
            <Text size={18} weight="900" color="ink-muted" aria-hidden>
              ⋮⋮
            </Text>
          </View>
        );
        const lifted = drag?.from === index;
        return (
          <View key={keyOf(item)} onLayout={measure(index, keyOf(item))} style={{ transform: [{ translateY: shiftOf(index) }], zIndex: lifted ? 1 : 0, opacity: lifted ? 0.92 : 1 }}>
            {renderItem(item, index, handle)}
          </View>
        );
      })}
    </View>
  );
}
