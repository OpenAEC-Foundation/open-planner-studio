// P6 XML openen via de echte open-pijplijn: `parseOpenedFile` (formatRegistry) → `applyOpenedImport`
// (store). Bewaakt de meldingen van een P6 XML-bestand:
// - geen leesbare activiteit ⇒ de import MISLUKT (`P6XmlImportError`, geen tabblad, zoals een lege
//   XER) en `importFailureNotice` geeft "geen activiteiten", met de reden als die bekend is
//   (activiteiten zonder ObjectId; XER-kolomnamen in XML);
// - meerdere projecten, baselines, losse baselineverwijzingen, activiteiten zonder project ⇒ één
//   verslag (`p6xmlImportNotice`);
// - een gewoon bestand met één project ⇒ geen melding;
// - relaties tussen projecten of activiteiten zonder project ⇒ de melding blijft staan (`sticky`).
// Corpusloos (CI). Fixtures: inline, zelf geschreven.
import { readFileSync } from 'node:fs';
import { parseOpenedFile } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { importFailureNotice, p6xmlImportNotice } from '@/state/slices/fileSlice';
import { P6XmlImportError } from '@/services/p6/p6xmlErrors';
import { isStickyOpenNotice, withOpenNoticeSticky } from '@/state/openNoticeSticky';
import { activeImportResult, isMultiDocumentImport, type OpenedImport } from '@/services/importTypes';
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

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects">${inner}</APIBusinessObjects>`;

// Zoals Hospital_GW_Programme: activiteiten zonder ObjectId, relaties via ActivityId.
const NO_OBJECT_IDS = wrap(`<Project><Name>Zonder ObjectId</Name><PlannedStartDate>2026-02-02T08:00:00</PlannedStartDate>
  <Activity><Id>A1</Id><Name>Fundering</Name><PlannedDuration>40</PlannedDuration>
    <PlannedStartDate>2026-02-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-02-06T17:00:00</PlannedFinishDate></Activity>
  <Relationship><PredecessorActivityId>A1</PredecessorActivityId><SuccessorActivityId>A2</SuccessorActivityId></Relationship>
</Project>`);
// Zoals MER-1-2026: XER-kolomnamen in een XML-jas.
const XER_COLUMNS = wrap(`<Project><ObjectId>1001</ObjectId><Name>XER in XML</Name>
  <Activity><task_id>1</task_id><task_code>A-1</task_code><task_name>Inkoop</task_name></Activity>
</Project>`);
const NO_ACTIVITIES = wrap(`<Project><ObjectId>7</ObjectId><Name>Leeg</Name></Project>`);
const ONE_PROJECT = wrap(`<Project><ObjectId>7</ObjectId><Name>Gewoon</Name><PlannedStartDate>2026-02-02T08:00:00</PlannedStartDate>
  <Activity><ObjectId>70</ObjectId><Id>A1</Id><Name>Fundering</Name><PlannedDuration>40</PlannedDuration>
    <PlannedStartDate>2026-02-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-02-06T17:00:00</PlannedFinishDate></Activity>
</Project>`);

async function open(name: string, text: string): Promise<OpenedImport> {
  const parsed = await parseOpenedFile({ name, text });
  S().newProject();
  useAppStore.setState(st => { st.ui.notifications = []; });
  S().applyOpenedImport(parsed, { filePath: null, recompute: true, fit: false, linkedOpen: true });
  return parsed;
}
const noticeOf = (parsed: OpenedImport) => p6xmlImportNotice(isMultiDocumentImport(parsed) ? parsed.results : [parsed]);

