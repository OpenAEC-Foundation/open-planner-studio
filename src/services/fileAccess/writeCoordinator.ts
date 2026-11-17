// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
let busy = false;
let tail: Promise<void> = Promise.resolve();
/** Hoeveel afsluitfasen de poort dicht houden (afsluiten en de updater kunnen elkaar overlappen). */
let closers = 0;

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

/**
 * #804 stap 3, fixronde 1: de laatste fase van afsluiten en van de updater. Vanaf de aanroep (in dezelfde beurt) laat
 * `runProjectFileWrite` niets nieuws meer toe; wat al was toegelaten, loopt af en wordt hier afgewacht. Een lege rij
 * alleen is geen garantie: zonder deze poort kon na het wachten nog een Ctrl+S of een ronde van Automatisch opslaan
 * beginnen terwijl het venster dichtging of de updater installeerde. De poort blijft dicht tot en met `destroy` of
 * `relaunch`; daarna (of als die stap mislukt) zet de teruggegeven functie hem weer open (één keer telt).
 */
export async function closeProjectFileWrites(): Promise<() => void> {
  closers++;
  let open = false;
  const reopen = () => {
    if (open) return;
    open = true;
    closers--;
  };
  await whenProjectFileWritesIdle();
  return reopen;
}

/**
 * Schrijft onder de lock. `closed` is wat deze route teruggeeft als de laatste fase (`closeProjectFileWrites`) al
 * begonnen is: dan loopt `work` niet, er wordt niets geschreven en het document blijft zoals het was (niet als
 * opgeslagen gemarkeerd). Elke route kiest die uitkomst zelf, zodat een weigering nooit als mislukte opslag meldt.
 */
export async function runProjectFileWrite<T>(work: () => Promise<T>, closed: () => T): Promise<T> {
  // MUTATIE: de poort gaat niet dicht.
  void closed;
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
