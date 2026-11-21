// Een bestand meegeven bij het starten (issue #1091): de webviewkant.
//
// Rust leest de paden uit de opdrachtregel van de eerste start en van elke tweede start
// (`src-tauri/src/launch_files.rs`) en stuurt ze als event zodra de webview meldt dat hij luistert.
//
//  A. De webview luistert eerst en meldt pas daarna dat hij klaar is; anders gaat een pad verloren.
//  B. Alleen een lijst met tekst telt als paden.
//  C. Elk pad gaat door de gewone openroute (Bestand → Openen): pad als ref en opslagdoel, Recent, een
//     nieuw tabblad naast een project met wijzigingen.
//  D. Een pad dat niet bestaat geeft de gewone foutmelding; een formaat dat de app niet opent de gewone
//     weigering. De app blijft gewoon werken.
//  E. Staat er bij aankomst een venster open (het welkomstvenster bij de eerste start), dan wacht het
//     bestand tot dat dicht is, in plaats van te weigeren zoals bij neerzetten.
//  F. Staat het bestand al in een tabblad (hetzelfde pad, of via een link dezelfde bestandsidentiteit), dan
//     wisselt de app naar dat tabblad: geen tweede tabblad dat naar hetzelfde bestand schrijft (review #1116).
//  G. Ook niet als het bestand nog geopend wordt: hetzelfde pad twee keer in één event, of twee events vlak na
//     elkaar (review ronde 2). En een pad met een onopgeloste `..` geeft de gewone leesfout, geen wissel.
//  H. Ook niet als een andere route (slepen) hetzelfde bestand opent terwijl de startroute nog leest (ronde 3).
//  I. Gaat het open tabblad dicht terwijl het startbestand wacht (de sluitvraag), dan opent het bestand alsnog.
//  J. Kiest de planner in die sluitvraag *Opslaan*, dan opent het bestand in de versie die net is opgeslagen, niet in
//     de versie die de startroute al had gelezen (ronde 4): na elke schrijfbeurt sinds het lezen leest hij opnieuw.
//  De beslissing "openen of wisselen" valt dus bij het activeren, met de tabbladen van dat moment.
//
// Draait via run.sh. Exit 0 = alles groen.

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

// ── A. Eerst luisteren, dan klaar melden ────────────────────────────────────────────────────────
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

// ── B. Alleen een lijst met tekst ───────────────────────────────────────────────────────────────
check(same(launchPaths(['C:\\werk\\Plan.ifc', '/home/a/b.ifc']), ['C:\\werk\\Plan.ifc', '/home/a/b.ifc']), 'een lijst paden blijft gelijk');
check(same(launchPaths(['a.ifc', 3, null, '']), ['a.ifc']), 'geen tekst of lege tekst valt weg');
check(same(launchPaths('a.ifc'), []) && same(launchPaths(null), []) && same(launchPaths({ paths: ['a'] }), []),
  'iets anders dan een lijst geeft geen paden');

// ── C–E. De openroute, tegen de echte store ─────────────────────────────────────────────────────
S().newProject();
S().setProject({ name: 'Startbestand', startDate: '2026-08-03' });
S().addTask({ name: 'Taak uit het bestand' });
const ifcText = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
S().addTask({ name: 'Opgeslagen taak' });
/** Dezelfde planning, met de taak die *Opslaan* in de sluitvraag wegschrijft (J). */
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
  // Een project met wijzigingen staat open; het bestand komt in een eigen tabblad.
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
  // Een pad dat niet bestaat, en een formaat dat de app niet opent.
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
  // Bij de eerste start staat het welkomstvenster nog open: het bestand wacht, en opent daarna.
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

