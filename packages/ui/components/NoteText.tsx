import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { cn } from '../cn';
import { theme } from '../theme';
import { Icon } from './Icon';
import { Text, type Weight } from './Text';

/** Inline text in a note (spec 073 FR-002): plain, bold, italic or a link, nested. */
export type NoteSpan =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic'; children: NoteSpan[] }
  | { kind: 'link'; url: string; children: NoteSpan[] };

export type NoteAlign = 'left' | 'center' | 'right';

/**
 * A line or paragraph of a note, as the app's parser returns it. `n` is the number shown (its
 * position in the list); `line` is the checklist item's line in the note (spec 075). A table's
 * rows have as many cells as its header, each one inline text.
 */
export type NoteBlock =
  | { kind: 'paragraph' | 'boldLine' | 'bullet'; spans: NoteSpan[] }
  | { kind: 'number'; n: number; spans: NoteSpan[] }
  | { kind: 'check'; done: boolean; line: number; spans: NoteSpan[] }
  | { kind: 'table'; align: NoteAlign[]; header: NoteSpan[][]; rows: NoteSpan[][][] };

export interface NoteTextProps {
  blocks: readonly NoteBlock[];
  /** A link was tapped: the caller opens it in the system browser. */
  onOpenLink: (url: string) => void;
}

/** Nunito's italic files: `Nunito_600SemiBold_Italic` (loaded by the app beside the upright ones). */
const italicFont = (w: Weight) => `${theme.font[w]}_Italic`;

interface Style {
  weight: Weight;
  bold?: boolean;
  italic?: boolean;
}

function Spans({ spans, style, onOpenLink }: { spans: readonly NoteSpan[]; style: Style; onOpenLink: (url: string) => void }): ReactNode {
  return spans.map((s, i) => {
    if (s.kind === 'text') {
      // Plain text takes its line's (or its link's) look.
      if (!style.bold && !style.italic) return s.text;
      const w: Weight = style.bold ? '900' : style.weight;
      return (
        <Text key={i} size={15} weight={w} style={style.italic ? { fontFamily: italicFont(w) } : undefined}>
          {s.text}
        </Text>
      );
    }
    if (s.kind === 'link') {
      const w: Weight = style.bold ? '900' : '800';
      return (
        <Text
          key={i}
          role="link"
          size={15}
          weight={w}
          color="olive"
          underline
          style={style.italic ? { fontFamily: italicFont(w) } : undefined}
          onPress={() => onOpenLink(s.url)}
        >
          <Spans spans={s.children} style={{ ...style, weight: w }} onOpenLink={onOpenLink} />
        </Text>
      );
    }
    const next = s.kind === 'bold' ? { ...style, bold: true } : { ...style, italic: true };
    return <Spans key={i} spans={s.children} style={next} onOpenLink={onOpenLink} />;
  });
}

function Line({ spans, weight, lineHeight, onOpenLink, className, strike, align }: { spans: readonly NoteSpan[]; weight: Weight; lineHeight: number; onOpenLink: (url: string) => void; className?: string; strike?: boolean; align?: NoteAlign }) {
  return (
    <Text size={15} weight={weight} color={strike ? 'ink-soft' : 'ink'} strike={strike} className={className} style={{ lineHeight: 15 * lineHeight, textAlign: align }}>
      <Spans spans={spans} style={{ weight, bold: weight === '900' }} onOpenLink={onOpenLink} />
    </Text>
  );
}

const plain = (spans: readonly NoteSpan[]): string => spans.map((s) => (s.kind === 'text' ? s.text : plain(s.children))).join('');

/**
 * A table: header on `surface-soft`, 1.5 `line-strong` lines, radius 12. Each column is as wide as
 * its longest cell (64 to 240, longer text wraps), so rows line up on iOS and the web; a table wider
 * than the note scrolls sideways.
 */
