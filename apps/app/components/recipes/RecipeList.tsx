import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Callout, FilterButton, Overline, Pill, PillRow, RecipeItem, RecipeItemSkeleton, SearchField, TabHeader, TabScreen, Text } from '@cocon/ui';
import { activeFilterKeys, emptyFilters, type RecipeFilters, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { groupBySeason, visibleRecipes, type RecipeListItem } from '../../lib/recipes';
import { inSeasonOn, toggleInSeason, toggleUnder30, under30On } from '../../lib/recipe-filters';
import { recipeAuthor, recipeMeta } from '../../lib/recipe-format';
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
  /** For the In season group; today by default. */
  now?: Date;
  footer?: ReactNode;
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
}: RecipeListProps) {
  const online = useOnline();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  // Clearing the field shows the whole list right away; only typing waits.
  const settled = (query === '' ? '' : debounced).trim();

  const results = useMemo(() => (recipes ? visibleRecipes(recipes, settled, filters) : []), [recipes, settled, filters]);
  const month = now.getMonth() + 1;
  const activeCount = activeFilterKeys(filters).length;
  const groups = useMemo(() => groupBySeason(results, month), [results, month]);
  const tone = useMemo(() => new Map(recipes?.map((recipe, i) => [recipe.id, tones[i % tones.length]])), [recipes]);

  // Once per settled search, never its text. A live change to the list is not a new search, so the
  // count is read when the search settles rather than tracked as a dependency.
  const searched = useEffectEvent((length: number) => tracker.track('recipes_searched', { query_length: length, result_count: results.length }));
  const loaded = recipes !== undefined;
  useEffect(() => {
    if (settled && loaded) searched(settled.length);
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
        {failed ? (
          <View className="gap-12">
            <Callout variant="warn" text={r.loadFailed} />
            {onRetry ? <Button label={r.retry} variant="soft" size="sm" onPress={onRetry} /> : null}
          </View>
        ) : (
          <View role="progressbar" aria-label={r.loading} aria-busy className="gap-14">
            <RecipeItemSkeleton />
            <RecipeItemSkeleton />
            <RecipeItemSkeleton />
          </View>
        )}
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
        author={recipeAuthor(recipe.created_by, recipe.source, members)}
        placeholderTone={tone.get(recipe.id)}
        onPress={() => open(recipe.id)}
      />
    ));

  return (
    <TabScreen>
      {header}
      <OfflineBanner screen="recipes" tracker={tracker} />
      <SearchField
        label={r.searchLabel}
        placeholder={r.searchPlaceholder}
        hint={query ? undefined : r.searchHint}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <PillRow wrap={false}>
          <FilterButton label={r.filters(activeCount)} onPress={() => onOpenFilters?.(settled)} />
          <Pill label={r.inSeason} selected={inSeasonOn(filters, month)} onPress={() => applyFilters(toggleInSeason(filters, month))} />
          <Pill label={r.under30} selected={under30On(filters)} onPress={() => applyFilters(toggleUnder30(filters))} />
        </PillRow>
      </ScrollView>
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
        <>
          {groups.inSeason.length > 0 ? (
            <View className="gap-14">
              <Overline className="mt-4">{r.inSeasonGroup(strings.months[month - 1] ?? '', groups.inSeason.length)}</Overline>
              {renderItems(groups.inSeason)}
            </View>
          ) : null}
          {groups.rest.length > 0 ? (
            <View className="gap-14">
              <Overline className="mt-4">{r.allGroup(groups.rest.length)}</Overline>
              {renderItems(groups.rest)}
            </View>
          ) : null}
        </>
      )}
      {footer}
    </TabScreen>
  );
}
