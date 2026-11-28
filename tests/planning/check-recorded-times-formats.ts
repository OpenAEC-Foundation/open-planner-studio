import { readP6XML } from '@/services/p6/p6xmlReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { CsvDateImportError, readCSV } from '@/services/csv/csvReader';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { criticalSlackLimitDaysOf, mppTotalSlackTenths, openMppProject, parseProjectProperties, readMPP, readTasks } from '@/services/mpp/mppReader';
import { createTaskFieldMap } from '@/services/mpp/fieldMap14';
import { readCalendars } from '@/services/mpp/mppCalendars';
import type { ImportResult } from '@/services/importTypes';
import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import { externIfc } from '../fixtures/recordedDatesIfc';
import { CSV_FIXTURE, CSV_FIXTURE_DATES_ONLY, CSV_FIXTURE_UNREADABLE_DATES, MSPDI_FIXTURE, P6XML_FIXTURE } from '../fixtures/recordedTimesFormats';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { installDOMParser } from './xmldom-shim';
import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { unrecordedAxes } from '@/state/recordedDatesSelectors';
import { withRecordedDatesNotice } from '@/state/slices/fileSlice';
import { recoveryInputFromParsed } from '@/state/documentContract';

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

{
  const r = readP6XML(P6XML_FIXTURE);
  eq('1a herkomst p6xml', r.recordedTimesOrigin, 'p6xml');
  eq('1b A: alle zes assen + kritiek uit het bestand (40 u op 8 u/dag = 5 dagen)', recordedOf(r, '1.1'), {
    start: '2026-03-02T08:00', finish: '2026-03-06T08:00', lateStart: '2026-03-09T08:00', lateFinish: '2026-03-13T08:00',
    totalFloat: 5, freeFloat: 0, isCritical: false,
  });
  eq('1c B: alleen het vroege paar — vier assen "niet vastgelegd", geen 0-terugval', recordedOf(r, '1.2'), {
    start: '2026-03-16T08:00', finish: '2026-03-20T08:00',
  });
  eq('1d C: zonder datums geen vastlegging', recordedOf(r, '1.3'), undefined);
  eq('1e task.time blijft de geplande invoer (late = gepland, speling 0 — de bestaande vulling), NIET de vastlegging',
    [byWbs(r, '1.1')?.time.lateStart, byWbs(r, '1.1')?.time.totalFloat], ['2026-03-02T08:00', 0]);
  const noEarly = P6XML_FIXTURE.replace(/<EarlyStartDate>[^<]*<\/EarlyStartDate>\s*<EarlyFinishDate>[^<]*<\/EarlyFinishDate>/g, '')
    .replace('<PlannedStartDate>2026-03-16T08:00:00</PlannedStartDate>', '<PlannedStartDate>2026-03-16T08:00:00</PlannedStartDate><StartDate>2026-03-17T08:00:00</StartDate><FinishDate>2026-03-23T08:00:00</FinishDate>');
  const r2 = readP6XML(noEarly);
  eq('1f zonder Early*: StartDate/FinishDate zijn de vastlegging', recordedOf(r2, '1.2'), { start: '2026-03-17T08:00', finish: '2026-03-23T08:00' });
  eq('1g zonder Early* én zonder StartDate: geen vastlegging (A verloor zijn early-paar, houdt late/speling niet zonder start/einde)', recordedOf(r2, '1.1'), undefined);
}

