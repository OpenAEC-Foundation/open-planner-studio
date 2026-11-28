import type { TaskGridColumnPreference } from '@/types/taskGrid';
import type { BarColorSelection } from '@/types/barColor';

export type TimeScale = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'hour';

export type DateNotation = 'dmy' | 'mdy' | 'ymd';

export type TimeNotation = '24h' | '12h';

export type DurationDisplay = 'auto' | 'days' | 'hours';

export type BarSplitMode = 'never' | 'selection' | 'always';

export type BuiltinFieldKey =
  | 'name' | 'wbsCode' | 'duration' | 'start' | 'finish'
  | 'totalFloat' | 'isCritical' | 'completion' | 'taskType' | 'isMilestone'
  | 'freeFloat' | 'interferingFloat' | 'isNearCritical' | 'floatPath'
  | 'activeDuring';

export type FieldRef =
  | { src: 'builtin'; key: BuiltinFieldKey }
  | { src: 'activityCode'; typeId: string }
  | { src: 'customField'; defId: string }
  | { src: 'resource' }
  | { src: 'resourceType' };

export interface ColumnConfig {
  field: FieldRef;
  visible: boolean;
  width: number;
}

export type FilterOperator =
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'startsWith' | 'between' | 'isEmpty' | 'in';

export type FilterNode =
  | { kind: 'group'; op: 'AND' | 'OR'; children: FilterNode[] }
  | {
      kind: 'rule';
      field: FieldRef;
      operator: FilterOperator;
      value?: string | number | boolean | string[];
      value2?: string | number;
    };

export interface SavedFilter {
  id: string;
  name: string;
  filter: FilterNode;
}

export interface GroupLevel {
  field: FieldRef;
  dir: 'asc' | 'desc';
}

export interface SortLevel {
  field: FieldRef;
  dir: 'asc' | 'desc';
}

export interface Layout {
  id: string;
  name: string;
  columns?: TaskGridColumnPreference[];
  group?: GroupLevel[];
  sort?: SortLevel[];
  filter?: FilterNode | null;
  timeScale?: TimeScale;
  showRelations?: boolean;
  overlays?: LayoutOverlays;
  icon?: string;
}

export interface LayoutOverlays {
  baseline: boolean;
  progressLine: boolean;
  statusDateLine: boolean;
  resourceAccent: boolean;
  floatBand: boolean;
  barColors: BarColorSelection;
}

export const LAYOUT_PARTS = ['columns', 'filter', 'group', 'sort', 'timeScale', 'showRelations', 'overlays'] as const;
export type LayoutPart = typeof LAYOUT_PARTS[number];

export interface LayoutViewParts {
  columns: TaskGridColumnPreference[];
  filter: FilterNode | null;
  group: GroupLevel[];
  sort: SortLevel[];
  timeScale: TimeScale;
  showRelations: boolean;
  overlays: LayoutOverlays;
}

export interface LayoutSession {
  layouts: Layout[];
  restore: LayoutViewParts;
}

export interface SplitViewState {
  ratio: number;
  secondaryZoom: number;
  secondaryScrollX: number;
}

export interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  timeScale: TimeScale;
  viewStartDate: string;
  histogramResourceId?: string;
  filter: FilterNode | null;
  group: GroupLevel[];
  sort: SortLevel[];
  collapsedGroupKeys: string[];
  splitView?: SplitViewState;
  showRelations?: boolean;
  layoutSession?: LayoutSession;
  pendingFit?: boolean;
  pendingFocusTaskId?: string;
  pendingFocusTaskPreserveZoom?: boolean;
}
