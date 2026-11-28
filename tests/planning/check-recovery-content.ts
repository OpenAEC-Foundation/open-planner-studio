import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery } from '@/services/recovery/recoveryStore';
import { useAppStore } from '@/state/appStore';
import {
  DOCUMENT_FIELDS, capturePayload, recoveryInputFromParsed, type DocumentPayload, type RecoveryDocInput,
} from '@/state/documentContract';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';

declare const process: { exit(code: number): never };

installFakeRecoveryIndexedDb();

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(label);
};

function deepDiff(path: string, a: unknown, b: unknown, out: string[]): void {
  if (out.length > 200) return;
  if (a === b) return;
  if (a instanceof Map) a = Object.fromEntries(a);
  if (b instanceof Map) b = Object.fromEntries(b);
  if (a instanceof Set) a = [...a];
  if (b instanceof Set) b = [...b];
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return;
    out.push(`${path}: vóór ${J(a)}, na herstel ${J(b)}`);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${path}: vóór ${Array.isArray(a) ? 'lijst' : 'object'}, na herstel ${Array.isArray(b) ? 'lijst' : 'object'}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: lengte vóór ${a.length}, na herstel ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const key = (a[i] as { id?: unknown; taskId?: unknown } | null)?.id ?? (a[i] as { taskId?: unknown } | null)?.taskId;
      deepDiff(`${path}[${typeof key === 'string' ? key : i}]`, a[i], b[i], out);
    }
    return;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (ao[k] === undefined && bo[k] === undefined) continue;
    deepDiff(`${path}.${k}`, ao[k], bo[k], out);
  }
}

const DATUM = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::00)?)?$/;
function zelfdeDatum(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ma = DATUM.exec(a);
  const mb = DATUM.exec(b);
  if (!ma || !mb || ma[1] !== mb[1]) return false;
  return ma[2] === undefined || mb[2] === undefined || ma[2] === mb[2];
}
const TAAK_INVOERDATUMS = new Set(['scheduleStart', 'scheduleFinish', 'actualStart', 'actualFinish']);
const STANDAARD_SCHEMA = 'IFC4X3_ADD2';

function metToleranties(voorP: DocumentPayload, naP: DocumentPayload): { voor: DocumentPayload; tolerant: string[] } {
  const v = kopie(voorP);
  const tolerant: string[] = [];
  if (v.project.ifcSchema === undefined && naP.project.ifcSchema === STANDAARD_SCHEMA) {
    v.project.ifcSchema = STANDAARD_SCHEMA;
    tolerant.push('T2 project.ifcSchema');
  }
  for (const t of v.tasks) {
    const n = naP.tasks.find((x) => x.id === t.id);
    if (!n) continue;
    const tv = t.time as unknown as Record<string, unknown>;
    const tn = n.time as unknown as Record<string, unknown>;
    for (const k of TAAK_INVOERDATUMS) {
      if (tv[k] !== tn[k] && zelfdeDatum(tv[k], tn[k])) { tv[k] = tn[k]; tolerant.push(`T1 ${t.name}.${k}`); }
    }
    if (t.childIds.length > 0) {
      for (const k of ['remainingTime', 'remainingMinutes']) {
        if (tv[k] === undefined && typeof tn[k] === 'number') { tv[k] = tn[k]; tolerant.push(`T3 ${t.name}.${k}`); }
      }
    }
  }
  const opId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
  v.calendars = opId(v.calendars);
  return { voor: v, tolerant };
}

function renameIds(v: unknown, map: ReadonlyMap<string, string>): unknown {
  if (typeof v === 'string') return map.get(v) ?? v;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [renameIds(k, map), renameIds(x, map)]));
  if (Array.isArray(v)) return v.map((x) => renameIds(x, map));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[map.get(k) ?? k] = renameIds(x, map);
    return out;
  }
  return v;
}

const kopie = <T>(v: T): T => structuredClone(v);

S().newProject();
S().setProject({ name: 'Herstelproef', startDate: '2026-06-01' });

