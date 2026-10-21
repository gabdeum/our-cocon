import { useMemo } from 'react';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ShareSheet, type ShareSheetApi } from '../../../components/recipes/ShareSheet';
import { openShareLink, setShareOptions, shareRecipeLink, stopShareLink } from '../../../lib/share';
import { useRecipePhotoUrls } from '../../../lib/recipe-photo';
import { useRecipeSheet } from '../../../lib/use-recipe-sheet';
import { useSession } from '../../../lib/session';

/** /recipes/[id]/share (spec 019): share as a view-only link, a sheet over the recipe page. */
export default function ShareRoute() {
  const { recipe, tracker } = useRecipeSheet();
  const { state, client } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const photoUrls = useRecipePhotoUrls(client, familyId, [recipe?.photo_path]);
  const id = recipe?.id;
  const name = recipe?.name ?? '';
  const api = useMemo<ShareSheetApi | null>(
    () =>
      id
        ? {
            open: () => openShareLink(client, id),
            stop: (token) => stopShareLink(client, id, token),
            setOptions: (token, options) => setShareOptions(client, token, options),
            copy: (text) => Clipboard.setStringAsync(text),
            share: (token) => shareRecipeLink(name, token),
          }
        : null,
    [client, id, name],
  );
  if (!recipe || !api || state.status !== 'ready') return null;
  return (
    <ShareSheet
      recipeName={recipe.name}
      familyName={state.family.name}
      photoUri={recipe.photo_path ? photoUrls[recipe.photo_path] : undefined}
      api={api}
      tracker={tracker}
      onClose={() => router.back()}
    />
  );
}
