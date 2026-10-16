// SC-001 (spec 002): no hard-coded colour or size outside packages/ui. Screens use packages/ui
// components and token classes; this rule reports what would bypass them.

const COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(.*\))$/i;
// Tailwind arbitrary values (`p-[13px]`, `bg-[#fff]`) skip the token scale.
const ARBITRARY = /(^|\s)[\w:/.-]*\[[^\]]+\]/;
// Layout numbers that aren't design sizes.
const ALLOWED_NUMBER_KEYS = new Set(['flex', 'flexGrow', 'flexShrink', 'zIndex']);

const keyName = (prop) => prop.key?.name ?? prop.key?.value;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Use packages/ui and theme tokens instead of colour or size literals' },
    messages: {
      color: 'Colour literal "{{value}}": use a theme token class (e.g. bg-honey) from packages/ui.',
      size: 'Size literal {{value}} in a style: use a token class (e.g. p-20, h-control-lg) or a packages/ui component.',
      arbitrary: 'Arbitrary Tailwind value in "{{value}}": use a token class; new values belong in design/system/tokens.json.',
    },
    schema: [],
  },
  create(context) {
    function checkStyleObject(node) {
      if (node?.type !== 'ObjectExpression') return;
      for (const prop of node.properties) {
        if (prop.type !== 'Property') continue;
        const value = prop.value;
        if (value.type === 'ObjectExpression') checkStyleObject(value);
        const isNumber =
          (value.type === 'Literal' && typeof value.value === 'number') ||
          (value.type === 'UnaryExpression' && value.argument.type === 'Literal' && typeof value.argument.value === 'number');
        if (isNumber && !ALLOWED_NUMBER_KEYS.has(keyName(prop))) {
          context.report({ node: value, messageId: 'size', data: { value: context.sourceCode.getText(value) } });
        }
      }
    }

    function checkClassName(node, text) {
      if (ARBITRARY.test(text)) context.report({ node, messageId: 'arbitrary', data: { value: text } });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string' && COLOR.test(node.value.trim())) {
          context.report({ node, messageId: 'color', data: { value: node.value } });
        }
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? '';
        if (COLOR.test(text.trim())) context.report({ node, messageId: 'color', data: { value: text } });
      },
      JSXAttribute(node) {
        const name = node.name.name;
        const value = node.value;
        if (/^(className|\w+ClassName)$/.test(name)) {
          if (value?.type === 'Literal' && typeof value.value === 'string') checkClassName(value, value.value);
          if (value?.type === 'JSXExpressionContainer') {
            const expr = value.expression;
            if (expr.type === 'Literal' && typeof expr.value === 'string') checkClassName(expr, expr.value);
            if (expr.type === 'TemplateLiteral') for (const q of expr.quasis) checkClassName(q, q.value.cooked ?? '');
          }
        }
        if (name === 'style' && value?.type === 'JSXExpressionContainer') {
          const expr = value.expression;
          if (expr.type === 'ArrayExpression') expr.elements.forEach(checkStyleObject);
          else checkStyleObject(expr);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'MemberExpression' && callee.object.name === 'StyleSheet' && callee.property.name === 'create') {
          const sheet = node.arguments[0];
          if (sheet?.type === 'ObjectExpression') for (const p of sheet.properties) if (p.type === 'Property') checkStyleObject(p.value);
        }
      },
    };
  },
};

export default { rules: { 'no-design-literals': rule } };