{
  const r = readMSPDI(MSPDI_FIXTURE);
  eq('2a herkomst mspdi', r.recordedTimesOrigin, 'mspdi');
  eq('2b A: zes assen + Critical (24.000 tienden van een minuut = 2.400 min = 5 dagen van 8 u)', recordedOf(r, '1.1'), {
    start: '2026-03-02T08:00', finish: '2026-03-06T08:00', lateStart: '2026-03-09T08:00', lateFinish: '2026-03-13T08:00',
    totalFloat: 5, freeFloat: 0, isCritical: false,
  });
  eq('2c B: alleen het vroege paar', recordedOf(r, '1.2'), { start: '2026-03-16T08:00', finish: '2026-03-20T08:00' });
  eq('2d C: geen datums ⇒ geen vastlegging', recordedOf(r, '1.3'), undefined);
  eq('2e task.time ongewijzigd (lateStart = start, speling 0 — de bestaande vulling)', [byWbs(r, '1.1')?.time.lateStart, byWbs(r, '1.1')?.time.totalFloat], ['2026-03-02T08:00', 0]);
  const noEarly = MSPDI_FIXTURE.replace(/<EarlyStart>[^<]*<\/EarlyStart>\s*<EarlyFinish>[^<]*<\/EarlyFinish>/g, '');
  eq('2f zonder Early*: Start/Finish zijn de vastlegging', recordedOf(readMSPDI(noEarly), '1.2'), { start: '2026-03-16T08:00', finish: '2026-03-20T08:00' });
  const withSummary = MSPDI_FIXTURE
    .replace('<Summary>0</Summary>', '<Summary>1</Summary>')
    .replace(/(<Name>B<\/Name>[\s\S]*?)<OutlineLevel>1<\/OutlineLevel>/, '$1<OutlineLevel>2</OutlineLevel>');
  const rs = readMSPDI(withSummary);
  eq('2g tegenproef: A is nu de ouder van B', byWbs(rs, '1.1')?.childIds.length, 1);
  eq('2h de samenvatting krijgt geen eigen vastlegging, het blad wel',
    [recordedOf(rs, '1.1'), recordedOf(rs, '1.2')], [undefined, { start: '2026-03-16T08:00', finish: '2026-03-20T08:00' }]);
}

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
  let unreadableError: unknown;
  try { readCSV(CSV_FIXTURE_UNREADABLE_DATES); } catch (err) { unreadableError = err; }
  truthy('3g onleesbare datum ⇒ expliciete importweigering', unreadableError instanceof CsvDateImportError);
  eq('3h weigering noemt het eerste onleesbare veld',
    unreadableError instanceof CsvDateImportError
      ? [unreadableError.row, unreadableError.column, unreadableError.value] : undefined,
    [2, 'Start', 'Mon 3/2/26']);
  const r5 = readCSV(['WBS,Name,Duration,Start,Finish', '1.1,A,5,2026-02-31,2026-03-06', '1.2,B,5,02-03-2026,06/03/2026'].join('\n'));
  eq('3i een niet-bestaande datum (31 februari) is evenmin een vastlegging', recordedOf(r5, '1.1'), undefined);
  eq('3j DD-MM-YYYY en DD/MM/YYYY blijven herkend', recordedOf(r5, '1.2'), { start: '2026-03-02', finish: '2026-03-06' });
}

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
  const tampered = pristine.replace(
    "IFCPROPERTYSINGLEVALUE('UnchangedSinceImport',$,IFCBOOLEAN(.T.),$)",
    "IFCPROPERTYSINGLEVALUE('UnchangedSinceImport',$,IFCBOOLEAN(.F.),$)");
  truthy('4h0 de vervanging raakt de herkomstvlag', tampered !== pristine);
  eq('4h .F. leest als false', readIFC(tampered).importPristine, false);
  const noPsets = own.split('\n').filter(line => !line.includes("'OPS_")).join('\n');
  eq('4i IFCAPPLICATION "OPS" alleen is voldoende voor "eigen bestand"', readIFC(noPsets).recordedTimesOrigin, 'ifc-own');
  const noApp = own.split('\n').filter(line => !line.includes('IFCAPPLICATION(')).join('\n');
  eq('4j een OPS_-pset alleen is óók voldoende', readIFC(noApp).recordedTimesOrigin, 'ifc-own');
}

