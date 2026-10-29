// Baseline van een urentaak uit MS Project XML (PR #392, fixronde 5). `readMSPDI` leest Baseline 0 van een
// urentaak met tijd in (`importDateTime(raw, isHour)`), net als de taakdatums. Deze check bewijst dat de
// rest van de app die vorm al aankan, omdat een in de app vastgelegde baseline van een urentaak dezelfde
// vorm heeft (`saveBaseline` bewaart `shownStart`/`shownFinish` = `YYYY-MM-DDTHH:mm`):
// - IFC-rondgang (`OPS_Baselines`): de baseline komt met tijd terug;
// - Gantt-overlay (`buildBaselineOverlay`) en variance (`computeVariance`) geven voor de ingelezen
//   baseline dezelfde uitkomst als voor een baseline die de app zelf vastlegt;
// - een dagtaak houdt een baseline met alleen een datum;
// - een onleesbare (`NA`) of ontbrekende baselinedatum breekt de import niet af en geeft geen
//   verzonnen datum: die baseline-entry valt weg, de rest blijft gelijk (VERVOLG 13 van #392).
// Corpusloos (CI).
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildBaselineOverlay, type Baseline } from '@/types/baseline';
import { computeVariance } from '@/engine/variance';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { localTodayIso } from '@/utils/dateUtils';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// Taak 1: urentaak, nu 09:00–12:00, baseline 08:00–17:00 (het scenario van review ronde 5).
// Taak 2: urentaak, nu 08:00–17:00, zonder baseline: de app legt die zelf vast, ter vergelijking.
// Taak 3: urentaak 13:00–15:00 met baseline 13:00–15:00 (de volgende dag).
const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Uren</Name><StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
  <Tasks>
    <Task><UID>1</UID><ID>1</ID><Name>Kraan</Name><OutlineLevel>1</OutlineLevel>
      <Start>2026-03-02T09:00:00</Start><Finish>2026-03-02T12:00:00</Finish><Duration>PT3H0M0S</Duration>
      <Baseline><Number>0</Number><Start>2026-03-02T08:00:00</Start><Finish>2026-03-02T17:00:00</Finish><Duration>PT8H0M0S</Duration></Baseline></Task>
    <Task><UID>2</UID><ID>2</ID><Name>Vergelijk</Name><OutlineLevel>1</OutlineLevel>
      <Start>2026-03-02T08:00:00</Start><Finish>2026-03-02T17:00:00</Finish><Duration>PT8H0M0S</Duration></Task>
    <Task><UID>3</UID><ID>3</ID><Name>Stort</Name><OutlineLevel>1</OutlineLevel>
      <Start>2026-03-03T13:00:00</Start><Finish>2026-03-03T15:00:00</Finish><Duration>PT2H0M0S</Duration>
      <Baseline><Number>0</Number><Start>2026-03-03T13:00:00</Start><Finish>2026-03-03T15:00:00</Finish><Duration>PT2H0M0S</Duration></Baseline></Task>
  </Tasks>
