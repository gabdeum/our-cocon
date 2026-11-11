import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { setWebAnnouncer } from './a11y';
import { vars } from 'nativewind';
import { defaultTheme, themeColors, themeVars, type ThemeId } from './theme';

const ThemeContext = createContext<ThemeId>(defaultTheme);

// Made once per theme: a new `vars()` on each render makes NativeWind recreate every colour variable,
// and every component on screen then subscribed to the new ones (memory grew until they restyled).
const themeStyles = Object.fromEntries(Object.entries(themeVars).map(([id, v]) => [id, vars(v)])) as Record<ThemeId, ReturnType<typeof vars>>;

/**
 * Applies one theme's colours to everything inside it. Classes like `bg-honey` read these
 * variables, so another theme (e.g. dark, once tokens.json has it) needs no component change.
 * V1 is light only (spec 002, FR-006).
 */
export function ThemeProvider({ theme = defaultTheme, children }: { theme?: ThemeId; children: ReactNode }) {
  return (
    <ThemeContext.Provider value={theme}>
      <View className="flex-1" style={themeStyles[theme]}>
        {children}
        {Platform.OS === 'web' ? <WebAnnouncer /> : null}
      </View>
    </ThemeContext.Provider>
  );
}

/** The web's one polite live region, fed by `announce()` (spec 030 FR-002). */
function WebAnnouncer() {
  const [text, setText] = useState('');
  useEffect(() => {
    // Clear first so the same words said twice are announced twice.
    setWebAnnouncer((next) => {
      setText('');
      setTimeout(() => setText(next), 50);
    });
    return () => setWebAnnouncer(null);
  }, []);
  return (
    <Text aria-live="polite" role="status" style={visuallyHidden}>
      {text}
    </Text>
  );
}

const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 } as const;

/** Raw colour values of the current theme, for props that can't take a class (SVG strokes). */
export function useThemeColors() {
  return themeColors[useContext(ThemeContext)];
}
