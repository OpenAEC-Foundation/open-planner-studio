// Slepen en neerzetten van bestanden (issue #771): de ontvangstkant en de route naar Bestand → Openen.
//
//  A. `isReadableFileName`: strikt op de extensie, zonder de IFC-terugval van `readFormatForFile`.
//  B. Browser: `droppedFilesFromDataTransfer` vraagt de handles synchroon, slaat niet-bestanden over,
//     geeft een bestandshandle als ref en leest binaire formaten als bytes.
//  C. Desktop: `droppedFilesFromPaths` leest via dezelfde kern als de open-dialoog (pad als ref).
//  D. `openDroppedFiles` tegen de echte store: volgorde, een project met wijzigingen blijft staan, een
//     leeg tabblad wordt hergebruikt, geweigerde formaten worden nooit gelezen, een leesfout stopt de
//     rest niet. De poort (zoals Ctrl+O) wordt bij het neerzetten gevraagd en opnieuw vlak vóór elk
//     document: een dialoog die tijdens het lezen opent, of de formaatuitleg van het vorige bestand,
//     laat het document wachten. Geen bestand verdwijnt zonder melding: een onbekend formaat en een
//     dichte poort geven elk één melding met de namen.
//
// Draait via run.sh. Exit 0 = alles groen.

// ── Omgeving vóór de eerste store-import ────────────────────────────────────────────────────────
const g = globalThis as unknown as Record<string, unknown>;
g.window = g.window ?? {}; // geen __TAURI_INTERNALS__, geen showOpenFilePicker
g.document = { documentElement: { dir: 'ltr', lang: 'en' } };

const { isReadableFileName } = await import('@/services/formatRegistry');
const {
  dragCarriesFiles, droppedFilesFromDataTransfer, droppedFilesFromPaths, splitDroppedFiles,
} = await import('@/services/fileAccess/fileDrop');
type DroppedFile = import('@/services/fileAccess/fileDrop').DroppedFile;
const { openDroppedFiles, fileNameList } = await import('@/state/fileDrop');
const { OPEN_WAIT_POLL_MS } = await import('@/state/slices/fileSlice');
const { isBlockingDialogOpen } = await import('@/state/blockingDialogs');
const { useAppStore } = await import('@/state/appStore');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { writeCSV } = await import('@/services/csv/csvWriter');
const { buildImportLabels } = await import('@/i18n/importLabels');

