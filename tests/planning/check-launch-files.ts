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
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.window = g.window ?? {};
g.document = { documentElement: { dir: 'ltr', lang: 'en' } };

const {
  OPEN_FILES_EVENT, OPEN_FILES_READY_EVENT, launchPaths, listenForLaunchFiles, openLaunchFiles,
} = await import('@/state/launchFiles');
const { OPEN_WAIT_POLL_MS } = await import('@/state/slices/fileSlice');
const { useAppStore } = await import('@/state/appStore');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { buildImportLabels } = await import('@/i18n/importLabels');

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

{
  // F. Hetzelfde bestand nog eens (een tweede dubbelklik): geen tweede tabblad, wel naar het open tabblad.
  clearNotices();
  const planDoc = S().getOpenDocumentPayloads().find(({ payload }) => payload.filePath === '/home/a/plan.ifc');
  check(!!planDoc, 'beginstand: /home/a/plan.ifc staat open');
  S().newProject();
  const before = S().documents.length;
  reads.length = 0;
  await openLaunchFiles(useAppStore, ['/home/a/plan.ifc'], io, labels, () => false);
  check(S().documents.length === before, `al open: geen nieuw tabblad (${before} → ${S().documents.length})`);
  check(S().activeDocumentId === planDoc?.id, 'al open: het tabblad van dat bestand is actief');
  check(reads.length === 0, `al open: niets gelezen (${reads.join(', ')})`);

  // Via een link: een ander pad, dezelfde bestandsidentiteit.
  S().newProject();
  const identity = { stat: async (p: string) => {
    if (p === '/home/a/link/plan.ifc' || p === '/home/a/plan.ifc') return { isFile: true, dev: 1, ino: 42 };
    throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
  } };
  const beforeLink = S().documents.length;
  await openLaunchFiles(useAppStore, ['/home/a/link/plan.ifc'], io, labels, () => false, { identityFs: async () => identity });
  check(S().documents.length === beforeLink && S().activeDocumentId === planDoc?.id,
    'via een link: hetzelfde bestand, dus naar het open tabblad');

  // Met een open venster: eerst wachten, dan pas wisselen (een wissel zou de invoer van het venster weggooien).
  S().newProject();
  const waitingId = S().activeDocumentId;
  let blocked = true;
  const done = openLaunchFiles(useAppStore, ['/home/a/plan.ifc'], io, labels, () => blocked);
  await sleep(OPEN_WAIT_POLL_MS * 3);
  check(S().activeDocumentId === waitingId, 'al open, venster open: nog geen wissel');
  blocked = false;
  await done;
  check(S().activeDocumentId === planDoc?.id, 'al open, venster dicht: dan de wissel');

  // Een nieuw bestand en een al open bestand samen: het nieuwe opent, het laatste pad bepaalt het actieve tabblad.
  files.set('/home/a/nieuw.ifc', ifcText);
  const beforeMix = S().documents.length;
  await openLaunchFiles(useAppStore, ['/home/a/nieuw.ifc', '/home/a/plan.ifc'], io, labels, () => false);
  check(S().documents.length === beforeMix + 1, 'nieuw + al open: één nieuw tabblad');
  check(S().activeDocumentId === planDoc?.id, 'nieuw + al open: het laatst meegegeven bestand is actief');
}

console.log(failures === 0 ? 'launch-files: alles groen' : `launch-files: ${failures} fout(en)`);
process.exit(failures === 0 ? 0 : 1);
