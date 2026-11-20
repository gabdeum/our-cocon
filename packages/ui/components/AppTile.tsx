import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { gutterFor, railInset, useLayoutTier } from '../layout';
import { theme } from '../theme';
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

/** A tile is never narrower than this; as many columns fit as can (Grid in the AppTile README). */
const TILE_MIN = 170;
const GAP = 10;

/**
 * Apps in as many columns as fit tiles 170 wide, at least 2 (2 on the phone, more from 600), gap 10,
 * wrapping to new rows. The columns are equal and fill the width, so the tiles line up as a table;
 * a short last row keeps its empty slots. Each slot is the same plain View, with or without a tile:
 * a Pressable beside an empty View took their flex differently on the web, so a lone tile came out
 * wider than the others.
 */
export function AppGrid({ label, apps }: { label: string; apps: readonly (AppTileProps & { key: string })[] }) {
  const { tier, width } = useLayoutTier();
  // Until the grid is measured, the window less the rail and gutters (no jump on first paint).
  const [measured, setMeasured] = useState<number | null>(null);
  const available = measured ?? Math.min(width - railInset(tier), theme.layout.maxContent) - 2 * gutterFor(tier);
  const columns = Math.max(2, Math.floor((available + GAP) / (TILE_MIN + GAP)));
  const rows = Array.from({ length: Math.ceil(apps.length / columns) }, (_, i) => apps.slice(i * columns, i * columns + columns));
  return (
    <View role="navigation" aria-label={label} className="gap-10" onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
      {rows.map((row) => (
        <View key={row.map((a) => a.key).join()} className="flex-row gap-10">
          {Array.from({ length: columns }, (_, i) => {
            const app = row[i];
            return (
              <View key={app?.key ?? `empty-${i}`} className="flex-1 basis-0">
                {app ? <AppTile icon={app.icon} name={app.name} detail={app.detail} onPress={app.onPress} /> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
