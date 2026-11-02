// Slepen en neerzetten van bestanden (issue #771): de ontvangstkant en de route naar Bestand → Openen.
//
//  A. `isReadableFileName`: strikt op de extensie, zonder de IFC-terugval van `readFormatForFile`.
//  B. Browser: `droppedFilesFromDataTransfer` vraagt de handles synchroon, slaat niet-bestanden over,
//     geeft een bestandshandle als ref en leest binaire formaten als bytes.
//  C. Desktop: `droppedFilesFromPaths` leest via dezelfde kern als de open-dialoog (pad als ref).
//  D. `openDroppedFiles` tegen de echte store: volgorde, een project met wijzigingen blijft staan, een
//     leeg tabblad wordt hergebruikt, geweigerde formaten worden nooit gelezen, een leesfout stopt de
//     rest niet, en de poort (zoals Ctrl+O) wordt één keer gevraagd.
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
const { openDroppedFiles } = await import('@/state/fileDrop');
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
  ];
  const dropped = droppedFilesFromDataTransfer({ types: ['Files'], items: items as never });
  check(handleCalls === 3, `de handles zijn synchroon gevraagd, één per item met een bestand (${handleCalls})`);
  check(same(dropped.map((f) => f.name), ['plan.ifc', 'p6.xer', 'lijst.csv']), 'tekst- en lege items vallen weg, volgorde blijft');
  const [ifc, xer, csv] = await Promise.all(dropped.map((f) => f.read()));
  check(ifc.content === 'ISO-10303-21;' && ifc.ref?.kind === 'handle' && ifc.ref.handle === (ifcHandle as unknown), 'IFC: tekst, met de bestandshandle als ref');
  check(xer.content === '' && same(Array.from(xer.bytes ?? []), Array.from(xerBytes)) && xer.ref === null, 'XER: bytes; een geweigerde handle geeft ref null');
  check(csv.content === 'Name\n' && csv.ref === null, 'een maphandle is geen opslagdoel');

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
  const outcome = await openDroppedFiles(useAppStore, [
    dropFile('a.ifc', ifcA), dropFile('tekening.pdf', 'nooit gelezen'), dropFile('b.csv', csvB),
  ], labels, () => { gateCalls++; return false; });
  check(gateCalls === 1, `de poort is één keer gevraagd (${gateCalls})`);
  check(same(reads, ['a.ifc', 'b.csv']), `alleen de bekende formaten zijn gelezen, in volgorde (${reads.join(', ')})`);
  check(same(outcome, { blocked: false, opened: ['a.ifc', 'b.csv'], unreadable: [], refused: ['tekening.pdf'] }), `uitkomst ${JSON.stringify(outcome)}`);
  check(S().documents.length === before + 2, `twee nieuwe tabbladen (${before} → ${S().documents.length}: ${documentNames().join(' | ')})`);
  check(S().tasks.length === 1 && S().tasks[0].name === 'Taak B' && S().documents.at(-1)?.id === S().activeDocumentId,
    'het laatst neergezette bestand is actief, in het laatste tabblad');
  const work = S().getOpenDocuments().find((d) => d.id === workId);
  check(!!work && work.isDirty, 'het project met wijzigingen staat nog open, met zijn wijzigingen');
  check(S().getOpenDocumentPayloads().some(({ payload }) => payload.project.name === 'Sleep-A' && payload.filePath === 'a.ifc'),
    'het IFC-bestand kreeg zijn opslagdoel (zoals Bestand → Openen)');
  check(S().filePath === null, 'het CSV-bestand kreeg geen opslagdoel (zoals Bestand → Openen)');
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
  // Poort dicht (dialoog open, wachtende vraag): niets gelezen, niets geopend.
  const before = documentNames();
  reads.length = 0;
  const outcome = await openDroppedFiles(useAppStore, [dropFile('a.ifc', ifcA)], labels, () => true);
  check(outcome.blocked && reads.length === 0 && same(documentNames(), before), 'poort dicht: niets gelezen of geopend');
  const empty = await openDroppedFiles(useAppStore, [], labels, () => { throw new Error('niet vragen'); });
  check(!empty.blocked && empty.opened.length === 0, 'geen bestanden: de poort wordt niet gevraagd');
}

{
  // Een bestand dat niet te lezen is: melding, en de rest gaat door.
  const notes = S().ui.notifications.length;
  const before = S().documents.length;
  const outcome = await openDroppedFiles(useAppStore, [
    dropFile('weg.ifc', new Error('Permission denied (os error 13)')), dropFile('b.csv', csvB),
  ], labels, () => false);
  check(same(outcome.unreadable, ['weg.ifc']) && same(outcome.opened, ['b.csv']), `leesfout: ${JSON.stringify(outcome)}`);
  const last = S().ui.notifications.at(-1);
  check(S().ui.notifications.length === notes + 1 && last?.severity === 'error' && (last.detail ?? '').includes('os error 13'),
    'de leesfout is gemeld, met de reden');
  check(S().documents.length === before + 1, 'het volgende bestand is wel geopend');
}

{
  // Een bestand met een bekende extensie maar kapotte inhoud: de openroute meldt het zelf.
  const notes = S().ui.notifications.length;
  const before = S().documents.length;
  const outcome = await openDroppedFiles(useAppStore, [dropFile('kapot.ifc', 'geen ifc')], labels, () => false);
  check(same(outcome.opened, ['kapot.ifc']) && S().documents.length === before, 'kapotte inhoud: geen nieuw tabblad');
  check(S().ui.notifications.length === notes + 1 && S().ui.notifications.at(-1)?.severity === 'error', 'kapotte inhoud: één foutmelding van de openroute');
}

console.log(failures === 0 ? 'file-drop: alles groen' : `file-drop: ${failures} fout(en)`);
process.exit(failures === 0 ? 0 : 1);
