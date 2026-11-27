import { useEffect, useRef, useState } from 'react';
import {
  histogramLayout,
  histogramPickerMaxScroll,
  histogramPickerRowHeight,
  histogramPickerTrackHeight,
  isInHistogramPicker,
  type HistogramPickerSide,
} from '@/engine/renderer/HistogramRenderer';

interface GanttHistogramPickerScrollInput {
  container: HTMLDivElement | null;
  pickerWidth: number;
  pickerSide: HistogramPickerSide;
  canvasHeight: number;
  itemCount: number;
  pickerIds: (string | undefined)[];
  selectedResourceId: string | undefined;
  fontScale: number;
}

interface GanttHistogramPickerScrollOutput {
  pickerScrollY: number;
}

export function useGanttHistogramPickerScroll(
  input: GanttHistogramPickerScrollInput,
): GanttHistogramPickerScrollOutput {
  const [pickerScrollY, setPickerScrollY] = useState(0);
  const latest = useRef(input);
  latest.current = input;

  useEffect(() => {
    const max = histogramPickerMaxScroll(input.itemCount, input.canvasHeight, input.fontScale);
    setPickerScrollY(current => Math.min(current, max));
  }, [input.itemCount, input.canvasHeight, input.fontScale]);

  useEffect(() => {
    const container = input.container;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const current = latest.current;
      const rect = container.getBoundingClientRect();
      const layout = histogramLayout(rect.width, current.pickerWidth, current.pickerSide);
      if (!isInHistogramPicker(layout, event.clientX - rect.left)) return;
      const max = histogramPickerMaxScroll(current.itemCount, current.canvasHeight, current.fontScale);
      if (max <= 0) return;
      event.preventDefault();
      const rowH = histogramPickerRowHeight(current.fontScale);
      const trackHeight = histogramPickerTrackHeight(current.canvasHeight, current.fontScale);
      const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const delta = event.deltaMode === 1 ? rawDelta * rowH
        : event.deltaMode === 2 ? rawDelta * trackHeight
        : rawDelta;
      setPickerScrollY(prev => Math.min(max, Math.max(0, prev + delta)));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [input.container]);

  useEffect(() => {
    const current = latest.current;
    const idx = current.pickerIds.indexOf(current.selectedResourceId);
    if (idx <= 0) return;
    const scrollIdx = idx - 1;
    const rowH = histogramPickerRowHeight(current.fontScale);
    const rowTop = scrollIdx * rowH;
    const rowBottom = rowTop + rowH;
    const trackHeight = histogramPickerTrackHeight(current.canvasHeight, current.fontScale);
    setPickerScrollY(prev => {
      if (rowTop < prev) return rowTop;
      if (rowBottom > prev + trackHeight) return Math.max(0, rowBottom - trackHeight);
      return prev;
    });
  }, [input.selectedResourceId]);

  return { pickerScrollY };
}
