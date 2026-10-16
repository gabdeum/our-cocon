import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { cn } from '../cn';
import { theme } from '../theme';

/**
 * The app's frame: cream ground, and on the web the mobile layout centred at max 720 wide
 * (constitution, Layout decision). Everything, the tab bar included, sits inside it.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 bg-surface-page" style={{ alignItems: 'center' }}>
      <View testID="app-frame" className="w-full flex-1 bg-surface-page" style={{ maxWidth: theme.layout.maxWidth }}>
        {children}
      </View>
    </View>
  );
}

/** Tab screen (Patterns.md): 54 top, 20 sides, 180 bottom (room for the tab bar and timer pill). */
export function TabScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView className="flex-1 bg-surface-page" contentContainerClassName={cn('gap-18 px-20 pb-[180px] pt-[54px]', className)}>
      {children}
    </ScrollView>
  );
}

/** Pushed screen without photo (Patterns.md): back link at the top, no tab bar. */
export function PushedScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView className="flex-1 bg-surface-page" contentContainerClassName={cn('gap-18 px-20 pb-28 pt-[54px]', className)}>
      {children}
    </ScrollView>
  );
}
