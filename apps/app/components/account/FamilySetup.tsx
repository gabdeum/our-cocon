import { useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, TextField } from '@cocon/ui';
import { DisplayName, FamilyName, type Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { FamilyApi } from '../../lib/family';
import { WelcomeHeader } from './WelcomeHeader';

const t = strings.welcome;

export interface FamilySetupProps {
  api: Pick<FamilyApi, 'createFamily'>;
  tracker: Tracker;
  suggestedName: string;
  /** After the family exists: reload the session, then go Home. */
  onCreated: () => void | Promise<void>;
}

/** "Set up your family" after a first sign-in (spec 003 User Story 1; OC-Welcome.md). */
export function FamilySetup({ api, tracker, suggestedName, onCreated }: FamilySetupProps) {
  const [name, setName] = useState(suggestedName);
  const [familyName, setFamilyName] = useState('');
  const [warnings, setWarnings] = useState<{ name?: string; family?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    const me = DisplayName.safeParse(name);
    const family = FamilyName.safeParse(familyName);
    if (!me.success || !family.success) {
      setWarnings({ name: me.success ? undefined : t.yourNameMissing, family: family.success ? undefined : t.familyNameMissing });
      return;
    }
    setBusy(true);
    const result = await api.createFamily(family.data, me.data);
    if (!result.ok) {
      setBusy(false);
      setError(t.saveFailed);
      return;
    }
    tracker.track('family_created', {});
    await onCreated();
  }

  return (
    <View className="gap-18">
      <WelcomeHeader title={t.familyTitle} lead={t.familyLead} />
      {error ? <Callout variant="warn" text={error} /> : null}
      <TextField
        label={t.yourName}
        hint={t.yourNameHint}
        warning={warnings.name}
        value={name}
        maxLength={40}
        autoComplete="given-name"
        onChangeText={(v) => {
          setName(v);
          setWarnings((w) => ({ ...w, name: undefined }));
        }}
      />
      <TextField
        label={t.familyName}
        placeholder={t.familyNamePlaceholder}
        warning={warnings.family}
        value={familyName}
        maxLength={60}
        onChangeText={(v) => {
          setFamilyName(v);
          setWarnings((w) => ({ ...w, family: undefined }));
        }}
        onSubmitEditing={() => void create()}
      />
      <Button label={t.createFamily} block busy={busy} busyLabel={t.creating} onPress={() => void create()} />
    </View>
  );
}