</Project>`;

const r = readMSPDI(XML);
const [t1, t2, t3] = r.tasks;
const imported = r.baselines?.find(b => b.id === r.activeBaselineId);
eq('1a urentaken', r.tasks.map(t => t.time.durationUnit), ['hours', 'hours', 'hours']);
eq('1b ingelezen baseline met tijd', imported?.tasks.map(t => [t.start, t.finish]),
  [['2026-03-02T08:00', '2026-03-02T17:00'], ['2026-03-03T13:00', '2026-03-03T15:00']]);
// De baselineduur volgt dezelfde regel als de taakduur (`mspdiBaselineDays`): 8 u zoals taak 2, 2 u zoals taak 3.
eq('1c baselineduur zoals de taakduur', imported?.tasks.map(t => t.duration), [t2?.time.scheduleDuration, t3?.time.scheduleDuration]);

// (2) Zelfde vorm als een in de app vastgelegde baseline (`saveBaseline`: shownStart/shownFinish).
eq('2a in-app vastgelegde baseline van taak 2 heeft dezelfde vorm', [shownStart(t2!), shownFinish(t2!)],
  imported?.tasks[0] ? [imported.tasks[0].start, imported.tasks[0].finish] : undefined);

// (3) IFC-rondgang: de baseline komt met tijd terug.
const rt = readIFC(writeIFC(r));
const rtBaseline = rt.baselines?.find(b => b.id === rt.activeBaselineId);
eq('3a IFC: baselinedatums met tijd terug', rtBaseline?.tasks.map(t => [t.start, t.finish, t.duration]),
  imported?.tasks.map(t => [t.start, t.finish, t.duration]));
eq('3c IFC: projecteinde van de baseline met tijd terug', [imported?.projectEnd, rtBaseline?.projectEnd], ['2026-03-03T15:00', '2026-03-03T15:00']);
// Bij een in-app baseline komt het projecteinde uit `cpmResult.projectEnd`: bij een urenproject dezelfde vorm.
const solved = solveProject(solveInputFor(r.project, r.tasks.map(t => structuredClone(t)), r.sequences, r.calendar, r.resourceCalendars ?? []));
eq('3d in-app projecteinde (CPM) heeft dezelfde vorm', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(solved.projectEnd)), true);
eq('3b IFC: koppeling naar dezelfde taken', rtBaseline?.tasks.map(t => rt.tasks.find(x => x.id === t.taskId)?.name), ['Kraan', 'Stort']);

// (4) Overlay en variance: de ingelezen baseline geeft dezelfde uitkomst als een in-app vastgelegde baseline
//     met dezelfde getoonde datums (taak 2 als "toen", gekoppeld aan taak 1).
const inApp: Baseline = {
  id: 'in-app', name: 'In de app', createdAt: '2026-03-01T00:00:00Z', projectEnd: '', projectDuration: 0,
  tasks: [
    { taskId: t1!.id, start: shownStart(t2!), finish: shownFinish(t2!), duration: t2!.time.scheduleDuration, isMilestone: false },
    { taskId: t3!.id, start: shownStart(t3!), finish: shownFinish(t3!), duration: t3!.time.scheduleDuration, isMilestone: false },
  ],
};
const overlay = (b: Baseline) => [...(buildBaselineOverlay([b], b.id) ?? new Map()).entries()];
eq('4a Gantt-overlay gelijk', overlay(imported!), overlay(inApp));
const cal = new CalendarEngine(r.calendar);
const variance = (b: Baseline) => computeVariance([t1!, t3!], b, cal).rows
  .map(row => [row.baselineStart, row.baselineFinish, row.deltaStart, row.deltaFinish, row.status]);
eq('4b variance gelijk', variance(imported!), variance(inApp));
eq('4c variance: op schema', variance(imported!).map(row => row[4]), ['onSchedule', 'onSchedule']);

// (5) Onleesbare of ontbrekende baselinedatum (VERVOLG 13 van #392). Vóór de fix gaf `<Start>NA</Start>`
//     bij een urentaak `RangeError: Invalid time value` en brak de hele import af; een dagtaak kreeg `NA`
//     als baselinedatum en een `<Baseline>` zonder Start/Finish de datum van vandaag.
//     Regel: onleesbaar = ontbrekend ⇒ de taak krijgt geen baseline-entry. Vergelijk met hetzelfde
//     bestand zonder die kapotte baselines: taken en de overige baselines moeten gelijk zijn.
function project(dayMode: boolean, broken: boolean): string {
  // 08:00 geeft geen uursignaal: de kalender blijft scalair. Sinds F5b (I8) is het in een bestand zonder
  // OPS-markering wel een echte tijd, die de datum houdt.
  const at = (d: string, h: string) => `${d}T${dayMode ? '08:00' : (h === 'S' ? '09:00' : '12:00')}:00`;
  const dur = dayMode ? 'PT8H0M0S' : 'PT3H0M0S';
  const bl = (start: string, finish: string) =>
    `<Baseline><Number>0</Number>${start}${finish}<Duration>${dur}</Duration></Baseline>`;
  const task = (uid: number, name: string, day: string, baseline: string) =>
    `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><OutlineLevel>1</OutlineLevel>
      <Start>${at(day, 'S')}</Start><Finish>${at(day, 'F')}</Finish><Duration>${dur}</Duration>${baseline}</Task>`;
  const good = bl(`<Start>${at('2026-03-02', 'S')}</Start>`, `<Finish>${at('2026-03-02', 'F')}</Finish>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Kapot</Name><StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
  <Tasks>
    ${task(1, 'Geldig', '2026-03-02', good)}
    ${task(2, 'StartNA', '2026-03-03', broken ? bl('<Start>NA</Start>', `<Finish>${at('2026-03-03', 'F')}</Finish>`) : '')}
    ${task(3, 'FinishNA', '2026-03-04', broken ? bl(`<Start>${at('2026-03-04', 'S')}</Start>`, '<Finish>NA</Finish>') : '')}
    ${task(4, 'Leeg', '2026-03-05', broken ? bl('', '') : '')}
  </Tasks>
</Project>`;
}
for (const dayMode of [false, true]) {
  const tag = dayMode ? 'dagtaak' : 'urentaak';
  let got: ReturnType<typeof readMSPDI> | undefined;
  try {
    got = readMSPDI(project(dayMode, true));
  } catch (e) {
    checks++;
    fails.push(`5a ${tag}: import breekt af met ${String(e)}`);
  }
  if (!got) continue;
  const ref = readMSPDI(project(dayMode, false));
  eq(`5b ${tag}: modus`, got.tasks.map(t => t.time.durationUnit), ref.tasks.map(t => t.time.durationUnit));
  eq(`5c ${tag}: taken gelijk aan het bestand zonder kapotte baselines`,
    got.tasks.map(t => [t.name, t.time]), ref.tasks.map(t => [t.name, t.time]));
  const named = (res: typeof got) => {
    const b = res.baselines?.find(x => x.id === res.activeBaselineId);
    return b ? { projectEnd: b.projectEnd, tasks: b.tasks.map(e => ({ ...e, taskId: res.tasks.find(t => t.id === e.taskId)?.name })) } : undefined;
  };
  eq(`5d ${tag}: alleen de geldige baseline, ongewijzigd`, named(got), named(ref));
  eq(`5e ${tag}: geldige baseline zoals in het bestand`, named(got)?.tasks.map(e => [e.taskId, e.start, e.finish]),
    [['Geldig', dayMode ? '2026-03-02T08:00' : '2026-03-02T09:00', dayMode ? '2026-03-02T08:00' : '2026-03-02T12:00']]);
  const today = localTodayIso();
  eq(`5f ${tag}: geen verzonnen of onleesbare baselinedatum`,
    (named(got)?.tasks ?? []).flatMap(e => [e.start, e.finish]).filter(d => d.startsWith(today) || !/^\d{4}-\d{2}-\d{2}/.test(d)), []);
}

if (fails.length) {
  for (const f of fails) console.log(`XX  mspdi-hour-baseline: ${f}`);
  process.exitCode = 1;
} else {
  console.log(`OK  mspdi-hour-baseline: ${checks} controles groen`);
}
