import { actualAutoSaveDelay } from './actualAutoSave';
import type { FileAutoSaveController } from './fileAutoSave';

export interface AutoSaveTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  now: () => number;
}

const realTimers: AutoSaveTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export interface FileAutoSaveSchedule {
  request: () => void;
  textEntry: () => void;
  dispose: () => void;
}

export function scheduleFileAutoSave(controller: FileAutoSaveController, timers: AutoSaveTimers = realTimers): FileAutoSaveSchedule {
  let modelTimer: unknown = null;
  let modelTimerAt: number | null = null;
  const armModelRound = () => {
    const at = controller.nextModelRoundAt();
    if (at === modelTimerAt) return;
    if (modelTimer !== null) timers.clearTimeout(modelTimer);
    modelTimer = null;
    modelTimerAt = at;
    if (at === null) return;
    modelTimer = timers.setTimeout(() => {
      modelTimer = null;
      modelTimerAt = null;
      void controller.flushModels().finally(armModelRound);
    }, Math.max(1_000, at - timers.now()));
  };

  let timer: unknown = null;
  let lastRunAt = 0;
  return {
    request: () => {
      controller.observe();
      armModelRound();
      if (timer !== null) return;
      timer = timers.setTimeout(() => {
        timer = null;
        lastRunAt = timers.now();
        void controller.flush().finally(armModelRound);
      }, actualAutoSaveDelay(lastRunAt, timers.now()));
    },
    textEntry: () => {
      controller.noteTextEntry();
      armModelRound();
    },
    dispose: () => {
      if (timer !== null) timers.clearTimeout(timer);
      if (modelTimer !== null) timers.clearTimeout(modelTimer);
    },
  };
}
