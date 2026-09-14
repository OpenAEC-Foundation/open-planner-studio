// B1c-plan3 taak 8 — de voorstel-hook van de verdeeldialoog (spec §3.4).
//
// DRIE DINGEN, EN NIETS MEER. (1) De invoer bouwen: van de open documenten naar
// `DistributionDocInput[]`, met de VOLLEDIGE payloadvelden. (2) Het voorstel op DISCRETE momenten
// rekenen, met een zichtbare bezig-toestand. (3) De schaal-degradatie: op een groot overzicht
// rekent alleen "Herbereken" nog.
//
// WAAROM DISCREET EN NIET REACTIEF (§3.4). `computeDistribution` draait per deelnemend document een
// volledige CPM-solve plus een nivelleerpass. Dat is geen render-werk. De hook abonneert zich daarom
// bewust NIET op de documentinhoud: hij leest de store pas op het moment dat er echt gerekend wordt
// (`useAppStore.getState()` binnen de run). Dat is dezelfde keuze als `runCPM` zelf — handmatig, niet
// reactief — en het is de reden dat er een stale-strook bestaat: het voorstel MAG achterlopen op de
// documenten, mits de gebruiker dat ziet.
//
// DE BEZIG-TOESTAND IS ECHT, GEEN COSMETICA. `setBusy(true)` gebeurt synchroon, het rekenen pas in
// een `setTimeout(…, 0)` daarna — anders blokkeert de synchrone solve de paint en ziet de gebruiker
// nooit dat er iets gebeurt. Er loopt er precies één tegelijk; een verzoek dat tijdens een run
// binnenkomt wordt daarna precies ÉÉN keer ingehaald (niet N keer). DÍT MECHANISME IS DE THROTTLE
// DIE SPEC §5 VRAAGT: onder de ondersteunde schaal commit de balk élke gesnapte werkdag tijdens het
// slepen, en deze in-flight-bewaking zorgt dat er maximaal één run loopt en de laatste stand wint.
// Er hoort hier GEEN tweede timer bij te komen — die zou de laatste stand kunnen inslikken.
//
// SCHAAL-DEGRADATIE (§3.4). Boven `MAX_TASKS_AUTO` taken in één deelnemend document of
// `MAX_BOOKING_TASKS_AUTO` boekende taken op dít poolitem is automatisch doorrekenen bij elke
// tune-wijziging niet meer te doen. Dan blijft alleen de EXPLICIETE route over: het openen (één keer)
// en "Herbereken". De dialoog toont dat met `compute.degraded` + `compute.pressRecompute`; de
// stale-strook blijft dan gewoon staan tot de gebruiker drukt — precies de bedoeling.
//
// DE VOORSTEL-INVALIDATIE (taak 12, spec §6a). Naast de vier tune-assen hierboven vervalt een
// voorstel ook wanneer een BETROKKEN DOCUMENT verandert — van buiten de dialoog, want de dialoog
// zelf is modaal met een focus-trap: auto-save-herstel, een MCP-tool, een extensie, of het
// Toepassen van dit paneel zelf. De bewaking is `documentFingerprint` per document (taak 4):
// referenties van de velden die `computeDistribution` leest, plus `runtime.mutationSeq()` als
// grofmazige backstop voor het actieve document.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appStoreContext, useAppStore, type AppState } from '@/state/appStore';
import type { DistributionUiState } from '@/state/slices/types';
import type { CompanyPool } from '@/types/library';
import {
  computeDistribution,
  scopeTaskIdsFor,
  type DistributionDocInput,
  type DistributionProposal,
} from '@/services/library/distribute';
import { documentFingerprint } from '@/services/library/proposalFingerprint';
import { maxEndShiftWorkdays, savingsWorkdays } from './stripGeometry';
import { documentTitle, untitledOrdinals, displayDocumentTitle } from '@/utils/documents';

