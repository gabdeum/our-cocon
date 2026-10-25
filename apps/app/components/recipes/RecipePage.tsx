import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Choice,
  IconButton,
  IngredientRow,
  Link,
  Meta,
  PhotoPlaceholder,
  Photo,
  PhotoScreen,
  PillRow,
  SegmentedControl,
  SettingRow,
  StatusBanner,
  StepRow,
  Stepper,
  Text,
} from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { readChoices, startingChoices, writeChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, formatOf, optionHint, recipeChips, recipeView, servingsMax, servingsText, SERVINGS_MIN, variantCount, type StepLine } from '../../lib/recipe-view';
import type { PhotoUrls } from '../../lib/recipe-photo';
import type { Member } from '../../lib/session';
import { AppTimerPill } from '../timers/AppTimerPill';
import { MoreOptions } from './MoreOptions';
import { OfflineBanner } from '../sync/OfflineBanner';

const p = strings.recipePage;
const more = strings.recipePage.more;
/** `servings_changed` waits for the stepper to settle, so 6 → 9 in three taps is one change. */
export const SERVINGS_SETTLE_MS = 800;

export type RecipeTab = 'ingredients' | 'steps';

export interface RecipePageProps {
  /** Undefined while loading; null when there's no such recipe for this family. */
  recipe: RecipeDetail | null | undefined;
  /** The load failed and nothing is cached. */
  failed?: boolean;
  onRetry?: () => void;
  members: readonly Member[];
  userId: string;
  tracker: Tracker;
  tab: RecipeTab;
  onTabChange: (tab: RecipeTab) => void;
  storage: ChoiceStorage;
  onBack: () => void;
  onShare: () => void;
  onSettings: () => void;
  onAddToGroceries: () => void;
  onStartCooking: () => void;
  /** A step in the Steps tab opens cooking mode at that step. */
  onOpenStep: (stepId: string) => void;
  /** The TimerPill opens the Timers screen (spec 011). */
  onOpenTimers: () => void;
  /** "I have a thermometer" (spec 027 wires the setting); on until then. */
  thermometer?: boolean;
  /** The "…" panel's sheets (spec 013): Scale by an ingredient and Unit converter. */
  onScaleByIngredient: () => void;
  onConvert: () => void;
  /** Changes when the page is shown again, so choices a sheet saved are read back. */
  visit?: number;
  /** Signed links of the recipe's and steps' photos, by path (032-later L10). */
  photoUrls?: PhotoUrls;
}