// ── F. Al open: naar dat tabblad, geen tweede tabblad dat naar hetzelfde bestand schrijft ─────────────────────
const planDoc = S().getOpenDocumentPayloads().find(({ payload }) => payload.filePath === '/home/a/plan.ifc');
check(!!planDoc, 'beginstand: /home/a/plan.ifc staat open');
const planOpen = () => S().getOpenDocumentPayloads().some(({ id, payload }) => id === planDoc?.id && payload.filePath === '/home/a/plan.ifc');
const tabsFor = (path: string) => S().getOpenDocumentPayloads().filter(({ payload }) => payload.filePath === path).length;
/** Een nieuw, leeg tabblad vooraan; het IFC-tabblad blijft ongemoeid (niet `newProject`: dat leegt het actieve tabblad). */
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
  // Via een link: een ander pad, dezelfde bestandsidentiteit.
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
  // Met een open venster: eerst wachten, dan pas wisselen (een wissel zou de invoer van het venster weggooien).
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
  // Een nieuw bestand en een al open bestand samen: het nieuwe opent, het laatste pad bepaalt het actieve tabblad.
  freshTab('nieuw + al open');
  files.set('/home/a/nieuw.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/nieuw.ifc', '/home/a/plan.ifc'], io, labels, () => false);
  check(tabsFor('/home/a/nieuw.ifc') === 1 && tabsFor('/home/a/plan.ifc') === 1, 'nieuw + al open: het nieuwe opent één keer, het open bestand niet nog eens');
  check(S().activeDocumentId === planDoc?.id, 'nieuw + al open: het laatst meegegeven bestand is actief');
}

// ── G. Tijdens een lopende opening (review ronde 2 van #1116) ─────────────────────────────────────────────────
{
  // Eén startevent met hetzelfde pad twee keer: één tabblad.
  freshTab('twee keer in één event');
  files.set('/home/a/dubbel.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/dubbel.ifc', '/home/a/dubbel.ifc'], io, labels, () => false);
  check(tabsFor('/home/a/dubbel.ifc') === 1, `twee keer in één event: één tabblad (${tabsFor('/home/a/dubbel.ifc')})`);
}