const band = [{ start: 7 * 60, end: 12 * 60 }, { start: 12 * 60 + 30, end: 16 * 60 + 30 }];
S().setCalendar({
  ...S().calendar,
  name: 'Bouw ma-vr',
  workDays: [1, 2, 3, 4, 5], hoursPerDay: 9, workStartHour: 7, workEndHour: 16,
  workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
  holidays: [{ name: 'Brugdag', startDate: '2026-06-05', endDate: '2026-06-05' }],
  workingExceptions: [{ name: 'Inhaalzaterdag', startDate: '2026-06-13', endDate: '2026-06-13', bands: [{ start: 8 * 60, end: 12 * 60 }] }],
} as WorkCalendar);

const cal2 = S().addCalendar({
  name: 'Ploeg 4x10', description: 'ma-do', workDays: [1, 2, 3, 4], hoursPerDay: 10, workStartHour: 7, workEndHour: 17,
  holidays: [{ name: 'Bouwvak', startDate: '2026-07-20', endDate: '2026-08-07' }],
  workingExceptions: [{ name: 'Extra vrijdag', startDate: '2026-06-19', endDate: '2026-06-19' }],
});

const codeType = S().addActivityCodeType('Discipline');
const codeBouw = S().addActivityCodeValue(codeType, { code: 'BK', name: 'Bouwkundig' } as never);
const veld = S().addCustomField('Onderaannemer', 'text');

const fase = S().addTask({ name: 'Ruwbouw' });
const A = S().addTask({ name: 'A fundering', parentId: fase, time: { durationUnit: 'days', scheduleDuration: 3 } as TaskTime });
const B = S().addTask({ name: 'B stelwerk (uren)', parentId: fase, time: { durationUnit: 'hours', durationMinutes: 13 * 60 } as TaskTime });
const C = S().addTask({ name: 'C metselwerk', parentId: fase, time: { durationUnit: 'days', scheduleDuration: 5 } as TaskTime });
const D = S().addTask({ name: 'D vloeren', parentId: fase, time: { durationUnit: 'days', scheduleDuration: 4 } as TaskTime });
const M = S().addTask({ name: 'M ruwbouw gereed', isMilestone: true });
S().setTaskCalendar(C, cal2);
S().setTaskActivityCode(A, codeType, codeBouw);
S().setTaskCustomField(C, veld, 'Bouwbedrijf Jansen');

S().addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 2 });
S().addSequence({ predecessorId: A, successorId: C, type: 'START_START', lagDays: 1 });
S().addSequence({ predecessorId: B, successorId: D, type: 'FINISH_FINISH', lagDays: -1 });
S().addSequence({ predecessorId: C, successorId: M, type: 'START_FINISH', lagDays: 0, lagMinutes: 4 * 60 });
S().addSequence({ predecessorId: D, successorId: M, type: 'FINISH_START', lagDays: 0 });

const ploeg = S().addResource({ name: 'Timmerploeg', type: 'LABOR', description: 'vaste ploeg', maxUnits: 2, costPerHour: 55, calendarId: cal2 });
const beton = S().addResource({ name: 'Beton C30/37', type: 'MATERIAL', description: '', maxUnits: 1, unitOfMeasure: 'm3' });
S().assignResource(A, ploeg, 1);
S().assignResource(C, ploeg, 0.5);
S().assignResource(D, beton, 12);
S().runCPM();

const bContract = S().saveBaseline('Contractplanning');
S().updateTask(D, { time: { scheduleDuration: 6 } as TaskTime });
S().runCPM();
const bHerzien = S().saveBaseline('Herziene planning');
S().setActiveBaseline(bContract);

S().setStatusDate('2026-06-10');
S().setActualStart(A, '2026-06-01');
S().setActualFinish(A, '2026-06-04');
S().setTaskProgress(A, 1);
S().setActualStart(B, '2026-06-08T07:00:00');
S().setTaskProgress(B, 0.4);
S().setActualStart(C, '2026-06-02');
S().setTaskProgress(C, 0.25);
S().runCPM();

const voor = kopie(capturePayload(S()));
const taak = (id: string) => voor.tasks.find((t) => t.id === id)!;
eq('0a fixture: zes taken (fase + vier + mijlpaal)', voor.tasks.length, 6);
eq('0b fixture: alle vier relatietypen', [...new Set(voor.sequences.map((s) => s.type))].sort(),
  ['FINISH_FINISH', 'FINISH_START', 'START_FINISH', 'START_START']);
truthy('0c fixture: een relatie met negatieve lag en een met uren-lag',
  voor.sequences.some((s) => s.lagDays < 0) && voor.sequences.some((s) => (s.lagMinutes ?? 0) > 0));