/** Meer taken dan dit in één deelnemend document ⇒ handmatig herberekenen (§3.4). */
export const MAX_TASKS_AUTO = 1000;
/** Meer taken dan dit die op dít poolitem boeken ⇒ handmatig herberekenen (§3.4). */
export const MAX_BOOKING_TASKS_AUTO = 40;
/**
 * Meer GEOPENDE DOCUMENTEN dan dit ⇒ handmatig herberekenen (fixronde-2 bevinding B6).
 *
 * De twee grenzen hierboven meten één document tegelijk, en dat mist de kost die juist met het
 * AANTAL documenten meegroeit: `computeDistribution` draait per deelnemer een volledige CPM-solve
 * plus nivelleerpass, en de labelpas doet dat nóg een keer per deelnemer (spec §4 stap 1). De
 * totale kost van een tune-tik loopt dus ruwweg met het KWADRAAT van het aantal documenten op,
 * terwijl elk afzonderlijk document ruim onder `MAX_TASKS_AUTO` kan blijven. Spec §3.4 rekent met
 * "vier documenten ≈ ≤ 2 s"; zes is daarvan de marge, daarboven blijft alleen de expliciete route
 * over ("Herbereken"). Gemeten aanleiding: vijf documenten van 990 taken gaven een hoofdrun van
 * 1,6 s plus een labelpas van 3,8 s — en dat bij élke tune-wijziging.
 */
export const MAX_DOCS_AUTO = 6;

/** Waarom het huidige voorstel niet meer actueel is — 1-op-1 de `resource.distribution.stale.*`
 *  sleutels. De vier tune-assen komen uit `diffReason`; `'edited'` komt uit de
 *  vingerafdruk-bewaking (taak 12, spec §6a).
 *
 *  "Document geopend/gesloten" en "documentwissel" staan hier BEWUST NIET bij: die lopen alle vijf
 *  via `resetDocumentScopedUI` (`documentSlice`) en sluiten de hele dialoog (besluit eigenaar
 *  2026-08-31) in plaats van een reden te tonen. Daarom heeft de i18n-familie ook geen
 *  `stale.documents`-sleutel. */
export type DistributionStaleReason = 'rank' | 'ceiling' | 'pin' | 'tool' | 'edited';

/** De velden die `documentFingerprint` van één document leest, uit de LIVE top-level state (het
 *  actieve document) of uit een slapende payload. Beide vormen hebben exact deze tien velden. */
function fingerprintOfActive(s: AppState, mutationSeq: number): string {
  return documentFingerprint({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
    calendar: s.calendar, calendars: s.calendars, project: s.project, cpmResult: s.cpmResult,
    scheduleStale: s.scheduleStale, datesAsRecorded: s.datesAsRecorded,
  }, mutationSeq);
}

/**
 * De vingerafdruk van ELK geopend document (spec §6a). Het actieve document leest uit top-level
 * plus de mutatieteller van deze storecontext; een slaper leest uit zijn payload — daar ís geen
 * eigen teller voor, en die is er ook niet nodig: een slapende payload wordt altijd in zijn geheel
 * VERVANGEN (`recalculateStaleSleepingDocuments`, `applyDistribution`, `undoDistribution`), dus de
 * referenties zijn daar per constructie sluitend. Vandaar `mutationSeq = 0` voor slapers.
 */
export function documentFingerprints(s: AppState, mutationSeq: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const document of s.documents) {
    out[document.id] = document.id === s.activeDocumentId
      ? fingerprintOfActive(s, mutationSeq)
      : document.payload === null ? '' : documentFingerprint(document.payload, 0);
  }
  return out;
}

export interface DistributionProposalState {
  /** Het laatst berekende voorstel, of `null` zolang er nog nooit gerekend is. */
  proposal: DistributionProposal | null;
  /** Er loopt een berekening (§3.4 bezig-toestand). */
  busy: boolean;
  /** Er loopt nog een LABELPAS: het hoofdvoorstel staat al op het scherm, maar de kostenlabels en
   *  het prijskaartje worden nog gerekend (fixronde-2 bevinding B6). De dialoog toont daar
   *  `compute.busy` voor — een leeg of oud label zou liegen — terwijl de hoofdknoppen gewoon
   *  bruikbaar blijven: deze pas raakt het voorstel zelf niet. */
  labelsBusy: boolean;
  /** Niet-null ⇒ het voorstel hoort niet meer bij de bediening; de dialoog toont de reden. */
  staleReason: DistributionStaleReason | null;
  /** De LAATSTE reden sinds het openen, ook nadat de strook alweer verdwenen is. Puur voor
   *  observeerbaarheid (browsertest): een automatische herberekening op een klein project is
   *  binnen één macrotask klaar, dus de strook zelf is dan niet betrouwbaar te vangen. */
  lastStaleReason: DistributionStaleReason | null;
  /** De documenttitels die bij `staleReason === 'edited'` in de tekst horen (`stale.edited` heeft
   *  een `{{docs}}`-parameter); leeg bij elke andere reden. */
  staleDocs: string;
  /** Te groot om automatisch door te rekenen (§3.4). */
  degraded: boolean;
  /** De expliciete route: "Verdeel automatisch" / "Herbereken". */
  recompute: () => void;
  /** De invoer waarop het HUIDIGE voorstel gerekend is — de dialoog leest hier de documenttitels
   *  en de float per document uit, zodat rangordelijst en strook nooit uit een andere bron komen. */
  inputs: DistributionDocInput[];
  /**
   * Het VERSCHIL-prijskaartje van "Onderbrekingen toestaan" (spec §2.2, eigenaarsbesluit
   * 2026-09-12). Twee volledige `computeDistribution`-runs — één met `allowSplits: false`, één met
   * `true` — leveren elk de grootste `endShiftWorkdays` over de deelnemers (de UITSCHIETER, niet de
   * som); `workdays` is het verschil daartussen, geklemd op ≥ 0.
   *
   * Waarom één verschil en niet twee bedragen: de gebruikstest van 2026-09-12 las "kost 27
   * werkdagen uitloop · kost 27 werkdagen uitloop" als een weergavefout. Een gebruiker wil weten wat
   * de schakelaar hém oplevert, niet wat elke stand los kost.
   *
   * `null` ⇒ nog niet (her)berekend; de dialoog zegt dan eerlijk "prijs onbekend".
   */
  savings: { workdays: number } | null;
}

