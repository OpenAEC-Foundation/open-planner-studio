import type { Task } from '@/types/task';
import { TaskGridSurface } from './FullTaskGrid';

export interface GanttTaskGridProps {
  onPlainTaskClick?: (task: Task) => void;
}

/**
 * De linker takenlijst van de Gantt. De bediening en celprojectie zijn exact dezelfde
 * `TaskGridSurface` als in Tabel, ook het subtaak-plusje (issue #901); alleen de persoonlijke
 * surface en de hoge tijdlijnkop verschillen.
 */
export function GanttTaskGrid({ onPlainTaskClick }: GanttTaskGridProps) {
  return (
    <TaskGridSurface
      surfaceId="gantt-task-grid"
      baseHeaderHeight={50}
      onPlainTaskClick={onPlainTaskClick}
    />
  );
}
