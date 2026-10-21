import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { parsePastedList } from '@cocon/quantity';
import { Button, Callout, Dialog, FormBar, FormProgress, FormScreen, PhotoCrop, type CropRect } from '@cocon/ui';
import type { IngredientFacts, RecipeFormSection, Tracker } from '@cocon/schemas';
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
  readIngredients,
  sizesOf,
  stepsUsing,
  suggestIngredients,
  withName,
  withUnit,
  type IngredientDraft,
  type IngredientWarning,
} from '../../../lib/recipe-ingredients';
import * as photoIO from '../../../lib/recipe-photo';
import type { Client } from '../../../lib/supabase';
import { OfflineBanner } from '../../sync/OfflineBanner';
import { CuisineSheet } from './CuisineSheet';
import { DetailsSection } from './DetailsSection';
import { AisleSheet, PasteSheet, UnitSheet } from './IngredientSheets';
import { IngredientsSection } from './IngredientsSection';

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
  /** Ids for added ingredients; tests pass their own. */
  newId?: () => string;
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

/** The order Save looks for the first warned field to scroll to. */
const fieldOrder: DetailsField[] = ['name', 'serves', 'totalTime', 'prepTime'];

/**
 * The recipe form (spec 014, OC-EditBasics): the form bar, Progress over the four sections, the
 * section, and "Next: …". Details is built here; Ingredients, Steps and Variants come with 015–017.
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
  newId = randomUUID,
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
  const [crop, setCrop] = useState<photoIO.PickedPhoto | null>(null);
  const [photo, setPhoto] = useState<PhotoWork>(idle);
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
  const rowY = useRef<Record<string, number>>({});
  const sectionY = useRef(0);
  const pendingRow = useRef<string | null>(null);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  const photoUrls = photoIO.useRecipePhotoUrls(client, familyId, [form.photoPath === start.photoPath ? form.photoPath : null]);

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
    setDrafts((now) => now.filter((d) => d.key !== key));
    setIngWarnings((now) => without(now, key));
  };

  const askRemove = (key: string) => {
    const row = drafts.find((d) => d.key === key);
    if (!row) return;
    const steps = stepsUsing(row.id, recipe?.steps ?? []);
    if (steps.length > 0) setRemoveAsk({ key, name: row.name.trim(), steps });
    else removeRow(key);
  };

  const moveRow = (from: number, to: number) =>
    setDrafts((now) => {
      const next = [...now];
      const [row] = next.splice(from, 1);
      if (row) next.splice(to, 0, row);
      return next;
    });

  const scrollToRow = (key: string) => {
    const y = rowY.current[key];
    if (y === undefined) return false;
    scroll.current?.scrollTo({ y: Math.max(0, sectionY.current + y - 12), animated: true });
    return true;
  };

  const pick = async () => {
    const picked = await photos.pickPhoto();
    if (picked === 'denied') setPhoto((p) => ({ ...p, denied: true }));
    else if (picked) setCrop(picked);
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
    try {
      const prepared = await photos.preparePhoto(picked.uri, rect);
      await upload(photos.newPhotoPath(familyId, recipeId), prepared.bytes, prepared.uri);
    } catch {
      // Couldn't read the picked image: the same message, and Retry picks again.
      setPhoto((p) => ({ ...idle, preview: p.preview, failed: { path: '', bytes: new Uint8Array(), preview: null } }));
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
   * the recipe's old one once a save replaced or removed it. Closing keeps the old one.
   */
  const tidyPhotos = (kept: string | null) => {
    void photos.removePhotos(client, [...uploaded.current, start.photoPath].filter((p) => p !== kept));
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
    setSaving(true);
    setSaveFailed(false);
    const result = await saveRecipe(client, { id: recipeId, familyId, isNew: isNew && !created.current }, read.input, ingredients);
    if (result.created) created.current = true;
    const ok = result.ok;
    setSaving(false);
    if (!ok) {
      setSaveFailed(true);
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (isNew) tracker.track('recipe_created', { source: 'app', has_photo: read.input.photo_path != null, advanced_mode: advanced });
    else tracker.track('recipe_edited', { section });
    tidyPhotos(read.input.photo_path ?? null);
    void queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
    onSaved();
  };

  const close = () => {
    tidyPhotos(start.photoPath);
    onClose();
  };

  const cancel = () => (isDirty(start, form) || ingredientsChanged(startIngredients, drafts) ? setConfirmDiscard(true) : close());

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
            onPickPhoto={() => void pick()}
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
        <Button
          label={next ? f.next(f.sections[next]) : f.saveRecipe}
          variant="ink"
          block
          onPress={() => (next ? onSectionChange(next) : void save())}
          disabled={!next && (!online || photo.uploading)}
          busy={!next && saving}
          busyLabel={f.saving}
        />
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
