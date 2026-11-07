// Nivelleren op de achtergrond (audit 2026-09-26). De nivelleer-dialoog rekende synchroon op de
// UI-thread: bij duizenden taken bevroor de app tot de berekening klaar was. Hier draait dezelfde
// `levelResources` in een Web Worker; `cancel()` beëindigt hem direct. Zonder Worker-ondersteuning
// (headless tests), of als de browser de worker weigert (opaque origin, #818), valt hij terug op
// dezelfde functie in een volgende macrotask.
//
// Bewust GEEN achtergrondroute voor de AI-bridge: `planner_batch` moet volledig synchroon blijven
// (spec MCP-bridge, invariant b) en roept `levelResources` dus rechtstreeks aan.
import { levelResources, type LevelingInput, type LevelingResult } from '@/engine/scheduler/ResourceLeveler';

export interface BackgroundLeveling {
  result: Promise<LevelingResult>;
  cancel: () => void;
}

export class LevelingCancelledError extends Error {
  constructor() {
    super('Nivelleren geannuleerd');
    this.name = 'LevelingCancelledError';
  }
}

/** Dezelfde berekening op de hoofdthread, in een volgende macrotask (zonder Worker). */
function levelOnMainThread(input: LevelingInput): BackgroundLeveling {
  let cancelled = false;
  const result = new Promise<LevelingResult>((resolve, reject) => {
    setTimeout(() => {
      if (cancelled) { reject(new LevelingCancelledError()); return; }
      try { resolve(levelResources(...input)); } catch (error) { reject(error); }
    }, 0);
  });
  return { result, cancel: () => { cancelled = true; } };
}

export function levelInBackground(input: LevelingInput): BackgroundLeveling {
  if (typeof Worker === 'undefined') return levelOnMainThread(input);

  // In een sandbox-frame zonder `allow-same-origin` (de SuperCloud-werkplek, #818) heeft het document een
  // opaque origin. De browser weigert dan een worker van het adres van de bundel al in de constructor
  // (`SecurityError`). Het contract vraagt een terugval op de hoofdthread; nivelleren blijft zo werken.
  let worker: Worker;
  try {
    worker = new Worker(new URL('../../engine/scheduler/levelingWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return levelOnMainThread(input);
  }
  let settle: { reject: (error: unknown) => void } | null = null;
  const result = new Promise<LevelingResult>((resolve, reject) => {
    settle = { reject };
    worker.onmessage = (event: MessageEvent<{ ok: true; result: LevelingResult } | { ok: false; message: string }>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Nivelleren in de achtergrond mislukt'));
    };
    worker.postMessage({ input });
  });
  return {
    result,
    cancel: () => {
      worker.terminate();
      settle?.reject(new LevelingCancelledError());
    },
  };
}
