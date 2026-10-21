import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * The app's data cache (spec 004). What was last loaded is saved on the device (localStorage on
 * the web, AsyncStorage on iOS), so it stays readable offline and after a reload. While offline,
 * reads wait for the connection and show the cached data; nothing is queued (decision 11).
 *
 * Query keys of a family table start with the table's name (`['grocery_items', …]`), so a live
 * change to that table refetches them (lib/sync.tsx).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: WEEK, staleTime: 30_000, retry: 2 },
      mutations: { retry: false },
    },
  });
}

export const queryPersister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'cocon-cache' });
export const persistMaxAge = WEEK;

/**
 * What's saved on the device: everything but shared recipes (spec 019). Those are someone else's,
 * and their photo links expire within the hour.
 */
export const shouldPersistQuery = (query: Query) => query.queryKey[0] !== 'shared-recipe' && defaultShouldDehydrateQuery(query);

