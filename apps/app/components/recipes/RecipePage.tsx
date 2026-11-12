import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  Button,
  Card,
  Choice,
  CookSessionCard,
  IconButton,
  IngredientRow,
  Link,
  Meta,
  PhotoPlaceholder,
  Photo,
  PhotoScreen,
  TopBarHeading,
  PillRow,
  SegmentedControl,
  SettingRow,
  StatusBanner,
  StepRow,
  Stepper,
  Text,
} from '@cocon/ui';
import type { CookedSummary, Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { cookedLine, pageCard, stepTotal, type CookSession } from '../../lib/cook-sessions';
import { forgetVisitUnits, useVisitUnits } from '../../lib/visit-units';
import { readChoices, startingChoices, writeChoices, type ChoiceStorage, type RecipeChoices } from '../../lib/recipe-choices';
import { defaultCooking, formatOf, optionHint, recipeChips, recipeView, servingsMax, servingsText, SERVINGS_MIN, variantCount, type CookingSettings, type StepLine } from '../../lib/recipe-view';
import type { PhotoUrls } from '../../lib/recipe-photo';
import type { Member } from '../../lib/session';
import { AppTimerPill } from '../timers/AppTimerPill';
import { MoreOptions } from './MoreOptions';
import { OfflineBanner } from '../sync/OfflineBanner';
import { useOnline } from '../../lib/online';

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
  /** The pencil (spec 051 FR-012): the recipe form's Details. */
  onEdit: () => void;
  onAddToGroceries: () => void;
  /** "Start recipe" (FR-002). */
  onStart: () => void;
  /** The family's cook of this recipe in progress, if any (FR-004). */
  cook?: CookSession | null;
  /** How often it was cooked (FR-005). */
  cooked?: CookedSummary | null;
  /** The card's and the main button's Resume. */
  onCookResume: () => void;
  /** The card's Done, and the main button on the cook's last step. */
  onCookDone: () => void;
  onCookCancel: () => void;
  /** The member's clock (spec 029): "18:40" or "6:40 PM". */
  use24h?: boolean;
  now?: () => Date;
  /** A step in the Steps tab opens cooking mode at that step. */
  onOpenStep: (stepId: string) => void;
  /** The TimerPill opens the Timers screen (spec 011). */
  onOpenTimers: () => void;
  /** The recipe's settings in force (spec 027): units, kitchen scale and thermometer checks. */
  cooking?: CookingSettings;
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
  const back = { label: p.back, onPress: onBack };

  if (recipe === undefined && !failed) {
    return (
      <PhotoScreen photo={<PhotoPlaceholder className="h-full" />} topBar={{ back }}>
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
      <PhotoScreen photo={<PhotoPlaceholder className="h-full" />} topBar={{ back }}>
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
  onEdit,
  onAddToGroceries,
  onStart,
  cook = null,
  cooked = null,
  onCookResume,
  onCookDone,
  onCookCancel,
  use24h = true,
  now = () => new Date(),
  onOpenStep,
  onOpenTimers,
  cooking: settingsInForce = defaultCooking,
  onScaleByIngredient,
  onConvert,
  visit = 0,
  photoUrls = {},
}: RecipePageProps & { recipe: RecipeDetail }) {
  const max = servingsMax(recipe.serves);
  // Spec 051: Metric · Imperial in "…" holds for this visit only; closing the page forgets it.
  const [visitUnits, setVisitUnits] = useVisitUnits(recipe.id);
  useEffect(() => () => forgetVisitUnits(recipe.id), [recipe.id]);
  const cooking = useMemo(() => (visitUnits ? { ...settingsInForce, system: visitUnits } : settingsInForce), [settingsInForce, visitUnits]);
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
    () => (current ? recipeView(recipe, current, current, formatOf(current, cooking), cooking) : null),
    [recipe, current, cooking],
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
  const online = useOnline();
  // Spec 051: the cook in progress, how often it was cooked, and what the main button does.
  const at = now();
  const total = cook ? stepTotal(view?.stepCount ?? 0, cook) : 0;
  const card = cook ? pageCard(cook, recipe, total, members, at, use24h) : null;
  const cookedText = cookedLine(cooked, members, at);
  const main = !cook
    ? { label: p.startRecipe, onPress: onStart }
    : cook.current_step >= total - 1
      ? { label: p.doneCooking, onPress: onCookDone }
      : { label: p.resumeAt(cook.current_step + 1), onPress: onCookResume };
  return (
    <PhotoScreen
      photo={
        headerPhoto ? (
          <Photo uri={headerPhoto} label={p.photo(recipe.name)} />
        ) : (
          <PhotoPlaceholder initial={recipe.name.charAt(0).toUpperCase()} className="h-full" />
        )
      }
      topBar={{
        back: { label: p.back, onPress: onBack },
        title: recipe.name,
        titleMode: 'onScroll',
        actions: [
          <IconButton key="share" variant="round" icon="share" label={p.share} onPress={onShare} />,
          <IconButton key="edit" variant="round" icon="edit" label={p.edit} onPress={onEdit} />,
        ],
      }}
      floating={<AppTimerPill onOpen={onOpenTimers} tracker={tracker} />}
      footer={<ActionBar onAddToGroceries={onAddToGroceries} main={main} />}
      banner={
        <>
          <OfflineBanner screen="recipe" tracker={tracker} />
          {deletedBy ? <StatusBanner tone="warn" message={p.deleted(deletedBy)} actionLabel={p.back} onAction={onBack} /> : null}
        </>
      }
    >
      <View>
        <TopBarHeading>
          <Text variant="displayLg" role="heading" aria-level={1}>
            {recipe.name}
          </Text>
        </TopBarHeading>
        {recipe.description ? (
          <Text variant="body" color="ink-muted" className="mt-6">
            {recipe.description}
          </Text>
        ) : null}
        <PillRow className="mt-12">
          {chips.facts.map((chip) => (
            <Meta key={chip} label={chip} />
          ))}
          <Meta label={chips.source} icon="book" accessibilityLabel={p.sourceA11y(chips.source)} tone="sage" />
        </PillRow>
        {cookedText ? (
          <Text size={13} weight="700" color="ink-muted" className="mt-10">
            {cookedText}
          </Text>
        ) : null}
        {cook && card ? (
          <View className="mt-14">
            <CookSessionCard
              variant="page"
              title={card.title}
              line={card.line}
              labels={{ cancel: p.cancel, done: p.done, resume: p.resume }}
              disabled={!online}
              onCancel={onCookCancel}
              onDone={onCookDone}
              onResume={onCookResume}
            />
          </View>
        ) : null}
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
              announcement={p.servingsAnnouncement(scaledName ? servingsText(shown) : String(shown))}
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
          <MoreOptions choices={current} settings={cooking} tracker={tracker} onChange={update} onScaleByIngredient={onScaleByIngredient} onConvert={onConvert} onUnits={setVisitUnits} />
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
                    detail={ing.detail}
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
                    accessibilityLabel={p.openStep(step.number, step.name ?? stepText(step), step.timer?.clock)}
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

/** From this width the cart shows its label (FR-014, OC-RecipeWide). */
export const WIDE_ACTIONS = 430;

/**
 * The action bar (spec 051 FR-014, OC-Recipe): the 60 cart, icon only below 430 wide, then the
 * main ink button with a play icon filling the rest. On both tabs.
 */
function ActionBar({ onAddToGroceries, main }: { onAddToGroceries: () => void; main: { label: string; onPress: () => void } }) {
  const wide = useWindowDimensions().width >= WIDE_ACTIONS;
  return (
    <View className="flex-row gap-10">
      {wide ? (
        <Button label={p.addToGroceries} icon="groceries" variant="outline" size="lg" onPress={onAddToGroceries} />
      ) : (
        <IconButton icon="groceries" variant="outline" label={p.addToGroceries} onPress={onAddToGroceries} />
      )}
      <Button label={main.label} icon="play" variant="ink" size="lg" block className="flex-1" onPress={main.onPress} />
    </View>
  );
}

/** A step with no name is listed by its text. */
function stepText(step: StepLine): string {
  return step.parts.map((part) => (typeof part === 'string' ? part : 'amount' in part ? part.amount : part.missing)).join('').trim();
}
