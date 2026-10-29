/**
 * De OPS-velden in een XER die de app zelf schreef (`xerWriter.ts`), gelezen door `readXER`.
 *
 * P6 rekent altijd in uren; een XER-duur en -lag zijn dus altijd een aantal uren, en zonder meer leest
 * de lezer elke activiteit in de urenmaat (alleen uren §3.10, T15). Een taak die in OPS in de dagenmaat
 * stond, zou na OPS → XER → OPS dan geen dagtaak meer zijn. Daarom schrijft de app eigen tekst-UDF's,
 * precies zoals de P6 XML-export (`p6xmlWriter.ts`, `xmlDayMeasure.ts`; T13, T21, I7):
 *
 *  - TASK, per activiteit: `OPS_TaskDurationUnit` (`days` of `hours`), en waar nodig de maatrecords
 *    `OPS_DayMeasureDurations` (dagenmaat met een breuk), `OPS_ExactMinutes` (urenmaat met een breuk in
 *    minuten) en `OPS_DayMeasureLags` (de lagen naar deze activiteit; sleutel `voorganger-task_id:type`);
 *  - PROJECT: `OPS_DefaultWorkRule`, de standaardwerkregel van het project (alleen als het project er
 *    een koos; review PR #393 ronde 2, punt E2);
 *  - RSRC: `OPS_FlatCapacity`, de geschreven `max_qty_per_hr` van een resource met een vaste capaciteit
 *    (zonder stappen; review PR #393 ronde 2, punt D).
 *
 * HERKENNING PER TAAK (T15, zoals `p6xmlReader.ts`). Een activiteit met een eigen, geldige eenheidswaarde
 * leest volgens `readMeasure`: de dagenmaat komt terug, met het record zolang het standaardveld nog de
 * geschreven minuten draagt. Een activiteit zonder eenheidswaarde (bijvoorbeeld later in P6 toegevoegd)
 * leest als urenmaat, precies als op main, en verandert de andere activiteiten niet. Een bestand zonder
 * deze UDF's leest precies als op main: de lezer zoekt de waarden alleen als een definitie bestaat.
 *
 * De kalenders lezen met de gewone regels (`xerCalendarData.ts`): de banden in `clndr_data` bepalen de
 * urenkalender. Er is geen OPS-markering voor kalenders.
 *
 * De OPS-UDF's zijn geen eigen velden van de gebruiker: de metadatalezer (`xerMetadata.ts`) laat elke
 * definitie met een OPS-naam weg, net zoals de P6 XML-lezer ze niet als veld toont. P6 zelf toont ze als
 * gewone eigen velden.
 */
import { OPS_DURATION_UNIT_NAME, isTaskDurationUnit } from '@/services/xmlInterchange';
import {
  OPS_DAY_MEASURE_DURATIONS_NAME, OPS_DAY_MEASURE_LAGS_NAME, OPS_EXACT_MINUTES_NAME,
} from '@/services/xmlDayMeasure';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import type { XerRow, XerTables } from './xerTables';

/** De standaardwerkregel van het project (`Project.defaultWorkRule`), als PROJECT-UDF. */
export const OPS_XER_DEFAULT_WORK_RULE_NAME = 'OPS_DefaultWorkRule';
/** De geschreven `max_qty_per_hr` van een resource met vaste capaciteit, als RSRC-UDF. */
export const OPS_XER_FLAT_CAPACITY_NAME = 'OPS_FlatCapacity';

/** De duurvelden van een activiteit, op hun XER-naam (de sleutels in een duurrecord). */
export const XER_DURATION_FIELDS = { duration: 'target_drtn_hr_cnt', remaining: 'remain_drtn_hr_cnt' } as const;

export type XerOpsField = 'unit' | 'dayRecords' | 'exactRecords' | 'lagRecords' | 'defaultWorkRule' | 'flatCapacity';

/** Elke OPS-UDF: haar naam, de tabel waar ze op staat, en wat ze draagt. Alleen tekst (`FT_TEXT`). */
export const OPS_XER_UDFS: readonly { field: XerOpsField; label: string; table: 'TASK' | 'PROJECT' | 'RSRC' }[] = [
  { field: 'unit', label: OPS_DURATION_UNIT_NAME, table: 'TASK' },
  { field: 'dayRecords', label: OPS_DAY_MEASURE_DURATIONS_NAME, table: 'TASK' },
  { field: 'exactRecords', label: OPS_EXACT_MINUTES_NAME, table: 'TASK' },
  { field: 'lagRecords', label: OPS_DAY_MEASURE_LAGS_NAME, table: 'TASK' },
  { field: 'defaultWorkRule', label: OPS_XER_DEFAULT_WORK_RULE_NAME, table: 'PROJECT' },
  { field: 'flatCapacity', label: OPS_XER_FLAT_CAPACITY_NAME, table: 'RSRC' },
];

