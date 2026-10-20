// P6 Project-ID los van de projectnaam — eigenaarsbesluit 2026-10-13 ("dit", bij deze optie):
//   De code blijft altijd, los van de naam (zoals XER). In Projectinfo staat alleen de naam ("Bid for
//   Facility Extension"). Hernoem je naar "Uitbreiding hal", dan toont het tabblad "Uitbreiding hal
//   (OZB-05)". Bij een export naar P6 gaat OZB-05 terug als Project-ID, zodat P6 het project herkent.
//   P6 XML moet daarvoor de code apart bewaren, ook na opslaan als IFC.
//
// Opslag: `Project.p6ProjectCode` (lezer), IFC `OPS_ProjectSettings/P6ProjectCode`; weergave en writer
// halen de code via de ene helper `documentProjectCode` (XER: uit de broncache, ongewijzigd).
//
// Deze check loopt via de echte productieroutes: `parseOpenedFile` → `applyOpenedImport` (openen),
// `setProject` (Projectinfo), `undo`/`redo`, `switchDocument`, `exportAs('p6' | 'ifc')` (met het
// geschreven bestand en de voorgestelde bestandsnaam onderschept aan de onderkant van `fileAccess`, de
// web-download-fallback), `serializeRecoverySnapshot` → `restoreDocuments` (crashherstel),
// `api.data.loadProject` (echte extensie-API, lees-wijzig-laad) en `duplicateDocument`.
// Oude eigen exports (t/m v2026.9.0: `<Id>` = het interne project-id) geven geen code (sectie 10).
// Corpusloos (CI). Fixtures: `fixtures/p6xml-genest-meerdere-projecten.xml` en inline.
import { readFileSync } from 'node:fs';
import { installDOMParser } from './xmldom-shim';
import { readP6XML, readP6XMLDocuments } from '@/services/p6/p6xmlReader';
import { isLegacyOpsProjectId, p6ProjectIdentity, writeP6XML } from '@/services/p6/p6xmlWriter';
import { generateId } from '@/utils/id';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { documentFileBase, documentTitle } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { xerProjectCode } from '@/utils/xerDocumentName';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { serializeRecoverySnapshot } from '@/services/recovery/recoverySnapshot';
import { retainActiveDocument } from '@/extensions/retainActiveDocument';
import { fromExtProject, toExtProject } from '@/extensions/extMappers';

declare const process: { exitCode?: number };

// ── Headless browser-stubs (patroon check-mspdi-baseline-export) ────────────────────────────────
// Zonder `showSaveFilePicker` pakt de web-backend de download-fallback: `new Blob([inhoud])` en een
// `<a download="naam">`-klik. Daar lezen we het geschreven bestand én de voorgestelde naam af.
let captured: string | null = null;
let capturedName: string | null = null;
const g = globalThis as any;
g.window = g.window ?? {};
g.Blob = class {
  constructor(parts: unknown[]) {
    captured = parts.map(p => (typeof p === 'string' ? p : new TextDecoder().decode(p as Uint8Array))).join('');
  }
};
g.URL = g.URL ?? {};
g.URL.createObjectURL = () => 'blob:test';
g.URL.revokeObjectURL = () => { /* no-op */ };
g.document = {
  createElement: () => ({ href: '', download: '', click(this: { download: string }) { capturedName = this.download; } }),
};
installDOMParser();

const { useAppStore, appStoreContext } = await import('@/state/appStore');
const { createExtensionApi } = await import('@/extensions/extensionApi');
const { parseOpenedFile, readIFCWithXerReconstruction } = await import('@/services/formatRegistry');
const S = () => useAppStore.getState();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

/** `<Id>` en `<Name>` van het P6-project (de eerste `<Project>`, zonder de objecten erbinnen). */
function projectIdAndName(xml: string): [string, string] {
  const head = xml.slice(xml.indexOf('<Project>'));
  const bare = head.replace(/<(WBS|Activity|Relationship|ResourceAssignment|ActivityNote|UDF)>[\s\S]*?<\/\1>/g, '');
  return [/<Id>([^<]*)<\/Id>/.exec(bare)?.[1] ?? '', /<Name>([^<]*)<\/Name>/.exec(bare)?.[1] ?? ''];
}

/** Titels zoals tabblad, projectbalk en MCP ze tonen (`getOpenDocuments`), van de documenten die de
 *  stap zelf opende (`newProject` sluit de tabbladen van een vorige stap niet). */
