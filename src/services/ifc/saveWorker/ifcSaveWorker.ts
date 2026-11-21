/**
 * De bediening van de opslagworker (#804 stap 4), op het patroon van `recoverySnapshotSerializer.ts`: hoogstens één
 * verzoek tegelijk (een volgend verzoek wacht zijn beurt af), een verzoeknummer, een vaste starttijd, een rekentijd die
 * met de grootte van de bron meegroeit, en `dispose` breekt een lopend verzoek af. De gemounte app bezit één client
 * (`appStore.ts`, stap 5) en geeft zijn berekenfunctie onvoorwaardelijk aan de opslagroutes: de merge én de gewone writer
 * rekenen hier (stap 6, besluit technisch beslisser 16 november 2026, zonder flag).
 *
 * De levensduur (knownbug 1936): na een gewoon verzoek (de gewone writer) blijft de worker staan voor het volgende. Na
 * elk antwoord op een merge (een uitkomst of een weigering) stopt hij, en het volgende verzoek start een nieuwe. Een
 * worker ruimt na zijn taak het afval van zijn kopie van de bron en de indexen niet op: op de desktop bij 157 MB bleef de
 * app daardoor ongeveer 2 GB hoger staan, en een tweede merge in dezelfde worker piekte hoger dan de eerste. Het stoppen
 * gebeurt pas als het antwoord op deze thread verwerkt is; de buffers van het antwoord zijn overgedragen en horen dan bij
 * deze thread, dus het stoppen raakt de uitkomst niet.
 *
 * Starten. "Gestart" betekent: de worker meldde `started` (zijn script en imports zijn geladen). Daarvóór zijn een
 * ontbrekende `Worker`, een fout in de constructor (de sandbox van de SuperCloud-werkplek, zie `backgroundLeveling.ts`),
 * een fout bij het laden of geen `started` binnen `IFC_SAVE_START_TIMEOUT_MS` een startprobleem; die grens is voor elke
 * worker dezelfde. Na `started` geldt de rekentijd (`ifcSaveTimeoutMs`). Bij een startprobleem gelden twee regels naast
 * elkaar (besluiten technisch beslisser, 16 en 21 november 2026):
 * - Een gewoon verzoek doet wat main deed: de hoofdthread rekent zelf, met `computeIfcOutputHere` (zoals
 *   `prepareIfcOutput` zonder worker), en gewone verzoeken doen dat de rest van de sessie (`unavailable`). Met de flag
 *   uit is dit de enige soort verzoek, dus blijft daar alles zoals op main.
 * - Een merge (een gebouwmodel, alleen met de flag aan) valt alleen zo terug zolang er in deze sessie nog nooit een
 *   worker startte. Startte er al eens een, dan is een startprobleem bij een merge een fout (`IfcSaveWorkerError`,
 *   `not-started`) en nooit een terugval, ook als een gewoon verzoek intussen terugviel: de hoofdthread kan een groot
 *   model niet aan, en het venster zou vastlopen. De volgende merge probeert opnieuw een worker.
 * Na de start is sterven, de rekentijd overschrijden of een onleesbaar antwoord een fout, voor elk verzoek; een antwoord
 * dat niet bij het verzoek past (`resultFits`) ook. De aanroeper krijgt zo'n fout als mislukte opslag; de hoofdthread
 * rekent dan nooit opnieuw, de worker stopt en de volgende opslag start een nieuwe. Een inhoudelijke fout (een weigering
 * van de merge, een fout van de writer) komt als dezelfde foutsoort aan.
 */
import { computeIfcOutputHere, type IfcOutputCompute, type IfcSaveJob } from '@/state/prepareIfcOutput';
import {
  errorFromWire, outputFromResult, resultFits, wireErrorFits, type IfcSaveRequest, type IfcSaveResponse, type IfcSaveResult,
} from './ifcSaveProtocol';
import { IfcSaveWorkerError } from './ifcSaveWorkerError';

