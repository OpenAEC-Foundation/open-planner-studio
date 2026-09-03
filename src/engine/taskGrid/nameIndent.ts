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
 */
export const TASK_NAME_INDENT_UNIT = 20;

/** Padding-inline-start van de naamrij in pixels, vóór het (eventuele) triehoekje. */
export function taskNameIndent(depth: number, hasDisclosure: boolean): number {
  const level = Math.max(0, Math.floor(depth));
  return level * TASK_NAME_INDENT_UNIT + (hasDisclosure ? 0 : TASK_NAME_INDENT_UNIT);
}

/** Waar de naamtekst zelf begint — gelijk voor blad en samenvatting op dezelfde diepte. */
export function taskNameTextOffset(depth: number): number {
  return (Math.max(0, Math.floor(depth)) + 1) * TASK_NAME_INDENT_UNIT;
}
