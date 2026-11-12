import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without types
import { colorThemes, darken, svgToJsx, swiftColor, tailwindTheme, themeObject, themeSwift, widgetAssets } from './theme-lib.mjs';
// @ts-expect-error plain .mjs script without types
import { generate } from './theme.mjs';

const root = join(import.meta.dirname, '..');
const tokens = JSON.parse(readFileSync(join(root, 'design/system/tokens.json'), 'utf8'));
const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

describe('pnpm theme (spec 002, acceptance 1.1)', () => {
  const theme = themeObject(tokens);

  it('exposes every colour token as theme.color.*', () => {
    for (const t of tokens.color.tokens) expect(theme.color[camel(t.name)]).toBe(t.value);
  });

  it('exposes every spacing, radius, shadow and size token', () => {
    for (const t of tokens.spacing.tokens) expect(theme.space[t.name.replace('space-', '')]).toBe(Number.parseFloat(t.value));
    for (const t of tokens.radius.tokens) expect(theme.radius[camel(t.name.replace('radius-', ''))]).toBe(Number.parseFloat(t.value));
    for (const t of tokens.shadow.tokens) expect(theme.shadow[t.name.replace('shadow-', '')]).toBe(t.value);
    for (const t of tokens.size.tokens) expect(theme.size[camel(t.name)]).toBe(Number.parseFloat(t.value));
  });

  it('exposes every text style with its line height in px and the Nunito file for its weight', () => {
    const styles = tokens.type.groups.flatMap((g: { styles: unknown[] }) => g.styles);
    for (const s of styles) {
      const out = theme.text[camel(s.name)];
      expect(out.fontSize).toBe(Number.parseFloat(s.fontSize));
      expect(out.lineHeight).toBeCloseTo(Number.parseFloat(s.fontSize) * Number(s.lineHeight), 2);
      expect(out.fontFamily).toMatch(new RegExp(`^Nunito_${s.fontWeight}`));
    }
    expect(theme.text.displayXl).toMatchObject({ fontSize: 32, lineHeight: 35.2, letterSpacing: -0.6, fontWeight: '900' });
  });

  it('makes classes from token names only, with colours as theme variables', () => {
    type Section = Record<string, string>;
    const module = { exports: {} };
    new Function('module', tailwindTheme(tokens))(module);
    const { theme: config, rootVars } = module.exports as { theme: { colors: Section; spacing: Section; borderRadius: Section }; rootVars: Section };
    expect(rootVars['--color-honey']).toBe('#FFCF5C');
    expect(config.colors.honey).toBe('var(--color-honey)');
    expect(config.spacing['20']).toBe('20px');
    expect(config.spacing['control-lg']).toBe('54px');
    expect(config.borderRadius.xl).toBe('22px');
    expect(config.borderRadius.full).toBe('9999px');
    expect(Object.keys(config.colors)).not.toContain('blue');
  });

  it('gives a second theme its own values, falling back to the first', () => {
    const withDark = structuredClone(tokens);
    withDark.color.themes.push({ id: 'dark', name: 'Dark' });
    withDark.color.tokens.find((t: { name: string }) => t.name === 'surface-page').values = { dark: '#1A160C' };
    const themes = colorThemes(withDark);
    expect(themes.dark['surface-page']).toBe('#1A160C');
    expect(themes.dark.honey).toBe(themes.light.honey);
  });

  it('darkens pressed fills by about 6%', () => {
    expect(darken('#FFFFFF')).toBe('#F0F0F0');
    expect(colorThemes(tokens).light['olive-pressed']).toBe(darken('#5A6820'));
  });

  it('copies icon shapes from the SVG and recolours ink', () => {
    const svg = '<svg xmlns="x" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2A2414" stroke-width="2.2"><circle cx="5" cy="12" r="2"/></svg>';
    const out = svgToJsx(svg);
    expect(out.rootProps).toBe('viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2"');
    expect(out.children).toBe('<Circle cx="5" cy="12" r="2" />');
  });

  it('gives the Live Activity every colour token but the member outlines in Swift, and the icons as vector images (spec 048, 030)', () => {
    expect(swiftColor('#FFCF5C')).toBe('Color(red: 1, green: 0.8118, blue: 0.3608, opacity: 1)');
    expect(swiftColor('rgba(42, 36, 20, 0.55)')).toBe('Color(red: 0.1647, green: 0.1412, blue: 0.0784, opacity: 0.55)');
    const swift = themeSwift(tokens);
    for (const t of tokens.color.tokens) {
      if (t.name.endsWith('-edge')) expect(swift).not.toContain(`static let ${camel(t.name)} = `);
      else expect(swift).toContain(`static let ${camel(t.name)} = `);
    }
    const assets = widgetAssets({ timer: '<svg/>', bell: '<svg/>' }, '<svg mark/>', 'x');
    expect(JSON.parse(assets['x/timer.imageset/Contents.json']).properties).toEqual({ 'preserves-vector-representation': true, 'template-rendering-intent': 'template' });
    expect(assets['x/mark.imageset/mark.svg']).toBe('<svg mark/>');
  });

  it('has committed files equal to a fresh generation (CI runs `pnpm theme --check`)', () => {
    for (const [file, content] of Object.entries(generate() as Record<string, string>)) {
      expect(readFileSync(join(root, file), 'utf8'), file).toBe(content);
    }
  });
});

// WCAG 2.2 relative luminance and contrast ratio, for #RRGGBB.
function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('member colors (spec 030 FR-007)', () => {
  const value = (name: string): string => tokens.color.tokens.find((t: { name: string }) => t.name === name).value;
  const fills = (tokens.color.tokens as { name: string }[]).map((t) => t.name).filter((n) => /^member-[a-z]+$/.test(n));

  it('covers the 8 member colors, Everyone, Others and a member who left', () => {
    expect(fills).toHaveLength(11);
  });

  it('has ink text at 4.5:1 on every fill, and every fill an outline at 3:1 against white and the page', () => {
    for (const fill of fills) {
      expect(contrast(value('ink'), value(fill)), fill).toBeGreaterThanOrEqual(4.5);
      expect(contrast(value(`${fill}-edge`), value('surface-card')), `${fill}-edge`).toBeGreaterThanOrEqual(3);
      expect(contrast(value(`${fill}-edge`), value('surface-page')), `${fill}-edge`).toBeGreaterThanOrEqual(3);
    }
  });
});
