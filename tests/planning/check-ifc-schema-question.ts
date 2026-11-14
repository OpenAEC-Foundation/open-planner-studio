// De schemavraag bij opslaan (issue #292, besluit eigenaar 2026-10-13). De app slaat standaard op als
// IFC4X3_ADD2, maar verandert een bestandstype nooit stil: het eerste EXPLICIETE opslaan van een geopend
// IFC-bestand met een ander schema vraagt eerst of het naar ADD2 gaat of zijn schema houdt.
//
// Wat hier vastligt:
//   A. Lezen: welke kop + welke OPS-markering geeft welke open vraag (oude bestanden, andere pakketten,
//      een schema dat de app niet schrijft, een al beantwoorde vraag, een door herstel bewaarde vraag).
//   B. Schrijven: de markering in `OPS_ProjectSettings` round-tript (ook een IFC2X3-vraag, waarvan de
//      kop ADD2 wordt), en de kop volgt `project.ifcSchema`.
//   C. De opslaanroute in de store: nieuw project zonder vraag; annuleren slaat niets op; houden en
//      ADD2 schrijven de juiste kop en wissen de vraag; heropenen vraagt niet opnieuw; Opslaan als vraagt
//      ook; een IFC2X3-bestand zonder vrager wordt niet opgeslagen; een schemakeuze in Projectinfo telt
//      als antwoord; automatisch opslaan naar het bestand wacht alleen bij een schema dat de app niet
//      schrijft.
//   D. Ongedaan maken en opnieuw doen veranderen het schema nooit (review #336 punt 2): het schema is
//      een eigenschap van het bestand, net als het antwoord. Anders schreef AutoSave na een undo binnen
//      10 s weer het oude schema. Ook een keuze in Projectinfo is daarom geen undo-stap. Alleen een
//      echte keuze telt: een patch met hetzelfde schema of `undefined` laat de open vraag staan.
//   E. Exporteren (review #336 punt 4): een export naar een nieuw bestand vraagt niets. Bij een schema
//      dat de app niet schrijft (IFC2X3) wordt de export IFC 4.3 ADD2, zonder een markering
//      "IfcSchemaUnconfirmed = IFC2X3" die niet bij de kop past. Het document zelf houdt zijn vraag.
//      `planner_export_ifc` over het eigen pad weigert dan (tests/mcp/cases-doc-file.ts).
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen.

// ── Omgeving: window, document, downloads, opslag (vóór de app-modules) ───────────────────────────
type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;
const win: AnyRecord = {};
win.parent = win;
g.window = win;
const blobs: Blob[] = [];
g.document = {
  createElement: (tag: string) => {
    if (tag !== 'a') throw new Error(`onverwacht element ${tag}`);
    return { href: '', download: '', click: () => undefined };
  },
};
(globalThis.URL as unknown as AnyRecord).createObjectURL = (blob: Blob) => { blobs.push(blob); return 'blob:test'; };
(globalThis.URL as unknown as AnyRecord).revokeObjectURL = () => undefined;
const session = new Map<string, string>();
g.sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};
g.localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
// Recente bestanden (IndexedDB) zijn hier niet het onderwerp: een database die nooit opent.
g.indexedDB = {
  open: () => {
    const request = { error: new Error('geen IndexedDB in deze check'), onsuccess: null, onerror: null as (() => void) | null, onupgradeneeded: null };
    queueMicrotask(() => request.onerror?.());
    return request;
  },
};

