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
import { readMPP } from '@/services/mpp/mppReader';
import type { ImportResult } from '@/services/importTypes';
import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import { externIfc } from '../fixtures/recordedDatesIfc';
import { CSV_FIXTURE, CSV_FIXTURE_DATES_ONLY, MSPDI_FIXTURE, P6XML_FIXTURE } from '../fixtures/recordedTimesFormats';
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

// ── (5) .mpp — corpus-optioneel (OPS_MPP_CRAWL, publieke MPXJ-junit-data) ───────────────────────
// Geen synthetische MPP-fixture: de veldkaart (EARLY_START 37 e.a., `fieldMap14.ts`) is uit
// MPXJ overgenomen en wordt hier tegen echte bestanden bewezen. Zonder crawl: overgeslagen, met
// melding — de andere vier lagen hierboven draaien altijd.
{
  const crawl = process.env.OPS_MPP_CRAWL;
  if (!crawl || !existsSync(crawl)) {
    console.log('.   recorded-times-formats: OPS_MPP_CRAWL niet aanwezig — .mpp-laag overgeslagen');
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
          // De vastgelegde vroege start moet voor een AUTO-taak zonder actuals samenvallen met MSP's
          // eigen geplande start (`task.time.scheduleStart`): EARLY_START = START in MSP zolang er
          // geen voortgang is. Een afwijking wijst op een verkeerde veldkaart-offset.
          if (t.status === 'NOT_STARTED' && rec.start !== t.time.scheduleStart) mismatchedStart++;
        }
      }
    }
    console.log(`.   recorded-times-formats .mpp: ${files.length} bestanden, ${readable} leesbaar, ${withRecorded} met vastlegging, taken ${tasksRecorded}/${tasksTotal} vastgelegd, late-assen ${lateAxes}, speling ${floatAxes}, start≠scheduleStart(NOT_STARTED) ${mismatchedStart}, finish<start ${inverted}`);
    truthy('5b minstens één leesbaar crawl-bestand draagt een vastlegging', withRecorded > 0);
    truthy('5c de vastgelegde vroege start valt voor niet-gestarte taken samen met MSP\'s geplande start (veldkaart-offset EARLY_START bewezen)', mismatchedStart === 0);
    truthy('5d geen enkele vastlegging eindigt vóór haar start', inverted === 0);
  }
}

if (diffs.length === 0) {
  console.log(`OK  recorded-times-formats: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  recorded-times-formats: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
