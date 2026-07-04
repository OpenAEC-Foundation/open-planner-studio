// Kleine, dependency-vrije registratie van het zichtbare Gantt-tijdvenster (fase 2.7, §3.3).
// GanttCanvas registreert bij elke render de breedte van het primaire chart-gedeelte
// (containerbreedte − takentabel), zodat store-acties zoals `setTimeScale` de
// recenter-ankerformule (viewportmidden vasthouden) kunnen toepassen zonder dat de
// store aan React/DOM hangt. Headless (tests) blijft de breedte null → geen recenter.

let chartWidth: number | null = null;

export function setGanttChartWidth(width: number): void {
  chartWidth = Number.isFinite(width) && width > 0 ? width : null;
}

export function getGanttChartWidth(): number | null {
  return chartWidth;
}
