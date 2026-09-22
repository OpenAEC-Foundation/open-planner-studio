// "Datums zoals opgeslagen" voor ÁLLE formaten (eigenaarsbesluit 2026-09-09: "het moet altijd
// gaan zoals het nu bij XER werkt"). Twee lagen:
//   (1) de LEZERS — P6 XML, MSPDI, CSV en (corpus-optioneel) `.mpp` leveren het bak-4-kanaal
//       `ImportResult.recordedTimes` met de bronuitvoer die het bestand écht draagt; ontbrekende
//       assen ontbreken (nooit `0`/gekopieerde datum), `task.time` blijft byte-identiek aan vóór
//       dit kanaal (de vastlegging is weergave, nooit solverinvoer);
//   (2) de IFC-HERKOMST — een IFC uit een ander pakket is 'ifc' (verse import), een eigen IFC
//       'ifc-own' (heropening) mét de vlag "ongewijzigd sinds import" uit `OPS_ImportProvenance`.
// Het LAADBELEID (automatisch aan per herkomst, optie B) staat in `check-recorded-dates.ts` 7/7B/16;
// de browserflow in `tests/browser/recorded-dates.spec.ts`.
import { readP6XML } from '@/services/p6/p6xmlReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readCSV } from '@/services/csv/csvReader';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { criticalSlackLimitDaysOf, mppTotalSlackTenths, openMppProject, parseProjectProperties, readMPP, readTasks } from '@/services/mpp/mppReader';
import { createTaskFieldMap } from '@/services/mpp/fieldMap14';
import { readCalendars } from '@/services/mpp/mppCalendars';
import type { ImportResult } from '@/services/importTypes';
import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import { externIfc } from '../fixtures/recordedDatesIfc';
import { CSV_FIXTURE, CSV_FIXTURE_DATES_ONLY, CSV_FIXTURE_UNREADABLE_DATES, MSPDI_FIXTURE, P6XML_FIXTURE } from '../fixtures/recordedTimesFormats';
import { csvDateOrToday } from '@/services/importDates';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { installDOMParser } from './xmldom-shim';

