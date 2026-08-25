/**
 * Tijdelijk maar blijvend ownership-contract voor de Gantt-overgang naar een DOM-grid.
 *
 * Task 0 legt de huidige canvas-eigenaar vast. Task 15 verhuist de acties links van de
 * tijdlijn naar `DOM-grid/workspace` en behoudt de tijdlijngebaren in `timelinecanvas`.
 */
export type GanttAction =
  | 'rowselect'
  | 'disclosure'
  | 'add'
  | 'row-dubbelklik'
  | 'rowcontextmenu'
  | 'rowdrag'
  | 'tooltip'
  | 'splitter'
  | 'vertical-scroll'
  | 'horizontal-time-scroll'
  | 'fit-to-project'
  | 'focus-on-task'
  | 'bars'
  | 'dependencies'
  | 'pan'
  | 'boxselect';

export type GanttOwner = 'canvas' | 'DOM-grid/workspace' | 'timelinecanvas';

/** Iedere actie heeft precies één eigenaar; dubbele eventlisteners zijn niet toegestaan. */
export const ganttEventOwnership = {
  rowselect: ['canvas'],
  disclosure: ['canvas'],
  add: ['canvas'],
  'row-dubbelklik': ['canvas'],
  rowcontextmenu: ['canvas'],
  rowdrag: ['canvas'],
  tooltip: ['canvas'],
  splitter: ['canvas'],
  'vertical-scroll': ['canvas'],
  'horizontal-time-scroll': ['canvas'],
  'fit-to-project': ['canvas'],
  'focus-on-task': ['canvas'],
  bars: ['canvas'],
  dependencies: ['canvas'],
  pan: ['canvas'],
  boxselect: ['canvas'],
} as const satisfies Record<GanttAction, readonly [GanttOwner]>;