// ── Imports (na de globals) ────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { readIFC, readFileSchemaName } = await import('@/services/ifc/ifcReader');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const {
  ifcSchemaQuestionFor, ifcSchemaUnconfirmedOnRead, ifcSchemaBlocksSilentWrite, cleanIfcSchemaName,
  setIfcSchemaAsker, resetIfcSchemaAsker,
} = await import('@/services/ifc/ifcSchemaQuestion');
type IfcSchemaQuestion = import('@/services/ifc/ifcSchemaQuestion').IfcSchemaQuestion;
type IfcSchemaAnswer = import('@/services/ifc/ifcSchemaQuestion').IfcSchemaAnswer;
const { useAppStore } = await import('@/state/appStore');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { projectInfoPatch } = await import('@/state/projectInfoPatch');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OLD_FILE = readFileSync(join(HERE, 'fixtures', 'ifc-arity-oude-writer.ifc'), 'utf8');

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const truthy = (label: string, cond: unknown) => {
  checks++;
  if (!cond) diffs.push(label);
};
const S = () => useAppStore.getState();
const header = (ifc: string) => readFileSchemaName(ifc);
const withHeader = (ifc: string, schema: string) =>
  ifc.replace(/FILE_SCHEMA\(\('[A-Z0-9_]+'\)\);/, `FILE_SCHEMA(('${schema}'));`);
const hasProp = (ifc: string, name: string) => ifc.includes(`IFCPROPERTYSINGLEVALUE('${name}'`);

/** Een vrager die elke vraag bewaart en het volgende antwoord uit de rij geeft. */
const asked: IfcSchemaQuestion[] = [];
let answers: IfcSchemaAnswer[] = [];
setIfcSchemaAsker(async (question) => { asked.push(question); return answers.shift() ?? null; });

/** Sla op met Ctrl+S (store-actie) en geef de geschreven inhoud terug, of `null` als er niets kwam. */
async function save(as = false): Promise<string | null> {
  const before = blobs.length;
  if (as) await S().saveFileAs(); else await S().saveFile();
  return blobs.length > before ? await blobs[blobs.length - 1].text() : null;
}
async function open(content: string, name: string): Promise<void> {
  const ok = await S().openExampleFromString(content, name);
  truthy(`openen van ${name} lukt`, ok);
}

// Sanity: de oude fixture heeft kop IFC4X3 en geen markering.
eq('0 oude fixture: kop IFC4X3', header(OLD_FILE), 'IFC4X3');
truthy('0 oude fixture: geen schemamarkering', !hasProp(OLD_FILE, 'IfcSchemaConfirmed') && !hasProp(OLD_FILE, 'IfcSchemaUnconfirmed'));

// ═══ A. Lezen ════════════════════════════════════════════════════════════════════════════════
{
  eq('A1 kop IFC4X3 zonder markering (oudere app) ⇒ vraag IFC4X3', ifcSchemaUnconfirmedOnRead('IFC4X3', { confirmed: false }), 'IFC4X3');
  eq('A2 kop IFC4 zonder markering (ander pakket) ⇒ vraag IFC4', ifcSchemaUnconfirmedOnRead('IFC4', { confirmed: false }), 'IFC4');
  eq('A3 kop IFC4X3_ADD2 ⇒ geen vraag', ifcSchemaUnconfirmedOnRead('IFC4X3_ADD2', { confirmed: false }), undefined);
  eq('A4 kop IFC2X3 ⇒ vraag IFC2X3', ifcSchemaUnconfirmedOnRead('IFC2X3', { confirmed: false }), 'IFC2X3');
  eq('A5 bevestigd ⇒ geen vraag, ook bij kop IFC4', ifcSchemaUnconfirmedOnRead('IFC4', { confirmed: true }), undefined);
  eq('A6 bewaarde open vraag wint van de kop', ifcSchemaUnconfirmedOnRead('IFC4X3_ADD2', { confirmed: false, unconfirmed: 'ifc2x3' }), 'IFC2X3');
  eq('A7 geen kop ⇒ geen vraag', ifcSchemaUnconfirmedOnRead(undefined, { confirmed: false }), undefined);
  eq('A8 vrije tekst in de markering telt niet', cleanIfcSchemaName("IFC4'); DROP"), undefined);

  const old = readIFC(OLD_FILE);
  eq('A9 oud bestand: project.ifcSchema = IFC4X3', old.project.ifcSchema, 'IFC4X3');
  eq('A9 oud bestand: open vraag IFC4X3', old.project.ifcSchemaUnconfirmed, 'IFC4X3');
  eq('A9 vraag: houden kan', ifcSchemaQuestionFor(old.project), { fileSchema: 'IFC4X3', keep: 'IFC4X3' });
  const x3 = readIFC(withHeader(OLD_FILE, 'IFC2X3'));
  eq('A10 IFC2X3: ifcSchema afwezig (opslaan zou de standaard schrijven)', x3.project.ifcSchema, undefined);
  eq('A10 IFC2X3: vraag zonder houden', ifcSchemaQuestionFor(x3.project), { fileSchema: 'IFC2X3', keep: null });
  eq('A10 IFC2X3: automatisch opslaan naar het bestand wacht', ifcSchemaBlocksSilentWrite(x3.project), true);
  eq('A11 IFC4: automatisch opslaan mag (schrijft IFC4)', ifcSchemaBlocksSilentWrite(readIFC(withHeader(OLD_FILE, 'IFC4')).project), false);
  eq('A12 ADD2-kop: geen vraag', readIFC(withHeader(OLD_FILE, 'IFC4X3_ADD2')).project.ifcSchemaUnconfirmed, undefined);
}

