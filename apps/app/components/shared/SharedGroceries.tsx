import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, IconButton, ListGroup, ListRow, ListRowSkeleton, Overline, PublicScreen, Text, TextField } from '@cocon/ui';
import type { AnonymousTracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useToast } from '../../lib/toast';
import { byName, combineRows, groupByAisle, rowAmounts, rowIds, type GroceryItem, type GroceryRow } from '../../lib/groceries';
import { endsText } from '../../lib/grocery-share';
import { sharedItems, sharedPacks, type SharedGroceriesLoad, type SharedWriteResult } from '../../lib/shared-groceries';

const v = strings.sharedGroceries;
const g = strings.groceries;

export interface SharedGroceriesProps {
  /** Undefined while loading; 'failed' when the endpoint couldn't be reached. */
  load: SharedGroceriesLoad | 'failed' | undefined;
  /** Anonymous only (constitution VI): the page's own events. */
  tracker: AnonymousTracker;
  use24h: boolean;
  onRetry: () => void;
  /** "2 onions" as typed; 'empty' when there's nothing to add. */
  onAdd: (text: string) => Promise<SharedWriteResult | 'empty'>;
  onToggle: (ids: string[], checked: boolean) => Promise<SharedWriteResult>;
  onClear: (ids: string[]) => Promise<SharedWriteResult>;
  onRestore: (ids: string[]) => Promise<SharedWriteResult>;
}

/** The public shared grocery list (spec 072 US2–US4; design/ui/OC-SharedGroceries.md). */
export function SharedGroceries({ load, onRetry, ...props }: SharedGroceriesProps) {
  if (load === undefined) {
    return (
      <PublicScreen brand={v.brand} tag={v.tag}>
        <View role="progressbar" aria-label={v.loading} aria-busy className="gap-12">
          <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
          <ListRowSkeleton count={4} />
        </View>
      </PublicScreen>
    );
  }
  if (load === 'failed') {
    return (
      <PublicScreen brand={v.brand} tag={v.tag}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {v.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{v.loadFailedBody}</Text>
        <Button label={v.retry} variant="soft" onPress={onRetry} />
      </PublicScreen>
    );
  }
  if (load.kind === 'not_shared') {
    return (
      <PublicScreen brand={v.brand} tag={v.tag}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {v.stoppedTitle}
        </Text>
        <Text color="ink-muted">{v.stoppedBody}</Text>
      </PublicScreen>
    );
  }
  return <Loaded list={load.list} {...props} />;
}

function Loaded({ list, tracker, use24h, onAdd, onToggle, onClear, onRestore }: Omit<SharedGroceriesProps, 'load' | 'onRetry'> & { list: Extract<SharedGroceriesLoad, { kind: 'shared' }>['list'] }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    tracker.track('shared_groceries_viewed', {});
  }, [tracker]);

  const items = useMemo(() => sharedItems(list), [list]);
  const packs = useMemo(() => sharedPacks(list), [list]);
  const rows = useMemo(() => combineRows(items), [items]);
  const amounts = useMemo(() => rowAmounts(rows, packs, { ...list.settings, keep_awake: true, has_scale: true, has_thermometer: true }), [rows, packs, list.settings]);
  const titleOf = (row: GroceryRow) => amounts.get(row.id)?.name ?? (row.items[0] as GroceryItem).name;
  const aisles = groupByAisle(rows).map((a) => ({ aisle: a.aisle, rows: byName(a.items, titleOf) }));
  const edit = list.can_edit;
  const ends = endsText(list.expires_at, { endsToday: v.endsToday, endsOn: v.endsOn }, use24h);

  /** Each refusal says why; "no longer shared" shows on the refetch that follows. */
  const failed = (result: SharedWriteResult) => {
    if (result === 'ok' || result === 'not_shared') return false;
    toast.show({ text: result === 'read_only' ? v.readOnly : result === 'too_many' ? v.tooMany : g.syncFailed, tone: 'warn' });
    return true;
  };

  const add = async () => {
    if (!text.trim() || adding) return;
    setAdding(true);
    try {
      const result = await onAdd(text);
      if (result === 'empty' || failed(result) || result !== 'ok') return;
      tracker.track('shared_grocery_added', {});
      setText('');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (row: GroceryRow) => {
    const checked = !row.checked;
    const result = await onToggle(rowIds([row]), checked);
    if (!failed(result) && result === 'ok' && checked) tracker.track('shared_grocery_ticked', {});
  };

  const remove = async (row: GroceryRow) => {
    const ids = rowIds([row]);
    const result = await onClear(ids);
    if (failed(result) || result !== 'ok') return;
    tracker.track('shared_grocery_removed', {});
    toast.show({
      text: g.removed(titleOf(row)),
      onUndo: async () => {
        if ((await onRestore(ids)) !== 'ok') throw new Error('restore failed');
      },
      undoFailed: g.syncFailed,
    });
  };

  return (
    <PublicScreen brand={v.brand} tag={edit ? v.tag : v.viewOnly}>
      <View className="gap-4">
        <Text variant="titleLg" role="heading" aria-level={1}>
          {v.title}
        </Text>
        <Text color="ink-muted">{v.sub(list.family_name, ends)}</Text>
      </View>

      {edit ? (
        <View className="flex-row gap-8">
          <TextField
            label={g.addLabel}
            labelHidden
            placeholder={g.addPlaceholder}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void add()}
            submitBehavior="submit"
            maxLength={200}
            className="min-w-0 flex-1"
          />
          <IconButton icon="plus" label={g.addButton} variant="olive-square" onPress={() => void add()} disabled={adding || !text.trim()} />
        </View>
      ) : null}

      {rows.length === 0 ? (
        <View className="gap-8">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {v.emptyTitle}
          </Text>
          {edit ? <Text color="ink-muted">{v.emptyBody}</Text> : null}
        </View>
      ) : null}

      {aisles.map(({ aisle, rows: aisleRows }) => (
        <View key={aisle} className="gap-6">
          <Overline className="mt-4">{strings.aisles[aisle]}</Overline>
          <ListGroup>
            {aisleRows.map((row, i) => {
              const { detail, note } = amounts.get(row.id) ?? {};
              const title = titleOf(row);
              const menu = edit ? () => void remove(row) : undefined;
              return (
                <ListRow
                  key={row.id}
                  title={title}
                  titleDetail={detail ? { text: detail, note } : undefined}
                  done={row.checked}
                  leading={{ kind: 'checkbox', checked: row.checked }}
                  action={edit ? { icon: 'close', accessibilityLabel: v.removeItem(title), onPress: () => void remove(row) } : undefined}
                  onPress={edit ? () => void toggle(row) : undefined}
                  disabled={!edit}
                  onLongPress={menu}
                  onSwipeLeft={menu}
                  actions={edit ? [{ name: 'remove', label: g.remove, onAction: () => void remove(row) }] : undefined}
                  last={i === aisleRows.length - 1}
                />
              );
            })}
          </ListGroup>
        </View>
      ))}

      <Card tone="ink" className="mt-4">
        <Text size={18} weight="900" color="on-olive">
          {v.promoTitle}
        </Text>
        <Text size={15} weight="600" color="on-ink">
          {v.promoBody}
        </Text>
      </Card>
    </PublicScreen>
  );
}
