import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import type { CustomTaskType } from '@/types/taskType';

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

// MS Project-notatie, symmetrisch met parsePredecessorString in csvReader:
// d = werkdagen, ed = kalenderdagen (elapsed), % = procent van voorgangerduur, e% = elapsed-procent.
/**
 * Completion (%) — besluit 2026-09-05 (gebruikstest): terug naar HELE procenten, geen decimalen.
 * De tussentijdse fixronde (N-B) liet dit tot 4 decimalen schrijven om "100 op 99,5% is stil een
 * no-op" te voorkomen — maar een bestand met decimale procenten gaat door spreadsheetprogramma's
 * van willekeurige landinstelling: "8,38" (NL, komma als decimaalteken) wordt door een spreadsheet
 * met de andere conventie (punt/komma als DUIZENDTALscheider) als 838 gelezen. Dat risico weegt
 * zwaarder dan de no-op-precisie, dus de export schrijft weer uitsluitend `Math.round(completion *
 * 100)`. `isCompletionUnchanged` (buildPlan.ts) vangt het gevolg op: "100" op een taak van ≥ 99,5%
 * is nu bewust een no-op (symmetrisch voor "0" op ≤ 0,5%) — het bestand kan die twee simpelweg niet
 * uit elkaar houden. Decimale INVOER (met de hand getypt, bv. "33,4") blijft wel op zijn eigen
 * precisie vergeleken en dus altijd een echte wijziging wanneer ze afwijkt.
 */
export function formatCompletionPercent(completion: number): string {
  return String(Math.round(completion * 100));
}

function formatLag(seq: Sequence): string {
  const e = seq.lagUnit === 'ELAPSEDTIME' ? 'e' : '';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `${seq.lagPercent >= 0 ? '+' : ''}${seq.lagPercent}${e}%`;
  }
  if (seq.lagDays === 0) return '';
  return `${seq.lagDays > 0 ? '+' : ''}${seq.lagDays}${e}d`;
}

