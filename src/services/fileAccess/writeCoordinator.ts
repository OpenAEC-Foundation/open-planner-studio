// Eén app-instantie mag nooit twee schrijfroutes tegelijk naar projectbestanden sturen. De lock
// omvat ook de handmatige opslaan-dialoog: tijdens die blokkerende keuze mag een timer niet nog
// een tweede write voorbereiden. Het is app-runtime, geen document- of IFC-data.
//
// De ene plek die over de schrijfbeurten beslist (fixronde 3 van de review van #1033 en knownbug 1939, besluiten technisch
// beslisser 19, 20 en 21 november 2026): welke beurt eerst komt, en of Automatisch opslaan om een beurt vraagt. Eén beurt
// tegelijk, één rij op volgorde van aankomst, zoals main: wie eerder om de rij vroeg, gaat eerder, ook een gewone doorgang
// die op haar plek wacht. Een begonnen beurt loopt af. Drie soorten beurten:
// - een handmatige actie (`runProjectFileWrite`: Ctrl+S, Opslaan als, een export, MCP): een ronde van Automatisch opslaan
//   met een gebouwmodel die nog vóór haar grens is, wijkt (ook wie op de rij wacht of een export die voorrang claimt, laat
//   haar wijken);
// - een gewone tik van Automatisch opslaan (`runAutoSaveTickWrite`) laat niets wijken; zijn doorgang
//   (`runAutoSaveRound`) houdt haar plek achter een modelronde en maakt haar lijst pas als die aan de beurt is;
// - een ronde met een gebouwmodel (`runYieldingProjectFileWrite`) krijgt haar beurt en wijkt alleen voor een handmatige
//   actie; na haar grens (`YieldingTurn.pass`) loopt ze af.
// De toelating van timerwerk staat ook hier (`runAutoSaveRound`): staat er een handmatige actie in de rij of loopt ze, of
// is de laatste fase begonnen, dan maakt Automatisch opslaan geen lijst. Een handmatige actie gaat dus niet vóór
// wachtend gewoon timerwerk (knownbug 1937 blijft open): wijzen twee tabbladen naar hetzelfde bestand, dan zou de
// automatische opslag van het ene ná de handmatige van het andere komen en de gekozen versie stil overschrijven.
/** Een wachtende beurt: `grant` geeft haar het slot (een gewone doorgang: haar plek). `yielded`: het signaal van een
 *  modelronde. */
interface Waiting { grant: () => void; yielded?: AbortSignal }
/** Een beurt houdt het slot. */
let running = false;
/** Wie op het slot wacht, op volgorde van aankomst: handmatige acties, writes van Automatisch opslaan, rondes met een
 *  gebouwmodel en gewone doorgangen die op hun plek wachten. */
const waiting: Waiting[] = [];
/** Knownbug 1939: een gewone doorgang van Automatisch opslaan is aan de beurt (`runAutoSaveRound`). Zolang ze loopt,
 *  begint geen modelronde; alleen een modelronde die al week, maakt haar beurt af (ze schrijft niets), zodat wie op een
 *  lege rij wacht niet op deze doorgang wacht. */
let roundOpen = false;
/** Fixronde 2 van de review van #1093: een gewone doorgang die op haar plek moest wachten, houdt bij haar beurt het slot
 *  tot haar eerste write (die het overneemt) of tot ze zonder write eindigt. Wat na haar om de rij vroeg, komt zo ook
 *  na die write, zoals op main na de tik die zijn write al had aangevraagd. Kreeg ze haar plek meteen, dan houdt ze niets
 *  vast (zoals main, ook tijdens haar schrijftoestemming). */
let placeHeld = false;
/** Wie op een lege rij wacht (`whenProjectFileWritesIdle`); kijkt na elke verandering in de rij opnieuw. */
let idleWaiters: (() => void)[] = [];
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
/** Zoveel handmatige acties staan in de rij of lopen. Zolang er één is, laat de coördinator geen doorgang van
 *  Automatisch opslaan toe (`runAutoSaveRound`), zoals vóór stap 8 met een bezette rij. */
let manual = 0;
/** De ronde die over haar grens ging en nog plaatst; de rij is serieel, dus hoogstens één. */
let placing: Promise<void> | null = null;

/** Besluit technisch beslisser, 19 november 2026: een handmatige actie laat elke modelronde vóór haar grens wijken. */
function yieldBackgroundWrites(): void {
  for (const controller of yielding) controller.abort(new YieldedToManualWrite());
}

