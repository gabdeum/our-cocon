import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Callout,
  Card,
  IconButton,
  ListGroup,
  ListRow,
  Overline,
  Link,
  Presence,
  SegmentedControl,
  StatusBanner,
  TabHeader,
  TabScreen,
  Text,
  TextField,
  Thumb,
} from '@cocon/ui';
import type { Aisle, FamilySettings, StoreProfile, Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { groupByAisle, recipeCards, rowAmounts, shopper, sourceLine, toBuyCount, type AddResult, type GroceryItem, type PackData } from '../../lib/groceries';
import { useOnline } from '../../lib/online';
import type { Member } from '../../lib/session';
import { OfflineBanner } from '../sync/OfflineBanner';
import { GroceryActions, type ActionView } from './GroceryActions';

const g = strings.groceries;

type Banner = { message: string; tone: 'sage' | 'warn'; undo?: { ids: string[]; cleared: boolean } };

export interface GroceryListProps {
  /** Undefined while loading (lib/groceries.ts › loadGroceryList). */
  items: GroceryItem[] | undefined;
  failed?: boolean;
  onRetry: () => void;
  me: string;
  members: readonly Pick<Member, 'user_id' | 'display_name'>[];
  tracker: Tracker;
  photoUrls: Record<string, string>;
  onAdd: (text: string) => Promise<AddResult>;
  onToggle: (item: GroceryItem, checked: boolean) => Promise<'saved' | 'failed'>;
  onClear: (ids: string[]) => Promise<boolean>;
  onRestore: (ids: string[]) => Promise<boolean>;
  onEdit: (item: GroceryItem, text: string) => Promise<'saved' | 'empty' | 'failed'>;
  onMove: (item: GroceryItem, aisle: Aisle) => Promise<boolean>;
  onOpenRecipe: (id: string) => void;
  /** Spec 021: where the family shops and whether rows round up to store sizes. */
  settings: FamilySettings;
  /** Packs per catalog entry on the list (lib/groceries.ts › loadPacks); undefined while loading. */
  packs: Record<string, PackData> | undefined;
  onStoreProfile: (profile: StoreProfile) => Promise<'saved' | 'failed'>;
  onOpenSettings: () => void;
  onSavePacks: (item: GroceryItem, text: string | null) => Promise<'saved' | 'invalid' | 'failed'>;
  /** For tests; otherwise the clock, read again every 30 s so "is shopping" goes away. */
  now?: number;
}

/** Re-renders every 30 s, so presence ends 10 minutes after the last tick without a change. */
function useClock(fixed: number | undefined): number {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [fixed]);
  return fixed ?? now;
}

/**
 * /groceries (spec 020, OC-Groceries): the family's one list, by aisle, live. Typing "2 lemons"
 * adds or merges; ticking is optimistic and reverts on failure; ticked items stay struck through
 * until "Clear done items" (decision 28). Long-press or swipe a row for Edit, Move to… and Remove.
 * Spec 021: each row says what to buy where the family shops ("Buy 2 × 20 cl" over "Need 300 ml ·
 * 100 ml left over"); the store row switches the family between US and European stores.
 */
