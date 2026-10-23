import './domStub';
// Projectstart en -einde met tijd door IFC opslaan en heropenen, op echte XER's (OPS_XER_CORPUS).
// De corpusloze toets van hetzelfde gedrag staat in `check-ifc-projectdatum-tijd.ts`.
//
// Gemeten vóór de fix (main 7ea3e8748), over alle 93 XER's van het corpus (88 te openen documenten in 50
// bestanden): in 81 documenten (44 bestanden) verloor de projectstart en/of het projecteinde de tijd. In
// 42 documenten (33 bestanden) schreef de P6- of MSPDI-export daardoor een andere projectregel, want een
// datum zonder tijd wordt daar 08:00 (Roads: `StartDate`/`EffectiveDate` 07:00 werd 08:00, torture:
// `PlannedStartDate` 00:00 werd 08:00, een einde 17:00 werd 08:00). Taakdatums veranderden in geen enkel
// document door de projectdatums: de motor leest van de projectstart alleen de datum, en van het einde
// alleen met `useProjectEndDateForFloat`. De drie documenten met die optie én een einde (Hotel ×2,
// TERMINAL BUILDING) hebben dat einde op 00:00, en dat is ook zonder tijd middernacht.
//
// Per bestand, voor elk document: openen via de echte route (doorrekenen), opslaan als IFC, heropenen.
//  - projectstart, -einde en statusdatum gelijk, en gepind (zodat de toets echt een tijd raakt);
//  - de projectregels in de P6-export (`PlannedStartDate`, `MustFinishByDate`, `ResourceRate.EffectiveDate`)
//    en de MSPDI-export (`StartDate`, `FinishDate`) gelijk;
//  - alle taakdatums, speling en kritiek gelijk;
//  - per taak constraint, tweede constraint en deadline gelijk (de datums met tijd zijn gepind);
//  - de schemapoort (`ifcSchemaCheck.ts`) in IFC4X3_ADD2, IFC4X3 en IFC4: 0 fouten. Main 8db05a95c
//    schreef een constraintdatum met tijd als IFCDATE: 4 fouten in Roads, 11 in torture. Zie
//    `check-ifc-datumvorm.ts`.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { DocumentPayload } from '@/state/documentContract';
import type { OpenedImport } from '@/services/importTypes';
import { projectIfcSchema } from '@/types/project';
import { checkIfcSchema } from './ifcSchemaCheck';

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
  /** Per document: [projectstart, projecteinde] zoals de XER-import ze zet. */
  projectDates: [string, string][];
  /** Aantal constraint-, tweede-constraint- en deadlinedatums mét tijd, over alle documenten. */
  timedConstraintDates: number;
}
const TARGETS: Target[] = [
  { name: 'Roads_Project_TEC.xer', sha256: 'a2ef7b35c00d8cf8ba75230d71d69b96130f7f689495e86a4cf5f8fcd34431ae',
    projectDates: [['2012-12-17T07:00', '']], timedConstraintDates: 4 },
  { name: 'stack_data_center_baseline.xer', sha256: '1ba69d297ee9a5c65c644e7373dc414aa334c996b74800c4688aea7e3681eebf',
    projectDates: [['2026-05-04T07:00', '2026-05-22T17:00']], timedConstraintDates: 0 },
  // Twee documenten; het tweede heeft `useProjectEndDateForFloat` met een einde op 00:00.
  { name: 'Hotel_Construction_TEC.xer', sha256: '9679599df9108bd3b31e755351c1543d1915b82a91445a3f1b0b9c9a3d1f86fe',
    projectDates: [['2013-08-01T00:00', '2013-08-01T16:00'], ['2012-06-04T08:00', '2014-07-24T00:00']], timedConstraintDates: 0 },
  // A3040 (lopende taak op 100 % zonder werkelijk einde) telt sinds `IfcTask.Status` = 'STARTED' gewoon
  // mee: hij blijft lopend en zijn datums blijven gelijk (eigenaarsbesluit 2026-10-14, check-ifc-lopend-100.ts).
  // De bron draagt `plan_start_date` 2026-03-02 zonder tijd. Sinds F2 blijft een datum zonder tijd een
  // datum (alleen uren §3.6: "Projectdatums blijven zoals ingevoerd"; `xerInstant.ts`); OPS maakte
  // er eerst 00:00 van (knownbug 280, B1).
  { name: 'p6_torture_test_v1.xer', sha256: '2a7732b5b99de2a5f40aab40e0af52757fbe68e5d4eda404a9a060fdc1be1140',
    projectDates: [['2026-03-02', '2026-03-02']], timedConstraintDates: 11 },
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

const taskDates = (p: DocumentPayload) => Object.fromEntries(p.tasks
  .map((t) => {
    const x = t.time;
    return [t.id, [x.scheduleStart, x.scheduleFinish, x.earlyStart, x.earlyFinish, x.lateStart, x.lateFinish, x.totalFloat, x.isCritical]];
  }));

// De console van de exportschrijvers (meldingen over niet-exporteerbare opties) hoort niet in de log.
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};
/** De projectregels: P6 `<Project>`-velden en `ResourceRate`, MSPDI de kop vóór `<Calendars>`. */
function projectExportLines(p: DocumentPayload): string[] {
  const p6 = quiet(() => writeP6XMLWithReport(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments,
    p.calendars, p.customTaskTypes).xml);
  const msp = quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars,
    p.baselines, p.activeBaselineId, p.customTaskTypes));
  const p6Project = /<Project>[\s\S]*?<\/Project>/.exec(p6)?.[0] ?? '';
  const p6Own = p6Project.replace(/<(WBS|Activity|Relationship|ResourceAssignment|Calendar)>[\s\S]*?<\/\1>/g, '');
  const p6Rates = [...p6.matchAll(/<ResourceRate>[\s\S]*?<\/ResourceRate>/g)].map((m) => m[0]).join('');
  const mspHead = msp.slice(0, Math.max(0, msp.indexOf('<Calendars>')));
  const pick = (src: string, tags: string) => [...src.matchAll(new RegExp(`<(${tags})>([^<]*)</\\1>`, 'g'))].map((m) => `${m[1]}=${m[2]}`);
  return [...pick(p6Own, 'PlannedStartDate|MustFinishByDate').map((l) => `P6 ${l}`),
    ...[...new Set(pick(p6Rates, 'EffectiveDate'))].map((l) => `P6 rate ${l}`),
    ...pick(mspHead, 'StartDate|FinishDate').map((l) => `MSPDI ${l}`)];
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  ifc-projectdatum-corpus: corpus niet aanwezig (OPS_XER_CORPUS); de corpusloze toets is check-ifc-projectdatum-tijd');
  process.exit(0);
}
if (!existsSync(root)) {
  console.log('XX  ifc-projectdatum-corpus: OPS_XER_CORPUS bestaat niet');
  process.exit(1);
}

