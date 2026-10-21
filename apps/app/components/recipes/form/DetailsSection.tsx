import { View, type LayoutChangeEvent } from 'react-native';
import { Callout, Link, MonthPicker, PhotoField, PickerField, SettingRow, Text, TextField } from '@cocon/ui';
import type { ImageSourcePropType } from 'react-native';
import { strings } from '../../../strings/en';
import type { DetailsField, DetailsForm, DetailsWarnings } from '../../../lib/recipe-form';

const f = strings.recipeForm;

/** The photo's state, from the form: what to show and whether it's uploading or failed. */
export interface PhotoState {
  source: ImageSourcePropType | null;
  /** The recipe has a photo whose link is still loading. */
  loading: boolean;
  uploading: boolean;
  /** "The photo didn't upload. Try again." with Retry. */
  failed: boolean;
  /** Photos access was refused (iOS). */
  denied: boolean;
}

export interface DetailsSectionProps {
  form: DetailsForm;
  onChange: (patch: Partial<DetailsForm>) => void;
  warnings: DetailsWarnings;
  isNew: boolean;
  advanced: boolean;
  onAdvancedChange: (on: boolean) => void;
  photo: PhotoState;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  onRetryPhoto: () => void;
  onOpenCuisine: () => void;
  /** Where each warned field sits in the scroll, so Save can bring the first one into view. */
  onFieldLayout: (field: DetailsField, y: number) => void;
}

/** The Details section of the recipe form (spec 014, OC-EditBasics › Layout), in the screen's order. */
export function DetailsSection(p: DetailsSectionProps) {
  const { form, onChange, warnings } = p;
  const at = (field: DetailsField) => (e: LayoutChangeEvent) => p.onFieldLayout(field, e.nativeEvent.layout.y);
  return (
    <>
      {p.isNew ? <Callout variant="ai" label={f.aiBadge} text={f.aiHint} /> : null}

      <View className="gap-8">
        <PhotoField
          source={p.photo.source}
          loading={p.photo.loading}
          addLabel={f.addPhoto}
          onAdd={p.onPickPhoto}
          changeLabel={f.changePhoto}
          onChange={p.onPickPhoto}
          removeLabel={f.removePhoto}
          onRemove={p.onRemovePhoto}
          photoLabel={f.photoLabel}
          busyLabel={p.photo.uploading ? f.uploadingPhoto : undefined}
        />
        {p.photo.failed ? (
          <View className="gap-4">
            <Callout variant="warn" text={f.photoFailed} />
            <Link label={f.photoRetry} onPress={p.onRetryPhoto} />
          </View>
        ) : null}
        {p.photo.denied ? <Callout variant="warn" text={f.photoDenied} /> : null}
      </View>

      <View onLayout={at('name')}>
        <TextField label={f.name} value={form.name} onChangeText={(name) => onChange({ name })} maxLength={80} warning={warnings.name} />
      </View>

      <TextField
        label={f.description}
        value={form.description}
        onChangeText={(description) => onChange({ description })}
        maxLength={140}
        multiline
        numberOfLines={2}
        hint={f.descriptionHint}
        counter={f.counter(form.description.length)}
      />

      <View onLayout={at('serves')} className="flex-row gap-10">
        <TextField
          label={f.serves}
          value={form.serves}
          onChangeText={(serves) => onChange({ serves })}
          inputMode="numeric"
          maxLength={3}
          warning={warnings.serves}
          className="flex-1"
        />
        <TextField label={f.totalTime} value={form.totalTime} onChangeText={(totalTime) => onChange({ totalTime })} maxLength={20} warning={warnings.totalTime} className="flex-1" />
      </View>

      <View className="gap-8">
        <Text size={15} weight="900" aria-hidden>
          {f.bestMonths}
        </Text>
        <MonthPicker
          label={f.bestMonths}
          monthLabels={[...strings.monthsShort]}
          value={form.bestMonths.map((m) => m - 1)}
          onChange={(months) => onChange({ bestMonths: months.map((m) => m + 1) })}
          hint={f.bestMonthsHint}
        />
      </View>

      <SettingRow label={f.advanced} hint={f.advancedHint} value={p.advanced} onValueChange={p.onAdvancedChange} onInk boxed />

      {p.advanced ? (
        <>
          <View onLayout={at('prepTime')} className="flex-row gap-10">
            <TextField label={f.prepTime} value={form.prepTime} onChangeText={(prepTime) => onChange({ prepTime })} maxLength={20} warning={warnings.prepTime} className="flex-1" />
            <PickerField
              label={f.cuisine}
              value={form.cuisine ? strings.cuisines[form.cuisine] : null}
              placeholder={f.cuisinePlaceholder}
              onPress={p.onOpenCuisine}
              className="flex-1"
            />
          </View>
          <TextField
            label={f.source}
            optionalLabel={f.optional}
            value={form.source}
            onChangeText={(source) => onChange({ source })}
            maxLength={200}
            placeholder={f.sourcePlaceholder}
          />
        </>
      ) : null}
    </>
  );
}
