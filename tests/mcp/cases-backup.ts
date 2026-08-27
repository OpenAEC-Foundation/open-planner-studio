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
  type BackupFs,
  type BackupDeps,
} from '@/services/mcp/backup';
import { buildMcpContext } from '@/services/mcp/server';
import { createAppStoreContext, appStoreContext } from '@/state/appStore';

// --- Fake in-memory fs (pad → inhoud); readDir lijstt direct-kind-namen onder een map. -----------
function makeFakeFs(opts?: { failWrite?: boolean }) {
  const files = new Map<string, string>();
  const mkdirCalls: string[] = [];
  const SEP = '/';
  const fs: BackupFs = {
    appDataDir: async () => '/appdata',
    join: async (...parts: string[]) => parts.join(SEP),
    mkdir: async (dir: string) => { mkdirCalls.push(dir); },
    writeTextFile: async (p: string, c: string) => {
      if (opts?.failWrite) throw new Error('schijf vol (fake)');
      files.set(p, c);
    },
    readDir: async (dir: string) => {
      const prefix = dir + SEP;
      const names = new Set<string>();
      for (const p of files.keys()) {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          if (!rest.includes(SEP)) names.add(rest);
        }
      }
      return [...names].map((name) => ({ name }));
    },
    remove: async (p: string) => { files.delete(p); },
  };
  return { fs, files, mkdirCalls };
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

// --- (7) opruimbeleid: exact 10 per docId-submap; de 11e schrijf verdringt de oudste ---------------

test('opruimbeleid houdt exact 10 backups per document; de 11e schrijf verwijdert de oudste', async () => {
  const { fs, files } = makeFakeFs();
  const { deps } = makeDeps(fs, { activeDoc: 'doc-prune' });
  const svc = createBackupService(deps);

  const paths: string[] = [];
  for (let i = 0; i < 11; i++) {
    paths.push(await svc.makeManualBackup()); // elke handmatige backup schrijft (reset teller)
  }
  assertEq(files.size, 10, 'na 11 schrijfacties blijven er exact 10 bestanden over');
  assert(!files.has(paths[0]), 'de oudste (eerst geschreven) backup is verwijderd');
  assert(files.has(paths[10]), 'de nieuwste backup staat er nog');
  for (let i = 1; i <= 10; i++) assert(files.has(paths[i]), `backup #${i} (van de 10 nieuwste) staat er nog`);
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
  assert(path.includes('/ai-backups/doc-xyz/'), `pad mist de docId-submap: ${path}`);
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
  assert(manualPath.includes(`/ai-backups/${bDocumentId}/`),
    'de handmatige backup hoort B\'s actieve document-id als submap te gebruiken');
  assert(files.get(manualPath)?.includes('Backup context B') === true,
    'de handmatige backup hoort eveneens uit B te komen');
});

await run();
