// T16 — AI-backup-service headless: triggerregels, per-document-teller, opruimbeleid, fail-safe.
//
// GÉÉN echte Tauri/fs: de service-kern (`createBackupService`) krijgt een INGESPOTEN fake-fs +
// fake-deps (appDataDir, getDoc → IFC+projectnaam, autoBackupEnabled-toggle, monotone klok). Zo
// draait exact de spec-testlijst (spec §AI-backup) deterministisch op Node. De publieke wrappers
// (`ensureBackup`/`makeManualBackup`) zijn dunne Tauri-gates rond deze kern; de wiring naar
// `buildMcpContext` verifiëren we via referentie-identiteit (integratietest onderaan).

// --- localStorage-shim (vóór elke @/-import; settingsStore-sleutels bij de buildMcpContext-import) ---
const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { test, assert, assertEq, run } from './harness';
import {
  createAppBackupService,
  createBackupService,
  ensureBackup as exportedEnsureBackup,
  sanitizeProjectName,
  backupBucket,
  backupFileName,
  backupTimeOf,
  backupsToRemove,
  type BackupFs,
  type BackupDeps,
} from '@/services/mcp/backup';
import { buildMcpContext } from '@/services/mcp/server';
import { createAppStoreContext, appStoreContext } from '@/state/appStore';

// --- Fake in-memory fs (pad → inhoud); readDir lijst direct-kind-namen (bestanden én mappen). -----
function makeFakeFs(opts?: { failWrite?: boolean }) {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const mkdirCalls: string[] = [];
  const SEP = '/';
  const fs: BackupFs = {
    appDataDir: async () => '/appdata',
    join: async (...parts: string[]) => parts.join(SEP),
    mkdir: async (dir: string) => { mkdirCalls.push(dir); dirs.add(dir); },
    writeTextFile: async (p: string, c: string) => {
      if (opts?.failWrite) throw new Error('schijf vol (fake)');
      files.set(p, c);
    },
    readDir: async (dir: string) => {
      const prefix = dir + SEP;
      const entries = new Map<string, boolean>();
      for (const p of [...files.keys(), ...dirs]) {
        if (!p.startsWith(prefix)) continue;
        const rest = p.slice(prefix.length);
        const cut = rest.indexOf(SEP);
        if (cut < 0) entries.set(rest, entries.get(rest) === true || dirs.has(p));
        else entries.set(rest.slice(0, cut), true);
      }
      return [...entries].map(([name, isDirectory]) => ({ name, isDirectory }));
    },
    remove: async (p: string) => {
      if (files.delete(p)) return;
      const inside = [...files.keys(), ...dirs].some((q) => q.startsWith(p + SEP));
      if (inside) throw new Error(`map niet leeg (fake): ${p}`);
      dirs.delete(p);
    },
  };
  return { fs, files, dirs, mkdirCalls };
}

// --- Fake deps met instelbare toggle/actief-doc/klok. --------------------------------------------
function makeDeps(fs: BackupFs, over?: Partial<{
  autoBackup: boolean; activeDoc: string | null; missingDocs: Set<string>; projectName: string;
}>) {
  const state = {
    autoBackup: over?.autoBackup ?? true,
    activeDoc: over?.activeDoc ?? 'doc-1',
    projectName: over?.projectName ?? 'Mijn Project',
    clock: 1_000_000,
  };
  const missing = over?.missingDocs ?? new Set<string>();
  const deps: BackupDeps = {
    getFs: async () => fs,
    getDoc: (docId) => (missing.has(docId) ? null : { ifc: `IFC-CONTENT:${docId}`, projectName: state.projectName }),
    autoBackupEnabled: async () => state.autoBackup,
    now: () => state.clock++,
    activeDocId: () => state.activeDoc,
  };
  return { deps, state };
}

// --- (1) eerste mutate-call per doc → schrijft + geeft pad terug ----------------------------------

test('eerste mutate-call per document schrijft een backup en geeft het pad terug', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs);
  const svc = createBackupService(deps);

  const path = await svc.ensureBackup('doc-1', 'mutate');
  assert(typeof path === 'string' && path !== null, `verwachtte een pad-string, kreeg ${JSON.stringify(path)}`);
  assertEq(files.size, 1, 'er is precies één backup-bestand geschreven');
  assertEq(files.get(path!), 'IFC-CONTENT:doc-1', 'het bestand bevat de IFC van dit document');
});

