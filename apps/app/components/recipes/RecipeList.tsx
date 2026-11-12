import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { announce, Button, Callout, CookSessionCard, FilterButton, Overline, Pill, PillRow, RecipeItem, RecipeItemSkeleton, SearchField, TabHeader, TabScreen, Text } from '@cocon/ui';
import { activeFilterKeys, emptyFilters, type RecipeFilters, type Tracker } from '@cocon/schemas';
import { useFailureToast } from '../../lib/toast';
import { strings } from '../../strings/en';
import type { PhotoUrls } from '../../lib/recipe-photo';
import { visibleRecipes, type RecipeListItem } from '../../lib/recipes';
import { inSeasonOn, toggleInSeason, toggleUnder30, under30On } from '../../lib/recipe-filters';
import { memberName, recipeMeta, recipeSource } from '../../lib/recipe-format';
import { listLine, stepTotal, type CookSession } from '../../lib/cook-sessions';
import { useOnline } from '../../lib/online';
import type { Member } from '../../lib/session';
import { OfflineBanner } from '../sync/OfflineBanner';

const r = strings.recipes;
const tones = ['peach', 'honey', 'sage'] as const;
/** FR-004: the list filters once typing pauses. */
export const SEARCH_DEBOUNCE_MS = 150;

export interface RecipeListProps {
  /** Undefined while the first load runs. */
  recipes: RecipeListItem[] | undefined;
  members: readonly Member[];
  tracker: Tracker;
  /** The first load failed and nothing is cached. */
  failed?: boolean;
  onRetry?: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Spec 007: the session's filters, shared with the Filters sheet. */
  filters?: RecipeFilters;
  onFiltersChange?: (filters: RecipeFilters) => void;
  /** Opens the Filters sheet with the current search. */
  onOpenFilters?: (query: string) => void;
  /** For the In season pill; today by default. */
  now?: Date;
  footer?: ReactNode;
  /** Signed links of the recipes' photos, by path (032-later L10). */
  photoUrls?: PhotoUrls;
  /** Spec 051 FR-003: the family's recipes being cooked, newest first. */
  cooks?: readonly CookSession[];
  onCookResume?: (cook: CookSession) => void;
  onCookDone?: (cook: CookSession, recipeName: string) => void;
  onCookCancel?: (cook: CookSession) => void;
  /** The member's clock (spec 029): "since 18:40" or "since 6:40 PM". */
  use24h?: boolean;
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** The Recipes tab (spec 006; design/ui/OC-Recipes.md). */
export function RecipeList({
  recipes,
  members,
  tracker,
  failed,
  onRetry,
  onOpen,
  onNew,
  filters = emptyFilters,
  onFiltersChange,
  onOpenFilters,
  now = new Date(),
  footer,
  photoUrls = {},
  cooks = [],
  onCookResume,
  onCookDone,
  onCookCancel,
  use24h = true,
}: RecipeListProps) {
  const online = useOnline();
  useFailureToast(recipes === undefined && failed && r.loadFailed, onRetry);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  // Clearing the field shows the whole list right away; only typing waits.
  const settled = (query === '' ? '' : debounced).trim();

  const results = useMemo(() => (recipes ? visibleRecipes(recipes, settled, filters) : []), [recipes, settled, filters]);
  const month = now.getMonth() + 1;
  const activeCount = activeFilterKeys(filters).length;
  const tone = useMemo(() => new Map(recipes?.map((recipe, i) => [recipe.id, tones[i % tones.length]])), [recipes]);

  // Once per settled search, never its text. A live change to the list is not a new search, so the
  // count is read when the search settles rather than tracked as a dependency.
  // The list changes silently: a screen reader hears how many it found (spec 030).
  const searched = useEffectEvent((search: string) => {
    tracker.track('recipes_searched', { query_length: search.length, result_count: results.length });
    announce(results.length ? r.resultCount(results.length) : r.noMatchTitle(search));
  });
  const loaded = recipes !== undefined;
  useEffect(() => {
    if (settled && loaded) searched(settled);
  }, [settled, loaded]);

  // FR-003: a quick pill applies its filter at once, like "Show N recipes" in the sheet.
  const applyFilters = (next: RecipeFilters) => {
    tracker.track('recipe_filters_applied', { filter_keys: activeFilterKeys(next), result_count: recipes ? visibleRecipes(recipes, settled, next).length : 0 });
    onFiltersChange?.(next);
  };

  const open = (id: string) => {
    tracker.track('recipe_opened', { from: settled ? 'search' : 'list' });
    onOpen(id);
  };

  const header = <TabHeader title={r.title} action={<Button label={r.new} variant="olive" size="sm" icon="plus" onPress={onNew} disabled={!online} />} />;

  if (recipes === undefined) {
    return (
      <TabScreen>
        {header}
        <OfflineBanner screen="recipes" tracker={tracker} />
        {/* A failed first load is a toast with Try again (spec 053 FR-015); the skeleton stays. */}
        <View role="progressbar" aria-label={r.loading} aria-busy className="gap-14">
          <RecipeItemSkeleton />
          <RecipeItemSkeleton />
          <RecipeItemSkeleton />
        </View>
        {footer}
      </TabScreen>
    );
  }

  if (recipes.length === 0) {
    return (
      <TabScreen>
        {header}
        <OfflineBanner screen="recipes" tracker={tracker} />
        <View className="gap-14">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {r.emptyTitle}
          </Text>
          <Text color="ink-muted">{r.emptyBody}</Text>
          <Button label={r.emptyNew} onPress={onNew} disabled={!online} />
          <Callout variant="ai" label={r.emptyAiLabel} text={r.emptyAiHint} />
        </View>
        {footer}
      </TabScreen>
    );
  }

  const renderItems = (items: RecipeListItem[]) =>
    items.map((recipe) => (
      <RecipeItem
        key={recipe.id}
        name={recipe.name}
        meta={recipeMeta(recipe)}
        author={recipeSource(recipe, memberName(recipe.created_by, members))}
        placeholderTone={tone.get(recipe.id)}
        photoUri={recipe.photo_path ? photoUrls[recipe.photo_path] : undefined}
        onPress={() => open(recipe.id)}
      />
    ));

  // FR-003: cooks of recipes still on the list (a deleted recipe's is cancelled anyway).
  const cooking = cooks.flatMap((cook) => {
    const recipe = recipes.find((x) => x.id === cook.recipe_id);
    return recipe ? [{ cook, recipe }] : [];
  });
  const inProgress =
    cooking.length > 0 ? (
      <View role="region" aria-label={r.inProgress(cooking.length)} className="gap-8">
        <Overline>{r.inProgress(cooking.length)}</Overline>
        {cooking.map(({ cook, recipe }) => {
          const total = stepTotal(recipe.stepCount, cook);
          return (
            <CookSessionCard
              key={cook.id}
              variant="list"
              title={recipe.name}
              line={listLine(cook, total, members, now, use24h)}
              steps={{ count: total, current: cook.current_step }}
              photoUri={recipe.photo_path ? photoUrls[recipe.photo_path] : undefined}
              openLabel={r.resumeA11y(recipe.name, cook.current_step + 1, total)}
              labels={{ cancel: strings.recipePage.cancel, done: strings.recipePage.done, resume: strings.recipePage.resume }}
              a11y={{ cancel: r.cancelA11y(recipe.name), done: r.doneA11y(recipe.name), resume: r.resumeA11y(recipe.name, cook.current_step + 1, total) }}
              disabled={!online}
              onCancel={() => onCookCancel?.(cook)}
              onDone={() => onCookDone?.(cook, recipe.name)}
              onResume={() => onCookResume?.(cook)}
            />
          );
        })}
      </View>
    ) : null;

  return (
    <TabScreen
      header={header}
      pinned={
        <>
          <SearchField
            label={r.searchLabel}
            placeholder={r.searchPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <PillRow wrap={false}>
              <FilterButton label={r.filters(activeCount)} onPress={() => onOpenFilters?.(settled)} />
              <Pill label={r.inSeason} selected={inSeasonOn(filters, month)} onPress={() => applyFilters(toggleInSeason(filters, month))} />
              <Pill label={r.under30} selected={under30On(filters)} onPress={() => applyFilters(toggleUnder30(filters))} />
            </PillRow>
          </ScrollView>
        </>
      }
    >
      <OfflineBanner screen="recipes" tracker={tracker} />
      {inProgress}
      {results.length === 0 && !settled ? (
        <View className="gap-12">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {r.noFilterMatchTitle}
          </Text>
          <Text color="ink-muted">{r.noFilterMatchBody}</Text>
          <Button label={r.clearFilters} variant="soft" size="sm" onPress={() => applyFilters(emptyFilters)} />
        </View>
      ) : results.length === 0 ? (
        <View className="gap-12">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {r.noMatchTitle(settled)}
          </Text>
          <Text color="ink-muted">{r.noMatchBody}</Text>
          <View className="flex-row flex-wrap gap-8">
            <Button label={r.clearSearch} variant="soft" size="sm" onPress={() => setQuery('')} />
            {activeCount > 0 ? <Button label={r.clearFilters} variant="soft" size="sm" onPress={() => applyFilters(emptyFilters)} /> : null}
          </View>
        </View>
      ) : (
        <View className="gap-14">
          <Overline className="mt-4">{r.allGroup(results.length)}</Overline>
          {renderItems(results)}
        </View>
      )}
      {footer}
    </TabScreen>
  );
}
