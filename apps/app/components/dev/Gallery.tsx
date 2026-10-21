// /dev/gallery (spec 002): every packages/ui component in the states its design/system preview.html
// shows, with the same sample content, so the two can be compared side by side at 390 px.
// Developer-only page: the sample text here is demo content, not app copy (strings/en.ts).
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  AmountField,
  AvatarStack,
  Avatar,
  AwakeChip,
  BackHeader,
  BottomSheet,
  BrandHeader,
  Button,
  Callout,
  Card,
  Choice,
  CookProgress,
  CookSection,
  CookTimerCard,
  Dialog,
  FilterButton,
  FormBar,
  FormProgress,
  HeroCard,
  Icon,
  IconButton,
  IconTile,
  IngredientEditCard,
  IngredientRow,
  Link,
  ListGroup,
  ListRow,
  Meta,
  MonthPicker,
  Overline,
  PersonPill,
  Pill,
  PillRow,
  Presence,
  PushedScreen,
  RadioCard,
  ResultTile,
  RecipeItem,
  RecipeItemSkeleton,
  ReorderList,
  SearchField,
  SegmentedControl,
  PhotoCrop,
  PhotoField,
  PhotoPlaceholder,
  SettingRow,
  SheetFooter,
  StatTile,
  StatusBanner,
  StepCard,
  StepEditCard,
  StepFootnote,
  StepNote,
  StepPreview,
  StepText,
  Stepper,
  TabBar,
  TabHeader,
  Tag,
  Text,
  TextField,
  TimerCard,
  TimerPill,
  TimePresets,
  TimerRow,
  ToggleTile,
  TokenEditor,
  theme,
  type IconName,
  type TextVariant,
} from '@cocon/ui';
import { iconShapes } from '@cocon/ui/icons.generated';

const noop = () => undefined;

