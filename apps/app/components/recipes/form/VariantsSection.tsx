import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { amountInput, type QuantityIngredient } from '@cocon/quantity';
import type { IngredientFacts } from '@cocon/schemas';
import { Button, Card, Dialog, Icon, IngredientEditCard, Link, ListRow, SegmentedControl, Tag, Text, TextField, type IngredientEditField } from '@cocon/ui';
import { strings } from '../../../strings/en';
import {
  applyMatch,
  emptyDraft,
  matchIngredients,
  quantityOf,
  sizesOf,
  suggestIngredients,
  withName,
  withUnit,
  type FormFacts,
  type IngredientDraft,
  type IngredientWarning,
} from '../../../lib/recipe-ingredients';
import { segmentsOf, shownText, type StepDraft } from '../../../lib/recipe-steps';
import {
  CHANGE_TYPES,
  changeSummary,
  changeTag,
  draftBroken,
  draftConflicts,
  newChange,
  pickChangeStep,
  previewChange,
  type ChangeDraft,
  type ChangeType,
  type SummaryBase,
  type VariantDraft,
  type VariantWarnings,
} from '../../../lib/recipe-variants';
import type { Client } from '../../../lib/supabase';
import { UnitSheet, unitText } from './IngredientSheets';
import { StepFieldsEditor } from './StepsSection';

const v = strings.recipeForm.variants;
const ing = strings.recipeForm.ingredients;
const st = strings.recipeForm.steps;

const fieldOf: Record<IngredientWarning, IngredientEditField> = {
  unitMissing: 'unit',
  quantityInvalid: 'quantity',
  amountMissing: 'quantity',
  weightInvalid: 'weight',
  nameMissing: 'name',
};

export interface VariantsSectionProps {
  variants: VariantDraft[];
  warnings: VariantWarnings;
  /** The recipe's ingredient rows and steps as they are in the form now (what changes point at). */
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  /** Names of ingredients the recipe had when the form opened, for step previews. */
  knownNames: ReadonlyMap<string, string>;
  /** The one expanded variant. */
  open: string | null;
  onOpen: (key: string | null) => void;
  onChange: (key: string, change: (d: VariantDraft) => VariantDraft) => void;
  onAdd: () => void;
  /** False at MAX_VARIANTS: "+ New variant" goes. */
  canAdd: boolean;
  onDelete: (key: string) => void;
  /** For the catalog's suggestions and matching (spec 031; 032-later L11). */
  client: Pick<Client, 'rpc'>;
  newId: () => string;
  onSectionLayout: (y: number) => void;
  /** Where each variant sits in the section, so Save can bring a warned one into view. */
  onVariantLayout: (key: string, y: number) => void;
}

const isBlankRow = (d: IngredientDraft) => !d.name.trim() && !d.quantity.trim() && !d.weight.trim();
const named = (rows: IngredientDraft[]) => rows.filter((d) => d.name.trim());

/** What a variant's own rows bring in, by change. */
function rowsOf(c: ChangeDraft): IngredientDraft[] {
  return c.type === 'swap_ingredient' ? c.with : c.type === 'add_ingredient' ? [c.ingredient] : [];
}

