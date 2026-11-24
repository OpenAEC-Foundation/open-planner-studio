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
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { openedFileNotice } = await import('@/state/ifcForeignOpenNotice');
const { withXerArchiveIssueNotice } = await import('@/state/xerArchiveIssueNotice');
const { withSchedulingProfileNotice } = await import('@/state/schedulingProfileNotice');
const { withRecordedDatesNotice } = await import('@/state/slices/fileSlice');
const { withLargeForeignOpenNotice } = await import('@/state/largeForeignOpenNotice');
const { lowerForeignOpenWarnBytesForTests } = await import('@/services/ifc/foreignOpenSize');
const { __resetTaskTypesNoticeForTests } = await import('@/state/taskTypesNotice');
const { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
type ImportResult = import('@/services/importTypes').ImportResult;
type NotifyInput = import('@/state/slices/types').NotifyInput;
type NotificationDetailLine = import('@/state/slices/types').NotificationDetailLine;

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
    [text(OTHER_DATA, 1).includes('(1 object)'), text(WITH_MODEL, 12345).includes(lng === 'nl' ? '(12345 objecten)' : '(12345 objects)')],
    [true, true]);
  eq(`${lng}: de werkplanregel toont het aantal`, inst.t(WORK_PLANS, { plans: formatReportNumber(2, lng) }).includes('2'), true);
}

const TASK_TYPES_HEAD = { dedupeKey: 'task-types-unlocked', helpArticleId: 'howto-werkregel-kiezen', messageKey: 'notifications.taskTypesUnlocked', severity: 'info' };
const withDefaultWorkRule = (text: string) => {
  const out = text
    .replace("#182=IFCPROPERTYSINGLEVALUE('IfcSchemaConfirmed',$,IFCBOOLEAN(.T.),$);",
      "#182=IFCPROPERTYSINGLEVALUE('IfcSchemaConfirmed',$,IFCBOOLEAN(.T.),$);\n#99101=IFCPROPERTYSINGLEVALUE('DefaultWorkRule',$,IFCLABEL('FIXED_WORK'),$);")
    .replace("'OPS_ProjectSettings',$,(#175,#176,#177,#178,#179,#180,#181,#182));", "'OPS_ProjectSettings',$,(#175,#176,#177,#178,#179,#180,#181,#182,#99101));");
  if (out.split('#99101').length !== 3) throw new Error('projectstandaard niet ingevoegd');
  return out;
};
const withForeignPset = (text: string) => text.replace(/ENDSEC;\s*END-ISO-10303-21;\s*$/,
  "#99102=IFCPROPERTYSINGLEVALUE('ExternKenmerk',$,IFCLABEL('blijft'),$);\n#99103=IFCPROPERTYSET('0123456789012345678901',$,'ExternPakket',$,(#99102));\nENDSEC;\nEND-ISO-10303-21;\n");
const enc = new TextEncoder();
const objectsOf = (bytes: Uint8Array) => { const scan = scanForeign(bytes); return scan.ok ? scan.counts.C + scan.counts.A + scan.counts.V : -1; };
const sortedKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(sortedKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortedKeys(v)]))
    : value;
const storeNotices = (store: ReturnType<typeof createAppStoreContext>['store']) =>
  sortedKeys(store.getState().ui.notifications.map(({ id: _id, ...rest }) => JSON.parse(JSON.stringify(rest)) as unknown));
