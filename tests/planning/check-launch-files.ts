const g = globalThis as unknown as Record<string, unknown>;
g.window = g.window ?? {};
g.document = { documentElement: { dir: 'ltr', lang: 'en' } };

const {
  OPEN_FILES_EVENT, OPEN_FILES_READY_EVENT, launchPaths, listenForLaunchFiles, openLaunchFiles,
} = await import('@/state/launchFiles');
const { OPEN_WAIT_POLL_MS } = await import('@/state/slices/fileSlice');
const { droppedFilesFromPaths } = await import('@/services/fileAccess/fileDrop');
const { openDroppedFiles } = await import('@/state/fileDrop');
const { useAppStore } = await import('@/state/appStore');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { buildImportLabels } = await import('@/i18n/importLabels');
const { runProjectFileWrite } = await import('@/services/fileAccess/writeCoordinator');

const S = () => useAppStore.getState();
const labels = buildImportLabels((key) => key);

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'OK ' : 'XX '} launch-files: ${label}`);
  if (!ok) failures++;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clearNotices = () => { for (const n of [...S().ui.notifications]) S().dismissNotification(n.id); };

{
  const order: string[] = [];
  let handler: ((payload: unknown) => void) | null = null;
  let stopped = false;
  const received: string[][] = [];
  const stop = await listenForLaunchFiles({
    listen: async (event, h) => { order.push(`listen:${event}`); handler = h; return () => { stopped = true; }; },
    emit: async (event) => { order.push(`emit:${event}`); },
  }, (paths) => received.push(paths));
  check(same(order, [`listen:${OPEN_FILES_EVENT}`, `emit:${OPEN_FILES_READY_EVENT}`]),
    `eerst luisteren, daarna klaar melden (${order.join(', ')})`);
  (handler as ((payload: unknown) => void) | null)?.(['/home/a/plan.ifc']);
  check(same(received, [['/home/a/plan.ifc']]), 'een event met paden komt bij de openroute');
  stop();
  check(stopped, 'stoppen meldt de luisteraar af');
}

check(same(launchPaths(['C:\\werk\\Plan.ifc', '/home/a/b.ifc']), ['C:\\werk\\Plan.ifc', '/home/a/b.ifc']), 'een lijst paden blijft gelijk');
check(same(launchPaths(['a.ifc', 3, null, '']), ['a.ifc']), 'geen tekst of lege tekst valt weg');
check(same(launchPaths('a.ifc'), []) && same(launchPaths(null), []) && same(launchPaths({ paths: ['a'] }), []),
  'iets anders dan een lijst geeft geen paden');

S().newProject();
S().setProject({ name: 'Startbestand', startDate: '2026-08-03' });
S().addTask({ name: 'Taak uit het bestand' });
const ifcText = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
S().addTask({ name: 'Opgeslagen taak' });
const ifcSavedText = writeIFC(buildWriteIFCInput(S(), 'planOnly'));

const files = new Map<string, string>([['/home/a/plan.ifc', ifcText], ['C:\\Users\\a\\Plan.ifc', ifcText]]);
const reads: string[] = [];
const notFound = (p: string) => new Error(`failed to open file at path: ${p} with error: No such file or directory (os error 2)`);
const io = {
  readTextFile: async (p: string) => { reads.push(p); const t = files.get(p); if (t === undefined) throw notFound(p); return t; },
  readFile: async (p: string) => { reads.push(p); throw notFound(p); },
  settle: async () => [],
};

{
  S().newProject();
  S().setProject({ name: 'Mijn werk', startDate: '2026-08-03' });
  S().addTask({ name: 'Niet opgeslagen' });
  const workId = S().activeDocumentId;
  const before = S().documents.length;
  clearNotices();
  await openLaunchFiles(useAppStore, ['/home/a/plan.ifc'], io, labels, () => false);
  check(S().documents.length === before + 1 && S().project.name === 'Startbestand', 'het bestand opent in een nieuw tabblad');
  check(S().filePath === '/home/a/plan.ifc', `het pad is het opslagdoel, zoals bij Bestand → Openen (${S().filePath})`);
  const work = S().getOpenDocuments().find((d) => d.id === workId);
  check(!!work && work.isDirty, 'het project met wijzigingen staat nog open, met zijn wijzigingen');
  await sleep(OPEN_WAIT_POLL_MS * 2);
  check(S().recentFiles.some((r) => r.ref.kind === 'path' && r.ref.path === '/home/a/plan.ifc'),
    'het bestand staat in Recent');
  check(S().ui.notifications.every((n) => n.severity !== 'error'), 'geen foutmelding');
}

{
  clearNotices();
  const before = S().documents.length;
  reads.length = 0;
  await openLaunchFiles(useAppStore, ['/home/a/weg.ifc', '/home/a/tekening.pdf'], io, labels, () => false);
  check(S().documents.length === before, 'geen nieuw tabblad');
  check(same(reads, ['/home/a/weg.ifc']), `alleen het IFC-pad is gelezen (${reads.join(', ')})`);
  const errors = S().ui.notifications.filter((n) => n.severity === 'error');
  check(errors.some((n) => (n.detail ?? '').includes('os error 2')), `het ontbrekende bestand is gemeld, met de reden (${JSON.stringify(errors.map((n) => n.detail))})`);
  check(errors.some((n) => n.messageKey === 'notifications.fileDropRefused' && n.params?.names === 'tekening.pdf'),
    'het onbekende formaat is gemeld met de gewone weigering');
}

{
  clearNotices();
  const before = S().documents.length;
  let blocked = true;
  const done = openLaunchFiles(useAppStore, ['C:\\Users\\a\\Plan.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 3);
  check(S().documents.length === before, 'venster open: het bestand wacht');
  check(!S().ui.notifications.some((n) => n.messageKey === 'notifications.fileDropBlocked'), 'venster open: geen weigering');
  blocked = false;
  await done;
  check(S().documents.length === before + 1 && S().filePath === 'C:\\Users\\a\\Plan.ifc', 'venster dicht: het bestand opent');
}

const planDoc = S().getOpenDocumentPayloads().find(({ payload }) => payload.filePath === '/home/a/plan.ifc');
check(!!planDoc, 'beginstand: /home/a/plan.ifc staat open');
const planOpen = () => S().getOpenDocumentPayloads().some(({ id, payload }) => id === planDoc?.id && payload.filePath === '/home/a/plan.ifc');
const tabsFor = (path: string) => S().getOpenDocumentPayloads().filter(({ payload }) => payload.filePath === path).length;
const freshTab = (label: string) => {
  S().newDocument();
  check(planOpen() && S().activeDocumentId !== planDoc?.id, `${label}: het IFC staat nog open, een ander tabblad is actief`);
  return S().activeDocumentId;
};

{
  clearNotices();
  freshTab('tweede dubbelklik');
  const before = S().documents.length;
  reads.length = 0;
  await openLaunchFiles(useAppStore, ['/home/a/plan.ifc'], io, labels, () => false);
  check(S().documents.length === before && tabsFor('/home/a/plan.ifc') === 1, `al open: geen nieuw tabblad (${before} → ${S().documents.length})`);
  check(S().activeDocumentId === planDoc?.id, 'al open: het tabblad van dat bestand is actief');
  check(same(reads, ['/home/a/plan.ifc']), `al open: gelezen zoals altijd, de beslissing valt bij het activeren (${reads.join(', ')})`);
}

{
  clearNotices();
  freshTab('via een link');
  files.set('/home/a/link/plan.ifc', ifcText);
  const identity = { stat: async (p: string) => {
    if (p === '/home/a/link/plan.ifc' || p === '/home/a/plan.ifc') return { isFile: true, dev: 1, ino: 42 };
    throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
  } };
  const before = S().documents.length;
  reads.length = 0;
  await openLaunchFiles(useAppStore, ['/home/a/link/plan.ifc'], io, labels, () => false, { identityFs: async () => identity });
  check(S().documents.length === before && S().activeDocumentId === planDoc?.id && tabsFor('/home/a/link/plan.ifc') === 0
    && !S().ui.notifications.some((n) => n.severity === 'error'),
  'via een link: hetzelfde bestand, dus naar het open tabblad, zonder foutmelding');
}

{
  const waitingId = freshTab('venster open');
  let blocked = true;
  const done = openLaunchFiles(useAppStore, ['/home/a/plan.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 3);
  check(S().activeDocumentId === waitingId, 'al open, venster open: nog geen wissel');
  blocked = false;
  await done;
  check(S().activeDocumentId === planDoc?.id, 'al open, venster dicht: dan de wissel');
}

{
  freshTab('nieuw + al open');
  files.set('/home/a/nieuw.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/nieuw.ifc', '/home/a/plan.ifc'], io, labels, () => false);
  check(tabsFor('/home/a/nieuw.ifc') === 1 && tabsFor('/home/a/plan.ifc') === 1, 'nieuw + al open: het nieuwe opent één keer, het open bestand niet nog eens');
  check(S().activeDocumentId === planDoc?.id, 'nieuw + al open: het laatst meegegeven bestand is actief');
}

{
  freshTab('twee keer in één event');
  files.set('/home/a/dubbel.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/dubbel.ifc', '/home/a/dubbel.ifc'], io, labels, () => false);
  check(tabsFor('/home/a/dubbel.ifc') === 1, `twee keer in één event: één tabblad (${tabsFor('/home/a/dubbel.ifc')})`);
}

{
  freshTab('twee events');
  files.set('/home/a/twee.ifc', ifcText);
  let blocked = true;
  const first = openLaunchFiles(useAppStore, ['/home/a/twee.ifc'], io, labels, () => blocked);
  const second = openLaunchFiles(useAppStore, ['/home/a/twee.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 2);
  check(tabsFor('/home/a/twee.ifc') === 0, 'twee events, venster open: nog niets geopend');
  blocked = false;
  await Promise.all([first, second]);
  check(tabsFor('/home/a/twee.ifc') === 1, `twee events: één tabblad (${tabsFor('/home/a/twee.ifc')})`);
  const twee = S().getOpenDocumentPayloads().find(({ payload }) => payload.filePath === '/home/a/twee.ifc');
  check(S().activeDocumentId === twee?.id, 'twee events: dat tabblad is actief');
}

{
  clearNotices();
  freshTab('ontbrekende map met ..');
  const before = S().documents.length;
  const activeBefore = S().activeDocumentId;
  reads.length = 0;
  await openLaunchFiles(useAppStore, ['/home/a/weg/../plan.ifc'], io, labels, () => false);
  check(same(reads, ['/home/a/weg/../plan.ifc']), `.. in het pad: gelezen zoals gegeven (${reads.join(', ')})`);
  check(S().documents.length === before && S().activeDocumentId === activeBefore, '.. in het pad: geen wissel, geen tabblad');
  check(S().ui.notifications.some((n) => n.severity === 'error' && (n.detail ?? '').includes('os error 2')), '.. in het pad: de gewone leesfout');
}

{
  freshTab('dubbelklik en slepen');
  files.set('/home/a/sleep.ifc', ifcText);
  let release: () => void = () => { throw new Error('nog niet gelezen'); };
  const slowIo = { ...io, readTextFile: (p: string) => new Promise<string>((resolve) => { release = () => resolve(files.get(p)!); }) };
  const launched = openLaunchFiles(useAppStore, ['/home/a/sleep.ifc'], slowIo, labels, () => false);
  await sleep(OPEN_WAIT_POLL_MS);
  await openDroppedFiles(useAppStore, droppedFilesFromPaths(['/home/a/sleep.ifc'], io), labels, () => false);
  check(tabsFor('/home/a/sleep.ifc') === 1, 'dubbelklik en slepen: het slepen opende het bestand');
  release();
  await launched;
  check(tabsFor('/home/a/sleep.ifc') === 1, `dubbelklik en slepen: één tabblad (${tabsFor('/home/a/sleep.ifc')})`);
}

{
  freshTab('sluitvraag');
  files.set('/home/a/sluit.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/sluit.ifc'], io, labels, () => false);
  const sluitId = S().activeDocumentId;
  S().addTask({ name: 'Niet opgeslagen' });
  check(tabsFor('/home/a/sluit.ifc') === 1 && S().isDirty, 'sluitvraag: het bestand staat open, met wijzigingen');
  let blocked = true;
  reads.length = 0;
  const launched = openLaunchFiles(useAppStore, ['/home/a/sluit.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 2);
  S().closeDocument(sluitId);
  blocked = false;
  await launched;
  check(same(reads, ['/home/a/sluit.ifc']) && tabsFor('/home/a/sluit.ifc') === 1, `sluitvraag: het bestand is opnieuw geopend (${tabsFor('/home/a/sluit.ifc')})`);
  const reopened = S().getOpenDocumentPayloads().find(({ payload }) => payload.filePath === '/home/a/sluit.ifc');
  check(!!reopened && reopened.id !== sluitId && S().activeDocumentId === reopened.id && !S().isDirty,
    'sluitvraag: een nieuw tabblad, actief, zonder de weggegooide wijziging');
}

{
  freshTab('opslaan in de sluitvraag');
  files.set('/home/a/bewaar.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/bewaar.ifc'], io, labels, () => false);
  const oudId = S().activeDocumentId;
  check(tabsFor('/home/a/bewaar.ifc') === 1 && !S().tasks.some((t) => t.name === 'Opgeslagen taak'), 'opslaan in de sluitvraag: beginstand zonder de taak');
  let blocked = true;
  reads.length = 0;
  const launched = openLaunchFiles(useAppStore, ['/home/a/bewaar.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 2);
  check(same(reads, ['/home/a/bewaar.ifc']), `opslaan in de sluitvraag: de startroute las de oude versie (${reads.join(', ')})`);
  await runProjectFileWrite(async () => { files.set('/home/a/bewaar.ifc', ifcSavedText); }, () => undefined);
  S().closeDocument(oudId);
  blocked = false;
  await launched;
  check(tabsFor('/home/a/bewaar.ifc') === 1 && S().activeDocumentId !== oudId, 'opslaan in de sluitvraag: het bestand staat weer open, in een nieuw tabblad');
  check(S().filePath === '/home/a/bewaar.ifc' && S().tasks.some((t) => t.name === 'Opgeslagen taak'),
    `opslaan in de sluitvraag: de opgeslagen versie, met de taak (${S().tasks.map((t) => t.name).join(', ')})`);
  check(same(reads, ['/home/a/bewaar.ifc', '/home/a/bewaar.ifc']), `opslaan in de sluitvraag: na de schrijfbeurt opnieuw gelezen (${reads.join(', ')})`);
}

{
  freshTab('opslaan als tijdens de controle');
  files.set('/home/a/orig.ifc', ifcText);
  files.set('/home/a/link3/orig.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/orig.ifc'], io, labels, () => false);
  const origId = S().activeDocumentId;
  freshTab('opslaan als tijdens de controle, ander tabblad vooraan');
  const identity = { stat: async (p: string) => {
    if (p === '/home/a/orig.ifc') {
      useAppStore.setState((s) => { const doc = s.documents.find((d) => d.id === origId); if (doc?.payload) doc.payload.filePath = '/home/a/kopie.ifc'; });
    }
    if (p === '/home/a/link3/orig.ifc' || p === '/home/a/orig.ifc') return { isFile: true, dev: 1, ino: 77 };
    throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
  } };
  await openLaunchFiles(useAppStore, ['/home/a/link3/orig.ifc'], io, labels, () => false, { identityFs: async () => identity });
  check(S().activeDocumentId !== origId && S().filePath === '/home/a/link3/orig.ifc',
    `opslaan als tijdens de controle: het startbestand opent zelf, niet het tabblad dat nu kopie.ifc is (${S().filePath})`);
}

{
  freshTab('opslaan tijdens het afhandelen');
  const path = '/home/a/afhandelen.ifc';
  files.set(path, ifcText);
  let releaseWrite = () => {};
  let saving: Promise<void> | null = null;
  const settleIo = {
    ...io,
    settle: async (p: string) => {
      if (p === path && saving === null) {
        saving = runProjectFileWrite(async () => {
          await new Promise<void>((resolve) => { releaseWrite = resolve; });
          files.set(path, ifcSavedText);
        }, () => undefined);
        await sleep(0);
      }
      return [];
    },
    readTextFile: async (p: string) => { const text = await io.readTextFile(p); releaseWrite(); return text; },
  };
  reads.length = 0;
  await openLaunchFiles(useAppStore, [path], settleIo, labels, () => false);
  await saving;
  check(S().filePath === path && S().tasks.some((t) => t.name === 'Opgeslagen taak'),
    `opslaan tijdens het afhandelen: de opgeslagen versie, met de taak (${S().tasks.map((t) => t.name).join(', ')})`);
  check(same(reads, [path, path]), `opslaan tijdens het afhandelen: na de schrijfbeurt opnieuw gelezen (${reads.join(', ')})`);
  check(tabsFor(path) === 1, 'opslaan tijdens het afhandelen: één tabblad');
}

console.log(failures === 0 ? 'launch-files: alles groen' : `launch-files: ${failures} fout(en)`);
process.exit(failures === 0 ? 0 : 1);
