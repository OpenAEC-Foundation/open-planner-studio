// Integratie ronde 2 (#326 × #330): de GETOONDE datums (`shownStart`/`shownFinish`, utils/taskDates.ts)
// na het openen van XER, P6 XML en MSPDI via de echte open-pijplijn (`parseOpenedFile` →
// `applyOpenedImport`, met herberekenen).
//
// De regel van #326 (eigenaarsbesluit 2026-10-12, optie 1): een gestarte taak toont haar werkelijke
// start, een voltooide ook haar werkelijke einde; een lopende taak eindigt op haar berekende einde; een
// niet-gestarte taak toont de rekendatums. De regel van #330: in P6 XML wint `Status = Not Started`
// van werkelijke datums in het bestand; zo'n taak is dus NIET gestart en toont de rekendatums.
// Corpusloos (CI). Fixtures inline. Exit 0 = alles groen.
import { parseOpenedFile } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { computedFinish, computedStart, finishIsActual, shownFinish, shownStart, startIsActual } from '@/utils/taskDates';
import type { Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();
const S = () => useAppStore.getState();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
const day = (iso: string) => iso.slice(0, 10);

async function openText(name: string, text: string): Promise<Task[]> {
  // XER leest de bytes zelf (codering); de andere formaten de tekst.
  const parsed = await parseOpenedFile(name.endsWith('.xer') ? { name, text, bytes: new TextEncoder().encode(text) } : { name, text });
  S().newProject();
  S().applyOpenedImport(parsed, { filePath: null, recompute: true, fit: false, linkedOpen: true });
  return S().tasks;
}
const byCode = (tasks: Task[], code: string) => {
  const task = tasks.find(t => t.wbsCode === code || t.name === code);
  if (!task) throw new Error(`taak ${code} niet gevonden`);
  return task;
};
/** [getoonde start, getoond einde, start vast, einde vast] op dagniveau. */
const shown = (task: Task) => [day(shownStart(task)), day(shownFinish(task)), startIsActual(task), finishIsActual(task)];

// ── XER (P6-profiel): A19 zet de rekenstart van een lopende taak op de statusdatum; het scherm toont
//    de werkelijke start. ─────────────────────────────────────────────────────────────────────────────
const WORKWEEK = `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7]
  .map(n => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`).join('')}))(0||Exceptions()())))`;
const XER = [
  'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${WORKWEEK}`,
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
  '%R\tP1\tEchteDatums\tC1\t2026-03-02 08:00\t2026-01-05 08:00\t2026-06-30 17:00',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tA1\tP1\tC1\tA1\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t90\t0\t2026-01-05 08:00\t2026-01-16 17:00\t2026-01-07 08:00\t2026-01-20 17:00',
  '%R\tA2\tP1\tC1\tA2\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t90\t45\t2026-02-23 08:00\t2026-03-06 17:00\t2026-02-23 08:00\t',
  '%R\tA3\tP1\tC1\tA3\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-03-09 08:00\t2026-03-13 17:00\t\t',
  '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tA2\tA1\tP1\tP1\tPR_FS\t0',
  '%R\tR2\tA3\tA2\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');

// ── P6 XML (OPS-profiel; Not Started wint van werkelijke datums, #330). ───────────────────────────────
const P6XML = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects">
<Project><ObjectId>1</ObjectId><Id>P1</Id><Name>Echte datums</Name>
  <PlannedStartDate>2026-01-05T08:00:00</PlannedStartDate><DataDate>2026-03-02T08:00:00</DataDate>
  <Activity><ObjectId>11</ObjectId><Id>A1</Id><Name>Voltooid</Name><Status>Completed</Status><PlannedDuration>80</PlannedDuration>
    <PlannedStartDate>2026-01-05T08:00:00</PlannedStartDate><PlannedFinishDate>2026-01-16T17:00:00</PlannedFinishDate>
    <ActualStartDate>2026-01-07T08:00:00</ActualStartDate><ActualFinishDate>2026-01-20T17:00:00</ActualFinishDate></Activity>
  <Activity><ObjectId>12</ObjectId><Id>A2</Id><Name>Lopend</Name><Status>In Progress</Status><PlannedDuration>80</PlannedDuration>
    <RemainingDuration>40</RemainingDuration>
    <PlannedStartDate>2026-02-23T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-06T17:00:00</PlannedFinishDate>
    <ActualStartDate>2026-02-24T08:00:00</ActualStartDate></Activity>
  <Activity><ObjectId>13</ObjectId><Id>A3</Id><Name>Niet gestart met datums</Name><Status>Not Started</Status><PlannedDuration>40</PlannedDuration>
    <PlannedStartDate>2026-03-09T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-13T17:00:00</PlannedFinishDate>
    <ActualStartDate>2026-01-12T08:00:00</ActualStartDate><ActualFinishDate>2026-01-13T17:00:00</ActualFinishDate></Activity>
