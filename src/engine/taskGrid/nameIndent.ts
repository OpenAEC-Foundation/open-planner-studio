/**
 * Inspringing van de taaknaamcel (issue #89). De hiërarchie moet leesbaar zijn uit de linkerrand
 * van de naam: het in-/uitklaptriehoekje van een samenvattende taak staat precies op de plek waar
 * de naam van zijn ouder begint, en de naam van een blad zonder triehoekje begint op dezelfde
 * kolom als de naam van een samenvattende taak op hetzelfde niveau. Daarvoor krijgt élke rij een
 * triehoekje-slot van één eenheid — een blad laat dat slot leeg in plaats van het over te slaan.
 *
 *   ▾ Taak 1                  diepte 0, slot 0–20, naam vanaf 20
 *       Subtaak 1             diepte 1, leeg slot 20–40, naam vanaf 40
 *     ▾ Subtaak 2             diepte 1, slot 20–40, naam vanaf 40
 *         Subsubtaak 1        diepte 2, leeg slot 40–60, naam vanaf 60
 *
 * De eenheid is de breedte van het triehoekje (`.full-task-grid-disclosure`, 16px) plus de
 * flex-gap van de naamrij (4px) in globals.css; een bronchecker bewaakt dat die twee getallen
 * hier bij elkaar blijven optellen.
 *
 * In de GEGROEPEERDE weergave (filter/groep/sortering actief) bestaat er geen boom: elke taakrij
 * is een blad onder een groepskop, en `depth` telt groepsniveaus, geen ouders. Daar is een
 * triehoekje-slot betekenisloos en volgt de naam de kleinere stap van de groepskop zelf, zodat
 * de taken net onder hun kop staan zonder een hiërarchie te suggereren die er niet is.
 */
export const TASK_NAME_INDENT_UNIT = 20;

/** Stap per groepsniveau; dezelfde als de inspringing van de groepskop in DataGridCore. */
export const GROUPED_NAME_INDENT_UNIT = 14;

export type TaskNameIndentMode = 'tree' | 'grouped';

/** Padding-inline-start van de naamrij in pixels, vóór het (eventuele) triehoekje. */
export function taskNameIndent(depth: number, hasDisclosure: boolean, mode: TaskNameIndentMode = 'tree'): number {
  const level = Math.max(0, Math.floor(depth));
  if (mode === 'grouped') return level * GROUPED_NAME_INDENT_UNIT;
  return level * TASK_NAME_INDENT_UNIT + (hasDisclosure ? 0 : TASK_NAME_INDENT_UNIT);
}