for (const target of TARGETS) {
  const path = findByName(root, target.name)
    .find((p) => createHash('sha256').update(readFileSync(p)).digest('hex') === target.sha256);
  if (!path) {
    same(`${target.name}: bestand met de gepinde sha256 in het corpus`, null, target.sha256);
    continue;
  }
  const before = openInStore(await parseOpenedFile({ name: target.name, bytes: new Uint8Array(readFileSync(path)) }));
  same(`${target.name}: projectstart en -einde per document`, before.map((d) => [d.project.startDate, d.project.endDate]), target.projectDates);
  same(`${target.name}: constraint-/deadlinedatums met tijd`,
    before.flatMap((d) => d.tasks.flatMap((t) => [t.constraint?.date, t.constraint2?.date, t.deadline])).filter((v) => v?.includes('T')).length,
    target.timedConstraintDates);
  for (const [i, doc] of before.entries()) {
    const label = `${target.name} document ${i + 1}`;
    const input = buildWriteIFCInput(doc);
    const ifc = writeIFC(input);
    for (const schema of ['IFC4X3_ADD2', 'IFC4X3', 'IFC4'] as const) {
      const text = schema === projectIfcSchema(input.project) ? ifc : writeIFC({ ...input, project: { ...input.project, ifcSchema: schema } });
      const r = checkIfcSchema(label, text, undefined, schema);
      checks += r.checks;
      failures.push(...r.failures);
    }
    const [after] = openInStore(await parseOpenedFile({ name: 'rondgang.ifc', text: ifc }));
    const constraintsOf = (p: DocumentPayload) => p.tasks.map((t) => [t.id, t.constraint ?? null, t.constraint2 ?? null, t.deadline ?? null]);
    const cb = constraintsOf(doc);
    const ca = constraintsOf(after);
    same(`${label}: taken met andere constraint of deadline`, cb.filter((x, j) => JSON.stringify(x) !== JSON.stringify(ca[j])).slice(0, 5), []);
    same(`${label}: projectstart, -einde en statusdatum na opslaan en heropenen`,
      [after.project.startDate, after.project.endDate, after.project.statusDate],
      [doc.project.startDate, doc.project.endDate, doc.project.statusDate]);
    const lines = projectExportLines(doc);
    same(`${label}: controle, de export heeft projectregels`, lines.some((l) => l.startsWith('P6 PlannedStartDate=')) && lines.some((l) => l.startsWith('MSPDI StartDate=')), true);
    same(`${label}: projectregels in de P6- en MSPDI-export`, projectExportLines(after), lines);
    const tb = taskDates(doc);
    const ta = taskDates(after);
    const changed = Object.keys(tb).filter((id) => JSON.stringify(tb[id]) !== JSON.stringify(ta[id]));
    same(`${label}: taken met andere datums, speling of kritiek (van ${Object.keys(tb).length})`,
      changed.slice(0, 5).map((id) => ({ id, voor: tb[id], na: ta[id] })), []);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ifc-projectdatum-corpus: ${f}`);
  console.log(`XX  ifc-projectdatum-corpus: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  ifc-projectdatum-corpus: alle ${checks} checks groen`);
