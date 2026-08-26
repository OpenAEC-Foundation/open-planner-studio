import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useSplitter } from '@/hooks/useSplitter';
import {
  saveLeftPanelWidth,
  TASK_TABLE_MAX_WIDTH,
  TASK_TABLE_MIN_WIDTH,
} from '@/utils/settingsStore';
import type { Task } from '@/types/task';
import { GanttTaskGrid } from '@/components/task-grid/GanttTaskGrid';
import { GanttCanvas, type GanttGridRevealRequest } from './GanttCanvas';

export function GanttWorkspace() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const leftPanelWidth = useAppStore(state => state.ui.leftPanelWidth);
  const setUI = useAppStore(state => state.setUI);
  const [revealRequest, setRevealRequest] = useState<GanttGridRevealRequest | null>(null);
  const [histogramHost, setHistogramHost] = useState<HTMLDivElement | null>(null);
  const [miniMapHost, setMiniMapHost] = useState<HTMLDivElement | null>(null);

  const splitter = useSplitter({
    min: TASK_TABLE_MIN_WIDTH,
    max: () => {
      const width = workspaceRef.current?.getBoundingClientRect().width ?? TASK_TABLE_MAX_WIDTH;
      return Math.min(TASK_TABLE_MAX_WIDTH, Math.max(TASK_TABLE_MIN_WIDTH, width - 180));
    },
    computeSize: event => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      return rect ? Math.round(event.clientX - rect.left) : Number.NaN;
    },
    onResize: width => {
      if (!Number.isNaN(width)) setUI({ leftPanelWidth: width });
    },
    onCommit: () => { void saveLeftPanelWidth(useAppStore.getState().ui.leftPanelWidth); },
  });

  const revealTask = useCallback((task: Task) => {
    setRevealRequest(current => ({ taskId: task.id, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);

  return (
    <div ref={workspaceRef} className="gantt-workspace" data-testid="gantt-workspace">
      <div className="gantt-workspace-grid" style={{ width: leftPanelWidth }}>
        <GanttTaskGrid onPlainTaskClick={revealTask} />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize task grid"
        aria-valuemin={TASK_TABLE_MIN_WIDTH}
        aria-valuemax={TASK_TABLE_MAX_WIDTH}
        aria-valuenow={Math.round(leftPanelWidth)}
        tabIndex={0}
        data-testid="gantt-workspace-splitter"
        className="gantt-workspace-splitter"
        data-resizing={splitter.isResizing ? 'true' : undefined}
        onPointerDown={splitter.startPointer}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const direction = event.key === 'ArrowLeft' ? -1 : 1;
          const next = Math.min(
            TASK_TABLE_MAX_WIDTH,
            Math.max(TASK_TABLE_MIN_WIDTH, leftPanelWidth + direction * (event.shiftKey ? 40 : 10)),
          );
          setUI({ leftPanelWidth: next });
          void saveLeftPanelWidth(next);
        }}
      />
      <div className="gantt-workspace-timeline">
        <GanttCanvas
          revealRequest={revealRequest}
          histogramHost={histogramHost}
          histogramPickerWidth={leftPanelWidth}
          miniMapHost={miniMapHost}
        />
      </div>
      <div
        ref={setHistogramHost}
        className="gantt-workspace-histogram"
        data-testid="gantt-histogram-host"
      />
      <div
        ref={setMiniMapHost}
        className="gantt-workspace-minimap"
        data-testid="gantt-minimap-host"
      />
    </div>
  );
}
