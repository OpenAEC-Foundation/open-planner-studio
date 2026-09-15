// Brug tussen het tijdlijncanvas en de DOM-taakgrid links ervan, voor één gebaar: een overwegend
// VERTICALE sleep op een balkbody. De rijsleep (herordenen/nesten, één undo-stap, datums
// ongewijzigd) is eigendom van de DOM-grid (`ganttEventOwnership.rowdrag`), en dat blijft zo —
// het canvas begint geen eigen rijsleep maar draagt zijn kandidaat over aan precies dezelfde
// `useTableRowDrag` die de taakrij links gebruikt. Zo landt een balk exact waar een rij zou landen.
//
// Waarom een brug: `GanttTaskGrid` en `GanttCanvas` zijn broers in `GanttWorkspace` en delen geen
// hook-instantie. De grid registreert zijn `startRowDrag` hier; het canvas leest de registratie
// pas op het moment van het gebaar (ref, geen state — er mag geen rerender van afhangen).
//
// Historie: dit gebaar bestond sinds 2026-08-27 (f4390a0, toen nog via `useRowDrag` in de
// coördinator zelf) en verdween ongemerkt in de tabel-overhaul-merge van 2026-08-31, toen de
// rijsleep naar de DOM-grid verhuisde. Hersteld op eigenaarsverzoek (2026-09-15).
import { createContext, useContext, type RefObject } from 'react';
import type { TableRowDragCandidate } from '@/components/panels/hooks/useTableRowDrag';

export type GanttRowDragStarter = (candidate: TableRowDragCandidate) => void;

export interface GanttRowDragBridge {
  /** Door de ingebedde taakgrid gezet zolang hij gemount is; `null` = geen grid om aan over te dragen. */
  startRef: RefObject<GanttRowDragStarter | null>;
}

/** `null` buiten de Gantt-werkruimte (bv. de volledige Tabel-tab): daar bestaat geen canvas dat
 *  iets over te dragen heeft, en de grid registreert dan ook niets. */
export const GanttRowDragBridgeContext = createContext<GanttRowDragBridge | null>(null);

export function useGanttRowDragBridge(): GanttRowDragBridge | null {
  return useContext(GanttRowDragBridgeContext);
}
