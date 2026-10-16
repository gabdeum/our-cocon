import { createContext, useContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { defaultTheme, themeColors, themeVars, type ThemeId } from './theme';

const ThemeContext = createContext<ThemeId>(defaultTheme);

/**
 * Applies one theme's colours to everything inside it. Classes like `bg-honey` read these
 * variables, so another theme (e.g. dark, once tokens.json has it) needs no component change.
 * V1 is light only (spec 002, FR-006).
 */
export function ThemeProvider({ theme = defaultTheme, children }: { theme?: ThemeId; children: ReactNode }) {
  return (
    <ThemeContext.Provider value={theme}>
      <View className="flex-1" style={vars(themeVars[theme])}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/** Raw colour values of the current theme, for props that can't take a class (SVG strokes). */
export function useThemeColors() {
  return themeColors[useContext(ThemeContext)];
}
