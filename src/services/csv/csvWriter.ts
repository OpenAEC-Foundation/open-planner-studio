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
 * Completion (%) — fixronde na de Opus-hercheck (N-B, BEVESTIGD): de export rondde eerder af op
 * HELE procenten (`Math.round(completion*100)`), waardoor een taak op 99,5% als "100" terugkwam
 * en een teruggestuurd blad met "100" op die taak stil als `noop` werd gelezen (wie 100 typt meldt
 * de taak af — dat moet ALTIJD een wijziging zijn, nooit verward met de export se eigen afronding).
 * De export schrijft daarom het percentage met maximaal 4 decimalen, trailing nullen weg,
 * decimaalPUNT (bestandsformaat, niet locale): 0.5 ⇒ "50", 0.995 ⇒ "99.5", 0.33333 ⇒ "33.333".
 * Hele procenten blijven BYTE-IDENTIEK aan vandaag ("50" blijft "50"), dus bestaande koptests op
 * een geheel percentage breken niet. `Math.round(c*1e6)/1e4` haalt float-ruis (bv. 0.1+0.2-achtige
 * representatiefouten) eruit vóórdat `toFixed` de string vormt.
 */
export function formatCompletionPercent(completion: number): string {
  const percent = Math.round(completion * 1e6) / 1e4;
  return percent.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
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
 */
export function writeProgressSheetCSV(tasks: Task[]): string {
  const headers = [
    'OPS Task ID', 'WBS', 'Name', 'Start', 'Finish',
    'Completion (%)', 'Actual Start', 'Actual Finish',
  ];

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
