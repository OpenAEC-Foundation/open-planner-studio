type RecoveryFlush = () => Promise<void>;
let registered: RecoveryFlush | null = null;

export function registerRecoveryFlush(flush: RecoveryFlush): () => void {
  registered = flush;
  return () => { if (registered === flush) registered = null; };
}

export async function flushRecoveryNow(): Promise<void> {
  if (registered) await registered();
}

type RecoveryClear = () => Promise<void>;
let registeredClear: RecoveryClear | null = null;

export function registerRecoveryClear(clear: RecoveryClear): () => void {
  registeredClear = clear;
  return () => { if (registeredClear === clear) registeredClear = null; };
}

export function clearRecoveryNow(): Promise<void> | null {
  return registeredClear ? registeredClear() : null;
}
