import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { parsePastedList } from '@cocon/quantity';
import { Button, Callout, Dialog, FormBar, FormProgress, FormScreen, Link, PhotoCrop, type CropRect } from '@cocon/ui';
import { MAX_VARIANTS, type IngredientFacts, type RecipeFormSection, type Tracker } from '@cocon/schemas';
import { strings } from '../../../strings/en';
import { useOnline } from '../../../lib/online';
import type { ChoiceStorage } from '../../../lib/recipe-choices';
import {
  DEFAULT_SERVES,
  FORM_SECTIONS,
  formFromRecipe,
  isDirty,
  nextSection,
  readAdvanced,
  readDetails,
  saveRecipe,
  variantStepPhotos,
  writeAdvanced,
  type DetailsField,
  type DetailsForm,
  type DetailsWarnings,
  type RecipeDetails,
} from '../../../lib/recipe-form';
import {
  applyMatch,
  draftFromParsed,
  draftsFromRows,
  emptyDraft,
  ingredientsChanged,
  matchIngredients,
  quantityOf,
  readIngredients,
  sizesOf,
  stepsUsing,
  suggestIngredients,
  withName,
  withUnit,
  type IngredientDraft,
  type IngredientWarning,
} from '../../../lib/recipe-ingredients';
import { deleteRecipe } from '../../../lib/recipe-delete';
import * as photoIO from '../../../lib/recipe-photo';
import {
  addedStepEvents,
  draftsFromSteps,
  emptyStep,
  isBlankStep,
  readSteps,
  removeTokens,
  stepsChanged,
  type StepDraft,
  type StepSaveRow,
  type StepWarnings,
} from '../../../lib/recipe-steps';
import type { Client } from '../../../lib/supabase';
import { createdVariantEvents, draftsFromVariants, emptyVariant, readVariants, variantsChanged, type VariantDraft, type VariantSaveRow, type VariantWarnings } from '../../../lib/recipe-variants';
import { OfflineBanner } from '../../sync/OfflineBanner';
import { CuisineSheet } from './CuisineSheet';
import { DetailsSection } from './DetailsSection';
import { AisleSheet, PasteSheet, UnitSheet } from './IngredientSheets';
import { IngredientsSection } from './IngredientsSection';
import { StepsSection } from './StepsSection';
import { VariantsSection } from './VariantsSection';

const f = strings.recipeForm;

/** Picking, preparing and storing photos; tests pass fakes. */
export type PhotoIO = Pick<typeof photoIO, 'pickPhoto' | 'preparePhoto' | 'uploadPhoto' | 'removePhotos' | 'newPhotoPath'>;

export interface RecipeFormProps {
  /** A new recipe's id is made by the route, so its photo can be stored under it before Save. */
  recipeId: string;
  /** Null for a new recipe. */
  recipe: RecipeDetails | null;
  familyId: string;
  userId: string;
  section: RecipeFormSection;
  onSectionChange: (section: RecipeFormSection) => void;
  client: Pick<Client, 'from' | 'storage' | 'rpc'>;
  tracker: Tracker;
  storage: ChoiceStorage;
  photos?: PhotoIO;
  /** Cancel, or Discard: back to where the form was opened. */
  onClose: () => void;
  /** Saved: a new recipe opens; an edit goes back to it. */
  onSaved: () => void;
  /** Spec 018: the recipe was deleted ("Delete this recipe", edit mode only). */
  onDeleted?: () => void;
  /** Ids for added ingredients, steps and variants; tests pass their own. */
  newId?: () => string;
  /** Spec 017: the variant to open in Variants (from recipe settings), or "new" to start one. */
  openVariant?: string;
}

/** What the photo is doing between picking and Save. */
interface PhotoWork {
  /** The cropped photo on this device, shown until Save (no signed link needed). */
  preview: string | null;
  uploading: boolean;
  /** Kept for Retry after a failed upload, with the cropped photo it would show. */
  failed: { path: string; bytes: Uint8Array; preview: string | null } | null;
  denied: boolean;
}
const idle: PhotoWork = { preview: null, uploading: false, failed: null, denied: false };

const ing = f.ingredients;

/** "For {n} servings" from what's typed in Serves (FR-004), or the default while it isn't a number. */
function servingsOf(text: string): number {
  const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
  return n >= 1 && n <= 50 ? n : DEFAULT_SERVES;
}