/** The recipe page (spec 008, design/ui/OC-Recipe.md) and its Steps tab (spec 009, OC-RecipeSteps.md). */
export function RecipePage(props: RecipePageProps) {
  const { recipe, failed, onRetry, tracker, onBack } = props;
  const back = <IconButton icon="back" label={p.back} onPress={onBack} />;

  if (recipe === undefined && !failed) {
    return (
      <PhotoScreen photo={<PhotoPlaceholder className="h-full" />} left={back}>
        <View role="progressbar" aria-label={p.loading} className="gap-12">
          <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
          {[0, 1, 2].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PhotoScreen>
    );
  }
  if (!recipe) {
    return (
      <PhotoScreen photo={<PhotoPlaceholder className="h-full" />} left={back}>
        <OfflineBanner screen="recipe" tracker={tracker} />
        <Text variant="titleLg" role="heading" aria-level={1}>
          {p.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{p.loadFailedBody}</Text>
        {onRetry ? <Button label={p.retry} variant="soft" onPress={onRetry} /> : null}
      </PhotoScreen>
    );
  }
  return <LoadedRecipe {...props} recipe={recipe} />;
}

function LoadedRecipe({
  recipe,
  members,
  userId,
  tracker,
  tab,
  onTabChange,
  storage,
  onBack,
  onShare,
  onSettings,
  onAddToGroceries,
  onStartCooking,
  onOpenStep,
  onOpenTimers,
  thermometer = defaultCooking.thermometer,
  onScaleByIngredient,
  onConvert,
  visit = 0,
  photoUrls = {},
}: RecipePageProps & { recipe: RecipeDetail }) {
  const max = servingsMax(recipe.serves);
  const [choices, setChoices] = useState<RecipeChoices | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // FR-006: open with what was picked last time on this device.
  useEffect(() => {
    let live = true;
    void readChoices(storage, userId, recipe.id).then((stored) => {
      if (live) setChoices(startingChoices(stored, recipe, max));
    });
    return () => {
      live = false;
    };
    // When another recipe or person opens, or a sheet saved a scale; live edits are re-validated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId, recipe.id, visit]);

  // A variant deleted while the page is open no longer counts.
  const current = useMemo(() => (choices ? startingChoices(choices, recipe, max) : null), [choices, recipe, max]);
  const view = useMemo(
    () => (current ? recipeView(recipe, current, current, formatOf(current), { thermometer }) : null),
    [recipe, current, thermometer],
  );
  const chips = recipeChips(recipe, members);
  const versions = recipe.variants.filter((v) => v.kind === 'version');
  const options = recipe.variants.filter((v) => v.kind === 'option');

  const update = (next: RecipeChoices) => {
    setChoices(next);
    void writeChoices(storage, userId, recipe.id, next);
  };

  // `servings_changed` once the stepper settles, from where the burst of taps started.
  // Leaving the page before it settles still sends the change.
  const burst = useRef<{ from: number; to: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const sendServings = useCallback(() => {
    const b = burst.current;
    burst.current = null;
    if (!b) return;
    clearTimeout(b.timer);
    if (b.from !== b.to) tracker.track('servings_changed', { from: b.from, to: b.to });
  }, [tracker]);
  useEffect(() => sendServings, [sendServings]);
  // Scaled by an ingredient (013), servings can be 7½: − goes to 7 and + to 8, and the scale ends.
  const shown = view?.servings ?? current?.servings ?? recipe.serves;
  const changeServings = (stepped: number) => {
    if (!current) return;
    const to = Math.min(max, Math.max(SERVINGS_MIN, stepped > shown ? Math.floor(shown) + 1 : Math.ceil(shown) - 1));
    const from = burst.current?.from ?? Math.min(max, Math.max(SERVINGS_MIN, Math.round(shown)));
    clearTimeout(burst.current?.timer);
    burst.current = { from, to, timer: setTimeout(() => sendServings(), SERVINGS_SETTLE_MS) };
    update({ ...current, servings: to, scaledBy: null });
  };
  const scaledName = view?.scaledBy ? `${view.scaledBy.name.charAt(0).toLowerCase()}${view.scaledBy.name.slice(1)}` : null;

  const pickVariants = (next: RecipeChoices) => {
    if (!current || (next.version === current.version && next.options.length === current.options.length && next.options.every((id) => current.options.includes(id)))) return;
    tracker.track('variant_selected', { variant_count: variantCount(next) });
    update(next);
  };

  const deletedBy = recipe.deleted_at ? (members.find((m) => m.user_id === recipe.deleted_by)?.display_name ?? strings.recipe.formerMember) : null;

  const headerPhoto = recipe.photo_path ? photoUrls[recipe.photo_path] : undefined;
  return (
    <PhotoScreen
      photo={
        headerPhoto ? (
          <Photo uri={headerPhoto} label={p.photo} />
        ) : (
          <PhotoPlaceholder initial={recipe.name.charAt(0).toUpperCase()} className="h-full" />
        )
      }
      left={<IconButton icon="back" label={p.back} onPress={onBack} />}
      floating={<AppTimerPill onOpen={onOpenTimers} tracker={tracker} />}
      footer={<RecipeActions onAddToGroceries={onAddToGroceries} onStartCooking={onStartCooking} />}
      right={
        <>
          <IconButton icon="share" label={p.share} onPress={onShare} />
          <IconButton icon="settings" label={p.settings} onPress={onSettings} />
        </>
      }
      banner={
        <>
          <OfflineBanner screen="recipe" tracker={tracker} />
          {deletedBy ? <StatusBanner tone="warn" message={p.deleted(deletedBy)} actionLabel={p.back} onAction={onBack} /> : null}
        </>
      }
    >
      <View>
        <Text variant="displayLg" role="heading" aria-level={1}>
          {recipe.name}
        </Text>
        {recipe.description ? (
          <Text variant="body" color="ink-muted" className="mt-6">
            {recipe.description}
          </Text>
        ) : null}
        <PillRow className="mt-12">
          {chips.facts.map((chip) => (
            <Meta key={chip} label={chip} />
          ))}
          <Meta label={chips.author} tone="sage" />
        </PillRow>
      </View>

      {recipe.variants.length > 0 && current ? (
        <View className="gap-10">
          <Text size={16} weight="900" role="heading" aria-level={2}>
            {p.version}
          </Text>
          {versions.length > 0 ? (
            <PillRow>
              <Choice label={p.classic} selected={current.version === null} onPress={() => pickVariants({ ...current, version: null })} />
              {versions.map((v) => (
                <Choice key={v.id} label={v.name} selected={current.version === v.id} onPress={() => pickVariants({ ...current, version: v.id })} />
              ))}
            </PillRow>
          ) : null}
          {options.map((v) => {
            const on = current.options.includes(v.id);
            return (
              <SettingRow
                key={v.id}
                boxed
                label={v.name}
                hint={optionHint(v) ?? undefined}
                value={on}
                onValueChange={(next) => pickVariants({ ...current, options: next ? [...current.options, v.id] : current.options.filter((id) => id !== v.id) })}
              />
            );
          })}
        </View>
      ) : null}

      <Card className="py-12 pl-16 pr-12">
        <View className="flex-row items-center gap-8">
          <Text size={17} weight="900" className="flex-1">
            {p.servings}
          </Text>
          {current ? (
            <Stepper
              value={shown}
              display={scaledName ? servingsText(shown) : undefined}
              onChange={changeServings}
              min={SERVINGS_MIN}
              max={max}
              decreaseLabel={p.fewerServings}
              increaseLabel={p.moreServings}
            />
          ) : null}
          <IconButton icon="more" label={p.moreOptions} variant="square" iconSize={22} expanded={moreOpen} onPress={() => setMoreOpen((o) => !o)} className="ml-4" />
        </View>
        {scaledName && current ? (
          <View className="flex-row flex-wrap items-center gap-8">
            {/* Meta and Link align themselves to the top; their wrappers let the row centre them. */}
            <View>
              <Meta label={more.scaledBy(scaledName)} tone="sage" />
            </View>
            <View>
              <Link label={more.reset} aria-label={more.resetA11y(scaledName)} onPress={() => update({ ...current, scaledBy: null })} />
            </View>
          </View>
        ) : null}
        {moreOpen && current ? (
          <MoreOptions choices={current} tracker={tracker} onChange={update} onScaleByIngredient={onScaleByIngredient} onConvert={onConvert} />
        ) : null}
      </Card>

      {view ? (
        <>
          <SegmentedControl
            variant="tabs"
            label={p.tabsLabel}
            value={tab}
            onChange={onTabChange}
            segments={[
              { key: 'ingredients', label: p.ingredientsTab(view.ingredients.length) },
              { key: 'steps', label: p.stepsTab(view.stepCount) },
            ]}
          />
          {tab === 'ingredients' ? (
            <View>
              <View role="list" aria-label={p.ingredientsLabel}>
                {view.ingredients.map((ing, i) => (
                  <IngredientRow
                    key={ing.id}
                    amount={ing.amount}
                    name={ing.name}
                    sub={ing.sub ?? undefined}
                    tag={ing.variant ? { label: p.variantTag, tone: 'sage' } : undefined}
                    last={i === view.ingredients.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View role="list" aria-label={p.stepsLabel} className="gap-8">
              {view.steps.map((step) => (
                <View key={step.id} role="listitem">
                  <StepRow
                    number={step.number}
                    title={step.name ?? stepText(step)}
                    clock={step.timer?.clock}
                    accessibilityLabel={p.openStep(step.number)}
                    onPress={() => onOpenStep(step.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </PhotoScreen>
  );
}

/**
 * The fixed footer (OC-Recipe): "Add groceries" (outline) and "Start cooking" (ink), no icons, side by
 * side, half each. When either label doesn't fit on one line, both read short: "Groceries", "Cook".
 */
function RecipeActions({ onAddToGroceries, onStartCooking }: { onAddToGroceries: () => void; onStartCooking: () => void }) {
  const [fits, setFits] = useState({ groceries: true, cook: true });
  const short = !fits.groceries || !fits.cook;
  return (
    <View className="flex-row gap-10">
      <Button
        label={p.addToGroceries}
        shortLabel={p.addToGroceriesShort}
        short={short}
        onLabelFits={(groceries) => setFits((f) => (f.groceries === groceries ? f : { ...f, groceries }))}
        variant="outline"
        size="lg"
        block
        className="flex-1"
        onPress={onAddToGroceries}
      />
      <Button
        label={p.startCooking}
        shortLabel={p.startCookingShort}
        short={short}
        onLabelFits={(cook) => setFits((f) => (f.cook === cook ? f : { ...f, cook }))}
        variant="ink"
        size="lg"
        block
        className="flex-1"
        onPress={onStartCooking}
      />
    </View>
  );
}

/** A step with no name is listed by its text. */
function stepText(step: StepLine): string {
  return step.parts.map((part) => (typeof part === 'string' ? part : 'amount' in part ? part.amount : part.missing)).join('').trim();
}
