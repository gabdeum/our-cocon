import { useState } from 'react';
import { View } from 'react-native';
import { ActivityCard, Dialog, StatusBanner } from '@cocon/ui';
import type { ActivityEntry, Tracker, UndoConflict } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { conflictText, describeEntry, type UndoOutcome } from '../../lib/activity';
import type { Member } from '../../lib/session';

const a = strings.activity;

export interface ActivityEntriesProps {
  entries: readonly ActivityEntry[];
  members: readonly Pick<Member, 'user_id' | 'display_name'>[];
  tracker: Tracker;
  /** Undo or Restore, as the member (lib/activity.ts › undoActivity). */
  onUndo: (entry: ActivityEntry, skipChanged: boolean) => Promise<UndoOutcome>;
  /** Offline: Undo and Restore are off. */
  readOnly?: boolean;
  now?: Date;
}

/**
 * AI entries as ActivityCards, with Undo (spec 026 US2): "Undone" when done; when someone changed
 * part of it since, a Dialog says who and what, then undoes only the rest.
 */
export function ActivityEntries({ entries, members, tracker, onUndo, readOnly, now = new Date() }: ActivityEntriesProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; tone: 'sage' | 'warn' } | null>(null);
  const [asking, setAsking] = useState<{ entry: ActivityEntry; conflicts: UndoConflict[] } | null>(null);

  const run = async (entry: ActivityEntry, skipChanged: boolean) => {
    setAsking(null);
    setBusy(entry.key);
    const restoring = entry.kind === 'recipe_deleted';
    const outcome = await onUndo(entry, skipChanged);
    setBusy(null);
    switch (outcome.status) {
      case 'done':
        if (outcome.result.kind === 'recipe_deleted') tracker.track('ai_delete_restored', {});
        else tracker.track('ai_change_undone', { kind: outcome.result.kind });
        setBanner({ message: restoring ? a.restored : a.undone, tone: 'sage' });
        break;
      case 'conflicts':
        setBanner(null);
        setAsking({ entry, conflicts: outcome.conflicts });
        break;
      case 'nothing':
        setBanner({ message: a.nothingLeft, tone: 'warn' });
        break;
      case 'expired':
        setBanner({ message: a.expired, tone: 'warn' });
        break;
      case 'failed':
        setBanner({ message: restoring ? a.restoreFailed : a.undoFailed, tone: 'warn' });
        break;
    }
  };

  return (
    <View className="gap-12">
      {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}
      {entries.map((entry) => {
        const view = describeEntry(entry, members, now);
        return (
          <ActivityCard
            key={entry.key}
            badge={a.badge}
            title={view.title}
            sub={view.sub}
            action={
              view.action
                ? {
                    label: view.action === 'restore' ? a.restore : a.undo,
                    accessibilityLabel: view.action === 'restore' ? a.restoreA11y(view.title) : a.undoA11y(view.title),
                    onPress: () => void run(entry, false),
                    disabled: readOnly || busy !== null,
                  }
                : undefined
            }
          />
        );
      })}
      <Dialog
        visible={asking !== null}
        icon="warning"
        title={a.conflictTitle}
        body={asking ? conflictText(asking.conflicts, members) : ''}
        confirmLabel={a.undoRest}
        onConfirm={() => {
          if (asking) void run(asking.entry, true);
        }}
        cancelLabel={a.cancel}
        onCancel={() => setAsking(null)}
      />
    </View>
  );
}
