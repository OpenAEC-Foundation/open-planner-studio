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