/** The Variants section of the recipe form (spec 017, OC-EditVariants › Layout), in the screen's order. */
export function VariantsSection(p: VariantsSectionProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [unitFor, setUnitFor] = useState<{ variant: string; change: string; row: string } | null>(null);
  const [deleteAsk, setDeleteAsk] = useState<string | null>(null);
  const [focused, setFocused] = useState<{ variant: string; change: string; row: string } | null>(null);
  const [suggestions, setSuggestions] = useState<{ row: string; items: IngredientFacts[] } | null>(null);
  const variantsRef = useRef(p.variants);
  useEffect(() => {
    variantsRef.current = p.variants;
  }, [p.variants]);

  const baseIngredients = named(p.ingredients);
  const baseSteps = p.steps.filter((d) => d.body.trim() || d.name.trim());
  const allRows = [...baseIngredients, ...p.variants.flatMap((d) => d.changes.flatMap(rowsOf))];
  const names = new Map<string, string>([...p.knownNames, ...named(allRows).map((d) => [d.id, d.name.trim()] as const)]);
  const facts = new Map<string, FormFacts>(allRows.flatMap((d) => (d.catalogKey && d.facts ? [[d.catalogKey, d.facts] as const] : [])));
  const summaryBase: SummaryBase = {
    ingredients: baseIngredients.map((d) => ({ id: d.id, name: d.name.trim() })),
    steps: baseSteps.map((d) => ({ id: d.id, name: d.name, body: d.body })),
    names,
    facts: (key) => facts.get(key),
  };
  const conflicts = draftConflicts(p.variants, baseSteps);

  // Typeahead (spec 031), as on the Ingredients section: the focused row's name, after a short pause.
  const focusedRow = focused ? p.variants.find((d) => d.key === focused.variant)?.changes.find((c) => c.key === focused.change) : undefined;
  const focusedDraft = focusedRow ? rowsOf(focusedRow).find((r) => r.key === focused?.row) : undefined;
  const focusedName = focusedDraft?.name ?? '';
  const focusedLinked = focusedDraft?.catalogKey != null;
  const focusedKey = focused?.row ?? null;
  useEffect(() => {
    if (!focusedKey || focusedName.trim().length < 2 || focusedLinked) return;
    let alive = true;
    const timer = setTimeout(() => {
      void suggestIngredients(p.client, focusedName).then((items) => {
        if (alive) setSuggestions({ row: focusedKey, items });
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [p.client, focusedKey, focusedName, focusedLinked]);

  const updateChange = (variant: string, change: string, fn: (c: ChangeDraft) => ChangeDraft) =>
    p.onChange(variant, (d) => ({ ...d, changes: d.changes.map((c) => (c.key === change ? { ...fn(c), edited: true } : c)) }));

  const updateRow = (variant: string, change: string, row: string, fn: (r: IngredientDraft) => IngredientDraft) =>
    updateChange(variant, change, (c) => {
      if (c.type === 'swap_ingredient') return { ...c, with: c.with.map((r) => (r.key === row ? fn(r) : r)) };
      if (c.type === 'add_ingredient' && c.ingredient.key === row) return { ...c, ingredient: fn(c.ingredient) };
      return c;
    });

  /** Variant rows learn what the catalog knows about their name (032-later L11); they never ask for an aisle. */
  const match = async (variant: string, change: string, row: IngredientDraft) => {
    const found = await matchIngredients(p.client, [row.name]);
    if (!found) return;
    const current = variantsRef.current.find((d) => d.key === variant)?.changes.find((c) => c.key === change);
    const now = current ? rowsOf(current).find((r) => r.key === row.key) : undefined;
    if (!now || now.name !== row.name || now.catalogKey !== null) return;
    updateRow(variant, change, row.key, (r) => ({ ...applyMatch(r, found[0] ?? null), isNew: false, newAisle: null }));
  };

  const addChange = (variant: string, type: ChangeType) => {
    const change = newChange(type, p.newId);
    p.onChange(variant, (d) => ({ ...d, changes: [...d.changes, change] }));
    setEditing(change.key);
  };

  const removeChange = (variant: string, change: string) => {
    p.onChange(variant, (d) => ({ ...d, changes: d.changes.filter((c) => c.key !== change) }));
    setEditing((k) => (k === change ? null : k));
  };

  /** Done: a change with nothing picked and nothing typed goes. */
  const finish = (variant: string, c: ChangeDraft) => {
    const empty = previewChange(c, baseSteps) === null && rowsOf(c).every(isBlankRow) && !('step' in c && c.step.body.trim());
    if (empty) removeChange(variant, c.key);
    else setEditing(null);
  };

  const unitRow = unitFor
    ? (() => {
        const c = p.variants.find((d) => d.key === unitFor.variant)?.changes.find((x) => x.key === unitFor.change);
        return c ? rowsOf(c).find((r) => r.key === unitFor.row) : undefined;
      })()
    : undefined;

  return (
    <View className="gap-12" onLayout={(e) => p.onSectionLayout(e.nativeEvent.layout.y)}>
      <Text size={24} weight="900" role="heading" aria-level={1}>
        {v.title}{' '}
        <Text size={15} weight="600" color="ink-muted">
          {v.optional}
        </Text>
      </Text>
      <Text size={14} weight="600" color="ink-muted">
        {v.lead}
      </Text>

      {p.variants.map((d) => {
        const warned = p.warnings[d.key];
        const count = v.changeCount(d.changes.length);
        if (p.open !== d.key) {
          return (
            <View key={d.key} onLayout={(e) => p.onVariantLayout(d.key, e.nativeEvent.layout.y)}>
              <Card onPress={() => p.onOpen(d.key)} accessibilityLabel={v.open(d.name.trim(), count)} attention={warned !== undefined} className="px-14 py-12">
                <View className="flex-row items-center gap-10">
                  <Text size={16} weight="800" className="flex-1" numberOfLines={1}>
                    {d.name.trim()}
                  </Text>
                  <Text size={13} weight="700" color="ink-muted">
                    {count}
                  </Text>
                  <Icon name="chevron-right" size={18} color="inkMuted" />
                </View>
              </Card>
            </View>
          );
        }
        const broken = draftBroken(d, { ingredients: baseIngredients, steps: baseSteps }, baseSteps);
        // What "@" offers in this variant's steps: the base rows, less what it swaps or removes, plus what it brings in.
        const gone = new Set(d.changes.flatMap((c) => (c.type === 'swap_ingredient' || c.type === 'remove_ingredient') && c.ingredientId ? [c.ingredientId] : []));
        const own = named(d.changes.flatMap(rowsOf));
        const stepIngredients: QuantityIngredient[] = [...baseIngredients.filter((r) => !gone.has(r.id)), ...own].map(quantityOf);
        return (
          <View key={d.key} onLayout={(e) => p.onVariantLayout(d.key, e.nativeEvent.layout.y)}>
            <Card selected className="p-14">
              <TextField
                label={v.name}
                value={d.name}
                maxLength={40}
                placeholder={v.namePlaceholder}
                onChangeText={(name) => p.onChange(d.key, (x) => ({ ...x, name }))}
                warning={warned?.name ? v.warnings.nameMissing : undefined}
              />
              <View className="gap-6">
                <Text size={13} weight="800">
                  {v.shownAs}
                </Text>
                <SegmentedControl
                  label={v.shownAs}
                  value={d.kind}
                  segments={[
                    { key: 'version', label: v.version },
                    { key: 'option', label: v.option },
                  ]}
                  onChange={(kind) => p.onChange(d.key, (x) => ({ ...x, kind }))}
                />
              </View>

              {d.changes.length > 0 ? (
                <Text size={14} weight="900">
                  {v.whatChanges}
                </Text>
              ) : null}
              {d.changes.map((c) => {
                const change = previewChange(c, baseSteps);
                const others = conflicts[d.key]?.[c.key] ?? [];
                const warning = warned?.change[c.key];
                const isBroken = broken.has(c.key);
                if (editing === c.key) {
                  return (
                    <ChangeEditor
                      key={c.key}
                      change={c}
                      title={change ? changeTag(change, summaryBase).label : v.add[c.type]}
                      variantKey={d.key}
                      ingredients={baseIngredients}
                      steps={baseSteps}
                      names={names}
                      stepIngredients={stepIngredients}
                      own={own}
                      knownNames={p.knownNames}
                      warnings={warned}
                      warning={warning ? v.changeWarnings[warning] : undefined}
                      suggestions={suggestions}
                      onUpdate={(fn) => updateChange(d.key, c.key, fn)}
                      onUpdateRow={(row, fn) => updateRow(d.key, c.key, row, fn)}
                      onFocusRow={(row) => setFocused({ variant: d.key, change: c.key, row })}
                      onBlurRow={(row) => {
                        setTimeout(() => {
                          setFocused((f) => (f?.row === row.key ? null : f));
                          setSuggestions((s) => (s?.row === row.key ? null : s));
                        }, 200);
                        if (row.name.trim() && row.catalogKey === null) void match(d.key, c.key, row);
                      }}
                      onPickSuggestion={(row, item) => {
                        updateRow(d.key, c.key, row, (r) => ({ ...applyMatch(r, item, true), isNew: false, newAisle: null }));
                        setSuggestions(null);
                      }}
                      onOpenUnit={(row) => setUnitFor({ variant: d.key, change: c.key, row })}
                      newId={p.newId}
                      onDone={() => finish(d.key, c)}
                      onRemove={() => removeChange(d.key, c.key)}
                    />
                  );
                }
                const tag = change ? changeTag(change, summaryBase) : { label: v.add[c.type], tone: 'sage' as const };
                const summary = change ? changeSummary(change, summaryBase) : { struck: null, text: v.nothingYet };
                return (
                  <View key={c.key} className="gap-6">
                    <Card tone="soft" onPress={() => setEditing(c.key)} accessibilityLabel={v.editChange(tag.label)} attention={warning !== undefined || isBroken} className="gap-6 rounded-lg p-12">
                      <Tag label={tag.label} tone={tag.tone} className="self-start" />
                      <Text size={15} weight="700">
                        {summary.struck ? (
                          <Text size={15} weight="700" color="ink-muted" strike>
                            {summary.struck}
                          </Text>
                        ) : null}
                        {summary.struck && summary.text ? ' → ' : ''}
                        {summary.text}
                      </Text>
                    </Card>
                    {others.map((name) => (
                      <Text key={name} size={14} weight="700" color="warn">
                        {v.conflict(name)}
                      </Text>
                    ))}
                    {isBroken ? (
                      <View className="flex-row flex-wrap items-center gap-x-8">
                        <Text size={14} weight="700" color="warn" className="flex-1">
                          {v.broken}
                        </Text>
                        <Link label={v.removeChange} onPress={() => removeChange(d.key, c.key)} />
                      </View>
                    ) : null}
                    {warning ? (
                      <Text size={14} weight="700" color="warn">
                        {v.changeWarnings[warning]}
                      </Text>
                    ) : null}
                  </View>
                );
              })}

              <Text size={13} weight="800" color="ink-muted">
                {v.addChange}
              </Text>
              <View className="gap-8">
                {[0, 2, 4].map((i) => (
                  <View key={i} className="flex-row gap-8">
                    {CHANGE_TYPES.slice(i, i + 2).map((type) => (
                      <Button key={type} label={v.add[type]} variant="tile" onPress={() => addChange(d.key, type)} className="flex-1" />
                    ))}
                  </View>
                ))}
              </View>
              {warned?.changes ? (
                <Text size={14} weight="700" color="warn">
                  {v.warnings.noChanges}
                </Text>
              ) : null}
              <Link label={v.deleteVariant} tone="danger" onPress={() => setDeleteAsk(d.key)} />
            </Card>
          </View>
        );
      })}

      {p.canAdd ? <Button label={v.newVariant} variant="dashed" block onPress={p.onAdd} /> : null}

      <UnitSheet
        visible={unitFor !== null}
        unit={unitRow?.unit ?? null}
        size={unitRow?.sizeWord ?? null}
        sizes={sizesOf(unitRow?.facts ?? null)}
        onPick={(unit, size) => {
          if (unitFor) updateRow(unitFor.variant, unitFor.change, unitFor.row, (r) => withUnit(r, unit, size));
          setUnitFor(null);
        }}
        onClose={() => setUnitFor(null)}
      />
      <Dialog
        visible={deleteAsk !== null}
        icon="warning"
        title={v.deleteTitle}
        body={v.deleteBody}
        confirmLabel={v.deleteConfirm}
        onConfirm={() => {
          if (deleteAsk) p.onDelete(deleteAsk);
          setDeleteAsk(null);
        }}
        cancelLabel={v.deleteCancel}
        onCancel={() => setDeleteAsk(null)}
      />
    </View>
  );
}

interface ChangeEditorProps {
  change: ChangeDraft;
  title: string;
  variantKey: string;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  names: ReadonlyMap<string, string>;
  stepIngredients: QuantityIngredient[];
  own: IngredientDraft[];
  knownNames: ReadonlyMap<string, string>;
  warnings: VariantWarnings[string] | undefined;
  warning: string | undefined;
  suggestions: { row: string; items: IngredientFacts[] } | null;
  onUpdate: (fn: (c: ChangeDraft) => ChangeDraft) => void;
  onUpdateRow: (row: string, fn: (r: IngredientDraft) => IngredientDraft) => void;
  onFocusRow: (row: string) => void;
  onBlurRow: (row: IngredientDraft) => void;
  onPickSuggestion: (row: string, item: IngredientFacts) => void;
  onOpenUnit: (row: string) => void;
  newId: () => string;
  onDone: () => void;
  onRemove: () => void;
}

const stepTitle = (d: StepDraft, names: ReadonlyMap<string, string>) => d.name.trim() || shownText(segmentsOf(d.body, names)).split('\n')[0]?.trim() || '';

/** One change, open: what it points at, then its rows or step (OC-EditVariants › Layout 3, "each opens an inline editor"). */
function ChangeEditor(p: ChangeEditorProps) {
  const c = p.change;
  const pickIngredient = (
    <Picker
      label={v.pickIngredient}
      empty={v.noIngredients}
      items={p.ingredients.map((d) => ({ id: d.id, title: d.name.trim() }))}
      value={'ingredientId' in c ? c.ingredientId : null}
      onPick={(id) => p.onUpdate((x) => ({ ...x, ingredientId: id }) as ChangeDraft)}
    />
  );
  const pickStep = (onPick: (id: string) => void) => (
    <Picker
      label={v.pickStep}
      empty={v.noSteps}
      items={p.steps.map((d, i) => ({ id: d.id, title: v.stepChoice(i + 1, stepTitle(d, p.names)) }))}
      value={'stepId' in c ? c.stepId : null}
      onPick={onPick}
    />
  );
  const rowCard = (r: IngredientDraft, removable: boolean) => {
    const w = p.warnings?.rows[r.key];
    const suggested = p.suggestions?.row === r.key ? p.suggestions.items : [];
    return (
      <IngredientEditCard
        key={r.key}
        name={r.name}
        onNameChange={(t) => p.onUpdateRow(r.key, (x) => withName(x, t))}
        nameLabel={ing.name}
        namePlaceholder={ing.namePlaceholder}
        onNameFocus={() => p.onFocusRow(r.key)}
        onNameBlur={() => p.onBlurRow(r)}
        quantity={r.quantity}
        onQuantityChange={(t) => p.onUpdateRow(r.key, (x) => ({ ...x, quantity: amountInput(t) }))}
        quantityLabel={ing.quantity}
        quantityPlaceholder={ing.quantityPlaceholder}
        unit={unitText(r.unit, r.sizeWord)}
        unitPlaceholder={w === 'unitMissing' ? ing.unitMissingButton : ing.unit}
        unitLabel={ing.unit}
        onUnitPress={() => p.onOpenUnit(r.key)}
        weight={
          r.unit === 'piece'
            ? { value: r.weight, onChange: (t) => p.onUpdateRow(r.key, (x) => ({ ...x, weight: amountInput(t, { fractions: false }) })), label: ing.weight, prefix: ing.each, suffix: ing.grams, placeholder: ing.weightPlaceholder }
            : null
        }
        removeLabel={ing.remove(r.name.trim())}
        onRemove={removable ? () => p.onUpdate((x) => (x.type === 'swap_ingredient' ? { ...x, with: x.with.filter((y) => y.key !== r.key) } : x)) : () => p.onUpdateRow(r.key, (x) => ({ ...emptyDraft(x.id), key: x.key }))}
        warning={w ? ing.warnings[w] : null}
        warningField={w ? fieldOf[w] : null}
      >
        {suggested.length > 0 ? (
          <View role="list" aria-label={ing.suggestions}>
            {suggested.map((s, i) => (
              <ListRow key={s.catalog_key ?? s.family_ingredient_id ?? s.name} title={s.name} flush last={i === suggested.length - 1} onPress={() => p.onPickSuggestion(r.key, s)} />
            ))}
          </View>
        ) : null}
      </IngredientEditCard>
    );
  };
  const stepEditor = (d: StepDraft, addOns: readonly ('timer' | 'temp' | 'tip')[], withName: boolean) => (
    <View className="gap-12">
      {withName ? (
        <TextField label={st.stepName} size="sm" value={d.name} maxLength={60} onChangeText={(name) => p.onUpdate((x) => ('step' in x ? ({ ...x, step: { ...x.step, name } } as ChangeDraft) : x))} />
      ) : null}
      <StepFieldsEditor
        draft={d}
        number={0}
        names={p.names}
        ingredients={p.stepIngredients}
        knownNames={p.knownNames}
        unused={p.own.filter((r) => !d.body.includes(`{ing:${r.id}}`)).map((r) => ({ id: r.id, name: r.name.trim() }))}
        warnings={p.warnings?.steps[d.key] ?? {}}
        onChange={(patch) => p.onUpdate((x) => ('step' in x ? ({ ...x, step: { ...x.step, ...patch } } as ChangeDraft) : x))}
        addOns={addOns}
      />
    </View>
  );

  return (
    <View className="gap-12 rounded-lg border-2 border-line-strong bg-surface-page p-12">
      <Text size={14} weight="900" role="heading" aria-level={2}>
        {p.title}
      </Text>
      {c.type === 'swap_ingredient' ? (
        <>
          {pickIngredient}
          <Text size={13} weight="800">
            {v.replaceWith}
          </Text>
          {c.with.map((r) => rowCard(r, c.with.length > 1))}
          <Button label={v.addAnother} variant="dashed" block onPress={() => p.onUpdate((x) => (x.type === 'swap_ingredient' ? { ...x, with: [...x.with, emptyDraft(p.newId())] } : x))} />
        </>
      ) : null}
      {c.type === 'add_ingredient' ? rowCard(c.ingredient, false) : null}
      {c.type === 'remove_ingredient' ? pickIngredient : null}
      {c.type === 'add_step' ? (
        <>
          <View className="gap-6">
            <Text size={13} weight="800">
              {v.where}
            </Text>
            <SegmentedControl
              variant="pill"
              label={v.where}
              value={c.place}
              segments={[
                { key: 'before', label: v.before },
                { key: 'after', label: v.after },
              ]}
              onChange={(place) => p.onUpdate((x) => (x.type === 'add_step' ? { ...x, place } : x))}
            />
          </View>
          {pickStep((id) => p.onUpdate((x) => (x.type === 'add_step' ? { ...x, stepId: id } : x)))}
          <Text size={13} weight="800">
            {v.newStep}
          </Text>
          {stepEditor(c.step, ['timer', 'temp', 'tip'], true)}
        </>
      ) : null}
      {c.type === 'change_step' ? (
        <>
          {pickStep((id) => {
            const base = p.steps.find((d) => d.id === id);
            if (base) p.onUpdate((x) => (x.type === 'change_step' ? pickChangeStep(x, base) : x));
          })}
          {c.stepId ? (
            <>
              <Text size={13} weight="800">
                {v.changedStep}
              </Text>
              {stepEditor(c.step, ['timer', 'temp'], false)}
            </>
          ) : null}
        </>
      ) : null}
      {c.type === 'remove_step' ? pickStep((id) => p.onUpdate((x) => (x.type === 'remove_step' ? { ...x, stepId: id } : x))) : null}
      {p.warning ? (
        <Text size={14} weight="700" color="warn">
          {p.warning}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-between gap-8">
        <Button label={v.done} variant="soft" size="sm" onPress={p.onDone} />
        <Link label={v.removeChange} tone="danger" onPress={p.onRemove} />
      </View>
    </View>
  );
}

/** Picks the ingredient or step a change points at: a radio list. */
function Picker({ label, empty, items, value, onPick }: { label: string; empty: string; items: { id: string; title: string }[]; value: string | null; onPick: (id: string) => void }) {
  return (
    <View className="gap-4">
      <Text size={13} weight="800">
        {label}
      </Text>
      {items.length === 0 ? (
        <Text size={14} weight="600" color="ink-muted">
          {empty}
        </Text>
      ) : (
        <View role="radiogroup" aria-label={label} className="rounded-md bg-surface-card px-12">
          {items.map((item, i) => (
            <ListRow key={item.id} title={item.title} flush last={i === items.length - 1} leading={{ kind: 'radio', checked: value === item.id }} onPress={() => onPick(item.id)} />
          ))}
        </View>
      )}
    </View>
  );
}