/**
 * Bouw de `DistributionDocInput` van élk open document, met de VOLLEDIGE payloadvelden.
 *
 * DIT IS DE SCHERPSTE VAL VAN DEZE TAAK. `ResourceOccupancyView` voedt `computeLibraryOccupancy`
 * bewust met een bibliotheek-SNIT (§7-cache): alleen de resources/toewijzingen/taken die op deze
 * pool boeken. Voor een AGGREGATIE is dat aantoonbaar betekenis-behoudend. Voor een VERDELING niet:
 * `computeDistribution` draait per document een echte CPM-solve plus nivellering, en die zien met een
 * gesnoeide takenlijst en zonder relaties een totaal andere planning dan `runCPM` in dat document.
 * Hier gaan dus de hele `tasks`/`sequences`/`resources`/`assignments` mee — referenties, geen
 * kopieën; de kosten vallen pas bij een echte solve, en die kloont zelf.
 *
 * Het ACTIEVE document leeft top-level (`s.project`/`s.tasks`/…), de slapers in `payload`.
 */
export function buildDistributionInputs(
  s: AppState,
  untitledLabel: string,
  tune: Pick<DistributionUiState, 'order' | 'pinned' | 'ceilings'>,
): DistributionDocInput[] {
  const payloads = s.documents.map(document => (
    document.id === s.activeDocumentId
      ? {
          id: document.id,
          payload: {
            project: s.project, filePath: s.filePath,
            resources: s.resources, assignments: s.assignments, tasks: s.tasks,
            sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
            scheduleStale: s.scheduleStale, datesAsRecorded: s.datesAsRecorded,
          },
        }
      : {
          id: document.id,
          payload: {
            project: document.payload!.project, filePath: document.payload!.filePath,
            resources: document.payload!.resources, assignments: document.payload!.assignments,
            tasks: document.payload!.tasks, sequences: document.payload!.sequences,
            calendar: document.payload!.calendar, calendars: document.payload!.calendars,
            scheduleStale: document.payload!.scheduleStale,
            datesAsRecorded: document.payload!.datesAsRecorded,
          },
        }
  ));
  // Zelfde titel-afleiding als de tabbladen en het bezettingsoverzicht (rauwe titel → volgnummer
  // voor naamloze documenten → vertaald label eromheen).
  const rawTitles = payloads.map(({ payload }) => documentTitle(payload.filePath, payload.project.name));
  const ordinals = untitledOrdinals(rawTitles);
  return payloads.map(({ id, payload }, i) => ({
    docId: id,
    title: displayDocumentTitle(rawTitles[i], ordinals[i], untitledLabel),
    scheduleStale: payload.scheduleStale,
    companyId: payload.project.companyId ?? null,
    resources: payload.resources,
    assignments: payload.assignments,
    tasks: payload.tasks,
    calendar: payload.calendar,
    calendars: payload.calendars,
    solveInput: {
      tasks: payload.tasks, sequences: payload.sequences, dataDate: payload.project.statusDate,
      progressMode: payload.project.progressMode, schedulingOptions: payload.project.schedulingOptions,
    },
    levelInput: {
      tasks: payload.tasks, sequences: payload.sequences, dataDate: payload.project.statusDate,
      progressMode: payload.project.progressMode, schedulingOptions: payload.project.schedulingOptions,
    },
    // Een document dat de gebruiker nog niet in de rangorde heeft gezien (`indexOf` = -1) krijgt
    // rang 0 en plaatst dus vóór de rest — bewust: dat kan alleen een document zijn dat ná het
    // openen is bijgekomen, en dat is per definitie het minst "ingedeeld".
    rank: tune.order.indexOf(id) + 1,
    pinned: tune.pinned[id] === true,
    datesAsRecorded: payload.datesAsRecorded,
    ceilingWorkdays: tune.ceilings[id] ?? null,
  }));
}

