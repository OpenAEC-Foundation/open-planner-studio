import {
  computeViewRows,
  type ViewContext,
  type ViewRow,
  type ViewRowOpts,
} from '@/engine/view/visibleRows';
import { getNoneLabelValue } from '@/utils/noneLabel';

/** Minimale structurele invoer; bewust geen AppState-import, zodat dit een echte bladmodule blijft. */
export interface ViewRowsState {
  tasks: Parameters<typeof computeViewRows>[0];
  view: {
    filter: ViewRowOpts['filter'];
    group: ViewRowOpts['group'];
    sort: ViewRowOpts['sort'];
    collapsedGroupKeys: readonly string[];
  };
  ui: { collapsedTaskIds: readonly string[] };
  activityCodeTypes: ViewContext['activityCodeTypes'];
  customFieldDefs: ViewContext['customFieldDefs'];
  resources: ViewContext['resources'];
  assignments: ViewContext['assignments'];
}

/** Eén pure invoerprojectie voor viewupdates, historymaterialisatie en bandberekeningen. */
export function viewRowInputs(state: ViewRowsState): { opts: ViewRowOpts; ctx: ViewContext } {
  return {
    opts: {
      filter: state.view.filter ?? null,
      group: state.view.group ?? [],
      sort: state.view.sort ?? [],
      collapsedTaskIds: new Set(state.ui.collapsedTaskIds),
      collapsedGroupKeys: new Set(state.view.collapsedGroupKeys ?? []),
    },
    ctx: {
      activityCodeTypes: state.activityCodeTypes,
      customFieldDefs: state.customFieldDefs,
      resources: state.resources,
      assignments: state.assignments,
      noneLabel: getNoneLabelValue(),
    },
  };
}

export function deriveViewRows(state: ViewRowsState): ViewRow[] {
  const { opts, ctx } = viewRowInputs(state);
  return computeViewRows(state.tasks, opts, ctx);
}