const titles = (ids: readonly string[]) => S().getOpenDocuments().filter(d => ids.includes(d.id)).map(d => d.title);
const activeCode = () => documentProjectCode(S().project, S().xerImportMetadata);

async function exportCaptured(format: 'p6' | 'ifc'): Promise<{ text: string; name: string }> {
  captured = null;
  capturedName = null;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const result = await S().exportAs(format);
    if (!result.ok) fails.push(`export ${format} mislukte: ${JSON.stringify(result)}`);
  } finally { console.warn = warn; }
  return { text: (captured as string | null) ?? '', name: (capturedName as string | null) ?? '' };
}

async function openInStore(name: string, input: { text: string } | { bytes: Uint8Array }): Promise<string[]> {
  const parsed = await parseOpenedFile({ name, ...input });
  S().newProject();
  const outcome = S().applyOpenedImport(parsed, { filePath: null, recompute: true, fit: false, hourDataNotice: false, linkedOpen: true });
  return outcome.documentIds;
}

const P6_MULTI = readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8');
const act = (id: number) => `<Activity><ObjectId>${id}</ObjectId><Id>A${id}</Id><Name>A${id}</Name><PlannedDuration>8</PlannedDuration>
  <PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-02T17:00:00</PlannedFinishDate></Activity>`;
// Zoals p6-meerdere-projecten.xml (OZB): dezelfde naam, eigen codes, ook codes met een spatie.
const OZB = `<?xml version="1.0"?><APIBusinessObjects>
  <Project><Id>OZB-05</Id><ObjectId>1</ObjectId><Name>Bid for Facility Extension</Name>${act(11)}</Project>
  <Project><Id>OZB-14 1st Update</Id><ObjectId>2</ObjectId><Name>Bid for Facility Extension</Name>${act(21)}${act(22)}</Project>
  <Project><Id>OPS:proj-intern</Id><ObjectId>3</ObjectId><Name>Eigen export zonder code</Name>${act(31)}</Project></APIBusinessObjects>`;

// ── (1) Import met meerdere projecten: naam zonder code, code apart, per project ─────────────────
{
  const multi = readP6XMLDocuments(P6_MULTI);
  const docs = isMultiDocumentImport(multi) ? multi.results : [multi];
  eq('1a fixture: naam kaal, code apart per project', docs.map(d => [d.project.name, d.project.p6ProjectCode]),
    [['Project B & bouw', 'B-BOUW'], ['Project C', 'C-AFBOUW']]);
  const ozb = readP6XMLDocuments(OZB);
  const ozbDocs = isMultiDocumentImport(ozb) ? ozb.results : [ozb];
  eq('1b OZB: dezelfde naam, elk een eigen code (ook met spatie); OPS:-Id is geen code',
    ozbDocs.map(d => [d.project.name, d.project.p6ProjectCode]),
    [['Bid for Facility Extension', 'OZB-05'], ['Bid for Facility Extension', 'OZB-14 1st Update'], ['Eigen export zonder code', undefined]]);
  const noName = readP6XML(`<?xml version="1.0"?><APIBusinessObjects><Project><Id>OZB-09</Id><ObjectId>1</ObjectId>${act(11)}</Project></APIBusinessObjects>`);
  eq('1c geen <Name> ⇒ de code als naam (zoals XER), één keer in de titel',
    [noName.project.name, noName.project.p6ProjectCode, documentTitle(null, noName.project.name, documentProjectCode(noName.project))],
    ['OZB-09', 'OZB-09', 'OZB-09']);
}

// ── (2) De weergavenaam: één regel voor XER en P6 XML ───────────────────────────────────────────
{
  const p = { name: 'Bid for Facility Extension', p6ProjectCode: 'OZB-05' };
  eq('2a documentProjectCode leest de P6 XML-code', documentProjectCode(p), 'OZB-05');
  eq('2b tabblad zonder opslagdoel = "Naam (code)"', documentTitle(null, p.name, documentProjectCode(p)), 'Bid for Facility Extension (OZB-05)');
  eq('2c voorgestelde bestandsnaam = tabblad', documentFileBase(p.name, documentProjectCode(p)), 'Bid for Facility Extension (OZB-05)');
  eq('2d met opslagdoel blijft het de bestandsnaam', documentTitle('/x/plan.ifc', p.name, documentProjectCode(p)), 'plan');
  const fase: { name: string; p6ProjectCode?: string } = { name: 'Nieuwbouw (fase 2)' };
  eq('2e zonder code ongewijzigd', [documentProjectCode(fase), documentTitle(null, fase.name, documentProjectCode(fase))],
    [undefined, 'Nieuwbouw (fase 2)']);
  eq('2f lege of witruimte-code telt niet', documentProjectCode({ p6ProjectCode: '  ' }), undefined);
}

