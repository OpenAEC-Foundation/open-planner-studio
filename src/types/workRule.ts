/**
 * Werkregel van een taak: welke hoeken van werk = duur × inzet beschermd zijn bij een BEWERKING.
 * Neutraal tussen MS Project en P6 — bewust niet `taskType` (OPS-domeinklasse), `mspTaskType`
 * (MSP-import) of `durationType` (WORKTIME/ELAPSEDTIME) genoemd. "Rate" = `unitsPerDay`, P6's
 * units/time; "work" = totaal werk (P6's units, MSP's work). De vertaling naar MSP/P6 staat in
 * `workRuleMapping.ts`.
 *
 * Afwezig op een taak ⇒ de projectstandaard, en als die ook ontbreekt FIXED_DURATION_RATE. De CPM
 * leest dit niet; het werkt in de bewerkingslaag (`src/engine/work/workTriangle.ts`).
 */
export type WorkRule =
  /** P6 Fixed Duration & Units/Time · MSP Fixed Duration, niet effort-driven · de default. */
  | 'FIXED_DURATION_RATE'
  /** P6 Fixed Duration & Units · MSP Fixed Duration, effort-driven (`effortDriven` bewaard). */
  | 'FIXED_DURATION_WORK'
  /** P6 Fixed Units · MSP Fixed Work. */
  | 'FIXED_WORK'
  /** P6 Fixed Units/Time · MSP Fixed Units, effort-driven (niet effort-driven valt hier ook onder,
   *  met `effortDriven: false` bewaard). */
  | 'FIXED_RATE';

const WORK_RULE_TABLE = {
  FIXED_DURATION_RATE: true,
  FIXED_DURATION_WORK: true,
  FIXED_WORK: true,
  FIXED_RATE: true,
} satisfies Record<WorkRule, true>;

/** Alle werkregels als runtime-lijst (importvalidatie, dropdowns) — `satisfies` dwingt af dat de
 *  lijst exact de union dekt, zoals `TASK_TYPES` in `task.ts`. */
export const WORK_RULES = Object.keys(WORK_RULE_TABLE) as WorkRule[];

/** De werkregel die geldt wanneer een taak (en het project) er geen draagt. */
export const DEFAULT_WORK_RULE: WorkRule = 'FIXED_DURATION_RATE';
