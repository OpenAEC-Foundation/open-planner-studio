import type { Task } from '@/types/task';
import { TaskGridSurface } from './FullTaskGrid';

export interface GanttTaskGridProps {
  onPlainTaskClick?: (task: Task) => void;
}

export function GanttTaskGrid({ onPlainTaskClick }: GanttTaskGridProps) {
  return (
    <TaskGridSurface
      surfaceId="gantt-task-grid"
      baseHeaderHeight={50}
      onPlainTaskClick={onPlainTaskClick}
    />
  );
}