// ── (3) Store: openen, Projectinfo-hernoemen, undo/redo, documentwissel, export, bestandsnaam ─────
{
  const ids = await openInStore('meerdere.xml', { text: P6_MULTI });
  eq('3a twee tabbladen, titels "Naam (code)"', titles(ids), ['Project B & bouw (B-BOUW)', 'Project C (C-AFBOUW)']);
  eq('3b Projectinfo-veld (project.name) toont alleen de naam', S().project.name, 'Project B & bouw');

  S().setProject({ name: 'Nieuwe naam' });
  eq('3c hernoemen houdt de code', [S().project.name, S().project.p6ProjectCode, activeCode()], ['Nieuwe naam', 'B-BOUW', 'B-BOUW']);
  eq('3d tabblad na hernoemen = "Nieuwe naam (B-BOUW)"', titles(ids), ['Nieuwe naam (B-BOUW)', 'Project C (C-AFBOUW)']);

  S().undo();
  eq('3e undo: oude naam, code blijft', [S().project.name, S().project.p6ProjectCode, titles(ids)[0]], ['Project B & bouw', 'B-BOUW', 'Project B & bouw (B-BOUW)']);
  S().redo();
  eq('3f redo: nieuwe naam, code blijft', [S().project.name, S().project.p6ProjectCode, titles(ids)[0]], ['Nieuwe naam', 'B-BOUW', 'Nieuwe naam (B-BOUW)']);

  S().switchDocument(ids[1]);
  eq('3g documentwissel naar C: eigen code', [S().project.name, S().project.p6ProjectCode], ['Project C', 'C-AFBOUW']);
  S().switchDocument(ids[0]);
  eq('3h terug naar B: code overleeft de wissel', [S().project.name, S().project.p6ProjectCode], ['Nieuwe naam', 'B-BOUW']);

  // De schrijver na hernoemen, via de echte exportroute.
  const p6 = await exportCaptured('p6');
  eq('3i P6 XML na hernoemen: <Id>B-BOUW</Id>, <Name>Nieuwe naam</Name>', projectIdAndName(p6.text), ['B-BOUW', 'Nieuwe naam']);
  eq('3j voorgestelde bestandsnaam P6-export', p6.name, 'Nieuwe naam (B-BOUW).xml');
  const reopened = readP6XML(p6.text);
  eq('3k heropende export: zelfde naam en code', [reopened.project.name, reopened.project.p6ProjectCode], ['Nieuwe naam', 'B-BOUW']);

  // ── (4) Round-trip via IFC (opslaan als IFC en heropenen) ───────────────────────────────────
  const ifc = await exportCaptured('ifc');
  eq('4a voorgestelde bestandsnaam IFC', ifc.name, 'Nieuwe naam (B-BOUW).ifc');
  eq('4b IFC draagt P6ProjectCode in OPS_ProjectSettings', /IFCPROPERTYSINGLEVALUE\('P6ProjectCode',\$,IFCTEXT\('B-BOUW'\),\$\)/.test(ifc.text), true);
  const rt = readIFC(ifc.text);
  eq('4c IFC heropend: naam en code', [rt.project.name, rt.project.p6ProjectCode], ['Nieuwe naam', 'B-BOUW']);
  eq('4d IFC → P6 XML: <Id> = code', projectIdAndName(writeP6XML(rt.project, rt.calendar, rt.tasks, rt.sequences, rt.resources, rt.assignments, rt.resourceCalendars ?? [])),
    ['B-BOUW', 'Nieuwe naam']);
  const ids2 = await openInStore('heropend.ifc', { text: ifc.text });
  eq('4e IFC opnieuw geopend in de store: tabblad "Nieuwe naam (B-BOUW)"', [ids2.length, titles(ids2)], [1, ['Nieuwe naam (B-BOUW)']]);
  const rt2 = readIFC(writeIFC(rt));
  eq('4f tweede round-trip idempotent', [rt2.project.name, rt2.project.p6ProjectCode], ['Nieuwe naam', 'B-BOUW']);
  const plain = readIFC(writeIFC({ ...rt, project: { ...rt.project, p6ProjectCode: undefined } }));
  eq('4g zonder code: geen P6ProjectCode in het bestand, niets terug',
    [writeIFC({ ...rt, project: { ...rt.project, p6ProjectCode: undefined } }).includes('P6ProjectCode'), plain.project.p6ProjectCode], [false, undefined]);
}