{
  const S = () => useAppStore.getState();
  const idOf = (wbs: string) => S().tasks.find(t => t.wbsCode === wbs)!.id;
  const meldingen = () => S().ui.notifications.filter(n =>
    n.messageKey === 'notifications.importDatesAsRecorded').length;
  S().newProject();
  S().applyOpenedImport(readMSPDI(MSPDI_FIXTURE), { filePath: null, recompute: true });
  eq('6a tegenproef: verse MSPDI-import staat in de modus, B mist vier assen',
    [S().datesAsRecorded, unrecordedAxes(S().recordedDates?.times[idOf('1.2')])], [true, ['ls', 'lf', 'tf', 'ff']]);
  const saved = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const reopened = readIFC(saved);
  const bReopened = reopened.tasks.find(t => t.wbsCode === '1.2')!.id;
  const aReopened = reopened.tasks.find(t => t.wbsCode === '1.1')!.id;
  eq('6b het opgeslagen bestand draagt voor B alleen de vroege slots en de invoerslots (geen late/speling/kritiek)',
    reopened.recordedFields?.[bReopened], ['earlyStart', 'earlyFinish', 'scheduleStart', 'scheduleFinish']);
  eq('6c …terwijl A (volledig vastgelegd) al zijn negen slots houdt', reopened.recordedFields?.[aReopened]?.length, 9);
  S().newProject();
  const voorHeropen = meldingen();
  S().applyOpenedImport(reopened, { filePath: null, recompute: true });
  eq('6d heropend (ongewijzigd, optie B): weer in de modus', [S().datesAsRecorded, S().recordedDates?.origin], [true, 'ifc-own']);
  eq('6e B houdt na heropenen vier assen "niet vastgelegd"', unrecordedAxes(S().recordedDates?.times[idOf('1.2')]), ['ls', 'lf', 'tf', 'ff']);
  eq('6f A houdt zijn vastgelegde late datums en speling', S().recordedDates?.times[idOf('1.1')], {
    start: '2026-03-02T08:00', finish: '2026-03-06T08:00', lateStart: '2026-03-09T08:00', lateFinish: '2026-03-13T08:00',
    totalFloat: 5, freeFloat: 0, isCritical: false,
  });
  eq('6g …en geeft GEEN openingsmelding (ook niet in de automatisch-aan-tak)', meldingen() - voorHeropen, 0);
  S().runCPM();
  const savedOutside = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  const bOutside = savedOutside.tasks.find(t => t.wbsCode === '1.2')!.id;
  eq('6h buiten de modus opgeslagen: alle negen slots (echte CPM-uitvoer)', savedOutside.recordedFields?.[bOutside]?.length, 9);
}

{
  const profiel = { severity: 'info' as const, messageKey: 'notifications.xerImportOpened' as const, params: { count: 1 } };
  eq('7a geen verse verschillen ⇒ melding ongewijzigd (ook undefined)', [withRecordedDatesNotice(undefined, 0), withRecordedDatesNotice(profiel, 0)], [undefined, profiel]);
  eq('7b geen melding ⇒ de regel wordt zelf de melding', withRecordedDatesNotice(undefined, 2), {
    severity: 'info', messageKey: 'notifications.importDatesAsRecorded', params: { count: 2 }, helpArticleId: 'uitleg-datums-zoals-opgeslagen',
  });
  eq('7c een andere melding ⇒ de regel hangt eronder als detailregel', withRecordedDatesNotice(profiel, 4)?.detailLines,
    [{ messageKey: 'notifications.importDatesAsRecorded', params: { count: 4 } }]);
  const xer = { ...profiel, detailLines: [{ messageKey: 'notifications.xerImportDatesAsRecorded' as const, params: { count: 2 } }] };
  eq('7d een melding met een eigen datumregel (XER) ⇒ geen tweede', withRecordedDatesNotice(xer, 2), xer);
}

