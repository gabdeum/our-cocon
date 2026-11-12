import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, type HostInstance, type ScrollViewInstance } from 'react-native';
import { announce, BottomSheet, Button, Callout, CookLayout, CookProgress, CookSection, CookTimerCard, ListRow, PushedScreen, SettingRow, StepText, Text, useReduceMotion, type TopBarConfig } from '@cocon/ui';
import { MAX_TRACKED_STEPS, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { readChoices, startingChoices, writeChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, formatOf, recipeView, servingsMax, servingsText, type CookingSettings } from '../../lib/recipe-view';
import { startIndex, stepEditTarget } from '../../lib/cooking';
import { useCookAwake } from '../../lib/keep-awake';
import { AppTimerPill, useHasTimers } from '../timers/AppTimerPill';
import { useStepTimerControl, type StepTimerInput } from '../recipes/step-timer';
import { MoreOptions } from '../recipes/MoreOptions';
import { useStepScroll } from './use-step-scroll';
import { useVisitUnits } from '../../lib/visit-units';

const c = strings.cook;
const p = strings.recipePage;

export interface CookScreenProps {
  /** `undefined` while loading, `null` when there's no such recipe. */
  recipe: RecipeDetail | null | undefined;
  /** The load failed and nothing is cached. */
  failed?: boolean;
  onRetry?: () => void;
  /** Whose servings and variants to cook with (the recipe page's, on this device). */
  userId: string;
  storage: ChoiceStorage;
  tracker: Tracker;
  /** Open at this step (a step timer's "Go to step", 032-later L19); unknown ids open at step 1. */
  stepId?: string;
  /** ✕ (and Back on step 1) close cooking mode and return to the recipe; the cook stays in progress (spec 051 FR-002). */
  onClose: () => void;
  /**
   * Spec 051: the cook being resumed: it opens at its step (unless `stepId` says another) with its
   * servings and version. Null for a new cook, which starts from this device's choices.
   */
  session?: { current_step: number; servings: number; variant_id: string | null } | null;
  /** The step on screen (from 0), each time it changes: the route saves it to the cook. */
  onStep?: (index: number) => void;
  /** "Done cooking" on the last step (FR-005). */
  onDone: () => void;
  /** The TimerPill opens the Timers screen. */
  onOpenTimers: () => void;
  /** The options sheet's Scale by an ingredient and Unit converter (spec 013). */
  onScaleByIngredient: () => void;
  onConvert: () => void;
  /** The options sheet's "Edit step {n}": the recipe form at that step, or the variant that makes it. */
  onEditStep: (target: { step: string } | { variant: string }) => void;
  /** Changes when the screen is shown again, so choices a sheet saved are read back. */
  visit?: number;
  /** The recipe's settings in force (spec 027): units, kitchen scale, thermometer checks and "Keep screen on". */
  cooking?: CookingSettings;
  now?: () => number;
}

/** Cooking mode (spec 012, design/ui/OC-Cook.md): one scrolling column of steps, Back and Next. */
export function CookScreen(props: CookScreenProps) {
  const { recipe, failed, onRetry, onClose } = props;
  // Loading and Couldn't load have no cooking header: the TopBar gives them the same round ✕ (spec 050).
  const bar: TopBarConfig = { back: { label: c.exitA11y, onPress: onClose, icon: 'close' } };

  if (recipe === undefined && !failed) return <CookLoading bar={bar} />;
  // A recipe deleted while open can't be cooked from (OC-Cook › Couldn't load).
  if (!recipe || recipe.deleted_at) {
    return (
      <PushedScreen topBar={bar}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {p.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{p.loadFailedBody}</Text>
        {onRetry && !recipe ? <Button label={p.retry} variant="soft" onPress={onRetry} /> : null}
      </PushedScreen>
    );
  }
  return <WithChoices {...props} recipe={recipe} bar={bar} />;
}

function CookLoading({ bar }: { bar: TopBarConfig }) {
  return (
    <PushedScreen topBar={bar}>
      <View role="progressbar" aria-label={c.loading} className="gap-12">
        <View className="h-8 rounded-xs bg-surface-soft" />
        <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
        {[0, 1, 2].map((n) => (
          <View key={n} className="h-control-md rounded-md bg-surface-soft" />
        ))}
      </View>
    </PushedScreen>
  );
}

type LoadedProps = CookScreenProps & { recipe: RecipeDetail; bar: TopBarConfig };

/** The recipe page's current servings and variants on this device (spec 008 FR-006), then the steps. */
function WithChoices(props: LoadedProps) {
  const { recipe, storage, userId, bar, visit = 0, session } = props;
  const [choices, setChoices] = useState<RecipeChoices | null>(null);
  // A resumed cook keeps its servings and version (spec 051 US1.3), once; later changes are the cook's own.
  const resumed = useRef(false);
  useEffect(() => {
    let live = true;
    void readChoices(storage, userId, recipe.id).then((stored) => {
      if (!live) return;
      const start = startingChoices(stored, recipe, servingsMax(recipe.serves));
      if (session && !resumed.current) {
        resumed.current = true;
        const version = recipe.variants.some((v) => v.id === session.variant_id && v.kind === 'version') ? session.variant_id : null;
        const next = { ...start, servings: Math.min(session.servings, servingsMax(recipe.serves)), version, scaledBy: null };
        setChoices(next);
        void writeChoices(storage, userId, recipe.id, next);
        return;
      }
      setChoices(start);
    });
    return () => {
      live = false;
    };
    // The recipe page set these, or a sheet opened from the options; a live edit to the recipe re-validates them below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId, recipe.id, visit]);

  // A variant deleted while cooking no longer counts.
  const current = useMemo(() => (choices ? startingChoices(choices, recipe, servingsMax(recipe.serves)) : null), [choices, recipe]);
  if (!current) return <CookLoading bar={bar} />;
  const update = (next: RecipeChoices) => {
    setChoices(next);
    void writeChoices(storage, userId, recipe.id, next);
  };
  return <Cooking {...props} choices={current} onChoices={update} />;
}

function Cooking({
  recipe,
  choices,
  onChoices,
  tracker,
  stepId,
  onClose,
  onOpenTimers,
  onScaleByIngredient,
  onConvert,
  onEditStep,
  session,
  onStep,
  onDone,
  cooking: settingsInForce = defaultCooking,
  now = Date.now,
}: LoadedProps & { choices: RecipeChoices; onChoices: (next: RecipeChoices) => void }) {
  // The recipe page's units, kitchen scale and scale by an ingredient too (013, 032-later L22).
  // Spec 051: the units picked on this visit (here or on the recipe page under it).
  const [visitUnits, setVisitUnits] = useVisitUnits(recipe.id);
  const cooking = useMemo(() => (visitUnits ? { ...settingsInForce, system: visitUnits } : settingsInForce), [settingsInForce, visitUnits]);
  const view = useMemo(() => recipeView(recipe, choices, choices, formatOf(choices, cooking), cooking), [recipe, choices, cooking]);
  const steps = view.steps;
  const count = steps.length;
  // Events cap step counts (variants can add steps on top of a recipe's 100).
  const sent = (n: number) => Math.min(n, MAX_TRACKED_STEPS);
  // "Screen stays on" in the options sheet, for this visit; it starts from the setting (spec 027).
  const [keepAwake, setKeepAwake] = useState(cooking.keepAwake);
  // The setting can arrive after the recipe (the family's load) or change live: follow it.
  const [awakeSetting, setAwakeSetting] = useState(cooking.keepAwake);
  if (awakeSetting !== cooking.keepAwake) {
    setAwakeSetting(cooking.keepAwake);
    setKeepAwake(cooking.keepAwake);
  }
  const awake = useCookAwake(keepAwake);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsButton = useRef<HostInstance>(null);
  const hasPill = useHasTimers();

  const scroller = useRef<ScrollViewInstance>(null);
  // Reduce Motion: steps jump instead of gliding (spec 030 FR-004).
  const reduceMotion = useReduceMotion();
  const scrollTo = useCallback((y: number, animated: boolean) => scroller.current?.scrollTo({ y, animated: animated && !reduceMotion }), [reduceMotion]);
  const [initial] = useState(() => (stepId || !session ? startIndex(steps.map((s) => s.id), stepId) : Math.min(session.current_step, Math.max(count - 1, 0))));
  const { current, onStepLayout, onViewport, onScroll, jump: scrollToStep, snaps, tall } = useStepScroll(count, initial, scrollTo);
  // Next, Back and the segments say where they landed: the scroll alone is silent (spec 030).
  const jump = (i: number) => {
    scrollToStep(i);
    const to = Math.min(Math.max(i, 0), count - 1);
    announce(c.stepAnnouncement(to + 1, count, steps[to]?.name ?? null));
  };

  // Once per visit; `minutes` counts from here.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (startedAt.current !== null || count === 0) return;
    startedAt.current = now();
    tracker.track('cooking_started', { step_count: sent(count) });
  }, [count, now, tracker]);

  const at = Math.min(current, Math.max(count - 1, 0));
  const last = at === count - 1;
  // FR-002: the route saves the step to the cook.
  useEffect(() => {
    if (count > 0) onStep?.(at);
  }, [at, count, onStep]);

  // Closes once, whatever re-renders meanwhile. Leaving any other way (the system or browser back)
  // still counts as exiting, at the step it was on.
  const closed = useRef(false);
  const exitedAt = useRef({ at, count });
  useEffect(() => {
    exitedAt.current = { at, count };
  }, [at, count]);
  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }, [onClose]);
  useEffect(
    () => () => {
      const { at: step, count: total } = exitedAt.current;
      if (!closed.current && total > 0) tracker.track('cooking_exited', { at_step: Math.min(step + 1, MAX_TRACKED_STEPS), step_count: Math.min(total, MAX_TRACKED_STEPS) });
    },
    [tracker],
  );

  // Nothing to cook: straight back to the recipe.
  useEffect(() => {
    if (count === 0) close();
  }, [count, close]);
  if (count === 0) return null;

  const exit = () => {
    if (closed.current) return;
    tracker.track('cooking_exited', { at_step: sent(at + 1), step_count: sent(count) });
    close();
  };
  // "Done cooking" logs the cook and opens the Done sheet (spec 051 FR-005; decision 21).
  const next = () => {
    if (!last) return jump(at + 1);
    if (closed.current) return;
    closed.current = true;
    onDone();
  };

  // The options' sheets open over cooking mode and come back to it.
  const openSheet = (open: () => void) => () => {
    setOptionsOpen(false);
    open();
  };

  return (
    <>
    <CookLayout
      exitLabel={c.exitA11y}
      onExit={exit}
      status={hasPill ? <AppTimerPill onOpen={onOpenTimers} tracker={tracker} compact /> : null}
      optionsLabel={c.options}
      onOptions={() => setOptionsOpen(true)}
      optionsRef={optionsButton}
      progress={
        <CookProgress
          count={count}
          current={at}
          onSelect={jump}
          stepLabel={c.stepOf(at + 1, count)}
          hint={c.hint(servingsText(view.servings))}
          segmentLabel={(i) => c.segment(i + 1, steps[i]?.name ?? null)}
        />
      }
      endLabel={c.bonAppetit}
      // Back always reads "Back" (spec 051); on the first step it leaves, as ✕ does, and the cook stays in progress.
      backLabel={c.back}
      backExits={false}
      onBack={() => (at > 0 ? jump(at - 1) : exit())}
      nextLabel={last ? c.doneCooking : c.next}
      nextFinishes={false}
      onNext={next}
      scrollRef={scroller}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y, e.nativeEvent.layoutMeasurement.height)}
      onViewportLayout={onViewport}
      snapOffsets={snaps}
    >
      {steps.map((step, i) => (
        <CookSection
          key={step.id}
          testID={`cook-step-${i}`}
          title={step.name ?? undefined}
          current={i === at}
          onLayout={(e) => onStepLayout(i, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
          snapEnd={tall[i]}
        >
          <StepText parts={step.parts} cook />
          {step.timer ? <CookTimer stepId={step.id} index={i} recipeId={recipe.id} recipeName={recipe.name} timer={step.timer} tracker={tracker} /> : null}
          {step.tempCheck ? <Callout variant="temp" label={p.steps.tempLabel} text={step.tempCheck} cook /> : null}
          {step.tip ? <Callout variant="tip" label={p.steps.tipLabel} text={step.tip} cook /> : null}
        </CookSection>
      ))}
    </CookLayout>
    {/* Mounted only while open (a closed react-native-web Modal can still catch taps). */}
    <BottomSheet
      visible={optionsOpen}
      returnFocusRef={optionsButton}
      onClose={() => setOptionsOpen(false)}
      title={c.options}
      closeLabel={c.closeOptions}
    >
      {/* One list: the sheet's gap would space the rows apart. */}
      <View>
        <SettingRow
          label={c.awake}
          hint={awake === 'unsupported' ? c.awakeUnsupported : keepAwake ? c.awakeOnHint : c.awakeOffHint}
          value={keepAwake}
          onValueChange={(on) => {
            setKeepAwake(on);
            tracker.track('cook_screen_awake_toggled', { on });
          }}
        />
        <ListRow
          flush
          title={c.editStep(at + 1)}
          trailing={{ kind: 'chevron' }}
          onPress={() => {
            const step = steps[at];
            if (!step) return;
            setOptionsOpen(false);
            onEditStep(stepEditTarget(recipe, choices, step.id));
          }}
        />
        <MoreOptions
          choices={choices}
          settings={cooking}
          tracker={tracker}
          onChange={onChoices}
          onScaleByIngredient={openSheet(onScaleByIngredient)}
          onConvert={openSheet(onConvert)}
          onUnits={setVisitUnits}
        />
      </View>
    </BottomSheet>
    </>
  );
}

const actionLabel = { idle: c.startTimer, running: c.pause, paused: c.resume, done: c.done } as const;

function CookTimer(props: StepTimerInput) {
  const t = useStepTimerControl(props);
  const copy = strings.recipePage.steps;
  return (
    <CookTimerCard
      label={c.timerLabel(props.timer.label)}
      clock={t.clock}
      actionLabel={actionLabel[t.state]}
      onAction={t.onPress}
      minusLabel={copy.minus}
      plusLabel={copy.plus}
      minusA11y={copy.minusA11y}
      plusA11y={copy.plusA11y}
      onMinus={t.onMinus}
      onPlus={t.onPlus}
    />
  );
}