// ── (5) Crashherstel (snapshot → herstel) en de extensie-lees-wijzig-laad ──────────────────────
{
  const ids = await openInStore('meerdere.xml', { text: P6_MULTI });
  S().setProject({ name: 'Uitbreiding hal' });
  const docs = S().documents.map(d => {
    const source = d.id === S().activeDocumentId ? S() : d.payload!;
    return { id: d.id, ifc: serializeRecoverySnapshot(source), filePath: null, isDirty: true };
  });
  const restored = [];
  for (const d of docs) {
    const parsed = await readIFCWithXerReconstruction(d.ifc);
    restored.push(recoveryInputFromParsed(parsed, { id: d.id, filePath: d.filePath, isDirty: d.isDirty, datesAsRecorded: false }));
  }
  S().newProject();
  S().restoreDocuments(restored, ids[0]);
  eq('5a crashherstel: titels met code, hernoemde naam blijft', titles(ids), ['Uitbreiding hal (B-BOUW)', 'Project C (C-AFBOUW)']);
  eq('5b crashherstel: code op het project', [S().project.name, S().project.p6ProjectCode], ['Uitbreiding hal', 'B-BOUW']);

  // Extensie: lees-wijzig-laad op hetzelfde project. Het publieke contract draagt de code niet
  // (`fromExtProject`), het document houdt hem vast (`retainActiveDocument`).
  const fromExtension: ImportResult = {
    project: fromExtProject(toExtProject(S().project)),
    calendar: S().calendar, tasks: S().tasks, sequences: S().sequences, resources: S().resources, assignments: S().assignments,
  };
  eq('5c het extensiecontract draagt de code niet', fromExtension.project.p6ProjectCode, undefined);
  eq('5d retainActiveDocument houdt de code van het document vast', retainActiveDocument(fromExtension, S()).project.p6ProjectCode, 'B-BOUW');
}

// ── (6) Een naam met haakjes zonder code blijft heel ──────────────────────────────────────────
{
  S().newProject();
  S().setProject({ name: 'Nieuwbouw (fase 2)', startDate: '2026-03-02' });
  S().addTask({ name: 'Taak' });
  eq('6a geen code ⇒ tabblad = de naam', [activeCode(), titles([S().activeDocumentId])], [undefined, ['Nieuwbouw (fase 2)']]);
  const p6 = await exportCaptured('p6');
  const [id, name] = projectIdAndName(p6.text);
  eq('6b P6-export: <Name> heel, <Id> = OPS: + intern id', [name, id === `OPS:${S().project.id}`.slice(0, 40)], ['Nieuwbouw (fase 2)', true]);
  const back = readP6XML(p6.text);
  eq('6c heropend: naam heel, geen code', [back.project.name, back.project.p6ProjectCode], ['Nieuwbouw (fase 2)', undefined]);
  // Ook een naam die op een code lijkt, wordt niet gesplitst: de code staat apart, nooit in de naam.
  for (const n of ['Kantoor (OZB-05)', 'Renovatie (2027)']) {
    eq(`6d "${n}" zonder code: Name heel, Id OPS:`, [p6ProjectIdentity({ id: 'proj-x', name: n }, documentProjectCode({})).name,
      p6ProjectIdentity({ id: 'proj-x', name: n }, undefined).id], [n, 'OPS:proj-x']);
  }
}