export function GroceryList(props: GroceryListProps) {
  const { items, failed, onRetry, me, members, tracker, photoUrls, settings, packs } = props;
  const online = useOnline();
  const now = useClock(props.now);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [menu, setMenu] = useState<{ id: string; view: ActionView } | null>(null);

  const list = useMemo(() => items ?? [], [items]);
  const aisles = useMemo(() => groupByAisle(list), [list]);
  const cards = useMemo(() => recipeCards(list), [list]);
  const amounts = useMemo(() => rowAmounts(list, packs, settings), [list, packs, settings]);
  const done = list.filter((i) => i.checked);
  const shopping = shopper(list, me, members, now);
  const menuItem = menu ? (list.find((i) => i.id === menu.id) ?? null) : null;

  const header = (
    <TabHeader
      title={g.title}
      sub={items ? g.toBuy(toBuyCount(list)) : undefined}
      action={
        shopping ? (
          <View>
            <Presence label={g.shopping(shopping)} />
          </View>
        ) : undefined
      }
    />
  );

  const add = async () => {
    if (!text.trim() || adding) return;
    setAdding(true);
    try {
      const result = await props.onAdd(text);
      if (result.status === 'empty') return;
      if (result.status === 'failed') {
        setBanner({ message: g.addFailed, tone: 'warn' });
        return;
      }
      tracker.track('grocery_item_added', { from: 'app' });
      setText('');
      if (result.status === 'merged') setBanner({ message: result.total ? g.merged(result.total) : g.mergedNoAmount, tone: 'sage' });
      else {
        setBanner(null);
        if (result.unmatched) tracker.track('ingredient_unmatched', {});
      }
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (item: GroceryItem) => {
    const checked = !item.checked;
    const result = await props.onToggle(item, checked);
    if (result === 'failed') setBanner({ message: g.syncFailed, tone: 'warn' });
    else if (checked) tracker.track('grocery_item_ticked', {});
  };

  const clear = async (ids: string[], message: string, cleared: boolean) => {
    setMenu(null);
    if (await props.onClear(ids)) {
      if (cleared) tracker.track('done_items_cleared', { count: ids.length });
      setBanner({ message, tone: 'sage', undo: { ids, cleared } });
    } else setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const undo = async (u: NonNullable<Banner['undo']>) => {
    if (await props.onRestore(u.ids)) {
      if (u.cleared) tracker.track('clear_done_undone', { count: u.ids.length });
      setBanner(null);
    } else setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const move = async (item: GroceryItem, aisle: Aisle) => {
    setMenu(null);
    if (await props.onMove(item, aisle)) tracker.track('catalog_override_saved', { field: 'aisle' });
    else setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const storeProfile = async (profile: StoreProfile) => {
    if (profile === settings.store_profile) return;
    if ((await props.onStoreProfile(profile)) === 'failed') setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const savePacks = async (item: GroceryItem, value: string | null) => {
    const result = await props.onSavePacks(item, value);
    if (result === 'invalid') return result;
    setMenu(null);
    if (result === 'failed') setBanner({ message: g.syncFailed, tone: 'warn' });
    else tracker.track('catalog_override_saved', { field: 'packs' });
    return result;
  };

  const itemPacks = (item: GroceryItem | null) => {
    const data = item?.catalog_key ? packs?.[item.catalog_key] : undefined;
    if (!data) return null;
    return { label: data.packs[settings.store_profile][0]?.label ?? null, corrected: data.corrected === null ? null : { text: data.corrected } };
  };

  const edit = async (item: GroceryItem, value: string) => {
    const result = await props.onEdit(item, value);
    if (result === 'empty') return false;
    setMenu(null);
    if (result === 'failed') setBanner({ message: g.syncFailed, tone: 'warn' });
    return true;
  };

  const statusBanner = banner ? (
    <StatusBanner
      message={banner.message}
      tone={banner.tone}
      actionLabel={banner.undo ? g.undo : undefined}
      onAction={banner.undo ? () => void undo(banner.undo as NonNullable<Banner['undo']>) : undefined}
    />
  ) : null;

  if (items === undefined) {
    return (
      <TabScreen>
        {header}
        <OfflineBanner screen="groceries" tracker={tracker} />
        {failed ? (
          <View className="gap-12">
            <Callout variant="warn" text={g.loadFailed} />
            <Button label={g.retry} variant="soft" size="sm" onPress={onRetry} />
          </View>
        ) : (
          <View role="progressbar" aria-label={g.loading} aria-busy />
        )}
      </TabScreen>
    );
  }

  const menuActions = (item: GroceryItem) => [
    { name: 'edit', label: g.edit, onAction: () => setMenu({ id: item.id, view: 'menu' }) },
    { name: 'move', label: g.moveTo, onAction: () => setMenu({ id: item.id, view: 'move' }) },
    { name: 'remove', label: g.remove, onAction: () => void clear([item.id], g.removed(item.name), false) },
  ];

  return (
    <TabScreen>
      {header}
      <OfflineBanner screen="groceries" tracker={tracker} />
      <View className="flex-row gap-8">
        <TextField
          label={g.addLabel}
          labelHidden
          placeholder={g.addPlaceholder}
          hint={g.addHint}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void add()}
          submitBehavior="submit"
          editable={online}
          maxLength={200}
          className="min-w-0 flex-1"
        />
        <IconButton icon="plus" label={g.addButton} variant="olive-square" onPress={() => void add()} disabled={!online || adding || !text.trim()} />
      </View>
      {statusBanner}

      {settings.round_to_packs ? (
        <View className="flex-row flex-wrap items-center gap-10">
          <Text size={14} weight="700" color="ink-muted">
            {g.storeSizes}
          </Text>
          <SegmentedControl<StoreProfile>
            label={g.storeSizes}
            variant="pill"
            segments={[
              { key: 'us', label: g.storeUs },
              { key: 'eu', label: g.storeEu },
            ]}
            value={settings.store_profile}
            onChange={(profile) => void storeProfile(profile)}
            disabled={!online}
          />
          <Link label={g.setInSettings} size={13} onPress={props.onOpenSettings} />
        </View>
      ) : null}

      {cards.map((card) => (
        <Card key={card.id} tone="soft" onPress={() => props.onOpenRecipe(card.id)} accessibilityLabel={g.openRecipe(card.name)} className="flex-row items-center gap-8 px-12 py-10">
          <Thumb uri={card.photo_path ? photoUrls[card.photo_path] : undefined} label={card.name} />
          <View className="min-w-0 flex-1">
            <Text size={15} weight="800">
              {g.forRecipe(card.name)}
            </Text>
            <Text variant="caption" color="ink-muted">
              {g.recipeMeta(card.count, card.serves)}
            </Text>
          </View>
          <Text size={14} weight="800" color="olive" className="px-4 py-8">
            {g.open}
          </Text>
        </Card>
      ))}

      {list.length === 0 ? (
        <View className="gap-8">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {g.emptyTitle}
          </Text>
          <Text color="ink-muted">{g.emptyBody}</Text>
        </View>
      ) : null}

      {aisles.map(({ aisle, items: rows }) => (
        <View key={aisle} className="gap-6">
          <Overline className="mt-4">{strings.aisles[aisle]}</Overline>
          <ListGroup>
            {rows.map((item, i) => {
              const { buy, need } = amounts.get(item.id) ?? {};
              const openMenu = online ? () => setMenu({ id: item.id, view: 'menu' }) : undefined;
              return (
                <ListRow
                  key={item.id}
                  title={item.name}
                  sub={sourceLine(item, members)}
                  done={item.checked}
                  leading={{ kind: 'checkbox', checked: item.checked }}
                  trailing={need ? { kind: 'buy', buy, need } : undefined}
                  onPress={() => void toggle(item)}
                  disabled={!online}
                  onLongPress={openMenu}
                  onSwipeLeft={openMenu}
                  actions={online ? menuActions(item) : undefined}
                  last={i === rows.length - 1}
                />
              );
            })}
          </ListGroup>
        </View>
      ))}

      {done.length > 0 ? (
        <Button
          label={g.clearDone}
          variant="soft"
          disabled={!online}
          onPress={() =>
            void clear(
              done.map((i) => i.id),
              g.cleared(done.length),
              true,
            )
          }
        />
      ) : null}

      {list.length > 0 && settings.round_to_packs ? (
        <Text size={14} weight="600" color="ink-muted" className="text-center">
          <Text size={14} weight="900" color="ink-muted">
            {g.footnoteBuy}
          </Text>
          {g.footnoteBuyRest}
          <Text size={14} weight="900" color="ink-muted">
            {g.footnoteNeed}
          </Text>
          {g.footnoteNeedRest}
        </Text>
      ) : null}

      <GroceryActions
        item={menuItem}
        packs={itemPacks(menuItem)}
        onSavePacks={savePacks}
        view={menu?.view ?? 'menu'}
        onView={(view) => setMenu((m) => (m ? { ...m, view } : m))}
        onClose={() => setMenu(null)}
        onRemove={(item) => void clear([item.id], g.removed(item.name), false)}
        onMove={(item, aisle) => void move(item, aisle)}
        onEdit={edit}
      />
    </TabScreen>
  );
}
