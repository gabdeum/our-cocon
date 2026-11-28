import { BottomSheet, Choice, PillRow } from '@cocon/ui';
import { Cuisine } from '@cocon/schemas';
import { getLanguage, strings } from '../../../strings';

const f = strings.recipeForm;

/** Every cuisine by its label, alphabetically, then "Other" (OC-EditBasics › Cuisine picker). */
/** Alphabetical in the app's language. */
const choices = () => [...Cuisine.options].sort((a, b) => strings.cuisines[a].localeCompare(strings.cuisines[b], getLanguage()));

/** The Cuisine picker: tapping a pill picks it and closes; "Other" leaves the field empty. */
export function CuisineSheet({ visible, value, onPick, onClose }: { visible: boolean; value: Cuisine | null; onPick: (cuisine: Cuisine | null) => void; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} title={f.cuisine} closeLabel={f.close} onClose={onClose}>
      <PillRow>
        {choices().map((c) => (
          <Choice key={c} label={strings.cuisines[c]} selected={value === c} onPress={() => onPick(c)} />
        ))}
        <Choice label={f.cuisineOther} selected={false} onPress={() => onPick(null)} />
      </PillRow>
    </BottomSheet>
  );
}
