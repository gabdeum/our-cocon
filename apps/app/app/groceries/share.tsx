import { useMemo } from 'react';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { ShareGroceriesSheet, type ShareGroceriesApi } from '../../components/groceries/ShareGroceriesSheet';
import { useCalendarDisplay } from '../../lib/calendar-prefs';
import { useFamilySettings, useMyRecipeSettings } from '../../lib/family-settings';
import { createGroceryShare, loadGroceryShare, setGroceryShareOptions, shareGroceryLink, stopGroceryShare } from '../../lib/grocery-share';
import { groceryListKey, groceryPacksKey, listText, loadGroceryList, loadPacks, packKeys } from '../../lib/groceries';
import { useSession } from '../../lib/session';

/** /groceries/share (spec 072): share the list by link, or copy it as text, a sheet over Groceries. */
export default function ShareGroceriesRoute() {
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  // The tab's own queries: already loaded when the sheet opens from it.
  const list = useQuery({ queryKey: groceryListKey(familyId ?? ''), queryFn: () => loadGroceryList(client), enabled: familyId !== null });
  const keys = packKeys(list.data ?? []);
  const packs = useQuery({ queryKey: groceryPacksKey(familyId ?? '', keys), queryFn: () => loadPacks(client, keys), enabled: familyId !== null && list.data !== undefined });
  const familySettings = useFamilySettings();
  const myUnits = useMyRecipeSettings().settings.units ?? familySettings.settings.units;
  const text = useMemo(
    () => (list.data ? listText(list.data, packs.data, { ...familySettings.settings, units: myUnits }) : null),
    [list.data, packs.data, familySettings.settings, myUnits],
  );
  const { use24h } = useCalendarDisplay().prefs;

  const api = useMemo<ShareGroceriesApi>(
    () => ({
      load: () => loadGroceryShare(client),
      create: (duration, canEdit) => createGroceryShare(client, duration, canEdit),
      setOptions: (token, options) => setGroceryShareOptions(client, token, options),
      stop: (token) => stopGroceryShare(client, token),
      copy: (value) => Clipboard.setStringAsync(value),
      share: (token) => shareGroceryLink(token),
    }),
    [client],
  );
  if (state.status !== 'ready') return null;
  return <ShareGroceriesSheet api={api} listText={text} tracker={tracker} use24h={use24h} onClose={() => router.back()} />;
}
