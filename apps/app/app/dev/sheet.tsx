import { router } from 'expo-router';
import { BottomSheet, ListGroup, ListRow, SheetFooter } from '@cocon/ui';
import { DevOnly } from '../../components/DevOnly';

// Sheet presentation (design/flows.md): a route drawn as a BottomSheet over the previous screen,
// with no tab bar. Demo content only.
export default function SheetDemo() {
  const close = () => router.back();
  return (
    <DevOnly>
      <BottomSheet
        visible
        onClose={close}
        title="Filters"
        lead="A route presented as a sheet."
        closeLabel="Close"
        footer={<SheetFooter cancel={{ label: 'Cancel', onPress: close }} primary={{ label: 'Show 12 recipes', onPress: close }} />}
      >
        <ListGroup>
          <ListRow title="In season" leading={{ kind: 'checkbox', checked: true }} onPress={close} last />
        </ListGroup>
      </BottomSheet>
    </DevOnly>
  );
}
