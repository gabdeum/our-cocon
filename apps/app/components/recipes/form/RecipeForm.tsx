import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Callout, Dialog, FormBar, FormProgress, FormScreen, PhotoCrop, type CropRect } from '@cocon/ui';
import type { RecipeFormSection, Tracker } from '@cocon/schemas';
import { strings } from '../../../strings/en';
import { useOnline } from '../../../lib/online';
import type { ChoiceStorage } from '../../../lib/recipe-choices';
import {
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
import * as photoIO from '../../../lib/recipe-photo';
import type { Client } from '../../../lib/supabase';
import { OfflineBanner } from '../../sync/OfflineBanner';
import { CuisineSheet } from './CuisineSheet';
import { DetailsSection } from './DetailsSection';

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
  client: Pick<Client, 'from' | 'storage'>;
  tracker: Tracker;
  storage: ChoiceStorage;
  photos?: PhotoIO;
  /** Cancel, or Discard: back to where the form was opened. */
  onClose: () => void;
  /** Saved: a new recipe opens; an edit goes back to it. */
  onSaved: () => void;
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

/** The order Save looks for the first warned field to scroll to. */
const fieldOrder: DetailsField[] = ['name', 'serves', 'totalTime', 'prepTime'];

/**
 * The recipe form (spec 014, OC-EditBasics): the form bar, Progress over the four sections, the
 * section, and "Next: …". Details is built here; Ingredients, Steps and Variants come with 015–017.
 */
export function RecipeForm({ recipeId, recipe, familyId, userId, section, onSectionChange, client, tracker, storage, photos = photoIO, onClose, onSaved }: RecipeFormProps) {
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
    setSaving(true);
    setSaveFailed(false);
    const ok = await saveRecipe(client, { id: recipeId, familyId, isNew }, read.input);
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

  const cancel = () => (isDirty(start, form) ? setConfirmDiscard(true) : close());

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
  const photoSource = photo.preview ? { uri: photo.preview } : form.photoPath && photoUrls[form.photoPath] ? { uri: photoUrls[form.photoPath] } : null;
  return (
    <>
      <FormScreen
        scrollRef={scroll}
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
