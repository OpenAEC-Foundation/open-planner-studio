import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';

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
    results.map(r => [r.ifcSource ?? null, r.ifcPlanningTakeover ?? null]), [[null, null]]);
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
    [text(OTHER_DATA, 1).includes('(1 object)'), text(WITH_MODEL, 12345).includes(lng === 'nl' ? '(12345 objecten)' : '(12345 objects)')],
    [true, true]);
  eq(`${lng}: de werkplanregel toont het aantal`, inst.t(WORK_PLANS, { plans: formatReportNumber(2, lng) }).includes('2'), true);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`check-ifc-foreign-open-notice: ${diffs.length} van ${checks} ROOD`);
  process.exit(1);
}
console.log(`check-ifc-foreign-open-notice: ${checks} controles groen`);