/** De voorrang van een handmatige actie die al rekent vóór ze om de rij vraagt (`claimProjectFileWrite`). */
interface ProjectFileWriteClaim {
  /** Geeft de voorrang terug; één keer telt. */
  release: () => void;
  /**
   * Fixronde 2 van de review van #1033: `null` als geen ronde over haar grens is; anders een belofte die klaar is zodra
   * die ronde haar plaatsing en commit afmaakte. Een IFC-export neemt zijn bron pas daarna op. Zolang de claim loopt, gaat
   * geen ronde meer over haar grens, dus er komt geen tweede plaatsing bij.
   */
  placement: Promise<void> | null;
}

/**
 * Fixronde 1 van de review van #1033: een handmatige actie die al rekent vóór ze om de rij vraagt (een IFC-export vraagt
 * de opslagworker vóór `runProjectFileWrite`), krijgt haar voorrang vanaf dit moment: een lopende ronde van Automatisch
 * opslaan met een gebouwmodel wijkt meteen (en stopt de worker), en tot `release` wijkt elke nieuwe ronde ook. Een ronde
 * die al plaatst, wijkt niet meer; op haar wacht de aanroeper met `placement` (knownbug 1939: één functie, zodat
 * voorrang en wachten niet los van elkaar te gebruiken zijn). Een gewone ronde merkt hier niets van.
 */
export function claimProjectFileWrite(): ProjectFileWriteClaim {
  claims++;
  yieldBackgroundWrites();
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      claims--;
    },
    placement: placing,
  };
}

/** Loopt er een beurt of wacht er een? */
export function isProjectFileWriteBusy(): boolean {
  return running || waiting.length > 0;
}

/**
 * #804 stap 3: `null` als er geen schrijfactie loopt of wacht; anders een belofte die klaar is zodra de rij leeg is
 * (ook een schrijfactie die intussen aansloot). De ene plek waarop afsluiten, een document sluiten en de
 * updater wachten. Nooit aanroepen en afwachten binnen `runProjectFileWrite`: dan wacht de rij op zichzelf.
 */
export function whenProjectFileWritesIdle(): Promise<void> | null {
  // #804 stap 8: wie op de rij wacht (een tabblad sluiten, de laatste fase van afsluiten of de updater, een pad openen
  // op de desktop), wacht niet op het rekenen van een ronde van Automatisch opslaan.
  yieldBackgroundWrites();
  // De laatste fase wacht ook niet op de schrijftoestemming van een doorgang die haar plek vasthoudt (knownbug 1813); haar
  // write krijgt daarna de gesloten uitkomst.
  if (closers > 0) releasePlace();
  // Een geweken modelronde maakt haar beurt af, ook achter een open gewone doorgang.
  grantFree();
  if (!isProjectFileWriteBusy()) return null;
  return new Promise<void>(resolve => { idleWaiters.push(resolve); }).then(() => whenProjectFileWritesIdle() ?? undefined);
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
  // #804 stap 8: een handmatige schrijfactie (Ctrl+S, Opslaan als, een export, ook van een ander tabblad) laat een
  // modelronde wijken.
  yieldBackgroundWrites();
  return enqueue('manual', work, closed);
}

/**
 * Fixronde 3 van de review van #1033: een write van de open gewone doorgang van Automatisch opslaan (`runAutoSaveRound`,
 * een document zonder gebouwmodel). Hij laat geen ronde wijken en wacht in de rij op volgorde van aankomst; de eerste
 * write van een doorgang die haar plek vasthoudt, krijgt het slot meteen. Verder gelijk aan `runProjectFileWrite`.
 */
export async function runAutoSaveTickWrite<T>(work: () => Promise<T>, closed: () => T): Promise<T> {
  return enqueue('write', work, closed);
}