test("kind 'batch' triggert net als 'mutate' een backup", async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs);
  const svc = createBackupService(deps);
  const path = await svc.ensureBackup('doc-1', 'batch');
  assert(typeof path === 'string', 'batch triggert een backup');
  assertEq(files.size, 1, 'batch schrijft precies één backup');
});

// --- (2) tweede mutate-call per doc → null (geen tweede backup) -----------------------------------

test('een tweede muterende call op hetzelfde document levert null (één auto-backup per sessie)', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs);
  const svc = createBackupService(deps);

  const first = await svc.ensureBackup('doc-1', 'mutate');
  assert(first !== null, 'de eerste call schrijft');
  const second = await svc.ensureBackup('doc-1', 'batch');
  assertEq(second, null, 'de tweede muterende call geeft null');
  assertEq(files.size, 1, 'er is geen tweede bestand bijgekomen');
});

// --- (3) niet-muterende kinds → null (geen trigger, teller onaangeroerd) --------------------------

test("kind 'read' en 'document' triggeren nooit een backup (null, geen schrijf, teller intact)", async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs);
  const svc = createBackupService(deps);

  assertEq(await svc.ensureBackup('doc-1', 'read'), null, "'read' geeft null");
  assertEq(await svc.ensureBackup('doc-1', 'document'), null, "'document' geeft null");
  assertEq(await svc.ensureBackup('doc-1', 'other'), null, "'other' geeft null");
  assertEq(files.size, 0, 'geen enkel bestand geschreven door leestools');
  // De teller is NIET verbruikt: de eerste echte mutatie schrijft alsnog.
  const path = await svc.ensureBackup('doc-1', 'mutate');
  assert(path !== null, 'na read/document schrijft de eerste mutatie nog steeds');
});

// --- (4) handmatige backup reset de per-document-teller -------------------------------------------

test('makeManualBackup reset de auto-teller: de volgende mutatie schrijft opnieuw', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs, { activeDoc: 'doc-1' });
  const svc = createBackupService(deps);

  await svc.ensureBackup('doc-1', 'mutate');         // auto #1
  assertEq(await svc.ensureBackup('doc-1', 'mutate'), null, 'tweede auto zou null zijn');

  const manual = await svc.makeManualBackup();        // handmatig → reset teller doc-1
  assert(typeof manual === 'string', 'handmatige backup geeft een pad');

  const afterManual = await svc.ensureBackup('doc-1', 'mutate'); // auto mag weer
  assert(afterManual !== null, 'na een handmatige backup schrijft de volgende auto-mutatie weer');
  assertEq(files.size, 3, 'drie schrijfacties in totaal (auto, handmatig, auto)');
});

// --- (5) duplicate-born document slaat de auto-backup over ----------------------------------------

test('een via markDuplicateBorn geregistreerd document slaat de auto-backup over (null)', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs);
  const svc = createBackupService(deps);

  svc.markDuplicateBorn('doc-dup');
  assertEq(await svc.ensureBackup('doc-dup', 'mutate'), null, 'duplicate-born doc → geen auto-backup');
  assertEq(files.size, 0, 'er is niets geschreven voor een duplicate-born document');

  // "Nu backup maken" werkt op dat document uiteraard wél.
  const { deps: deps2 } = makeDeps(fs, { activeDoc: 'doc-dup' });
  const svc2 = createBackupService(deps2);
  svc2.markDuplicateBorn('doc-dup');
  const manual = await svc2.makeManualBackup();
  assert(typeof manual === 'string', 'handmatige backup werkt óók op een duplicate-born document');
});

// --- (6) backup-toggle uit → altijd null ---------------------------------------------------------

test('met de backup-toggle uit levert ensureBackup altijd null', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs, { autoBackup: false });
  const svc = createBackupService(deps);
  assertEq(await svc.ensureBackup('doc-1', 'mutate'), null, 'toggle uit → null');
  assertEq(await svc.ensureBackup('doc-1', 'batch'), null, 'toggle uit → null (batch)');
  assertEq(files.size, 0, 'toggle uit schrijft niets');
});

// --- (7) opruimbeleid: uitdunnen (eigenaarsbesluit 2026-09-28) ---------------------------------

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const nameAt = (t: number) => backupFileName('P', t);