const S = () => useAppStore.getState();
const labels = buildImportLabels((key) => key);

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'OK ' : 'XX '} file-drop: ${label}`);
  if (!ok) failures++;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── A. Welke bestanden kan de app openen ────────────────────────────────────────────────────────
for (const name of ['plan.ifc', 'PLAN.IFC', 'p6.xer', 'msp.mpp', 'export.xml', 'lijst.csv', 'C:\\map\\Plan.XER', '/home/a/plan.v2.ifc']) {
  check(isReadableFileName(name), `opent ${name}`);
}
for (const name of ['tekening.pdf', 'ifc', 'notities', 'plan.ifc.bak', 'blad.xlsx', 'map.ifc/', '']) {
  check(!isReadableFileName(name), `weigert ${JSON.stringify(name)}`);
}

// ── B. Browser: DataTransfer ────────────────────────────────────────────────────────────────────
check(dragCarriesFiles({ types: ['Files'] }), 'een sleep met bestanden telt');
check(!dragCarriesFiles({ types: ['text/plain'] }), 'een sleep zonder bestanden (kolomkop, tekst) telt niet');
check(!dragCarriesFiles(null), 'geen DataTransfer telt niet');

{
  const xerBytes = new Uint8Array([0x45, 0x52, 0x4d, 0x48, 0xff]);
  const ifcFile = new File(['ISO-10303-21;'], 'plan.ifc');
  const xerFile = new File([xerBytes], 'p6.xer');
  const csvFile = new File(['Name\n'], 'lijst.csv');
  const ifcHandle = { kind: 'file', name: 'plan.ifc' };
  let handleCalls = 0;
  const items = [
    { kind: 'file', getAsFile: () => ifcFile, getAsFileSystemHandle: () => { handleCalls++; return Promise.resolve(ifcHandle); } },
    { kind: 'string', getAsFile: () => null, getAsFileSystemHandle: () => { handleCalls++; return Promise.resolve(null); } },
    { kind: 'file', getAsFile: () => xerFile, getAsFileSystemHandle: () => { handleCalls++; return Promise.reject(new Error('geweigerd')); } },
    { kind: 'file', getAsFile: () => null, getAsFileSystemHandle: () => { handleCalls++; return Promise.resolve(null); } },
    { kind: 'file', getAsFile: () => csvFile, getAsFileSystemHandle: () => { handleCalls++; return Promise.resolve({ kind: 'directory', name: 'x' }); } },
    // Een browser die synchroon gooit (bijv. een DataTransfer die niet uit een echte sleep komt).
    { kind: 'file', getAsFile: () => ifcFile, getAsFileSystemHandle: () => { handleCalls++; throw new Error('InvalidStateError'); } },
  ];
  const dropped = droppedFilesFromDataTransfer({ types: ['Files'], items: items as never });
  check(handleCalls === 4, `de handles zijn synchroon gevraagd, één per item met een bestand (${handleCalls})`);
  check(same(dropped.map((f) => f.name), ['plan.ifc', 'p6.xer', 'lijst.csv', 'plan.ifc']), 'tekst- en lege items vallen weg, volgorde blijft');
  const [ifc, xer, csv, thrown] = await Promise.all(dropped.map((f) => f.read()));
  check(ifc.content === 'ISO-10303-21;' && ifc.ref?.kind === 'handle' && ifc.ref.handle === (ifcHandle as unknown), 'IFC: tekst, met de bestandshandle als ref');
  check(xer.content === '' && same(Array.from(xer.bytes ?? []), Array.from(xerBytes)) && xer.ref === null, 'XER: bytes; een geweigerde handle geeft ref null');
  check(csv.content === 'Name\n' && csv.ref === null, 'een maphandle is geen opslagdoel');
  check(thrown.content === 'ISO-10303-21;' && thrown.ref === null, 'een handlevraag die synchroon gooit: het bestand komt toch, zonder ref');

  const fromFiles = droppedFilesFromDataTransfer({ types: ['Files'], items: [], files: [ifcFile] });
  check(fromFiles.length === 1 && (await fromFiles[0].read()).ref === null, 'zonder items (oudere browser): de bestandslijst, zonder ref');
}

// ── C. Desktop: paden uit Tauri ─────────────────────────────────────────────────────────────────
{
  const calls: string[] = [];
  const io = {
    readTextFile: async (p: string) => { calls.push(`text:${p}`); return 'tekst'; },
    readFile: async (p: string) => { calls.push(`bytes:${p}`); return new Uint8Array([1, 2]); },
  };
  const dropped = droppedFilesFromPaths(['C:\\werk\\Plan.MPP', '/home/a/plan.ifc', 'D:\\x\\tekening.pdf'], io);
  check(same(dropped.map((f) => f.name), ['Plan.MPP', 'plan.ifc', 'tekening.pdf']), 'namen uit Windows- en Unix-paden');
  check(calls.length === 0, 'nog niets gelezen vóór read()');
  const mpp = await dropped[0].read();
  const ifc = await dropped[1].read();
  check(same(calls, ['bytes:C:\\werk\\Plan.MPP', 'text:/home/a/plan.ifc']), `binair als bytes, IFC als tekst (${calls.join(', ')})`);
  check(mpp.ref?.kind === 'path' && mpp.ref.path === 'C:\\werk\\Plan.MPP' && mpp.bytes?.length === 2, '.mpp: het pad als ref');
  check(ifc.ref?.kind === 'path' && ifc.content === 'tekst', '.ifc: het pad als ref');
  const split = splitDroppedFiles(dropped);
  check(same(split.openable.map((f) => f.name), ['Plan.MPP', 'plan.ifc']) && same(split.refused, ['tekening.pdf']), 'splitsen in openen en weigeren');
}

// ── D. De route naar Bestand → Openen, tegen de echte store ─────────────────────────────────────
function projectText(name: string, taskName: string, as: 'ifc' | 'csv'): string {
  S().newProject();
  S().setProject({ name, startDate: '2026-08-03' });
  S().addTask({ name: taskName });
  const s = S();
  return as === 'ifc' ? writeIFC(buildWriteIFCInput(s)) : writeCSV(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments);
}
const ifcA = projectText('Sleep-A', 'Taak A', 'ifc');
const csvB = projectText('Sleep-B', 'Taak B', 'csv');

const reads: string[] = [];
function dropFile(name: string, content: string | Error): DroppedFile {
  return {
    name,
    read: async () => {
      reads.push(name);
      if (content instanceof Error) throw content;
      return { name, content, ref: null };
    },
  };
}
const documentNames = () => S().getOpenDocuments().map((d) => d.title);
const noticesOf = (key: string) => S().ui.notifications.filter((n) => n.messageKey === key);
// De store houdt hoogstens `MAX_NOTIFICATIONS` (3) meldingen; tel daarom vanaf een lege lijst.
const clearNotices = () => { for (const n of [...S().ui.notifications]) S().dismissNotification(n.id); };

const closeFormatNotice = () => S().setUI({ pendingFormatNotice: null }); // "Begrepen" in de uitleg
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(ok: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(20);
  if (!ok()) check(false, `wachten op: ${label}`);
}

check(fileNameList(['a.pdf']) === 'a.pdf' && fileNameList(['1', '2', '3', '4', '5']) === '1, 2, 3, 4, 5'
  && fileNameList(['1', '2', '3', '4', '5', '6', '7']) === '1, 2, 3, 4, 5, …', 'de namen in de melding: hoogstens vijf');

{
  // Een project met wijzigingen staat open.
  S().newProject();
  S().setProject({ name: 'Mijn werk', startDate: '2026-08-03' });
  S().addTask({ name: 'Niet opgeslagen' });
  const workId = S().activeDocumentId;
  check(S().isDirty, 'beginstand: het actieve project heeft wijzigingen');
  const before = S().documents.length;
  let gateCalls = 0;
  reads.length = 0;
  await openDroppedFiles(useAppStore, [
    dropFile('a.ifc', ifcA), dropFile('tekening.pdf', 'nooit gelezen'), dropFile('b.csv', csvB),
  ], labels, () => { gateCalls++; return false; });
  check(gateCalls === 3, `de poort is gevraagd bij het neerzetten en vlak vóór elk document (${gateCalls})`);
  check(same(reads, ['a.ifc', 'b.csv']), `alleen de bekende formaten zijn gelezen, in volgorde (${reads.join(', ')})`);
  check(S().documents.length === before + 2, `twee nieuwe tabbladen (${before} → ${S().documents.length}: ${documentNames().join(' | ')})`);
  check(S().tasks.length === 1 && S().tasks[0].name === 'Taak B' && S().documents.at(-1)?.id === S().activeDocumentId,
    'het laatst neergezette bestand is actief, in het laatste tabblad');
  const work = S().getOpenDocuments().find((d) => d.id === workId);
  check(!!work && work.isDirty, 'het project met wijzigingen staat nog open, met zijn wijzigingen');
  check(S().getOpenDocumentPayloads().some(({ payload }) => payload.project.name === 'Sleep-A' && payload.filePath === 'a.ifc'),
    'het IFC-bestand kreeg zijn opslagdoel (zoals Bestand → Openen)');
  check(S().filePath === null, 'het CSV-bestand kreeg geen opslagdoel (zoals Bestand → Openen)');
  check(S().ui.pendingFormatNotice === 'csv', `de CSV krijgt de formaatuitleg, zoals bij Bestand → Openen (${S().ui.pendingFormatNotice})`);
  const refusedNotes = noticesOf('notifications.fileDropRefused');
  check(refusedNotes.length === 1 && refusedNotes[0].severity === 'error' && refusedNotes[0].params?.names === 'tekening.pdf'
    && refusedNotes[0].helpArticleId === 'howto-bestand-openen-en-opslaan',
  `het onbekende formaat is gemeld, met de naam en de gids (${JSON.stringify(refusedNotes)})`);
  closeFormatNotice();
}

{
  // Alleen onbekende formaten: niets gelezen of geopend, wel één melding met alle namen.
  clearNotices();
  const before = documentNames();
  reads.length = 0;
  await openDroppedFiles(useAppStore, [dropFile('tekening.pdf', 'x'), dropFile('notities', 'y')], labels, () => false);
  const refusedNotes = noticesOf('notifications.fileDropRefused');
  check(reads.length === 0 && same(documentNames(), before), 'alleen onbekende formaten: niets gelezen of geopend');
  check(refusedNotes.length === 1 && refusedNotes[0].params?.names === 'tekening.pdf, notities',
    `één melding voor alle onbekende bestanden (${JSON.stringify(refusedNotes.map((n) => n.params))})`);
}

{
  // Een leeg, ongewijzigd tabblad wordt hergebruikt, net als bij Bestand → Openen.
  S().newProject();
  const before = S().documents.length;
  const pristineId = S().activeDocumentId;
  await openDroppedFiles(useAppStore, [dropFile('a.ifc', ifcA)], labels, () => false);
  check(S().documents.length === before && S().activeDocumentId === pristineId && S().project.name === 'Sleep-A',
    'het lege actieve tabblad is hergebruikt');
}

{
  // Poort dicht bij het neerzetten (dialoog open, wachtende vraag): niets gelezen, niets geopend.
  clearNotices();
  const before = documentNames();
  reads.length = 0;
  await openDroppedFiles(useAppStore, [dropFile('a.ifc', ifcA)], labels, () => true);
  check(reads.length === 0 && same(documentNames(), before), 'poort dicht: niets gelezen of geopend');
  const blockedNotes = noticesOf('notifications.fileDropBlocked');
  check(blockedNotes.length === 1 && blockedNotes[0].severity === 'error' && blockedNotes[0].params?.names === 'a.ifc',
    `poort dicht: één melding met de naam (${JSON.stringify(blockedNotes)})`);
  let asked = false;
  await openDroppedFiles(useAppStore, [], labels, () => { asked = true; return true; });
  check(!asked && same(documentNames(), before), 'geen bestanden: de poort wordt niet gevraagd');
}

{
  // De planner opent "Taak bewerken" terwijl het bestand nog gelezen wordt (review #801). De
  // documentwissel zou die dialoog sluiten en zijn invoer weggooien (`resetDocumentScopedUI`), dus het
  // document wacht tot de dialoog dicht is. De poort is hier de echte dialoogtoets van de store.
  clearNotices();
  S().addTask({ name: 'In bewerking' });
  const taskId = S().tasks.at(-1)!.id;
  const before = S().documents.length;
  const activeBefore = S().activeDocumentId;
  let release: () => void = () => { throw new Error('read() is nog niet aangeroepen'); };
  const slow: DroppedFile = {
    name: 'traag.ifc',
    read: () => new Promise((resolve) => { release = () => resolve({ name: 'traag.ifc', content: ifcA, ref: null }); }),
  };
  const done = openDroppedFiles(useAppStore, [slow], labels, () => isBlockingDialogOpen(S().ui));
  S().setUI({ showTaskDialog: true, editingTaskId: taskId });
  release();
  await sleep(OPEN_WAIT_POLL_MS * 3);
  check(S().documents.length === before && S().activeDocumentId === activeBefore
    && S().ui.showTaskDialog && S().ui.editingTaskId === taskId,
  'dialoog geopend tijdens het lezen: geen documentwissel, de dialoog blijft open met zijn taak');
  S().setUI({ showTaskDialog: false, editingTaskId: null });
  await done;
  check(S().documents.length === before + 1 && S().project.name === 'Sleep-A', 'dialoog dicht: daarna opent het document');
}

{
  // Twee CSV-bestanden: elk krijgt zijn eigen formaatuitleg. Het tweede wacht tot de planner de uitleg
  // van het eerste sluit; anders overschreef het de ene plek `pendingFormatNotice` (review #801).
  clearNotices();
  closeFormatNotice();
  const before = S().documents.length;
  const done = openDroppedFiles(useAppStore, [dropFile('een.csv', csvB), dropFile('twee.csv', csvB)], labels, () => false);
  await until(() => S().ui.pendingFormatNotice !== null, 'de uitleg van het eerste bestand');
  await sleep(OPEN_WAIT_POLL_MS * 3);
  check(S().documents.length === before + 1 && S().ui.pendingFormatNotice === 'csv',
    `eerste CSV open met zijn uitleg; de tweede wacht (${before} → ${S().documents.length})`);
  closeFormatNotice();
  await done;
  check(S().documents.length === before + 2 && S().ui.pendingFormatNotice === 'csv',
    'na "Begrepen" opent de tweede CSV, met zijn eigen uitleg');
  closeFormatNotice();
}

{
  // Twee neerzettingen tegelijk, waarvan het lezen in dezelfde beurt klaar is (review ronde 2): de
  // laatste controle en het activeren gebeuren in één synchrone stap, dus de tweede ziet de uitleg van
  // de eerste en wacht. Met de controle in een aparte `await` vóór het activeren gingen beide door.
  clearNotices();
  closeFormatNotice();
  const before = S().documents.length;
  const releases: (() => void)[] = [];
  const slowCsv = (name: string): DroppedFile => ({
    name,
    read: () => new Promise((resolve) => { releases.push(() => resolve({ name, content: csvB, ref: null })); }),
  });
  const first = openDroppedFiles(useAppStore, [slowCsv('een.csv')], labels, () => false);
  const second = openDroppedFiles(useAppStore, [slowCsv('twee.csv')], labels, () => false);
  for (const release of releases) release();
  await until(() => S().documents.length > before, 'het eerste document');
  await sleep(OPEN_WAIT_POLL_MS * 3);
  check(S().documents.length === before + 1 && S().ui.pendingFormatNotice === 'csv',
    `twee neerzettingen tegelijk: de tweede wacht op de uitleg van de eerste (${before} → ${S().documents.length})`);
  closeFormatNotice();
  await Promise.all([first, second]);
  check(S().documents.length === before + 2 && S().ui.pendingFormatNotice === 'csv',
    'twee neerzettingen tegelijk: na "Begrepen" opent de tweede, met zijn eigen uitleg');
  closeFormatNotice();
}

{
  // Een bestand dat niet te lezen is: melding, en de rest gaat door.
  clearNotices();
  const before = S().documents.length;
  reads.length = 0;
  await openDroppedFiles(useAppStore, [
    dropFile('weg.ifc', new Error('Permission denied (os error 13)')), dropFile('b.csv', csvB),
  ], labels, () => false);
  const errors = S().ui.notifications.filter((n) => n.severity === 'error');
  check(same(reads, ['weg.ifc', 'b.csv']) && errors.length === 1 && (errors[0].detail ?? '').includes('os error 13'),
    `de leesfout is gemeld, met de reden (${JSON.stringify(errors.map((n) => n.detail))})`);
  check(S().documents.length === before + 1, 'het volgende bestand is wel geopend');
  closeFormatNotice();
}

{
  // Een bestand met een bekende extensie maar kapotte inhoud: de openroute meldt het zelf.
  clearNotices();
  const before = S().documents.length;
  await openDroppedFiles(useAppStore, [dropFile('kapot.ifc', 'geen ifc')], labels, () => false);
  check(S().documents.length === before, 'kapotte inhoud: geen nieuw tabblad');
  check(S().ui.notifications.length === 1 && S().ui.notifications[0].severity === 'error', 'kapotte inhoud: één foutmelding van de openroute');
}

console.log(failures === 0 ? 'file-drop: alles groen' : `file-drop: ${failures} fout(en)`);
process.exit(failures === 0 ? 0 : 1);
