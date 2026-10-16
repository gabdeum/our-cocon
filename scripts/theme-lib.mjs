// Pure functions behind `pnpm theme` (scripts/theme.mjs): design/system/tokens.json and the SVGs in
// design/system/assets become the generated files in packages/ui. Kept free of file writes so
// scripts/theme.test.ts can check them.

const HEADER = 'Generated from design/system by `pnpm theme` (spec 002). Do not edit by hand.';

// Nunito weights shipped by @expo-google-fonts/nunito, by the family name expo-font registers.
export const NUNITO = {
  400: 'Nunito_400Regular',
  500: 'Nunito_500Medium',
  600: 'Nunito_600SemiBold',
  700: 'Nunito_700Bold',
  800: 'Nunito_800ExtraBold',
  900: 'Nunito_900Black',
};

// Fills that have a pressed state ("darken the fill about 6%", Button README). Derived, not tokens.
export const PRESSED = ['ink', 'olive', 'honey', 'sage', 'surface-soft', 'surface-card', 'danger'];

export const MAX_WIDTH = 720;

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const px = (value) => {
  const n = Number.parseFloat(value);
  if (!String(value).endsWith('px') || Number.isNaN(n)) throw new Error(`Expected a px value, got ${value}`);
  return n;
};
const strip = (name, prefix) => (name.startsWith(prefix) ? name.slice(prefix.length) : name);
const round = (n) => Math.round(n * 100) / 100;

/** `#RRGGBB` darkened by `amount` (0.06 = 6% towards black). */
export function darken(hex, amount = 0.06) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Can only darken #RRGGBB colours, got ${hex}`);
  const n = Number.parseInt(m[1], 16);
  const channel = (shift) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * Colour values per theme. A token's `value` is the first theme's; another theme (e.g. dark) gives
 * its own value in `values: { dark: "#…" }` and falls back to the first theme's when missing.
 */
export function colorThemes(tokens) {
  const ids = tokens.color.themes.map((t) => t.id);
  const out = {};
  for (const id of ids) {
    const colors = {};
    for (const token of tokens.color.tokens) {
      colors[token.name] = (id === ids[0] ? undefined : token.values?.[id]) ?? token.value;
    }
    for (const name of PRESSED) colors[`${name}-pressed`] = darken(colors[name]);
    out[id] = colors;
  }
  return out;
}

export function textStyles(tokens) {
  const out = {};
  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      const fontSize = px(style.fontSize);
      const weight = String(style.fontWeight);
      if (!NUNITO[weight]) throw new Error(`No Nunito file for weight ${weight} (${style.name})`);
      out[style.name] = {
        fontSize,
        lineHeight: round(fontSize * Number(style.lineHeight)),
        fontWeight: weight,
        letterSpacing: style.letterSpacing ? px(style.letterSpacing) : 0,
        fontFamily: NUNITO[weight],
      };
    }
  }
  return out;
}

/** The values of `packages/ui/theme.ts`. Colours are the first (default) theme's. */
export function themeObject(tokens) {
  const themes = colorThemes(tokens);
  const first = themes[tokens.color.themes[0].id];
  const byName = (list, prefix, value) =>
    Object.fromEntries(list.map((t) => [camel(strip(t.name, prefix)), value(t.value)]));
  return {
    color: Object.fromEntries(Object.entries(first).map(([k, v]) => [camel(k), v])),
    space: Object.fromEntries(tokens.spacing.tokens.map((t) => [strip(t.name, 'space-'), px(t.value)])),
    radius: byName(tokens.radius.tokens, 'radius-', px),
    shadow: byName(tokens.shadow.tokens, 'shadow-', (v) => v),
    size: byName(tokens.size.tokens, '', px),
    text: Object.fromEntries(Object.entries(textStyles(tokens)).map(([k, v]) => [camel(k), v])),
    opacity: byName(tokens.opacity.tokens, 'opacity-', Number),
    font: NUNITO,
    layout: { maxWidth: MAX_WIDTH },
  };
}

const cssVar = (name) => `--color-${name}`;

export function themeTs(tokens) {
  const themes = colorThemes(tokens);
  const vars = Object.fromEntries(
    Object.entries(themes).map(([id, colors]) => [id, Object.fromEntries(Object.entries(colors).map(([k, v]) => [cssVar(k), v]))]),
  );
  const colors = Object.fromEntries(
    Object.entries(themes).map(([id, c]) => [id, Object.fromEntries(Object.entries(c).map(([k, v]) => [camel(k), v]))]),
  );
  return `// ${HEADER}
export const theme = ${JSON.stringify(themeObject(tokens), null, 2)} as const;

/** Raw colours per theme, for places that need a value rather than a class (SVG icons). */
export const themeColors = ${JSON.stringify(colors, null, 2)} as const;

/** CSS variables per theme; ThemeProvider applies one set (NativeWind \`vars()\`). */
export const themeVars = ${JSON.stringify(vars, null, 2)} as const;

export type ThemeId = keyof typeof themeVars;
export type ColorName = keyof (typeof themeColors)[ThemeId];
export const defaultTheme: ThemeId = ${JSON.stringify(tokens.color.themes[0].id)};
`;
}