{
  const S = () => useAppStore.getState();
  const meldingen = () => S().ui.notifications.filter(n =>
    n.messageKey === 'notifications.importDatesAsRecorded').length;
  S().newProject();
  const voorCsv = meldingen();
  S().applyOpenedImport(readCSV(CSV_FIXTURE), { filePath: null, recompute: true });
  eq('8a CSV (Start/Finish zijn invoer): geen vastlegging, geen modus', [S().recordedDates, S().datesAsRecorded], [null, false]);
  eq('8b …en geen openingsmelding', meldingen() - voorCsv, 0);
  truthy('8a2 tegenproef: B is wél verschoven door de herberekening (anders meet 8a een vacuüm)',
    S().tasks.find(t => t.wbsCode === '1.2')?.time.earlyStart !== '2026-03-16');

  S().newProject();
  S().applyOpenedImport(readMSPDI(MSPDI_FIXTURE), { filePath: null, recompute: true });
  S().setProject({ description: 'bewerkt, zonder datumwijziging' });
  const savedEdited = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  truthy('8c het opgeslagen bestand noemt zijn bron (SourceFormat mspdi)', savedEdited.includes("IFCPROPERTYSINGLEVALUE('SourceFormat',$,IFCLABEL('mspdi'),$)"));
  const reopenedEdited = readIFC(savedEdited);
  eq('8c2 …en dat leest terug', [reopenedEdited.recordedTimesOrigin, reopenedEdited.recordedSourceFormat, reopenedEdited.importPristine], ['ifc-own', 'mspdi', false]);
  S().newProject();
  S().applyOpenedImport(reopenedEdited, { filePath: null, recompute: true });
  eq('8d heropend eigen IFC met MSPDI-bron, bewerkt maar in de modus opgeslagen: vastlegging en modus',
    [S().recordedDates?.sourceFormat, S().datesAsRecorded], ['mspdi', true]);

  S().newProject();
  S().applyOpenedImport(readIFC(writeIFC({ ...readMSPDI(MSPDI_FIXTURE), recordedTimes: undefined, recordedTimesOrigin: undefined })), { filePath: null, recompute: true });
  const eigenZonderBron = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  truthy('8e0 het eigen bestand zonder bron draagt geen SourceFormat', !eigenZonderBron.includes("'SourceFormat'"));
  const bStart = S().tasks.find(t => t.wbsCode === '1.2')!.time.earlyStart;
  const verschoven = eigenZonderBron.replace(new RegExp(`'${bStart.slice(0, 10)}T`, 'g'), "'2026-03-23T");
  truthy('8e1 tegenproef: de fixture verschuift B echt in het bestand', verschoven !== eigenZonderBron);
  S().newProject();
  S().applyOpenedImport(readIFC(verschoven), { filePath: null, recompute: true });
  eq('8e eigen IFC zonder bron: geen vastlegging en geen modus', [S().recordedDates, S().datesAsRecorded], [null, false]);
}

