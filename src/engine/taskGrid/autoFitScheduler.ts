export type AutoFitRunResult = 'done' | 'blocked';

export interface AutoFitSchedulerDeps {
  delayMs: number;
  isHeld: () => boolean;
  onReleased: (listener: () => void) => () => void;
  run: (signal: { isCancelled: () => boolean }) => Promise<AutoFitRunResult>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

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
