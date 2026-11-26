import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePendingGroceryAdds, whileAddingGroceries } from './pending-grocery-adds';

const add = { familyId: 'f1', recipeId: 'r1', recipeName: 'Leek & bacon quiche', photoPath: null, count: 8 };

describe('pending grocery adds (spec 022)', () => {
  it("lists a family's adds while they run, and drops them when done or failed", async () => {
    const { result } = renderHook(() => ({ mine: usePendingGroceryAdds('f1'), theirs: usePendingGroceryAdds('f2') }));
    let finish: (v: string) => void = () => undefined;
    let running: Promise<string> = Promise.resolve('');
    act(() => {
      running = whileAddingGroceries(add, () => new Promise<string>((r) => (finish = r)));
    });
    expect(result.current.mine).toMatchObject([{ recipeName: 'Leek & bacon quiche', count: 8 }]);
    expect(result.current.theirs).toEqual([]);
    await act(async () => {
      finish('done');
      expect(await running).toBe('done');
    });
    expect(result.current.mine).toEqual([]);

    await act(async () => {
      await expect(whileAddingGroceries(add, () => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    });
    expect(result.current.mine).toEqual([]);
  });
});
