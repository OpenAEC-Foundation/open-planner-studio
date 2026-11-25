import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import {
  MAX_SHOWN, OPEN_NOTICE_SINGLES, OTHER_DATA, WITH_MODEL, WORK_PLANS, chooseRepresentatives, expectedIfcLines, mainSteps,
  openNoticePlan, openingText, plainNotice, runOpenNoticeCase,
  type LiveCase, type MainStep, type OpenNoticeReference, type RecordedNotice,
} from './ifcOpenNoticeMatrix';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');
const MAIN_BASIS = 'a54d67392d5344ab6bf60f9b40c252fad40ff6f6';
const OWN_KEY = 'ifc-foreign-opened';
installBrowserStubs();
installDeterminism();

const { MAX_NOTIFICATIONS } = await import('@/state/slices/uiSlice');

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}\n     kreeg:    ${g}\n     verwacht: ${w}`);
};
const json = (value: unknown) => JSON.stringify(value);

function ruleTwo(name: string, main: readonly MainStep[], live: LiveCase, lines: readonly RecordedNotice[][]): string[] {
  const problems: string[] = [];
  const say = (step: number, text: string) => problems.push(`${name}, na opening ${step + 1}: ${text}`);
  let previous: readonly RecordedNotice[] = [];
  for (const [step, { calls, notifications }] of live.steps.entries()) {
    const shown = main[step];
    const current = previous;
    previous = notifications;
    if (!shown) {
      say(step, 'geen opname van main');
      continue;
    }
    const own = notifications.filter(n => n.dedupeKey === OWN_KEY);
    const mains = notifications.filter(n => n.dedupeKey !== OWN_KEY);
    const plainMains = mains.map(n => plainNotice(n, live.documentIds, ['addedLines']));
    if (json(plainMains) !== json(shown.shown)) {
      say(step, `wat main toont, staat er niet onveranderd\n     kreeg:    ${json(plainMains)}\n     main:     ${json(shown.shown)}`);
      continue;
    }
    if (own.length > 1) say(step, `${own.length} eigen meldingen`);
    for (const notice of own) {
      if (notice.severity !== 'info' || notice.sticky === true || notice.yieldsPlace !== true || notice.addedLines !== undefined) {
        say(step, `de eigen melding is geen gewone info die haar plek afstaat: ${json(plainNotice(notice, live.documentIds))}`);
      }
    }
    const before = main[step - 1]?.shown ?? [];
    const beforeMains = current.filter(n => n.dedupeKey !== OWN_KEY);
    const touchedByMain = new Set(mains.filter((notice, index) => {
      const at = beforeMains.findIndex(n => n.id === notice.id);
      return at < 0 || json(shown.shown[index]) !== json(before[at]);
    }));
    const linesOf = (notice: RecordedNotice | undefined) => json(notice?.addedLines ?? null);
    for (const notice of mains) {
      if (touchedByMain.has(notice)) continue;
      if (linesOf(notice) !== linesOf(current.find(n => n.id === notice.id))) {
        say(step, `de regels onder ${String(notice.messageKey)} veranderden, terwijl main die melding niet aanraakte`);
      }
    }
    const carriers = mains.filter(n => touchedByMain.has(n) && n.addedLines !== undefined);
    const mine = own.find(n => !current.includes(n));
    const want = lines[step];
    const room = current.length < MAX_SHOWN || current.some(n => n.dedupeKey === OWN_KEY);
    let ownCall = 0;
    if (want.length > 0 && touchedByMain.size > 0) {
      if (carriers.length !== 1 || linesOf(carriers[0]) !== json(want)) {
        say(step, `main toonde een melding bij deze opening; de nieuwe regels horen onder precies één daarvan\n     kreeg:    ${
          json(carriers.map(n => [n.messageKey, n.addedLines]))}\n     verwacht: ${json(want)}`);
      }
      if (mine) say(step, 'een eigen melding, terwijl main bij deze opening een melding toonde');
    } else if (want.length > 0 && room) {
      ownCall = 1;
      const [head, ...rest] = want;
      const got = mine && { severity: mine.severity, messageKey: mine.messageKey, params: mine.params, numberParams: mine.numberParams, detailLines: mine.detailLines };
      const expected = { severity: 'info', messageKey: head.messageKey, params: head.params, numberParams: head.numberParams, detailLines: rest };
      if (json(got) !== json(expected)) say(step, `main toonde niets en er was plek: één eigen melding\n     kreeg:    ${json(got)}\n     verwacht: ${json(expected)}`);
    } else {
      if (carriers.length > 0) say(step, `regels onder een melding zonder nieuwe regels bij deze opening: ${json(carriers.map(n => [n.messageKey, n.addedLines]))}`);
      if (mine) say(step, want.length > 0 ? 'een eigen melding, terwijl de stapel vol was' : 'een eigen melding zonder nieuwe regels');
    }
    if (calls !== shown.calls + ownCall) say(step, `${calls} keer notify, main ${shown.calls}${ownCall ? ' plus de eigen melding' : ''}`);
  }
  return problems;
}

const reference = JSON.parse(readFileSync(join(ROOT, 'tests/planning/fixtures/open-notice-main.json'), 'utf8')) as OpenNoticeReference;
eq(`de verwachting komt van de code van main ${MAIN_BASIS.slice(0, 9)} (scripts/proef/maak-open-notice-main.mjs)`, reference.basis, MAIN_BASIS);
eq('de stapel van de app is die van de proef', MAX_NOTIFICATIONS, MAX_SHOWN);
{
  const shownBySingle = new Map(OPEN_NOTICE_SINGLES.map(matrixCase => [matrixCase.name, mainSteps(reference, matrixCase.name)[0]?.shown ?? []]));
  eq('per handtekening van main één vertegenwoordiger, in de volgorde van de losse openingen',
    await chooseRepresentatives(ROOT, shownBySingle), reference.representatives);
}
const plan = await openNoticePlan(ROOT, reference);
eq('de opname heeft precies de gevallen van het plan: losse openingen, benoemde reeksen, alle paren en de vaste reeksen',
  Object.keys(reference.cases), plan.map(matrixCase => matrixCase.name));
eq('alle geordende paren van de vertegenwoordigers', plan.filter(c => c.name.startsWith('paar ')).length, reference.representatives.length ** 2);
let failedCases = 0;
for (const matrixCase of plan) {
  const main = mainSteps(reference, matrixCase.name);
  const lines = await Promise.all(matrixCase.openings.map(opening => expectedIfcLines(openingText(ROOT, opening))));
  const live = await runOpenNoticeCase(ROOT, matrixCase);
  const problems = ruleTwo(matrixCase.name, main, live, lines);
  checks += matrixCase.openings.length;
  if (problems.length > 0) failedCases++;
  diffs.push(...problems);
  if (matrixCase.name === 'reeks: Bonsai groot, dan twee werkplannen klein') {
    eq('Bonsai groot, dan twee werkplannen klein: main houdt beide minutenmeldingen en de opslagwaarschuwing, en de PR ook',
      [main[1]?.shown.map(n => n.messageKey), live.steps[1].notifications.filter(n => n.dedupeKey !== OWN_KEY).map(n => n.messageKey)],
      [['notifications.minuteModelConverted', 'notifications.ifcForeignOpenLarge', 'notifications.minuteModelConverted'],
        ['notifications.minuteModelConverted', 'notifications.ifcForeignOpenLarge', 'notifications.minuteModelConverted']]);
  }
  if (matrixCase.name === 'reeks: drie blijvende meldingen, dan een bestand waarbij main niets toont') {
    eq('volle stapel: na het bestand waarbij main niets toont, is de stapel precies die van main en staat er geen eigen melding',
      [lines[2].length > 0, main[2]?.calls, live.steps[2].notifications.map(n => plainNotice(n, live.documentIds, ['addedLines']))],
      [true, 0, main[2]?.shown]);
  }
}
console.log(`meldingen bij openen: ${plan.length} gevallen, ${reference.representatives.length} handtekeningen, ${failedCases} gevallen met een verschil`);

const { parseOpenedFile, readFormatInput } = await import('@/services/formatRegistry');
const { isMultiDocumentImport } = await import('@/services/importTypes');
const { ifcForeignContentEnabled } = await import('@/utils/featureFlags');
const { scanStep } = await import('@/services/ifc/foreign/stepScanner');
const { classify } = await import('@/services/ifc/foreign/classify');
const { formatReportNumber } = await import('@/utils/reportNumber');
const { ifcForeignOpenLines } = await import('@/state/ifcForeignOpenNotice');
const { STICKY_OPEN_NOTICE_KEYS } = await import('@/state/openNoticeSticky');
const { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
type ImportResult = import('@/services/importTypes').ImportResult;

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

const shape = (results: readonly ImportResult[]) => ifcForeignOpenLines(results).map(line => [line.messageKey, line.params ?? null, line.numberParams ?? null]);
const independentCount = (file: string) => {
  const counts = classify(scanStep(new Uint8Array(readFileSync(join(FOREIGN, file))))).counts;
  return counts.C + counts.A + counts.V;
};

{
  const count = independentCount('bonsai-4d.ifc');
  eq('bonsai-4d (model, één werkplan): de telregel met het aantal niet-P-objecten van de indeling, verder niets',
    shape(await open('bonsai-4d.ifc', true)), [[WITH_MODEL, { count }, { objects: count }]]);
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
      baselineResults[0].tasks.map(task => task.name), ifcForeignOpenLines(baselineResults).map(line => line.messageKey)],
    [true, ['Ruwbouw', 'Wand A bouwen', 'Wand B bouwen'], [WITH_MODEL, WORK_PLANS]]);
  eq('twee-werkplannen: de telregel en de regel over de werkplannen',
    shape(results), [[WITH_MODEL, { count }, { objects: count }], [WORK_PLANS, null, { plans: 2 }]]);
}

eq('r5-prop (alleen een eigenschap van een ander programma, geen model): de tekst zonder gebouwmodel, één onderdeel',
  shape(await open('council/r5-prop.ifc', true)), [[OTHER_DATA, { count: 1 }, { objects: 1 }]]);

{
  const count = independentCount('eigen-plus-model.ifc');
  eq('eigen-plus-model: alleen de telregel', shape(await open('eigen-plus-model.ifc', true)), [[WITH_MODEL, { count }, { objects: count }]]);
}

{
  const results = await open('council/fix2-data-in-kop.ifc', true);
  eq('fix2-data-in-kop: de bytes-route gaf een bron zonder vreemd deel', [!!results[0].ifcSource, results[0].ifcSource?.foreign], [true, false]);
  eq('fix2-data-in-kop: geen regels', shape(results), []);
}

{
  const results = await open('council/r5-prop.ifc', false);
  eq('flag uit, r5-prop: de gewone lezer, zonder bron en zonder overnameverslag (geen scan)',
    results.map(r => [r.ifcSource ?? null, r.ifcWorkPlanCount ?? null]), [[null, null]]);
  eq('flag uit, r5-prop: geen regels', shape(results), []);
  const refused = await open('bonsai-4d.ifc', false).then(() => 'geopend', (e: unknown) => (e as Error).message);
  eq('flag uit, bonsai-4d: openen weigert zoals op main, dus ook geen regels', refused.startsWith('This IFC file contains building model objects'), true);
}

eq('de nieuwe regels maken nooit een melding blijvend',
  [STICKY_OPEN_NOTICE_KEYS.has(WORK_PLANS), STICKY_OPEN_NOTICE_KEYS.has(WITH_MODEL), STICKY_OPEN_NOTICE_KEYS.has(OTHER_DATA)], [false, false, false]);

for (const [lng, common] of [['nl', nlCommon], ['en', enCommon]] as const) {
  const inst = i18next.createInstance();
  await inst.init({ lng, fallbackLng: false, resources: { [lng]: { common } }, ns: ['common'], defaultNS: 'common', interpolation: { escapeValue: false } });
  const text = (key: string, count: number) => inst.t(key, { count, objects: formatReportNumber(count, lng) });
  eq(`${lng}: enkelvoud en meervoud van de telregel`,
    [text(OTHER_DATA, 1).includes(lng === 'nl' ? '(1 onderdeel)' : '(1 item)'), text(WITH_MODEL, 12345).includes(lng === 'nl' ? '(12345 onderdelen)' : '(12345 items)')],
    [true, true]);
  eq(`${lng}: de telregel zegt wat buiten de planning staat, niet wie het maakte en niet wat opslaan ermee doet`,
    [WITH_MODEL, OTHER_DATA].map(key => [text(key, 2).includes(lng === 'nl' ? 'buiten de planning' : 'outside the schedule'),
      /andere programma|other program|opslaan|saving/i.test(text(key, 2)), text(key, 2).trim().endsWith(').')]),
    [[true, false, true], [true, false, true]]);
  eq(`${lng}: de werkplanregel toont het aantal`, inst.t(WORK_PLANS, { plans: formatReportNumber(2, lng) }).includes('2'), true);
}

{
  const complex = scanForeign(new TextEncoder().encode(openingText(ROOT, { file: 'public/examples/showcase-verbouwing-eengezinswoning.ifc', complexUnit: true })));
  eq('de complexe eenheid: de scan houdt haar voor een mogelijk model, maar zeker is dat niet',
    complex.ok && [complex.buildingModel, complex.buildingModelUncertain], [true, true]);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`check-ifc-foreign-open-notice: ${diffs.length} van ${checks} ROOD`);
  process.exit(1);
}
console.log(`check-ifc-foreign-open-notice: ${checks} controles groen`);
