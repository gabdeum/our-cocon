import { expect, it } from 'vitest';
import { QUANTITY_PACKAGE } from './index';

it('is importable from the workspace', () => {
  expect(QUANTITY_PACKAGE).toBe('@cocon/quantity');
});
