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
// binnenkomt wordt daarna precies ÉÉN keer ingehaald (niet N keer — een sleepbeweging over de
// plafondhandle in taak 9 levert anders een wachtrij die minutenlang naloopt).
//
// SCHAAL-DEGRADATIE (§3.4). Boven `MAX_TASKS_AUTO` taken in één deelnemend document of
// `MAX_BOOKING_TASKS_AUTO` boekende taken op dít poolitem is automatisch doorrekenen bij elke
// tune-wijziging niet meer te doen. Dan blijft alleen de EXPLICIETE route over: het openen (één keer)
// en "Herbereken". De dialoog toont dat met `compute.degraded` + `compute.pressRecompute`; de
// stale-strook blijft dan gewoon staan tot de gebruiker drukt — precies de bedoeling.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, type AppState } from '@/state/appStore';
import type { DistributionUiState } from '@/state/slices/types';
import {
  computeDistribution,
  scopeTaskIdsFor,
  type DistributionDocInput,
  type DistributionProposal,
} from '@/services/library/distribute';
import { documentTitle, untitledOrdinals, displayDocumentTitle } from '@/utils/documents';

/** Meer taken dan dit in één deelnemend document ⇒ handmatig herberekenen (§3.4). */
export const MAX_TASKS_AUTO = 1000;
/** Meer taken dan dit die op dít poolitem boeken ⇒ handmatig herberekenen (§3.4). */
export const MAX_BOOKING_TASKS_AUTO = 40;

/** Waarom het huidige voorstel niet meer actueel is — 1-op-1 de `resource.distribution.stale.*`
 *  sleutels. `'edited'` (een document is intussen gewijzigd) hoort bij de vingerafdruk-invalidatie
 *  van taak 10 en wordt hier nog niet gezet; de sleutel bestaat wel. */
export type DistributionStaleReason = 'rank' | 'ceiling' | 'pin' | 'tool' | 'edited';

export interface DistributionProposalState {
  /** Het laatst berekende voorstel, of `null` zolang er nog nooit gerekend is. */
  proposal: DistributionProposal | null;
  /** Er loopt een berekening (§3.4 bezig-toestand). */
  busy: boolean;
  /** Niet-null ⇒ het voorstel hoort niet meer bij de bediening; de dialoog toont de reden. */
  staleReason: DistributionStaleReason | null;
  /** De LAATSTE reden sinds het openen, ook nadat de strook alweer verdwenen is. Puur voor
   *  observeerbaarheid (browsertest): een automatische herberekening op een klein project is
   *  binnen één macrotask klaar, dus de strook zelf is dan niet betrouwbaar te vangen. */
  lastStaleReason: DistributionStaleReason | null;
  /** Te groot om automatisch door te rekenen (§3.4). */
  degraded: boolean;
  /** De expliciete route: "Verdeel automatisch" / "Herbereken". */
  recompute: () => void;
  /** De invoer waarop het HUIDIGE voorstel gerekend is — de dialoog leest hier de documenttitels
   *  en de float per document uit, zodat rangordelijst en strook nooit uit een andere bron komen. */
  inputs: DistributionDocInput[];
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

/** Welke tune-as is er veranderd? Volgorde van benoemen = volgorde van de spec-taxonomie. */
function diffReason(
  prev: DistributionUiState,
  next: DistributionUiState,
): DistributionStaleReason | null {
  if (prev.allowSplits !== next.allowSplits) return 'tool';
  if (prev.order.join(' ') !== next.order.join(' ')) return 'rank';
  if (JSON.stringify(prev.pinned) !== JSON.stringify(next.pinned)) return 'pin';
  if (JSON.stringify(prev.ceilings) !== JSON.stringify(next.ceilings)) return 'ceiling';
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
  const [staleReason, setStaleReason] = useState<DistributionStaleReason | null>(null);
  const [lastStaleReason, setLastStaleReason] = useState<DistributionStaleReason | null>(null);

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

  runRef.current = () => {
    const current = tuneRef.current;
    if (!current) return;
    if (busyRef.current) { pendingRef.current = true; return; }
    busyRef.current = true;
    setBusy(true);
    // Eerst de paint (bezig-toestand), dán het echte rekenwerk — zie het moduleblok.
    setTimeout(() => {
      try {
        const s = useAppStore.getState();
        const pool = s.pools[current.companyId];
        const built = buildDistributionInputs(s, untitledLabelRef.current, current);
        setInputs(built);
        setProposal(pool
          ? computeDistribution(current.companyId, pool, current.libraryItemId, built, {
              allowSplits: current.allowSplits,
            })
          : null);
        setStaleReason(null);
      } finally {
        busyRef.current = false;
        setBusy(false);
        if (pendingRef.current) { pendingRef.current = false; runRef.current(); }
      }
    }, 0);
  };

  const recompute = useCallback(() => { runRef.current(); }, []);

  // Schaal-degradatie (§3.4): gemeten op de invoer van het LAATSTE voorstel — vóór de eerste run is
  // er niets te degraderen (die run is immers het openen zelf, altijd een expliciet moment).
  const degraded = useMemo(() => {
    if (!tune || inputs.length === 0) return false;
    for (const doc of inputs) {
      if (doc.tasks.length > MAX_TASKS_AUTO) return true;
      if (scopeTaskIdsFor(doc, tune.companyId, tune.libraryItemId).length > MAX_BOOKING_TASKS_AUTO) return true;
    }
    return false;
  }, [inputs, tune]);
  const degradedRef = useRef(degraded);
  degradedRef.current = degraded;

  // Rekenmoment 1: OPENEN, en het wisselen naar een ander poolitem. Beide zijn "een nieuw onderwerp",
  // dus het oude voorstel gaat weg vóór de nieuwe run.
  const subjectKey = tune ? `${tune.companyId} ${tune.libraryItemId}` : null;
  const lastSubjectRef = useRef<string | null>(null);
  const lastTuneRef = useRef<DistributionUiState | null>(null);
  useEffect(() => {
    if (subjectKey === lastSubjectRef.current) return;
    lastSubjectRef.current = subjectKey;
    lastTuneRef.current = tune;
    setProposal(null);
    setInputs([]);
    setStaleReason(null);
    setLastStaleReason(null);
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

  return { proposal, busy, staleReason, lastStaleReason, degraded, recompute, inputs };
}
