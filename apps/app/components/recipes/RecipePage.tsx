import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Callout,
  Card,
  Choice,
  IconButton,
  IngredientRow,
  Link,
  ListRow,
  Meta,
  PhotoPlaceholder,
  PhotoScreen,
  PillRow,
  SegmentedControl,
  SettingRow,
  StatusBanner,
  StepCard,
  StepFootnote,
  Stepper,
  Text,
  TimerRow,
} from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import type { FormatOptions } from '@cocon/quantity';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { readChoices, startingChoices, writeChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, formatOf, optionHint, recipeChips, recipeView, servingsMax, servingsText, SERVINGS_MIN, variantCount, type StepLine } from '../../lib/recipe-view';
import type { Member } from '../../lib/session';
import { AppTimerPill } from '../timers/AppTimerPill';
import { useStepTimerControl, type StepTimerInput } from './step-timer';
import { OfflineBanner } from '../sync/OfflineBanner';

const p = strings.recipePage;
const more = strings.recipePage.more;
const stepCopy = strings.recipePage.steps;
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
  /** The TimerPill opens the Timers screen (spec 011). */
  onOpenTimers: () => void;
  /** "I have a thermometer" (spec 027 wires the setting); on until then. */
  thermometer?: boolean;
  /** The "…" panel's sheets (spec 013): Scale by an ingredient and Unit converter. */
  onScaleByIngredient: () => void;
  onConvert: () => void;
  /** Changes when the page is shown again, so choices a sheet saved are read back. */
  visit?: number;
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
  onOpenTimers,
  thermometer = defaultCooking.thermometer,
  onScaleByIngredient,
  onConvert,
  visit = 0,
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
  const scaledName = view?.scaledBy ? `${view.scaledBy.baseName.charAt(0).toLowerCase()}${view.scaledBy.baseName.slice(1)}` : null;

  const pickVariants = (next: RecipeChoices) => {
    if (!current || (next.version === current.version && next.options.length === current.options.length && next.options.every((id) => current.options.includes(id)))) return;
    tracker.track('variant_selected', { variant_count: variantCount(next) });
    update(next);
  };

  const deletedBy = recipe.deleted_at ? (members.find((m) => m.user_id === recipe.deleted_by)?.display_name ?? strings.recipe.formerMember) : null;

  return (
    <PhotoScreen
      photo={<PhotoPlaceholder initial={recipe.name.charAt(0).toUpperCase()} className="h-full" />}
      left={<IconButton icon="back" label={p.back} onPress={onBack} />}
      floating={<AppTimerPill onOpen={onOpenTimers} tracker={tracker} />}
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
          <MorePanel
            choices={current}
            format={formatOf(current)}
            onChange={(next) => {
              // Tapping what's already in force changes nothing, and keeps following the settings.
              const now = formatOf(current);
              if (next.kitchenScale !== null && next.kitchenScale !== now.scale) tracker.track('kitchen_scale_toggled', { on: next.kitchenScale });
              else if (next.system !== null && next.system !== now.system) tracker.track('units_toggled', { system: next.system });
              else return;
              update(next);
            }}
            onScaleByIngredient={onScaleByIngredient}
            onConvert={onConvert}
          />
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
              <Button label={p.addToGroceries} variant="outline" icon="groceries" block onPress={onAddToGroceries} className="mt-16" />
            </View>
          ) : (
            <View className="gap-14">
              <View role="list" aria-label={p.stepsLabel} className="gap-14">
                {view.steps.map((step, index) => (
                  <View key={step.id} role="listitem">
                    <Step step={step} index={index} recipeId={recipe.id} recipeName={recipe.name} tracker={tracker} />
                  </View>
                ))}
              </View>
              <StepFootnote text={stepCopy.footnote} />
            </View>
          )}
        </>
      ) : null}

      <Button label={p.startCooking} variant="ink" size="lg" icon="play" block onPress={onStartCooking} />
    </PhotoScreen>
  );
}

/**
 * The "…" panel under Servings (spec 013, OC-Recipe): the kitchen scale and units are quick
 * toggles for this recipe on this device; the two sheets sit between them, as drawn.
 */
function MorePanel({
  choices,
  format,
  onChange,
  onScaleByIngredient,
  onConvert,
}: {
  choices: RecipeChoices;
  /** What's in force: the toggles, else the settings. */
  format: FormatOptions;
  onChange: (next: RecipeChoices) => void;
  onScaleByIngredient: () => void;
  onConvert: () => void;
}) {
  return (
    <View>
      <SettingRow
        label={more.kitchenScale}
        hint={format.scale ? more.scaleOnHint : more.scaleOffHint}
        value={format.scale}
        onValueChange={(on) => onChange({ ...choices, kitchenScale: on })}
      />
      <ListRow flush title={more.scaleByIngredient} trailing={{ kind: 'chevron' }} onPress={onScaleByIngredient} />
      <ListRow flush title={more.converter} trailing={{ kind: 'chevron' }} onPress={onConvert} />
      <ListRow
        flush
        last
        title={more.units}
        trailing={{
          kind: 'node',
          node: (
            <SegmentedControl
              variant="pill"
              label={more.units}
              value={format.system}
              onChange={(system) => onChange({ ...choices, system })}
              segments={[
                { key: 'metric', label: more.metric },
                { key: 'imperial', label: more.imperial },
              ]}
            />
          ),
        }}
      />
    </View>
  );
}

/** One step (FR-001): text, then the temperature check, the timer row and the tip, in that order. */
function Step({ step, index, recipeId, recipeName, tracker }: { step: StepLine; index: number; recipeId: string; recipeName: string; tracker: Tracker }) {
  return (
    <StepCard number={step.number} name={step.name ?? undefined} variantTag={step.variant ? p.variantTag : undefined} parts={step.parts}>
      {step.tempCheck ? <Callout variant="temp" label={stepCopy.tempLabel} text={step.tempCheck} /> : null}
      {step.timer ? <StepTimer stepId={step.id} index={index} recipeId={recipeId} recipeName={recipeName} timer={step.timer} tracker={tracker} /> : null}
      {step.tip ? <Callout variant="tip" label={stepCopy.tipLabel} text={step.tip} /> : null}
    </StepCard>
  );
}

const rowLabel = { idle: stepCopy.startTimer, running: stepCopy.pause, paused: stepCopy.resume, done: stepCopy.done } as const;

/** A step's timer row (spec 010, 009 US3); the rules are in `useStepTimerControl`. */
function StepTimer(props: StepTimerInput) {
  const t = useStepTimerControl(props);
  return (
    <TimerRow
      state={t.state}
      label={rowLabel[t.state]}
      clock={t.clock}
      onPress={t.onPress}
      minusLabel={stepCopy.minus}
      plusLabel={stepCopy.plus}
      minusA11y={stepCopy.minusA11y}
      plusA11y={stepCopy.plusA11y}
      onMinus={t.onMinus}
      onPlus={t.onPlus}
      announcement={t.announcement}
    />
  );
}