{
  const S = () => useAppStore.getState();
  const wbsId = (r: ImportResult, wbs: string) => r.tasks.find(t => t.wbsCode === wbs)!.id;
  const bump = (wbs: string) => {
    const t = S().tasks.find(x => x.wbsCode === wbs)!;
    S().updateTask(t.id, { time: { ...t.time, scheduleDuration: 3 } });
  };

  S().newProject();
  S().applyOpenedImport(readMSPDI(MSPDI_FIXTURE), { filePath: null, recompute: true });
  eq('9a0 tegenproef: verse import legt 2 taken vast (A, B), C niet', S().recordedDates?.total, 2);
  const savedInMode = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  const re = readIFC(savedInMode);
  eq('9a C (geen vastlegging) wordt zonder rekenslots opgeslagen', re.recordedFields?.[wbsId(re, '1.3')], ['scheduleStart', 'scheduleFinish']);
  S().newProject();
  S().applyOpenedImport(re, { filePath: null, recompute: true });
  eq('9b N vastgelegd ⇒ N na heropenen (2, niet 3)', [S().recordedDates?.total, S().datesAsRecorded], [2, true]);

  const cSchedule = '2026-04-06';
  const sleepingParsed = readIFC(savedInMode);
  const cSleep = sleepingParsed.tasks.find(t => t.wbsCode === '1.3')!;
  cSleep.time.scheduleStart = cSchedule; cSleep.time.scheduleFinish = cSchedule;
  const sleeping = recoveryInputFromParsed(sleepingParsed, { id: 'rec-9-slaap', filePath: null, isDirty: true, datesAsRecorded: true });
  const active = recoveryInputFromParsed(readIFC(savedInMode), { id: 'rec-9-actief', filePath: null, isDirty: true, datesAsRecorded: true });
  S().newProject();
  S().restoreDocuments([sleeping, active], 'rec-9-actief');
  const slaap = S().documents.find(d => d.id === 'rec-9-slaap')?.payload;
  eq('9c crashherstel (slapend, in de modus): ook 2 vastgelegd', [slaap?.recordedDates?.total, slaap?.datesAsRecorded], [2, true]);
  eq('9c2 …en C staat op zijn eigen anker, niet op "vandaag"',
    slaap?.tasks.find(t => t.wbsCode === '1.3')?.time.earlyStart, `${cSchedule}T07:00`);
  eq('9c3 crashherstel (actief, in de modus): ook 2 vastgelegd', [S().recordedDates?.total, S().datesAsRecorded], [2, true]);

  const summaryTask = `<Task><UID>9</UID><ID>9</ID><Name>S</Name><Duration>PT120H0M0S</Duration><DurationFormat>7</DurationFormat>
      <Start>2026-03-02T08:00:00</Start><Finish>2026-03-20T08:00:00</Finish>
      <EarlyStart>2026-03-02T08:00:00</EarlyStart><EarlyFinish>2026-03-20T08:00:00</EarlyFinish>
      <WBS>1</WBS><OutlineLevel>1</OutlineLevel><Summary>1</Summary><Milestone>0</Milestone>
      <PercentComplete>0</PercentComplete><Priority>500</Priority><CalendarUID>1</CalendarUID></Task>
    `;
  const withSummary = MSPDI_FIXTURE
    .replace('<Tasks>\n    <Task>', `<Tasks>\n    ${summaryTask}<Task>`)
    .replace(/(<Name>A<\/Name>[\s\S]*?)<OutlineLevel>1<\/OutlineLevel>/, '$1<OutlineLevel>2</OutlineLevel>')
    .replace(/(<Name>B<\/Name>[\s\S]*?)<OutlineLevel>1<\/OutlineLevel>/, '$1<OutlineLevel>2</OutlineLevel>');
  truthy('9d00 fixture: de fase is ingevoegd', withSummary.includes('<Name>S</Name>'));
  S().newProject();
  S().applyOpenedImport(readMSPDI(withSummary), { filePath: null, recompute: true });
  eq('9d0 voorwaarde: met samenvatting in de modus, alleen de bladen vastgelegd', [S().datesAsRecorded, S().recordedDates?.total], [true, 2]);
  const savedSummary = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  eq('9d0b de samenvatting (geen eigen vastlegging) wordt zonder rekenslots opgeslagen',
    savedSummary.recordedFields?.[savedSummary.tasks.find(t => t.name === 'S')!.id], ['scheduleStart', 'scheduleFinish']);
  S().newProject();
  S().applyOpenedImport(savedSummary, { filePath: null, recompute: true });
  eq('9d met samenvatting: 2 vastgelegd ⇒ 2 na heropenen (de fase telt niet mee)', [S().recordedDates?.total, S().datesAsRecorded], [2, true]);

  S().newProject();
  S().applyOpenedImport(readMSPDI(MSPDI_FIXTURE), { filePath: null, recompute: true });
  S().setProject({ description: 'bewerkt, zonder datumwijziging' });
  const bewerkt = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  S().newProject();
  S().applyOpenedImport(bewerkt, { filePath: null, recompute: true });
  eq('9e0 voorwaarde: heropend in de modus (in de modus opgeslagen)', [S().recordedDates !== null, S().datesAsRecorded], [true, true]);
  bump('1.1');
  eq('9e1 voorwaarde: buiten de modus, planning verouderd', [S().recordedDates, S().datesAsRecorded, S().scheduleStale], [null, false, true]);
  const aanbodOpslag = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
  truthy('9e opslaan buiten de modus schrijft GEEN SourceFormat', !aanbodOpslag.includes("'SourceFormat'"));
  S().newProject();
  S().applyOpenedImport(readIFC(aanbodOpslag), { filePath: null, recompute: true });
  eq('9f heropenen van die opslag: geen vastlegging, geen modus', [S().recordedDates, S().datesAsRecorded], [null, false]);

  S().newProject();
  S().applyOpenedImport(readMSPDI(MSPDI_FIXTURE), { filePath: null, recompute: true });
  bump('1.1');
  eq('9g0 voorwaarde: de datumbewerking verliet de modus en wiste de vastlegging', [S().datesAsRecorded, S().recordedDates], [false, null]);
  truthy('9g na een datumbewerking schrijft opslaan geen SourceFormat', !writeIFC(buildWriteIFCInput(S(), 'planOnly')).includes("'SourceFormat'"));
  S().newProject();
  S().applyOpenedImport(readMSPDI(MSPDI_FIXTURE), { filePath: null, recompute: true });
  S().runCPM();
  truthy('9h na F5 in de modus schrijft opslaan geen SourceFormat', !writeIFC(buildWriteIFCInput(S(), 'planOnly')).includes("'SourceFormat'"));
}

