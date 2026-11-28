let holds = 0;
const listeners = new Set<() => void>();

export function holdAutoCalc(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) for (const listener of [...listeners]) listener();
  };
}

export function isAutoCalcHeld(): boolean {
  return holds > 0;
}

export function onAutoCalcReleased(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