/**
 * De startvolgorde bij openen (§4 stap 1): float-gesorteerd. De float van een DOCUMENT is de
 * KLEINSTE totale float over zijn taken die op dit poolitem boeken — dus het document met de minste
 * speling staat bovenaan en wordt het meest ontzien. Documenten zonder boekende taak sluiten
 * achteraan aan; gelijke float breekt stabiel op `docId`.
 */
export function documentFloatOn(
  doc: DistributionDocInput,
  companyId: string,
  libraryItemId: string,
): number | null {
  const scope = new Set(scopeTaskIdsFor(doc, companyId, libraryItemId));
  if (scope.size === 0) return null;
  let min: number | null = null;
  for (const task of doc.tasks) {
    if (!scope.has(task.id)) continue;
    const float = task.time.totalFloat;
    if (typeof float !== 'number' || Number.isNaN(float)) continue;
    if (min === null || float < min) min = float;
  }
  return min;
}

/** `documentFloatOn` over alle documenten → de docIds in startvolgorde. */
export function floatSortedOrder(
  inputs: DistributionDocInput[],
  companyId: string,
  libraryItemId: string,
): string[] {
  return inputs
    .map(doc => ({ docId: doc.docId, float: documentFloatOn(doc, companyId, libraryItemId) }))
    .sort((a, b) => {
      if (a.float === null && b.float === null) return a.docId.localeCompare(b.docId);
      if (a.float === null) return 1;
      if (b.float === null) return -1;
      return (a.float - b.float) || a.docId.localeCompare(b.docId);
    })
    .map(entry => entry.docId);
}

/**
 * Verse tune-state voor één poolitem: float-gesorteerde rangorde, niets gepind, geen plafonds,
 * niets toegepast. Gedeeld door de ingang in het bezettingsoverzicht en de lintknop, zodat er maar
 * één definitie van "openen op dit item" bestaat.
 */
export function freshDistributionUi(
  s: AppState,
  untitledLabel: string,
  companyId: string,
  libraryItemId: string,
): DistributionUiState {
  const inputs = buildDistributionInputs(s, untitledLabel, { order: [], pinned: {}, ceilings: {} });
  return {
    companyId,
    libraryItemId,
    allowSplits: false,
    order: floatSortedOrder(inputs, companyId, libraryItemId),
    pinned: {},
    ceilings: {},
    applied: null,
  };
}

/**
 * Schaal-degradatie (§3.4), als losse functie zodat zowel de memoized `degraded`-waarde als een
 * MET-DE-LAATSTE-INVOER berekening binnen de run-callback (vóór de volgende render) exact dezelfde
 * poort delen — de labelpas in taak 13 moet weten of ZIJ nog mag rekenen op basis van de invoer die
 * zojuist gebouwd is, niet op basis van de `degraded`-waarde van de vorige render.
 */
function isDistributionDegraded(
  inputs: DistributionDocInput[],
  tune: Pick<DistributionUiState, 'companyId' | 'libraryItemId'>,
): boolean {
  // De documenttelling staat VOORAAN: hij is gratis, en de lus eronder doet per document een
  // `scopeTaskIdsFor` (bevinding B6 — de poort telde het aantal documenten helemaal niet mee).
  if (inputs.length > MAX_DOCS_AUTO) return true;
  for (const doc of inputs) {
    if (doc.tasks.length > MAX_TASKS_AUTO) return true;
    if (scopeTaskIdsFor(doc, tune.companyId, tune.libraryItemId).length > MAX_BOOKING_TASKS_AUTO) return true;
  }
  return false;
}

/** Alle sleutels van twee records samen — de basis van een volgorde-ONgevoelige vergelijking. */
function allKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])];
}

/**
 * Zijn dit dezelfde pins? AFWEZIG ≡ `false` — de dialoog zet een pin uit door `false` te schrijven
 * (`setPinned`), maar een verse tune-state (`freshDistributionUi`) levert gewoon een leeg object.
 * Dat is dezelfde bediening en mag dus niet als wijziging lezen.
 */
