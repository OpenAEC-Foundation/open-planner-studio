// Sols SIGTERM-proef: echte schrijfcoördinator en vervanger, met vertraagde truncate-then-write-I/O.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { lstat, mkdtemp, open, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createManagedShutdown } from '@/services/appQuit/managedShutdown';
import { replaceUserFile, type UserFileFs } from '@/services/fileAccess/atomicWrite';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';

const full = 'hele nieuwe planning';
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function nativeBoundaryProbe(mode: string) {
  const binary = process.env.OPS_NATIVE_SHUTDOWN_PROBE;
  assert.ok(binary, 'de native grensproef wordt alleen in CI gebouwd');
  const directory = await mkdtemp(join(tmpdir(), 'ops-shutdown-boundary-'));
  const target = join(directory, 'planning é.ifc');
  const link = join(directory, 'koppeling.ifc');
  const started = deferred();
  const finishWrite = deferred();
  const finishRecovery = deferred();
  let content = 'oude planning';
  await writeFile(target, content);
  await symlink(target, link);
  const fs: UserFileFs<string> = {
    lstat: async path => {
      const info = await lstat(path);
      return { isSymlink: info.isSymbolicLink(), nlink: info.nlink, mode: info.mode };
    },
    createNew: async () => { throw new Error('de echte symlink moet direct geschreven worden'); },
    write: async (path, data) => {
      const file = await open(path, 'w'); // Echte truncate door een symlink, zoals de Tauri-terugval.
      try {
        await file.write(data.slice(0, 5));
        content = await readFile(target, 'utf8');
        started.release();
        await finishWrite.promise;
        await file.write(data.slice(5));
        content = await readFile(target, 'utf8');
      } finally {
        await file.close();
      }
    },
    rename, remove: path => rm(path),
  };
  const writing = runProjectFileWrite(() => replaceUserFile(fs, link, full));
  await started.promise;
  if (mode === 'native-slow-recovery') {
    finishWrite.release();
    await writing;
  } else {
    finishRecovery.release();
  }

  const began = performance.now();
  const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  let requests = 0;
  let recoveryStarted = false;
  let recoveryFlushed = false;
  let confirmed = false;
  let closed = false;
  let timedOut = false;
  let ioError: unknown;
  let quitting: Promise<void> | undefined;
  const snapshot = () => ({
    projectWriteStillBusy: isProjectFileWriteBusy(), content, recoveryStarted, recoveryFlushed, confirmed,
  });
  let atOldBoundary: ReturnType<typeof snapshot> | undefined;
  let boundaryElapsed = 0;
  const shutdown = createManagedShutdown({
    freeze: () => {}, finishInput: () => {},
    flush: async () => {
      recoveryStarted = true;
      await finishRecovery.promise;
      recoveryFlushed = true;
    },
    confirm: async () => {
      confirmed = true;
      if (!closed) child.stdin.end('complete\n');
    },
  });
  child.on('error', error => { ioError = error; });
  child.stdin.on('error', error => { ioError = error; });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (data: string) => {
    output += data;
    let newline: number;
    while ((newline = output.indexOf('\n')) >= 0) {
      const line = output.slice(0, newline);
      output = output.slice(newline + 1);
      if (line !== 'shutdown') continue;
      requests++;
      quitting ??= shutdown().catch((error: unknown) => { ioError = error; });
      // Rust heeft dan 102 maal 250 ms gewacht, zonder afhankelijkheid van een Node-timer.
      if (requests === 103) {
        atOldBoundary = snapshot();
        boundaryElapsed = performance.now() - began;
        finishWrite.release();
        finishRecovery.release();
      }
    }
  });
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 40_000);
  try {
    const atNativeExit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; state: ReturnType<typeof snapshot> }>(resolve => {
      child.once('close', (code, signal) => {
        closed = true;
        resolve({ code, signal, state: snapshot() });
      });
    });
    console.log(JSON.stringify({ mode, requests, elapsedMs: performance.now() - began, atOldBoundary, atNativeExit }));
    assert.equal(timedOut, false, 'de native afsluitroute moet na bevestiging afronden');
    assert.equal(ioError, undefined);
    assert.deepEqual(atNativeExit, {
      code: 0, signal: null,
      state: { projectWriteStillBusy: false, content: full, recoveryStarted: true, recoveryFlushed: true, confirmed: true },
    }, 'Rust mag geen halfgeschreven doel of onvoltooide herstelronde afbreken');
    assert.ok(boundaryElapsed >= 25_300, 'de echte native grens van 25 seconden moet verstreken zijn');
    assert.deepEqual(atOldBoundary, mode === 'native-slow-recovery'
      ? { projectWriteStillBusy: false, content: full, recoveryStarted: true, recoveryFlushed: false, confirmed: false }
      : { projectWriteStillBusy: true, content: 'hele ', recoveryStarted: false, recoveryFlushed: false, confirmed: false });
    assert.equal(await readFile(target, 'utf8'), full, 'het echte bestand achter de symlink is volledig');
  } finally {
    clearTimeout(timeout);
    if (!closed) child.kill('SIGKILL');
    finishWrite.release();
    finishRecovery.release();
    await writing;
    await quitting;
    await rm(directory, { recursive: true, force: true });
  }
}

