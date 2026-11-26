import { useEffect, useMemo, useRef, useState } from 'react';
import { View, type HostInstance } from 'react-native';
import {
  BottomSheet,
  Button,
  Dialog,
  GroceryRecipeCard,
  IconButton,
  ListGroup,
  ListRowSkeleton,
  ListRow,
  Overline,
  Presence,
  TabHeader,
  TabScreen,
  Text,
  TextField,
  theme,
  useLayoutTier,
  useSheetPresentation,
  type SheetPresentation,
} from '@cocon/ui';
import type { Aisle, FamilySettings, FamilySettingsUpdate, Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import {
  aisleColumns,
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
  type AisleSplit,
  type GroceryItem,
  type GroceryRow,
  type GroceryServings,
  type PackData,
  type RecipeCard,
} from '../../lib/groceries';
import { useOnline } from '../../lib/online';
import type { Member } from '../../lib/session';
import type { PendingGroceryAdd } from '../../lib/pending-grocery-adds';
import { OfflineBanner } from '../sync/OfflineBanner';
import { useFailureToast, useToast } from '../../lib/toast';
import { GrocerySettings } from '../settings/GrocerySettings';
import { GroceryActions, type ActionView } from './GroceryActions';
import { RecipeCardSheet } from './RecipeCardSheet';

const g = strings.groceries;

/** What an Undo brings back: ticked items cleared, the whole list, one removed row, or a recipe's items. */
type Cleared = { ids: string[]; count: number; kind: 'done' | 'all' | 'removed' | 'recipe' };

export interface GroceryListProps {
  /** Undefined while loading (lib/groceries.ts › loadGroceryList). */
  items: GroceryItem[] | undefined;
  failed?: boolean;
  onRetry: () => void;
  me: string;
  members: readonly Pick<Member, 'user_id' | 'display_name'>[];
  tracker: Tracker;
  photoUrls: Record<string, string>;
  /** Recipes whose items are on their way (Add to groceries, spec 022): a card and skeleton rows at the top. */
  pending?: readonly PendingGroceryAdd[];
  onAdd: (text: string) => Promise<AddResult>;
  onToggle: (item: GroceryItem, checked: boolean) => Promise<'saved' | 'failed'>;
  onClear: (ids: string[]) => Promise<boolean>;
  onRestore: (ids: string[]) => Promise<boolean>;
  onEdit: (item: GroceryItem, text: string) => Promise<'saved' | 'empty' | 'failed'>;
  onMove: (item: GroceryItem, aisle: Aisle) => Promise<boolean>;
  /** Opens the recipe at the servings it's on the list for (spec 052 FR-006). */
  onOpenRecipe: (id: string, servings: number) => void;
  /** The servings each recipe is on the list for (spec 022); the recipe's own until loaded. */
  servings?: GroceryServings;
  /** A recipe card's menu: rescale its items still to buy from `from` to `to` servings. */
  onSetServings: (recipeId: string, from: number, to: number) => Promise<boolean>;
  /** Spec 021: where the family shops and whether rows round up to store sizes. */
  settings: FamilySettings;
  /** Packs per catalog entry on the list (lib/groceries.ts › loadPacks); undefined while loading. */
  packs: Record<string, PackData> | undefined;
  /** The grocery settings sheet's changes (where you shop, round up), for the whole family. */
  onChangeSettings: (change: FamilySettingsUpdate, presentation?: SheetPresentation) => Promise<'saved' | 'failed'>;
  onSavePacks: (item: GroceryItem, text: string | null) => Promise<'saved' | 'invalid' | 'failed'>;
  /** Spec 072: opens Share the grocery list. */
  onShare?: () => void;
  /** For tests; otherwise the clock, read again every 30 s so "is shopping" goes away. */
  now?: number;
}

/** Two by two, for the recipe cards' grid from 600 (spec 069). */
function pairs<T>(list: readonly T[]): [T, ...T[]][] {
  const out: [T, ...T[]][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2) as [T, ...T[]]);
  return out;
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
 * 2 × 20 cl (need 300 ml)"); the settings button beside the title opens where you shop and round up.
 * Spec 022: one row per thing, whoever added it (combineRows), in alphabetical order in each aisle;
 * ticking, Edit and Remove act on all of it.
 */
export function GroceryList(props: GroceryListProps) {
  const { items, failed, onRetry, me, members, tracker, photoUrls, settings, packs, pending = [] } = props;
  const online = useOnline();
  useFailureToast(items === undefined && failed && g.loadFailed, onRetry);
  const now = useClock(props.now);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  // `rest`: the row's other items when the menu opened, so an Edit clears only what was seen.
  // `anchored`: opened from its ⋮, which a popover points at.
  const [menu, setMenu] = useState<{ id: string; view: ActionView; rest: string[]; anchored?: boolean } | null>(null);
  // Only a row that adds up to one amount is edited as a whole; otherwise Edit changes the first item.
  const openRow = (row: GroceryRow, view: ActionView, anchored = false) =>
    setMenu({ id: row.id, view, anchored, rest: rowItem(row, packs) === row.items[0] ? [] : row.items.slice(1).map((i) => i.id) });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The row menu and settings are menus: from 600, popovers pointing at the ⋮ or the settings
  // button, which shows honey while open (spec 065). A long-press or swipe has no ⋮: a card.
  const menuAs = useSheetPresentation('menu');
  const settingsButton = useRef<HostInstance>(null);
  const rowAnchor = useRef<HostInstance | null>(null);
  const [cardMenu, setCardMenu] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  // From 600 (spec 069): recipe cards two by two, aisles in two columns, the Clear pair centred.
  const wide = useLayoutTier().tier !== 'compact';
  const [split, setSplit] = useState<AisleSplit | null>(null);

  const list = useMemo(() => items ?? [], [items]);
  const rows = useMemo(() => combineRows(list), [list]);
  const cards = useMemo(() => recipeCards(list, props.servings), [list, props.servings]);
  const menuCard = cardMenu ? (cards.find((c) => c.id === cardMenu) ?? null) : null;
  const amounts = useMemo(() => rowAmounts(rows, packs, settings), [rows, packs, settings]);
  const titleOf = (row: GroceryRow) => amounts.get(row.id)?.name ?? (row.items[0] as GroceryItem).name;
  const aisles = groupByAisle(rows).map((a) => ({ aisle: a.aisle, rows: byName(a.items, titleOf) }));
  // FR-004: split again only when an aisle comes or goes, or the column count changes.
  const columns = aisleColumns(aisles, wide ? 2 : 1, split);
  if (columns.split !== split) setSplit(columns.split);
  const done = rows.filter((r) => r.checked);
  const shopping = shopper(list, me, members, now);
  const menuRow = menu ? (rows.find((r) => r.id === menu.id) ?? null) : null;
  const menuItem = menuRow ? rowItem(menuRow, packs) : null;

  const header = (
    <TabHeader
      title={g.title}
      sub={items ? g.toBuy(toBuyCount(rows)) : undefined}
      action={
        <View className="flex-row items-center gap-8">
          {shopping ? <Presence label={g.shopping(shopping)} /> : null}
          {props.onShare ? <IconButton icon="share" label={g.shareButton} variant="round" onPress={props.onShare} /> : null}
          <IconButton
            ref={settingsButton}
            icon="settings"
            label={g.settingsButton}
            variant="round"
            expanded={settingsOpen && menuAs === 'popover'}
            onPress={() => setSettingsOpen(true)}
          />
        </View>
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
        toast.show({ text: g.addFailed, tone: 'warn' });
        return;
      }
      tracker.track('grocery_item_added', { from: 'app' });
      setText('');
      if (result.status === 'merged') toast.show({ text: result.total ? g.merged(result.total) : g.mergedNoAmount });
      else if (result.unmatched) tracker.track('ingredient_unmatched', {});
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (row: GroceryRow) => {
    const checked = !row.checked;
    const results = await Promise.all(row.items.map((item) => props.onToggle(item, checked)));
    if (results.includes('failed')) toast.show({ text: g.syncFailed, tone: 'warn' });
    else if (checked) tracker.track('grocery_item_ticked', {});
  };

  /** `count` is the rows the person saw go, for the toast and events. */
  const clear = async (ids: string[], count: number, message: string, kind: Cleared['kind']) => {
    setMenu(null);
    if (await props.onClear(ids)) {
      if (kind === 'done') tracker.track('done_items_cleared', { count });
      if (kind === 'all') tracker.track('all_items_cleared', { count });
      if (kind === 'recipe') tracker.track('grocery_recipe_removed', { item_count: Math.min(count, 500) });
      toast.show({ text: message, onUndo: () => undo({ ids, count, kind }), undoFailed: g.syncFailed });
    } else toast.show({ text: g.syncFailed, tone: 'warn' });
  };

  const undo = async (u: Cleared) => {
    if (!(await props.onRestore(u.ids))) throw new Error('restore failed');
    if (u.kind === 'done') tracker.track('clear_done_undone', { count: u.count });
  };

  const move = async (item: GroceryItem, aisle: Aisle) => {
    setMenu(null);
    if (await props.onMove(item, aisle)) tracker.track('catalog_override_saved', { field: 'aisle' });
    else toast.show({ text: g.syncFailed, tone: 'warn' });
  };

  const savePacks = async (item: GroceryItem, value: string | null) => {
    const result = await props.onSavePacks(item, value);
    if (result === 'invalid') return result;
    setMenu(null);
    if (result === 'failed') toast.show({ text: g.syncFailed, tone: 'warn' });
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
    if (!merged) toast.show({ text: g.syncFailed, tone: 'warn' });
    return true;
  };

  const remove = (row: GroceryRow) => void clear(rowIds([row]), 1, g.removed(titleOf(row)), 'removed');

  // A recipe card (spec 052 FR-006): its body opens the recipe, its "…" the menu (spec 022).
  const openRecipe = (card: RecipeCard) => {
    tracker.track('grocery_recipe_opened', { from: 'card' });
    props.onOpenRecipe(card.id, card.serves);
  };
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
    // FR-008: the sheet stays open and says so.
    return false;
  };

  if (items === undefined) {
    return (
      <TabScreen>
        {header}
        <OfflineBanner screen="groceries" tracker={tracker} />
        {/* A failed first load is a toast with Try again (spec 053 FR-015). */}
        <View role="progressbar" aria-label={g.loading} aria-busy />
      </TabScreen>
    );
  }

  const menuActions = (row: GroceryRow) => [
    { name: 'edit', label: g.edit, onAction: () => openRow(row, 'menu') },
    { name: 'move', label: g.moveTo, onAction: () => openRow(row, 'move') },
    { name: 'remove', label: g.remove, onAction: () => remove(row) },
  ];

  const recipeCard = (card: RecipeCard) => (
    <GroceryRecipeCard
      key={card.id}
      name={card.name}
      meta={card.deleted ? g.fromDeletedRecipe : g.recipeMeta(card.count, card.serves)}
      photoUri={card.photo_path ? photoUrls[card.photo_path] : undefined}
      openLabel={g.openRecipe(card.name)}
      moreLabel={g.moreForRecipe(card.name)}
      onOpen={card.deleted ? null : () => openRecipe(card)}
      onMore={() => setCardMenu(card.id)}
    />
  );

  const aisleSection = ({ aisle, rows: aisleRows }: (typeof aisles)[number]) => (
    <View key={aisle} className="gap-6">
      <Overline className="mt-4">{strings.aisles[aisle]}</Overline>
      <ListGroup>
        {aisleRows.map((row, i) => {
          const { detail, note } = amounts.get(row.id) ?? {};
          const title = titleOf(row);
          const openMenu = online
            ? () => {
                rowAnchor.current = null;
                openRow(row, 'menu');
              }
            : undefined;
          return (
            <ListRow
              key={row.id}
              title={title}
              titleDetail={detail ? { text: detail, note } : undefined}
              sub={rowSource(row, members) ?? undefined}
              subTone="soft"
              done={row.checked}
              leading={{ kind: 'checkbox', checked: row.checked }}
              action={{
                icon: 'more-vertical',
                accessibilityLabel: g.editItem(title),
                onPress: (e) => {
                  rowAnchor.current = e.currentTarget as unknown as HostInstance;
                  openRow(row, 'menu', true);
                },
                disabled: !online,
                expanded: menu?.id === row.id && menu.anchored === true && menuAs === 'popover',
              }}
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
  );

  return (
    <TabScreen
      header={header}
      pinned={
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
        </View>
      }
    >
      <OfflineBanner screen="groceries" tracker={tracker} />

      {pending.map((add) => (
        <View key={`pending-${add.id}`} className="gap-10">
          <GroceryRecipeCard
            pending
            name={add.recipeName}
            meta={g.addingRecipe(add.count)}
            photoUri={add.photoPath ? photoUrls[add.photoPath] : undefined}
            openLabel={add.recipeName}
            moreLabel={add.recipeName}
            onOpen={null}
            onMore={null}
          />
          <ListRowSkeleton count={Math.min(add.count, 3)} />
        </View>
      ))}

      {wide ? (
        // Spec 069 FR-002: a 2-column grid; an odd last card keeps its half.
        cards.length > 0 ? (
          <View className="gap-10">
            {pairs(cards).map((pair) => (
              <View key={pair[0].id} className="flex-row gap-10">
                {pair.map((card) => (
                  <View key={card.id} className="min-w-0 flex-1">
                    {recipeCard(card)}
                  </View>
                ))}
                {pair.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ))}
          </View>
        ) : null
      ) : (
        cards.map(recipeCard)
      )}

      {list.length === 0 && pending.length === 0 ? (
        <View className="gap-8">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {g.emptyTitle}
          </Text>
          <Text color="ink-muted">{g.emptyBody}</Text>
        </View>
      ) : null}

      {wide ? (
        // FR-002/003: two columns read by column, both starting with an aisle heading on the same line.
        <View className="flex-row items-start gap-14">
          {columns.columns.map((col, c) => (
            <View key={c} testID={`grocery-col-${c + 1}`} className="min-w-0 flex-1 gap-14">
              {col.map(aisleSection)}
            </View>
          ))}
        </View>
      ) : (
        aisles.map(aisleSection)
      )}

      {/* Spec 052 FR-007: two equal buttons, always there; each off when it has nothing to clear. */}
      <View className={wide ? 'mt-4 w-full flex-row gap-10 self-center' : 'mt-4 flex-row gap-10'} style={wide ? { maxWidth: theme.layout.buttonPair } : undefined}>
        <View className="min-w-0 flex-1">
          <Button
            label={g.clearDoneButton}
            accessibilityLabel={g.clearDone}
            variant="soft"
            size="pair"
            block
            disabled={!online || done.length === 0}
            onPress={() => void clear(rowIds(done), done.length, g.cleared(done.length), 'done')}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Button
            label={g.clearAllButton}
            accessibilityLabel={g.clearAll}
            variant="danger-outline"
            size="pair"
            block
            disabled={!online || rows.length === 0}
            onPress={() => setConfirmClearAll(true)}
          />
        </View>
      </View>

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
        anchorRef={rowAnchor}
      />

      {menuCard ? (
        <RecipeCardSheet
          key={menuCard.id}
          card={menuCard}
          photoUri={menuCard.photo_path ? photoUrls[menuCard.photo_path] : undefined}
          online={online}
          onSaveServings={(to) => saveServings(menuCard, to)}
          onRemove={() => removeRecipe(menuCard)}
          onClose={() => setCardMenu(null)}
        />
      ) : null}

      {/* Mounted only while open, like the row's sheets: on the web a closed Modal can linger,
          invisible, over the list and swallow every tap until its fade-out reports it ended. */}
      {settingsOpen ? (
        <BottomSheet visible kind="menu" anchorRef={settingsButton} onClose={() => setSettingsOpen(false)} title={g.settingsTitle} closeLabel={g.close}>
          <GrocerySettings settings={settings} onChange={(change) => props.onChangeSettings(change, menuAs)} readOnly={!online} />
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
