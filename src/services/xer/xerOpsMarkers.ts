/**
 * OPS-markeringen in een XER die de app zelf schreef (`xerWriter.ts`), gelezen door `readXER`.
 *
 * P6 rekent altijd in uren; een XER-kalender draagt dus altijd kloktijden, en de lezer opent elke
 * XER-kalender daarom in uurmodus. Voor een project dat in OPS in dagen rekende, zou een rondgang
 * OPS → XER → OPS dan andere datums en speling geven (een begin-mijlpaal aan het einde van de dag,
 * een SF-relatie). Daarom schrijft de app twee eigen UDF's, net als de P6 XML-export
 * (`OPS_TaskDurationUnit`, `p6xmlWriter.ts`):
 *
 *  - `OPS_TaskDurationUnit` op TASK: per activiteit `days` of `hours`;
 *  - `OPS_ExportInfo` op PROJECT: `ops-xer-1;hourCalendars=<clndr_id's>` (de kalenders die in OPS in
 *    uurmodus rekenden).
 *
 * HERKENNING IS STRENG (review PR #393, punt 1). De lezer leest een project alleen als OPS-export als
 *  1. precies één TASK-definitie `OPS_TaskDurationUnit` en precies één PROJECT-definitie
 *     `OPS_ExportInfo` bestaan, beide van het type tekst;
 *  2. dit project een geldige `OPS_ExportInfo`-waarde heeft (exact het formaat hierboven); en
 *  3. ELKE activiteit van dit project een eigen geldige eenheidswaarde heeft.
 * Ontbreekt er iets (een losse UDF-definitie, of een activiteit die iemand in P6 toevoegde), dan leest
 * het hele project volgens de gewone P6-regels, precies als zonder markeringen, en blijven de UDF's
 * zichtbaar als eigen veld. P6 zelf toont de twee velden als gewone eigen velden.
 */
import { OPS_DURATION_UNIT_NAME, isTaskDurationUnit } from '@/services/xmlInterchange';
import type { XerRow, XerTables } from './xerTables';

export const OPS_XER_DURATION_UNIT_LABEL = OPS_DURATION_UNIT_NAME;
export const OPS_XER_EXPORT_INFO_LABEL = 'OPS_ExportInfo';
/** De waarde van `OPS_ExportInfo`: versie, dan de uurkalenders (komma-gescheiden `clndr_id`'s). */
export function opsXerExportInfoValue(hourCalendarIds: readonly string[]): string {
  return `ops-xer-1;hourCalendars=${hourCalendarIds.join(',')}`;
}
const EXPORT_INFO_PATTERN = /^ops-xer-1;hourCalendars=((?:[^,;\s]+(?:,[^,;\s]+)*)?)$/;

export interface XerOpsMarkers {
  /** `task_id` → eenheid van de taak in OPS (voor ELKE activiteit van het project). */
  taskUnits: ReadonlyMap<string, 'days' | 'hours'>;
  /** `clndr_id`'s van de kalenders die in OPS in uurmodus rekenden. */
  hourCalendarIds: ReadonlySet<string>;
}

type MarkerKind = 'unit' | 'info';

function markerKind(row: XerRow): MarkerKind | undefined {
  const label = row.cells.udf_type_label?.trim();
  const table = row.cells.table_name?.trim().toUpperCase();
  const type = row.cells.logical_data_type?.trim().toUpperCase();
  if (type !== 'FT_TEXT') return undefined;
  if (label === OPS_XER_DURATION_UNIT_LABEL && table === 'TASK') return 'unit';
  if (label === OPS_XER_EXPORT_INFO_LABEL && table === 'PROJECT') return 'info';
  return undefined;
}

/** De twee markerdefinities, alleen als elk precies één keer bestaat. */
function markerTypeIds(tables: XerTables): { unit: string; info: string } | undefined {
  const rows = tables.tables.get('UDFTYPE')?.rows ?? [];
  const unit = rows.filter(row => markerKind(row) === 'unit');
  const info = rows.filter(row => markerKind(row) === 'info');
  if (unit.length !== 1 || info.length !== 1) return undefined;
  const unitId = unit[0].cells.udf_type_id?.trim();
  const infoId = info[0].cells.udf_type_id?.trim();
  if (!unitId || !infoId || unitId === infoId) return undefined;
  return { unit: unitId, info: infoId };
}

/**
 * De OPS-markeringen van project `projectId`, of `undefined` als dit project geen volledig herkende
 * OPS-export is (zie de drie regels bovenaan). `activityRows` = alle TASK-rijen van het project.
 */
export function readXerOpsMarkers(tables: XerTables, projectId: string, activityRows: readonly XerRow[]): XerOpsMarkers | undefined {
  const ids = markerTypeIds(tables);
  if (!ids || activityRows.length === 0) return undefined;
  let info: string | undefined;
  const units = new Map<string, string>();
  for (const row of tables.tables.get('UDFVALUE')?.rows ?? []) {
    const typeId = row.cells.udf_type_id?.trim();
    const fk = (row.cells.fk_id ?? '').trim();
    const text = (row.cells.udf_text ?? '').trim();
    if (typeId === ids.info && fk === projectId) {
      if (info !== undefined) return undefined; // twee waarden voor één project: niet eenduidig
      info = text;
    } else if (typeId === ids.unit && fk) {
      if (units.has(fk)) return undefined;
      units.set(fk, text);
    }
  }
  const match = info === undefined ? null : EXPORT_INFO_PATTERN.exec(info);
  if (!match) return undefined;
  const taskUnits = new Map<string, 'days' | 'hours'>();
  for (const row of activityRows) {
    const taskId = row.cells.task_id?.trim() ?? '';
    const unit = units.get(taskId);
    if (!taskId || unit === undefined || !isTaskDurationUnit(unit)) return undefined;
    taskUnits.set(taskId, unit);
  }
  const hourCalendarIds = new Set(match[1] ? match[1].split(',') : []);
  return { taskUnits, hourCalendarIds };
}

/**
 * De `udf_type_id`'s van de markerdefinities, alleen als ELK project met activiteiten in dit bestand
 * een herkende OPS-export is. Alleen dan laat de metadatalezer (`xerMetadata.ts`) ze weg uit de eigen
 * velden; anders blijven ze zichtbaar, zoals elke andere UDF.
 */
export function recognizedOpsMarkerTypeIds(tables: XerTables): ReadonlySet<string> {
  const ids = markerTypeIds(tables);
  if (!ids) return new Set();
  const byProject = new Map<string, XerRow[]>();
  for (const row of tables.tables.get('TASK')?.rows ?? []) {
    const projectId = row.cells.proj_id?.trim() ?? '';
    const list = byProject.get(projectId);
    if (list) list.push(row); else byProject.set(projectId, [row]);
  }
  if (byProject.size === 0) return new Set();
  for (const [projectId, rows] of byProject) {
    if (!readXerOpsMarkers(tables, projectId, rows)) return new Set();
  }
  return new Set([ids.unit, ids.info]);
}