export interface XerOpsFields {
  /** De `udf_type_id`'s van alle OPS-definities; de metadatalezer laat ze weg. */
  typeIds: ReadonlySet<string>;
  /** `task_id` → eenheid. Alleen een eenduidige, geldige waarde: twee verschillende waarden voor één
   *  activiteit tellen als geen waarde (urenmaat, zoals op main). */
  unitByTask: ReadonlyMap<string, 'days' | 'hours'>;
  /** `task_id` → de JSON-tekst van de duurrecords (dagenmaat) of minutenrecords (urenmaat). */
  dayRecordsByTask: ReadonlyMap<string, string>;
  exactRecordsByTask: ReadonlyMap<string, string>;
  /** `task_id` van de opvolger → de JSON-tekst van de lagrecords. */
  lagRecordsByTask: ReadonlyMap<string, string>;
  /** `proj_id` → de standaardwerkregel (een geldige `WorkRule`). */
  defaultWorkRuleByProject: ReadonlyMap<string, WorkRule>;
  /** `rsrc_id` → de geschreven capaciteit per uur. */
  flatCapacityByResource: ReadonlyMap<string, number>;
}

const EMPTY: XerOpsFields = {
  typeIds: new Set(), unitByTask: new Map(), dayRecordsByTask: new Map(), exactRecordsByTask: new Map(),
  lagRecordsByTask: new Map(), defaultWorkRuleByProject: new Map(), flatCapacityByResource: new Map(),
};

/** De soort van een `UDFTYPE`-rij als het een OPS-definitie is: naam, tabel en type (`FT_TEXT`) kloppen.
 *  De metadatalezer (`xerMetadata.ts`) laat zulke rijen weg uit de eigen velden. */
export function opsUdfFieldOf(row: XerRow): XerOpsField | undefined {
  if (!row.cells.udf_type_id?.trim() || row.cells.logical_data_type?.trim().toUpperCase() !== 'FT_TEXT') return undefined;
  const label = row.cells.udf_type_label?.trim();
  const table = row.cells.table_name?.trim().toUpperCase();
  return OPS_XER_UDFS.find(entry => entry.label === label && entry.table === table)?.field;
}

/** De OPS-definities in `UDFTYPE`: `udf_type_id` → soort. Leest alleen `UDFTYPE`. */
function opsUdfFieldsByTypeId(tables: XerTables): ReadonlyMap<string, XerOpsField> {
  const fieldByTypeId = new Map<string, XerOpsField>();
  for (const row of tables.tables.get('UDFTYPE')?.rows ?? []) {
    const field = opsUdfFieldOf(row);
    if (field) fieldByTypeId.set(row.cells.udf_type_id.trim(), field);
  }
  return fieldByTypeId;
}

/**
 * De OPS-velden van een bestand, één keer per bestand. Zonder OPS-definitie in `UDFTYPE` is dit meteen
 * leeg, zonder de waardentabel te lezen. Per sleutel telt de eerste waarde; voor de eenheid moet elke
 * waarde gelijk zijn.
 */
export function readXerOpsFields(tables: XerTables): XerOpsFields {
  const fieldByTypeId = opsUdfFieldsByTypeId(tables);
  if (fieldByTypeId.size === 0) return EMPTY;
  const units = new Map<string, 'days' | 'hours' | null>();
  const texts: Record<'dayRecords' | 'exactRecords' | 'lagRecords', Map<string, string>> = {
    dayRecords: new Map(), exactRecords: new Map(), lagRecords: new Map(),
  };
  const defaultWorkRuleByProject = new Map<string, WorkRule>();
  const flatCapacityByResource = new Map<string, number>();
  for (const row of tables.tables.get('UDFVALUE')?.rows ?? []) {
    const field = fieldByTypeId.get(row.cells.udf_type_id?.trim() ?? '');
    const key = row.cells.fk_id?.trim() ?? '';
    if (!field || !key) continue;
    const text = (row.cells.udf_text ?? '').trim();
    if (field === 'unit') {
      const unit = isTaskDurationUnit(text) ? text : null;
      const seen = units.get(key);
      units.set(key, seen === undefined || seen === unit ? unit : null);
    } else if (field === 'defaultWorkRule') {
      const rule = WORK_RULES.find(candidate => candidate === text);
      if (rule && !defaultWorkRuleByProject.has(key)) defaultWorkRuleByProject.set(key, rule);
    } else if (field === 'flatCapacity') {
      const value = text === '' ? NaN : Number(text);
      if (Number.isFinite(value) && value >= 0 && !flatCapacityByResource.has(key)) flatCapacityByResource.set(key, value);
    } else if (!texts[field].has(key)) {
      texts[field].set(key, text);
    }
  }
  const unitByTask = new Map<string, 'days' | 'hours'>();
  for (const [key, unit] of units) if (unit) unitByTask.set(key, unit);
  return {
    typeIds: new Set(fieldByTypeId.keys()),
    unitByTask,
    dayRecordsByTask: texts.dayRecords,
    exactRecordsByTask: texts.exactRecords,
    lagRecordsByTask: texts.lagRecords,
    defaultWorkRuleByProject,
    flatCapacityByResource,
  };
}
