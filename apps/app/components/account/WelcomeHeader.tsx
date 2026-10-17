import { View } from 'react-native';
import { Logo, Text } from '@cocon/ui';

/** Top of the signed-out pages (design/ui/OC-Welcome.md): the mark, a title and a lead. */
export function WelcomeHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <View className="gap-12">
      <Logo size={56} />
      <Text variant="displayLg" role="heading" aria-level={1}>
        {title}
      </Text>
      {lead ? (
        <Text size={15} weight="600" color="ink-muted">
          {lead}
        </Text>
      ) : null}
    </View>
  );
}
