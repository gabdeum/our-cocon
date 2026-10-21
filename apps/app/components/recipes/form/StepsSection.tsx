import { useEffect, useRef, useState } from 'react';
import { View, type ImageSourcePropType } from 'react-native';
import { ingredientToken, renderTemperatureCheck, tokenizeTemperatures, type QuantityIngredient } from '@cocon/quantity';
import {
  Button,
  FieldPair,
  Link,
  ListRow,
  PhotoField,
  Pill,
  ReorderList,
  SegmentedControl,
  StepEditCard,
  StepNote,
  StepPreview,
  StepText,
  Text,
  TextField,
  ToggleTile,
  TokenEditor,
  type TokenPart,
} from '@cocon/ui';
import { strings } from '../../../strings/en';
import {
  editBody,
  insertToken,
  markTemperature,
  matchMentions,
  MAX_STEPS,
  mentionAt,
  missingIn,
  segmentsOf,
  shownText,
  snapSelection,
  stepBadges,
  temperaturesIn,
  unusedIngredients,
  type BodySegment,
  type Selection,
  type StepDraft,
  type StepWarnings,
} from '../../../lib/recipe-steps';
import { defaultFormat, stepParts } from '../../../lib/recipe-view';

const s = strings.recipeForm.steps;
const f = strings.recipeForm;

/** A step photo's state, from the form (as Details' photo). */
export interface StepPhotoState {
  source: ImageSourcePropType | null;
  loading: boolean;
  uploading: boolean;
  failed: boolean;
}

export interface StepsSectionProps {
  steps: StepDraft[];
  /** The ingredient rows as they are now, for chips, "@" and the Preview. */
  ingredients: QuantityIngredient[];
  /** Names of ingredients the recipe had when the form opened, for the Preview of a removed one. */
  knownNames: ReadonlyMap<string, string>;
  warnings: StepWarnings;
  /** The one expanded step. */
  open: string | null;
  onOpen: (key: string) => void;
  onChange: (key: string, patch: Partial<StepDraft>) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onDragChange: (dragging: boolean) => void;
  photo: (key: string) => StepPhotoState;
  onPickPhoto: (key: string) => void;
  onRemovePhoto: (key: string) => void;
  onRetryPhoto: (key: string) => void;
  /** Where each step sits in the scroll (from the section's top), so Save can bring a warned one into view. */
  onStepLayout: (key: string, y: number) => void;
  onSectionLayout: (y: number) => void;
}

const partsOf = (segments: BodySegment[]): TokenPart[] =>
  segments.map((g) => (g.type === 'text' ? g.text : { chip: g.label, tone: g.kind === 'missing' ? 'warn' : 'sage' }));

/** The collapsed card's sage line, and the open step's: "Temperature check: center reaches 71 °C (160 °F)". */
function tempLine(d: StepDraft): string | null {
  if (!d.tempOn) return null;
  const t = d.tempValue.trim().replace(',', '.');
  const n = /^-?\d{1,3}(\.\d+)?$/.test(t) ? Number(t) : null;
  const celsius = n === null ? null : d.tempScale === 'F' ? ((n - 32) * 5) / 9 : n;
  const text = renderTemperatureCheck(d.tempText, celsius, defaultFormat.system);
  return text ? `${s.tempPreview} ${text}` : null;
}

/** The Steps section of the recipe form (spec 016, OC-EditSteps › Layout), in the screen's order. */
export function StepsSection(p: StepsSectionProps) {
  const [listY, setListY] = useState(0);
  const names = new Map(p.ingredients.filter((i) => i.name).map((i) => [i.id, i.name]));
  return (
    <View className="gap-12" onLayout={(e) => p.onSectionLayout(e.nativeEvent.layout.y)}>
      <Text size={24} weight="900" role="heading" aria-level={1}>
        {s.title}
      </Text>
      <View onLayout={(e) => setListY(e.nativeEvent.layout.y)}>
        <ReorderList
          items={p.steps}
          keyOf={(d) => d.key}
          gap={12}
          handleLabel={s.handle}
          moveUpLabel={s.moveUp}
          moveDownLabel={s.moveDown}
          onMove={p.onMove}
          onDragChange={p.onDragChange}
          onItemLayout={(key, y) => p.onStepLayout(key, listY + y)}
          renderItem={(d, i, handle) => {
            const warned = p.warnings[d.key];
            const segments = segmentsOf(d.body, names);
            if (p.open !== d.key) {
              const title = d.name.trim() || shownText(segments).split('\n')[0]?.trim() || '';
              return (
                <StepEditCard
                  number={i + 1}
                  handle={handle}
                  expanded={false}
                  title={title}
                  badges={stepBadges(d)}
                  note={tempLine(d) ?? undefined}
                  openLabel={s.open(i + 1, d.name.trim())}
                  onOpen={() => p.onOpen(d.key)}
                  attention={warned !== undefined}
                />
              );
            }
            return <OpenStep {...p} draft={d} number={i + 1} handle={handle} names={names} segments={segments} />;
          }}
        />
      </View>
      {p.steps.length < MAX_STEPS ? <Button label={s.addStep} variant="dashed" block onPress={p.onAdd} /> : null}
    </View>
  );
}

