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

export type GanttOwner = 'DOM-grid/workspace' | 'timelinecanvas';

export const ganttEventOwnership = {
  rowselect: ['DOM-grid/workspace'],
  disclosure: ['DOM-grid/workspace'],
  add: ['DOM-grid/workspace'],
  'row-dubbelklik': ['DOM-grid/workspace'],
  rowcontextmenu: ['DOM-grid/workspace'],
  rowdrag: ['DOM-grid/workspace'],
  tooltip: ['DOM-grid/workspace'],
  splitter: ['DOM-grid/workspace'],
  'vertical-scroll': ['DOM-grid/workspace'],
  'horizontal-time-scroll': ['timelinecanvas'],
  'fit-to-project': ['timelinecanvas'],
  'focus-on-task': ['timelinecanvas'],
  bars: ['timelinecanvas'],
  dependencies: ['timelinecanvas'],
  pan: ['timelinecanvas'],
  boxselect: ['timelinecanvas'],
} as const satisfies Record<GanttAction, readonly [GanttOwner]>;
