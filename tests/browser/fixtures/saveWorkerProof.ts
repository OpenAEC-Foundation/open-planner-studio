// Proefentry voor tests/browser/save-worker-production.spec.ts (#804 stap 4, fixronde 1 van #1016). De spec bouwt deze
// entry met de echte vite.config.ts in productiemodus; zo bouwt Vite de opslagworker zoals in de app (de URL in
// `defaultCreateIfcSaveWorker`, de workerplugins). Hier: een bestand met een gebouwmodel openen, de planning bewerken,
// en dezelfde merge laten rekenen door de uitgegeven worker en door de hoofdthread.
import { createIfcSaveWorker, defaultCreateIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import { computeIfcOutputHere, type IfcOutput, type IfcSaveJob } from '@/state/prepareIfcOutput';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { FEATURE_FLAGS } from '@/utils/featureFlags';

/** Eén vaste schrijfklok voor beide kanten, zodat dezelfde bytes ook dezelfde seconde hebben. */
const FIXED_NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
const FIXED_CLOCK = `const R=Date;class D extends R{constructor(...a){if(a.length)super(...a);else super(${FIXED_NOW});}`
  + `static now(){return ${FIXED_NOW};}}globalThis.Date=D;`;

/** De URL die Vite voor de opslagworker uitgaf, zonder hem te starten. */
function emittedWorkerUrl(): string {
  const RealWorker = globalThis.Worker;
  let url = '';
  globalThis.Worker = class { constructor(scriptUrl: string | URL) { url = String(scriptUrl); } } as unknown as typeof Worker;
  try { defaultCreateIfcSaveWorker(); } finally { globalThis.Worker = RealWorker; }
  return new URL(url, location.href).href;
}

async function hex(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)),
    b => b.toString(16).padStart(2, '0')).join('');
}

async function onMainThreadWithFixedClock(job: IfcSaveJob): Promise<IfcOutput> {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length) super(...(args as [number])); else super(FIXED_NOW);
    }
    static now(): number { return FIXED_NOW; }
  }
  globalThis.Date = FixedDate as DateConstructor;
  try { return await computeIfcOutputHere(job); } finally { globalThis.Date = RealDate; }
}

async function saveWorkerProof(text: string) {
  // Zoals tests/planning/ifcAppRoute.ts: de flag bruikbaar maken en aanzetten.
  FEATURE_FLAGS.find(f => f.id === 'ifcForeignContent')!.writesNewIfcData = false;
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'eigen-plus-model.ifc', content: '', bytes: new TextEncoder().encode(text), ref: null });
  const opened = store.getState();
  if (!opened.ifcSource?.foreign) throw new Error('Het bestand opende zonder vreemd deel.');
  // Een echte wijziging in de planning: de eerste gewone taak een dag langer, zodat de merge echt rekent.
  const task = opened.tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
  opened.updateTask(task.id, { time: { ...task.time, durationUnit: 'days', scheduleDuration: task.time.scheduleDuration + 1,
    durationMinutes: undefined } });
  const state = store.getState();
  const job: IfcSaveJob = { kind: 'merge', input: buildWriteIFCInput(state, 'merge'), source: state.ifcSource! };

  // De uitgegeven worker zelf, met de vaste klok vóór zijn eigen code: een kleine module die de klok zet en de worker
  // van Vite laadt. Het luisteren telt `started` en de antwoorden, zodat te zien is dat hij zelf rekende.
  const workerUrl = emittedWorkerUrl();
  let started = false, answers = 0;
  const saveWorker = createIfcSaveWorker({ createWorker: () => {
    // Twee statische imports: eerst de klok, dan de worker, en zijn `onmessage` staat er vóór het eerste bericht.
    const clock = URL.createObjectURL(new Blob([FIXED_CLOCK], { type: 'text/javascript' }));
    const boot = new Blob([`import ${JSON.stringify(clock)};\nimport ${JSON.stringify(workerUrl)};\n`], { type: 'text/javascript' });
    const port = new Worker(URL.createObjectURL(boot), { type: 'module' });
    port.addEventListener('message', (event: MessageEvent) => {
      if (typeof event.data === 'object' && event.data && 'started' in event.data) started = true; else answers++;
    });
    return port;
  } });
  let viaWorker: IfcOutput;
  try { viaWorker = await saveWorker.compute(job); } finally { saveWorker.dispose(); }
  const main = await onMainThreadWithFixedClock(job);
  if (!viaWorker.prepared || !main.prepared) throw new Error('Geen voorbereide merge.');
  return {
    workerUrl, started, answers,
    changed: viaWorker.prepared.sha256 !== state.ifcSource!.sha256,
    worker: { sha256: viaWorker.prepared.sha256, bytes: await hex(viaWorker.prepared.bytes), length: viaWorker.prepared.bytes.length },
    main: { sha256: main.prepared.sha256, bytes: await hex(main.prepared.bytes), length: main.prepared.bytes.length },
    sourceIntact: await hex(state.ifcSource!.bytes) === state.ifcSource!.sha256,
  };
}

Object.assign(window, { saveWorkerProof });
