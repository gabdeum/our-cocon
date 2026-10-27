import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Link, MonthPicker, PersonPill, Pill, PillRow, Text } from '@cocon/ui';
import { activeFilterKeys, cuisineFacets, emptyFilters, memberInitials, type CuisineFilter, type RecipeFilters, type TimeFilter, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { visibleRecipes, type RecipeListItem } from '../../lib/recipes';
import type { Member } from '../../lib/session';

const f = strings.filters;
/** FR-004: cuisines shown before "Show {n} more". */
export const CUISINES_SHOWN = 10;

const times: { key: TimeFilter; label: string }[] = [
  { key: 'under_30', label: f.under30 },
  { key: '30_60', label: f.from30to60 },
  { key: 'over_60', label: f.over60 },
];

const toggle = <T,>(items: readonly T[], item: T) => (items.includes(item) ? items.filter((x) => x !== item) : [...items, item]);

export interface FiltersSheetProps {
  recipes: readonly RecipeListItem[];
  members: readonly Member[];
  /** The list's current search, so the count matches what the list will show. */
  query: string;
  /** The filters in force when the sheet opens; edits are a draft until "Show N recipes". */
  filters: RecipeFilters;
  tracker: Tracker;
  onApply: (filters: RecipeFilters) => void;
  onClose: () => void;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-8">
      <Text size={16} weight="900" role="heading" aria-level={3}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** The Filters sheet (spec 007; design/ui/OC-Filters.md). */
export function FiltersSheet({ recipes, members, query, filters, tracker, onApply, onClose }: FiltersSheetProps) {
  const [draft, setDraft] = useState(filters);
  const [expanded, setExpanded] = useState(false);
  const count = useMemo(() => visibleRecipes(recipes, query, draft).length, [recipes, query, draft]);
  const facets = useMemo(() => cuisineFacets(recipes, (c) => strings.cuisines[c]), [recipes]);

  // The first 10, plus any chosen one beyond them, so a selection never hides (edge cases).
  const shownCuisines = expanded ? facets.keys : facets.keys.filter((c, i) => i < CUISINES_SHOWN || draft.cuisines.includes(c));
  const hiddenCount = facets.keys.length - shownCuisines.length;

  const apply = () => {
    tracker.track('recipe_filters_applied', { filter_keys: activeFilterKeys(draft), result_count: count });
    onApply(draft);
  };
  const toggleCuisine = (c: CuisineFilter) => setDraft((d) => ({ ...d, cuisines: toggle(d.cuisines, c) }));
  // Members without the app never add recipes (spec 033).
  const initials = memberInitials(members);
  const adders = members.filter((m): m is Member & { user_id: string } => m.user_id !== null);

  const footer =
    count === 0 ? (
      <View className="gap-8">
        <Text variant="caption" color="ink-muted" className="text-center">
          {f.noMatchHint}
        </Text>
        <Button label={f.noMatch} variant="ink" block disabled />
      </View>
    ) : (
      <Button label={f.show(count)} variant="ink" block onPress={apply} />
    );

  return (
    <BottomSheet
      visible
      title={f.title}
      closeLabel={f.close}
      onClose={onClose}
      headerAction={<Link label={f.clearAll} onPress={() => setDraft(emptyFilters)} />}
      footer={footer}
    >
      <Group title={f.months}>
        <MonthPicker
          label={f.months}
          hint={f.monthsHint}
          monthLabels={[...strings.monthsShort]}
          // MonthPicker counts from 0; filters keep months 1–12 like recipes.best_months.
          value={draft.months.map((m) => m - 1)}
          onChange={(months) => setDraft((d) => ({ ...d, months: months.map((m) => m + 1) }))}
        />
      </Group>
      <Group title={f.time}>
        <PillRow>
          {times.map((t) => (
            <Pill key={t.key} label={t.label} selected={draft.time === t.key} onPress={() => setDraft((d) => ({ ...d, time: d.time === t.key ? null : t.key }))} />
          ))}
        </PillRow>
      </Group>
      {facets.keys.length > 0 ? (
        <Group title={f.cuisine}>
          <PillRow>
            {shownCuisines.map((c) => (
              <Pill key={c} label={strings.cuisines[c]} selected={draft.cuisines.includes(c)} onPress={() => toggleCuisine(c)} />
            ))}
            {hiddenCount > 0 ? <Pill label={f.showMore(hiddenCount)} aria-pressed={undefined} onPress={() => setExpanded(true)} /> : null}
            {facets.hasOther ? <Pill label={f.other} selected={draft.cuisines.includes('other')} onPress={() => toggleCuisine('other')} /> : null}
          </PillRow>
        </Group>
      ) : null}
      <Group title={f.addedBy}>
        <PillRow>
          {adders.map((m) => (
            <PersonPill
              key={m.id}
              label={m.display_name}
              initial={initials.get(m.id) ?? '?'}
              color={m.color}
              selected={draft.addedBy.includes(m.user_id)}
              onPress={() => setDraft((d) => ({ ...d, addedBy: toggle(d.addedBy, m.user_id) }))}
            />
          ))}
        </PillRow>
      </Group>
    </BottomSheet>
  );
}
