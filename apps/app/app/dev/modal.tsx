import { router } from 'expo-router';
import { FormBar, FormProgress, PushedScreen, Text } from '@cocon/ui';
import { DevOnly } from '../../components/DevOnly';

// Full-screen modal presentation (forms and cooking mode, design/flows.md): no tab bar. Demo only.
export default function ModalDemo() {
  return (
    <DevOnly>
      <PushedScreen>
        <FormBar
          cancelLabel="Cancel"
          onCancel={() => router.back()}
          title="New recipe"
          saveLabel="Save"
          onSave={() => router.back()}
          progress={<FormProgress sections={[{ key: 'details', label: 'Details' }, { key: 'ingredients', label: 'Ingredients' }]} current="details" onSelect={() => undefined} />}
        />
        <Text>A route presented as a full-screen modal.</Text>
      </PushedScreen>
    </DevOnly>
  );
}
