export interface GridCellTitleInput {
  tooltip?: string;
  title?: string;
  text?: string;
  truncated: boolean;
}

export function resolveGridCellTitle({ tooltip, title, text, truncated }: GridCellTitleInput): string | undefined {
  if (tooltip) return tooltip;
  if (!title) return undefined;
  if (text !== undefined && title !== text) return title;
  return truncated ? title : undefined;
}

export function isClippedBoxTruncated(box: { scrollWidth: number; clientWidth: number }): boolean {
  return box.scrollWidth > box.clientWidth;
}

export const GRID_CLIP_ATTRIBUTE = 'data-grid-clip';

export function isGridCellTruncated(cell: {
  querySelectorAll: (selector: string) => ArrayLike<{ scrollWidth: number; clientWidth: number }>;
}): boolean {
  const boxes = cell.querySelectorAll(`[${GRID_CLIP_ATTRIBUTE}]`);
  for (let index = 0; index < boxes.length; index++) {
    if (isClippedBoxTruncated(boxes[index])) return true;
  }
  return false;
}
