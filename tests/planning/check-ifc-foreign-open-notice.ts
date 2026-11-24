import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { OPEN_NOTICE_CASES, openingText, runOpenNoticeCase, type OpenNoticeReference, type RecordedNotice } from './ifcOpenNoticeMatrix';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');
installBrowserStubs();
installDeterminism();

const { parseOpenedFile, readFormatInput } = await import('@/services/formatRegistry');
const { isMultiDocumentImport } = await import('@/services/importTypes');
const { ifcForeignContentEnabled } = await import('@/utils/featureFlags');
const { scanStep } = await import('@/services/ifc/foreign/stepScanner');
const { classify } = await import('@/services/ifc/foreign/classify');
const { formatReportNumber } = await import('@/utils/reportNumber');
const { withIfcForeignOpenNotice } = await import('@/state/ifcForeignOpenNotice');
const { STICKY_OPEN_NOTICE_KEYS, withOpenNoticeSticky } = await import('@/state/openNoticeSticky');
const { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
type ImportResult = import('@/services/importTypes').ImportResult;
type NotifyInput = import('@/state/slices/types').NotifyInput;

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}\n     kreeg:    ${g}\n     verwacht: ${w}`);
};

const io = {
  readTextFile: async (path: string) => readFileSync(path, 'utf8'),
  readFile: async (path: string) => new Uint8Array(readFileSync(path)),
};

async function open(file: string, flagOn: boolean): Promise<ImportResult[]> {
  const opts = { ifcBytes: ifcForeignContentEnabled(flagOn ? { ifcForeignContent: true } : {}) };
  const input = await readFormatInput(join(FOREIGN, file), io, opts);
  const parsed = await parseOpenedFile(input, {}, opts);
  return isMultiDocumentImport(parsed) ? parsed.results : [parsed];
}

const openNotice = (results: readonly ImportResult[], base?: NotifyInput) => withOpenNoticeSticky(withIfcForeignOpenNotice(base, results));

const shape = (notice: NotifyInput | undefined) => notice && {
  messageKey: notice.messageKey,
  params: notice.params,
  numberParams: notice.numberParams,
  sticky: notice.sticky === true,
  lines: (notice.detailLines ?? []).map(line => [line.messageKey, line.params ?? null, line.numberParams ?? null]),
};

const lineKeysOf = (notice: NotifyInput | undefined) => (notice?.detailLines ?? []).map(line => line.messageKey);

const independentCount = (file: string) => {
  const counts = classify(scanStep(new Uint8Array(readFileSync(join(FOREIGN, file))))).counts;
  return counts.C + counts.A + counts.V;
};

const WITH_MODEL = 'notifications.ifcForeignOpenedWithModel';
const OTHER_DATA = 'notifications.ifcForeignOpenedOtherData';
const WORK_PLANS = 'notifications.ifcForeignWorkPlansMerged';

{
  const results = await open('bonsai-4d.ifc', true);
  const count = independentCount('bonsai-4d.ifc');
  eq('bonsai-4d (model, één werkplan): telmelding met het aantal niet-P-objecten van de indeling, verder geen regel, verdwijnt na 5 s',
    shape(openNotice(results)),
    { messageKey: WITH_MODEL, params: { count }, numberParams: { objects: count }, sticky: false, lines: [] });
  eq('bonsai-4d: het aantal is niet nul', count > 0, true);
}

{
  const results = await open('twee-werkplannen.ifc', true);
  const count = independentCount('twee-werkplannen.ifc');
  eq('twee-werkplannen: de lezer zet de taken van het tweede werkplan in dezelfde planning',
    results[0].tasks.map(task => task.name), ['Ruwbouw', 'Wand A bouwen', 'Wand B bouwen', 'Inspectie']);
  const baselineOnly = readFileSync(join(FOREIGN, 'twee-werkplannen.ifc'), 'utf8')
    .replace("'Onderhoud',$,$,$,'2026-01-01T12:00:00',(#1),$,$,$,'2026-02-02T08:00:00',$,.NOTDEFINED.)",
      "'Onderhoud',$,$,$,'2026-01-01T12:00:00',(#1),$,$,$,'2026-02-02T08:00:00',$,.BASELINE.)");
  const baselineParsed = await parseOpenedFile({ name: 'twee-werkplannen-baseline.ifc', bytes: new TextEncoder().encode(baselineOnly) }, {}, { ifcBytes: true });
  const baselineResults = isMultiDocumentImport(baselineParsed) ? baselineParsed.results : [baselineParsed];
  eq('tweede werkplan met alleen een baseline: de baselinetaak komt niet in de planning, de werkplanregel staat er wel',
    [baselineOnly.includes("'Onderhoud',$,$,$,'2026-01-01T12:00:00',(#1),$,$,$,'2026-02-02T08:00:00',$,.BASELINE.)"),
      baselineResults[0].tasks.map(task => task.name), lineKeysOf(openNotice(baselineResults))],
    [true, ['Ruwbouw', 'Wand A bouwen', 'Wand B bouwen'], [WORK_PLANS]]);
  eq('twee-werkplannen: telmelding met de regel over de werkplannen, en die blijft staan',
    shape(openNotice(results)),
    { messageKey: WITH_MODEL, params: { count }, numberParams: { objects: count }, sticky: true, lines: [[WORK_PLANS, null, { plans: 2 }]] });

  const base: NotifyInput = { severity: 'info', messageKey: 'notifications.importDatesAsRecorded', params: { count: 3 } };
  eq('twee-werkplannen met een bestaande openingsmelding: de regels komen eronder, de kop blijft',
    shape(openNotice(results, base)),
    { messageKey: 'notifications.importDatesAsRecorded', params: { count: 3 }, sticky: true,
      lines: [[WITH_MODEL, { count }, { objects: count }], [WORK_PLANS, null, { plans: 2 }]] });
}

{
  const results = await open('council/r5-prop.ifc', true);
  eq('r5-prop (alleen een eigenschap van een ander programma, geen model): de tekst zonder gebouwmodel, één object',
    shape(openNotice(results)),
    { messageKey: OTHER_DATA, params: { count: 1 }, numberParams: { objects: 1 }, sticky: false, lines: [] });
}

{
  const results = await open('eigen-plus-model.ifc', true);
  const count = independentCount('eigen-plus-model.ifc');
  eq('eigen-plus-model: alleen de telmelding, die verdwijnt na 5 s',
    shape(openNotice(results)),
    { messageKey: WITH_MODEL, params: { count }, numberParams: { objects: count }, sticky: false, lines: [] });
}

{
  const results = await open('council/fix2-data-in-kop.ifc', true);
  eq('fix2-data-in-kop: de bytes-route gaf een bron zonder vreemd deel', [!!results[0].ifcSource, results[0].ifcSource?.foreign], [true, false]);
  eq('fix2-data-in-kop: geen melding', openNotice(results), undefined);
  const base: NotifyInput = { severity: 'info', messageKey: 'notifications.importDatesAsRecorded', params: { count: 3 } };
  eq('fix2-data-in-kop: een bestaande melding blijft hetzelfde object', withIfcForeignOpenNotice(base, results) === base, true);
}

{
  const results = await open('council/r5-prop.ifc', false);
  eq('flag uit, r5-prop: de gewone lezer, zonder bron en zonder overnameverslag (geen scan)',
    results.map(r => [r.ifcSource ?? null, r.ifcWorkPlanCount ?? null]), [[null, null]]);
  eq('flag uit, r5-prop: geen melding', openNotice(results), undefined);
  const refused = await open('bonsai-4d.ifc', false).then(() => 'geopend', (e: unknown) => (e as Error).message);
  eq('flag uit, bonsai-4d: openen weigert zoals op main, dus ook geen melding', refused.startsWith('This IFC file contains building model objects'), true);
}

eq('de regel over de werkplannen blijft staan; de telmeldingen niet',
  [STICKY_OPEN_NOTICE_KEYS.has(WORK_PLANS), STICKY_OPEN_NOTICE_KEYS.has(WITH_MODEL), STICKY_OPEN_NOTICE_KEYS.has(OTHER_DATA)], [true, false, false]);

for (const [lng, common] of [['nl', nlCommon], ['en', enCommon]] as const) {
  const inst = i18next.createInstance();
  await inst.init({ lng, fallbackLng: false, resources: { [lng]: { common } }, ns: ['common'], defaultNS: 'common', interpolation: { escapeValue: false } });
  const text = (key: string, count: number) => inst.t(key, { count, objects: formatReportNumber(count, lng) });
  eq(`${lng}: enkelvoud en meervoud van de telmelding`,
    [text(OTHER_DATA, 1).includes(lng === 'nl' ? '(1 onderdeel)' : '(1 item)'), text(WITH_MODEL, 12345).includes(lng === 'nl' ? '(12345 onderdelen)' : '(12345 items)')],
    [true, true]);
  eq(`${lng}: de teltekst zegt wat buiten de planning bewaard blijft, niet wie het maakte`,
    [WITH_MODEL, OTHER_DATA].map(key => [text(key, 2).includes(lng === 'nl' ? 'buiten de planning' : 'outside the schedule'), /andere programma|other program/.test(text(key, 2))]),
    [[true, false], [true, false]]);
  eq(`${lng}: de werkplanregel toont het aantal`, inst.t(WORK_PLANS, { plans: formatReportNumber(2, lng) }).includes('2'), true);
}

const enc = new TextEncoder();
const sortedKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(sortedKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortedKeys(v)]))
    : value;
const visible = (notices: readonly RecordedNotice[]) =>
  sortedKeys(notices.map(notice => ({ ...notice, detailLines: notice.detailLines ?? [], sticky: notice.sticky === true })));
const OPEN_NOTICE_HEADS: ReadonlySet<string> = new Set([
  'notifications.ifcForeignOpenLarge', 'notifications.taskTypesUnlocked', 'notifications.xerArchiveUnusable',
  'notifications.importDatesAsRecorded', 'notifications.schedulingProfileApplied',
]);
const ifcLinesOf = (text: string): RecordedNotice[] => {
  const scan = scanForeign(enc.encode(text));
  if (!scan.ok) throw new Error('scan geweigerd');
  const objects = scan.counts.C + scan.counts.A + scan.counts.V;
  if (objects === 0) return [];
  const lines: RecordedNotice[] = [{ messageKey: text.includes('IFCWALL(') ? WITH_MODEL : OTHER_DATA, params: { count: objects }, numberParams: { objects } }];
  const plans = text.match(/=IFCWORKPLAN\(/g)?.length ?? 0;
  if (plans > 1) lines.push({ messageKey: WORK_PLANS, numberParams: { plans } });
  return lines;
};
const withLines = (notice: RecordedNotice, lines: readonly RecordedNotice[]): RecordedNotice => ({
  ...notice,
  detailLines: [...((notice.detailLines as RecordedNotice[] | undefined) ?? []), ...lines],
  sticky: notice.sticky === true || lines.some(line => line.messageKey === WORK_PLANS),
});
const countNotice = (lines: readonly RecordedNotice[]): RecordedNotice => ({
  severity: 'info', ...lines[0], detailLines: lines.slice(1), count: 1, sticky: lines.some(line => line.messageKey === WORK_PLANS),
});
const singleOpening = (main: readonly RecordedNotice[], lines: readonly RecordedNotice[]): RecordedNotice[] => {
  if (lines.length === 0) return [...main];
  const own = main.map(notice => OPEN_NOTICE_HEADS.has(String(notice.messageKey))).lastIndexOf(true);
  return own < 0 ? [...main, countNotice(lines)] : main.map((notice, index) => index === own ? withLines(notice, lines) : notice);
};
const SEQUENCES: Readonly<Record<string, (main: RecordedNotice[][], lines: RecordedNotice[][]) => RecordedNotice[][]>> = {
  'reeks: groot met taaktypen, dan klein met taaktypen': (m, l) => [[withLines(m[0][0], l[0])], [withLines(m[1][0], l[0]), m[1][1]]],
  'reeks: klein, dan groot': (m, l) => [[countNotice(l[0])], [countNotice(l[0]), withLines(m[1][0], l[1])]],
  'reeks: twee keer groot': (m, l) => [[withLines(m[0][0], l[0])], [withLines(m[1][0], l[0]), withLines(m[1][1], l[1])]],
  'reeks: twee werkplannen met taaktypen, dan een eigen planning met taaktypen': (m, l) => [[withLines(m[0][0], l[0])], [m[1][0]]],
  'reeks: taaktypen en model, dezelfde soort met een ander aantal, dan een eigen planning':
    (m, l) => [[withLines(m[0][0], l[0])], [withLines(m[1][0], l[1])], [m[2][0]]],
};
{
  const reference = JSON.parse(readFileSync(join(ROOT, 'tests/planning/fixtures/open-notice-main.json'), 'utf8')) as OpenNoticeReference;
  eq('de verwachting komt van de code van main 5b3c1756e (scripts/proef/maak-open-notice-main.mjs)', reference.basis, '5b3c1756e7f1a0ec1127b8381b22b60e9341d459');
  eq('de verwachting heeft precies de gevallen van de matrix', Object.keys(reference.cases), OPEN_NOTICE_CASES.map(c => c.name));
  for (const matrixCase of OPEN_NOTICE_CASES) {
    const main = reference.cases[matrixCase.name];
    if (!main) continue;
    const lines = matrixCase.openings.map(opening => ifcLinesOf(openingText(ROOT, opening)));
    const expected = SEQUENCES[matrixCase.name]?.(main, lines) ?? [singleOpening(main[0], lines[0])];
    const got = await runOpenNoticeCase(ROOT, matrixCase);
    eq(`${matrixCase.name}: wat main toont, met alleen de telregel${lines.some(l => l.length > 1) ? ' en de werkplanregel' : ''} onderaan erbij`,
      got.map(visible), expected.map(visible));
  }
  eq('de reeks met eerst een groot bestand: na de tweede opening staat de opslagwaarschuwing nog voorop',
    reference.cases['reeks: groot met taaktypen, dan klein met taaktypen'][1].map(n => n.messageKey),
    ['notifications.ifcForeignOpenLarge', 'notifications.taskTypesUnlocked']);
  const complex = scanForeign(enc.encode(openingText(ROOT, { file: 'public/examples/showcase-verbouwing-eengezinswoning.ifc', complexUnit: true })));
  eq('de complexe eenheid: de scan houdt haar voor een mogelijk model, maar zeker is dat niet',
    complex.ok && [complex.buildingModel, complex.buildingModelUncertain], [true, true]);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`check-ifc-foreign-open-notice: ${diffs.length} van ${checks} ROOD`);
  process.exit(1);
}
console.log(`check-ifc-foreign-open-notice: ${checks} controles groen`);