function Section({ title, group, children }: { title: string; group: string; children: ReactNode }) {
  return (
    <View className="gap-12">
      <View>
        <Overline>{group}</Overline>
        <Text variant="titleLg" role="heading">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const family = [
  { initial: 'G', tone: 'honey' },
  { initial: 'A', tone: 'sage' },
  { initial: 'M', tone: 'peach' },
] as const;

const tabs = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'recipes', label: 'Recipes', icon: 'recipes' },
  { key: 'groceries', label: 'Groceries', icon: 'groceries' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
] as const;

// Any image will do for the photo components; the app icon is always bundled.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const samplePhoto = require('../../assets/icon.png') as number;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Gallery({ onBack, onOpenSheetRoute, onOpenModalRoute }: { onBack: () => void; onOpenSheetRoute: () => void; onOpenModalRoute: () => void }) {
  const [screenOn, setScreenOn] = useState(true);
  const [thermometer, setThermometer] = useState(false);
  const [checks, setChecks] = useState(true);
  const [units, setUnits] = useState('metric');
  const [store, setStore] = useState('us');
  const [view, setView] = useState('ingredients');
  const [servings, setServings] = useState(6);
  const [best, setBest] = useState([0, 1, 2, 9, 10, 11]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [photo, setPhoto] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('recipes');
  const [cookStep, setCookStep] = useState(2);
  const [section, setSection] = useState('steps');
  const [amount, setAmount] = useState('250');
  const [unit, setUnit] = useState('g');
  const [pick, setPick] = useState('lardons');

  return (
    <PushedScreen>
      <BackHeader backLabel="Home" onBack={onBack} title="Gallery" lead="Every component in every state, next to design/system previews." />

      <Section group="Foundations" title="Text styles">
        {(Object.keys(theme.text) as TextVariant[]).map((v) => (
          <Text key={v} variant={v} uppercase={v === 'overline'}>
            {`${v} · ${theme.text[v].fontSize}/${theme.text[v].fontWeight}`}
          </Text>
        ))}
      </Section>

      <Section group="Foundations" title="Icons">
        <PillRow>
          {(Object.keys(iconShapes) as IconName[]).map((name) => (
            <View key={name} className="items-center gap-4">
              <Icon name={name} size="md" />
              <Text variant="tag">{name}</Text>
            </View>
          ))}
        </PillRow>
      </Section>

      <Section group="Actions" title="Button">
        <Button label="Start cooking" icon="play" block />
        <PillRow>
          <Button label="Next step" variant="olive" />
          <Button label="Start timer" variant="honey" />
          <Button label="Cancel" variant="soft" />
          <Button label="Save" variant="olive" size="sm" />
        </PillRow>
        <PillRow>
          <Button label="Add to groceries…" variant="outline" />
          <Button label="Continue with Google" variant="outline" brand="google" />
          <Button label="+ Add a step" variant="dashed" />
          <Button label="Delete recipe" variant="danger" />
        </PillRow>
        <PillRow>
          <Button label="Swap ingredient" variant="tile" />
          <Button label="Add a step" variant="tile" />
        </PillRow>
        <PillRow>
          <Button label="Nothing selected" disabled />
          <Link label="Clear all" />
          <Link label="Delete this recipe" tone="danger" />
        </PillRow>
        <PillRow>
          <Button label="Start cooking" size="lg" />
          <Button label="Save recipe" busy busyLabel="Saving…" />
        </PillRow>
      </Section>

      <Section group="Actions" title="IconButton">
        <View className="rounded-xl bg-peach p-16">
          <PillRow>
            <IconButton icon="back" label="Back" />
            <IconButton icon="share" label="Share recipe" />
            <IconButton icon="close" label="Close" variant="soft" />
            <IconButton icon="plus" label="More servings" variant="olive" />
            <IconButton icon="more" label="More options" variant="square" expanded={false} />
            <IconButton icon="more" label="More options" variant="square" expanded />
            <IconButton icon="plus" label="Add item" variant="olive-square" />
          </PillRow>
        </View>
      </Section>

      <Section group="Actions" title="Pill">
        <PillRow>
          <FilterButton label="Filters · 1" />
          <Pill label="In season" selected />
          <Pill label="Under 30 min" />
        </PillRow>
        <PillRow>
          <Choice label="Classic" selected />
          <Choice label="Vegetarian" />
          <PersonPill label="Gabriel" initial="G" tone="honey" />
        </PillRow>
      </Section>

      <Section group="Display" title="Tag">
        <PillRow>
          <Tag label="Variant" tone="sage" />
          <Tag label="To buy" tone="warn" />
          <Tag label="+1" tone="honey" />
          <Tag label="Latest recipe" tone="white" />
          <Tag label="Tip" tone="soft" />
        </PillRow>
        <PillRow>
          <Meta label="1 h 10" />
          <Meta label="Best Oct – Mar" />
          <Meta label="Gabriel · via Claude" tone="sage" />
          <Meta label="2 to buy" tone="warn" />
        </PillRow>
      </Section>

      <Section group="Display" title="IconTile">
        <PillRow>
          <IconTile icon="swap" tone="sage" />
          <IconTile icon="plus" tone="honey" />
        </PillRow>
      </Section>

      <Section group="Display" title="StatTile">
        <View className="flex-row gap-12">
          <StatTile icon="groceries" value={7} label="to buy" tone="honey" onPress={noop} className="flex-1" />
          <StatTile icon="recipes" value={32} label="family recipes" tone="sage" onPress={noop} className="flex-1" />
        </View>
      </Section>

      <Section group="Display" title="ResultTile">
        <View className="flex-row gap-10">
          <ResultTile value="1¼" label="cups" main className="flex-1" />
          <ResultTile value="20" label="tablespoons" className="flex-1" />
        </View>
        <Card tone="sage">
          <Text size={16} weight="900">
            Recipe × 1.25 → about 7½ servings
          </Text>
        </Card>
      </Section>

      <Section group="Display" title="Callout">
        <Callout variant="tip" label="Chef's tip" text="Chill the lined pan for 10 minutes so the edges don't shrink." />
        <Callout variant="temp" label="Temperature check:" text="the center should reach 71 °C (160 °F) and barely wobble." />
        <Callout variant="ai" label="AI" text="Faster: tell your AI assistant “Save Grandma's quiche to Our Cocon”." />
        <Callout variant="info" icon="view-only" text="View only. Anyone with the link can read this recipe." />
        <Callout variant="warn" text="You're offline. You can read, but changes need a connection." />
      </Section>

      <Section group="Display" title="Avatar">
        <PillRow>
          <AvatarStack members={[...family]} moreLabel={(n) => `+${n}`} label="Gabriel, Alex and Mia" />
          <Avatar initial="G" tone="honey" size="lg" />
          <Avatar initial="A" tone="sage" size="lg" />
          <Avatar initial="M" tone="peach" size="sm" />
        </PillRow>
      </Section>

      <Section group="Display" title="StatusBanner">
        <StatusBanner message="Added to the family list" actionLabel="Undo" onAction={noop} />
        <StatusBanner tone="warn" message="You're offline. You can read, but changes need a connection." />
        <PillRow>
          <Presence label="Mia is shopping" />
          <AwakeChip label="Screen stays on" />
        </PillRow>
      </Section>

      <Section group="Inputs" title="Switch">
        <ListGroup inset>
          <SettingRow label="Keep screen on while cooking" hint="So it doesn't lock with floury hands" value={screenOn} onValueChange={setScreenOn} />
          <SettingRow label="I have a thermometer" hint="Off: hides temperature checks in steps" value={thermometer} onValueChange={setThermometer} />
          <SettingRow label="Thermometer checks" changedHint="Changed for this recipe" resetLabel="Reset" onReset={noop} value={checks} onValueChange={setChecks} last />
        </ListGroup>
        <SettingRow boxed label="Make my own dough" hint="Adds 3 ingredients and 1 step" value={screenOn} onValueChange={setScreenOn} />
      </Section>

      <Section group="Inputs" title="SegmentedControl">
        <SegmentedControl label="Units" segments={[{ key: 'metric', label: 'Metric · g, ml, °C' }, { key: 'imperial', label: 'Imperial · oz, °F' }]} value={units} onChange={setUnits} />
        <SegmentedControl label="Store" variant="pill" segments={[{ key: 'us', label: 'US' }, { key: 'eu', label: 'Europe' }]} value={store} onChange={setStore} />
        <SegmentedControl label="Recipe" variant="tabs" segments={[{ key: 'ingredients', label: 'Ingredients · 9' }, { key: 'steps', label: 'Steps · 6' }]} value={view} onChange={setView} />
      </Section>

      <Section group="Inputs" title="Stepper">
        <Card className="flex-row items-center gap-8 py-12 pl-16 pr-12">
          <Text variant="labelLg" className="flex-1">
            Servings
          </Text>
          <Stepper value={servings} onChange={setServings} decreaseLabel="Fewer servings" increaseLabel="More servings" />
          <IconButton icon="more" label="More options" variant="square" expanded={moreOpen} onPress={() => setMoreOpen(!moreOpen)} className="ml-4" />
        </Card>
      </Section>

      <Section group="Inputs" title="TextField">
        <SearchField label="Search recipes" placeholder="Search recipes or ingredients" />
        <TextField label="Recipe name" defaultValue="Leek & bacon quiche" />
        <TextField label="Short description" multiline defaultValue="Silky custard, sweet leeks and a crisp, buttery crust." hint="One sentence that makes people hungry." counter="54 / 140" />
        <TextField label="Unit" size="sm" placeholder="Unit?" warning="Pick a unit so we can convert and scale it." />
      </Section>

      <Section group="Inputs" title="AmountField">
        <AmountField label="2. How much do you have?" value={amount} onChangeText={setAmount} unit={unit} units={['g', 'kg', 'oz', 'lb']} onUnitChange={setUnit} unitLabel={(u) => u} unitA11y="Unit" />
        <AmountField label="Convert" size="xl" value="" onChangeText={noop} unit="ml" units={['ml']} onUnitChange={noop} unitLabel={(u) => u} unitA11y="Unit" hint="Enter how much you have" />
      </Section>

      <Section group="Inputs" title="RadioCard">
        <View role="radiogroup" aria-label="Which ingredient?" className="gap-8">
          <RadioCard label="Leeks" value="2 (300 g)" selected={pick === 'leeks'} onPress={() => setPick('leeks')} />
          <RadioCard label="Bacon lardons" value="200 g" selected={pick === 'lardons'} onPress={() => setPick('lardons')} />
        </View>
      </Section>

      <Section group="Inputs" title="MonthPicker">
        <MonthPicker label="Best months" monthLabels={months} value={best} onChange={setBest} hint="Leave empty if it's good all year." />
      </Section>

      <Section group="Inputs" title="PhotoField">
        <PhotoField
          source={photo}
          addLabel="Add a photo (optional)"
          onAdd={() => setPhoto(samplePhoto)}
          changeLabel="Change photo"
          onChange={noop}
          removeLabel="Remove"
          onRemove={() => setPhoto(null)}
          photoLabel="Recipe photo"
        />
        <PhotoField source={samplePhoto} addLabel="Add a photo (optional)" onAdd={noop} changeLabel="Change photo" onChange={noop} removeLabel="Remove" onRemove={noop} photoLabel="Recipe photo" busyLabel="Uploading photo…" />
      </Section>

      <Section group="Inputs" title="PhotoCrop">
        <View className="overflow-hidden rounded-xl">
          <PhotoCrop
            source={samplePhoto}
            image={{ width: 1024, height: 1024 }}
            title="Fit your photo"
            hint="Drag to choose what shows in the header."
            zoomInLabel="Zoom in"
            zoomOutLabel="Zoom out"
            confirmLabel="Use photo"
            onConfirm={noop}
            cancelLabel="Cancel"
            onCancel={noop}
          />
        </View>
      </Section>

      <Section group="Inputs" title="IngredientEditCard">
        <IngredientEditCard
          name="Leeks"
          onNameChange={noop}
          nameLabel="Ingredient name"
          quantity="2"
          onQuantityChange={noop}
          quantityLabel="Quantity"
          unit="pieces"
          unitPlaceholder="Unit"
          unitLabel="Unit"
          onUnitPress={noop}
          weight={{ value: '150', onChange: noop, label: 'Weight of one (g)', prefix: 'each ≈', suffix: 'g' }}
          removeLabel="Remove Leeks"
          onRemove={noop}
        />
        <IngredientEditCard
          name="Heavy cream"
          onNameChange={noop}
          nameLabel="Ingredient name"
          quantity="300"
          onQuantityChange={noop}
          quantityLabel="Quantity"
          unit={null}
          unitPlaceholder="Unit?"
          unitLabel="Unit"
          onUnitPress={noop}
          removeLabel="Remove Heavy cream"
          onRemove={noop}
          warning="Pick a unit so we can convert and scale it."
          warningField="unit"
        />
      </Section>

      <Section group="Inputs" title="TokenEditor">
        <TokenEditor
          label="Instructions"
          parts={['In a large pan, melt ', { chip: 'Butter', tone: 'sage' }, ' over medium heat. Add ', { chip: 'Leeks', tone: 'sage' }, ' and bake at ', { chip: '180 °C (350 °F)', tone: 'sage' }, '.']}
          value="In a large pan, melt Butter over medium heat. Add Leeks and bake at 180 °C (350 °F)."
          onChangeText={noop}
          hint="Type @ or tap below to insert an ingredient. Its amount fills in and scales by itself."
        />
        <TokenEditor
          label="Instructions"
          parts={['Top with ', { chip: 'Missing ingredient', tone: 'warn' }, '.']}
          value="Top with Missing ingredient."
          onChangeText={noop}
          warning="This ingredient was removed. Delete the chip or add it back."
        />
      </Section>

      <Section group="Inputs" title="ToggleTile">
        <View className="flex-row gap-8">
          <ToggleTile label="Timer" selectedLabel="Timer ✓" selected onPress={noop} />
          <ToggleTile label="Temperature check" selectedLabel="Temperature check ✓" selected={false} onPress={noop} />
        </View>
      </Section>

      <Section group="Lists and cards" title="StepEditCard">
        <StepEditCard number={1} expanded={false} title="Preheat and line" badges={['Tip']} openLabel="Step 1, Preheat and line. Tap to edit." onOpen={noop} />
        <StepEditCard number={2} expanded={false} title="Blind bake" badges={['12 min']} openLabel="Step 2, Blind bake. Tap to edit." onOpen={noop} />
        <StepEditCard number={3} expanded title="Cook the filling" openLabel="Step 3" onOpen={noop} header={<Text weight="800">Cook the filling</Text>}>
          <StepPreview label="Preview">
            <StepText compact parts={['…melt ', { amount: '20 g butter' }, ' over medium heat. Add ', { amount: '2 leeks (300 g)' }, ' finely sliced…']} />
          </StepPreview>
          <StepNote text="Temperature check: center reaches 71 °C (160 °F)" />
        </StepEditCard>
        <StepEditCard number={5} expanded={false} title="Bake" badges={['35 min', 'Temp check', 'Photo']} openLabel="Step 5, Bake. Tap to edit." onOpen={noop} attention />
      </Section>

      <Section group="Lists and cards" title="ReorderList">
        <ReorderGallery />
      </Section>

      <Section group="Lists and cards" title="ListRow">
        <ListGroup title="Dairy & eggs">
          <ListRow title="Heavy cream" sub="For Leek & bacon quiche" leading={{ kind: 'checkbox', checked: false }} trailing={{ kind: 'buy', buy: 'Buy 1 pint carton', need: 'Need 300 ml · ~170 ml left over' }} onPress={noop} />
          <ListRow title="Sourdough loaf" sub="Added by Gabriel" done leading={{ kind: 'checkbox', checked: true }} trailing={{ kind: 'buy', buy: 'Buy 1 loaf', need: 'Need 1' }} onPress={noop} />
          <ListRow title="Heavy cream" sub="Already on the list (100 ml) → will be 400 ml" subTone="warn" leading={{ kind: 'checkbox', checked: true }} trailing={{ kind: 'value', text: '300 ml' }} onPress={noop} last />
        </ListGroup>
        <View>
          <IngredientRow amount="2" name="Leeks" sub="300 g" />
          <IngredientRow amount="250 g" name="Mushrooms, sliced" tag={{ label: 'Variant', tone: 'sage' }} />
        </View>
        <ListGroup>
          <ListRow title="AI assistants" leading={{ kind: 'avatar', initial: 'G', tone: 'honey' }} trailing={{ kind: 'chevron' }} onPress={noop} last />
        </ListGroup>
      </Section>

      <Section group="Lists and cards" title="Card">
        <View className="flex-row gap-12">
          <PhotoPlaceholder label="[Quiche photo]" className="flex-1 rounded-xl py-28" />
          <PhotoPlaceholder initial="L" className="flex-1 rounded-xl py-28" />
        </View>
        <HeroCard title="Leek & bacon quiche" badge="Latest recipe" photoLabel="[Quiche photo]" chips={[{ label: '1 h 10' }, { label: 'Serves 6' }, { label: '2 to buy', tone: 'warn' }]} onPress={noop} />
        <Card tone="soft" className="flex-row items-center">
          <View className="flex-1">
            <Text size={15} weight="800">
              For Leek & bacon quiche
            </Text>
            <Text variant="caption" color="ink-muted">
              2 items · serves 6
            </Text>
          </View>
          <Link label="Open" />
        </Card>
        <Card selected>
          <Text>Selected</Text>
        </Card>
        <Card attention>
          <Text>Needs attention</Text>
        </Card>
      </Section>

      <Section group="Lists and cards" title="RecipeItem">
        <RecipeItem name="Leek & bacon quiche" meta="1 h 10 · Serves 6 · 2 variants" author="Gabriel · via Claude" onPress={noop} />
        <RecipeItem name="Grandma's apple tart" meta="1 h 30 · Serves 8" author="Mia" placeholderTone="sage" onPress={noop} />
        <RecipeItemSkeleton />
      </Section>

      <Section group="Cooking" title="StepCard">
        <StepCard number={3} name="Cook the filling" parts={['In a large pan, melt ', { amount: '20 g butter' }, ' over medium heat. Add ', { amount: '2 leeks (300 g)' }, ' finely sliced and cook 6–8 minutes until soft.']}>
          <TimerRow state="running" label="Pause" clock="06:12" onPress={noop} minusLabel="−1" plusLabel="+1" minusA11y="One minute less" plusA11y="One minute more" onMinus={noop} onPlus={noop} />
          <Callout variant="tip" label="Chef's tip" text="Slice the leeks thinly so they melt into the custard." />
        </StepCard>
        <StepCard number={5} name="Bake" parts={[]} variantTag="Variant">
          <Callout variant="temp" label="Temperature check:" text="center reaches 71 °C (160 °F)." />
          <TimerRow state="idle" label="Start timer" clock="35:00" onPress={noop} minusLabel="−1" plusLabel="+1" minusA11y="One minute less" plusA11y="One minute more" onMinus={noop} onPlus={noop} />
        </StepCard>
        <StepFootnote text="−1 / +1 changes a timer by a minute, even while it runs." />
      </Section>

      <Section group="Cooking" title="TimerCard">
        <CookTimerCard label="Blind bake timer" clock="11:42" actionLabel="Pause" onAction={noop} minusLabel="−1" plusLabel="+1" minusA11y="One minute less" plusA11y="One minute more" onMinus={noop} onPlus={noop} />
        {(['running', 'paused', 'done'] as const).map((state) => (
          <TimerCard
            key={state}
            name="Blind bake"
            sub={`Leek & bacon quiche · ${state === 'running' ? 'Running' : state === 'paused' ? 'Paused' : 'Done'}`}
            state={state}
            clock={state === 'done' ? '00:00' : '11:42'}
            progress={state === 'done' ? 1 : 0.4}
            actionLabel={state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Add 1 more minute'}
            onAction={noop}
            secondaryLabel={state === 'done' ? 'Dismiss' : 'Stop'}
            onSecondary={noop}
            minusLabel="−1"
            plusLabel="+1"
            minusA11y="One minute less"
            plusA11y="One minute more"
            onMinus={noop}
            onPlus={noop}
          />
        ))}
      </Section>

      <Section group="Cooking" title="CookLayout">
        {/* The full frame (header, Back / Next) is cooking mode itself: /recipes/[id]/cook. */}
        <CookSection title="Blind bake" current>
          <StepText parts={['Bake the empty crust for 12 minutes until pale golden.']} cook />
          <CookTimerCard label="Blind bake timer" clock="12:00" actionLabel="Start timer" onAction={noop} minusLabel="−1" plusLabel="+1" minusA11y="One minute less" plusA11y="One minute more" onMinus={noop} onPlus={noop} />
        </CookSection>
        <CookSection title="Cook the filling" current={false}>
          <StepText parts={['Melt ', { amount: '20 g butter' }, ' over medium heat.']} cook />
          <Callout variant="tip" label="Chef's tip" text="Slice the leeks thinly so they melt into the custard." cook />
        </CookSection>
      </Section>

      <Section group="Cooking" title="TimerPill">
        <TimerPill name="Blind bake" clock="11:42" more="+1" label="2 timers running. Open timers" onPress={noop} />
        <TimerPill name="Kitchen timer" clock="06:39" label="1 timer running. Open timers" onPress={noop} />
      </Section>

      <Section group="Cooking" title="TimePresets">
        <TimePresets label="Quick kitchen timer" presets={[5, 10, 15, 30].map((m) => ({ label: `${m} min`, a11y: `Start a ${m} min kitchen timer`, onPress: noop }))} />
      </Section>

      <Section group="Overlays" title="BottomSheet">
        <PillRow>
          <Button label="Open sheet" variant="soft" onPress={() => setSheet(true)} />
          <Button label="Sheet route" variant="soft" onPress={onOpenSheetRoute} />
          <Button label="Full-screen modal" variant="soft" onPress={onOpenModalRoute} />
        </PillRow>
        <BottomSheet
          visible={sheet}
          onClose={() => setSheet(false)}
          title="Add to groceries"
          lead="Leek & bacon quiche · serves 6. Untick anything you already have."
          closeLabel="Close"
          footer={<SheetFooter cancel={{ label: 'Cancel', onPress: () => setSheet(false) }} primary={{ label: 'Add 3 items', onPress: () => setSheet(false) }} />}
        >
          <ListGroup>
            <ListRow title="Gruyère" leading={{ kind: 'checkbox', checked: true }} trailing={{ kind: 'value', text: '100 g' }} onPress={noop} last />
          </ListGroup>
        </BottomSheet>
      </Section>

      <Section group="Overlays" title="Dialog">
        <Button label="Open dialog" variant="soft" onPress={() => setDialog(true)} />
        <Dialog
          visible={dialog}
          title="Delete “Leek & bacon quiche”?"
          body="It will disappear for the whole family, along with its 2 variants. You can bring it back from Recently deleted for 30 days."
          confirmLabel="Delete recipe"
          onConfirm={() => setDialog(false)}
          cancelLabel="Keep it"
          onCancel={() => setDialog(false)}
        />
      </Section>

      <Section group="Navigation" title="TabBar">
        {[false, true].map((withPill) => (
          <View key={String(withPill)} className={withPill ? 'h-[160px]' : 'h-[100px]'}>
            <TabBar
              label="Main"
              items={[...tabs]}
              active={tab}
              onSelect={setTab}
              timerPill={withPill ? <TimerPill name="Blind bake" clock="11:42" more="+1" label="2 timers running. Open timers" onPress={noop} /> : undefined}
            />
          </View>
        ))}
      </Section>

      <Section group="Navigation" title="Progress">
        <FormProgress
          sections={[
            { key: 'details', label: 'Details' },
            { key: 'ingredients', label: 'Ingredients' },
            { key: 'steps', label: 'Steps' },
            { key: 'variants', label: 'Variants' },
          ]}
          current={section}
          onSelect={setSection}
        />
        <CookProgress count={6} current={cookStep} onSelect={setCookStep} stepLabel={`Step ${cookStep + 1} of 6`} hint="Swipe or tap" segmentLabel={(i) => `Go to step ${i + 1}`} />
      </Section>

      <Section group="Navigation" title="ScreenHeader">
        <BrandHeader brand="Our Cocon" avatars={<AvatarStack members={[...family]} moreLabel={(n) => `+${n}`} label="Gabriel, Alex and Mia" />} date="Thursday 16 October" greeting="Good evening, Gabriel" />
        <TabHeader title="Groceries" sub="7 items to buy · shared with family" action={<Presence label="Mia is shopping" />} />
        <BackHeader backLabel="Settings" onBack={noop} title="AI assistants" lead="Use Our Cocon from the assistant you already talk to." />
        <FormBar cancelLabel="Cancel" onCancel={noop} title="New recipe" saveLabel="Save" onSave={noop} />
      </Section>
    </PushedScreen>
  );
}

/** ReorderList with three rows that really move (drag the handle, or the arrow keys on it). */
function ReorderGallery() {
  const [rows, setRows] = useState(['Leeks', 'Bacon lardons', 'Heavy cream']);
  return (
    <ReorderList
      items={rows}
      keyOf={(r) => r}
      handleLabel="Drag to reorder"
      moveUpLabel="Move up"
      moveDownLabel="Move down"
      onMove={(from, to) =>
        setRows((now) => {
          const next = [...now];
          const [row] = next.splice(from, 1);
          if (row) next.splice(to, 0, row);
          return next;
        })
      }
      renderItem={(r, _i, handle) => (
        <Card>
          <View className="flex-row items-center gap-8">
            {handle}
            <Text weight="800">{r}</Text>
          </View>
        </Card>
      )}
    />
  );
}