// ═══ B. Schrijven en teruglezen ══════════════════════════════════════════════════════════════
{
  const base = readIFC(OLD_FILE);
  const write = (project: typeof base.project) => writeIFC({ ...base, project });
  const pendingIfc4 = write({ ...base.project, ifcSchema: 'IFC4', ifcSchemaUnconfirmed: 'IFC4' });
  eq('B1 open vraag IFC4: kop IFC4', header(pendingIfc4), 'IFC4');
  truthy('B1 open vraag IFC4: markering IfcSchemaUnconfirmed, geen Confirmed',
    hasProp(pendingIfc4, 'IfcSchemaUnconfirmed') && !hasProp(pendingIfc4, 'IfcSchemaConfirmed'));
  eq('B1 open vraag IFC4 blijft open na teruglezen', readIFC(pendingIfc4).project.ifcSchemaUnconfirmed, 'IFC4');

  const pending2x3 = write({ ...base.project, ifcSchema: undefined, ifcSchemaUnconfirmed: 'IFC2X3' });
  eq('B2 open vraag IFC2X3: kop is de standaard', header(pending2x3), 'IFC4X3_ADD2');
  eq('B2 open vraag IFC2X3 blijft open na teruglezen (herstel)', readIFC(pending2x3).project.ifcSchemaUnconfirmed, 'IFC2X3');

  const kept = write({ ...base.project, ifcSchema: 'IFC4', ifcSchemaUnconfirmed: undefined });
  truthy('B3 beantwoord: markering IfcSchemaConfirmed', hasProp(kept, 'IfcSchemaConfirmed') && !hasProp(kept, 'IfcSchemaUnconfirmed'));
  const keptBack = readIFC(kept).project;
  eq('B3 beantwoord IFC4: teruglezen zonder vraag, schema IFC4', [keptBack.ifcSchema, keptBack.ifcSchemaUnconfirmed], ['IFC4', undefined]);

  const fresh = write({ ...base.project, ifcSchema: undefined, ifcSchemaUnconfirmed: undefined });
  eq('B4 zonder keuze: kop IFC4X3_ADD2', header(fresh), 'IFC4X3_ADD2');
  truthy('B4 zonder keuze: IfcSchemaConfirmed', hasProp(fresh, 'IfcSchemaConfirmed'));
}

