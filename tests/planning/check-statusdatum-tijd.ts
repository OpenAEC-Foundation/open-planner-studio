import './domStub';
// Statusdatum met tijd (besluit eigenaar 2026-10-17): de tijd is zichtbaar en wijzigbaar in het lint,
// en het Gantt-label volgt de datum- en tijdnotatie. Deze check toetst de headless kant.
//
//  §1 de regels van het lint: wanneer het tijdveld zichtbaar is, en hoe een tijd wordt gezet/weggehaald.
//  §2 het Gantt-label: datum in de Datumnotatie, tijd in de Tijdnotatie, nooit ruwe ISO.
//  §3 de echte route: de MSPDI-fixture openen (17:00), de tijd naar 12:00 zetten (`setStatusDate`):
//     één undo-stap, planning verouderd; na doorrekenen schuift het vroegste einde 22-09 ⇒ 21-09.
//  §4 round-trip: IFC opslaan en heropenen houdt 12:00 en dezelfde datums; MSPDI- en P6-export
//     schrijven 12:00:00 (niet afgerond naar 08:00/17:00) en lezen het terug als 12:00.
//  §5 formaatgrens: 08:00 is in MSPDI/P6 het dag-anker en komt date-only terug; in IFC blijft 08:00.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { statusDateMinutes, statusDateShowsTime, withStatusTime } from '@/utils/statusDateTime';
import type { DocumentPayload } from '@/state/documentContract';
import type { OpenedImport } from '@/services/importTypes';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

declare const process: { exit(code: number): never };

const HERE = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = readFileSync(join(HERE, '..', 'browser', 'fixtures', 'statusdatum-1700.xml'), 'utf8');

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

// ── §1 ──────────────────────────────────────────────────────────────────────
same('§1 geen tijd, geen urenplanning ⇒ alleen datum', statusDateShowsTime('2006-09-20', false), false);
same('§1 geen statusdatum, geen urenplanning ⇒ alleen datum', statusDateShowsTime(undefined, false), false);
same('§1 tijd in de statusdatum ⇒ tijdveld', statusDateShowsTime('2006-09-20T17:00', false), true);
same('§1 urenplanning aan ⇒ tijdveld', statusDateShowsTime('2006-09-20', true), true);
same('§1 minuten van 17:00', statusDateMinutes('2006-09-20T17:00'), 1020);
same('§1 minuten zonder tijd', statusDateMinutes('2006-09-20'), undefined);
same('§1 tijd zetten', withStatusTime('2006-09-20T17:00', 720), '2006-09-20T12:00');
same('§1 tijd op een datum zonder tijd', withStatusTime('2006-09-20', 450), '2006-09-20T07:30');
same('§1 tijd weghalen', withStatusTime('2006-09-20T17:00', undefined), '2006-09-20');
same('§1 tijd zonder datum bestaat niet', withStatusTime(undefined, 720), undefined);

// ── §2 ──────────────────────────────────────────────────────────────────────
const label = GanttRenderer.statusDateBadgeLabel;
same('§2 dmy + tijd', label('2006-09-20T17:00', 'dmy', '24h'), '20-09-2006 17:00');
same('§2 dmy zonder tijd', label('2006-09-20', 'dmy', '24h'), '20-09-2006');
same('§2 mdy + 12 uur', label('2006-09-20T17:00', 'mdy', '12h'), '09-20-2006 5:00 PM');
same('§2 ymd', label('2006-09-20T12:00', 'ymd', '24h'), '2006-09-20 12:00');
same('§2 standaard (geen notatie meegegeven) = dmy 24 uur', label('2006-09-20T12:00'), '20-09-2006 12:00');

// ── §3 ──────────────────────────────────────────────────────────────────────
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: true } as const;
function openStore(parsed: OpenedImport) {
  const ctx = createAppStoreContext();
  ctx.store.getState().applyOpenedImport(parsed, OPEN);
  return ctx.store;
}
const finishOf = (p: Pick<DocumentPayload, 'tasks'>) => p.tasks.find(t => t.name === 'Metselwerk lopend')?.time.earlyFinish;
const undoDepth = (s: ReturnType<typeof openStore>) => s.getState().historyEvents.filter(e => e.state === 'applied').length;