/**
 * Knownbug 1939: één doorgang van Automatisch opslaan (één lijst plus haar writes; `createActualAutoSaveController` laat
 * elke doorgang, ook een herhaalronde, hierdoor lopen). Staat er een handmatige actie in de rij of loopt ze, of is de
 * laatste fase begonnen, dan loopt de doorgang niet: geen lijst, zoals vóór stap 8 met een bezette rij. Een doorgang die al
 * op haar plek wachtte, loopt wel als er intussen een handmatige actie bijkwam: op main stond die tik al in de rij. Een
 * modeldoorgang (`'model'`) loopt meteen; haar rondes wachten elk op hun beurt (`runYieldingProjectFileWrite`). Een gewone
 * doorgang (`'tick'`) krijgt een plek in de rij, op volgorde van aankomst, en maakt haar lijst pas als die plek aan de
 * beurt is: ze leest de actuele kandidaat en bestemming, en verder typen kost haar die plek niet (knownbug 1938). Moest ze
 * op die plek wachten, dan houdt ze het slot tot haar eerste write (`placeHeld`). Zolang ze loopt, begint geen
 * modelronde. De plek geldt voor één doorgang: een herhaalronde vraagt opnieuw, zodat een groot gewoon plan met doortypen
 * een modelronde niet blijvend tegenhoudt.
 */
export async function runAutoSaveRound(kind: 'tick' | 'model', pass: () => Promise<void>): Promise<void> {
  if (manual > 0 || closers > 0) return;
  if (kind === 'model') return pass();
  let granted = false;
  let resume: (() => void) | undefined;
  waiting.push({ grant: () => {
    roundOpen = true;
    granted = true;
    // `resume` bestaat alleen als de doorgang moest wachten: dan houdt ze het slot vast.
    if (resume) { running = true; placeHeld = true; resume(); }
  } });
  pump();
  // Is de plek meteen vrij (met de flag uit altijd), dan maakt de doorgang haar lijst in dezelfde beurt, zoals vóór stap 8.
  if (!granted) await new Promise<void>(resolve => { resume = resolve; });
  try {
    if (closers === 0) await pass();
  } finally {
    releasePlace();
    roundOpen = false;
    pump();
  }
}

/** Een doorgang die haar plek vasthield en geen write meer doet (of de laatste fase begon), geeft het slot vrij. */
function releasePlace(): void {
  if (!placeHeld) return;
  placeHeld = false;
  running = false;
}

/** De beurt van een wijkende ronde (`runYieldingProjectFileWrite`). */
export interface YieldingTurn {
  /** Gaat af zodra een andere schrijfactie om de rij vraagt, iemand op de rij wacht of een export voorrang claimt. */
  yielded: AbortSignal;
  /**
   * De grens: vlak vóór de eerste schrijfactie op het doel. `false`: de ronde week al (niets schrijven). `true`: vanaf nu
   * wijkt de ronde niet meer; ze loopt af, een export wacht op haar (`placement` in zijn claim) en wie om de rij
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
 * wacht de handmatige actie op haar beurt.
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
    return await enqueue('model', () => work(turn), closed, controller.signal);
  } finally {
    yielding.delete(controller);
    settle?.();
  }
}

/** Wie krijgt het vrije slot: de oudste in de rij; bij een open gewone doorgang de oudste die geen modelronde is of een
 *  modelronde die al week. */
function nextTurn(): Waiting | undefined {
  const next = roundOpen ? waiting.findIndex(turn => !turn.yielded || turn.yielded.aborted) : 0;
  return next < 0 ? undefined : waiting.splice(next, 1)[0];
}

/** Geeft het vrije slot weg (een gewone doorgang die haar plek meteen krijgt, houdt het slot niet). */
function grantFree(): void {
  while (!running) {
    const turn = nextTurn();
    if (!turn) return;
    turn.grant();
  }
}

/** Na elke verandering in de rij: het slot weggeven en wie op een lege rij wacht opnieuw laten kijken. */
function pump(): void {
  grantFree();
  const waiters = idleWaiters;
  idleWaiters = [];
  for (const wake of waiters) wake();
}

/** Zet een beurt in de rij: een handmatige actie (`'manual'`), een write van de open gewone doorgang (`'write'`; de eerste
 *  van een doorgang die haar plek vasthoudt, neemt het slot over) of een modelronde (`'model'`, met haar signaal). */
async function enqueue<T>(kind: 'manual' | 'write' | 'model', work: () => Promise<T>, closed: () => T,
  yielded?: AbortSignal): Promise<T> {
  if (closers > 0) return closed();
  const isManual = kind === 'manual';
  if (isManual) manual++;
  if (kind === 'write' && placeHeld) placeHeld = false;
  else await new Promise<void>(resolve => {
    waiting.push({ grant: () => { running = true; resolve(); }, yielded });
    pump();
  });
  try {
    return await work();
  } finally {
    running = false;
    if (isManual) manual--;
    pump();
  }
}
