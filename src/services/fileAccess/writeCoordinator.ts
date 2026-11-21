// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
//
// De ene plek die de schrijfbeurten toewijst (fixronde 3 van de review van #1033, besluit technisch beslisser 20 november
// 2026). Eén rij, op volgorde van aankomst, met drie soorten beurten:
// - een handmatige actie (`runProjectFileWrite`: Ctrl+S, Opslaan als, een export, MCP) gaat voor: een ronde van
//   Automatisch opslaan met een gebouwmodel die nog vóór haar grens is, wijkt (ook wie op de rij wacht of een export die
//   voorrang claimt, laat haar wijken);
// - een gewone tik van Automatisch opslaan (`runAutoSaveTickWrite`) wacht op zijn beurt en laat niets wijken; staat er een
//   modelronde vóór hem, dan schrijft hij direct daarna;
// - een ronde met een gebouwmodel (`runYieldingProjectFileWrite`) krijgt haar beurt en wijkt alleen voor een handmatige
//   actie; na haar grens (`YieldingTurn.pass`) loopt ze af.
// Met de flag uit bestaan er geen modelrondes en is de rij dezelfde als vóór stap 8.
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

/** Fixronde 1 van de review van #1033: zoveel handmatige acties houden voorrang vóór ze de rij bereiken
 *  (`claimProjectFileWrite`). Zolang er één is, wijkt elke ronde meteen, ook een die nu pas om de rij vraagt. */
let claims = 0;
/** Fixronde 3 van de review van #1033: zoveel handmatige acties staan in de rij of lopen. Zolang er één is, kiest
 *  Automatisch opslaan geen kandidaten (`isManualProjectFileWriteQueued`), zoals vóór stap 8 met een bezette rij. */
let manual = 0;
/** De ronde die over haar grens ging en nog plaatst; de rij is serieel, dus hoogstens één. */
let placing: Promise<void> | null = null;

/** Besluit technisch beslisser, 19 november 2026: "Een handmatige actie gaat altijd voor." */
function yieldBackgroundWrites(): void {
  for (const controller of yielding) controller.abort(new YieldedToManualWrite());
}

/**
 * Fixronde 1 van de review van #1033: een handmatige actie die al rekent vóór ze om de rij vraagt (een IFC-export vraagt
 * de opslagworker vóór `runProjectFileWrite`), krijgt haar voorrang vanaf dit moment: een lopende ronde van Automatisch
 * opslaan met een gebouwmodel wijkt meteen (en stopt de worker), en tot de teruggegeven functie loopt wijkt elke nieuwe
 * ronde ook. Een gewone ronde merkt hier niets van.
 */
export function claimProjectFileWrite(): () => void {
  claims++;
  yieldBackgroundWrites();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims--;
  };
}

export function isProjectFileWriteBusy(): boolean {
  return busy;
}

/**
 * Fixronde 3 van de review van #1033: staat er een handmatige actie in de rij of loopt ze? Dan kiest Automatisch opslaan
 * (de gewone tik en de wekker van een gebouwmodel) deze keer geen kandidaten, zoals vóór stap 8 met een bezette rij. Een
 * lopende of wachtende ronde van Automatisch opslaan telt niet: een tik sluit daarachter aan en wacht.
 */
export function isManualProjectFileWriteQueued(): boolean {
  return manual > 0;
}

/**
 * Fixronde 2 van de review van #1033: `null` als geen ronde over haar grens is; anders een belofte die klaar is zodra
 * die ronde haar plaatsing en commit afmaakte. Een IFC-export neemt zijn bron pas daarna op.
 */
export function whenProjectFilePlacementSettled(): Promise<void> | null {
  return placing;
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
  return enqueue(work, closed, 'manual');
}

/**
 * Fixronde 3 van de review van #1033: een gewone tik van Automatisch opslaan (een document zonder gebouwmodel). Hij wacht
 * op zijn beurt in de rij en laat geen ronde wijken: staat er een ronde met een gebouwmodel vóór hem (rekenend of
 * plaatsend), dan schrijft hij direct na haar. Verder gelijk aan `runProjectFileWrite`.
 */
export async function runAutoSaveTickWrite<T>(work: () => Promise<T>, closed: () => T): Promise<T> {
  return enqueue(work, closed, 'tick');
}

/** De beurt van een wijkende ronde (`runYieldingProjectFileWrite`). */
export interface YieldingTurn {
  /** Gaat af zodra een andere schrijfactie om de rij vraagt, iemand op de rij wacht of een export voorrang claimt. */
  yielded: AbortSignal;
  /**
   * De grens: vlak vóór de eerste schrijfactie op het doel. `false`: de ronde week al (niets schrijven). `true`: vanaf nu
   * wijkt de ronde niet meer; ze loopt af, een export wacht op haar (`whenProjectFilePlacementSettled`) en wie om de rij
   * vraagt, wacht op zijn beurt. Synchroon, dus niets kan tussen de toets en de belofte komen.
   */
  pass: () => boolean;
}

/**
 * #804 stap 8: een ronde van Automatisch opslaan met een gebouwmodel, in dezelfde rij. `yielded` gaat af zodra een
 * handmatige actie om de rij vraagt (`runProjectFileWrite`, `claimProjectFileWrite`; een gewone tik niet, fixronde 3 van de
 * review van #1033) of iemand op de rij wacht (`whenProjectFileWritesIdle`, ook
 * `closeProjectFileWrites`), ook als de ronde zelf nog op haar beurt wacht. De ronde beslist zelf tot waar ze wijkt:
 * zolang ze nog rekent of controleert, stopt ze zonder te schrijven; is het herstelrecord geschreven, dan loopt ze af en
 * wacht de handmatige actie op haar beurt. Een gewone ronde (zonder gebouwmodel) gebruikt `runProjectFileWrite`.
 */
export async function runYieldingProjectFileWrite<T>(work: (turn: YieldingTurn) => Promise<T>, closed: () => T): Promise<T> {
  const controller = new AbortController();
  yielding.add(controller);
  if (claims > 0) controller.abort(new YieldedToManualWrite());
  let settle: (() => void) | undefined;
  const turn: YieldingTurn = {
    yielded: controller.signal,
    pass: () => {
      if (controller.signal.aborted) return false;
      if (!settle) {
        yielding.delete(controller);
        const settled = new Promise<void>(resolve => { settle = resolve; });
        placing = settled;
        void settled.then(() => { if (placing === settled) placing = null; });
      }
      return true;
    },
  };
  try {
    return await enqueue(() => work(turn), closed, 'model');
  } finally {
    yielding.delete(controller);
    settle?.();
  }
}

async function enqueue<T>(work: () => Promise<T>, closed: () => T, kind: 'manual' | 'tick' | 'model'): Promise<T> {
  if (closers > 0) return closed();
  busy = true;
  if (kind === 'manual') manual++;
  let release: (() => void) | undefined;
  const turn = new Promise<void>((resolve) => { release = resolve; });
  const previous = tail;
  const mine = previous.then(() => turn);
  tail = mine;
  await previous;
  try {
    return await work();
  } finally {
    release!();
    if (kind === 'manual') manual--;
    // Een volgende wachtrijhouder houdt de vlag terecht hoog; pas als dit de staart was is de
    // volgende timer-run weer toegestaan.
    if (tail === mine) busy = false;
  }
}