test('uitdunnen: week alles (≤ 20), dan één per week, per maand, per jaar alleen voor een opgeslagen bestand', () => {
  const names: string[] = [];
  for (let h = 0; h < 30; h++) names.push(nameAt(NOW - h * 5 * 3600_000));   // 30 stuks in ~6 dagen
  for (let d = 8; d < 30; d++) names.push(nameAt(NOW - d * DAY));            // dagelijks, week 2–4
  for (let d = 30; d < 365; d += 3) names.push(nameAt(NOW - d * DAY));       // om de 3 dagen, rest van het jaar
  for (let d = 365; d < 3 * 365; d += 10) names.push(nameAt(NOW - d * DAY)); // twee jaar ouder
  names.push('notitie.ifc', 'P-kapot.ifc');                                   // niet van ons

  for (const keepYearly of [true, false]) {
    const removed = new Set(backupsToRemove(names, NOW, keepYearly));
    const kept = names.filter((n) => !removed.has(n));
    assert(!removed.has('notitie.ifc') && !removed.has('P-kapot.ifc'), 'een bestand zonder ons tijdstempel blijft altijd staan');
    const ages = kept.map((n) => backupTimeOf(n)).filter((t): t is number => t !== null).map((t) => (NOW - t) / DAY);
    assertEq(ages.filter((a) => a < 7).length, 20, 'de afgelopen week: de 20 nieuwste');
    const weekly = ages.filter((a) => a >= 7 && a < 30).length;
    assert(weekly >= 3 && weekly <= 4, `week 2–4: één per kalenderweek, kreeg ${weekly}`);
    const monthly = ages.filter((a) => a >= 30 && a < 365).length;
    assert(monthly >= 11 && monthly <= 13, `maand 2–12: één per kalendermaand, kreeg ${monthly}`);
    const yearly = ages.filter((a) => a >= 365).length;
    if (keepYearly) assert(yearly >= 2 && yearly <= 4, `ouder dan een jaar: één per kalenderjaar, kreeg ${yearly}`);
    else assertEq(yearly, 0, 'nooit opgeslagen document: ouder dan een jaar is weg');
  }
  // Per week blijft de NIEUWSTE staan.
  const week = [nameAt(NOW - 10 * DAY), nameAt(NOW - 10 * DAY - 3600_000)];
  assertEq(backupsToRemove(week, NOW, true), [week[1]], 'de oudere van twee in dezelfde week gaat weg');
});

test('de backups van de lopende sessie blijven altijd staan, ook boven de weekgrens van 20', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs, { activeDoc: 'doc-prune' });
  const svc = createBackupService(deps);
  const paths: string[] = [];
  for (let i = 0; i < 25; i++) paths.push(await svc.makeManualBackup());
  assertEq(files.size, 25, 'alle 25 handmatige backups van deze sessie staan er nog');
});

test('een opgeslagen document deelt zijn backupmap over sessies heen; eerdere sessies worden uitgedund', async () => {
  const { fs, files } = makeFakeFs();
  const filePath = '/home/jan/projecten/Kantoor Zuidas.ifc';
  // Elke "sessie" geeft hetzelfde bestand een nieuw document-id; vroeger elk een eigen map.
  for (let session = 0; session < 25; session++) {
    const docId = `doc-sessie-${session}`;
    const deps: BackupDeps = {
      getFs: async () => fs,
      getDoc: () => ({ ifc: `IFC:${session}`, projectName: 'Kantoor', filePath }),
      autoBackupEnabled: async () => true,
      now: (() => { let t = NOW - (25 - session) * 3600_000; return () => t++; })(),
      activeDocId: () => docId,
    };
    await createBackupService(deps).ensureBackup(docId, 'mutate');
  }
  const dirs = new Set([...files.keys()].map((p) => p.split('/').slice(0, -1).join('/')));
  assertEq(dirs.size, 1, `één map voor het bestand, kreeg ${[...dirs].join(', ')}`);
  assertEq(files.size, 20, 'binnen een week blijven er over de sessies heen 20 over');
  assert([...files.values()].includes('IFC:24'), 'de nieuwste sessie staat er nog');
  assert(![...files.values()].includes('IFC:0'), 'de oudste sessie is weg');
  const dir = [...dirs][0];
  assert(dir.includes('file-Kantoor Zuidas-'), `leesbare mapnaam, kreeg ${dir}`);
  assert(backupBucket('a', '/x/Plan.ifc') !== backupBucket('a', '/y/Plan.ifc'), 'gelijke naam, andere map ⇒ andere emmer');
  assertEq(backupBucket('doc-9', null), 'unsaved-doc-9', 'nooit opgeslagen ⇒ unsaved-<doc-id>');
});

