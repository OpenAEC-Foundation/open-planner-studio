/**
 * Eén bron voor de verticale schuifruimte van de takenlijst en de Gantt.
 *
 * De takenlijst en de Gantt delen één verticale schuifstand (`view.scrollY`). Ze lopen alleen rij
 * op rij gelijk als hun maximale schuifstand ook gelijk is. Daarom rekenen beide met dezelfde
 * inhoudshoogte: alle zichtbare rijen, plus de spookregel onderaan (alleen in de boomweergave,
 * zie `ghostRow.ts`), plus een eindstrook ter dikte van de zwevende balk. Die strook houdt de laatste
 * rij vrij van de horizontale balk die over de onderrand ligt.
 *
 * Eigenaarsbevinding 2026-10-15 (checkstap 18, PR #362): zonder dit kon de takenlijst één rij verder
 * schuiven dan de Gantt. De store klemde de stand dan op de Gantt-grens; bij de volgende
 * horizontale scroll zette het raster zijn eigen stand daarop terug en sprong hij omhoog.
 */

/**
 * Dikte van de zwevende schuifbalken over takenlijst en Gantt, en daarmee ook de eindstrook onder
 * de laatste rij. Eén waarde voor alle drie: de strook van een overlay is precies één balk dik (geen
 * dode klikzone ernaast) en de eindstrook houdt precies één balk vrij. `globals.css` gebruikt
 * dezelfde 8 px voor `::-webkit-scrollbar`.
 */
export const OVERLAY_SCROLLBAR_SIZE = 8;

/** Breedte van de "kolom toevoegen"-strook: een 20px-knop met 6px lucht aan weerszijden (issue
 * #89). `TaskGrid` zet hem als `--task-grid-chooser-strip` op de shell; de CSS leest die variabele,
 * DataGridCore rekent er het horizontale bereik mee. */
export const TASK_GRID_CHOOSER_STRIP = 32;

/** Schuifbare inhoudshoogte ONDER de kop, gelijk voor takenlijst en Gantt. */
export function taskListScrollContentHeight(viewRowCount: number, rowHeight: number, hasGhostRow: boolean): number {
  return (Math.max(0, viewRowCount) + (hasGhostRow ? 1 : 0)) * rowHeight + OVERLAY_SCROLLBAR_SIZE;
}
