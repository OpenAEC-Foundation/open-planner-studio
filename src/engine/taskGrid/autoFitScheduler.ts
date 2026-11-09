// Wanneer meet "Kolommen automatisch aanpassen"? Pas na een korte rust, en nooit zolang er een
// bewerking loopt (`holdAutoCalc` in `state/editHold.ts`: een tekstveld in het eigenschappenpaneel dat per
// toetsaanslag naar de store schrijft, een sleepgebaar op de Gantt). Anders verandert een kolom terwijl
// iemand nog typt. Zodra de bewerking klaar is (`onReleased`), volgt één nieuwe meting.
//
// Bewust zonder React en zonder store, met ingespoten klok en blokkade, zodat een planningscheck het
// gedrag kan bewijzen (`check-task-grid-columns.ts`).

export type AutoFitRunResult = 'done' | 'blocked';

export interface AutoFitSchedulerDeps {
  /** Rust vóór een meting (ms). */
  delayMs: number;
  /** Loopt er een bewerking? (`isAutoCalcHeld`) */
  isHeld: () => boolean;
  /** Meld je aan voor het moment dat de laatste blokkade vrijkomt; geeft de afmelding terug. */
  onReleased: (listener: () => void) => () => void;
  /** Meet en schrijf. Geef `'blocked'` terug als er onderweg een bewerking begon: er is dan niets
   *  geschreven en de planner wacht op het vrijgeven. */
  run: (signal: { isCancelled: () => boolean }) => Promise<AutoFitRunResult>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Plan één meting. Geeft de functie terug die alles afbreekt (timer en wachten op vrijgeven). */
export function startAutoFitScheduler(deps: AutoFitSchedulerDeps): () => void {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let cancelled = false;
  let timer: unknown = null;
  let unsubscribe: (() => void) | null = null;

  const stopWaiting = () => {
    unsubscribe?.();
    unsubscribe = null;
  };
  const arm = () => {
    timer = setTimer(() => {
      timer = null;
      void attempt();
    }, deps.delayMs);
  };
  const waitForRelease = () => {
    stopWaiting();
    unsubscribe = deps.onReleased(() => {
      stopWaiting();
      if (!cancelled) arm();
    });
  };
  const attempt = async () => {
    if (cancelled) return;
    if (deps.isHeld()) {
      waitForRelease();
      return;
    }
    const result = await deps.run({ isCancelled: () => cancelled });
    if (cancelled || result !== 'blocked') return;
    // Tussen "geblokkeerd" en nu kan de blokkade al weg zijn: dan komt er geen vrijgeefmelding meer.
    if (deps.isHeld()) waitForRelease();
    else arm();
  };

  arm();
  return () => {
    cancelled = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
    stopWaiting();
  };
}
