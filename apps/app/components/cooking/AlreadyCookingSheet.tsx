import { View } from 'react-native';
import { BottomSheet, Button } from '@cocon/ui';
import { strings } from '../../strings/en';

const p = strings.recipePage;

export interface AlreadyCookingSheetProps {
  /** Who's cooking it and at which step (from 1); null: closed. `mine`: the member started it. */
  cook: { member: string; step: number; mine: boolean } | null;
  onResume: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

/**
 * Spec 051 › Warnings and errors: "Start recipe" when someone is already cooking it (one open cook
 * per recipe). Resume picks it up; Start over cancels it and starts at step 1.
 */
export function AlreadyCookingSheet({ cook, onResume, onStartOver, onClose }: AlreadyCookingSheetProps) {
  if (!cook) return null;
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={cook.mine ? p.alreadyCookingYou(cook.step) : p.alreadyCooking(cook.member, cook.step)}
      lead={p.alreadyCookingLead}
      closeLabel={strings.cookDone.close}
      footer={
        <View className="gap-10">
          <Button label={cook.mine ? p.resumeYours : p.resumeTheirs(cook.member)} icon="play" variant="ink" block onPress={onResume} />
          <Button label={p.startOver} variant="soft" block onPress={onStartOver} />
        </View>
      }
    >
      {null}
    </BottomSheet>
  );
}
