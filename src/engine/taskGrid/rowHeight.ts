// Gedeelde basisrijhoogte voor het taakraster (DOM) en de Gantt-tijdlijn (canvas).
//
// Eén bron, zodat raster en tijdlijn rij-op-rij gelijk blijven lopen: `FullTaskGrid` en
// `GanttCanvas` leiden hun effectieve rijhoogte allebei af van deze waarde × tekengrootte.
// De balkgeometrie binnen de rij staat in `engine/renderer/rowGeometry.ts`.

/** Rijhoogte bij Tekengrootte 100% (px). */
export const TASK_ROW_HEIGHT = 32;