eq('0d fixture: een urentaak en een mijlpaal', [taak(B).time.durationUnit, taak(M).isMilestone], ['hours', true]);
eq('0e fixture: twee kalenders in de bibliotheek', voor.calendars.length, 2);
truthy('0f fixture: beide kalenders hebben uitzonderingen',
  voor.calendars.every((c) => c.holidays.length > 0 && (c.workingExceptions?.length ?? 0) > 0));
eq('0g fixture: twee resources, drie toewijzingen', [voor.resources.length, voor.assignments.length], [2, 3]);
eq('0h fixture: twee baselines, de eerste actief', [voor.baselines.length, voor.activeBaselineId], [2, bContract]);
truthy('0i fixture: de tweede baseline bestaat ook', voor.baselines.some((b) => b.id === bHerzien));
eq('0j fixture: statusdatum gezet', voor.project.statusDate, '2026-06-10');
eq('0k fixture: voortgang A', [taak(A).time.completion, taak(A).time.actualStart, taak(A).time.actualFinish],
  [1, "2026-06-01T07:00", "2026-06-04T16:30"]);
truthy('0l fixture: B en C zijn onderweg', taak(B).time.completion === 0.4 && !!taak(B).time.actualStart && !taak(B).time.actualFinish
  && taak(C).time.completion === 0.25 && !!taak(C).time.actualStart && !taak(C).time.actualFinish);
eq('0m fixture: het document is gewijzigd en berekend', [voor.isDirty, voor.scheduleStale, voor.cpmResult !== null], [true, false, true]);

const activeVoor = S().activeDocumentId;
const docs: RecoverySourceDocument[] = S().getOpenDocumentPayloads().map(({ id, payload }) => ({
  id,
  source: payload,
  filePath: payload.filePath,
  siteFileId: payload.siteFileId,
  siteFileVersion: payload.siteFileId ? payload.siteFileVersion : null,
  isDirty: payload.isDirty,
  datesAsRecorded: payload.datesAsRecorded,
}));
const geschreven = await runRecoveryTick(new RecoveryDeltaTracker(), activeVoor, docs);
truthy('1a de herstelronde heeft een kopie geschreven', geschreven);

S().newProject();
eq('2a na de "crash" is het project leeg', S().tasks.length, 0);

const loaded = await loadRecovery();
eq('2b er is precies één herstelkopie', loaded.docs.length, 1);
const restored: RecoveryDocInput[] = [];
for (const d of loaded.docs) {
  const parsed = await readIFCWithXerReconstruction(d.ifc, {}, {
    resolveXerArchiveReference: (sha256) => loaded.archives.get(sha256),
  });
  restored.push(recoveryInputFromParsed(parsed, {
    id: d.id,
    filePath: d.filePath,
    siteFileId: d.siteFileId ?? null,
    siteFileVersion: d.siteFileVersion ?? null,
    isDirty: d.isDirty,
    datesAsRecorded: d.datesAsRecorded,
  }));
}
const result = S().restoreDocuments(restored, loaded.activeDocumentId);
eq('2c niets overgeslagen', result.skippedIds, []);
eq('2d het herstelde document is weer actief', S().activeDocumentId, activeVoor);
truthy('2e het herstelde tijdstip is bekend (getoond in de herstel-dialoog)', loaded.docs[0]?.mtime instanceof Date && !Number.isNaN(loaded.docs[0].mtime.getTime()));

const na = kopie(capturePayload(S()));

const idMap = new Map<string, string>();
const koppel = <T extends { id: string }>(soort: string, vóór: T[], nahv: T[], sleutel: (x: T) => string) => {
  for (const x of nahv) {
    const tegenhanger = vóór.filter((y) => sleutel(y) === sleutel(x));
    if (tegenhanger.length !== 1) {
      diffs.push(`3 ${soort} "${sleutel(x)}" is na herstel niet eenduidig terug te vinden (${tegenhanger.length} kandidaten)`);
      continue;
    }
    if (tegenhanger[0]!.id !== x.id) idMap.set(x.id, tegenhanger[0]!.id);
  }
};
koppel('resource', voor.resources, na.resources, (r) => r.name);
koppel('kalender', voor.calendars, na.calendars, (c) => c.name);
koppel('relatie', voor.sequences, na.sequences, (s) => `${s.predecessorId}→${s.successorId}:${s.type}`);
koppel('toewijzing', voor.assignments, na.assignments,
  (a) => `${a.taskId}:${renameIds(a.resourceId, idMap) as string}`);
