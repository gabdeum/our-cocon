import { View } from 'react-native';
import { Lead, PushedScreen, RadioCard, Text } from '@cocon/ui';
import { AppLanguage, LanguageSetting } from '@cocon/schemas';
import { strings } from '../../strings';

const s = strings.settings.language;

export interface LanguageSettingsProps {
  setting: LanguageSetting;
  /** The device's own language, named in "Automatic (…)". */
  deviceLanguage: AppLanguage;
  onChoose: (setting: LanguageSetting) => void;
  onBack: () => void;
}

/**
 * Spec 076 FR-006: Menu › Language (not drawn). Automatic, then each language in its own words.
 * Applies at once.
 */
export function LanguageSettings({ setting, deviceLanguage, onChoose, onBack }: LanguageSettingsProps) {
  return (
    <PushedScreen className="gap-18" topBar={{ back: { label: s.back, onPress: onBack }, title: s.title }}>
      <Lead>{s.lead}</Lead>
      <View role="radiogroup" aria-label={s.title} className="gap-8">
        <RadioCard label={s.automatic(s.names[deviceLanguage])} selected={setting === 'automatic'} onPress={() => onChoose('automatic')} />
        {AppLanguage.options.map((language) => (
          <RadioCard key={language} label={s.names[language]} selected={setting === language} onPress={() => onChoose(language)} />
        ))}
      </View>
      <View className="gap-4">
        <Text size={13} weight="600" color="ink-muted">
          {s.automaticHint}
        </Text>
        <Text size={13} weight="600" color="ink-muted">
          {s.typedContent}
        </Text>
      </View>
    </PushedScreen>
  );
}
