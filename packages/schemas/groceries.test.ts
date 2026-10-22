// Spec 020: what a change to a grocery item may contain (Edit, a merge).
import { describe, expect, it } from 'vitest';
import { GroceryItemUpdate } from './groceries';

describe('GroceryItemUpdate', () => {
  it('takes a new name, amount and aisle', () => {
    expect(GroceryItemUpdate.safeParse({ name: 'Lemons', quantity: 3, unit: 'piece', aisle: 'produce', catalog_key: 'lemon' }).success).toBe(true);
    expect(GroceryItemUpdate.safeParse({ quantity: null, unit: null }).success).toBe(true);
  });

  it('refuses amounts out of range, a unit without an amount, and fields the database sets', () => {
    expect(GroceryItemUpdate.safeParse({ quantity: 100000 }).success).toBe(false);
    expect(GroceryItemUpdate.safeParse({ quantity: null, unit: 'g' }).success).toBe(false);
    expect(GroceryItemUpdate.safeParse({ name: ' ' }).success).toBe(false);
    expect(GroceryItemUpdate.safeParse({ deleted_at: '2000-01-01' }).success).toBe(false);
    expect(GroceryItemUpdate.safeParse({ checked: true }).success).toBe(false);
  });
});
