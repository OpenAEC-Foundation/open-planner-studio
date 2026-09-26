// Wat doet een wiel-event boven de Gantt? — ÉÉN bron van waarheid.
//
// Waarom apart: het secundaire split-view-pane heeft eigen navigatie; met eigen hardgecodeerde
// wiel-regels zou het de gebruikersinstelling `ui.scrollMode` negeren en gedroeg het wiel zich links
// en rechts anders — twee navigatiemethoden in één venster. De beslissing zit daarom hier, puur en headless testbaar; `useGanttZoom` (primair pane) en de
// wiel-handler in `GanttCanvas` (secundair pane) roepen allebei deze functie aan. Zo KÁN de
// semantiek niet meer uiteenlopen — precies de bug die dit repareert.
//
// Wat er per pane verschilt is alleen het DOEL van de gekozen functie (gedeelde `view.zoom`/
// `view.scrollX` versus `splitView.secondaryZoom`/`secondaryScrollX`), niet de keuze zelf.

import type { ModifierMap, PositionDivision, ScrollMode, WheelFunction } from '@/state/slices/types';

// Position-mode split thresholds (fixed, no user slider for now).
const HORIZONTAL_SPLIT = 0.5; // fraction of width: left half vs right half
const VERTICAL_BAND = 0.3;    // fraction of height: top band (near timescale)

export interface WheelFunctionInput {
  /** De gebruikersinstelling `ui.scrollMode`. */
  mode: ScrollMode;
  /** `e.ctrlKey || e.metaKey` (⌘ op macOS telt als Ctrl). */
  ctrl: boolean;
  shift: boolean;
  /** Cursorpositie als fractie (0..1) van de PANE-breedte/-hoogte waarboven gescrold wordt.
   *  Alleen gebruikt in de 'position'-modus. Aanroepers rekenen tegen hun eigen container: het
   *  primaire pane inclusief takentabel, het secundaire pane (dat geen takentabel heeft) tegen
   *  zijn eigen rect. */
  fracX: number;
  fracY: number;
  /** De gebruikersinstelling `ui.positionDivision`; alleen relevant in de 'position'-modus. */
  division: PositionDivision;
  /** De gebruikersinstelling `ui.modifierMap`; alleen relevant in de 'modifier'-modus. */
  map: ModifierMap;
}

/** Bepaal welke functie ('vertical' | 'horizontal' | 'zoom') dit wiel-event uitvoert. Puur. */
export function resolveWheelFunction({
  mode,
  ctrl,
  shift,
  fracX,
  fracY,
  division,
  map,
}: WheelFunctionInput): WheelFunction {
  if (mode === 'drag') {
    // Drag mode: the wheel zooms (cursor-anchored), no modifier needed.
    // Panning is done by dragging the canvas (see GanttCanvas).
    // Shift+wiel scrolt wél de rijen: dit is de STANDAARDmodus, en zonder
    // deze uitzondering is verticaal scrollen alleen bereikbaar door de chart-achtergrond te
    // slepen — wat niet werkt vanuit de takentabel (die gaat naar rij-slepen/box-select).
    // Er is ook een echte verticale scrollbalk naast de panes, maar deze sneltoets is sneller dan
    // naar de balk grijpen.
    return shift ? 'vertical' : 'zoom';
  }
  if (mode === 'modifier') {
    if (ctrl) return map.ctrl;
    if (shift) return map.shift;
    return map.plain;
  }
  // position mode: modifiers are fixed overrides, otherwise by cursor.
  if (ctrl) return 'zoom';
  if (shift) return 'horizontal';
  if (division === 'left-right') {
    return fracX < HORIZONTAL_SPLIT ? 'vertical' : 'horizontal';
  }
  if (division === 'top-bottom') {
    // Top band (near the timescale) pans horizontally; below scrolls rows.
    return fracY < VERTICAL_BAND ? 'horizontal' : 'vertical';
  }
  // corner: top-right quadrant pans horizontally; everything else vertical.
  const topRight = fracX >= HORIZONTAL_SPLIT && fracY < 0.5;
  return topRight ? 'horizontal' : 'vertical';
}
