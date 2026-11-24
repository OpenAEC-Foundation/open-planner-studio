import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { addBom, allTraces, differences, hasBom, openStore, ownPlanning, placeInBrowser, placeOnDisk } from './bomEigenBestand';
import { installDeterminism } from './ifcPariteitKern';

installDeterminism();
const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const root = mkdtempSync(join(tmpdir(), 'ops-bom-eigen-'));
let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<string[]>) {
  const found = await action().catch((error: unknown) => [error instanceof Error ? error.message : String(error)]);
  if (found.length === 0) { passed++; console.log(`OK ${name}`); }
  else { failed++; console.error(`XX ${name}: ${found.join(' | ').slice(0, 1600)}`); }
}

try {
  const without = await allTraces(repo, root, false);
  const withBom = await allTraces(repo, root, true);
  for (const [name, steps] of Object.entries(without)) {
    await check(`2212 ${name}: met BOM zoals zonder BOM, de BOM blijft`, async () => differences(steps, withBom[name] ?? []));
  }

  const source = addBom(await ownPlanning(new Uint8Array(readFileSync(join(repo, 'public/examples/03-kantoorgebouw-zuidas.ifc')))));
  const unreadable = { 'Ctrl+S': 'notifications.ifcUnreadableTargetSave', 'Automatisch opslaan': 'notifications.ifcUnreadableTargetAutoSave' } as const;
  for (const kind of ['pad', 'handle'] as const) {
    for (const how of ['Ctrl+S', 'Automatisch opslaan'] as const) {
      for (const atRead of [1, 2] as const) {
        const moment = atRead === 1 ? 'tijdens de doelscan' : 'na de beslissing, tijdens de laatste toets';
        await check(`2212 ${kind}, ${how}: de flag gaat uit ${moment}`, async () => {
          const place = kind === 'pad' ? placeOnDisk(root, source) : placeInBrowser(source);
          try {
            const store = await openStore(source, place.ref);
            const task = store.getState().tasks.find(t => !t.isSummary)!;
            store.getState().updateTask(task.id, { name: 'Flag uit tijdens de opslag' });
            let reads = 0;
            place.onRead(() => { if (++reads === atRead) store.getState().setUI({ featureFlags: {} }); });
            let saved: boolean;
            if (how === 'Ctrl+S') saved = await store.getState().saveFileForDocument(store.getState().activeDocumentId);
            else {
              store.getState().setAutoSaveToFile(true);
              await createFileAutoSaveController({ getState: store.getState, enabled: () => true }).flush();
              saved = !store.getState().isDirty;
            }
            const disk = place.read()!;
            const errors = store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
            const found: string[] = [];
            if (reads < atRead) found.push(`de opslag las het doel maar ${reads} keer`);
            if (atRead === 1) {
              if (saved) found.push('geschreven, terwijl main hier weigert');
              if (JSON.stringify(errors) !== JSON.stringify([unreadable[how]])) found.push(`meldingen ${JSON.stringify(errors)}`);
              if (Buffer.compare(Buffer.from(disk), Buffer.from(source)) !== 0) found.push('de bron met BOM staat er niet meer');
            } else if (saved && !hasBom(disk)) found.push('geslaagd zonder BOM');
            else console.log(`..  ${kind}, ${how}, ${moment}: ${saved ? 'geschreven met BOM' : `geweigerd ${JSON.stringify(errors)}`}`);
            return found;
          } finally { place.dispose(); }
        });
      }
    }
  }
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(`Eigen bestand met een BOM: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