const countLine = (objects: number) => ({ messageKey: WITH_MODEL, params: { count: objects }, numberParams: { objects } });
{
  __resetTaskTypesNoticeForTests();
  const store = createAppStoreContext().store;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; s.ui.showTaskTypes = false; });
  const first = enc.encode(withDefaultWorkRule(readFileSync(join(FOREIGN, 'eigen-plus-model.ifc'), 'utf8')));
  await store.getState().openOpenedFile({ name: 'met-werkregel.ifc', content: '', bytes: first, ref: null }, {});
  eq('taaktypen en model: de projectstandaard is gelezen en de taaktypen zijn ontsloten',
    [store.getState().project.defaultWorkRule, store.getState().taskTypesVisible], ['FIXED_WORK', true]);
  eq('taaktypen en model: de kop, ernst, gidslink en deduplicatie van de taaktypemelding zoals main, de telregel eronder',
    storeNotices(store), sortedKeys([{ ...TASK_TYPES_HEAD, count: 1, detailLines: [countLine(objectsOf(first))] }]));

  const second = enc.encode(withForeignPset(withDefaultWorkRule(readFileSync(join(FOREIGN, 'eigen-plus-model.ifc'), 'utf8'))));
  eq('tweede bestand van dezelfde soort: een ander aantal', objectsOf(second) !== objectsOf(first) && objectsOf(second) > 0, true);
  await store.getState().openOpenedFile({ name: 'met-werkregel-en-pset.ifc', content: '', bytes: second, ref: null }, {});
  eq('tweede opening van dezelfde soort: één melding, de deduplicatie telt, alleen de telregel van de tweede opening',
    storeNotices(store), sortedKeys([{ ...TASK_TYPES_HEAD, count: 2, detailLines: [countLine(objectsOf(second))] }]));

  const own = enc.encode(withDefaultWorkRule(readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8')));
  await store.getState().openOpenedFile({ name: 'eigen-met-werkregel.ifc', content: '', bytes: own, ref: null }, {});
  eq('daarna een eigen bestand met taaktypen zonder vreemd deel: dezelfde melding, geen telregel van een eerder bestand',
    storeNotices(store), sortedKeys([{ ...TASK_TYPES_HEAD, count: 3, detailLines: [] }]));
}

{
  const MAIN_TASK_TYPES_DETAIL: NotificationDetailLine = { messageKey: 'notifications.taskTypesUnlockedDetail', helpArticleId: 'howto-werkregel-kiezen', linkKey: 'notifications.workRulesReadMore' };
  const mainShown = (notice: NotifyInput | undefined, unlocked: boolean): NotifyInput | undefined =>
    notice && unlocked ? { ...notice, detailLines: [...(notice.detailLines ?? []), MAIN_TASK_TYPES_DETAIL] }
      : notice ?? (unlocked ? { severity: 'info', messageKey: 'notifications.taskTypesUnlocked', dedupeKey: 'task-types-unlocked', helpArticleId: 'howto-werkregel-kiezen' } : undefined);
  const head = (n: NotifyInput | undefined) => n && sortedKeys({
    messageKey: n.messageKey, severity: n.severity, helpArticleId: n.helpArticleId ?? null, dedupeKey: n.dedupeKey ?? null,
    params: n.params ?? null, numberParams: n.numberParams ?? null, action: n.action ?? null, detail: n.detail ?? null,
  });
  const lineKeys = (n: NotifyInput | undefined) => (n?.detailLines ?? []).map(line => line.messageKey);
  const foreign = await open('twee-werkplannen.ifc', true);
  const plain = await open('council/fix2-data-in-kop.ifc', true);
  const kinds: Array<[string, NotifyInput | undefined]> = [
    ['geen melding van main', undefined],
    ['XER-archief', withOpenNoticeSticky(withXerArchiveIssueNotice(undefined, [{ code: 'hash-mismatch', detail: 'proef' }]))],
    ['opgenomen datums', withOpenNoticeSticky(withRecordedDatesNotice(undefined, 3))],
    ['rekenprofiel', withOpenNoticeSticky(withSchedulingProfileNotice([{ ...foreign[0], suggestedProfileId: 'p6' }], undefined, 'doc-proef'))],
  ];
  for (const [kind, fileNotice] of kinds) {
    for (const unlocked of [false, true]) {
      for (const large of [false, true]) {
        lowerForeignOpenWarnBytesForTests(large ? 1 : undefined);
        const label = `${kind}${unlocked ? ' met taaktypen' : ''}${large ? ', groot bestand' : ''}`;
        const main = mainShown(fileNotice, unlocked);
        const established = large ? withLargeForeignOpenNotice(main, foreign[0]) : main;
        const got = openedFileNotice(fileNotice, unlocked, foreign[0]);
        if (established) {
          eq(`${label}, met een vreemd deel: kop, ernst, gidslink, deduplicatie, actie en parameters zoals main`, head(got), head(established));
          eq(`${label}, met een vreemd deel: eerst de regels van main${large ? ' en de grootteregel' : ''}, daarna de telregel en de werkplanregel`,
            lineKeys(got), [...lineKeys(established), WITH_MODEL, WORK_PLANS]);
        } else {
          eq(`${label}, met een vreemd deel: zonder melding van main is de telmelding de kop`, [got?.messageKey, lineKeys(got)], [WITH_MODEL, [WORK_PLANS]]);
        }
        eq(`${label}, met een vreemd deel: de werkplanregel maakt de melding blijvend`, got?.sticky, true);
        const same = openedFileNotice(fileNotice, unlocked, plain[0]);
        eq(`${label}, zonder vreemd deel: precies wat main toont (een lege lijst regels telt als geen regels)`,
          sortedKeys(same && { ...same, detailLines: same.detailLines ?? [] }), sortedKeys(main && { ...main, detailLines: main.detailLines ?? [] }));
      }
      lowerForeignOpenWarnBytesForTests();
    }
  }
  lowerForeignOpenWarnBytesForTests(1);
  eq('groot bestand met een vreemd deel, zonder andere melding: de groottemelding is de kop, daarna de telregel en de werkplanregel',
    [openedFileNotice(undefined, false, foreign[0])?.messageKey, lineKeys(openedFileNotice(undefined, false, foreign[0]))],
    ['notifications.ifcForeignOpenLarge', [WITH_MODEL, WORK_PLANS]]);
  eq('groot bestand met een vreemd deel en taaktypen: de taaktypemelding is de kop, daarna de grootteregel, de telregel en de werkplanregel',
    [openedFileNotice(undefined, true, foreign[0])?.messageKey, lineKeys(openedFileNotice(undefined, true, foreign[0]))],
    ['notifications.taskTypesUnlocked', ['notifications.ifcForeignOpenLarge', WITH_MODEL, WORK_PLANS]]);
  lowerForeignOpenWarnBytesForTests();
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`check-ifc-foreign-open-notice: ${diffs.length} van ${checks} ROOD`);
  process.exit(1);
}
console.log(`check-ifc-foreign-open-notice: ${checks} controles groen`);
