import { MS_PER_DAY } from '@/utils/dateUtils';

export function dateToX(
  date: Date,
  viewStart: Date,
  chartOriginX: number,
  zoom: number,
  scrollX: number,
): number {
  const daysFromStart = (date.getTime() - viewStart.getTime()) / MS_PER_DAY;
  return chartOriginX + daysFromStart * zoom - scrollX;
}

export function xToDayOffset(
  x: number,
  chartOriginX: number,
  zoom: number,
  scrollX: number,
): number {
  return (x - chartOriginX + scrollX) / zoom;
}

export function xToDate(
  x: number,
  viewStart: Date,
  chartOriginX: number,
  zoom: number,
  scrollX: number,
): Date {
  const days = xToDayOffset(x, chartOriginX, zoom, scrollX);
  return new Date(viewStart.getTime() + days * MS_PER_DAY);
}

export interface GanttAxis {
  dateToX(date: Date): number;
  xToDate(x: number): Date;
  daySpan(from: Date, to: Date): number;
  dayIndexOf(date: Date): number;
  dateAtIndex(index: number): Date;
}
