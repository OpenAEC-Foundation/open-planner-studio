import type { Task } from '@/types/task';
import type { ProgressMatchKind, ProgressOverrides, ProgressRow, ProgressRowReason } from './types';

export interface ProgressRowMatch {
  rowNumber: number;
  taskId?: string;
  match?: ProgressMatchKind;
  reason?: Extract<ProgressRowReason, 'unmatched' | 'ambiguousWbs' | 'duplicateRow'>;
}

export interface ProgressMatchResult {
  matches: readonly ProgressRowMatch[];
  ignoredOverrideRows: readonly number[];
}

/**
 * Matcht voortgangsrijen aan taken volgens de bindende resolutievolgorde uit A11 (het
 * implementatieplan, issue #27 etappe 2):
 *
 * 1. Overrides eerst, in rijvolgorde (de volgorde van `rows`, niet gesorteerd). Een override naar
 *    een bestaande taak claimt die taak (`match: 'manual'`) en wint dus altijd van een latere
 *    automatische id-/WBS-treffer van een ANDERE rij.
 * 2. Een override naar een niet-bestaande taak wordt genegeerd (de rij valt terug op automatische
 *    matching) en het rijnummer komt in `ignoredOverrideRows` — nooit stil.
 * 3. Twee overrides naar dezelfde taak: de eerste in rijvolgorde wint, de tweede wordt
 *    `refused`/`duplicateRow` (geen `taskId`, geen `match`).
 * 4. Daarna de automatische matching op de resterende taken: exact `task.id` ⇒ `'id'`; anders een
 *    unieke `wbsCode` ⇒ `'wbs'`; meerdere dragers ⇒ `ambiguousWbs`; niets ⇒ `unmatched`; al
 *    geclaimd (door een override of een eerdere rij) ⇒ `duplicateRow`.
 *
 * Puur, geen I/O. Indexeert `tasks` één keer (id-kaart + wbs-kaart) zodat dit lineair blijft in
 * zowel het aantal rijen als het aantal taken — geen `find()` per rij (tot 50.000 rijen mogelijk,
 * zie `PROGRESS_IMPORT_LIMITS`).
 */
export function matchProgressRows(
  rows: readonly ProgressRow[],
  tasks: readonly Task[],
  overrides?: ProgressOverrides,
): ProgressMatchResult {
  const taskById = new Map<string, Task>();
  for (const task of tasks) taskById.set(task.id, task);

  const taskIdsByWbs = new Map<string, string[]>();
  for (const task of tasks) {
    const wbs = task.wbsCode;
    if (!wbs) continue;
    const existing = taskIdsByWbs.get(wbs);
    if (existing) existing.push(task.id);
    else taskIdsByWbs.set(wbs, [task.id]);
  }

  // Fase 1: overrides eerst, strikt in rijvolgorde (de volgorde van `rows`). `claimedBy` draagt
  // ALLEEN de taken die een override al claimde — de automatische fase hieronder bouwt op dezelfde
  // kaart voort, zodat een automatische treffer op een door een override geclaimde taak terecht
  // `duplicateRow` wordt.
  const claimedBy = new Set<string>();
  const ignoredOverrideRows: number[] = [];
  // Rij-index → uitkomst van de override-fase (alleen aanwezig wanneer de rij een override droeg
  // die niet genegeerd werd).
  const overrideOutcomeByIndex = new Map<number, { taskId: string } | { duplicate: true }>();

  if (overrides) {
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const target = overrides.get(row.rowNumber);
      if (target === undefined) continue;
      if (!taskById.has(target)) {
        ignoredOverrideRows.push(row.rowNumber);
        continue;
      }
      if (claimedBy.has(target)) {
        overrideOutcomeByIndex.set(index, { duplicate: true });
        continue;
      }
      claimedBy.add(target);
      overrideOutcomeByIndex.set(index, { taskId: target });
    }
  }

  // Fase 2: automatische matching op de rijen die geen (geldige) override droegen.
  const matches: ProgressRowMatch[] = rows.map((row, index) => {
    const overrideOutcome = overrideOutcomeByIndex.get(index);
    if (overrideOutcome) {
      if ('duplicate' in overrideOutcome) {
        return { rowNumber: row.rowNumber, reason: 'duplicateRow' };
      }
      return { rowNumber: row.rowNumber, taskId: overrideOutcome.taskId, match: 'manual' };
    }

    if (row.taskId && taskById.has(row.taskId)) {
      if (claimedBy.has(row.taskId)) {
        return { rowNumber: row.rowNumber, reason: 'duplicateRow' };
      }
      claimedBy.add(row.taskId);
      return { rowNumber: row.rowNumber, taskId: row.taskId, match: 'id' };
    }

    if (row.wbsCode) {
      const candidates = taskIdsByWbs.get(row.wbsCode);
      if (candidates && candidates.length === 1) {
        const taskId = candidates[0];
        if (claimedBy.has(taskId)) {
          return { rowNumber: row.rowNumber, reason: 'duplicateRow' };
        }
        claimedBy.add(taskId);
        return { rowNumber: row.rowNumber, taskId, match: 'wbs' };
      }
      if (candidates && candidates.length > 1) {
        return { rowNumber: row.rowNumber, reason: 'ambiguousWbs' };
      }
    }

    return { rowNumber: row.rowNumber, reason: 'unmatched' };
  });

  return { matches, ignoredOverrideRows };
}
