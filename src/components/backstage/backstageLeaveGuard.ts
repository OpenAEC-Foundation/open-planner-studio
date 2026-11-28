export type BackstageLeaveGuard = (proceed: () => void) => boolean;

let current: BackstageLeaveGuard | null = null;

export function setBackstageLeaveGuard(guard: BackstageLeaveGuard | null): () => void {
  current = guard;
  return () => { if (current === guard) current = null; };
}

export function isBackstageLeaveGuardActive(): boolean {
  return current !== null;
}

export function leaveBackstageGuarded(proceed: () => void): void {
  if (current?.(proceed)) return;
  proceed();
}
