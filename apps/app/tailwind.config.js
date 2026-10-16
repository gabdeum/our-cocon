// Classes come only from design/system/tokens.json, via the generated theme (`pnpm theme`).
const { theme, rootVars } = require('../../packages/ui/tailwind.theme.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app picks its theme in code (ThemeProvider; light only in V1), not from the system setting.
  darkMode: 'class',
  theme,
  plugins: [({ addBase }) => addBase({ ':root': rootVars })],
};