const naVertaald = renameIds(na, idMap) as DocumentPayload;

const NIET_HERSTELD: Partial<Record<keyof DocumentPayload, string>> = {
  selectedTaskIds: 'documentContract.ts RecoveryDocInput: "view/history/cpm worden vers opgebouwd (zijn niet kritiek na een crash)"; selectie is geen IFC-data',
  activeTaskId: 'idem: weergavestand, geen IFC-data; payloadFromImport start vers',
  view: 'documentContract.ts RecoveryDocInput: view wordt vers opgebouwd',
  collapsedTaskIds: 'documentContract.ts payloadFromImport: "view/collapsedTaskIds vult de aanroeper"; geen IFC-data',
  autoSaveToFile: 'documentContract.ts: "Runtime-only: nooit door IFC of recoverymetadata"',
  taskTypesVisible: 'documentContract.ts: "Niet gepersisteerd (bij laden opnieuw afgeleid)"',
  ifcGlobalIds: 'documentContract.ts: "Alleen readIFC vult hem" — een in de app gemaakt document heeft er vóór het eerste inlezen geen',
  ifcLiteralCalendarIds: 'documentContract.ts: alleen readIFC vult hem, uit de LiteralTimes die de writer in de herstelkopie schreef (T17); een in de app gemaakt document heeft er vóór het eerste inlezen geen, net als na Opslaan en heropenen',
  resourceLoadResult: 'documentContract.ts: "Afleidbare cache"; het herstelde actieve document rekent hem opnieuw uit (apart vergeleken in 4b)',
};

naVertaald.calendars = [...naVertaald.calendars].sort((a, b) => a.id.localeCompare(b.id));
const { voor: voorTolerant, tolerant } = metToleranties(voor, naVertaald);
for (const f of DOCUMENT_FIELDS) {
  const key = f.key as keyof DocumentPayload;
  if (NIET_HERSTELD[key]) continue;
  const out: string[] = [];
  deepDiff(key, voorTolerant[key], naVertaald[key], out);
  checks++;
  if (out.length > 0) diffs.push(`4 veld "${key}" komt na herstel anders terug:\n       ${out.slice(0, 25).join('\n       ')}${out.length > 25 ? `\n       … en ${out.length - 25} meer` : ''}`);
}

{
  const out: string[] = [];
  deepDiff('resourceLoadResult', voorTolerant.resourceLoadResult, naVertaald.resourceLoadResult, out);
  checks++;
  if (out.length > 0) diffs.push(`4b de herberekende resourcebelasting wijkt af:\n       ${out.slice(0, 10).join('\n       ')}`);
}

for (const [key, reden] of Object.entries(NIET_HERSTELD)) {
  truthy(`4c uitzondering "${key}" bestaat in DOCUMENT_FIELDS en heeft een reden`,
    DOCUMENT_FIELDS.some((f) => f.key === key) && typeof reden === 'string' && reden.length > 20);
}

{
  const naam = (id: string | undefined, lijst: { id: string; name: string }[]) => lijst.find((x) => x.id === id)?.name;
  eq('4d toewijzingen wijzen naar dezelfde resource (op naam)',
    na.assignments.map((a) => `${a.taskId}:${naam(a.resourceId, na.resources)}`).sort(),
    voor.assignments.map((a) => `${a.taskId}:${naam(a.resourceId, voor.resources)}`).sort());
  eq('4e taak C rekent na herstel op de tweede kalender (op naam)',
    naam(na.tasks.find((t) => t.id === C)?.calendarId, na.calendars), 'Ploeg 4x10');
  eq('4f de resource rekent na herstel op de tweede kalender (op naam)',
    naam(na.resources.find((r) => r.name === 'Timmerploeg')?.calendarId, na.calendars), 'Ploeg 4x10');
}

if (diffs.length === 0) {
  console.log(`OK  recovery-content: alle checks groen (${checks}); id's na herstel opnieuw uitgegeven: ${idMap.size}; toleranties toegepast: ${tolerant.length} (${[...new Set(tolerant.map((x) => x.split(' ')[0]))].join(', ')})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-content: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
