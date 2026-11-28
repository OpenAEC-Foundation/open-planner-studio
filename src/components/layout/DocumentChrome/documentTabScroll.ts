const EDGE_TOLERANCE = 1;

export const DOCUMENT_TAB_HIDE_MARGIN = 4;

export function documentTabNeedsArrows(
  contentWidth: number,
  availableWidth: number,
  arrowsShown: boolean,
): boolean {
  if (arrowsShown) return contentWidth > availableWidth - DOCUMENT_TAB_HIDE_MARGIN;
  return contentWidth > availableWidth + EDGE_TOLERANCE / 2;
}

export interface DocumentTabScrollEdges {
  atStart: boolean;
  atEnd: boolean;
}

export function documentTabScrollEdges(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): DocumentTabScrollEdges {
  const offset = Math.abs(scrollLeft);
  const maxOffset = Math.max(0, scrollWidth - clientWidth);
  return {
    atStart: offset <= EDGE_TOLERANCE,
    atEnd: offset >= maxOffset - EDGE_TOLERANCE,
  };
}

export const DOCUMENT_TABS_PER_SCROLL_STEP = 2;

export function documentTabScrollTarget(
  tabStarts: readonly number[],
  offset: number,
  maxOffset: number,
  towards: 'start' | 'end',
  count = DOCUMENT_TABS_PER_SCROLL_STEP,
): number {
  let current = 0;
  for (let i = 0; i < tabStarts.length; i += 1) {
    if (tabStarts[i]! <= offset + EDGE_TOLERANCE) current = i;
  }
  const partial = (tabStarts[current] ?? 0) < offset - EDGE_TOLERANCE;
  const target = towards === 'end'
    ? current + count
    : current - count + (partial ? 1 : 0);
  if (target >= tabStarts.length) return maxOffset;
  if (target <= 0) return 0;
  return Math.min(Math.max(tabStarts[target]!, 0), maxOffset);
}

export function wheelDeltaInPixels(delta: number, deltaMode: number): number {
  return deltaMode === 1 ? delta * 16 : delta;
}