test('opruimen loopt ook de andere mappen na: een oude map van een nooit opgeslagen document verdwijnt', async () => {
  const { fs, files, dirs } = makeFakeFs();
  const root = '/appdata/ai-backups';
  const oldLoose = `${root}/unsaved-doc-oud`;
  const oldFile = `${root}/file-Kantoor-0000abcd`;
  // Map van vóór 2026-09-28 (kale doc-id): kan bij een opgeslagen bestand horen ⇒ één per jaar.
  const legacy = `${root}/doc-van-voor-de-wijziging`;
  const mixed = `${root}/unsaved-doc-met-notitie`;
  for (const d of [oldLoose, oldFile, legacy, mixed]) dirs.add(d);
  for (const y of [2, 3]) {
    files.set(`${oldLoose}/${nameAt(NOW - y * 365 * DAY)}`, 'oud');
    files.set(`${oldFile}/${nameAt(NOW - y * 365 * DAY)}`, 'oud');
    files.set(`${legacy}/${nameAt(NOW - y * 365 * DAY)}`, 'oud');
  }
  files.set(`${mixed}/${nameAt(NOW - 800 * DAY)}`, 'oud');
  files.set(`${mixed}/notitie.txt`, 'van de gebruiker');

  const deps: BackupDeps = {
    getFs: async () => fs,
    getDoc: () => ({ ifc: 'IFC:nu', projectName: 'Nieuw' }),
    autoBackupEnabled: async () => true,
    now: () => NOW,
    activeDocId: () => 'doc-nu',
  };
  await createBackupService(deps).ensureBackup('doc-nu', 'mutate');

  assert(!dirs.has(oldLoose) && ![...files.keys()].some((p) => p.startsWith(oldLoose + '/')), 'de oude losse map is helemaal weg');
  assertEq([...files.keys()].filter((p) => p.startsWith(oldFile + '/')).length, 2, 'een opgeslagen bestand houdt één per jaar');
  assertEq([...files.keys()].filter((p) => p.startsWith(legacy + '/')).length, 2, 'een map van vóór de wijziging houdt ook één per jaar');
  assert(files.has(`${mixed}/notitie.txt`) && dirs.has(mixed), 'een vreemd bestand blijft staan, en daarmee de map');
  assertEq([...files.keys()].filter((p) => p.startsWith(mixed + '/')).length, 1, 'alleen onze oude backup is weg');
});

test('één onleesbare map breekt de sweep niet af: de andere mappen worden toch opgeruimd (review 2026-09-28)', async () => {
  const { fs, files, dirs } = makeFakeFs();
  const root = '/appdata/ai-backups';
  const locked = `${root}/aaa-vergrendeld`;
  const oldLoose = `${root}/unsaved-zzz-oud`;
  dirs.add(locked); dirs.add(oldLoose);
  files.set(`${locked}/${nameAt(NOW - DAY)}`, 'vast'); // eerst in de listing: vóór de oude map
  files.set(`${oldLoose}/${nameAt(NOW - 2 * 365 * DAY)}`, 'oud');
  const partlyBroken: BackupFs = {
    ...fs,
    readDir: async (dir: string) => {
      if (dir === locked) throw new Error('geen toegang (fake)');
      return fs.readDir(dir);
    },
  };
  const deps: BackupDeps = {
    getFs: async () => partlyBroken,
    getDoc: () => ({ ifc: 'IFC:nu', projectName: 'Nieuw' }),
    autoBackupEnabled: async () => true,
    now: () => NOW,
    activeDocId: () => 'doc-nu',
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    await createBackupService(deps).ensureBackup('doc-nu', 'mutate');
  } finally {
    console.warn = warn;
  }
  assert(!dirs.has(oldLoose), 'de oude losse map ná de vergrendelde map is toch opgeruimd');
});

test('een fout bij het opruimen laat de backup zelf niet falen', async () => {
  const { fs, files } = makeFakeFs();
  const broken: BackupFs = { ...fs, readDir: async () => { throw new Error('geen toegang (fake)'); } };
  const { deps } = makeDeps(broken);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const path = await createBackupService(deps).ensureBackup('doc-1', 'mutate');
    assert(path !== null && files.has(path), 'de backup is geschreven en het pad teruggegeven');
  } finally {
    console.warn = warn;
  }
});

