// METING #804, desktop-verdeling (meet-branch, niet voor main): wat houdt de code na één Ctrl+S nog vast?
// Eén model uit de generator (hoogstens 10 MB lokaal), geopend zoals de app op een eigen pad (flag aan), één duur
// langer, dan Ctrl+S via de echte store-actie (`saveFile`), de echte bediening van de opslagworker
// (`createIfcSaveWorker`) en de echte vervangroute op Node-fs (`nodeFileIpc.ts`). De worker is een dubbel in dit proces
// dat zich gedraagt als een browserworker: heen een kopie (`structuredClone`), terug met overdracht, en hij houdt na
// zijn antwoord NIETS vast (anders dan `InProcessWorker`, dat zijn verzoeken bewaart). Na de opslag twee keer `gc()`:
// wat dan nog in `arrayBuffers` staat, houdt de code vast; wat vóór gc meer was, is afval. Zwakke verwijzingen naar de
// oude bronbuffer en naar de kopie van de worker zeggen of die vrij te geven zijn. Daarna een tweede Ctrl+S.
//
//   node --expose-gc <bundel> <mb>
import assert from 'node:assert/strict';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { loadStore } from '../../tests/planning/ifcAppRoute';
import { installNodeFileIpc } from '../../tests/planning/nodeFileIpc';
import { settle } from '../../tests/planning/ifcMergeKern';
import { createIfcSaveWorker, type IfcSaveWorkerPort } from '@/services/ifc/saveWorker/ifcSaveWorker';
import type { IfcSaveRequest, IfcSaveResponse } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';

const mb = Number(process.argv[2] ?? '10');
if (!(mb > 0 && mb <= 10)) throw new Error('lokaal hoogstens 10 MB');
const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('start met --expose-gc');
const MiB = (n: number) => Math.round(n / 1048576 * 10) / 10;
const mem = () => { const m = process.memoryUsage(); return { arrayBuffersMiB: MiB(m.arrayBuffers), heapMiB: MiB(m.heapUsed), rssMiB: MiB(m.rss) }; };
const settled = () => { gc!(); gc!(); return mem(); };
const out = (o: unknown) => console.log(JSON.stringify(o));

await i18next.init({ lng: 'nl', fallbackLng: 'en', resources: { nl: { common: nlCommon }, en: { common: enCommon } } });
await loadStore();
const root = process.env.OPS_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'ops-meet-na-opslag-'));
const appData = join(work, 'appdata');
mkdirSync(appData);
installNodeFileIpc({ appDataDir: appData });

// Het model: dezelfde generator en dezelfde basis als `meet-opslag.mjs` (het voorbeeld, gezet, met de modelregels weg).
const generator = readFileSync(join(root, 'scripts/proef/meet-scanner.mjs'), 'utf8');
const gStart = generator.indexOf('const GUID_CHARS ='), gEnd = generator.indexOf('// ── Het voorbeeld zoals', gStart);
const makeFile = new Function('openSync', 'writeSync', 'closeSync', `${generator.slice(gStart, gEnd)}\nreturn makeFile;`)(
  openSync, writeSync, closeSync) as (mb: number, path: string, variant: string, base: string) => number;
