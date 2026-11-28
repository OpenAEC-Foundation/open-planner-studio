import type { AppState } from '@/state/appStore';
import type { ScheduleWarning } from '@/engine/scheduler/scheduleWarnings';
import { saveShowHistogram } from '@/utils/settingsStore';

export function revealScheduleWarning(store: AppState, warning: ScheduleWarning): void {
  const { target } = warning;
  switch (target.type) {
    case 'task':
      store.focusOnTask(target.taskId);
      return;
    case 'sequence': {
      const hasSucc = store.tasks.some(t => t.id === target.successorId);
      const hasPred = store.tasks.some(t => t.id === target.predecessorId);
      if (hasSucc) store.focusOnTask(target.successorId);
      else if (hasPred) store.focusOnTask(target.predecessorId);
      if (hasSucc && hasPred) store.expandAncestorsOf(target.predecessorId);
      const ids = [target.predecessorId, target.successorId].filter(id => store.tasks.some(t => t.id === id));
      if (ids.length > 1) store.selectTasks(ids, false, hasSucc ? target.successorId : ids[0]);
      return;
    }
    case 'resource': {
      const taskIds = new Set(store.assignments
        .filter(a => a.resourceId === target.resourceId)
        .map(a => a.taskId));
      const ids = store.tasks.filter(t => taskIds.has(t.id)).map(t => t.id);
      if (ids.length > 0) store.selectTasks(ids, false, ids[0]);
      else store.deselectAll();
      store.setHistogramResource(target.resourceId);
      const tab = store.ui.activeRibbonTab;
      const ganttHidden = tab === 'table' || tab === 'ifc' || tab === 'report';
      if (!store.ui.showHistogram || ganttHidden) {
        store.setUI({ showHistogram: true, ...(ganttHidden ? { activeRibbonTab: 'resources' as const } : {}) });
        if (!store.ui.showHistogram) void saveShowHistogram(true);
      }
      return;
    }
    case 'project': {
      const ids = target.taskIds.filter(id => store.tasks.some(t => t.id === id));
      if (ids.length === 0) return;
      store.focusOnTask(ids[0]);
      if (ids.length > 1) store.selectTasks(ids, false, ids[0]);
      return;
    }
  }
}
