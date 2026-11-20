// De wekkers van de echte AutoSave naar het bestand: wanneer `useAutoSave` een ronde van de controller
// (`fileAutoSave.ts`) start. Los van React en met injecteerbare timers, zodat een proef het ritme met de echte store en
// de echte controller zonder wachten bewijst (#804 stap 8, fixronde 1).
import { actualAutoSaveDelay } from './actualAutoSave';
import type { FileAutoSaveController } from './fileAutoSave';

export interface AutoSaveTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  /** Dezelfde klok als het ritme van de controller (`now` in `createFileAutoSaveController`). */
  now: () => number;
}

const realTimers: AutoSaveTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export interface FileAutoSaveSchedule {
  /** Na elke wijziging in de store. */
  request: () => void;
  /** Na elke toetsaanslag in open veldinvoer (`onTextEntry`): de rust van een gebouwmodel begint opnieuw. */
  textEntry: () => void;
  dispose: () => void;
}

export function scheduleFileAutoSave(controller: FileAutoSaveController, timers: AutoSaveTimers = realTimers): FileAutoSaveSchedule {
  // #804 stap 8: een document met een gebouwmodel heeft een eigen ritme (30 s rust, uiterlijk 5 minuten, en een
  // ondergrens van tien keer de duur van zijn vorige ronde; `modelAutoSaveRhythm.ts`). Die wekker gaat ook af zonder
  // nieuwe wijziging: na de rust. Zonder zo'n document (ook met de flag uit) staat hij nooit. Hij start alleen de rondes
  // van de documenten met een gebouwmodel (`flushModels`, fixronde 1 van de review van #1033): een gewoon document houdt
  // zijn eigen 10 s.
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
    // Hoogstens eens per seconde: een ronde die aan de beurt is terwijl een handmatige opslag loopt, wacht zo zonder te
    // draaien op haar beurt.
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