const exampleText = readFileSync(join(root, 'public/examples/showcase-appartementencomplex.ifc'), 'utf8');
const maxExampleId = Math.max(...[...exampleText.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
const probe = join(work, 'probe.ifc');
makeFile(0, probe, 'model', exampleText);
const baseText = new TextDecoder().decode(await settle(new Uint8Array(readFileSync(probe)))).split('\n')
  .filter(line => { const m = /^#(\d+)=/.exec(line); return !m || Number(m[1]) <= maxExampleId; }).join('\n');
const dir = join(work, 'project');
mkdirSync(dir);
const path = join(dir, 'model.ifc');
const walls = makeFile(mb, path, 'model', baseText);
// Geen eigen verwijzing naar de geopende bytes: die worden de bron in de store, en de proef mag haar niet vasthouden.
const fileSize = readFileSync(path).length;
out({ bestand: fileSize, bestandMiB: MiB(fileSize), wanden: walls });
/** Een macrotaak verder: zwakke verwijzingen die in de vorige taak gelezen werden, houden hun doel dan niet meer vast. */
const nextTask = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/** Welke gevolgde buffers de garbage collector vrijgaf. Een `FinalizationRegistry`, geen `WeakRef`: een `WeakRef` houdt
 *  zijn doel binnen de taak van aanmaken of `deref()` vast (KeepDuringJob) en vertekende zo de eerste versie van deze proef. */
const freed = new Set<string>();
// De lib van tsconfig kent `FinalizationRegistry` niet (ES2020); Node 22 heeft hem wel.
type Registry = { register(target: object, label: string): void };
const registry = new (globalThis as unknown as { FinalizationRegistry: new (cb: (label: string) => void) => Registry })
  .FinalizationRegistry((label: string) => { freed.add(label); });
let jobCount = 0;
/** De worker als in een browser, zonder iets te bewaren na zijn antwoord; zijn kopie van de bron wordt gevolgd. */
class LeanWorker implements IfcSaveWorkerPort {
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  private started = false;
  postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]) {
    const transfer = Array.isArray(options) ? options : options?.transfer ?? [];
    const request = structuredClone(message as IfcSaveRequest, { transfer });
    if (request.job.kind === 'merge') registry.register(request.job.source.bytes.buffer, `kopie-worker-${++jobCount}`);
    setTimeout(() => {
      if (!this.started) { this.started = true; this.emit({ started: true }); }
      void this.answer(request);
    }, 0);
  }
  private async answer(request: IfcSaveRequest) {
    const { handleIfcSaveRequest } = await import('@/services/ifc/saveWorker/ifcSaveProtocol');
    const { response, transfer } = await handleIfcSaveRequest(request);
    this.emit(structuredClone(response, { transfer }));
  }
  private emit(data: IfcSaveResponse) { this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent<IfcSaveResponse>); }
  terminate() {}
}

const client = createIfcSaveWorker({ createWorker: () => new LeanWorker() });
const { createAppStoreContext } = await loadStore();
const { store } = createAppStoreContext({ ifcSaveCompute: client.compute });
store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
await store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes: new Uint8Array(readFileSync(path)), ref: { kind: 'path', path } });
assert(store.getState().ifcSource?.foreign, 'geopend met een vreemd deel');
// De herstelronde van `useAutoSave`, zoals `opened()` in `check-ifc-own-file-replace.ts`: zonder haar legt de vervanging
// de komende versie niet vast en schrijft ze niet (`not-recorded`).
const tracker = new RecoveryDeltaTracker();
registerRecoveryFlush(async () => {
  const s = store.getState();
  await runRecoveryTick(tracker, s.activeDocumentId,
    s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
});
await flushRecoveryNow();
const lengthen = () => {
  const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
};

for (const round of ['eerste', 'tweede', 'derde'] as const) {
  lengthen();
  // In een eigen functie: geen sterke verwijzing naar de oude bron in deze lus, anders houdt de proef haar zelf levend.
  const sizes = (() => {
    const before = store.getState().ifcSource!;
    registry.register(before.bytes.buffer, `bron-voor-${round}`);
    return { bron: before.bytes.length, indexBron: before.chunkStarts.byteLength + before.chunkIds.byteLength + before.classes.byteLength };
  })();
  const vooraf = settled();
  const t0 = performance.now();
  await store.getState().saveFile();
  const ms = Math.round(performance.now() - t0);
  const zonderGc = mem();
  await nextTask();
  const naGcMeteen = settled();
  await nextTask();
  const oudeBronVrijMeteen = freed.has(`bron-voor-${round}`);
  // Een halve seconde later (de herstelronde na de opslag kan nog lopen), weer in een nieuwe taak.
  await nextTask(500);
  const naGc = settled();
  await nextTask();
  // Optioneel nog langer wachten en opnieuw kijken (OPS_WACHT_MS): is wat na gc bleef echt vastgehouden of nog onderweg?
  const wacht = Number(process.env.OPS_WACHT_MS ?? 0);
  const laat = wacht > 0 ? await (async () => { await nextTask(wacht); const m = settled(); await nextTask(); return { naMs: wacht, ...m, oudeBronVrij: freed.has(`bron-voor-${round}`) }; })() : undefined;
  if (process.env.OPS_HEAPSNAPSHOT_RONDE === round) (await import('node:v8')).writeHeapSnapshot(process.env.OPS_HEAPSNAPSHOT!);
  const now = store.getState().ifcSource!;
  assert.equal(store.getState().isDirty, false, `${round}: opgeslagen (${JSON.stringify(store.getState().ui.notifications)})`);
  assert.notEqual(now.bytes.length, 0);
  out({
    ronde: round, ms, ...sizes, vooraf, zonderGc, naGcMeteen, oudeBronVrijMeteen, naGc,
    groeiNaGcMiB: Math.round((naGc.arrayBuffersMiB - vooraf.arrayBuffersMiB) * 10) / 10,
    afvalVoorGcMiB: Math.round((zonderGc.arrayBuffersMiB - naGc.arrayBuffersMiB) * 10) / 10,
    arrayBuffersNaGcInBestanden: Math.round(naGc.arrayBuffersMiB / MiB(now.bytes.length) * 100) / 100,
    oudeBronVrij: freed.has(`bron-voor-${round}`),
    kopieWorkerVrij: freed.has(`kopie-worker-${jobCount}`),
    ...(laat ? { laat } : {}),
    nieuweBron: now.bytes.length, nieuweIndex: now.chunkStarts.byteLength + now.chunkIds.byteLength + now.classes.byteLength,
    nieuweIndexBuffers: now.chunkStarts.buffer.byteLength + now.chunkIds.buffer.byteLength + now.classes.buffer.byteLength,
  });
}
// Optioneel een heap-snapshot na de laatste ronde, om te zien wie een oude bron vasthoudt (`vasthouders.mjs`).
if (process.env.OPS_HEAPSNAPSHOT) { await nextTask(); settled(); (await import('node:v8')).writeHeapSnapshot(process.env.OPS_HEAPSNAPSHOT); }
client.dispose();
rmSync(work, { recursive: true, force: true });
writeFileSync(1, 'klaar\n');