export function writeCSV(
  _project: Project,
  _calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  _resources: Resource[],
  _assignments: ResourceAssignment[],
  customTaskTypes: readonly CustomTaskType[] = [],
): string {
  // H5 (eindreview T16c): de "Duration (days)"-kolom kent geen elapsed-notatie (anders dan de
  // relatie-lag hierboven, die "ed"/"e%" al schrijft) — een taak met ELAPSEDTIME-duur (T8, 24/7-
  // klokrekenen, bv. uit een `.mpp`-import) schrijft daarom stil als gewone werktijd-duur.
  // Weggelaten-met-warn, zelfde patroon als de andere exporters (`mspdiWriter.ts`/`p6xmlWriter.ts`).
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

  for (const seq of sequences) {
    const predTask = taskByIdMap.get(seq.predecessorId);
    if (!predTask) continue;
    const abbrev = sequenceTypeToAbbrev(seq.type);
    const lag = formatLag(seq);
    const predStr = `${predTask.wbsCode}${abbrev}${lag}`;
    if (!predMap.has(seq.successorId)) {
      predMap.set(seq.successorId, []);
    }
    predMap.get(seq.successorId)!.push(predStr);
  }

  const headers = [
    // Issue #27 etappe 2 (E1/A1): stabiele taak-id, EERSTE kolom, in ELKE CSV-export — geen apart
    // sjabloonformaat. Laat een rondgestuurd blad terugkoppelen naar de juiste taak (voortgangs-
    // import). `readCSV` (csvReader.ts) kent deze kop bewust NIET — dat is een no-op door
    // constructie (mapColumnIndex negeert onbekende koppen), niet iets om later "voor de
    // volledigheid" alsnog te laten adopteren.
    'OPS Task ID',
    'WBS', 'Name', 'Duration (days)', 'Start', 'Finish',
    'Predecessors', 'Task Type', 'OPS Custom Task Type ID', 'Status', 'Completion (%)',
    // Actuals (fase 2.6, §9.3): achter Completion. Kolomkoppen altijd aanwezig (CSV-conventie);
    // een taak zonder actuals levert lege cellen. Geen baselines/statusdatum in CSV (bewust).
    'Actual Start', 'Actual Finish',
    'Critical', 'Total Float', 'Description',
  ];

  const rows: string[] = [];
  rows.push(headers.map(h => escapeCSV(h)).join(DELIMITER));

  for (const task of tasks) {
    const predecessors = predMap.get(task.id)?.join(', ') || '';
    const completion = formatCompletionPercent(task.time.completion);

    const row = [
      escapeCSV(task.id),
      escapeCSV(task.wbsCode),
      escapeCSV(task.name),
      task.time.scheduleDuration.toString(),
      task.time.earlyStart || task.time.scheduleStart,
      task.time.earlyFinish || task.time.scheduleFinish,
      escapeCSV(predecessors),
      task.customTaskTypeId ? (customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name ?? 'USERDEFINED') : task.taskType,
      task.customTaskTypeId ?? '',
      task.status,
      completion,
      task.time.actualStart || '',
      task.time.actualFinish || '',
      task.time.isCritical ? 'Yes' : 'No',
      task.time.totalFloat.toString(),
      escapeCSV(task.description),
    ];
    rows.push(row.join(DELIMITER));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}

/** Sleutels van het slanke voortgangsblad, letterlijk — nooit vertaald (D, besluit 2026-09-05):
 *  de LEZER (`parseProgressCsv`) matcht hierop, dus de sleutel zelf blijft in elke UI-taal Engels.
 *  Alleen de instructie ÁCHTER de sleutel varieert per taal. */
export type ProgressSheetColumnKey =
  | 'OPS Task ID' | 'WBS' | 'Name' | 'Start' | 'Finish'
  | 'Completion (%)' | 'Actual Start' | 'Actual Finish';

/**
 * Voortgangsblad-export (issue #27 etappe 2, eigenaarsbesluit E7, 2026-09-05): een SLANK CSV-blad
 * met uitsluitend de kolommen die een invuller voor de voortgangsimport nodig heeft — geen
 * predecessors/duration/type/status/critical/float/description zoals de volle `writeCSV`. Zelfde
 * conventies (BOM, `;`, CRLF, `escapeCSV`, `formatCompletionPercent`), letterlijk hergebruikt uit
 * `writeCSV` i.p.v. gekopieerd, zodat de twee schrijvers nooit uit elkaar kunnen lopen op precisie
 * (zie de N-B/N-C-fixrondes hierboven). Tweede SCHRIJVER op dezelfde helpers — geen tweede lezer:
 * `parseProgressCsv`/`finalizeProgressRows`/`buildProgressImportPlan` blijven ongewijzigd en lezen
 * dit blad net als elke andere CSV-export. Rijvolgorde = documentvolgorde, inclusief
 * verzameltaken — die worden bij terugimport netjes geweigerd (zie `matchRows`/`buildPlan`), maar
 * de invuller ziet zo wél de volledige structuur van het project.
 *
 * `headerNotes` (D, besluit 2026-09-05 — letterlijke gebruikerswens: "er moet ook in de headers
 * van de kolommen komen te staan wat je in mag voeren en waar je af moet blijven", aanleiding: een
 * OnlyOffice-gebruiker met Nederlandse instellingen die "8,38" als 838 terugkreeg). Deze module
 * blijft PUUR — geen i18n-afhankelijkheid hier — dus de aanroeper (`fileSlice.exportAs`) geeft de
 * al-vertaalde instructietekst per kolomsleutel mee. Een kolom zonder instructie krijgt gewoon zijn
 * kale sleutel als kop (bestaand gedrag, o.a. voor bestaande tests die geen notes doorgeven).
 * Scheidingsteken ` — ` (spatie, em-dash, spatie); `parseProgressCsv`'s kolomherkenning snijdt
 * daar (of bij `(`/` - `) de instructie af en matcht het overblijvende PREFIX als vanouds.
 */
export function writeProgressSheetCSV(
  tasks: Task[],
  headerNotes?: Partial<Record<ProgressSheetColumnKey, string>>,
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
    const row = [
      escapeCSV(task.id),
      escapeCSV(task.wbsCode),
      escapeCSV(task.name),
      task.time.earlyStart || task.time.scheduleStart,
      task.time.earlyFinish || task.time.scheduleFinish,
      formatCompletionPercent(task.time.completion),
      task.time.actualStart || '',
      task.time.actualFinish || '',
    ];
    rows.push(row.join(DELIMITER));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}