function delayedFs(mode: string) {
  const started = deferred();
  const finish = deferred();
  let target = 'oude planning';
  let temporary = '';
  let writes = 0;
  const fs: UserFileFs<string> = {
    lstat: async () => ({ isSymlink: mode === 'symlink', nlink: 1, mode: 0o600 }),
    createNew: async () => {
      if (mode === 'scope') throw new Error('forbidden path: tijdelijk bestand');
      return {
        write: async data => {
          writes++;
          temporary = data.slice(0, 5);
          started.release();
          await finish.promise;
          temporary = data;
        },
        close: async () => {},
      };
    },
    write: async (_path, data) => {
      writes++;
      target = data.slice(0, 5); // Directe terugval maakt het doel eerst leeg en schrijft deels.
      started.release();
      await finish.promise;
      target = data;
    },
    rename: async () => { target = temporary; },
    remove: async () => {},
  };
  return { fs, started, finish, content: () => target, writes: () => writes };
}

const scenario = process.argv[2];
if (!scenario) {
  let failed = 0;
  // Iedere proef gebruikt een eigen app-runtime: een bevestigde shutdown opent geen writes meer.
  const modes = ['scope', 'symlink', 'temporary', 'dialog'];
  // De gewone planning- en tijdzonerun blijft kort en heeft geen Rust-compiler nodig.
  if (process.env.OPS_NATIVE_SHUTDOWN_PROBE) modes.push('native-slow-write', 'native-slow-recovery');
  for (const mode of modes) {
    const result = spawnSync(process.execPath, [process.argv[1]!, mode], { stdio: 'inherit' });
    if (result.status !== 0) failed++;
  }
  assert.equal(failed, 0, 'alle SIGTERM-schrijfgrenzen moeten slagen');
} else if (scenario.startsWith('native-')) {
  await nativeBoundaryProbe(scenario);
} else if (scenario === 'dialog') {
  const dialogStarted = deferred();
  let choose!: (path: string) => void;
  const choice = new Promise<string>(resolve => { choose = resolve; });
  const afterDialog = delayedFs('symlink');
  afterDialog.finish.release();
  const waitingDialog = runProjectFileWrite(async () => {
    dialogStarted.release();
    const path = await choice;
    await replaceUserFile(afterDialog.fs, path, full);
  }).then(() => null, (error: unknown) => error);
  await dialogStarted.promise;
  const exportFile = delayedFs('scope');
  const exporting = replaceUserFile(exportFile.fs, '/openaec/export.ifc', full);
  await exportFile.started.promise;
  let confirmed = false;
  const shutdown = createManagedShutdown({
    freeze: () => {}, finishInput: () => {}, flush: async () => {},
    confirm: async () => { confirmed = true; },
  });
  const quitting = shutdown();
  await tick();
  const confirmedTooSoon = confirmed;
  exportFile.finish.release();
  await exporting;
  const finishedWithoutChoice = await Promise.race([quitting.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 100))]);
  // Laat ook een late native dialoogkeuze geen nieuwe destructieve write starten.
  choose('/openaec/late-keuze.ifc');
  const dialogError = await waitingDialog;
  assert.equal(confirmedTooSoon, false, 'een lopende export moet eerst klaar zijn');
  assert.equal(finishedWithoutChoice, true, 'SIGTERM wacht niet op de nog openstaande bestandsdialoog');
  assert.ok(dialogError instanceof Error && /shutting down/.test(dialogError.message), 'late dialoogkeuze wordt veilig geweigerd');
  assert.equal(afterDialog.writes(), 0, 'na bevestigen mag een late dialoog geen bestand meer afkappen');
  console.log('OK SIGTERM wacht de export af, slaat de wachtende dialoog over en weigert late writes');
} else {
  const manualFile = delayedFs(scenario);
  const exportFile = delayedFs('symlink');
  const manual = runProjectFileWrite(() => replaceUserFile(manualFile.fs, '/openaec/project.ifc', full));
  const exporting = replaceUserFile(exportFile.fs, '/openaec/export.ifc', full);
  await Promise.all([manualFile.started.promise, exportFile.started.promise]);
  let confirmed = false;
  let atConfirmation: unknown;
  let atRecovery: unknown;
  const shutdown = createManagedShutdown({
    freeze: () => {}, finishInput: () => {},
    flush: async () => { atRecovery = [manualFile.content(), exportFile.content()]; },
    confirm: async () => {
      confirmed = true;
      atConfirmation = { projectWriteStillBusy: isProjectFileWriteBusy(), files: [manualFile.content(), exportFile.content()] };
    },
  });
  const quitting = shutdown();
  await tick();
  const confirmedBeforeFirst = confirmed;
  manualFile.finish.release();
  await manual;
  await tick();
  const confirmedBeforeSecond = confirmed;
  exportFile.finish.release();
  await exporting;
  await quitting;
  assert.deepEqual(atConfirmation, { projectWriteStillBusy: false, files: [full, full] }, 'geen bevestiging met een halfgeschreven project of export');
  assert.deepEqual(atRecovery, [full, full], 'laatste herstelstaat wordt pas na alle begonnen writes geschreven');
  assert.equal(confirmedBeforeFirst || confirmedBeforeSecond, false, 'één afgeronde write is niet genoeg');
  console.log(`OK SIGTERM: ${scenario}, projectbestand en gelijktijdige export volledig vóór herstel en bevestiging`);
}
