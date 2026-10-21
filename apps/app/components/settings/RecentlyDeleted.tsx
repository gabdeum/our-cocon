import { useState } from 'react';
import { View } from 'react-native';
import { BackHeader, BottomSheet, Button, Callout, Dialog, Link, ListGroup, ListRow, PushedScreen, RecipeItemSkeleton, StatusBanner, Text } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { daysLeft, daysSinceDelete, type DeletedRecipe } from '../../lib/recipe-delete';
import type { Member } from '../../lib/session';
import { OfflineBanner } from '../sync/OfflineBanner';

const d = strings.recentlyDeleted;

export interface RecentlyDeletedProps {
  /** Undefined while loading. Newest first (lib/recipe-delete.ts › loadDeleted). */
  recipes: DeletedRecipe[] | undefined;
  members: readonly Pick<Member, 'user_id' | 'display_name'>[];
  tracker: Tracker;
  failed?: boolean;
  onRetry: () => void;
  onBack: () => void;
  onRestore: (recipe: DeletedRecipe) => Promise<void>;
  onDeleteNow: (recipe: DeletedRecipe) => Promise<void>;
  /** Offline: the list stays readable, Restore and Delete now are off. */
  readOnly?: boolean;
  now?: Date;
}

/**
 * Settings › Recently deleted (spec 018, design/flows.md): the family's deleted recipes, newest
 * first, each with who deleted it, when, and how long it stays. "Restore" brings one back; tapping
 * a row also offers "Delete now", which removes it for good after a Dialog.
 */
export function RecentlyDeleted({ recipes, members, tracker, failed, onRetry, onBack, onRestore, onDeleteNow, readOnly, now = new Date() }: RecentlyDeletedProps) {
  const [selected, setSelected] = useState<DeletedRecipe | null>(null);
  const [confirm, setConfirm] = useState<DeletedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; tone: 'sage' | 'warn' } | null>(null);

  const nameOf = (userId: string | null) => members.find((m) => m.user_id === userId)?.display_name ?? strings.recipe.formerMember;

  const restore = async (recipe: DeletedRecipe) => {
    setSelected(null);
    setBusy(true);
    try {
      await onRestore(recipe);
      tracker.track('recipe_restored', { days_since_delete: daysSinceDelete(recipe.deleted_at) });
      setBanner({ message: d.restored(recipe.name), tone: 'sage' });
    } catch {
      setBanner({ message: d.restoreFailed, tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const deleteNow = async (recipe: DeletedRecipe) => {
    setConfirm(null);
    setSelected(null);
    setBusy(true);
    try {
      await onDeleteNow(recipe);
      setBanner(null);
    } catch {
      setBanner({ message: d.deleteFailed, tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const header = <BackHeader backLabel={d.back} onBack={onBack} title={d.title} />;
  const off = readOnly || busy;

  let body;
  if (recipes === undefined && failed) {
    body = (
      <View className="gap-12">
        <Callout variant="warn" text={d.loadFailed} />
        <Button label={d.retry} variant="soft" onPress={onRetry} />
      </View>
    );
  } else if (recipes === undefined) {
    body = (
      <View role="progressbar" aria-label={d.loading}>
        <RecipeItemSkeleton />
      </View>
    );
  } else if (recipes.length === 0) {
    body = (
      <View className="gap-6">
        <Text size={17} weight="900">
          {d.emptyTitle}
        </Text>
        <Text color="ink-muted">{d.emptyBody}</Text>
      </View>
    );
  } else {
    body = (
      <ListGroup>
        {recipes.map((recipe, i) => (
          <ListRow
            key={recipe.id}
            title={recipe.name}
            sub={d.sub(nameOf(recipe.deleted_by), daysSinceDelete(recipe.deleted_at, now), daysLeft(recipe.deleted_at, now))}
            onPress={off ? undefined : () => setSelected(recipe)}
            trailing={{
              kind: 'node',
              node: <Link label={d.restore} accessibilityLabel={d.restoreA11y(recipe.name)} disabled={off} onPress={() => void restore(recipe)} />,
            }}
            last={i === recipes.length - 1}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <PushedScreen className="gap-18">
      {header}
      <OfflineBanner screen="settings" tracker={tracker} />
      {banner && !readOnly ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}
      {body}
      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? ''} closeLabel={strings.settings.family.close}>
        {selected ? (
          <View className="gap-10">
            <Button label={d.restore} variant="olive" block onPress={() => void restore(selected)} />
            <Link label={d.deleteNow} tone="danger" onPress={() => setConfirm(selected)} />
          </View>
        ) : null}
      </BottomSheet>
      <Dialog
        visible={confirm !== null}
        title={d.deleteNowTitle(confirm?.name ?? '')}
        body={d.deleteNowBody}
        confirmLabel={d.deleteNow}
        onConfirm={() => {
          if (confirm) void deleteNow(confirm);
        }}
        cancelLabel={d.keep}
        onCancel={() => setConfirm(null)}
      />
    </PushedScreen>
  );
}
