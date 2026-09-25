import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readXerCalendars,
  type XerCalendarReadResult,
} from '@/services/xer/xerCalendarData';
import { parseXerTables, type XerTables } from '@/services/xer/xerTables';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

interface CorpusManifest {
  files: Record<string, { sha256: string }>;
}

interface CalendarBaseline {
  version: number;
  key: string;
  pins: Record<string, string[]>;
  issueTotals?: Record<string, number>;
  dossier?: {
    hash: string;
    calendars: number;
    dayHourFieldsPresent: number;
    semanticDigest: string;
  };
}

interface CorpusCalendarResult {
  tables: XerTables;
  result: XerCalendarReadResult;
}

function semanticDigest(result: XerCalendarReadResult): string {
  const semantics = result.calendars.map(calendar => ({
    id: calendar.id,
    workDays: calendar.workDays,
    workTime: calendar.workTime?.byWeekday,
    hoursPerDay: calendar.hoursPerDay,
    hoursPerWeek: calendar.hoursPerWeek,
    hoursPerMonth: calendar.hoursPerMonth,
    hoursPerYear: calendar.hoursPerYear,
    holidays: calendar.holidays,
    workingExceptions: calendar.workingExceptions ?? [],
    calendarType: calendar.calendarType,
    rawCalendarType: calendar.rawCalendarType,
    baseCalendarId: calendar.baseCalendarId,
    hourModeSource: calendar.hourModeSource,
  }));
  return createHash('sha256').update(JSON.stringify(semantics), 'utf8').digest('hex');
}

function idsForResolution(
  result: XerCalendarReadResult,
  resolution: 'RECOVERED' | 'REJECTED',
): string[] {
  return Array.from(new Set(
    result.issues
      .filter(issue => issue.resolution === resolution)
      .map(issue => issue.calendarId),
  ));
}

function structurallyRecoveredIds(result: XerCalendarReadResult): string[] {
  return Array.from(new Set(
    result.issues
      .filter(issue => issue.code === 'XER_CALENDAR_COMPACT_RECORD_RECOVERED'
        || issue.code === 'XER_CALENDAR_SURPLUS_CLOSE_RECOVERED')
      .map(issue => issue.calendarId),
  ));
}

const corpusRoot = process.env.OPS_XER_CORPUS;
if (!corpusRoot) {
  console.log('OK  xer-calendar-corpus: openbare bron niet ingesteld — corpuspins overgeslagen');
  process.exit(0);
}
if (!existsSync(corpusRoot)) {
  console.log('XX  xer-calendar-corpus: OPS_XER_CORPUS wijst niet naar een bestaande map');
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, 'xer-corpus-manifest.json'), 'utf8'),
) as CorpusManifest;
const baseline = JSON.parse(
  readFileSync(join(import.meta.dirname, 'xer-calendar-hour-mode-baseline.json'), 'utf8'),
) as CalendarBaseline;
const byHash = new Map<string, CorpusCalendarResult>();
const observed: Record<string, {
  calendarRows: number;
  retainedRows: number;
  recoveredRows: number;
  rejectedRows: number;
  sharedRules: number;
  withXerClockRule: number;
}> = {};

for (const [relativePath, entry] of Object.entries(manifest.files)) {
  if (byHash.has(entry.sha256) || Object.prototype.hasOwnProperty.call(observed, entry.sha256)) continue;
  let tables: XerTables;
  try {
    tables = parseXerTables(new Uint8Array(readFileSync(join(corpusRoot, relativePath))));
  } catch {
    continue;
  }
  const calendarRows = tables.tables.get('CALENDAR')?.rows.length ?? 0;
  if (calendarRows === 0) continue;
  const result = readXerCalendars(tables);
  byHash.set(entry.sha256, { tables, result });
  observed[entry.sha256] = {
    calendarRows,
    retainedRows: result.calendars.length,
    recoveredRows: structurallyRecoveredIds(result).length,
    rejectedRows: idsForResolution(result, 'REJECTED').length,
    ...result.promotion,
  };
}

const groupedPins: Record<string, string[]> = {};
for (const [hash, pin] of Object.entries(observed)) {
  const key = [
    pin.calendarRows,
    pin.retainedRows,
    pin.recoveredRows,
    pin.rejectedRows,
    pin.sharedRules,
    pin.withXerClockRule,
  ].join('/');
  (groupedPins[key] ??= []).push(hash);
}
for (const hashes of Object.values(groupedPins)) hashes.sort();
eq('1 productie-ingang pint per hash behoud, herstel, weigering en uurmodusdelta',
  groupedPins, baseline.pins);
