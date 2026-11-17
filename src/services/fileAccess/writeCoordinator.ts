// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
let busy = false;
let tail: Promise<void> = Promise.resolve();

export function isProjectFileWriteBusy(): boolean {
  return busy;
}

/**
 * #804 stap 3: `null` als er geen schrijfactie loopt of wacht; anders een belofte die klaar is zodra de rij leeg is
 * (ook een schrijfactie die intussen achteraan aansloot). De ene plek waarop afsluiten, een document sluiten en de
 * updater wachten. Nooit aanroepen en afwachten binnen `runProjectFileWrite`: dan wacht de rij op zichzelf.
 */
export function whenProjectFileWritesIdle(): Promise<void> | null {
  if (!busy) return null;
  const last = tail;
  return last.then(() => whenProjectFileWritesIdle() ?? undefined);
}

export async function runProjectFileWrite<T>(work: () => Promise<T>): Promise<T> {
  busy = true;
  let release: (() => void) | undefined;
  const turn = new Promise<void>((resolve) => { release = resolve; });
  const previous = tail;
  const queued = previous.then(() => turn);
  tail = queued;
  await previous;
  try {
    return await work();
  } finally {
    release!();
    // Een volgende wachtrijhouder houdt de vlag terecht hoog; pas als dit de staart was is de
    // volgende timer-run weer toegestaan.
    if (tail === queued) busy = false;
  }
}
