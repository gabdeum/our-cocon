import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Callout, FilterButton, Overline, Pill, PillRow, RecipeItem, RecipeItemSkeleton, SearchField, TabHeader, TabScreen, Text } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { groupBySeason, searchRecipes, type RecipeListItem } from '../../lib/recipes';
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
export function RecipeList({ recipes, members, tracker, failed, onRetry, onOpen, onNew, now = new Date(), footer }: RecipeListProps) {
  const online = useOnline();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  // Clearing the field shows the whole list right away; only typing waits.
  const settled = (query === '' ? '' : debounced).trim();
  // Quick filters are drawn here; what they filter comes with spec 007.
  const [quick, setQuick] = useState({ inSeason: false, under30: false });

  const results = useMemo(() => (recipes ? searchRecipes(recipes, settled) : []), [recipes, settled]);
  const month = now.getMonth() + 1;
  const groups = useMemo(() => groupBySeason(results, month), [results, month]);
  const tone = useMemo(() => new Map(recipes?.map((recipe, i) => [recipe.id, tones[i % tones.length]])), [recipes]);

  // Once per settled search, never its text. A live change to the list is not a new search, so the
  // count is read when the search settles rather than tracked as a dependency.
  const searched = useEffectEvent((length: number) => tracker.track('recipes_searched', { query_length: length, result_count: results.length }));
  const loaded = recipes !== undefined;
  useEffect(() => {
    if (settled && loaded) searched(settled.length);
  }, [settled, loaded]);

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
          <FilterButton label={r.filters} />
          <Pill label={r.inSeason} selected={quick.inSeason} onPress={() => setQuick((q) => ({ ...q, inSeason: !q.inSeason }))} />
          <Pill label={r.under30} selected={quick.under30} onPress={() => setQuick((q) => ({ ...q, under30: !q.under30 }))} />
        </PillRow>
      </ScrollView>
      {results.length === 0 ? (
        <View className="gap-12">
          <Text size={18} weight="900" role="heading" aria-level={2}>
            {r.noMatchTitle(settled)}
          </Text>
          <Text color="ink-muted">{r.noMatchBody}</Text>
          <Button label={r.clearSearch} variant="soft" size="sm" onPress={() => setQuery('')} />
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