const store = openStore(await parseOpenedFile({ name: 'statusdatum-1700.xml', text: FIXTURE }));
same('§3 MSPDI-lezer houdt 17:00', store.getState().project.statusDate, '2006-09-20T17:00');
store.getState().runCPM();
same('§3 met 17:00 eindigt het restwerk op 22-09', finishOf(store.getState())?.slice(0, 10), '2006-09-22');
const depth = undoDepth(store);
store.getState().setStatusDate('2006-09-20T12:00');
same('§3 tijd gezet', store.getState().project.statusDate, '2006-09-20T12:00');
same('§3 één undo-stap', undoDepth(store), depth + 1);
same('§3 planning verouderd', store.getState().scheduleStale, true);
store.getState().runCPM();
same('§3 met 12:00 eindigt het restwerk op 21-09', finishOf(store.getState())?.slice(0, 10), '2006-09-21');
const payload = store.getState().getOpenDocumentPayloads()[0].payload;

// ── §4 ──────────────────────────────────────────────────────────────────────
const ifcText = writeIFC(buildWriteIFCInput(payload));
same('§4 IFC schrijft IFCDATETIME met 12:00', /IFCPROPERTYSINGLEVALUE\('StatusDate',\$,(.*?),\$\)/.exec(ifcText)?.[1], "IFCDATETIME('2006-09-20T12:00:00')");
const fromIfc = openStore(await parseOpenedFile({ name: 'rondgang.ifc', text: ifcText }));
same('§4 IFC heen en terug: 12:00', fromIfc.getState().project.statusDate, '2006-09-20T12:00');
fromIfc.getState().runCPM();
same('§4 IFC heen en terug: zelfde vroegste einde', finishOf(fromIfc.getState()), finishOf(payload));

const msp = quiet(() => writeMSPDI(payload.project, payload.calendar, payload.tasks, payload.sequences, payload.resources,
  payload.assignments, payload.calendars, payload.baselines, payload.activeBaselineId, payload.customTaskTypes));
same('§4 MSPDI <StatusDate> = 12:00:00', /<StatusDate>([^<]*)<\/StatusDate>/.exec(msp)?.[1], '2006-09-20T12:00:00');
const fromMsp = openStore(await parseOpenedFile({ name: 'rondgang.xml', text: msp }));
same('§4 MSPDI heen en terug: 12:00', fromMsp.getState().project.statusDate, '2006-09-20T12:00');

const p6 = quiet(() => writeP6XMLWithReport(payload.project, payload.calendar, payload.tasks, payload.sequences,
  payload.resources, payload.assignments, payload.calendars, payload.customTaskTypes).xml);
same('§4 P6 <DataDate> = 12:00:00', /<DataDate>([^<]*)<\/DataDate>/.exec(p6)?.[1], '2006-09-20T12:00:00');
const fromP6 = openStore(await parseOpenedFile({ name: 'rondgang-p6.xml', text: p6 }));
same('§4 P6 heen en terug: 12:00', fromP6.getState().project.statusDate, '2006-09-20T12:00');

// ── §5 ──────────────────────────────────────────────────────────────────────
store.getState().setStatusDate('2006-09-20T08:00');
const anchor = store.getState().getOpenDocumentPayloads()[0].payload;
const msp8 = quiet(() => writeMSPDI(anchor.project, anchor.calendar, anchor.tasks, anchor.sequences, anchor.resources,
  anchor.assignments, anchor.calendars, anchor.baselines, anchor.activeBaselineId, anchor.customTaskTypes));
const fromMsp8 = openStore(await parseOpenedFile({ name: 'anker.xml', text: msp8 }));
same('§5 MSPDI 08:00 = dag-anker ⇒ date-only terug (formaatgrens)', fromMsp8.getState().project.statusDate, '2006-09-20');
const fromIfc8 = openStore(await parseOpenedFile({ name: 'anker.ifc', text: writeIFC(buildWriteIFCInput(anchor)) }));
same('§5 IFC 08:00 blijft 08:00', fromIfc8.getState().project.statusDate, '2006-09-20T08:00');

if (failures.length) {
  console.log(`XX  statusdatum-tijd: ${failures.length} van ${checks} checks faalden`);
  for (const f of failures) console.log(`    - ${f}`);
  process.exit(1);
}
console.log(`OK  statusdatum-tijd: ${checks} checks`);
