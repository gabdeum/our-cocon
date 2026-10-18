import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * A change shown at once, then saved (spec 004: a failed write reverts). Returns 'failed' so the
 * screen can show "Couldn't save. Try again." (strings.sync.saveFailed). Either way the data is
 * refetched afterwards, so it matches the database.
 */
export async function optimisticWrite<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  change: (current: T | undefined) => T | undefined,
  save: () => PromiseLike<{ error: unknown }>,
): Promise<'saved' | 'failed'> {
  await queryClient.cancelQueries({ queryKey });
  const before = queryClient.getQueryData<T>(queryKey);
  queryClient.setQueryData<T>(queryKey, change);
  try {
    const { error } = await save();
    if (error) throw error;
    return 'saved';
  } catch {
    queryClient.setQueryData<T>(queryKey, before);
    return 'failed';
  } finally {
    void queryClient.invalidateQueries({ queryKey });
  }
}
