import './domStub';
// Uren per dag van blokkenkalenders door IFC opslaan en heropenen, op echte XER's (OPS_XER_CORPUS).
// De corpusloze toets van hetzelfde gedrag staat in `check-ifc-urenperdag-blokken.ts`.
//
// Gemeten vóór de fix (main 7ea3e8748), over alle 93 XER's van het corpus (88 te openen documenten): 11
// kalenders in deze 4 bestanden hadden een `hoursPerDay` (P6 `day_hr_cnt`) die afwijkt van de klokuren van
// hun blokken, en kwamen na IFC terug met de klokuren. Daardoor veranderde bij 1301 taken de dagwaarde
// (`scheduleDuration`, de kolom Duur van de CSV-export) en in de P6- en MSPDI-export de uren per dag van de
// kalender. De getoonde duur en de datums veranderden niet: de weergave en de motor rekenen bij een
// uurkalender met de blokken.
//
// Per bestand, voor elk document: openen via de echte route (doorrekenen), opslaan als IFC, heropenen.
//  - het aantal uurkalenders met een afwijkende `hoursPerDay` (gepind, zodat de toets ze echt raakt);
//  - alle kalenders gelijk (naam, werkdagen, blokken, uren per dag);
//  - alle taken: dagwaarde, minuten, getoonde duur (automatisch, dagen, uren) en datums gelijk;
//  - de kalenderuren in de P6-export (`HoursPerDay/Week/Month`) en de MSPDI-export (`MinutesPerDay/Week`).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { deriveHoursPerDay } from '@/services/subdayIo';
import { effectiveCalendarOf, formatTaskDurationDisplay } from '@/utils/taskDuration';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { DocumentPayload } from '@/state/documentContract';
import type { OpenedImport } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want).slice(0, 600)}\n        kreeg    ${JSON.stringify(got).slice(0, 600)}`);
  }
}

interface Target {
  name: string;
  sha256: string;
  /** Kalender-id's (over alle documenten) van uurkalenders met hoursPerDay ≠ klokuren van de blokken. */
  deviating: string[];
}
const TARGETS: Target[] = [
  { name: 'Roads_Project_TEC.xer', sha256: 'a2ef7b35c00d8cf8ba75230d71d69b96130f7f689495e86a4cf5f8fcd34431ae',
    deviating: ['1473', '1474', '1522'] },
  { name: 'Hotel Project.xer', sha256: 'd2c413088afed805b30b7628c91be8aca870f7d4daf00eb12a547d69913d8352',
    deviating: ['597'] },
  { name: 'Hotel_Construction_TEC.xer', sha256: '9679599df9108bd3b31e755351c1543d1915b82a91445a3f1b0b9c9a3d1f86fe',
    deviating: ['597'] },
  // A3040 (lopende taak op 100 % zonder werkelijk einde) telt sinds `IfcTask.Status` = 'STARTED' gewoon
  // mee: hij blijft lopend en zijn datums blijven gelijk (check-ifc-lopend-100.ts).
  { name: 'p6_torture_test_v1.xer', sha256: '2a7732b5b99de2a5f40aab40e0af52757fbe68e5d4eda404a9a060fdc1be1140',
    deviating: ['CAL-02', 'CAL-03', 'CAL-04', 'CAL-05', 'RCAL-CRANE600', 'RCAL-SPECIALIST'] },
];

function findByName(dir: string, name: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findByName(full, name));
    else if (entry.isFile() && entry.name === name) out.push(full);
  }
  return out;
}

const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openInStore(parsed: OpenedImport): DocumentPayload[] {
  const store = createAppStoreContext().store;
  store.getState().applyOpenedImport(parsed, OPEN);
  return store.getState().getOpenDocumentPayloads().map((d) => d.payload);
}

const calendarsOf = (p: DocumentPayload): WorkCalendar[] => [p.calendar, ...p.calendars];
/** Alle kalenders als gesorteerde lijst, zonder ontdubbelen: de id's veranderen na IFC en de volgorde van
 *  de bibliotheek ook, maar elke kalender telt mee (een verloren tweeling maakt de lijst korter). */
const calendarList = (p: DocumentPayload): string[] => calendarsOf(p).map((c) => JSON.stringify({
  name: c.name, workDays: c.workDays, hoursPerDay: c.hoursPerDay, workTime: c.workTime?.byWeekday ?? null,
})).sort();
function taskView(p: DocumentPayload) {
  return Object.fromEntries(p.tasks.map((t) => {
    const cal = effectiveCalendarOf(t, p.calendar, p.calendars);
    const x = t.time;
    return [t.id, {
      dur: x.scheduleDuration, min: x.durationMinutes ?? null,
      auto: formatTaskDurationDisplay(t, cal, 'auto'),
      days: formatTaskDurationDisplay(t, cal, 'days'),
      hours: formatTaskDurationDisplay(t, cal, 'hours'),
      dates: [x.scheduleStart, x.scheduleFinish, x.earlyStart, x.earlyFinish, x.lateStart, x.lateFinish],
    }];
  }));
}
/** Per P6-kalender naam + uren (gesorteerd: de volgorde van de bibliotheek na heropenen telt niet), plus
 *  de minuten per dag en per week van de MSPDI-export. */
function exportHours(p: DocumentPayload): { p6: string[]; mspdi: string[] } {
  const p6 = writeP6XMLWithReport(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments,
    p.calendars, p.customTaskTypes).xml;
  const mspdi = writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars,
    p.baselines, p.activeBaselineId, p.customTaskTypes);
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? '';
  return {
    p6: [...p6.matchAll(/<Calendar>([\s\S]*?)<\/Calendar>/g)]
      .map((m) => ['Name', 'HoursPerDay', 'HoursPerWeek', 'HoursPerMonth'].map((n) => tag(m[1], n)).join(' | '))
      .sort(),
    mspdi: mspdi.split('\n').map((l) => l.trim()).filter((l) => /^<MinutesPer(Day|Week)>/.test(l)),
  };
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  ifc-urenperdag-corpus: corpus niet aanwezig (OPS_XER_CORPUS); de corpusloze toets is check-ifc-urenperdag-blokken');
  process.exit(0);
}
if (!existsSync(root)) {
  console.log('XX  ifc-urenperdag-corpus: OPS_XER_CORPUS bestaat niet');
  process.exit(1);
}

// De console van de exportschrijvers (meldingen over niet-exporteerbare opties) hoort niet in de log.
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

for (const target of TARGETS) {
  const path = findByName(root, target.name)
    .find((p) => createHash('sha256').update(readFileSync(p)).digest('hex') === target.sha256);
  if (!path) {
    same(`${target.name}: bestand met de gepinde sha256 in het corpus`, null, target.sha256);
    continue;
  }
  const before = openInStore(await parseOpenedFile({ name: target.name, bytes: new Uint8Array(readFileSync(path)) }));
  const deviating = new Set<string>();
  for (const doc of before) {
    for (const c of calendarsOf(doc)) {
      if (c.workTime && c.hoursPerDay !== deriveHoursPerDay(c.workTime, NaN)) deviating.add(c.id);
    }
  }
  same(`${target.name}: uurkalenders met afwijkende uren per dag`, [...deviating].sort(), [...target.deviating].sort());
  for (const [i, doc] of before.entries()) {
    const label = `${target.name} document ${i + 1}`;
    const [after] = openInStore(await parseOpenedFile({ name: 'rondgang.ifc', text: writeIFC(buildWriteIFCInput(doc)) }));
    same(`${label}: kalenders gelijk na opslaan en heropenen`, calendarList(after), calendarList(doc));
    const tb = taskView(doc);
    const ta = taskView(after);
    const changed = Object.keys(tb).filter((id) => JSON.stringify(tb[id]) !== JSON.stringify(ta[id]));
    same(`${label}: taken met andere dagwaarde, duur of datums (van ${Object.keys(tb).length})`,
      changed.slice(0, 5).map((id) => ({ id, voor: tb[id], na: ta[id] })), []);
    same(`${label}: kalenderuren in de P6- en MSPDI-export`, quiet(() => exportHours(after)), quiet(() => exportHours(doc)));
  }
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ifc-urenperdag-corpus: ${f}`);
  console.log(`XX  ifc-urenperdag-corpus: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  ifc-urenperdag-corpus: alle ${checks} checks groen`);
