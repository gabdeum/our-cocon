import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
// @ts-expect-error plain .mjs plugin without types
import plugin from './no-design-literals.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('no-design-literals (SC-001)', plugin.rules['no-design-literals'], {
  valid: [
    '<View className="bg-honey p-20 rounded-xl" />',
    '<View className={`flex-1 ${on ? "bg-honey" : "bg-ink"}`} />',
    '<View style={{ flex: 1 }} />',
    'const id = "#recipes";',
    'const label = "Step #3";',
  ],
  invalid: [
    { code: '<Text style={{ color: "#2A2414" }} />', errors: [{ messageId: 'color' }] },
    { code: 'const scrim = "rgba(42, 36, 20, 0.55)";', errors: [{ messageId: 'color' }] },
    { code: '<View style={{ padding: 13 }} />', errors: [{ messageId: 'size' }] },
    { code: '<View style={[a, { marginTop: -4 }]} />', errors: [{ messageId: 'size' }] },
    { code: 'StyleSheet.create({ box: { width: 50 } });', errors: [{ messageId: 'size' }] },
    { code: '<View className="p-[13px]" />', errors: [{ messageId: 'arbitrary' }] },
    { code: '<View contentContainerClassName="bg-[#fff]" />', errors: [{ messageId: 'arbitrary' }] },
  ],
});