export type IfcSaveWorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

/** Zonder `started` binnen deze tijd startte de worker niet; voor elke worker dezelfde grens. Gekozen, niet gemeten (zie
 *  knownbug 1759 voor de scanner). Een gewoon verzoek valt dan terug (nooit fout, alleen trager); een merge na een eerdere
 *  start wordt een mislukte opslag die de planner opnieuw kan proberen. */
export const IFC_SAVE_START_TIMEOUT_MS = 10_000;

/** De rekentijd: 60 s plus 1 s per begonnen MiB bron (een merge van 300 MB krijgt zo ruim zes minuten). */
export function ifcSaveTimeoutMs(job: IfcSaveJob): number {
  const mib = job.kind === 'merge' ? Math.ceil(job.source.bytes.byteLength / 2 ** 20) : 0;
  return 60_000 + mib * 1_000;
}

/** De worker startte niet: alleen dan rekent de hoofdthread (zie de twee regels in de kop). */
class IfcSaveWorkerNotStarted extends Error {}

export interface IfcSaveWorkerOptions {
  /** Injecteerbaar voor tests. Standaard een module-worker, of `null` zonder `Worker`. */
  createWorker?: () => IfcSaveWorkerPort | null;
  startTimeoutMs?: number;
  timeoutMs?: (job: IfcSaveJob) => number;
}

export interface IfcSaveWorker {
  /** Voor `prepareIfcOutput(state, input, planOnly, compute)`: dezelfde uitkomst, berekend in de worker. */
  readonly compute: IfcOutputCompute;
  /** Stopt de worker; een lopend en elk later verzoek eindigt met `IfcSaveWorkerError` (`disposed`). */
  dispose(): void;
}

export function defaultCreateIfcSaveWorker(): IfcSaveWorkerPort | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./ifcSave.worker.ts', import.meta.url), { type: 'module' });
}