{
  const props = (v: number) => ({ getInt: (key: number) => (key === 37748756 ? v : 0) });
  eq('5-0a grens 3 dagen wordt gelezen', criticalSlackLimitDaysOf(props(3)), 3);
  eq('5-0b ontbrekend (Props geeft 0) ⇒ 0, de MSP-default', criticalSlackLimitDaysOf(props(0)), 0);
  eq('5-0c een onzinnige waarde (1e9 dagen) valt terug op 0', criticalSlackLimitDaysOf(props(1_000_000_000)), 0);
  eq('5-0d gestart: de finish slack, niet het minimum', mppTotalSlackTenths(true, 0, 4800), 4800);
  eq('5-0e gestart zónder finish slack maar mét start slack: geen speling (zoals MPXJ)', mppTotalSlackTenths(true, 0, null), null);
  eq('5-0f niet gestart: het minimum', mppTotalSlackTenths(false, 2400, 4800), 2400);
  eq('5-0g niet gestart, één as ontbreekt: geen speling (MPXJ calculateTotalSlack geeft dan null)', [mppTotalSlackTenths(false, null, 4800), mppTotalSlackTenths(false, 2400, null)], [null, null]);
}

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
    let completedRecorded = 0, completedCritical = 0;
    let summariesRecorded = 0, leavesTotal = 0;
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
          if (t.childIds.length > 0) { if (rec) summariesRecorded++; continue; }
          leavesTotal++;
          if (!rec) continue;
          tasksRecorded++;
          if (rec.lateStart !== undefined && rec.lateFinish !== undefined) lateAxes++;
          if (rec.totalFloat !== undefined) floatAxes++;
          if (rec.finish < rec.start) inverted++;
          if (t.time.actualFinish || t.time.completion >= 1) {
            completedRecorded++;
            if (rec.isCritical === true) completedCritical++;
          }
          if (t.status === 'NOT_STARTED' && rec.start !== t.time.scheduleStart) mismatchedStart++;
        }
      }
    }
    console.log(`.   recorded-times-formats .mpp: ${files.length} bestanden, ${readable} leesbaar, ${withRecorded} met vastlegging, taken ${tasksRecorded}/${tasksTotal} vastgelegd (bladtaken ${leavesTotal}, samenvattingen met vastlegging ${summariesRecorded}), late-assen ${lateAxes}, speling ${floatAxes}, start≠scheduleStart(NOT_STARTED) ${mismatchedStart}, finish<start ${inverted}, voltooid-en-kritiek ${completedCritical}/${completedRecorded}`);
    truthy('5b minstens één leesbaar crawl-bestand draagt een vastlegging', withRecorded > 0);
    truthy('5c de vastgelegde vroege start valt voor niet-gestarte taken samen met MSP\'s geplande start (veldkaart-offset EARLY_START bewezen)', mismatchedStart === 0);
    truthy('5d geen enkele vastlegging eindigt vóór haar start', inverted === 0);
    truthy(`5h geen samenvatting draagt een eigen vastlegging (${summariesRecorded})`, summariesRecorded === 0);
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