interface OpenStepProps extends StepsSectionProps {
  draft: StepDraft;
  number: number;
  handle: React.ReactNode;
  names: Map<string, string>;
  segments: BodySegment[];
}

/** The expanded step: name, Instructions with chips, Preview, and its add-ons. */
function OpenStep({ draft: d, number, handle, names, segments, ...p }: OpenStepProps) {
  const warned = p.warnings[d.key] ?? {};
  const change = (patch: Partial<StepDraft>) => p.onChange(d.key, patch);
  const shown = shownText(segments);
  // Where the caret is (what an edit or an insert works from), and where to put it after one.
  const [selection, setSelection] = useState<Selection>({ start: shown.length, end: shown.length });
  const [forced, setForced] = useState<Selection | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const apply = (r: { body: string; caret: number }) => {
    change({ body: r.body });
    const at = { start: r.caret, end: r.caret };
    setSelection(at);
    setForced(at);
  };

  const mention = focused && selection.start === selection.end ? mentionAt(shown, selection.end) : null;
  const matches = mention ? matchMentions(mention.query, p.ingredients) : [];
  const unused = unusedIngredients(p.ingredients, p.steps);
  const temps = temperaturesIn(d.body);
  const missing = missingIn(d.body, new Set(names.keys())).length > 0;
  let preview: ReturnType<typeof stepParts>;
  try {
    preview = stepParts(d.body, p.ingredients, defaultFormat, p.knownNames);
  } catch {
    // An amount the engine can't read yet: the text as it shows in the editor.
    preview = [shown];
  }
  const photo = p.photo(d.key);
  const temp = tempLine(d);

  return (
    <StepEditCard
      number={number}
      handle={handle}
      expanded
      title={d.name}
      openLabel={s.open(number, d.name.trim())}
      onOpen={() => undefined}
      attention={Object.keys(warned).length > 0}
      header={<TextField label={s.stepName} labelHidden size="sm" value={d.name} maxLength={60} onChangeText={(name) => change({ name })} />}
    >
      <View className="gap-6">
        <TokenEditor
          label={s.instructions}
          parts={partsOf(segments)}
          value={shown}
          maxLength={2000}
          selection={forced}
          onChangeText={(next) => apply(editBody(segments, names, next, selection))}
          onSelectionChange={(sel) => {
            const snapped = snapSelection(segments, sel);
            setSelection(snapped);
            setForced(snapped.start !== sel.start || snapped.end !== sel.end ? snapped : undefined);
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            // Typed temperatures become chips (FR-006); Save does it again for text it never left.
            const body = tokenizeTemperatures(d.body);
            if (body !== d.body) change({ body });
            // Later, so tapping a suggestion still lands on it (as the ingredient names do).
            blurTimer.current = setTimeout(() => setFocused(false), 200);
          }}
          warning={warned.body ? s.warnings[warned.body] : missing ? s.missingBody : undefined}
          hint={s.instructionsHint}
        />
        {matches.length > 0 && mention ? (
          <View role="list" aria-label={s.suggestions}>
            {matches.map((m, i) => (
              <ListRow
                key={m.id}
                title={m.name}
                flush
                last={i === matches.length - 1}
                onPress={() => apply(insertToken(segments, names, { start: mention.start, end: selection.end }, ingredientToken(m.id)))}
              />
            ))}
          </View>
        ) : null}
        {temps.length > 0 ? (
          <View className="gap-6">
            <Text size={13} weight="800">
              {s.temperatureKindLabel}
            </Text>
            {temps.map((t) => (
              <View key={t.token} className="flex-row flex-wrap items-center gap-8">
                <Text size={14} weight="700">
                  {segmentsOf(t.token, names).map((g) => (g.type === 'chip' ? g.label : g.text)).join('')}
                </Text>
                <SegmentedControl
                  variant="pill"
                  label={s.temperatureKindLabel}
                  value={t.food ? 'food' : 'oven'}
                  segments={[
                    { key: 'oven', label: s.oven },
                    { key: 'food', label: s.thermometer },
                  ]}
                  onChange={(kind) => change({ body: markTemperature(d.body, t.token, kind === 'food') })}
                />
              </View>
            ))}
          </View>
        ) : null}
        {unused.length > 0 ? (
          <View className="flex-row flex-wrap gap-6">
            {unused.map((u) => (
              <Pill
                key={u.id}
                label={s.insert(u.name)}
                aria-label={s.insertA11y(u.name)}
                aria-pressed={undefined}
                onPress={() => apply(insertToken(segments, names, selection, ingredientToken(u.id)))}
              />
            ))}
          </View>
        ) : null}
      </View>

      <StepPreview label={s.preview}>
        <StepText parts={preview} compact />
      </StepPreview>

      <Text size={14} weight="900">
        {s.addTo}
      </Text>
      <View className="gap-8">
        <View className="flex-row gap-8">
          <ToggleTile
            label={s.timer}
            selectedLabel={s.on(s.timer)}
            selected={d.timerOn}
            onPress={() => change(d.timerOn ? { timerOn: false } : { timerOn: true, timerLabel: d.timerLabel || d.name.trim() })}
          />
          <ToggleTile label={s.temperature} selectedLabel={s.on(s.temperature)} selected={d.tempOn} onPress={() => change({ tempOn: !d.tempOn })} />
        </View>
        <View className="flex-row gap-8">
          <ToggleTile label={s.tip} selectedLabel={s.on(s.tip)} selected={d.tipOn} onPress={() => change({ tipOn: !d.tipOn })} />
          <ToggleTile label={s.photo} selectedLabel={s.on(s.photo)} selected={d.photoOn} onPress={() => change({ photoOn: !d.photoOn })} />
        </View>
      </View>

      {d.timerOn ? (
        <FieldPair
          first={
            <TextField
              label={s.timerField}
              size="sm"
              value={d.minutes}
              placeholder={s.timerPlaceholder}
              onChangeText={(minutes) => change({ minutes })}
              warning={warned.timer ? s.warnings[warned.timer] : undefined}
            />
          }
          second={<TextField label={s.timerLabel} size="sm" value={d.timerLabel} maxLength={40} onChangeText={(timerLabel) => change({ timerLabel })} />}
        />
      ) : null}

      {d.tempOn ? (
        <View className="gap-8">
          <View className="flex-row items-end gap-8">
            <TextField
              label={s.tempValue}
              size="sm"
              value={d.tempValue}
              inputMode="decimal"
              onChangeText={(tempValue) => change({ tempValue })}
              warning={warned.temp ? s.warnings[warned.temp] : undefined}
              className="flex-1"
            />
            <View>
              <SegmentedControl
                variant="pill"
                label={s.tempValue}
                value={d.tempScale}
                segments={[
                  { key: 'C', label: s.celsius },
                  { key: 'F', label: s.fahrenheit },
                ]}
                onChange={(tempScale) => change({ tempScale })}
              />
            </View>
          </View>
          <Text size={13} weight="600" color="ink-muted">
            {s.tempHint}
          </Text>
          <TextField
            label={s.tempText}
            size="sm"
            value={d.tempText}
            maxLength={120}
            placeholder={s.tempTextPlaceholder}
            hint={s.tempTextHint}
            onChangeText={(tempText) => change({ tempText })}
          />
          {temp ? <StepNote text={temp} /> : null}
        </View>
      ) : null}

      {d.tipOn ? (
        <TextField
          label={s.tipField}
          multiline
          value={d.tip}
          maxLength={200}
          placeholder={s.tipPlaceholder}
          counter={s.tipCounter(d.tip.length)}
          onChangeText={(tip) => change({ tip })}
        />
      ) : null}

      {d.photoOn ? (
        <PhotoField
          source={photo.source}
          loading={photo.loading}
          addLabel={f.addPhoto}
          onAdd={() => p.onPickPhoto(d.key)}
          changeLabel={f.changePhoto}
          onChange={() => p.onPickPhoto(d.key)}
          removeLabel={f.removePhoto}
          onRemove={() => p.onRemovePhoto(d.key)}
          photoLabel={s.photoLabel(number)}
          busyLabel={photo.uploading ? f.uploadingPhoto : undefined}
          disabled={photo.uploading}
        />
      ) : null}
      {d.photoOn && photo.failed ? (
        <View className="flex-row items-center gap-12">
          <Text size={14} weight="700" color="warn" className="flex-1">
            {f.photoFailed}
          </Text>
          <Link label={f.photoRetry} onPress={() => p.onRetryPhoto(d.key)} />
        </View>
      ) : null}

      <Link label={s.removeStep} tone="danger" onPress={() => p.onRemove(d.key)} className="self-start" />
    </StepEditCard>
  );
}