async function main(): Promise<void> {
  // (1)–(3) Geen leesbare activiteit: `parseOpenedFile` faalt (dus geen `openAsDocument`, geen tabblad),
  //         en de fout geeft via `importFailureNotice` de melding met reden. De open-paden in
  //         fileSlice melden elke importfout via `importFailureNotice`.
  const failure = async (name: string, text: string): Promise<unknown> => {
    try { await parseOpenedFile({ name, text }); return undefined; } catch (e) { return e; }
  };
  for (const [label, text, reason, reasonKey] of [
    ['1 zonder ObjectId', NO_OBJECT_IDS, 'no-object-ids', ['notifications.p6xmlImportEmptyNoObjectIds']],
    ['2 XER-kolommen', XER_COLUMNS, 'xer-columns', ['notifications.p6xmlImportEmptyXerColumns']],
    ['3 geen activiteiten', NO_ACTIVITIES, 'no-activities', undefined],
  ] as const) {
    const err = await failure(`${label}.xml`, text);
    eq(`${label}: import mislukt met reden`, [err instanceof P6XmlImportError, (err as P6XmlImportError | undefined)?.reason], [true, reason]);
    const notice = importFailureNotice(err, (err as Error).message);
    eq(`${label}: melding`, [notice.severity, notice.messageKey, notice.detailLines?.map(l => l.messageKey), notice.detail],
      ['error', 'notifications.p6xmlImportEmpty', reasonKey, undefined]);
  }
  eq('3b andere fout houdt de gewone sleutel en tekst', [importFailureNotice(new Error('kapot'), 'kapot').messageKey, importFailureNotice(new Error('kapot'), 'kapot').detail],
    ['notifications.openFailed', 'kapot']);
  let parsed: OpenedImport;

  // (4) Gewoon bestand met één project: geen P6 XML-melding.
  parsed = await open('gewoon.xml', ONE_PROJECT);
  eq('4a één taak', activeImportResult(parsed).tasks.length, 1);
  eq('4b geen melding', noticeOf(parsed), undefined);
  eq('4c geen p6xml-melding in de store', S().ui.notifications.some(n => n.messageKey.startsWith('notifications.p6xml')), false);

  // (6) Meerdere projecten: één tabblad per project mét activiteiten, actief = meeste activiteiten,
  //     één verslag (geen melding per document).
  const fixture = readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8');
  useAppStore.setState(st => { st.ui.notifications = []; });
  S().newProject();
  const docsBefore = S().documents.length;
  const multi = await parseOpenedFile({ name: 'meerdere.xml', text: fixture });
  const outcome = S().applyOpenedImport(multi, { filePath: null, recompute: true, fit: false, linkedOpen: true });
  eq('6a twee documenten geopend (leeg tabblad hergebruikt)', [outcome.documentIds.length, S().documents.length - docsBefore], [2, 1]);
  eq('6b actief document = B (naam kaal, code apart)', [S().project.name, S().project.p6ProjectCode], ['Project B & bouw', 'B-BOUW']);
  eq('6c B: actieve baseline', S().activeBaselineId?.startsWith('p6xml-baseline:200:201'), true);
  const p6Notices = S().ui.notifications.filter(n => n.messageKey.startsWith('notifications.p6xml'));
  eq('6d één verslag', p6Notices.map(n => [n.severity, n.messageKey, n.params]), [['info', 'notifications.p6xmlImportOpened', { count: 2 }]]);
  eq('6e detailregels', p6Notices[0]?.detailLines?.map(l => [l.messageKey, l.params?.count]), [
    ['notifications.xerImportProjectsSeen', 3],
    ['notifications.xerImportEmptyProjectsSkipped', 1],
    ['notifications.xerImportBaselinesMaterialized', 2],
    ['notifications.p6xmlImportCrossProjectRelations', 1],
  ]);
  // Integratie ronde 2 (#320 × #330): een relatie tussen projecten is niet overgenomen ⇒ de
  // openingsmelding blijft staan tot het kruisje (`STICKY_OPEN_NOTICE_KEYS`), blijft wel `info`.
  eq('6f relatie tussen projecten ⇒ melding blijft staan', p6Notices[0]?.sticky, true);

  // (7) Eén project mét baseline: toch een verslag (niet alleen bij meerdere projecten).
  const withBaseline = wrap(`<Project><Id>E</Id><ObjectId>1</ObjectId><Name>Een</Name><CurrentBaselineProjectObjectId>9</CurrentBaselineProjectObjectId>
    <Activity><Id>A1</Id><Name>a</Name><ObjectId>11</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity></Project>
    <BaselineProject><Id>E-BL</Id><ObjectId>9</ObjectId><Name>Een</Name><OriginalProjectObjectId>1</OriginalProjectObjectId>
    <Activity><Id>A1</Id><Name>a</Name><ObjectId>91</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity></BaselineProject>`);
  parsed = await open('baseline.xml', withBaseline);
  eq('7 één project + baseline ⇒ verslag met baselineregel', [noticeOf(parsed)?.messageKey, noticeOf(parsed)?.detailLines?.map(l => l.messageKey)],
    ['notifications.p6xmlImportOpened', ['notifications.xerImportProjectsSeen', 'notifications.xerImportBaselinesMaterialized']]);
  // Alleen "projecten gezien" en een gekoppelde baseline: niets ingevuld of weggelaten ⇒ na 5 s weg.
  eq('7b alleen baseline gekoppeld ⇒ melding blijft niet staan',
    S().ui.notifications.find(n => n.messageKey === 'notifications.p6xmlImportOpened')?.sticky, undefined);

  // (8) Losse baselineverwijzing en een platte activiteit zonder project (twee projecten).
  const edges = wrap(`<Activity><Id>LOS</Id><Name>los</Name><ObjectId>99</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity>
    <Project><Id>P1</Id><ObjectId>1</ObjectId><Name>Een</Name><CurrentBaselineProjectObjectId>55</CurrentBaselineProjectObjectId>
      <Activity><Id>A1</Id><Name>a</Name><ObjectId>11</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity></Project>
    <Project><Id>P2</Id><ObjectId>2</ObjectId><Name>Twee</Name>
      <Activity><Id>B1</Id><Name>b</Name><ObjectId>21</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity></Project>
    <BaselineProject><Id>WEES</Id><ObjectId>77</ObjectId><Name>Wees</Name><OriginalProjectObjectId>404</OriginalProjectObjectId></BaselineProject>`);
  parsed = await parseOpenedFile({ name: 'randen.xml', text: edges });
  const edgeDocs = isMultiDocumentImport(parsed) ? parsed.results : [parsed];
  eq('8a de losse activiteit zit in geen enkel document', edgeDocs.map(d => d.tasks.map(t => t.wbsCode)), [['A1'], ['B1']]);
  eq('8b verslag telt losse baselineverwijzingen (2) en de activiteit zonder project (1)',
    noticeOf(parsed)?.detailLines?.map(l => [l.messageKey, l.params?.count]), [
      ['notifications.xerImportProjectsSeen', 2],
      ['notifications.xerImportDanglingBaselineReferences', 2],
      ['notifications.p6xmlImportUnassignedActivities', 1],
    ]);
  eq('8b2 losse baselineverwijzing en activiteit zonder project ⇒ melding blijft staan',
    withOpenNoticeSticky(noticeOf(parsed))?.sticky, true);
  eq('8b3 alleen een activiteit zonder project ⇒ ook blijvend', isStickyOpenNotice({
    messageKey: 'notifications.p6xmlImportOpened',
    detailLines: [{ messageKey: 'notifications.p6xmlImportUnassignedActivities', params: { count: 1 } }],
  }), true);
  // Eén project: een platte activiteit zonder ProjectObjectId hoort gewoon bij dat project.
  parsed = await parseOpenedFile({ name: 'een.xml', text: wrap(`<Activity><Id>LOS</Id><Name>los</Name><ObjectId>99</ObjectId><PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity>
    <Project><Id>P1</Id><ObjectId>1</ObjectId><Name>Een</Name></Project>`) });
  eq('8c één project: de platte activiteit hoort erbij, geen melding', [activeImportResult(parsed).tasks.map(t => t.wbsCode), noticeOf(parsed)], [['LOS'], undefined]);

  // (5) De sleutels bestaan in nl en en (geen lege toast).
  for (const loc of ['nl', 'en']) {
    const json = JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${loc}/common.json`, import.meta.url), 'utf8')) as { notifications: Record<string, string> };
    for (const key of ['p6xmlImportEmpty', 'p6xmlImportEmptyNoObjectIds', 'p6xmlImportEmptyXerColumns', 'p6xmlImportOpened_one', 'p6xmlImportOpened_other', 'p6xmlImportCrossProjectRelations_one', 'p6xmlImportCrossProjectRelations_other', 'p6xmlImportUnassignedActivities_one', 'p6xmlImportUnassignedActivities_other']) {
      eq(`5 ${loc}: ${key}`, typeof json.notifications[key], 'string');
    }
  }
}

main().then(() => {
  if (fails.length > 0) {
    for (const f of fails) console.log(`XX  p6xml-open-notice: ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`OK  p6xml-open-notice: ${checks} controles groen`);
  }
}, (e: unknown) => {
  console.log(`XX  p6xml-open-notice: uitzondering ${(e as Error).stack}`);
  process.exitCode = 1;
});
