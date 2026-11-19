// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
let busy = false;
let tail: Promise<void> = Promise.resolve();
/** Hoeveel afsluitfasen de poort dicht houden (afsluiten en de updater kunnen elkaar overlappen). */
let closers = 0;
/** #804 stap 8: de rondes van Automatisch opslaan met een gebouwmodel die in de rij staan of lopen
 *  (`runYieldingProjectFileWrite`). Elke andere vraag om de rij laat ze wijken. */
const yielding = new Set<AbortController>();

/** De reden waarmee een wijkende ronde afbreekt: een handmatige actie meldde zich. Geen fout. */
export class YieldedToManualWrite extends Error {
  constructor() {
    super('Automatisch opslaan wijkt voor een handmatige actie.');
    this.name = 'YieldedToManualWrite';
  }
}

/** Besluit technisch beslisser, 19 november 2026: "Een handmatige actie gaat altijd voor." */
function yieldBackgroundWrites(): void {
  for (const controller of yielding) controller.abort(new YieldedToManualWrite());
}

export function isProjectFileWriteBusy(): boolean {
  return busy;
}

/**
 * #804 stap 3: `null` als er geen schrijfactie loopt of wacht; anders een belofte die klaar is zodra de rij leeg is
 * (ook een schrijfactie die intussen achteraan aansloot). De ene plek waarop afsluiten, een document sluiten en de
 * updater wachten. Nooit aanroepen en afwachten binnen `runProjectFileWrite`: dan wacht de rij op zichzelf.
 */
export function whenProjectFileWritesIdle(): Promise<void> | null {
  // #804 stap 8: wie op de rij wacht (een tabblad sluiten, de laatste fase van afsluiten of de updater, een pad openen
  // op de desktop), wacht niet op het rekenen van een ronde van Automatisch opslaan.
  yieldBackgroundWrites();
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
  // #804 stap 8: een handmatige schrijfactie (Ctrl+S, Opslaan als, een export, ook van een ander tabblad) gaat voor.
  yieldBackgroundWrites();
  return enqueue(work, closed);
}

/**
 * #804 stap 8: een ronde van Automatisch opslaan met een gebouwmodel, in dezelfde rij. `yielded` gaat af zodra een andere
 * schrijfactie om de rij vraagt (`runProjectFileWrite`) of iemand op de rij wacht (`whenProjectFileWritesIdle`, ook
 * `closeProjectFileWrites`), ook als de ronde zelf nog op haar beurt wacht. De ronde beslist zelf tot waar ze wijkt:
 * zolang ze nog rekent of controleert, stopt ze zonder te schrijven; is het herstelrecord geschreven, dan loopt ze af en
 * wacht de handmatige actie op haar beurt. Een gewone ronde (zonder gebouwmodel) gebruikt `runProjectFileWrite`.
 */
export async function runYieldingProjectFileWrite<T>(work: (yielded: AbortSignal) => Promise<T>, closed: () => T): Promise<T> {
  const controller = new AbortController();
  yielding.add(controller);
  try {
    return await enqueue(() => work(controller.signal), closed);
  } finally {
    yielding.delete(controller);
  }
}

async function enqueue<T>(work: () => Promise<T>, closed: () => T): Promise<T> {
  if (closers > 0) return closed();
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