/** The warnings without one row's. */
const without = <T,>(warnings: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(warnings).filter(([k]) => k !== key));

/** Where a photo being picked goes: the recipe's header, or a step (by its key). */
type PhotoTarget = 'recipe' | { step: string };

/** The order Save looks for the first warned field to scroll to. */
const fieldOrder: DetailsField[] = ['name', 'serves', 'totalTime', 'prepTime'];

/**
 * The recipe form (spec 014, OC-EditBasics): the form bar, Progress over the four sections, the
 * section, and "Next: …". Details is built here, Ingredients (015), Steps (016) and Variants (017)
 * in their sections.
 */
export function RecipeForm({
  recipeId,
  recipe,
  familyId,
  userId,
  section,
  onSectionChange,
  client,
  tracker,
  storage,
  photos = photoIO,
  onClose,
  onSaved,
  onDeleted,
  newId = randomUUID,
  openVariant,
}: RecipeFormProps) {
  const isNew = recipe === null;
  const online = useOnline();
  const queryClient = useQueryClient();
  const [start] = useState(() => formFromRecipe(recipe));
  const [form, setForm] = useState<DetailsForm>(start);
  const [warnings, setWarnings] = useState<DetailsWarnings>({});
  const [advanced, setAdvanced] = useState(false);
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Spec 018: the OC-Delete dialog, and whether deleting failed.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [crop, setCrop] = useState<(photoIO.PickedPhoto & { target: PhotoTarget }) | null>(null);
  const [photo, setPhoto] = useState<PhotoWork>(idle);
  // Spec 016: each step's photo work, by step key.
  const [stepPhotos, setStepPhotos] = useState<Record<string, PhotoWork>>({});
  // Photos stored during this visit: whichever isn't kept is removed when the form closes.
  const uploaded = useRef<string[]>([]);
  const scroll = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<DetailsField, number>>>({});
  const [scrollTo, setScrollTo] = useState<DetailsField | null>(null);
  // Spec 015: the ingredient rows and what's open over them.
  const [startIngredients] = useState(() => draftsFromRows(recipe?.ingredients ?? [], recipe?.facts ?? {}));
  // A new recipe opens with one empty row, so it's clear where to type; left empty, Save drops it.
  const [drafts, setDrafts] = useState<IngredientDraft[]>(() => (recipe ? startIngredients : [emptyDraft(newId())]));
  const [ingWarnings, setIngWarnings] = useState<Record<string, IngredientWarning>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ key: string; items: IngredientFacts[] } | null>(null);
  const [unitFor, setUnitFor] = useState<string | null>(null);
  const [aisleFor, setAisleFor] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [removeAsk, setRemoveAsk] = useState<{ key: string; name: string; steps: number[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  // A new recipe whose details saved but whose ingredients didn't: Save again updates it.
  const created = useRef(false);
  // The header photo the database points to now: the one it opened with, or the one a save wrote
  // even if a later part of that save failed. Closing keeps it.
  const savedHeader = useRef<string | null>(recipe?.photo_path ?? null);
  const rowY = useRef<Record<string, number>>({});
  const sectionY = useRef(0);
  const pendingRow = useRef<string | null>(null);
  // Spec 016: the steps. A recipe with none opens with one empty, open step; left empty, Save drops it.
  const [startSteps] = useState(() => draftsFromSteps(recipe?.steps ?? []));
  const [steps, setSteps] = useState<StepDraft[]>(() => (startSteps.length > 0 ? startSteps : [emptyStep(newId())]));
  const [openStep, setOpenStep] = useState<string | null>(() => (startSteps.length > 0 ? null : (steps[0]?.key ?? null)));
  const [stepWarnings, setStepWarnings] = useState<StepWarnings>({});
  const [removeStepAsk, setRemoveStepAsk] = useState<string | null>(null);
  const stepY = useRef<Record<string, number>>({});
  const pendingStep = useRef<string | null>(null);
  // Spec 017: the variants. "Add a variant" on recipe settings opens the form with a new one.
  const [startVariants] = useState(() => draftsFromVariants(recipe?.variants ?? [], recipe?.steps ?? [], recipe?.facts ?? {}));
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    openVariant === 'new' && startVariants.length < MAX_VARIANTS ? [...startVariants, emptyVariant(newId())] : startVariants,
  );
  const [openVariantKey, setOpenVariantKey] = useState<string | null>(() =>
    openVariant === 'new' ? (variants.at(-1)?.key ?? null) : (variants.find((d) => d.id === openVariant)?.key ?? null),
  );
  const [variantWarnings, setVariantWarnings] = useState<VariantWarnings>({});
  const variantY = useRef<Record<string, number>>({});
  const pendingVariant = useRef<string | null>(null);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  const startStepPhotos = startSteps.flatMap((d) => (d.photoPath ? [d.photoPath] : []));
  const photoUrls = photoIO.useRecipePhotoUrls(client, familyId, [form.photoPath === start.photoPath ? form.photoPath : null, ...startStepPhotos]);

  useEffect(() => {
    let alive = true;
    void readAdvanced(storage, userId).then((on) => alive && setAdvanced(on));
    return () => {
      alive = false;
    };
  }, [storage, userId]);

  // After Save found a warning, once the field is on screen.
  useEffect(() => {
    if (!scrollTo) return;
    const y = fieldY.current[scrollTo === 'totalTime' ? 'serves' : scrollTo];
    if (y !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      setScrollTo(null);
    }
  }, [scrollTo, section, advanced]);

  const change = (patch: Partial<DetailsForm>) => {
    setForm((now) => ({ ...now, ...patch }));
    // A field's warning goes once it's edited.
    setWarnings((now) => {
      const next = { ...now };
      if ('name' in patch) delete next.name;
      if ('serves' in patch) delete next.serves;
      if ('totalTime' in patch) delete next.totalTime;
      if ('prepTime' in patch) delete next.prepTime;
      return next;
    });
  };

  const toggleAdvanced = (on: boolean) => {
    setAdvanced(on);
    void writeAdvanced(storage, userId, on);
  };

  // Typeahead (spec 031): what the catalog suggests for the focused name, after a short pause.
  const focusedName = focused ? (drafts.find((d) => d.key === focused)?.name ?? '') : '';
  const focusedLinked = focused ? drafts.find((d) => d.key === focused)?.catalogKey != null : false;
  useEffect(() => {
    if (!focused || focusedName.trim().length < 2 || focusedLinked) return;
    let alive = true;
    const timer = setTimeout(() => {
      void suggestIngredients(client, focusedName).then((items) => {
        if (alive) setSuggestions({ key: focused, items });
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [client, focused, focusedName, focusedLinked]);

  /** Changes one row; its warning goes once it's edited. */
  const updateRow = (key: string, change: (d: IngredientDraft) => IngredientDraft) => {
    setDrafts((now) => now.map((d) => (d.key === key ? change(d) : d)));
    setIngWarnings((now) => (key in now ? without(now, key) : now));
  };

  /** What the catalog knows about these rows' names, applied if a name is still the one looked up. */
  const match = async (rows: IngredientDraft[]) => {
    const found = await matchIngredients(
      client,
      rows.map((r) => r.name),
    );
    if (!found) return;
    setDrafts((now) =>
      now.map((d) => {
        const i = rows.findIndex((r) => r.key === d.key);
        return i >= 0 && rows[i]?.name === d.name && d.catalogKey === null ? applyMatch(d, found[i] ?? null) : d;
      }),
    );
  };

  const nameChange = (key: string, name: string) => {
    updateRow(key, (d) => withName(d, name));
    setSuggestions((s) => (s?.key === key && name.trim().length < 2 ? null : s));
  };

  const nameBlur = (key: string) => {
    // Later, so tapping a suggestion still lands on it.
    setTimeout(() => {
      setFocused((k) => (k === key ? null : k));
      setSuggestions((s) => (s?.key === key ? null : s));
    }, 200);
    const row = draftsRef.current.find((d) => d.key === key);
    if (row && row.name.trim() && row.catalogKey === null && !row.isNew) void match([row]);
  };

  const pickSuggestion = (key: string, facts: IngredientFacts) => {
    updateRow(key, (d) => applyMatch(d, facts, true));
    setSuggestions(null);
  };

  const addRow = () => {
    setDrafts((now) => [...now, emptyDraft(newId())]);
    setBanner(null);
    tracker.track('ingredient_line_added', { parsed: false });
  };

  const paste = (text: string) => {
    setPasteOpen(false);
    const rows = parsePastedList(text).map((line) => draftFromParsed(line, newId()));
    if (rows.length === 0) {
      setBanner(ing.pastedNothing);
      return;
    }
    // Empty rows (a new recipe's first) make way for the pasted ones.
    setDrafts((now) => [...now.filter((d) => d.name.trim() || d.quantity.trim() || d.weight.trim()), ...rows]);
    setBanner(ing.pasted(rows.length));
    for (const _row of rows) tracker.track('ingredient_line_added', { parsed: true });
    void match(rows);
  };

  const removeRow = (key: string) => {
    const row = draftsRef.current.find((d) => d.key === key);
    setDrafts((now) => now.filter((d) => d.key !== key));
    setIngWarnings((now) => without(now, key));
    // "We'll take it out of that step too" (OC-EditIngredients), as Save would.
    if (row) setSteps((now) => now.map((d) => ({ ...d, body: removeTokens(d.body, [row.id]) })));
  };

  const askRemove = (key: string) => {
    const row = drafts.find((d) => d.key === key);
    if (!row) return;
    const using = stepsUsing(
      row.id,
      steps.map((d, i) => ({ position: i, body: d.body })),
    );
    if (using.length > 0) setRemoveAsk({ key, name: row.name.trim(), steps: using });
    else removeRow(key);
  };

  const moveRow = (from: number, to: number) =>
    setDrafts((now) => {
      const next = [...now];
      const [row] = next.splice(from, 1);
      if (row) next.splice(to, 0, row);
      return next;
    });

  /** Changes one step; its warnings go once it's edited. */
  const updateStep = (key: string, patch: Partial<StepDraft>) => {
    setSteps((now) => now.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    setStepWarnings((now) => (key in now ? without(now, key) : now));
  };

  const addStep = () => {
    const step = emptyStep(newId());
    setSteps((now) => [...now, step]);
    setOpenStep(step.key);
  };

  const removeStep = (key: string) => {
    setSteps((now) => now.filter((d) => d.key !== key));
    setStepWarnings((now) => without(now, key));
    setOpenStep((k) => (k === key ? null : k));
  };

  const askRemoveStep = (key: string) => {
    const step = steps.find((d) => d.key === key);
    if (step && !isBlankStep(step)) setRemoveStepAsk(key);
    else removeStep(key);
  };

  const moveStep = (from: number, to: number) =>
    setSteps((now) => {
      const next = [...now];
      const [step] = next.splice(from, 1);
      if (step) next.splice(to, 0, step);
      return next;
    });

  const scrollToStep = (key: string) => {
    const y = stepY.current[key];
    if (y === undefined) return false;
    scroll.current?.scrollTo({ y: Math.max(0, sectionY.current + y - 12), animated: true });
    return true;
  };

  const updateVariant = (key: string, change: (d: VariantDraft) => VariantDraft) => {
    setVariants((now) => now.map((d) => (d.key === key ? change(d) : d)));
    setVariantWarnings((now) => (key in now ? without(now, key) : now));
  };

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return;
    const variant = emptyVariant(newId());
    setVariants((now) => [...now, variant]);
    setOpenVariantKey(variant.key);
  };

  const deleteVariant = (key: string) => {
    setVariants((now) => now.filter((d) => d.key !== key));
    setVariantWarnings((now) => without(now, key));
    setOpenVariantKey((k) => (k === key ? null : k));
  };

  const scrollToVariant = (key: string) => {
    const y = variantY.current[key];
    if (y === undefined) return false;
    scroll.current?.scrollTo({ y: Math.max(0, sectionY.current + y - 12), animated: true });
    return true;
  };

  const scrollToRow = (key: string) => {
    const y = rowY.current[key];
    if (y === undefined) return false;
    scroll.current?.scrollTo({ y: Math.max(0, sectionY.current + y - 12), animated: true });
    return true;
  };

  const pick = async (target: PhotoTarget = 'recipe') => {
    const picked = await photos.pickPhoto();
    if (picked === 'denied') setPhoto((p) => ({ ...p, denied: true }));
    else if (picked) setCrop({ ...picked, target });
  };

  /** A step's photo: stored under the recipe like its header photo, and kept on the step until Save. */
  const uploadStep = async (key: string, path: string, bytes: Uint8Array, preview: string | null) => {
    const before = stepPhotos[key]?.preview ?? null;
    setStepPhotos((now) => ({ ...now, [key]: { ...idle, uploading: true, preview } }));
    const ok = await photos.uploadPhoto(client, path, bytes);
    if (ok) {
      uploaded.current.push(path);
      updateStep(key, { photoOn: true, photoPath: path });
      setStepPhotos((now) => ({ ...now, [key]: { ...idle, preview } }));
    } else {
      setStepPhotos((now) => ({ ...now, [key]: { ...idle, preview: before, failed: { path, bytes, preview } } }));
    }
  };

  const retryStepPhoto = (key: string) => {
    const failed = stepPhotos[key]?.failed;
    if (failed && failed.path) void uploadStep(key, failed.path, failed.bytes, failed.preview);
    else {
      setStepPhotos((now) => ({ ...now, [key]: idle }));
      void pick({ step: key });
    }
  };

  /**
   * Shows the new photo dimmed while it uploads. Stored, it becomes the form's photo; failed, the
   * field goes back to the photo it had (the one Save would keep), with Retry.
   */
  const upload = async (path: string, bytes: Uint8Array, preview: string | null) => {
    const before = photo.preview;
    setPhoto({ ...idle, uploading: true, preview });
    const ok = await photos.uploadPhoto(client, path, bytes);
    if (ok) {
      uploaded.current.push(path);
      change({ photoPath: path });
      setPhoto((p) => ({ ...p, uploading: false }));
    } else {
      setPhoto({ ...idle, preview: before, failed: { path, bytes, preview } });
    }
  };

  const applyCrop = async (rect: CropRect) => {
    const picked = crop;
    setCrop(null);
    if (!picked) return;
    const { target } = picked;
    try {
      const prepared = await photos.preparePhoto(picked.uri, rect);
      const path = photos.newPhotoPath(familyId, recipeId);
      if (target === 'recipe') await upload(path, prepared.bytes, prepared.uri);
      else await uploadStep(target.step, path, prepared.bytes, prepared.uri);
    } catch {
      // Couldn't read the picked image: the same message, and Retry picks again.
      const failed = { path: '', bytes: new Uint8Array(), preview: null };
      if (target === 'recipe') setPhoto((p) => ({ ...idle, preview: p.preview, failed }));
      else setStepPhotos((now) => ({ ...now, [target.step]: { ...idle, preview: now[target.step]?.preview ?? null, failed } }));
    }
  };

  const retryPhoto = () => {
    const failed = photo.failed;
    if (failed && failed.path) void upload(failed.path, failed.bytes, failed.preview);
    else {
      setPhoto(idle);
      void pick();
    }
  };

  const removePhoto = () => {
    setPhoto(idle);
    change({ photoPath: null });
  };

  /**
   * Removes every photo nothing points to any more: the ones this visit stored but didn't keep, and
   * the recipe's, steps' and variant steps' old ones once a save replaced or removed them. Closing
   * keeps the old ones.
   */
  const tidyPhotos = (kept: (string | null | undefined)[], variantPhotos: string[] = recipe?.variantPhotos ?? []) => {
    // A variant's added step can name the same file as a base step (an assistant may write that).
    const keep = new Set([...kept, ...variantPhotos].filter(Boolean));
    void photos.removePhotos(
      client,
      [...new Set([...uploaded.current, start.photoPath, ...startStepPhotos, ...(recipe?.variantPhotos ?? [])])].filter((p): p is string => p !== null && !keep.has(p)),
    );
  };

  const save = async () => {
    const read = readDetails(form);
    if ('warnings' in read) {
      // Nothing to point at (a limit the fields already keep): the save message instead.
      if (Object.keys(read.warnings).length === 0) {
        setSaveFailed(true);
        return;
      }
      setWarnings(read.warnings);
      if (read.warnings.prepTime) setAdvanced(true);
      onSectionChange('details');
      setScrollTo(fieldOrder.find((k) => read.warnings[k]) ?? null);
      return;
    }
    let ingredients: Parameters<typeof saveRecipe>[3];
    if (ingredientsChanged(startIngredients, drafts)) {
      const rows = readIngredients(drafts);
      if ('warnings' in rows) {
        // US3: Save waits, and the first problem comes into view.
        setIngWarnings(rows.warnings);
        const first = drafts.find((d) => rows.warnings[d.key])?.key ?? null;
        pendingRow.current = first;
        onSectionChange('ingredients');
        if (first && section === 'ingredients' && scrollToRow(first)) pendingRow.current = null;
        return;
      }
      ingredients = { rows: rows.rows, drafts };
    }
    let stepRows: StepSaveRow[] | undefined;
    if (stepsChanged(startSteps, steps)) {
      const read = readSteps(steps);
      if ('warnings' in read) {
        // The first step with a problem opens and comes into view.
        setStepWarnings(read.warnings);
        const first = steps.find((d) => read.warnings[d.key])?.key ?? null;
        setOpenStep(first);
        pendingStep.current = first;
        onSectionChange('steps');
        if (first && section === 'steps' && scrollToStep(first)) pendingStep.current = null;
        return;
      }
      stepRows = read.rows;
    }
    let variantRows: VariantSaveRow[] | undefined;
    if (variantsChanged(startVariants, variants)) {
      // Change steps compare against the steps as they're being saved.
      const read = readVariants(variants, steps);
      if ('warnings' in read) {
        setVariantWarnings(read.warnings);
        const first = variants.find((d) => read.warnings[d.key])?.key ?? null;
        setOpenVariantKey(first);
        pendingVariant.current = first;
        onSectionChange('variants');
        if (first && section === 'variants' && scrollToVariant(first)) pendingVariant.current = null;
        return;
      }
      variantRows = read.rows;
    }
    setSaving(true);
    setSaveFailed(false);
    const result = await saveRecipe(client, { id: recipeId, familyId, isNew: isNew && !created.current }, read.input, ingredients, stepRows, variantRows);
    if (result.created) created.current = true;
    if (result.detailsSaved) savedHeader.current = read.input.photo_path ?? null;
    const ok = result.ok;
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (isNew) tracker.track('recipe_created', { source: 'app', has_photo: read.input.photo_path != null, advanced_mode: advanced });
    else tracker.track('recipe_edited', { section });
    if (stepRows) for (const props of addedStepEvents(stepRows, new Set(startSteps.map((d) => d.id)))) tracker.track('recipe_step_added', props);
    if (variantRows) for (const props of createdVariantEvents(variantRows, new Set(startVariants.map((d) => d.id)))) tracker.track('variant_created', props);
    // Steps that weren't saved this time keep the photos they had.
    tidyPhotos(
      [read.input.photo_path, ...(stepRows ? stepRows.map((r) => r.photo_path) : startStepPhotos)],
      variantRows ? variantRows.flatMap((r) => variantStepPhotos(r.changes)) : undefined,
    );
    void queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
    onSaved();
  };

  const close = () => {
    tidyPhotos([savedHeader.current, ...startStepPhotos]);
    onClose();
  };

  const removeRecipe = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteRecipe(client, recipeId);
    } catch {
      setDeleting(false);
      setDeleteFailed(true);
      return;
    }
    tracker.track('recipe_deleted', { source: 'app' });
    // Photos this visit stored but never saved go; the recipe's own stay, for a restore.
    tidyPhotos([savedHeader.current, ...startStepPhotos]);
    void queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
    onDeleted?.();
  };

  const cancel = () =>
    isDirty(start, form) || ingredientsChanged(startIngredients, drafts) || stepsChanged(startSteps, steps) || variantsChanged(startVariants, variants)
      ? setConfirmDiscard(true)
      : close();

  if (crop) {
    return (
      <PhotoCrop
        source={{ uri: crop.uri }}
        image={{ width: crop.width, height: crop.height }}
        title={f.crop.title}
        hint={f.crop.hint}
        zoomInLabel={f.crop.zoomIn}
        zoomOutLabel={f.crop.zoomOut}
        confirmLabel={f.crop.use}
        onConfirm={(rect) => void applyCrop(rect)}
        cancelLabel={f.crop.cancel}
        onCancel={() => setCrop(null)}
      />
    );
  }

  const next = nextSection(section);
  const knownNames = new Map(startIngredients.map((d) => [d.id, d.name]));
  const unitRow = unitFor ? drafts.find((d) => d.key === unitFor) : undefined;
  const photoSource = photo.preview ? { uri: photo.preview } : form.photoPath && photoUrls[form.photoPath] ? { uri: photoUrls[form.photoPath] } : null;
  return (
    <>
      <FormScreen
        scrollRef={scroll}
        scrollEnabled={!dragging}
        bar={
          <FormBar
            cancelLabel={f.cancel}
            onCancel={cancel}
            title={isNew ? f.newTitle : f.editTitle}
            saveLabel={f.save}
            onSave={() => void save()}
            saveDisabled={!online || photo.uploading}
            saving={saving}
            savingLabel={f.saving}
            progress={<FormProgress sections={FORM_SECTIONS.map((key) => ({ key, label: f.sections[key] }))} current={section} onSelect={onSectionChange} />}
          />
        }
      >
        <OfflineBanner screen="recipe_form" tracker={tracker} />
        {saveFailed ? <Callout variant="warn" text={f.saveFailed} /> : null}
        {section === 'details' ? (
          <DetailsSection
            form={form}
            onChange={change}
            warnings={warnings}
            isNew={isNew}
            advanced={advanced}
            onAdvancedChange={toggleAdvanced}
            photo={{ source: photoSource, loading: !photoSource && form.photoPath !== null, uploading: photo.uploading, failed: photo.failed !== null, denied: photo.denied }}
            onPickPhoto={() => void pick('recipe')}
            onRemovePhoto={removePhoto}
            onRetryPhoto={retryPhoto}
            onOpenCuisine={() => setCuisineOpen(true)}
            onFieldLayout={(field, y) => {
              fieldY.current[field] = y;
            }}
          />
        ) : null}
        {section === 'ingredients' ? (
          <IngredientsSection
            drafts={drafts}
            warnings={ingWarnings}
            servings={servingsOf(form.serves)}
            banner={banner}
            suggestions={suggestions}
            onChangeRow={(key, patch) => updateRow(key, (d) => ({ ...d, ...patch }))}
            onNameChange={nameChange}
            onNameFocus={(key) => setFocused(key)}
            onNameBlur={nameBlur}
            onPickSuggestion={pickSuggestion}
            onOpenUnit={setUnitFor}
            onOpenAisle={setAisleFor}
            onRemove={askRemove}
            onMove={moveRow}
            onAdd={addRow}
            onOpenPaste={() => setPasteOpen(true)}
            onDragChange={setDragging}
            onSectionLayout={(y) => {
              sectionY.current = y;
            }}
            onRowLayout={(key, y) => {
              rowY.current[key] = y;
              if (pendingRow.current === key && scrollToRow(key)) pendingRow.current = null;
            }}
          />
        ) : null}
        {section === 'steps' ? (
          <StepsSection
            steps={steps}
            ingredients={drafts.filter((d) => d.name.trim()).map(quantityOf)}
            knownNames={knownNames}
            warnings={stepWarnings}
            open={openStep}
            onOpen={setOpenStep}
            onChange={updateStep}
            onMove={moveStep}
            onAdd={addStep}
            onRemove={askRemoveStep}
            onDragChange={setDragging}
            photo={(key) => {
              const work = stepPhotos[key] ?? idle;
              const path = steps.find((d) => d.key === key)?.photoPath ?? null;
              const url = path ? photoUrls[path] : undefined;
              const source = work.preview ? { uri: work.preview } : url ? { uri: url } : null;
              return { source, loading: !source && path !== null, uploading: work.uploading, failed: work.failed !== null };
            }}
            onPickPhoto={(key) => void pick({ step: key })}
            onRemovePhoto={(key) => {
              setStepPhotos((now) => ({ ...now, [key]: idle }));
              updateStep(key, { photoPath: null });
            }}
            onRetryPhoto={retryStepPhoto}
            onSectionLayout={(y) => {
              sectionY.current = y;
            }}
            onStepLayout={(key, y) => {
              stepY.current[key] = y;
              if (pendingStep.current === key && scrollToStep(key)) pendingStep.current = null;
            }}
          />
        ) : null}
        {section === 'variants' ? (
          <VariantsSection
            variants={variants}
            warnings={variantWarnings}
            ingredients={drafts}
            steps={steps}
            knownNames={knownNames}
            open={openVariantKey}
            onOpen={setOpenVariantKey}
            onChange={updateVariant}
            onAdd={addVariant}
            onDelete={deleteVariant}
            canAdd={variants.length < MAX_VARIANTS}
            client={client}
            newId={newId}
            onSectionLayout={(y) => {
              sectionY.current = y;
            }}
            onVariantLayout={(key, y) => {
              variantY.current[key] = y;
              if (pendingVariant.current === key && scrollToVariant(key)) pendingVariant.current = null;
            }}
          />
        ) : null}
        <Button
          label={next ? f.next(f.sections[next]) : f.saveRecipe}
          variant="ink"
          block
          onPress={() => (next ? onSectionChange(next) : void save())}
          disabled={!next && (!online || photo.uploading)}
          busy={!next && saving}
          busyLabel={f.saving}
        />
        {!isNew && section === 'variants' && onDeleted ? (
          <>
            {deleteFailed ? <Callout variant="warn" text={strings.deleteRecipe.failed} /> : null}
            <Link
              label={strings.deleteRecipe.link}
              tone="danger"
              icon="trash"
              onPress={() => setConfirmDelete(true)}
              disabled={!online || deleting || saving}
            />
          </>
        ) : null}
      </FormScreen>
      <CuisineSheet
        visible={cuisineOpen}
        value={form.cuisine}
        onPick={(cuisine) => {
          change({ cuisine });
          setCuisineOpen(false);
        }}
        onClose={() => setCuisineOpen(false)}
      />
      <UnitSheet
        visible={unitFor !== null}
        unit={unitRow?.unit ?? null}
        size={unitRow?.sizeWord ?? null}
        sizes={sizesOf(unitRow?.facts ?? null)}
        onPick={(unit, size) => {
          if (unitFor) updateRow(unitFor, (d) => withUnit(d, unit, size));
          setUnitFor(null);
        }}
        onClose={() => setUnitFor(null)}
      />
      <AisleSheet
        visible={aisleFor !== null}
        value={drafts.find((d) => d.key === aisleFor)?.newAisle ?? null}
        onPick={(aisle) => {
          if (aisleFor) updateRow(aisleFor, (d) => ({ ...d, newAisle: aisle }));
          setAisleFor(null);
        }}
        onClose={() => setAisleFor(null)}
      />
      <PasteSheet visible={pasteOpen} onAdd={paste} onClose={() => setPasteOpen(false)} />
      <Dialog
        visible={removeAsk !== null}
        icon="warning"
        title={removeAsk ? ing.removeTitle(removeAsk.name) : ''}
        body={removeAsk ? ing.removeBody(removeAsk.steps) : ''}
        confirmLabel={ing.removeConfirm}
        onConfirm={() => {
          if (removeAsk) removeRow(removeAsk.key);
          setRemoveAsk(null);
        }}
        cancelLabel={ing.removeCancel}
        onCancel={() => setRemoveAsk(null)}
      />
      <Dialog
        visible={removeStepAsk !== null}
        icon="warning"
        title={strings.recipeForm.steps.removeTitle}
        body={strings.recipeForm.steps.removeBody}
        confirmLabel={strings.recipeForm.steps.removeConfirm}
        onConfirm={() => {
          if (removeStepAsk) removeStep(removeStepAsk);
          setRemoveStepAsk(null);
        }}
        cancelLabel={strings.recipeForm.steps.removeCancel}
        onCancel={() => setRemoveStepAsk(null)}
      />
      <Dialog
        visible={confirmDelete}
        title={strings.deleteRecipe.title(recipe?.name ?? '')}
        body={strings.deleteRecipe.body(recipe?.variants?.length ?? 0)}
        emphasis={strings.deleteRecipe.bodyEmphasis}
        confirmLabel={strings.deleteRecipe.confirm}
        onConfirm={() => void removeRecipe()}
        cancelLabel={strings.deleteRecipe.keep}
        onCancel={() => setConfirmDelete(false)}
      />
      <Dialog
        visible={confirmDiscard}
        icon="warning"
        title={f.discardTitle}
        body={f.discardBody}
        confirmLabel={f.discard}
        onConfirm={() => {
          setConfirmDiscard(false);
          close();
        }}
        cancelLabel={f.keepEditing}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
