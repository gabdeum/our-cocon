import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import type { IconName } from './Icon';
import { IconTile } from './IconTile';
import { Text } from './Text';

export interface AppTileProps {
  icon: IconName;
  /** "Calendar". */
  name: string;
  /** Live: "3 today", "48 recipes", "None running"; none while it loads. */
  detail?: string;
  onPress: () => void;
}

/** A part of the app in the Menu's Apps directory (AppTile README, spec 029). The whole tile is a link. */
export function AppTile({ icon, name, detail, onPress }: AppTileProps) {
  return (
    <Pressable
      role="link"
      aria-label={detail ? `${name}, ${detail}` : name}
      onPress={onPress}
      className={cn('min-h-[118px] flex-1 gap-10 rounded-[22px] bg-surface-card px-12 py-14 active:bg-surface-card-pressed', focusRing)}
    >
      <IconTile icon={icon} tone="soft" size="lg" />
      <View>
        <Text size={16} weight="900">
          {name}
        </Text>
        {detail ? (
          <Text size={13} weight="700" color="ink-muted">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Apps in 2 columns, gap 10, wrapping to new rows of two (an odd last tile keeps its half). Each
 * half is the same plain slot, with or without a tile: a Pressable beside an empty View took their
 * flex differently on the web, so a lone tile came out wider than the others.
 */
export function AppGrid({ label, apps }: { label: string; apps: readonly (AppTileProps & { key: string })[] }) {
  const rows = Array.from({ length: Math.ceil(apps.length / 2) }, (_, i) => apps.slice(i * 2, i * 2 + 2));
  return (
    <View role="navigation" aria-label={label} className="gap-10">
      {rows.map((row) => (
        <View key={row.map((a) => a.key).join()} className="flex-row gap-10">
          {[0, 1].map((i) => {
            const app = row[i];
            return (
              <View key={app?.key ?? 'empty'} className="flex-1 basis-0">
                {app ? <AppTile icon={app.icon} name={app.name} detail={app.detail} onPress={app.onPress} /> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