export function tailwindTheme(tokens) {
  const themes = colorThemes(tokens);
  const first = themes[tokens.color.themes[0].id];
  const colors = { transparent: 'transparent' };
  for (const name of Object.keys(first)) colors[name] = `var(${cssVar(name)})`;
  const spacing = { 0: '0px' };
  for (const t of tokens.spacing.tokens) spacing[strip(t.name, 'space-')] = t.value;
  for (const t of tokens.size.tokens) {
    if (t.name === 'screen-width') continue;
    spacing[t.name === 'tabbar-height' ? 'tabbar' : t.name] = t.value;
  }
  const borderRadius = { none: '0px' };
  for (const t of tokens.radius.tokens) borderRadius[strip(t.name, 'radius-')] = t.value;
  // Circles (bundle.css `border-radius: 50%`: icon buttons, avatars, switch knob).
  borderRadius.full = '9999px';
  const fontSize = {};
  for (const [name, s] of Object.entries(textStyles(tokens))) {
    fontSize[name] = [`${s.fontSize}px`, { lineHeight: `${s.lineHeight}px`, letterSpacing: `${s.letterSpacing}px`, fontWeight: s.fontWeight }];
  }
  const fontFamily = Object.fromEntries(Object.entries(NUNITO).map(([w, family]) => [`nunito-${w}`, [family, 'Nunito', 'sans-serif']]));
  const boxShadow = Object.fromEntries(tokens.shadow.tokens.map((t) => [strip(t.name, 'shadow-'), t.value]));
  const opacity = Object.fromEntries(tokens.opacity.tokens.map((t) => [strip(t.name, 'opacity-'), t.value]));
  const config = {
    colors,
    spacing,
    borderRadius,
    fontSize,
    fontFamily,
    boxShadow,
    extend: { opacity, maxWidth: { frame: `${MAX_WIDTH}px` } },
  };
  const rootVars = Object.fromEntries(Object.entries(first).map(([k, v]) => [cssVar(k), v]));
  return `// ${HEADER}
// \`theme\` replaces Tailwind's colours, spacing, radii and type, so only design tokens exist as classes.
// \`rootVars\` are the default theme's colours on :root; ThemeProvider overrides them per theme.
module.exports = ${JSON.stringify({ theme: config, rootVars }, null, 2)};
`;
}

// ---------- Icons ----------

const INK = '#2A2414';
const ELEMENT = /<(path|circle|rect|g|\/g)\b([^>]*?)\/?>/g;
const ATTR = /([a-zA-Z-]+)="([^"]*)"/g;
const TAG = { path: 'Path', circle: 'Circle', rect: 'Rect', g: 'G' };

function attrs(source) {
  return Object.fromEntries([...source.matchAll(ATTR)].map(([, k, v]) => [k, v]));
}

function jsxProps(map, colorExpr, isRoot = false) {
  return Object.entries(map)
    .filter(([k]) => k !== 'xmlns' && !(isRoot && (k === 'width' || k === 'height')))
    .map(([k, v]) => {
      const name = camel(k);
      if ((k === 'fill' || k === 'stroke') && v === INK) return `${name}={${colorExpr}}`;
      return `${name}="${v}"`;
    })
    .join(' ');
}

/** One SVG file to the JSX children and root props of a react-native-svg `Svg`. */
export function svgToJsx(svg, colorExpr = 'color') {
  const root = /<svg\b([^>]*)>/.exec(svg);
  if (!root) throw new Error('Not an SVG');
  const rootAttrs = attrs(root[1]);
  const body = svg.slice(root.index + root[0].length);
  const children = [];
  for (const [, tag, rest] of body.matchAll(ELEMENT)) {
    if (tag === '/g') children.push('</G>');
    else {
      const props = jsxProps(attrs(rest), colorExpr);
      children.push(tag === 'g' ? `<G ${props}>` : `<${TAG[tag]} ${props} />`);
    }
  }
  return { rootProps: jsxProps(rootAttrs, colorExpr, true), children: children.join('') };
}

/** `files` maps an icon name (file name without .svg) to its SVG source. */
export function iconsTsx(files, logo) {
  const names = Object.keys(files).sort();
  const used = new Set();
  const entries = names.map((name) => {
    const { rootProps, children } = svgToJsx(files[name]);
    for (const m of children.matchAll(/<(Path|Circle|Rect|G)\b/g)) used.add(m[1]);
    return `  ${JSON.stringify(name)}: ({ size, color }) => (\n    <Svg width={size} height={size} ${rootProps}>${children}</Svg>\n  ),`;
  });
  const mark = svgToJsx(logo, 'ink').children.replace('fill="#FFCF5C"', 'fill={honey}');
  for (const m of mark.matchAll(/<(Path|Circle|Rect|G)\b/g)) used.add(m[1]);
  const imports = ['Svg', ...[...used].sort()].join(', ');
  return `// ${HEADER}
// Icons are the design system's SVGs (design/system/assets), copied path for path, never redrawn.
import type { ReactElement } from 'react';
import ${'{'} ${imports} ${'}'} from 'react-native-svg';

type Draw = (props: { size: number; color: string }) => ReactElement;

export const iconShapes = {
${entries.join('\n')}
} satisfies Record<string, Draw>;

export type IconName = keyof typeof iconShapes;

/** The Our Cocon mark: a house with a heart, ink on a honey rounded square. */
export function LogoShape({ size, honey, ink }: { size: number; honey: string; ink: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">${mark}</Svg>
  );
}
`;
}