</Project></APIBusinessObjects>`;

// ── MSPDI (OPS-profiel). ───────────────────────────────────────────────────────────────────────────────
const mspTask = (uid: number, name: string, start: string, finish: string, extra: string) => `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name>
  <OutlineLevel>1</OutlineLevel><WBS>${name}</WBS><Start>${start}</Start><Finish>${finish}</Finish><Duration>PT40H0M0S</Duration>${extra}</Task>`;
const MSPDI = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Echte datums</Name><StartDate>2026-01-05T08:00:00</StartDate>
<StatusDate>2026-03-02T08:00:00</StatusDate><Tasks>
${mspTask(1, 'M1', '2026-01-05T08:00:00', '2026-01-09T17:00:00', '<PercentComplete>100</PercentComplete><ActualStart>2026-01-07T08:00:00</ActualStart><ActualFinish>2026-01-14T17:00:00</ActualFinish>')}
${mspTask(2, 'M2', '2026-02-23T08:00:00', '2026-02-27T17:00:00', '<PercentComplete>50</PercentComplete><ActualStart>2026-02-24T08:00:00</ActualStart>')}
${mspTask(3, 'M3', '2026-03-09T08:00:00', '2026-03-13T17:00:00', '<PercentComplete>0</PercentComplete>')}
</Tasks></Project>`;

async function main(): Promise<void> {
  // XER
  let tasks = await openText('echte-datums.xer', XER);
  const xa1 = byCode(tasks, 'A1');
  const xa2 = byCode(tasks, 'A2');
  const xa3 = byCode(tasks, 'A3');
  eq('X1 voltooid: werkelijke start en einde', shown(xa1), ['2026-01-07', '2026-01-20', true, true]);
  eq('X2 lopend: werkelijke start, berekend einde', [...shown(xa2), day(shownFinish(xa2)) === day(computedFinish(xa2))],
    ['2026-02-23', day(computedFinish(xa2)), true, false, true]);
  eq('X2b lopend (P6-profiel, A19): rekenstart = statusdatum, getoond = werkelijk', day(computedStart(xa2)), '2026-03-02');
  eq('X3 niet gestart: rekendatums', [day(shownStart(xa3)) === day(computedStart(xa3)), startIsActual(xa3), finishIsActual(xa3)], [true, false, false]);

  // P6 XML
  tasks = await openText('echte-datums.xml', P6XML);
  const pa1 = byCode(tasks, 'A1');
  const pa2 = byCode(tasks, 'A2');
  const pa3 = byCode(tasks, 'A3');
  eq('P1 voltooid: werkelijke start en einde', shown(pa1), ['2026-01-07', '2026-01-20', true, true]);
  eq('P2 lopend: werkelijke start, berekend einde', [day(shownStart(pa2)), startIsActual(pa2), finishIsActual(pa2), shownFinish(pa2) === computedFinish(pa2)],
    ['2026-02-24', true, false, true]);
  eq('P3 Not Started wint: geen werkelijke datums gelezen', [pa3.time.actualStart || '', pa3.time.actualFinish || ''], ['', '']);
  eq('P3b Not Started: getoonde datums = rekendatums, niet de januari-datums uit het bestand',
    [shownStart(pa3) === computedStart(pa3), shownFinish(pa3) === computedFinish(pa3), startIsActual(pa3), day(shownStart(pa3)) >= '2026-03-02'],
    [true, true, false, true]);

  // MSPDI
  tasks = await openText('echte-datums-msp.xml', MSPDI);
  const m1 = byCode(tasks, 'M1');
  const m2 = byCode(tasks, 'M2');
  const m3 = byCode(tasks, 'M3');
  eq('M1 voltooid: werkelijke start en einde', shown(m1), ['2026-01-07', '2026-01-14', true, true]);
  eq('M2 lopend: werkelijke start, berekend einde', [day(shownStart(m2)), startIsActual(m2), finishIsActual(m2), shownFinish(m2) === computedFinish(m2)],
    ['2026-02-24', true, false, true]);
  eq('M3 niet gestart: rekendatums', [shownStart(m3) === computedStart(m3), startIsActual(m3)], [true, false]);
}

main().then(() => {
  if (fails.length > 0) {
    for (const f of fails) console.log(`XX  shown-dates-formats: ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK  shown-dates-formats: ${checks} controles groen`);
  }
}, (e: unknown) => {
  console.log(`XX  shown-dates-formats: uitzondering ${(e as Error).stack}`);
  process.exitCode = 1;
});