function Table({ block, onOpenLink }: { block: Extract<NoteBlock, { kind: 'table' }>; onOpenLink: (url: string) => void }) {
  const widths = block.header.map((h, c) => {
    const longest = Math.max(...[h, ...block.rows.map((r) => r[c] ?? [])].map((cell) => plain(cell).length));
    return Math.min(240, Math.max(64, longest * 8 + 24));
  });
  const row = (cells: readonly NoteSpan[][], header: boolean) =>
    cells.map((spans, c) => (
      <View key={c} role={header ? 'columnheader' : 'cell'} style={{ width: widths[c] }} className={cn('px-12 py-8', c > 0 && 'border-l-[1.5px] border-line-strong')}>
        <Line spans={spans} weight={header ? '900' : '600'} lineHeight={1.4} onOpenLink={onOpenLink} align={block.align[c]} />
      </View>
    ));
  return (
    <ScrollView horizontal>
      <View role="table" className="overflow-hidden rounded-[12px] border-[1.5px] border-line-strong">
        <View role="row" className="flex-row bg-surface-soft">
          {row(block.header, true)}
        </View>
        {block.rows.map((r, i) => (
          <View key={i} role="row" className="flex-row border-t-[1.5px] border-line-strong">
            {row(r, false)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Item({ block, onOpenLink }: { block: NoteBlock; onOpenLink: (url: string) => void }) {
  switch (block.kind) {
    case 'table':
      return <Table block={block} onOpenLink={onOpenLink} />;
    case 'bullet':
      return (
        <View role="listitem" className="flex-row gap-10">
          <View aria-hidden className="mt-8 h-[7px] w-[7px] flex-none rounded-full bg-member-honey-edge" />
          <Line spans={block.spans} weight="600" lineHeight={1.45} onOpenLink={onOpenLink} className="min-w-0 flex-1" />
        </View>
      );
    case 'number':
      return (
        <View role="listitem" className="flex-row items-start gap-10">
          <View aria-hidden className="h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-surface-soft">
            <Text size={12} weight="900">
              {String(block.n)}
            </Text>
          </View>
          <Line spans={block.spans} weight="600" lineHeight={1.45} onOpenLink={onOpenLink} className="min-w-0 flex-1" />
        </View>
      );
    case 'check':
      return (
        <View role="checkbox" aria-checked={block.done} className="min-h-[44px] flex-row items-center gap-12">
          <View aria-hidden className={cn('h-[24px] w-[24px] flex-none items-center justify-center rounded-[7px]', block.done ? 'bg-olive' : 'border-[2.5px] border-line-dashed bg-surface-card')}>
            {block.done ? <Icon name="check" size={15} color="onOlive" /> : null}
          </View>
          <Line spans={block.spans} weight="700" lineHeight={1.4} onOpenLink={onOpenLink} strike={block.done} className="min-w-0 flex-1" />
        </View>
      );
    case 'boldLine':
      return <Line spans={block.spans} weight="900" lineHeight={1.5} onOpenLink={onOpenLink} className="mt-4" />;
    default:
      return <Line spans={block.spans} weight="600" lineHeight={1.5} onOpenLink={onOpenLink} />;
  }
}

type Group = { list: 'bullet' | 'number' | 'check'; items: NoteBlock[] } | { list: null; block: NoteBlock };

/** Runs of the same list kind sit together, 8 (checklists 0: their rows are 44 tall) apart. */
function groups(blocks: readonly NoteBlock[]): Group[] {
  const out: Group[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.kind === 'bullet' || b.kind === 'number' || b.kind === 'check') {
      if (last && last.list === b.kind) last.items.push(b);
      else out.push({ list: b.kind, items: [b] });
    } else out.push({ list: null, block: b });
  }
  return out;
}

/**
 * NoteText README (spec 073): a note's formatted blocks, from native Text and View only. Bold,
 * italic and links inline; bulleted, numbered and checklist items; headings as a bold line; tables.
 */
export function NoteText({ blocks, onOpenLink }: NoteTextProps) {
  return (
    <View className="gap-12">
      {groups(blocks).map((g, i) =>
        g.list === null ? (
          <Item key={i} block={g.block} onOpenLink={onOpenLink} />
        ) : (
          <View key={i} role="list" className={g.list === 'check' ? undefined : 'gap-8'}>
            {g.items.map((b, j) => (
              <Item key={j} block={b} onOpenLink={onOpenLink} />
            ))}
          </View>
        ),
      )}
    </View>
  );
}

/** NoteText README: the notes under a hairline (1.5 line-strong, 14 below), full width. */
export function NotesSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View role="region" aria-label={label} className="border-t-[1.5px] border-line-strong pt-14">
      {children}
    </View>
  );
}