function samePins(prev: Record<string, boolean>, next: Record<string, boolean>): boolean {
  return allKeys(prev, next).every(docId => (prev[docId] === true) === (next[docId] === true));
}

/**
 * Zijn dit dezelfde plafonds? AFWEZIG ≡ `null` = ONBEGRENSD — dat is letterlijk de lezing van
 * `DistributionUiState.ceilings` en van `buildDistributionInputs` (`tune.ceilings[id] ?? null`).
 * Let op het verschil met plafond 0: dat is "geen enkele uitloop toegestaan", een echte grens, en
 * dus wél een andere stand dan onbegrensd.
 */
function sameCeilings(
  prev: Record<string, number | null>,
  next: Record<string, number | null>,
): boolean {
  return allKeys(prev, next).every(docId => (prev[docId] ?? null) === (next[docId] ?? null));
}

/**
 * Welke tune-as is er veranderd? Volgorde van benoemen = volgorde van de spec-taxonomie.
 *
 * VOLGORDE-ONGEVOELIG (fixronde-2 bevinding B11). Dit stond op `JSON.stringify`, en die vergelijkt
 * óók de sleutelVOLGORDE en het verschil tussen "afwezig" en een expliciet geschreven default. Een
 * `setUI` die de records opnieuw opbouwt las daardoor als een pin- of plafondwijziging: het
 * voorstel verviel, de stale-strook verscheen en Toepassen ging op slot zonder dat de gebruiker
 * iets veranderd had. De vergelijking is nu de VERZAMELING sleutels met een expliciete default per
 * as.
 *
 * Geëxporteerd voor `tests/planning/check-distribution-chart-scale.ts`: de rest van de hook is
 * React-gebonden, dit stukje is puur en hoort mechanisch vastgezet.
 */
export function diffReason(
  prev: DistributionUiState,
  next: DistributionUiState,
): DistributionStaleReason | null {
  if (prev.allowSplits !== next.allowSplits) return 'tool';
  if (prev.order.join('\u0000') !== next.order.join('\u0000')) return 'rank';
  if (!samePins(prev.pinned, next.pinned)) return 'pin';
  if (!sameCeilings(prev.ceilings, next.ceilings)) return 'ceiling';
  return null;
}

/**
 * De voorstel-hook. `tune` is `ui.levelingDistribution`; is die `null` (de dialoog staat open zonder
 * gekozen poolitem — de `selectHint`-toestand), dan rekent de hook niets.
 */