const issueTotals: Record<string, number> = {};
for (const corpus of byHash.values()) {
  for (const issue of corpus.result.issues) {
    issueTotals[issue.code] = (issueTotals[issue.code] ?? 0) + 1;
  }
}
eq('1a issuecontract is corpusbreed per code gepind', issueTotals,
  baseline.issueTotals ?? { baselineMissing: 1 });

const recoveryPins: Record<string, {
  retainedIds: string[];
  recoveredIds: string[];
  rejectedIds: string[];
  issueCodes: string[];
}> = {
  '2a7732b5b99de2a5f40aab40e0af52757fbe68e5d4eda404a9a060fdc1be1140': {
    retainedIds: ['CAL-01', 'CAL-02', 'CAL-03', 'CAL-04', 'CAL-05', 'CAL-06',
      'RCAL-CRANE600', 'RCAL-SPECIALIST'],
    recoveredIds: ['CAL-01', 'CAL-02', 'CAL-03', 'CAL-04', 'CAL-05', 'CAL-06',
      'RCAL-CRANE600', 'RCAL-SPECIALIST'],
    rejectedIds: [],
    issueCodes: Array(8).fill('XER_CALENDAR_COMPACT_RECORD_RECOVERED'),
  },
  '0611f9054a4b566340dd53181b96d66907f4ac8faa0ef1395ec338be9f83b96d': {
    retainedIds: ['1001', '1002', '1003'],
    recoveredIds: ['1001', '1002', '1003'],
    rejectedIds: [],
    issueCodes: Array(3).fill('XER_CALENDAR_SURPLUS_CLOSE_RECOVERED'),
  },
  '816e01738f4967872980ce3fed0c2bfd8c09f78197b7de1beea5ca98e094aeae': {
    retainedIds: ['1001', '1002', '1003'],
    recoveredIds: ['1001', '1002', '1003'],
    rejectedIds: [],
    issueCodes: Array(3).fill('XER_CALENDAR_SURPLUS_CLOSE_RECOVERED'),
  },
  '85f8c7d681b15daf755ba1d568eb09ebcdd529a16c20045e6db6c2937899f54b': {
    retainedIds: ['178', '179'],
    recoveredIds: [],
    rejectedIds: ['180'],
    issueCodes: ['XER_CALENDAR_INVALID_STRUCTURE'],
  },
};

for (const [hash, expected] of Object.entries(recoveryPins)) {
  const result = byHash.get(hash)?.result;
  eq(`2 herstel-/weigerpin ${hash}`, result ? {
    retainedIds: result.calendars.map(calendar => calendar.id),
    recoveredIds: idsForResolution(result, 'RECOVERED'),
    rejectedIds: idsForResolution(result, 'REJECTED'),
    issueCodes: result.issues.map(issue => issue.code),
  } : { hashFound: false }, expected);
}

const danglingHash = '9590c4cdc4efa69a231b66ac509611d17f31605599ee7abde02a197f5e8b1e6e';
const dangling = byHash.get(danglingHash)?.result;
eq('3 openbare dangling base blijft rauw zichtbaar en expliciet ongekoppeld', dangling ? {
  calendarId: dangling.calendars.find(calendar => calendar.id === '1')?.id,
  baseCalendarId: dangling.calendars.find(calendar => calendar.id === '1')?.baseCalendarId,
  linkedBase: dangling.calendars.find(calendar => calendar.id === '1')?.baseCalendar?.id,
  issues: dangling.issues.map(issue => ({
    calendarId: issue.calendarId,
    line: issue.line,
    code: issue.code,
    resolution: issue.resolution,
  })),
} : { hashFound: false }, {
  calendarId: '1',
  baseCalendarId: '0',
  issues: [{
    calendarId: '1',
    line: 154,
    code: 'XER_CALENDAR_DANGLING_BASE',
    resolution: 'UNLINKED',
  }],
});

const dossierHash = '2c1dce175b9f078111a48dc13fd1777f5fbd4cd7ab6623e647e7437330c60b7f';
const dossier = byHash.get(dossierHash);
eq('4 statische 124-dossierdigest bewaakt dagmapping, alle banden, exceptions en periodeafleiding',
  dossier ? {
    hash: dossierHash,
    calendars: dossier.result.calendars.length,
    dayHourFieldsPresent: dossier.tables.tables.get('CALENDAR')?.fields.includes('day_hr_cnt')
      ? dossier.result.calendars.length
      : 0,
    semanticDigest: semanticDigest(dossier.result),
  } : { hashFound: false }, baseline.dossier ?? { baselineMissing: true });

if (diffs.length === 0) {
  console.log(`OK  xer-calendar-corpus: ${checks} checks groen`);
  process.exit(0);
}

console.log(`XX  xer-calendar-corpus: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
