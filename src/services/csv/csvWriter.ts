import { Task } from '@/types/task';
import type { UnrecordedExportField } from '@/state/recordedDatesSelectors';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import type { CustomTaskType } from '@/types/taskType';
import { flattenOrder, taskDepths } from '@/utils/wbs';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { formatLagShort } from '@/utils/lagFormat';

const DELIMITER = ';';
const BOM = '\uFEFF';

export function escapeCSV(value: string): string {
  if (value.includes(DELIMITER) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sequenceTypeToAbbrev(type: SequenceType): string {
  switch (type) {
    case 'FINISH_START': return 'FS';
    case 'FINISH_FINISH': return 'FF';
    case 'START_START': return 'SS';
    case 'START_FINISH': return 'SF';
  }
}

/**
 * Completion (%) in HELE procenten, geen decimalen: een bestand met decimale procenten gaat door
 * spreadsheetprogramma's met willekeurige landinstelling, en "8,38" (komma als decimaalteken) wordt
 * met de andere conventie (punt/komma als DUIZENDTALscheider) als 838 gelezen. Dat risico weegt
 * zwaarder dan de no-op-precisie. `isCompletionUnchanged` (buildPlan.ts) vangt het gevolg op: "100"
 * op een taak van ≥ 99,5% is bewust een no-op (symmetrisch voor "0" op ≤ 0,5%) — het bestand kan die
 * twee niet uit elkaar houden. Decimale INVOER (met de hand getypt, bv. "33,4") blijft op zijn eigen
 * precisie vergeleken.
 */
export function formatCompletionPercent(completion: number): string {
  return String(Math.round(completion * 100));
}

export function writeCSV(
  _project: Project,
  _calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  _resources: Resource[],
  _assignments: ResourceAssignment[],
  customTaskTypes: readonly CustomTaskType[] = [],
  /**
   * "Datums zoals opgeslagen": staat de modus aan, dan draagt `task.time` de vastlegging van het
   * bronbestand — mét de bewuste terugvallen voor assen die het bestand NIET vastlegde
   * (`totalFloat ?? 0`, `isCritical ?? false`). In de tabel toont die naad "Niet vastgelegd"; hier
   * is het equivalent een LEGE cel, want een CSV-lezer kan een verzonnen `0` niet van een echte
   * nulspeling onderscheiden. `undefined` (het gewone geval, en elk document buiten de modus) ⇒
   * gewone export. De aanroeper bouwt deze functie met `unrecordedExportGate`
   * (`state/recordedDatesSelectors`); deze module blijft store-vrij en krijgt hem als parameter.
   */
  unrecordedExportFieldsOf?: (task: Task) => readonly UnrecordedExportField[],
): string {
  // De "Duration (days)"-kolom kent geen elapsed-notatie (anders dan de relatie-lag, die "ed"/"e%"
  // al schrijft) — een taak met ELAPSEDTIME-duur (24/7-klokrekenen, bv. uit een `.mpp`-import)
  // schrijft daarom als gewone werktijdduur. Weggelaten-met-warn, zelfde patroon als de andere
  // exporters (`mspdiWriter.ts`/`p6xmlWriter.ts`).
  const elapsedTaskCount = tasks.filter(t => t.time.durationType === 'ELAPSEDTIME').length;
  if (elapsedTaskCount > 0) {
    console.warn(`CSV-export: ${elapsedTaskCount} taak/taken met ELAPSEDTIME-duur (24/7-klokrekenen) geëxporteerd als gewone werktijd-duur — CSV kent geen elapsed-duurnotatie (§6).`);
  }

  // Build predecessor map: successorId -> list of predecessor descriptions
  const predMap = new Map<string, string[]>();
  const taskByIdMap = new Map<string, Task>();
  for (const t of tasks) {
    taskByIdMap.set(t.id, t);
  }

  // De voorgangerkolom verwijst op WBS-code; met dubbele codes kan de lezer een
  // relatie niet meer eenduidig terugvinden. Weggelaten-met-warn (zelfde patroon als de andere
  // exporters) — de kolom zelf blijft leesbaar voor spreadsheetgebruikers.
  const codeCount = new Map<string, number>();
  for (const t of tasks) codeCount.set(t.wbsCode, (codeCount.get(t.wbsCode) ?? 0) + 1);
  const duplicateCodes = [...codeCount].filter(([, n]) => n > 1).length;
  if (duplicateCodes > 0) {
    console.warn(`CSV-export: ${duplicateCodes} WBS-code(s) komen meer dan één keer voor — de Predecessors-kolom verwijst op WBS-code en is voor die taken bij terugimport niet eenduidig.`);
  }

  for (const seq of sequences) {
    const predTask = taskByIdMap.get(seq.predecessorId);
    if (!predTask) continue;
    const abbrev = sequenceTypeToAbbrev(seq.type);
    // De korte lag-notatie van de app (MS Project-stijl, symmetrisch met `parseLagInput`, waarmee
    // `readCSV` hem terugleest): d = werkdagen, ed = kalenderdagen, u/eu = (elapsed) uren,
    // % / e% = procent van de voorgangerduur. Via `lagMinutes`, anders verdwijnt elke uur-lag (en in
    // een uurproject óók elke dag-lag, die daar in minuten staat) stil uit de export.
    const lag = formatLagShort(seq);
    const predStr = `${predTask.wbsCode}${abbrev}${lag}`;
    if (!predMap.has(seq.successorId)) {
      predMap.set(seq.successorId, []);
    }
    predMap.get(seq.successorId)!.push(predStr);
  }

  const headers = [
    // Stabiele taak-id, EERSTE kolom, in ELKE CSV-export — geen apart sjabloonformaat. Laat een
    // rondgestuurd blad terugkoppelen naar de juiste taak (voortgangsimport). `readCSV` (csvReader.ts)
    // kent deze kop bewust NIET — een no-op door constructie (mapColumnIndex negeert onbekende
    // koppen), niet iets om later "voor de volledigheid" alsnog te laten adopteren.
    'OPS Task ID',
    // 'Outline Level' (1 = hoofdniveau) uit de echte ouderketen, in MS-Project-termen.
    // Een WBS-code is vrije tekst (IFC-`Identification`) en zegt niets over de nesting; met deze
    // kolom kan MS Project's CSV-import (veld "Outline Level") én `readCSV` de boom exact herbouwen.
    // Rijvolgorde is daarom diepte-eerst (`flattenOrder`), zoals het taakraster hem toont.
    'WBS', 'Outline Level', 'Name', 'Duration (days)', 'Start', 'Finish',
    'Predecessors', 'Task Type', 'OPS Custom Task Type ID', 'Status', 'Completion (%)',
    // Actuals: achter Completion. Kolomkoppen altijd aanwezig (CSV-conventie);
    // een taak zonder actuals levert lege cellen. Geen baselines/statusdatum in CSV (bewust).
    'Actual Start', 'Actual Finish',
    'Critical', 'Total Float', 'Description',
  ];

  const rows: string[] = [];
  rows.push(headers.map(h => escapeCSV(h)).join(DELIMITER));

  const depthById = taskDepths(tasks);
  for (const task of flattenOrder(tasks)) {
    const predecessors = predMap.get(task.id)?.join(', ') || '';
    const completion = formatCompletionPercent(task.time.completion);
    const unrecorded = unrecordedExportFieldsOf?.(task);

    const row = [
      escapeCSV(task.id),
      escapeCSV(task.wbsCode),
      String(depthById.get(task.id) ?? 1),
      escapeCSV(task.name),
      task.time.scheduleDuration.toString(),
      shownStart(task),
      shownFinish(task),
      escapeCSV(predecessors),
      task.customTaskTypeId ? (customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name ?? 'USERDEFINED') : task.taskType,
      task.customTaskTypeId ?? '',
      task.status,
      completion,
      task.time.actualStart || '',
      task.time.actualFinish || '',
      unrecorded?.includes('isCritical') ? '' : (task.time.isCritical ? 'Yes' : 'No'),
      unrecorded?.includes('totalFloat') ? '' : task.time.totalFloat.toString(),
      escapeCSV(task.description),
    ];
    rows.push(row.join(DELIMITER));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}

/** Sleutels van het slanke voortgangsblad, letterlijk — nooit vertaald:
 *  de LEZER (`parseProgressCsv`) matcht hierop, dus de sleutel zelf blijft in elke UI-taal Engels.
 *  Alleen de instructie ÁCHTER de sleutel varieert per taal. */
export type ProgressSheetColumnKey =
  | 'OPS Task ID' | 'WBS' | 'Name' | 'Start' | 'Finish'
  | 'Completion (%)' | 'Actual Start' | 'Actual Finish';

/**
 * Voortgangsblad-export: een SLANK CSV-blad met uitsluitend de kolommen die een invuller voor de
 * voortgangsimport nodig heeft — geen predecessors/duration/type/status/critical/float/description
 * zoals de volle `writeCSV`. Zelfde conventies (BOM, `;`, CRLF, `escapeCSV`,
 * `formatCompletionPercent`), letterlijk hergebruikt uit `writeCSV`, zodat de twee schrijvers nooit
 * uit elkaar lopen op precisie. Tweede SCHRIJVER op dezelfde helpers — geen tweede lezer:
 * `parseProgressCsv`/`finalizeProgressRows`/`buildProgressImportPlan` lezen dit blad net als elke
 * andere CSV-export. Rijvolgorde = documentvolgorde, inclusief verzameltaken — die kunnen geen
 * voortgang uit een blad krijgen, maar de invuller ziet zo wél de volledige structuur.
 *
 * `summaryNote`: staat hij aan, dan krijgen de drie INVULcellen (Completion, Actual Start, Actual
 * Finish) van een verzameltaak (`childIds.length > 0`) die al-vertaalde tekst i.p.v. een waarde, zodat
 * de invuller ziet dat een verzameltaak geen voortgang uit het blad krijgt. De tekst MOET met een
 * em-dash (U+2014) beginnen: daarop telt `finalizeProgressRows` de cel als AFWEZIG, zodat een
 * ongewijzigd teruggestuurd blad nul weigeringen oplevert. Zonder de parameter schrijft het blad de
 * echte waarden.
 *
 * `headerNotes`: per kolomsleutel een al-vertaalde invulinstructie in de kop (wat je mag invoeren en
 * waar je af moet blijven). Deze module blijft PUUR — geen i18n — dus de aanroeper
 * (`fileSlice.exportAs`) geeft de tekst mee. Een kolom zonder instructie krijgt zijn kale sleutel als
 * kop. Scheidingsteken ` — ` (spatie, em-dash, spatie); `parseProgressCsv`'s kolomherkenning snijdt
 * daar (of bij `(`/` - `) de instructie af en matcht het overblijvende PREFIX.
 */
export function writeProgressSheetCSV(
  tasks: Task[],
  headerNotes?: Partial<Record<ProgressSheetColumnKey, string>>,
  summaryNote?: string,
): string {
  const keys: ProgressSheetColumnKey[] = [
    'OPS Task ID', 'WBS', 'Name', 'Start', 'Finish',
    'Completion (%)', 'Actual Start', 'Actual Finish',
  ];
  const headers = keys.map(key => {
    const note = headerNotes?.[key];
    return note ? `${key} — ${note}` : key;
  });

  const rows: string[] = [];
  rows.push(headers.map(h => escapeCSV(h)).join(DELIMITER));

  for (const task of tasks) {
    const marked = summaryNote !== undefined && task.childIds.length > 0;
    const row = [
      escapeCSV(task.id),
      escapeCSV(task.wbsCode),
      escapeCSV(task.name),
      shownStart(task),
      shownFinish(task),
      marked ? escapeCSV(summaryNote) : formatCompletionPercent(task.time.completion),
      marked ? escapeCSV(summaryNote) : (task.time.actualStart || ''),
      marked ? escapeCSV(summaryNote) : (task.time.actualFinish || ''),
    ];
    rows.push(row.join(DELIMITER));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}