// ── (7) XER na hernoemen: de code blijft (proj_short_name), de nieuwe naam gaat mee ──────────────
//      Hier de P6 XML-export van een XER-document: proj_short_name als <Id>, de nieuwe naam als
//      <Name>. De XER-export (`xerWriter.ts`) schrijft de code als proj_short_name (`check-xer-writer.ts`, S26).
{
  const XER = [
    'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tDag\t\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tproj_name\tclndr_id\tplan_start_date',
    '%R\tP1\tMER-1-2026\tMERIDIAN-1 Data Centre, Hall A\tC1\t2026-04-06 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\t\tC1\tA1\tEen\tTT_Task\tTK_NotStart\t8\t8\t2026-04-06 08:00\t2026-04-06 16:00',
    '%E',
  ].join('\n');
  const xerIds = await openInStore('mer.xer', { bytes: new TextEncoder().encode(XER) });
  eq('7a XER: naam kaal, code uit de broncache, niets op het project',
    [S().project.name, xerProjectCode(S().xerImportMetadata), S().project.p6ProjectCode, titles(xerIds)],
    ['MERIDIAN-1 Data Centre, Hall A', 'MER-1-2026', undefined, ['MERIDIAN-1 Data Centre, Hall A (MER-1-2026)']]);
  S().setProject({ name: 'Nieuwe naam' });
  eq('7b XER na hernoemen: tabblad "Nieuwe naam (MER-1-2026)"', titles(xerIds), ['Nieuwe naam (MER-1-2026)']);
  const p6 = await exportCaptured('p6');
  eq('7c XER → P6 XML na hernoemen: <Id> = proj_short_name, <Name> = nieuwe naam', projectIdAndName(p6.text), ['MER-1-2026', 'Nieuwe naam']);
  eq('7d voorgestelde bestandsnaam', p6.name, 'Nieuwe naam (MER-1-2026).xml');
  const ifc = await exportCaptured('ifc');
  const rt = await readIFCWithXerReconstruction(ifc.text);
  eq('7e XER → IFC → heropend: nieuwe naam, code uit het archief, titel',
    [rt.project.name, xerProjectCode(rt.xer), rt.project.p6ProjectCode, documentTitle(null, rt.project.name, documentProjectCode(rt.project, rt.xer))],
    ['Nieuwe naam', 'MER-1-2026', undefined, 'Nieuwe naam (MER-1-2026)']);
  eq('7f heropend IFC → P6 XML: <Id> = proj_short_name',
    projectIdAndName(writeP6XML(rt.project, rt.calendar, rt.tasks, rt.sequences, rt.resources, rt.assignments, rt.resourceCalendars ?? [], rt.customTaskTypes ?? [], documentProjectCode(rt.project, rt.xer))),
    ['MER-1-2026', 'Nieuwe naam']);

  // Extensie: lees-wijzig-laad op het XER-document, via de echte extensie-API. De XER-bron vervalt
  // bewust (check-ext-contract 47/48); de code blijft, nu als `project.p6ProjectCode`.
  const ext = createExtensionApi('p6-code-test', [], undefined, appStoreContext, { app: appStoreContext, showNotification: () => {} });
  ext.data.loadProject({
    project: ext.data.getProject(), calendar: ext.data.getCalendar(), tasks: ext.data.getTasks(),
    sequences: ext.data.getSequences(), resources: ext.data.getResources(), assignments: ext.data.getAssignments(),
  });
  eq('7g XER na extensie-load: bron weg, code op het project, tabblad met code',
    [S().xerImportMetadata ?? null, S().project.p6ProjectCode, titles([S().activeDocumentId])],
    [null, 'MER-1-2026', ['Nieuwe naam (MER-1-2026)']]);
  const p6ext = await exportCaptured('p6');
  eq('7h na extensie-load → P6 XML: <Id>MER-1-2026</Id>', projectIdAndName(p6ext.text), ['MER-1-2026', 'Nieuwe naam']);
}

// ── (8) De naamregel zelf (gedeeld) ──────────────────────────────────────────────────────────────
eq('8a "Naam (code)"', nameWithProjectCode('Uitbreiding hal', 'OZB-05'), 'Uitbreiding hal (OZB-05)');
eq('8b code = naam ⇒ één keer', nameWithProjectCode('OZB-05', 'OZB-05'), 'OZB-05');

// ── (9) Dupliceren (`duplicateDocument`, het menu "Dupliceren"): de kopie houdt de code ───────────
{
  const ids = await openInStore('meerdere.xml', { text: P6_MULTI });
  S().setProject({ name: 'Dupliceerbron' });
  const copyId = S().duplicateDocument();
  eq('9a kopie: variantnaam, zelfde code; bron ongewijzigd',
    [S().project.name, S().project.p6ProjectCode, titles([ids[0], copyId])],
    ['Dupliceerbron (variant 2)', 'B-BOUW', ['Dupliceerbron (B-BOUW)', 'Dupliceerbron (variant 2) (B-BOUW)']]);
  const p6 = await exportCaptured('p6');
  eq('9b kopie → P6 XML: <Id>B-BOUW</Id>', projectIdAndName(p6.text), ['B-BOUW', 'Dupliceerbron (variant 2)']);
}

