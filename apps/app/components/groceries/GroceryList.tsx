import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  BottomSheet,
  Button,
  Callout,
  Card,
  Dialog,
  IconButton,
  ListGroup,
  ListRow,
  Overline,
  Presence,
  StatusBanner,
  TabHeader,
  TabScreen,
  Text,
  TextField,
  Thumb,
} from '@cocon/ui';
import type { Aisle, FamilySettings, FamilySettingsUpdate, Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import {
  byName,
  combineRows,
  groupByAisle,
  recipeCards,
  rowAmounts,
  rowIds,
  rowItem,
  rowSource,
  shopper,
  toBuyCount,
  recipeItems,
  type AddResult,
  type GroceryItem,
  type GroceryRow,
  type GroceryServings,
  type PackData,
  type RecipeCard,
} from '../../lib/groceries';
import { useOnline } from '../../lib/online';
import type { Member } from '../../lib/session';
import { OfflineBanner } from '../sync/OfflineBanner';
import { GrocerySettings } from '../settings/GrocerySettings';
import { GroceryActions, type ActionView } from './GroceryActions';
import { RecipeCardSheet } from './RecipeCardSheet';

const g = strings.groceries;

/** What an Undo brings back: ticked items cleared, the whole list, one removed row, or a recipe's items. */
type Banner = { message: string; tone: 'sage' | 'warn'; undo?: { ids: string[]; count: number; kind: 'done' | 'all' | 'removed' | 'recipe' } };

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
  /** The servings each recipe is on the list for (spec 022); the recipe's own until loaded. */
  servings?: GroceryServings;
  /** A recipe card's menu: rescale its items still to buy from `from` to `to` servings. */
  onSetServings: (recipeId: string, from: number, to: number) => Promise<boolean>;
  /** Spec 021: where the family shops and whether rows round up to store sizes. */
  settings: FamilySettings;
  /** Packs per catalog entry on the list (lib/groceries.ts › loadPacks); undefined while loading. */
  packs: Record<string, PackData> | undefined;
  /** The grocery settings sheet's changes (where you shop, round up), for the whole family. */
  onChangeSettings: (change: FamilySettingsUpdate) => Promise<'saved' | 'failed'>;
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
 * Spec 021: each row says what to buy where the family shops, beside its name ("Heavy cream:
 * 2 × 20 cl (need 300 ml)"); the settings button beside "Add item" opens where you shop and round up.
 * Spec 022: one row per thing, whoever added it (combineRows), in alphabetical order in each aisle;
 * ticking, Edit and Remove act on all of it.
 */
export function GroceryList(props: GroceryListProps) {
  const { items, failed, onRetry, me, members, tracker, photoUrls, settings, packs } = props;
  const online = useOnline();
  const now = useClock(props.now);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  // `rest`: the row's other items when the menu opened, so an Edit clears only what was seen.
  const [menu, setMenu] = useState<{ id: string; view: ActionView; rest: string[] } | null>(null);
  // Only a row that adds up to one amount is edited as a whole; otherwise Edit changes the first item.
  const openRow = (row: GroceryRow, view: ActionView) =>
    setMenu({ id: row.id, view, rest: rowItem(row, packs) === row.items[0] ? [] : row.items.slice(1).map((i) => i.id) });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const list = useMemo(() => items ?? [], [items]);
  const rows = useMemo(() => combineRows(list), [list]);
  const cards = useMemo(() => recipeCards(list, props.servings), [list, props.servings]);
  const menuCard = cardMenu ? (cards.find((c) => c.id === cardMenu) ?? null) : null;
  const amounts = useMemo(() => rowAmounts(rows, packs, settings), [rows, packs, settings]);
  const titleOf = (row: GroceryRow) => amounts.get(row.id)?.name ?? (row.items[0] as GroceryItem).name;
  const aisles = groupByAisle(rows).map((a) => ({ aisle: a.aisle, rows: byName(a.items, titleOf) }));
  const done = rows.filter((r) => r.checked);
  const shopping = shopper(list, me, members, now);
  const menuRow = menu ? (rows.find((r) => r.id === menu.id) ?? null) : null;
  const menuItem = menuRow ? rowItem(menuRow, packs) : null;

  const header = (
    <TabHeader
      title={g.title}
      sub={items ? g.toBuy(toBuyCount(rows)) : undefined}
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

  const toggle = async (row: GroceryRow) => {
    const checked = !row.checked;
    const results = await Promise.all(row.items.map((item) => props.onToggle(item, checked)));
    if (results.includes('failed')) setBanner({ message: g.syncFailed, tone: 'warn' });
    else if (checked) tracker.track('grocery_item_ticked', {});
  };

  /** `count` is the rows the person saw go, for the banner and events. */
  const clear = async (ids: string[], count: number, message: string, kind: NonNullable<Banner['undo']>['kind']) => {
    setMenu(null);
    if (await props.onClear(ids)) {
      if (kind === 'done') tracker.track('done_items_cleared', { count });
      if (kind === 'all') tracker.track('all_items_cleared', { count });
      if (kind === 'recipe') tracker.track('grocery_recipe_removed', { item_count: Math.min(count, 500) });
      setBanner({ message, tone: 'sage', undo: { ids, count, kind } });
    } else setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const undo = async (u: NonNullable<Banner['undo']>) => {
    if (await props.onRestore(u.ids)) {
      if (u.kind === 'done') tracker.track('clear_done_undone', { count: u.count });
      setBanner(null);
    } else setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const move = async (item: GroceryItem, aisle: Aisle) => {
    setMenu(null);
    if (await props.onMove(item, aisle)) tracker.track('catalog_override_saved', { field: 'aisle' });
    else setBanner({ message: g.syncFailed, tone: 'warn' });
  };

  const savePacks = async (item: GroceryItem, value: string | null) => {
    const result = await props.onSavePacks(item, value);
    if (result === 'invalid') return result;
    setMenu(null);
    if (result === 'failed') setBanner({ message: g.syncFailed, tone: 'warn' });
    // A correction saved; putting the usual sizes back isn't one.
    else if (value !== null) tracker.track('catalog_override_saved', { field: 'packs' });
    return result;
  };

  const itemPacks = (item: GroceryItem | null) => {
    const data = item?.catalog_key ? packs?.[item.catalog_key] : undefined;
    if (!data) return null;
    return { label: data.packs[settings.store_profile][0]?.label ?? null, corrected: data.corrected === null ? null : { text: data.corrected } };
  };

  /** A row of several items becomes the one it was edited into: the first; the others are cleared. */
  const edit = async (item: GroceryItem, value: string) => {
    const result = await props.onEdit(item, value);
    if (result === 'empty') return false;
    setMenu(null);
    const rest = menu?.rest ?? [];
    const merged = result === 'saved' && (rest.length === 0 || (await props.onClear(rest)));
    if (!merged) setBanner({ message: g.syncFailed, tone: 'warn' });
    return true;
  };

  const remove = (row: GroceryRow) => void clear(rowIds([row]), 1, g.removed(titleOf(row)), 'removed');

  // A recipe card's menu (spec 022).
  const removeRecipe = (card: RecipeCard) => {
    setCardMenu(null);
    const ids = recipeItems(list, card.id).map((i) => i.id);
    void clear(ids, ids.length, g.removedRecipe(ids.length, card.name), 'recipe');
  };
  const saveServings = async (card: RecipeCard, to: number) => {
    const from = card.serves;
    if (await props.onSetServings(card.id, from, to)) {
      tracker.track('grocery_recipe_servings_changed', { from: Math.min(from, 50), to });
      setCardMenu(null);
      return true;
    }
    setCardMenu(null);
    setBanner({ message: g.syncFailed, tone: 'warn' });
    return false;
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

  const menuActions = (row: GroceryRow) => [
    { name: 'edit', label: g.edit, onAction: () => openRow(row, 'menu') },
    { name: 'move', label: g.moveTo, onAction: () => openRow(row, 'move') },
    { name: 'remove', label: g.remove, onAction: () => remove(row) },
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
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void add()}
          submitBehavior="submit"
          editable={online}
          maxLength={200}
          className="min-w-0 flex-1"
        />
        <IconButton icon="plus" label={g.addButton} variant="olive-square" onPress={() => void add()} disabled={!online || adding || !text.trim()} />
        <IconButton icon="settings" label={g.settingsButton} variant="soft-square" onPress={() => setSettingsOpen(true)} />
      </View>
      {statusBanner}

      {cards.map((card) => (
        <Card key={card.id} tone="soft" className="flex-row items-center gap-8 py-10 pl-12 pr-4">
          <Thumb uri={card.photo_path ? photoUrls[card.photo_path] : undefined} label={card.name} />
          <View className="min-w-0 flex-1">
            <Text size={15} weight="800">
              {g.forRecipe(card.name)}
            </Text>
            <Text variant="caption" color="ink-muted">
              {g.recipeMeta(card.count, card.serves)}
            </Text>
          </View>
          <IconButton icon="more-vertical" label={g.recipeOptions(card.name)} variant="soft" onPress={() => setCardMenu(card.id)} />
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

      {aisles.map(({ aisle, rows: aisleRows }) => (
        <View key={aisle} className="gap-6">
          <Overline className="mt-4">{strings.aisles[aisle]}</Overline>
          <ListGroup>
            {aisleRows.map((row, i) => {
              const { detail, note } = amounts.get(row.id) ?? {};
              const title = titleOf(row);
              const openMenu = online ? () => openRow(row, 'menu') : undefined;
              return (
                <ListRow
                  key={row.id}
                  title={title}
                  titleDetail={detail ? { text: detail, note } : undefined}
                  sub={rowSource(row, members)}
                  done={row.checked}
                  leading={{ kind: 'checkbox', checked: row.checked }}
                  action={{ icon: 'more-vertical', accessibilityLabel: g.editItem(title), onPress: () => openRow(row, 'menu'), disabled: !online }}
                  onPress={() => void toggle(row)}
                  disabled={!online}
                  onLongPress={openMenu}
                  onSwipeLeft={openMenu}
                  actions={online ? menuActions(row) : undefined}
                  last={i === aisleRows.length - 1}
                />
              );
            })}
          </ListGroup>
        </View>
      ))}

      {list.length > 0 ? (
        <View className="flex-row flex-wrap gap-8">
          {done.length > 0 ? (
            <Button
              label={g.clearDone}
              variant="soft"
              disabled={!online}
              className="flex-1"
              onPress={() => void clear(rowIds(done), done.length, g.cleared(done.length), 'done')}
            />
          ) : null}
          <Button label={g.clearAll} variant="outline" disabled={!online} className="flex-1" onPress={() => setConfirmClearAll(true)} />
        </View>
      ) : null}

      <GroceryActions
        item={menuItem}
        packs={itemPacks(menuItem)}
        onSavePacks={savePacks}
        view={menu?.view ?? 'menu'}
        onView={(view) => setMenu((m) => (m ? { ...m, view } : m))}
        onClose={() => setMenu(null)}
        onRemove={() => (menuRow ? remove(menuRow) : undefined)}
        onMove={(item, aisle) => void move(item, aisle)}
        onEdit={edit}
        units={settings.units}
      />

      {menuCard ? (
        <RecipeCardSheet
          key={menuCard.id}
          card={menuCard}
          online={online}
          onOpen={() => {
            setCardMenu(null);
            props.onOpenRecipe(menuCard.id);
          }}
          onSaveServings={(to) => saveServings(menuCard, to)}
          onRemove={() => removeRecipe(menuCard)}
          onClose={() => setCardMenu(null)}
        />
      ) : null}

      {/* Mounted only while open, like the row's sheets: on the web a closed Modal can linger,
          invisible, over the list and swallow every tap until its fade-out reports it ended. */}
      {settingsOpen ? (
        <BottomSheet visible onClose={() => setSettingsOpen(false)} title={g.settingsTitle} closeLabel={g.close}>
          <GrocerySettings settings={settings} onChange={props.onChangeSettings} readOnly={!online} />
        </BottomSheet>
      ) : null}

      {confirmClearAll ? (
        <Dialog
          visible
          icon="warning"
          title={g.clearAllTitle(rows.length)}
          body={g.clearAllBody}
          confirmLabel={g.clearAllConfirm}
          cancelLabel={g.clearAllCancel}
          onCancel={() => setConfirmClearAll(false)}
          onConfirm={() => {
            setConfirmClearAll(false);
            void clear(rowIds(rows), rows.length, g.cleared(rows.length), 'all');
          }}
        />
      ) : null}
    </TabScreen>
  );
}