export function useDistributionProposal(tune: DistributionUiState | null): DistributionProposalState {
  const { t } = useTranslation('common');
  const untitledLabel = t('project.untitled');

  const [proposal, setProposal] = useState<DistributionProposal | null>(null);
  const [inputs, setInputs] = useState<DistributionDocInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [labelsBusy, setLabelsBusy] = useState(false);
  const [staleReason, setStaleReason] = useState<DistributionStaleReason | null>(null);
  const [lastStaleReason, setLastStaleReason] = useState<DistributionStaleReason | null>(null);
  const [staleDocs, setStaleDocs] = useState('');
  const [savings, setSavings] = useState<{ workdays: number } | null>(null);
  // Bewaakt de labelpas (taak 13) tegen twee soorten inhaalslag: (1) een NIEUWE hoofdrun start —
  // elke run verhoogt de teller, dus een oudere labelpas herkent zichzelf als ingehaald; (2) een
  // 'edited'-invalidatie zónder nieuwe run (§6a rekent bewust niet automatisch door) — die zet
  // `fingerprintsRef.current` op `null`, en de labelpas leest dat mee als afbreekreden.
  const generationRef = useRef(0);

  // De vingerafdrukken waarop het HUIDIGE voorstel gerekend heeft (§6a). `null` = er valt niets te
  // bewaken: er is nog nooit gerekend, óf er is al een `'edited'` gemeld en die reden staat nog.
  const fingerprintsRef = useRef<Record<string, string> | null>(null);
  // De invoer van diezelfde run, als ref — de bewaker draait buiten React's renderlus en heeft de
  // documenttitels nodig zonder van `inputs` als dependency af te hangen.
  const inputsRef = useRef<DistributionDocInput[]>([]);

  // De tune-state ALS REF, zodat de run-callback stabiel blijft (hij mag niet bij elke
  // rangorde-wijziging opnieuw gemaakt worden — dat zou de in-flight-bewaking om zeep helpen).
  const tuneRef = useRef(tune);
  tuneRef.current = tune;

  // Het vertaalde label mag de run-callback niet instabiel maken; een taalwissel tijdens een
  // openstaande dialoog landt vanzelf in de volgende run.
  const untitledLabelRef = useRef(untitledLabel);
  untitledLabelRef.current = untitledLabel;

  const busyRef = useRef(false);
  const pendingRef = useRef(false);
  const runRef = useRef<() => void>(() => {});

  // Opruimen bij unmount (fixronde-2 bevinding B6: de labelpas liep vrolijk door nadat de dialoog
  // gesloten was — seconden CPU voor een scherm dat niemand meer ziet). Élke geplande macrotask van
  // deze hook (de hoofdrun én iedere labelstap) loopt via `schedule` en leest deze vlag; een
  // afgedankte hook rekent dus niets meer en plant ook niets meer.
  //
  // WAAROM EEN VLAG EN GEEN `clearTimeout`-LIJST. De app draait in `React.StrictMode`, en die doet
  // bij élke mount een mount→cleanup→mount. Een cleanup die de al geplande macrotasks wist, gooit
  // daarmee de OPENINGSRUN weg die het subject-effect zojuist plande — en dat effect plant hem niet
  // opnieuw, want het onderwerp is dan niet veranderd. Resultaat: een dialoog die in dev nooit een
  // voorstel toont. Met een vlag die bij (her)mount weer op `false` gaat, klopt beide gevallen: de
  // StrictMode-remount pakt zijn eigen geplande run gewoon op, en een echte unmount legt alles stil.
  // Er blijft hooguit één macrotask openstaan die meteen niets doet.
  const disposedRef = useRef(false);

  /** Plan `fn` in een EIGEN macrotask, tenzij deze hook inmiddels is afgedankt. */
  const schedule = (fn: () => void): void => {
    setTimeout(() => {
      if (disposedRef.current) return;
      fn();
    }, 0);
  };

  // NB: hier wordt bewust NIET `generationRef` opgehoogd. Dat zou bij de StrictMode-cleanup de
  // labelpas van de zojuist geplande openingsrun als "ingehaald" bestempelen, waarna er in dev nooit
  // een kostenlabel verschijnt. De vlag hierboven is de afbreekreden; de generatie blijft van de
  // hoofdruns.
  useEffect(() => {
    disposedRef.current = false;
    return () => { disposedRef.current = true; };
  }, []);

  /**
   * Spec §2.2 — het VERSCHIL-prijskaartje. Twee volledige `computeDistribution`-runs (`allowSplits`
   * uit en aan) ná het hoofdvoorstel, elk in een eigen macrotask zodat de browser ertussen kan
   * schilderen en een afbreekreden binnen één stap landt. Breekt af zodra `myGeneration` is
   * ingehaald door een nieuwere hoofdrun of door een 'edited'-invalidatie
   * (`fingerprintsRef.current === null`) — beide zijn precies de gevallen waarin het hoofdvoorstel
   * op het scherm zelf ook al niet meer bij de documenten hoort.
   *
   * DIT WAS VIER KEER ZO DUUR. Tot 2026-09-12 deed deze pas óók per deelnemer een isolatierun voor
   * de kostenlabels van de rangordelijst. Die lijst is weg (§2.1) en die runs dus ook.
   *
   * EN ÉÉN VAN DIE TWEE WAS ER AL (bevinding B3 van de review). Het hoofdvoorstel is per definitie
   * al de run van de INGESTELDE stand van `allowSplits`, en `computeDistribution` is puur over
   * dezelfde `built` — dus die stand nog eens uitrekenen levert gegarandeerd hetzelfde getal op.
   * De prijs van de ingestelde stand komt daarom uit `proposalResult`; alleen de TEGENOVERGESTELDE
   * stand wordt hier nog gerekend. Eén run per voorstel in plaats van twee, wat het live
   * meerekenen tijdens het slepen (§5) betaalbaar houdt.
   */
  const scheduleSavingsPass = (
    myGeneration: number,
    tuneAtRun: DistributionUiState,
    pool: CompanyPool,
    built: DistributionDocInput[],
    /** Het zojuist berekende hoofdvoorstel — de run van `tuneAtRun.allowSplits`. */
    mainProposal: DistributionProposal,
  ): void => {
    const superseded = () => generationRef.current !== myGeneration || fingerprintsRef.current === null;
    // Alleen de teller van DEZE pas mag de bezig-toestand weer uitzetten: een nieuwere pas loopt
    // dan al en heeft 'm zojuist zelf aangezet.
    const finish = () => { if (generationRef.current === myGeneration) setLabelsBusy(false); };

    const priceOf = (p: DistributionProposal): number | null =>
      p.blocked ? null : maxEndShiftWorkdays(p.docs);

    // De ingestelde stand is het hoofdvoorstel zelf; alleen de andere stand moet nog gerekend.
    const mainPrice = priceOf(mainProposal);
    const otherStand = !tuneAtRun.allowSplits;
    let offPrice: number | null = tuneAtRun.allowSplits ? null : mainPrice;
    let onPrice: number | null = tuneAtRun.allowSplits ? mainPrice : null;
    const steps: (() => void)[] = [
      () => {
        const other = priceOf(computeDistribution(
          tuneAtRun.companyId, pool, tuneAtRun.libraryItemId, built, { allowSplits: otherStand },
        ));
        if (otherStand) onPrice = other; else offPrice = other;
      },
      () => {
        if (offPrice !== null && onPrice !== null) {
          setSavings({ workdays: savingsWorkdays(offPrice, onPrice) });
        }
      },
    ];

    const runStep = (index: number): void => {
      if (superseded() || index >= steps.length) { finish(); return; }
      try {
        steps[index]();
      } catch {
        // Een mislukte stap laat gewoon geen prijs zien — nooit een gok tonen. De volgende stap
        // loopt door; zonder beide prijzen blijft `savings` op `null` en zegt de dialoog eerlijk
        // dat de prijs onbekend is.
      }
      schedule(() => runStep(index + 1));
    };

    setLabelsBusy(true);
    schedule(() => runStep(0));
  };

  runRef.current = () => {
    const current = tuneRef.current;
    if (!current) return;
    if (busyRef.current) { pendingRef.current = true; return; }
    busyRef.current = true;
    setBusy(true);
    // Elke hoofdrun is een nieuwe "generatie" — de labelpas van een VORIGE run herkent zichzelf
    // hieraan als ingehaald en breekt af (§4 stap 1: "een label van een vervallen voorstel is
    // misleidender dan geen label").
    const myGeneration = ++generationRef.current;
    // De prijs hoort bij het HUIDIGE voorstel, niet bij het vorige — hij gaat dus meteen leeg zodra
    // een nieuwe run start. Een oud getal tijdens "Bezig met verdelen…" is even misleidend als een
    // oud getal na een invalidatie.
    setSavings(null);
    // De labelpas van de vorige generatie is hiermee ingehaald; zijn bezig-toestand hoort dus ook
    // weg. Wordt er straks weer een pas gepland, dan zet die 'm zelf terug aan.
    setLabelsBusy(false);
    // Eerst de paint (bezig-toestand), dán het echte rekenwerk — zie het moduleblok.
    schedule(() => {
      try {
        const s = useAppStore.getState();
        const pool = s.pools[current.companyId];
        const built = buildDistributionInputs(s, untitledLabelRef.current, current);
        inputsRef.current = built;
        setInputs(built);
        const proposalResult = pool
          ? computeDistribution(current.companyId, pool, current.libraryItemId, built, {
              allowSplits: current.allowSplits,
            })
          : null;
        setProposal(proposalResult);
        // De vingerafdruk hoort bij PRECIES deze momentopname: dezelfde `s` en dezelfde teller
        // waarop zojuist gerekend is (§6a).
        fingerprintsRef.current = documentFingerprints(s, appStoreContext.runtime.mutationSeq());
        setStaleReason(null);
        setStaleDocs('');

        // Spec §2.2: de verschil-prijs NÁ het hoofdvoorstel, in een tweede macrotask zodat het
        // hoofdvoorstel eerst schildert. Boven de ondersteunde schaal (§3.4) is elke prijsrun ZELF
        // een volledige run erbij — dat is precies de kost die de schaal-degradatie voorkomt, dus
        // daar blijft het bij "druk op Herbereken".
        if (pool && proposalResult && !proposalResult.blocked && !isDistributionDegraded(built, current)) {
          scheduleSavingsPass(myGeneration, current, pool, built, proposalResult);
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
        if (pendingRef.current) { pendingRef.current = false; runRef.current(); }
      }
    });
  };

  const recompute = useCallback(() => { runRef.current(); }, []);

  // Schaal-degradatie (§3.4): gemeten op de invoer van het LAATSTE voorstel — vóór de eerste run is
  // er niets te degraderen (die run is immers het openen zelf, altijd een expliciet moment).
  const degraded = useMemo(
    () => (!tune || inputs.length === 0 ? false : isDistributionDegraded(inputs, tune)),
    [inputs, tune],
  );
  const degradedRef = useRef(degraded);
  degradedRef.current = degraded;

  // Rekenmoment 1: OPENEN, en het wisselen naar een ander poolitem. Beide zijn "een nieuw onderwerp",
  // dus het oude voorstel gaat weg vóór de nieuwe run.
  const subjectKey = tune ? `${tune.companyId}\u0000${tune.libraryItemId}` : null;
  const lastSubjectRef = useRef<string | null>(null);
  const lastTuneRef = useRef<DistributionUiState | null>(null);
  useEffect(() => {
    if (subjectKey === lastSubjectRef.current) return;
    lastSubjectRef.current = subjectKey;
    lastTuneRef.current = tune;
    setProposal(null);
    setInputs([]);
    inputsRef.current = [];
    fingerprintsRef.current = null;
    setStaleReason(null);
    setLastStaleReason(null);
    setStaleDocs('');
    setSavings(null);
    if (subjectKey !== null) runRef.current();
    // `tune` bewust buiten de deps: alleen het ONDERWERP is hier de trigger, niet elke tune-tik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey]);

  // Rekenmoment 2: een PIN-, RANGORDE-, PLAFOND- of GEREEDSCHAPSwijziging. Die zet eerst de reden
  // (zodat de gebruiker ziet wat er is veranderd) en plant meteen de herberekening; de strook blijft
  // staan tot die run klaar is. Op een gedegradeerd overzicht wordt er NIET automatisch gerekend —
  // dan blijft de strook staan tot "Herbereken".
  useEffect(() => {
    if (!tune) return;
    const prev = lastTuneRef.current;
    lastTuneRef.current = tune;
    if (!prev || prev.companyId !== tune.companyId || prev.libraryItemId !== tune.libraryItemId) return;
    const reason = diffReason(prev, tune);
    if (reason === null) return;
    setStaleReason(reason);
    setLastStaleReason(reason);
    if (!degradedRef.current) runRef.current();
  }, [tune]);

  // Rekenmoment 3 — of juist NIET (spec §6a): een MUTATIE in een betrokken document. De bewaking
  // hangt aan de store zelf en niet aan de renderlus, want een mutatie van buiten de dialoog (een
  // MCP-tool, een extensie, het herstel na een crash, of het Toepassen van dit paneel zélf) hoeft
  // geen re-render van de dialoog te veroorzaken. De vergelijking is een handvol WeakMap-lookups
  // per document; goedkoop genoeg om aan élke store-tik te hangen.
  //
  // BEWUSTE AFWIJKING VAN HET PLAN (taak 12 stap 3 noemde alle vijf redenen "gewone
  // hertriggering"): `'edited'` rekent NIET automatisch door. Twee redenen, en de tweede is de
  // doorslaggevende. (1) De vier tune-redenen zijn handelingen ván de gebruiker ín deze dialoog —
  // daar is meteen doorrekenen precies wat hij vraagt. Een mutatie van buiten is dat niet: het
  // voorstel dat hij op dat moment staat te lezen zou onder zijn ogen door een ander vervangen
  // worden, en een stroom externe mutaties (een MCP-draaiboek) zou een reeks volledige
  // CPM-solves uitlokken. (2) Het plan eist in stap 1 tegelijk dat de stale-strook zichtbaar is
  // én dat Toepassen uitgeschakeld blijft; met een automatische herberekening zijn beide binnen
  // één macrotask weer weg. "Herbereken" is hier het discrete rekenmoment (§3.4).
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(() => {
      const known = fingerprintsRef.current;
      if (known === null) return;
      const s = useAppStore.getState();
      const now = documentFingerprints(s, appStoreContext.runtime.mutationSeq());
      const changed = Object.keys(known).filter(docId => now[docId] !== known[docId]);
      if (changed.length === 0) return;
      // Eén melding per voorstel: tot de volgende geslaagde run valt er niets meer te bewaken.
      fingerprintsRef.current = null;
      const titles = new Map(inputsRef.current.map(doc => [doc.docId, doc.title]));
      setStaleDocs(changed.map(docId => titles.get(docId) ?? docId).join(', '));
      setStaleReason('edited');
      setLastStaleReason('edited');
    });
    return unsubscribe;
  }, []);

  return {
    proposal, busy, labelsBusy, staleReason, lastStaleReason, staleDocs, degraded, recompute, inputs,
    savings,
  };
}
