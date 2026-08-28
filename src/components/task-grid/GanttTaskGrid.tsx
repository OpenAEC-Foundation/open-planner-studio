import type { Task } from '@/types/task';
import { TaskGridSurface } from './FullTaskGrid';

export interface GanttTaskGridProps {
  onPlainTaskClick?: (task: Task) => void;
}

/**
 * De linker takenlijst van de Gantt. De bediening en celprojectie zijn exact dezelfde
 * `TaskGridSurface` als in Tabel; alleen de persoonlijke surface, hoge tijdlijnkop en
 * het directe subtaak-plusje verschillen.
 */
export function GanttTaskGrid({ onPlainTaskClick }: GanttTaskGridProps) {
  return (
    <TaskGridSurface
      surfaceId="gantt-task-grid"
      baseHeaderHeight={50}
      showSummaryAdd
      onPlainTaskClick={onPlainTaskClick}
    />
  );
}
