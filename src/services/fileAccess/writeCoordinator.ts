// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
let busy = false;
let tail: Promise<void> = Promise.resolve();

export function isProjectFileWriteBusy(): boolean {
  return busy;
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