{
  // Twee startevents vlak na elkaar, terwijl het eerste nog op het welkomstvenster wacht: één tabblad.
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
  // Een pad met een `..` die Rust niet kon oplossen (de map bestaat niet): het besturingssysteem leest het niet, dus
  // de gewone leesfout, ook al lijkt de tekst zonder `weg/..` op het open bestand.
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

// ── H. Een andere route opent hetzelfde bestand terwijl de startroute nog leest (review ronde 3 van #1116) ──────
{
  // Dubbelklik, het lezen duurt even, en de planner sleept hetzelfde bestand naar het venster. Het slepen is eerst klaar;
  // de startroute ziet bij het activeren dat tabblad en wisselt ernaartoe.
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

// ── I. Het open tabblad gaat dicht terwijl het startbestand wacht (review ronde 3 van #1116) ────────────────────
{
  // De planner sluit een gewijzigd tabblad (de sluitvraag staat open), dubbelklikt op de opgeslagen versie en kiest
  // Niet opslaan. Het startbestand opent daarna alsnog, in een eigen tabblad.
  freshTab('sluitvraag');
  files.set('/home/a/sluit.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/sluit.ifc'], io, labels, () => false);
  const sluitId = S().activeDocumentId;
  S().addTask({ name: 'Niet opgeslagen' });
  check(tabsFor('/home/a/sluit.ifc') === 1 && S().isDirty, 'sluitvraag: het bestand staat open, met wijzigingen');
  let blocked = true; // de sluitvraag
  reads.length = 0;
  const launched = openLaunchFiles(useAppStore, ['/home/a/sluit.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 2);
  S().closeDocument(sluitId); // Niet opslaan
  blocked = false;
  await launched;
  check(same(reads, ['/home/a/sluit.ifc']) && tabsFor('/home/a/sluit.ifc') === 1, `sluitvraag: het bestand is opnieuw geopend (${tabsFor('/home/a/sluit.ifc')})`);
  const reopened = S().getOpenDocumentPayloads().find(({ payload }) => payload.filePath === '/home/a/sluit.ifc');
  check(!!reopened && reopened.id !== sluitId && S().activeDocumentId === reopened.id && !S().isDirty,
    'sluitvraag: een nieuw tabblad, actief, zonder de weggegooide wijziging');
}

// ── J. Opslaan in de sluitvraag terwijl het startbestand wacht (review ronde 4 van #1116) ─────────────────────────
{
  // Open plan, voeg een taak toe, sluit het tabblad: de sluitvraag staat open. Dubbelklik op hetzelfde bestand; de
  // startroute leest het (nog de oude versie) en wacht. De planner kiest Opslaan: de nieuwe versie gaat naar schijf en het
  // tabblad sluit. Daarna moet het bestand openen in de versie mét de opgeslagen taak, anders overschrijft de volgende
  // Ctrl+S die taak stil.
  freshTab('opslaan in de sluitvraag');
  files.set('/home/a/bewaar.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/bewaar.ifc'], io, labels, () => false);
  const oudId = S().activeDocumentId;
  check(tabsFor('/home/a/bewaar.ifc') === 1 && !S().tasks.some((t) => t.name === 'Opgeslagen taak'), 'opslaan in de sluitvraag: beginstand zonder de taak');
  let blocked = true; // de sluitvraag
  reads.length = 0;
  const launched = openLaunchFiles(useAppStore, ['/home/a/bewaar.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 2);
  check(same(reads, ['/home/a/bewaar.ifc']), `opslaan in de sluitvraag: de startroute las de oude versie (${reads.join(', ')})`);
  // Opslaan: via de ene schrijfrij van de app, zoals elke opslag; daarna sluit het tabblad.
  await runProjectFileWrite(async () => { files.set('/home/a/bewaar.ifc', ifcSavedText); }, () => undefined);
  S().closeDocument(oudId);
  blocked = false;
  await launched;
  check(tabsFor('/home/a/bewaar.ifc') === 1 && S().activeDocumentId !== oudId, 'opslaan in de sluitvraag: het bestand staat weer open, in een nieuw tabblad');
  check(S().filePath === '/home/a/bewaar.ifc' && S().tasks.some((t) => t.name === 'Opgeslagen taak'),
    `opslaan in de sluitvraag: de opgeslagen versie, met de taak (${S().tasks.map((t) => t.name).join(', ')})`);
  check(same(reads, ['/home/a/bewaar.ifc', '/home/a/bewaar.ifc']), `opslaan in de sluitvraag: na de schrijfbeurt opnieuw gelezen (${reads.join(', ')})`);
}

// ── K. Opslaan als tijdens de identiteitscontrole (review ronde 5 van #1116) ────────────────────────────────────
{
  // Het startbestand komt via een link binnen; het tabblad met hetzelfde bestand gaat tijdens de `stat` via Opslaan als
  // naar een andere naam. Dat tabblad is dan niet meer het startbestand: het bestand opent in een eigen tabblad.
  freshTab('opslaan als tijdens de controle');
  files.set('/home/a/orig.ifc', ifcText);
  files.set('/home/a/link3/orig.ifc', ifcText);
  await openLaunchFiles(useAppStore, ['/home/a/orig.ifc'], io, labels, () => false);
  const origId = S().activeDocumentId;
  freshTab('opslaan als tijdens de controle, ander tabblad vooraan');
  const identity = { stat: async (p: string) => {
    if (p === '/home/a/orig.ifc') {
      // Opslaan als van het tabblad met orig.ifc naar kopie.ifc, precies nu.
      useAppStore.setState((s) => { const doc = s.documents.find((d) => d.id === origId); if (doc?.payload) doc.payload.filePath = '/home/a/kopie.ifc'; });
    }
    if (p === '/home/a/link3/orig.ifc' || p === '/home/a/orig.ifc') return { isFile: true, dev: 1, ino: 77 };
    throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
  } };
  await openLaunchFiles(useAppStore, ['/home/a/link3/orig.ifc'], io, labels, () => false, { identityFs: async () => identity });
  check(S().activeDocumentId !== origId && S().filePath === '/home/a/link3/orig.ifc',
    `opslaan als tijdens de controle: het startbestand opent zelf, niet het tabblad dat nu kopie.ifc is (${S().filePath})`);
}

console.log(failures === 0 ? 'launch-files: alles groen' : `launch-files: ${failures} fout(en)`);
process.exit(failures === 0 ? 0 : 1);
