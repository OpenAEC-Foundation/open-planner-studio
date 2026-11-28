export type GuideSide = 'end' | 'start';

export interface PlacementRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface GuidePlacementInput {
  current: GuideSide;
  expanded: Record<GuideSide, PlacementRect>;
  compact: Record<GuideSide, PlacementRect>;
  anchor: PlacementRect | null;
  dialogs: readonly PlacementRect[];
}

export interface GuidePlacement {
  side: GuideSide;
  autoCompact: boolean;
}

export function rectsOverlap(a: PlacementRect, b: PlacementRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

const SIDES: readonly GuideSide[] = ['end', 'start'];

export function placeGuidePanel(input: GuidePlacementInput): GuidePlacement {
  const obstacles = input.anchor ? [input.anchor, ...input.dialogs] : [...input.dialogs];
  const free = (r: PlacementRect) => !obstacles.some(o => rectsOverlap(r, o));

  const expandedSide = SIDES.find(s => free(input.expanded[s]));
  if (expandedSide) return { side: expandedSide, autoCompact: false };

  const coversDialog = input.dialogs.some(d => SIDES.some(s => rectsOverlap(input.expanded[s], d)));
  if (!coversDialog) return { side: input.current, autoCompact: false };

  const compactSide = SIDES.find(s => free(input.compact[s]));
  return { side: compactSide ?? input.current, autoCompact: true };
}
