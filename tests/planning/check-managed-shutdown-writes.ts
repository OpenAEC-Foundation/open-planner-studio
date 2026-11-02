// Sols SIGTERM-proef: echte schrijfcoördinator en vervanger, met vertraagde truncate-then-write-I/O.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  for (const mode of ['scope', 'symlink', 'temporary', 'dialog']) {
    const result = spawnSync(process.execPath, [process.argv[1]!, mode], { stdio: 'inherit' });
    if (result.status !== 0) failed++;
  }
  assert.equal(failed, 0, 'alle SIGTERM-schrijfgrenzen moeten slagen');
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