// --- (8) fail-safe: een schrijffout propageert als reject (NIET null) -----------------------------

test('een schrijffout propageert als reject — de service slikt niets stil', async () => {
  const { fs } = makeFakeFs({ failWrite: true });
  const { deps } = makeDeps(fs);
  const svc = createBackupService(deps);

  let threw = false;
  try { await svc.ensureBackup('doc-1', 'mutate'); }
  catch { threw = true; }
  assert(threw, 'een schrijffout MOET rejecten, niet stil null teruggeven');
});

// --- (9) padvorm: docId-submap + gesaneerde projectnaam ------------------------------------------

test('het backup-pad bevat de ai-backups-map, de docId-submap en de gesaneerde projectnaam', async () => {
  const { fs } = makeFakeFs();
  const { deps } = makeDeps(fs, { projectName: 'Woontoren A/B: fase 2*' });
  const svc = createBackupService(deps);
  const path = (await svc.ensureBackup('doc-xyz', 'mutate'))!;

  assert(path.includes('/ai-backups/'), `pad mist de ai-backups-map: ${path}`);
  assert(path.includes('/ai-backups/unsaved-doc-xyz/'), `pad mist de docId-submap: ${path}`);
  assert(path.endsWith('.ifc'), `pad eindigt niet op .ifc: ${path}`);
  // De gesaneerde naam mag geen padscheiders of verboden tekens meer bevatten.
  const fileName = path.split('/').pop()!;
  assert(!/[\/:*?"<>|]/.test(fileName.replace('.ifc', '')), `bestandsnaam bevat verboden tekens: ${fileName}`);
});

test('sanitizeProjectName vervangt verboden tekens en valt terug op een default bij leeg', () => {
  assertEq(sanitizeProjectName('A/B:c'), 'A_B_c', 'padscheiders/dubbelepunt → _');
  assert(sanitizeProjectName('   ').length > 0, 'een lege/whitespace naam valt terug op een niet-lege default');
});

// --- (10) integratie: buildMcpContext levert nu de ECHTE service (geen inline null-stub) ----------

test('buildMcpContext bekabelt de echte backup-service (referentie-identiteit met de export)', () => {
  const ctx = buildMcpContext();
  assert(ctx.ensureBackup === exportedEnsureBackup, 'buildMcpContext moet de echte ensureBackup-export leveren, niet de oude inline stub');
});


test('createAppBackupService(B) serialiseert B en gebruikt B\'s actieve document voor handmatige backup', async () => {
  const A = appStoreContext;
  A.store.getState().newProject();
  A.store.getState().setProject({ name: 'Backup context A' });
  A.store.getState().addTask({ name: 'Taak alleen in A' });

  const B = createAppStoreContext();
  B.store.getState().setProject({ name: 'Backup context B' });
  B.store.getState().addTask({ name: 'Taak alleen in B' });
  const bDocumentId = B.store.getState().activeDocumentId;
  const { fs, files } = makeFakeFs();
  let clock = 10_000;
  const service = createAppBackupService(B, {
    getFs: async () => fs,
    autoBackupEnabled: async () => true,
    now: () => clock++,
  });

  const autoPath = await service.ensureBackup(bDocumentId, 'mutate');
  assert(autoPath !== null, 'de eerste B-mutatie hoort een B-backup te schrijven');
  const autoIfc = files.get(autoPath!);
  assert(typeof autoIfc === 'string' && autoIfc.includes('Backup context B') && autoIfc.includes('Taak alleen in B'),
    'de automatische backup hoort B\'s project en taak te serialiseren');
  assert(!autoIfc!.includes('Backup context A') && !autoIfc!.includes('Taak alleen in A'),
    'de automatische B-backup mag geen singletondata uit A bevatten');

  const manualPath = await service.makeManualBackup();
  assert(manualPath.includes(`/ai-backups/unsaved-${bDocumentId}/`),
    'de handmatige backup hoort B\'s actieve document-id als submap te gebruiken');
  assert(files.get(manualPath)?.includes('Backup context B') === true,
    'de handmatige backup hoort eveneens uit B te komen');
});

await run();
