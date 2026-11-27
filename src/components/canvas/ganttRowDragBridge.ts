import { createContext, useContext, type RefObject } from 'react';
import type { TableRowDragCandidate } from '@/components/panels/hooks/useTableRowDrag';

export type GanttRowDragStarter = (candidate: TableRowDragCandidate) => void;

export interface GanttRowDragBridge {
  startRef: RefObject<GanttRowDragStarter | null>;
}

export const GanttRowDragBridgeContext = createContext<GanttRowDragBridge | null>(null);

export function useGanttRowDragBridge(): GanttRowDragBridge | null {
  return useContext(GanttRowDragBridgeContext);
}
