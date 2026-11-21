// #804, knownbug 1762: de vraag om toegang tot een map vóór de mapkiezer, langs de bedrading van de app
// (`state/folderAccessQuestionBridge.ts` op de gemounte store). Wat de dialoog ziet (`ui.pendingFolderAccessQuestion`),
// dat de vraag de rest van de app stilzet zoals de vraag "alleen de planning", en dat een antwoord de juiste vraag
// beantwoordt. De opslagroutes zelf staan in `check-ifc-own-file-replace.ts` en `check-ifc-document-save.ts`.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import './domStub';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useAppStore } from '@/state/appStore';
import { answerFolderAccessQuestion, installFolderAccessAsker } from '@/state/folderAccessQuestionBridge';
import { requestReplaceFolderAccess } from '@/services/fileAccess';
import { resetFolderAccessAsker } from '@/services/fileAccess/replaceFolderAccess';
import { isBlockingDialogOpen, saveQuestionOpen } from '@/state/blockingDialogs';
import { isGlobalShortcutFrozen } from '@/hooks/keyboard/shortcutRegistry';
import { installNodeFileIpc } from './nodeFileIpc';

let ok = 0, failed = 0;
/** Na elke proef, ook een mislukte: geen open vraag meer en de scope van het begin. */
function tidy() {
  if (pending() !== null) answerFolderAccessQuestion(false);
  ipc.scope.reset();
  ipc.scope.outside = path => path === work || path.startsWith(`${work}/`);
}
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); ok++; console.log(`OK ${name}`); } catch (error) { failed++; console.log(`XX ${name}\n   ${String(error)}`); } finally { tidy(); }
}

const work = realpathSync(mkdtempSync(join(tmpdir(), 'ops-folder-question-')));
const ipc = installNodeFileIpc();
ipc.dialog.pickFolder = () => work;
const target = join(work, 'model.ifc');
const pending = () => useAppStore.getState().ui.pendingFolderAccessQuestion;
tidy();
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
/** Het antwoord, of `hangt` als het na 2 s nog niet kwam. */
const within = <T>(answer: Promise<T>) => Promise.race([answer, new Promise<'hangt'>(r => setTimeout(() => r('hangt'), 2000))]);
/** Wacht tot de vraag openstaat (de toets op de scope gaat eerst langs plugin-fs). */
async function questionOpen(): Promise<void> {
  for (let i = 0; i < 100 && pending() === null; i++) await settle();
  assert.equal(pending(), work, 'de vraag staat open, met de map');
}
installFolderAccessAsker();

await check('de vraag staat open met de map; ze zet de app stil zoals de vraag "alleen de planning"; Map kiezen opent de mapkiezer', async () => {
  const from = ipc.calls.length;
  const answer = requestReplaceFolderAccess(target);
  await questionOpen();
  const ui = useAppStore.getState().ui;
  assert.deepEqual([isBlockingDialogOpen(ui), saveQuestionOpen(ui), isGlobalShortcutFrozen(ui)], [true, true, true],
    'blokkerend, een vraag waarop een opslag wacht, en geen enkele globale sneltoets');
  assert.deepEqual(ipc.calls.slice(from).filter(c => c.command === 'plugin:dialog|open'), [], 'nog geen mapkiezer');
  answerFolderAccessQuestion(true);
  assert.equal(pending(), null, 'de vraag is dicht');
  assert.equal(await within(answer), 'ok');
  assert.equal(ipc.calls.slice(from).filter(c => c.command === 'plugin:dialog|open').length, 1, 'één mapkiezer');
  assert.equal(isGlobalShortcutFrozen(useAppStore.getState().ui), false);
});

await check('Annuleren: geen mapkiezer; een tweede klik daarna doet niets', async () => {
  const from = ipc.calls.length;
  const answer = requestReplaceFolderAccess(target);
  await questionOpen();
  answerFolderAccessQuestion(false);
  answerFolderAccessQuestion(true);
  assert.equal(await within(answer), 'cancelled');
  assert.equal(pending(), null);
  assert.deepEqual(ipc.calls.slice(from).filter(c => c.command === 'plugin:dialog|open'), [], 'geen mapkiezer');
});

await check('een tweede vraag terwijl de eerste openstaat: de eerste telt als geannuleerd, het antwoord gaat naar de tweede', async () => {
  const first = requestReplaceFolderAccess(target);
  await questionOpen();
  useAppStore.getState().setUI({ pendingFolderAccessQuestion: null });
  const second = requestReplaceFolderAccess(target);
  await questionOpen();
  assert.equal(await within(first), 'cancelled', 'de eerste vraag geannuleerd');
  answerFolderAccessQuestion(true);
  assert.equal(await within(second), 'ok');
  assert.equal(pending(), null);
});

resetFolderAccessAsker();
ipc.dispose();
rmSync(work, { recursive: true, force: true });
console.log(`Vraag om toegang tot een map: ${ok} OK, ${failed} XX`);
process.exit(failed === 0 ? 0 : 1);