// ═══ C. De opslaanroute in de store ══════════════════════════════════════════════════════════
{
  // C1 — nieuw project: geen vraag, kop ADD2.
  S().newProject();
  S().setProject({ name: 'Nieuw', startDate: '2026-08-03' });
  S().addTask({ name: 'Taak' });
  asked.length = 0;
  const c1 = await save();
  eq('C1 nieuw project: geen vraag', asked.length, 0);
  eq('C1 nieuw project: kop IFC4X3_ADD2', c1 && header(c1), 'IFC4X3_ADD2');

  // C2 — een IFC4-bestand (ander pakket): annuleren slaat niets op en laat de vraag staan.
  const ifc4File = withHeader(OLD_FILE, 'IFC4');
  await open(ifc4File, 'model-ifc4.ifc');
  eq('C2 na openen: vraag IFC4 open', S().project.ifcSchemaUnconfirmed, 'IFC4');
  asked.length = 0; answers = [null];
  const c2 = await save();
  eq('C2 annuleren: er is één vraag gesteld', asked.map(q => [q.fileSchema, q.keep]), [['IFC4', 'IFC4']]);
  eq('C2 annuleren: niets opgeslagen', c2, null);
  eq('C2 annuleren: de vraag staat nog open', S().project.ifcSchemaUnconfirmed, 'IFC4');

  // C3 — houden: kop IFC4, vraag weg, document niet gewijzigd.
  asked.length = 0; answers = ['IFC4'];
  const c3 = await save();
  eq('C3 houden: kop IFC4', c3 && header(c3), 'IFC4');
  eq('C3 houden: vraag weg, schema IFC4', [S().project.ifcSchema, S().project.ifcSchemaUnconfirmed], ['IFC4', undefined]);
  eq('C3 houden: document niet gewijzigd', S().isDirty, false);
  truthy('C3 houden: bestand draagt IfcSchemaConfirmed', !!c3 && hasProp(c3, 'IfcSchemaConfirmed'));
  asked.length = 0;
  const c3b = await save();
  eq('C3 tweede Ctrl+S: geen vraag', asked.length, 0);
  eq('C3 tweede Ctrl+S: kop IFC4', c3b && header(c3b), 'IFC4');

  // C4 — heropenen van het bewaarde bestand: geen vraag meer.
  await open(c3!, 'model-ifc4.ifc');
  eq('C4 heropenen: geen open vraag', S().project.ifcSchemaUnconfirmed, undefined);
  asked.length = 0;
  const c4 = await save();
  eq('C4 heropenen + Ctrl+S: geen vraag', asked.length, 0);
  eq('C4 heropenen + Ctrl+S: kop IFC4', c4 && header(c4), 'IFC4');

  // C5 — het oude OPS-bestand (IFC4X3), keuze ADD2 via Opslaan als.
  await open(OLD_FILE, 'oud.ifc');
  asked.length = 0; answers = ['IFC4X3_ADD2'];
  const c5 = await save(true);
  eq('C5 Opslaan als vraagt ook', asked.map(q => q.fileSchema), ['IFC4X3']);
  eq('C5 keuze ADD2: kop IFC4X3_ADD2', c5 && header(c5), 'IFC4X3_ADD2');
  eq('C5 keuze ADD2: schema in het project', S().project.ifcSchema, 'IFC4X3_ADD2');

  // C6 — IFC2X3 zonder vrager (terugval): niet opslaan; met vrager: het gekozen schema.
  await open(withHeader(OLD_FILE, 'IFC2X3'), 'oud-2x3.ifc');
  resetIfcSchemaAsker();
  const c6a = await save();
  eq('C6 IFC2X3 zonder vrager: niets opgeslagen', c6a, null);
  eq('C6 IFC2X3 zonder vrager: vraag staat nog open', S().project.ifcSchemaUnconfirmed, 'IFC2X3');
  setIfcSchemaAsker(async (question) => { asked.push(question); return answers.shift() ?? null; });
  asked.length = 0; answers = ['IFC4X3'];
  const c6b = await save();
  eq('C6 IFC2X3: vraag zonder houden', asked.map(q => [q.fileSchema, q.keep]), [['IFC2X3', null]]);
  eq('C6 IFC2X3 → IFC 4.3: kop IFC4X3', c6b && header(c6b), 'IFC4X3');

  // C7 — een IFC4-bestand dat de terugval zonder vrager gewoon houdt (schrijfbaar schema).
  await open(ifc4File, 'model-ifc4.ifc');
  resetIfcSchemaAsker();
  const c7 = await save();
  eq('C7 IFC4 zonder vrager: houdt IFC4', c7 && header(c7), 'IFC4');
  setIfcSchemaAsker(async (question) => { asked.push(question); return answers.shift() ?? null; });

  // C8 — Projectinfo: een schemakeuze is het antwoord; undo brengt de vraag niet terug (zie D).
  await open(ifc4File, 'model-ifc4.ifc');
  const patch = projectInfoPatch(S().project, { ...S().project, ifcSchema: 'IFC4X3_ADD2' });
  eq('C8 patch: schema ADD2 en de vraag vervalt', [patch.ifcSchema, 'ifcSchemaUnconfirmed' in patch, patch.ifcSchemaUnconfirmed], ['IFC4X3_ADD2', true, undefined]);
  S().applyProjectInfo(patch, undefined);
  eq('C8 na Toepassen: geen open vraag', S().project.ifcSchemaUnconfirmed, undefined);
  eq('C8 na Toepassen: document gewijzigd', S().isDirty, true);
  asked.length = 0;
  const c8 = await save();
  eq('C8 Ctrl+S na Projectinfo: geen vraag', asked.length, 0);
  eq('C8 Ctrl+S na Projectinfo: kop IFC4X3_ADD2', c8 && header(c8), 'IFC4X3_ADD2');
  S().undo();
  eq('C8 undo: het schema blijft ADD2 en de vraag komt niet terug', [S().project.ifcSchema, S().project.ifcSchemaUnconfirmed], ['IFC4X3_ADD2', undefined]);

  // C9 — crashherstel en MCP-backup schrijven via dezelfde invoer zonder vraag; de vraag blijft bewaard.
  await open(withHeader(OLD_FILE, 'IFC2X3'), 'oud-2x3.ifc');
  asked.length = 0;
  const snapshot = writeIFC(buildWriteIFCInput(S(), 'merge'));
  eq('C9 herstelsnapshot: geen vraag gesteld', asked.length, 0);
  eq('C9 herstelsnapshot: kop is de standaard', header(snapshot), 'IFC4X3_ADD2');
  eq('C9 herstelsnapshot: de vraag IFC2X3 blijft bewaard', readIFC(snapshot).project.ifcSchemaUnconfirmed, 'IFC2X3');
}