// De P6/MSPDI-readers gebruiken de browser-`DOMParser`; in Node via dezelfde shim als
// `check-adapters-hours.ts`.
installDOMParser();

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };
let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: verwacht ${w}, kreeg ${g}`);
};
const truthy = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const byWbs = (r: ImportResult, wbs: string) => r.tasks.find(t => t.wbsCode === wbs);
const recordedOf = (r: ImportResult, wbs: string): RecordedTime | undefined => {
  const t = byWbs(r, wbs); return t ? r.recordedTimes?.[t.id] : undefined;
};

// ── (1) P6 XML ──────────────────────────────────────────────────────────────────────────────────
{
  const r = readP6XML(P6XML_FIXTURE);
  eq('1a herkomst p6xml', r.recordedTimesOrigin, 'p6xml');
  eq('1b A: alle zes assen + kritiek uit het bestand (40 u op 8 u/dag = 5 dagen)', recordedOf(r, '1.1'), {
    start: '2026-03-02', finish: '2026-03-06', lateStart: '2026-03-09', lateFinish: '2026-03-13',
    totalFloat: 5, freeFloat: 0, isCritical: false,
  });
  eq('1c B: alleen het vroege paar — vier assen "niet vastgelegd", geen 0-terugval', recordedOf(r, '1.2'), {
    start: '2026-03-16', finish: '2026-03-20',
  });
  eq('1d C: zonder datums geen vastlegging', recordedOf(r, '1.3'), undefined);
  eq('1e task.time blijft de geplande invoer (late = gepland, speling 0 — de bestaande vulling), NIET de vastlegging',
    [byWbs(r, '1.1')?.time.lateStart, byWbs(r, '1.1')?.time.totalFloat], ['2026-03-02', 0]);
  // Terugval StartDate/FinishDate wanneer een export geen Early*-elementen draagt (P6 schrijft ze
  // wel, maar "vergelijk wat er is" geldt óók voor een uitgeklede export).
  const noEarly = P6XML_FIXTURE.replace(/<EarlyStartDate>[^<]*<\/EarlyStartDate>\s*<EarlyFinishDate>[^<]*<\/EarlyFinishDate>/g, '')
    .replace('<PlannedStartDate>2026-03-16T08:00:00</PlannedStartDate>', '<PlannedStartDate>2026-03-16T08:00:00</PlannedStartDate><StartDate>2026-03-17T08:00:00</StartDate><FinishDate>2026-03-23T08:00:00</FinishDate>');
  const r2 = readP6XML(noEarly);
  eq('1f zonder Early*: StartDate/FinishDate zijn de vastlegging', recordedOf(r2, '1.2'), { start: '2026-03-17', finish: '2026-03-23' });
  eq('1g zonder Early* én zonder StartDate: geen vastlegging (A verloor zijn early-paar, houdt late/speling niet zonder start/einde)', recordedOf(r2, '1.1'), undefined);
}

// ── (2) MSPDI ───────────────────────────────────────────────────────────────────────────────────
{
  const r = readMSPDI(MSPDI_FIXTURE);
  eq('2a herkomst mspdi', r.recordedTimesOrigin, 'mspdi');
  eq('2b A: zes assen + Critical (24.000 tienden van een minuut = 2.400 min = 5 dagen van 8 u)', recordedOf(r, '1.1'), {
    start: '2026-03-02', finish: '2026-03-06', lateStart: '2026-03-09', lateFinish: '2026-03-13',
    totalFloat: 5, freeFloat: 0, isCritical: false,
  });
  eq('2c B: alleen het vroege paar', recordedOf(r, '1.2'), { start: '2026-03-16', finish: '2026-03-20' });
  eq('2d C: geen datums ⇒ geen vastlegging', recordedOf(r, '1.3'), undefined);
  eq('2e task.time ongewijzigd (lateStart = start, speling 0 — de bestaande vulling)', [byWbs(r, '1.1')?.time.lateStart, byWbs(r, '1.1')?.time.totalFloat], ['2026-03-02', 0]);
  const noEarly = MSPDI_FIXTURE.replace(/<EarlyStart>[^<]*<\/EarlyStart>\s*<EarlyFinish>[^<]*<\/EarlyFinish>/g, '');
  eq('2f zonder Early*: Start/Finish zijn de vastlegging', recordedOf(readMSPDI(noEarly), '1.2'), { start: '2026-03-16', finish: '2026-03-20' });
}

// ── (3) CSV ─────────────────────────────────────────────────────────────────────────────────────
{
  const r = readCSV(CSV_FIXTURE);
  eq('3a herkomst csv', r.recordedTimesOrigin, 'csv');
  eq('3b A: start/einde + totale speling + kritiek uit de kolommen; late datums kent CSV niet', recordedOf(r, '1.1'), {
    start: '2026-03-02', finish: '2026-03-06', totalFloat: 5, isCritical: false,
  });
  eq('3c B: lege speling-/kritiekcel ⇒ die assen "niet vastgelegd" (task.time krijgt wél de 0-vulling)',
    [recordedOf(r, '1.2'), byWbs(r, '1.2')?.time.totalFloat], [{ start: '2026-03-16', finish: '2026-03-20' }, 0]);
  eq('3d C: lege datumcellen ⇒ geen vastlegging (task.time krijgt de "vandaag"-terugval, de vastlegging niet)', recordedOf(r, '1.3'), undefined);
  const r2 = readCSV(CSV_FIXTURE_DATES_ONLY);
  eq('3e zonder speling-/kritiekkolom: alleen start/einde', recordedOf(r2, '1.1'), { start: '2026-03-02', finish: '2026-03-06' });
  const r3 = readCSV(['WBS,Name,Duration', '1.1,A,5'].join('\n'));
  eq('3f zonder datumkolommen: geen kanaal en geen herkomst', [r3.recordedTimes, r3.recordedTimesOrigin], [undefined, undefined]);
  // Critreview op ded4d8c3, bevinding 1: een GEVULDE maar onleesbare datumcel ("Mon 3/2/26",
  // "2 maart 2026") is geen vastlegging — de vergevende lezing zou er "vandaag" van maken.
  const r4 = readCSV(CSV_FIXTURE_UNREADABLE_DATES);
  eq('3g onleesbare datumcellen ("Mon 3/2/26", "2 maart 2026") ⇒ geen vastlegging, geen kanaal, geen herkomst',
    [r4.recordedTimes, r4.recordedTimesOrigin], [undefined, undefined]);
  eq('3h …terwijl task.time de gewone, vergevende lezing houdt (vandaag-terugval, byte-identiek aan csvDateOrToday)',
    [byWbs(r4, '1.1')?.time.scheduleStart, byWbs(r4, '1.2')?.time.scheduleStart], [csvDateOrToday('Mon 3/2/26'), csvDateOrToday('2 maart 2026')]);
  const r5 = readCSV(['WBS,Name,Duration,Start,Finish', '1.1,A,5,2026-02-31,2026-03-06', '1.2,B,5,02-03-2026,06/03/2026'].join('\n'));
  eq('3i een niet-bestaande datum (31 februari) is evenmin een vastlegging', recordedOf(r5, '1.1'), undefined);
  eq('3j DD-MM-YYYY en DD/MM/YYYY blijven herkend', recordedOf(r5, '1.2'), { start: '2026-03-02', finish: '2026-03-06' });
}

// ── (4) IFC-herkomst: ander pakket vs eigen bestand, en de vlag "ongewijzigd sinds import" ────────
{
  const extern = readIFC(externIfc('F'));
  eq('4a IFC zonder IFCAPPLICATION "OPS" en zonder OPS_-pset is een verse import uit een ander pakket', extern.recordedTimesOrigin, 'ifc');
  eq('4b …en draagt geen importPristine-uitspraak (de payload zet hem zelf op true)', extern.importPristine, undefined);
  const own = writeIFC({ ...extern, recordedTimesOrigin: undefined });
  const ownRead = readIFC(own);
  eq('4c een IFC dat deze app schreef is een heropening', ownRead.recordedTimesOrigin, 'ifc-own');
  eq('4d zonder OPS_ImportProvenance leest de vlag als false (nooit een gok)', ownRead.importPristine, false);
  truthy('4e zonder vlag géén OPS_ImportProvenance-pset (bestaande bestanden byte-identiek)', !own.includes('OPS_ImportProvenance'));
  const pristine = writeIFC({ ...extern, recordedTimesOrigin: undefined, importPristine: true });
  truthy('4f met vlag exact één OPS_ImportProvenance-pset met UnchangedSinceImport .T.',
    pristine.split("'OPS_ImportProvenance'").length === 2 && pristine.includes("IFCPROPERTYSINGLEVALUE('UnchangedSinceImport',$,IFCBOOLEAN(.T.),$)"));
  eq('4g …en die leest terug als true', readIFC(pristine).importPristine, true);
  const tampered = pristine.replace('IFCBOOLEAN(.T.)', 'IFCBOOLEAN(.F.)');
  eq('4h .F. leest als false', readIFC(tampered).importPristine, false);
  // Herkomstdetectie via alleen de IFCAPPLICATION-regel: strip alle OPS_-psets uit het eigen
  // bestand ⇒ nog steeds 'ifc-own' (twee onafhankelijke sporen, elk voldoende).
  const noPsets = own.split('\n').filter(line => !line.includes("'OPS_")).join('\n');
  eq('4i IFCAPPLICATION "OPS" alleen is voldoende voor "eigen bestand"', readIFC(noPsets).recordedTimesOrigin, 'ifc-own');
  const noApp = own.split('\n').filter(line => !line.includes('IFCAPPLICATION(')).join('\n');
  eq('4j een OPS_-pset alleen is óók voldoende', readIFC(noApp).recordedTimesOrigin, 'ifc-own');
}

// ── (5-0) .mpp-kritiekgrens uit de projecteigenschappen (corpusloos) ────────────────────────────
// CRITICAL_SLACK_LIMIT (MPXJ `ProjectPropertiesReader`: `props.getInt`, dagen). In het publieke
// corpus staat hij overal op 0, dus de grens zelf is alleen hier en in 5f hieronder bewezen.
{
  const props = (v: number) => ({ getInt: (key: number) => (key === 37748756 ? v : 0) });
  eq('5-0a grens 3 dagen wordt gelezen', criticalSlackLimitDaysOf(props(3)), 3);
  eq('5-0b ontbrekend (Props geeft 0) ⇒ 0, de MSP-default', criticalSlackLimitDaysOf(props(0)), 0);
  eq('5-0c een onzinnige waarde (1e9 dagen) valt terug op 0', criticalSlackLimitDaysOf(props(1_000_000_000)), 0);
  // Totale speling (tienden van een minuut) uit start- en finish slack.
  eq('5-0d gestart: de finish slack, niet het minimum', mppTotalSlackTenths(true, 0, 4800), 4800);
  eq('5-0e gestart zónder finish slack maar mét start slack: geen speling (zoals MPXJ)', mppTotalSlackTenths(true, 0, null), null);
  eq('5-0f niet gestart: het minimum', mppTotalSlackTenths(false, 2400, 4800), 2400);
  eq('5-0g niet gestart, één as ontbreekt: de andere', [mppTotalSlackTenths(false, null, 4800), mppTotalSlackTenths(false, 2400, null)], [4800, 2400]);
}

// ── (5) .mpp — corpus-optioneel (OPS_MPP_CRAWL, publieke MPXJ-junit-data + OzBuild) ─────────────
// Geen synthetische MPP-fixture: de veldkaart (EARLY_START 37 e.a., `fieldMap14.ts`) is uit
// MPXJ overgenomen en wordt hier tegen echte bestanden bewezen. Zelfde standaardpad als
// `check-mpp-fidelity.ts`; ontbreekt het: overgeslagen, met melding — de andere vier lagen
// hierboven draaien altijd.
{
  const crawl = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl';
  if (!existsSync(crawl)) {
    console.log('.   recorded-times-formats: crawl (OPS_MPP_CRAWL) niet aanwezig — .mpp-laag overgeslagen');
  } else {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.mpp$/i.test(entry)) files.push(full);
      }
    };
    walk(crawl);
    let readable = 0, withRecorded = 0, tasksTotal = 0, tasksRecorded = 0, lateAxes = 0, floatAxes = 0, inverted = 0, mismatchedStart = 0;
    // Critreview op ded4d8c3, bevinding 2: MS Project (MPXJ `Task.calculateCritical`) noemt een
    // voltooide taak (werkelijk einde of 100%) NOOIT kritiek. Telling over de vastgelegde taken.
    let completedRecorded = 0, completedCritical = 0;
    for (const file of files.sort()) {
      let r: ImportResult;
      try { r = readMPP(new Uint8Array(readFileSync(file))); } catch { continue; }
      readable++;
      if (r.recordedTimes) {
        withRecorded++;
        eq(`5a ${file.slice(crawl.length)}: herkomst mpp`, r.recordedTimesOrigin, 'mpp');
        for (const t of r.tasks) {
          tasksTotal++;
          const rec = r.recordedTimes[t.id];
          if (!rec) continue;
          tasksRecorded++;
          if (rec.lateStart !== undefined && rec.lateFinish !== undefined) lateAxes++;
          if (rec.totalFloat !== undefined) floatAxes++;
          if (rec.finish < rec.start) inverted++;
          if (t.time.actualFinish || t.time.completion >= 1) {
            completedRecorded++;
            if (rec.isCritical === true) completedCritical++;
          }
          // De vastgelegde vroege start moet voor een AUTO-taak zonder actuals samenvallen met MSP's
          // eigen geplande start (`task.time.scheduleStart`): EARLY_START = START in MSP zolang er
          // geen voortgang is. Een afwijking wijst op een verkeerde veldkaart-offset.
          if (t.status === 'NOT_STARTED' && rec.start !== t.time.scheduleStart) mismatchedStart++;
        }
      }
    }
    console.log(`.   recorded-times-formats .mpp: ${files.length} bestanden, ${readable} leesbaar, ${withRecorded} met vastlegging, taken ${tasksRecorded}/${tasksTotal} vastgelegd, late-assen ${lateAxes}, speling ${floatAxes}, start≠scheduleStart(NOT_STARTED) ${mismatchedStart}, finish<start ${inverted}, voltooid-en-kritiek ${completedCritical}/${completedRecorded}`);
    truthy('5b minstens één leesbaar crawl-bestand draagt een vastlegging', withRecorded > 0);
    truthy('5c de vastgelegde vroege start valt voor niet-gestarte taken samen met MSP\'s geplande start (veldkaart-offset EARLY_START bewezen)', mismatchedStart === 0);
    truthy('5d geen enkele vastlegging eindigt vóór haar start', inverted === 0);
    // 5f: de grens werkt echt door in `readTasks` — op het eerste crawl-bestand met een NIET-
    // voltooide vastgelegde taak met positieve speling: grens 0 ⇒ niet kritiek, grens ≥ die
    // speling ⇒ kritiek; een voltooide taak blijft bij elke grens niet-kritiek.
    let limitProven = false;
    for (const file of files) {
      if (limitProven) break;
      let scan: ReturnType<typeof readTasks>;
      try {
        const { cfb, projectProps, applicationVersion } = openMppProject(new Uint8Array(readFileSync(file)));
        const { project, hoursPerDay, calendarHoursPerDayOverride } = parseProjectProperties(projectProps, undefined);
        const base = { cfb, taskFieldMap: createTaskFieldMap(projectProps), hoursPerDay, statusDate: project.statusDate, applicationVersion };
        const run = (limit: number) => readTasks({ ...base, calResult: readCalendars(cfb, projectProps, applicationVersion, calendarHoursPerDayOverride), criticalSlackLimitDays: limit });
        scan = run(0);
        const idx = scan.tasks.findIndex(t => !(t.time.actualFinish || t.time.completion >= 1) && (scan.recordedTimes[t.id]?.totalFloat ?? 0) > 0);
        if (idx < 0) continue;
        const tf = scan.recordedTimes[scan.tasks[idx].id].totalFloat!;
        const wide = run(Math.ceil(tf));
        const doneIdx = wide.tasks.findIndex(t => t.time.actualFinish || t.time.completion >= 1);
        eq(`5f ${file.slice(crawl.length)}: speling ${tf} d is niet kritiek bij grens 0, wél bij grens ${Math.ceil(tf)}; voltooid blijft niet-kritiek`,
          [scan.recordedTimes[scan.tasks[idx].id].isCritical, wide.recordedTimes[wide.tasks[idx].id].isCritical,
            doneIdx < 0 ? false : wide.recordedTimes[wide.tasks[doneIdx].id]?.isCritical ?? false],
          [false, true, false]);
        limitProven = true;
      } catch { continue; }
    }
    truthy('5f de kritiekgrens is op minstens één crawl-bestand doorgemeten', limitProven);
    // 5g: bij een GESTARTE (niet-voltooide) taak is de totale speling de finish slack, niet
    // min(start, finish) — MSP zet de start slack van een gestarte taak op 0, waardoor het minimum
    // elke gestarte taak kritiek maakte. Telling: gestart, finish slack > 0, toch speling 0.
    let startedChecked = 0, startedZeroed = 0;
    for (const file of files) {
      try {
        const { cfb, projectProps, applicationVersion } = openMppProject(new Uint8Array(readFileSync(file)));
        const { project, hoursPerDay, calendarHoursPerDayOverride } = parseProjectProperties(projectProps, undefined);
        const scan = readTasks({ cfb, taskFieldMap: createTaskFieldMap(projectProps), hoursPerDay, statusDate: project.statusDate, applicationVersion,
          calResult: readCalendars(cfb, projectProps, applicationVersion, calendarHoursPerDayOverride) });
        for (const raw of scan.rawScans) {
          if (raw.actualStartTs === null || raw.actualFinishTs !== null || raw.percentComplete >= 100) continue;
          if (raw.finishSlackRaw === null || raw.finishSlackRaw <= 0) continue;
          const id = scan.taskIdByUniqueId.get(raw.uniqueId);
          const rec = id ? scan.recordedTimes[id] : undefined;
          if (!rec || rec.totalFloat === undefined) continue;
          startedChecked++;
          if (rec.totalFloat <= 0) startedZeroed++;
        }
      } catch { continue; }
    }
    console.log(`.   recorded-times-formats .mpp: gestart met finish slack > 0: ${startedChecked}, daarvan speling ≤ 0: ${startedZeroed}`);
    truthy(`5g gestarte taken met positieve finish slack krijgen die als totale speling (${startedZeroed}/${startedChecked} op ≤ 0)`, startedChecked > 0 && startedZeroed === 0);
    truthy(`5e geen voltooide taak is als kritiek vastgelegd (MPXJ calculateCritical) — ${completedCritical}/${completedRecorded}`, completedCritical === 0);
  }
}

if (diffs.length === 0) {
  console.log(`OK  recorded-times-formats: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  recorded-times-formats: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