// ── (10) Oude eigen exports: t/m v2026.9.0 schreef OPS het interne project-id als <Id> ───────────
//       (`generateId('proj')` of `proj-ifc-<GlobalId>` / `proj-ifc-step-<STEP-id>`). Dat is geen code.
{
  const NOW = Date.UTC(2026, 9, 13, 12);
  const stamp = (y: number, m: number, d: number) => `proj-${Date.UTC(y, m, d, 9).toString(36)}`;
  const intern = [
    `${stamp(2026, 1, 23)}k3x91`, `${stamp(2026, 8, 15)}ab1c2`, `${stamp(2026, 9, 12)}zz7q3`, // feb, sep, okt 2026
    'proj-mv70oeeg5neh1179', 'proj-ifc-3vB2YO$MX4xv5uCqZZG05x', 'proj-ifc-step-300T', 'proj-ifc-step-12',
  ];
  const codes = [
    'OZB-05', 'OZB-14 1st Update', 'MER-1-2026', '4408', 'PROJ-001', 'proj-01', 'Proj-2024-A', 'proj-ext-hal',
    'proj-2026-uitbreiding', 'proj-uitbreiding', 'proj-abcdefghij', 'proj-benchmark', 'proj-zuidas2026',
    'proj-monument', 'proj-museumplein', 'proj-multiplex', 'proj-mozart123', 'proj-mrbouw2026', // woorden met een tijdstempel in 2026
    `${stamp(2025, 11, 30)}ab1c1`, // vóór de app bestond
    `${stamp(2026, 9, 20)}ab1c1`,  // na morgen (t.o.v. NOW)
  ];
  eq('10a intern project-id ⇒ herkend', intern.map(id => [id, isLegacyOpsProjectId(id, NOW)]), intern.map(id => [id, true]));
  eq('10a\' een id van generateId(\'proj\') van nu ⇒ herkend (echte klok)', isLegacyOpsProjectId(generateId('proj')), true);
  eq('10b echte codes ⇒ niet herkend', codes.map(c => [c, isLegacyOpsProjectId(c, NOW)]), codes.map(c => [c, false]));
  const asFile = (ids: readonly string[]) => `<?xml version="1.0"?><APIBusinessObjects>${ids.map((id, i) =>
    `<Project><Id>${id}</Id><ObjectId>${i + 1}</ObjectId><Name>Project ${i + 1}</Name>${act(100 + i)}</Project>`).join('')}</APIBusinessObjects>`;
  const read = (ids: readonly string[]) => {
    const r = readP6XMLDocuments(asFile(ids));
    return (isMultiDocumentImport(r) ? r.results : [r]).map(d => d.project.p6ProjectCode);
  };
  eq('10c lezer: intern id ⇒ geen code', read([...intern, generateId('proj')]), [...intern, 'nu'].map(() => undefined));
  eq('10d lezer: echte code blijft', read(codes.slice(0, 18)), codes.slice(0, 18));

  // Zoals een export uit v2026.9.0 (de reviewer zag "Kantoor Zuidas (proj-mv70oeeg5neh1179)").
  const OLD = `<?xml version="1.0"?><APIBusinessObjects>
    <Project><Id>${generateId('proj')}</Id><ObjectId>1</ObjectId><Name>Kantoor Zuidas</Name>${act(11)}</Project>
    <Project><Id>proj-ifc-3vB2YO$MX4xv5uCqZZG05x</Id><ObjectId>2</ObjectId><Name>Hal Noord</Name>${act(21)}</Project></APIBusinessObjects>`;
  const ids = await openInStore('oud.xml', { text: OLD });
  eq('10e oude export geopend: kale tabbladnamen, geen code', [titles(ids), S().project.p6ProjectCode, activeCode()],
    [['Kantoor Zuidas', 'Hal Noord'], undefined, undefined]);
  const p6 = await exportCaptured('p6');
  const [id, name] = projectIdAndName(p6.text);
  eq('10f opnieuw exporteren: <Id> OPS:<eigen id>, geen nepcode; bestandsnaam kaal',
    [id === `OPS:${S().project.id}`.slice(0, 40), name, p6.name], [true, 'Kantoor Zuidas', 'Kantoor Zuidas.xml']);
}

if (fails.length > 0) {
  for (const f of fails) console.log(`XX  p6xml-project-code: ${f}`);
  console.log(`XX  p6xml-project-code: ${fails.length} van ${checks} controles rood`);
  process.exitCode = 1;
} else {
  console.log(`OK  p6xml-project-code: ${checks} controles groen (code los van de naam: import, weergave, hernoemen, undo, wissel, P6/IFC-export, crashherstel, XER, extensie-load, dupliceren, oude exports)`);
}