export function createIfcSaveWorker(opts: IfcSaveWorkerOptions = {}): IfcSaveWorker {
  const createWorker = opts.createWorker ?? defaultCreateIfcSaveWorker;
  const startTimeoutMs = opts.startTimeoutMs ?? IFC_SAVE_START_TIMEOUT_MS;
  const timeoutMs = opts.timeoutMs ?? ifcSaveTimeoutMs;
  let worker: IfcSaveWorkerPort | null = null;
  let started = false;
  /** Startte er in deze sessie al eens een worker (`started` ontvangen)? Dan is een startprobleem bij een merge een fout. */
  let startedOnce = false;
  /** Een start mislukte: gewone verzoeken rekenen de rest van de sessie op de hoofdthread, zoals op main. Een merge alleen
   *  als er nog nooit een worker startte (`startedOnce`). */
  let unavailable = false;
  let disposed = false;
  let nextId = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let abortActive: ((error: Error) => void) | null = null;

  const stopWorker = () => {
    worker?.terminate();
    worker = null;
    started = false;
  };
  const disposedError = () => new IfcSaveWorkerError('disposed', 'De opslagworker is gestopt.');
  const notStartedError = (message: string) => new IfcSaveWorkerError('not-started', message);

  const ask = (port: IfcSaveWorkerPort, job: IfcSaveJob, stop?: AbortSignal): Promise<IfcSaveResult> => {
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onStop: (() => void) | undefined;
    return new Promise<IfcSaveResult>((resolve, reject) => {
      // #804 stap 8: Automatisch opslaan wijkt. Deze worker stopt (het rekenen valt niet anders af te breken); het volgende
      // verzoek start een nieuwe. Geen fout van de worker, dus de client blijft bruikbaar.
      onStop = () => {
        if (worker === port) stopWorker();
        reject(stop!.reason);
      };
      stop?.addEventListener('abort', onStop, { once: true });
      const arm = () => {
        clearTimeout(timer);
        timer = started
          ? setTimeout(() => reject(new IfcSaveWorkerError('timeout', `De opslagworker antwoordde niet binnen ${timeoutMs(job)} ms.`)), timeoutMs(job))
          : setTimeout(() => reject(new IfcSaveWorkerNotStarted('De opslagworker startte niet op tijd.')), startTimeoutMs);
      };
      abortActive = reject;
      port.onmessage = ({ data }: MessageEvent<IfcSaveResponse>) => {
        if ('started' in data) {
          if (!started) { started = true; startedOnce = true; arm(); }
          return;
        }
        if (data.id !== id) return;
        // Het juiste nummer, maar een antwoord dat niet bij dit verzoek past: transport, nooit een uitkomst.
        if ('error' in data && wireErrorFits(data.error)) reject(errorFromWire(data.error));
        else if ('result' in data && resultFits(job, data.result)) resolve(data.result);
        else reject(new IfcSaveWorkerError('transport', 'De opslagworker gaf een antwoord dat niet bij het verzoek past.'));
      };
      port.onerror = (event) => {
        event.preventDefault();
        reject(started ? new IfcSaveWorkerError('crashed', event.message || 'De opslagworker stierf tijdens het rekenen.')
          : new IfcSaveWorkerNotStarted(event.message || 'De opslagworker startte niet.'));
      };
      port.onmessageerror = () => reject(new IfcSaveWorkerError('transport', 'De opslagworker gaf een onleesbaar antwoord.'));
      arm();
      try {
        // Een kopie, nooit een overdracht: de hoofdthread blijft eigenaar van de bronbytes.
        port.postMessage({ id, job } satisfies IfcSaveRequest);
      } catch (error) {
        reject(new IfcSaveWorkerError('transport', `Het opslagverzoek kon niet naar de worker: ${error instanceof Error ? error.message : String(error)}`));
      }
    }).finally(() => {
      clearTimeout(timer);
      if (onStop) stop?.removeEventListener('abort', onStop);
      abortActive = null;
      port.onmessage = null;
      port.onerror = null;
      port.onmessageerror = null;
    });
  };

  const compute: IfcOutputCompute = (job, stop) => {
    const run = tail.then(async () => {
      if (disposed) throw disposedError();
      // Week de ronde al terwijl ze op haar beurt in de worker wachtte, dan rekent ze niet.
      if (stop?.aborted) throw stop.reason;
      // Een merge na een eerdere start rekent alleen in een worker; elk ander verzoek doet bij een startprobleem wat main deed.
      const workerOnly = job.kind === 'merge' && startedOnce;
      if (!worker && (!unavailable || workerOnly)) {
        try { worker = createWorker(); } catch { worker = null; }
        started = false;
        if (!worker) {
          if (workerOnly) throw notStartedError('De opslagworker kon niet worden aangemaakt.');
          unavailable = true;
        }
      }
      if (!worker) return computeIfcOutputHere(job);
      const port = worker;
      try {
        return outputFromResult(job, await ask(port, job, stop));
      } catch (error) {
        if (stop?.aborted) throw error;
        if (error instanceof IfcSaveWorkerNotStarted) {
          if (worker === port) stopWorker();
          if (disposed) throw disposedError();
          if (workerOnly) throw notStartedError(error.message);
          unavailable = true;
          return computeIfcOutputHere(job);
        }
        // Gestorven, verlopen of onleesbaar: deze worker niet meer gebruiken, en niet opnieuw rekenen.
        if (error instanceof IfcSaveWorkerError && worker === port) stopWorker();
        throw error;
      } finally {
        // Knownbug 1936: na elk antwoord op een merge stopt de worker, ook na een weigering. Het antwoord is hier al
        // verwerkt; een verzoek dat op zijn beurt wacht, start daarna een nieuwe worker.
        if (job.kind === 'merge' && worker === port) stopWorker();
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };

  return {
    compute,
    dispose: () => {
      disposed = true;
      const abort = abortActive;
      stopWorker();
      abort?.(disposedError());
    },
  };
}
