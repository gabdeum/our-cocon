import { Text, View } from 'react-native';
import { DebugFooter } from '../components/DebugFooter';
import { loadConfig } from '../lib/config';
import { strings } from '../strings/en';

// Placeholder until spec 002 adds the tab shell.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text accessibilityRole="header">{strings.app.name}</Text>
      <DebugFooter config={loadConfig()} />
    </View>
  );
}