// ═══ D. Ongedaan maken verandert het schema nooit (review #336 punt 2) ═══════════════════════
{
  // Wat AutoSave naar het bestand zou schrijven (`useAutoSave` gebruikt dezelfde invoer).
  const autoSave = () => ({ header: header(writeIFC(buildWriteIFCInput(S(), 'merge'))), blocked: ifcSchemaBlocksSilentWrite(S().project) });
  const schemaState = () => [S().project.ifcSchema, S().project.ifcSchemaUnconfirmed];
  const hasTask = (name: string) => S().tasks.some(t => t.name === name);

  // D1 — de reviewproef probe1 P1: een oud OPS-bestand (IFC4X3), bewerken, opslaan met ADD2, undo, redo.
  await open(OLD_FILE, 'oud.ifc');
  S().addTask({ name: 'D1 taak' });
  asked.length = 0; answers = ['IFC4X3_ADD2'];
  const d1 = await save();
  eq('D1 antwoord ADD2: kop ADD2', d1 && header(d1), 'IFC4X3_ADD2');
  S().undo();
  eq('D1 undo: de bewerking is terug', hasTask('D1 taak'), false);
  eq('D1 undo: schema ADD2, geen vraag', schemaState(), ['IFC4X3_ADD2', undefined]);
  eq('D1 undo: AutoSave schrijft ADD2', autoSave(), { header: 'IFC4X3_ADD2', blocked: false });
  S().redo();
  eq('D1 redo: de bewerking is er weer', hasTask('D1 taak'), true);
  eq('D1 redo: schema ADD2, geen vraag', schemaState(), ['IFC4X3_ADD2', undefined]);
  asked.length = 0;
  const d1b = await save();
  eq('D1 Ctrl+S na undo en redo: geen vraag, kop ADD2', [asked.length, d1b && header(d1b)], [0, 'IFC4X3_ADD2']);

  // D2 — probe1 P2: een IFC4-bestand, bewerken, opslaan met ADD2, undo voorbij het opslaan.
  await open(withHeader(OLD_FILE, 'IFC4'), 'model.ifc');
  S().addTask({ name: 'D2 taak' });
  answers = ['IFC4X3_ADD2'];
  await save();
  S().undo();
  eq('D2 undo: schema ADD2, geen vraag', schemaState(), ['IFC4X3_ADD2', undefined]);

  // D3 — houden: undo laat het gehouden schema staan, zonder vraag.
  await open(withHeader(OLD_FILE, 'IFC4'), 'model.ifc');
  S().addTask({ name: 'D3 taak' });
  answers = ['IFC4'];
  await save();
  S().undo();
  eq('D3 undo na houden: IFC4, geen vraag', schemaState(), ['IFC4', undefined]);
  eq('D3 undo na houden: AutoSave schrijft IFC4', autoSave(), { header: 'IFC4', blocked: false });

  // D4 — IFC2X3: na het antwoord brengt undo de blokkade en de vraag niet terug.
  await open(withHeader(OLD_FILE, 'IFC2X3'), 'oud-2x3.ifc');
  S().addTask({ name: 'D4 taak' });
  answers = ['IFC4X3'];
  await save();
  S().undo();
  eq('D4 undo na IFC2X3 → IFC 4.3: schema IFC4X3, geen vraag', schemaState(), ['IFC4X3', undefined]);
  eq('D4 undo: AutoSave schrijft IFC4X3', autoSave(), { header: 'IFC4X3', blocked: false });

  // D5 — Projectinfo: een schemakeuze is geen undo-stap. Undo daarna raakt alleen de vorige bewerking.
  await open(withHeader(OLD_FILE, 'IFC4'), 'model.ifc');
  S().addTask({ name: 'D5 taak' });
  const events = S().historyEvents.length;
  S().applyProjectInfo(projectInfoPatch(S().project, { ...S().project, ifcSchema: 'IFC4X3_ADD2' }), undefined);
  eq('D5 schemakeuze: geen nieuw undo-event', S().historyEvents.length, events);
  eq('D5 schemakeuze: schema ADD2, vraag weg, document gewijzigd', [...schemaState(), S().isDirty], ['IFC4X3_ADD2', undefined, true]);
  S().undo();
  eq('D5 undo: de taak is weg, het schema blijft ADD2', [hasTask('D5 taak'), ...schemaState()], [false, 'IFC4X3_ADD2', undefined]);

  // D6 — Projectinfo met naam én schema: één undo-stap voor de naam; undo zet de naam terug, niet het schema.
  const nameBefore = S().project.name;
  S().applyProjectInfo(projectInfoPatch(S().project, { ...S().project, name: 'D6 naam', ifcSchema: 'IFC4' }), undefined);
  eq('D6 naam en schema toegepast', [S().project.name, S().project.ifcSchema], ['D6 naam', 'IFC4']);
  S().undo();
  eq('D6 undo: naam terug, schema blijft IFC4', [S().project.name, S().project.ifcSchema], [nameBefore, 'IFC4']);
  S().redo();
  eq('D6 redo: naam weer, schema IFC4', [S().project.name, S().project.ifcSchema], ['D6 naam', 'IFC4']);

  // D7 — herbeoordeling #336: alleen een echte keuze telt. Een patch met hetzelfde schema (het hele
  // project terug, met een andere naam) of met `ifcSchema: undefined` beantwoordt de open vraag niet.
  await open(withHeader(OLD_FILE, 'IFC4'), 'model.ifc');
  S().setProject({ ...S().project, name: 'D7 naam' });
  eq('D7a setProject met het hele project: naam gewijzigd, vraag IFC4 blijft open',
    [S().project.name, ...schemaState()], ['D7 naam', 'IFC4', 'IFC4']);
  S().applyProjectInfo({ ...S().project, name: 'D7b naam' }, undefined);
  eq('D7b applyProjectInfo met het hele project: vraag IFC4 blijft open',
    [S().project.name, ...schemaState()], ['D7b naam', 'IFC4', 'IFC4']);
  await open(withHeader(OLD_FILE, 'IFC2X3'), 'oud-2x3.ifc');
  S().setProject({ ...S().project, ifcSchema: undefined, name: 'D7c naam' });
  eq('D7c IFC2X3 met ifcSchema undefined in de patch: vraag en AutoSave-blokkade blijven',
    [S().project.name, ...schemaState(), autoSave().blocked], ['D7c naam', undefined, 'IFC2X3', true]);
  // Een ander schema blijft wél een keuze: ook ADD2 voor een document dat nog geen schema heeft.
  S().setProject({ ifcSchema: 'IFC4X3_ADD2' });
  eq('D7d IFC2X3 met een expliciete keuze ADD2: schema ADD2, vraag weg, niet meer geblokkeerd',
    [...schemaState(), autoSave().blocked], ['IFC4X3_ADD2', undefined, false]);
}

// ═══ E. Exporteren naar een nieuw bestand (review #336 punt 4) ═══════════════════════════════
{
  const exported = async (format: 'ifc' | 'pool') => {
    const n = blobs.length;
    const result = format === 'ifc' ? await S().exportAs('ifc') : await S().exportProjectWithPool();
    return { ok: result.ok, ifc: blobs.length > n ? await blobs[n].text() : null };
  };
  for (const format of ['ifc', 'pool'] as const) {
    await open(withHeader(OLD_FILE, 'IFC2X3'), 'oud-2x3.ifc');
    asked.length = 0;
    const e1 = await exported(format);
    eq(`E1 ${format}: IFC2X3-document exporteren vraagt niets`, [e1.ok, asked.length], [true, 0]);
    eq(`E1 ${format}: de export is IFC 4.3 ADD2`, e1.ifc && header(e1.ifc), 'IFC4X3_ADD2');
    truthy(`E1 ${format}: geen markering IFC2X3 die niet bij de kop past`, !!e1.ifc && !hasProp(e1.ifc, 'IfcSchemaUnconfirmed'));
    eq(`E1 ${format}: heropenen van de export vraagt niets`, e1.ifc && readIFC(e1.ifc).project.ifcSchemaUnconfirmed, undefined);
    eq(`E1 ${format}: het document houdt zijn vraag`, S().project.ifcSchemaUnconfirmed, 'IFC2X3');
  }
  // Een open vraag over een schema dat de app wel schrijft, past bij de kop en gaat mee.
  await open(withHeader(OLD_FILE, 'IFC4'), 'model.ifc');
  const e2 = await exported('ifc');
  eq('E2 IFC4-document: export met kop IFC4 en de open vraag IFC4', [e2.ifc && header(e2.ifc), e2.ifc && readIFC(e2.ifc).project.ifcSchemaUnconfirmed], ['IFC4', 'IFC4']);
}

resetIfcSchemaAsker();
if (diffs.length === 0) {
  console.log(`OK  ifc-schema-question: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-schema-question: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
