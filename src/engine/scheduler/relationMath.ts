import type { Task } from '@/types/task';
import type { Sequence, LagUnit } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import { LAG_CALENDAR } from './lagCalendar';
import { addCalendarDays } from '@/utils/dateUtils';

/**
 * Relatie-wiskunde (FS/SS/FF/SF) — audit-pakket P15 (RelationResolver).
 *
 * Vervangt de vier voorheen parallel-gedupliceerde blokken in `CPMSolver.ts`
 * (forward/backward × dag-modus/uur-modus). De duplicatie is op drie manieren opgeruimd:
 *
 *  1. **Forward en backward naast elkaar in één module** — per richting één ingang
 *     (`forwardConstraint`/`backwardConstraint`) die per relatietype dispatcht. LET OP: de
 *     spiegel-invariant (backward = spiegel van forward) is hiermee nog stééds een conventie
 *     tussen twee parallelle switch-armen, geen afgedwongen code-eigenschap — wél staan de
 *     spiegelparen nu direct naast elkaar in één bestand en pint de suite (cases-hours-relations)
 *     beide richtingen vast.
 *  2. **Mijlpaal-grensvlaggen één keer** — `relationBoundaryFlags` berekent de vier grensvlaggen
 *     (§4.4 grens-model) op één plek; forward en backward krijgen ze aangereikt i.p.v. ze elk
 *     opnieuw af te leiden (voorheen 4× identiek).
 *  3. **Dag/uur als parametrisering** — de mode-bewuste engine-/lag-helpers (aangereikt via
 *     `RelationDeps`) reduceren in dag-modus byte-identiek tot de bestaande dag-expressies; alleen
 *     een uur-kalender activeert het minuut-native pad. Dag en uur blijven twee takken (het
 *     dag-elapsed-pad schrijft bewust een ONGESNAPTE grens in `seqConstraint` voor de vrije-speling-
 *     analyse, terwijl het uur-pad snapt — die conventies mogen niet vermengd worden), maar ze
 *     staan nu naast elkaar onder één ingang per richting.
 *
 * De semantiek is IDENTIEK aan de vorige inline-implementatie (byte-identiek geverifieerd);
 * de conventie-commentaren (P6/MSP, dagrand, elapsed-snap, mijlpaal-grenzen) zijn meeverhuisd.
 */

// Milliseconde-constanten (uur-pad); HOUR_SCAN = veiligheidsplafond voor de dag→uur-backward-scan.
export const MS_PER_MIN = 60_000;
export const MS_PER_DAY = 86_400_000;
export const HOUR_SCAN = 400;

/** De grensvlaggen die de mijlpaal-grens-semantiek (fase 2.4/§4.4) beschrijven voor één relatie.
 *  Voorheen 4× identiek herberekend in elk van de forward/backward × dag/uur-blokken. */
export interface RelationBoundaryFlags {
  /** Voorganger is een mijlpaal die op een dagBEGIN ligt (start-/auto-mijlpaal): zijn "finish"
   *  bezet geen dag, dus opvolgers op de startzijde beginnen dezelfde dag. */
  predEndsBeginOfDay: boolean;
  /** Voorganger is een eindmijlpaal (dagEINDE): zijn "start"-moment is die dag-eindgrens ⇒ een
   *  startzijde-opvolger schuift een werkdag op. */
  predStartsNextDay: boolean;
  /** Opvolger is een eindmijlpaal. */
  succIsFinishMs: boolean;
  /** Opvolger is een startmijlpaal (dagbegin-anker). */
  succIsStartMs: boolean;
}

/** Bereken de mijlpaal-grensvlaggen voor het (voorganger, opvolger)-paar (één bron van waarheid). */
export function relationBoundaryFlags(predTask: Task, succTask: Task): RelationBoundaryFlags {
  const predIsMilestone = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
  const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
  return {
    predEndsBeginOfDay: predIsMilestone && predKind !== 'FINISH',
    predStartsNextDay: predIsMilestone && predKind === 'FINISH',
    succIsFinishMs: succTask.isMilestone && succTask.milestoneKind === 'FINISH',
    succIsStartMs: succTask.isMilestone && succTask.milestoneKind === 'START',
  };
}

/** De mode-bewuste primitieven die de relatie-wiskunde nodig heeft. Blijven in `CPMSolver`
 *  gedefinieerd (ze delen daar de dag↔uur-reductie met de rest van de solver) en worden hier
 *  geïnjecteerd, zodat de relatie-wiskunde puur en op één plek staat zonder de helpers te dupliceren. */
export interface RelationDeps {
  resolveLag(seq: Sequence, predTask: Task): { days: number; unit: LagUnit };
  resolveEffectiveLagDays(seq: Sequence, predTask: Task): number;
  resolveElapsedMinutes(seq: Sequence, predTask: Task): number;
  shiftLagPred(predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1): Date;
  startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date;
  finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date;
  snapOnOrAfter(eng: CalendarEngine, d: Date): Date;
  snapOnOrBefore(eng: CalendarEngine, d: Date): Date;
  snapStrictAfter(eng: CalendarEngine, d: Date): Date;
  snapStrictBefore(eng: CalendarEngine, d: Date): Date;
  startOfDay(d: Date): Date;
}

/**
 * Forward-relatie-grens: geef de door de relatie geëiste vroegste START van de opvolger.
 * De projectstart-ondergrens en de max-over-voorgangers worden in de forward-pass toegepast
 * (relaties zijn ondergrenzen, geen gelijkheden). Dispatcht op modus: zodra minstens één zijde
 * uur-modus is loopt het cross-/uur-pad, anders het bevroren dag-pad (byte-identiek).
 */
export function forwardConstraint(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
): Date {
  const flags = relationBoundaryFlags(predTask, successor);
  if (predEng.isHourMode || succEng.isHourMode) {
    return forwardHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
  }
  return forwardDay(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

/**
 * Backward-relatie-grens: geef de laatst toegestane FINISH van de voorganger (spiegel van
 * `forwardConstraint`). Dispatcht identiek op modus.
 */
export function backwardConstraint(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  succTask: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
): Date {
  const flags = relationBoundaryFlags(predTask, succTask);
  if (predEng.isHourMode || succEng.isHourMode) {
    return backwardHour(deps, succResult, seq, predTask, predEng, succEng, flags);
  }
  return backwardDay(deps, succResult, seq, predTask, predEng, succEng, flags);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DAG-modus (puur dag→dag; byte-identiek aan de vorige inline dag-blokken).
// ═══════════════════════════════════════════════════════════════════════════

function forwardDay(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  // Lag in dagen; positief = uitloop, negatief = lead (overlap), 0 = direct aansluitend.
  // Werkdag-lag (WORKTIME, default) stapt over werkdagen; kalenderdag-lag (ELAPSEDTIME)
  // telt 24/7 en snapt daarna vooruit naar een werkdag (ondergrens: "niet eerder dan…").
  const { days: lag, unit } = deps.resolveLag(seq, predTask);
  const elapsed = unit === 'ELAPSEDTIME';
  // De relatie-lag telt in de kalender van de VOORGANGER (P6-default, §5.2). De succBack-aftrek en
  // successor-mijlpaal-snaps tellen in de successor-kalender; de FS-finishgrens-snap in de voorganger.
  const pe = predEng;
  const se = succEng;
  const lagEng = LAG_CALENDAR === 'predecessor' ? predEng : succEng;
  const succDur = successor.isMilestone ? 0 : successor.time.scheduleDuration;
  // Aantal werkdagen tussen start en finish van de opvolger (duur 0/1 => 0).
  const succBack = succDur > 0 ? succDur - 1 : 0;
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;

  switch (seq.type) {
    case 'START_START': {
      // Opvolger start `lag` dagen na de start van de voorganger. Een ruwe elapsed-datum op
      // een weekend hoeft hier niet gesnapt: forwardPass eindigt met nextWorkDay op de max.
      // Het "start"-moment van een eindmijlpaal is zijn dag-eindgrens ⇒ werkdag erna.
      if (elapsed) {
        return addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag);
      }
      const base = predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es;
      return lagEng.addWorkingDaysSigned(base, lag);
    }
    case 'FINISH_FINISH': {
      // Opvolger EINDIGT `lag` dagen na de finish van de voorganger → leid de bijbehorende
      // start af (finish − (duur−1)). De geëiste finish moet een werkdag zijn vóór de
      // werkdag-aftrek, dus elapsed snapt hier wél (vooruit — ondergrens op de finish).
      const reqFinish = elapsed
        ? se.nextWorkDay(addCalendarDays(predResult.ef, lag))
        : lagEng.addWorkingDaysSigned(predResult.ef, lag);
      // Een startmijlpaal-opvolger (dagbegin-anker) kan pas op de werkdag ná een
      // dag-eindgrens liggen; na een dagbegin-voorganger (start-/auto-mijlpaal) niet.
      if (succIsStartMs && !predEndsBeginOfDay) return se.nextWorkDayAfter(reqFinish);
      return se.addWorkingDaysSigned(reqFinish, -succBack);
    }
    case 'START_FINISH': {
      // Opvolger EINDIGT `lag` dagen na de START van de voorganger (zeldzaam).
      const reqFinish = elapsed
        ? se.nextWorkDay(addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag))
        : lagEng.addWorkingDaysSigned(
            predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es,
            lag,
          );
      return se.addWorkingDaysSigned(reqFinish, -succBack);
    }
    case 'FINISH_START':
    default: {
      // Eind-Start: opvolger start de werkdag ná de finish van de voorganger, plus `lag`.
      // Een dagbegin-mijlpaal bezet geen dag, dus die "+1"-overgang geldt dan niet
      // (anders schuift een tussengevoegde mijlpaal de hele keten een dag op). Een
      // eindmijlpaal-opvolger ankert juist op de finish-grens zelf (zelfde daglabel).
      // De finish-grens-snap (nextWorkDayAfter) telt in de VOORGANGER-kalender; de lag daarna
      // in de lag-kalender (voorganger, §5.2). Elapsed telt vanaf de finish-grens 24/7.
      if (elapsed) {
        const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
        return addCalendarDays(predResult.ef, plus);
      }
      const base = succIsFinishMs || predEndsBeginOfDay
        ? predResult.ef
        : pe.nextWorkDayAfter(predResult.ef);
      return lagEng.addWorkingDaysSigned(base, lag);
    }
  }
}

function backwardDay(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  // Spiegel van forwardDay: geef de laatst toegestane FINISH van de voorganger.
  // Kalenderdag-lag snapt hier áchteruit (bovengrens: "niet later dan…") — exact symmetrisch
  // met de vooruit-snap in de forward-pass, zodat een lead geen fantoomfloat oplevert.
  const { days: lag, unit } = deps.resolveLag(seq, predTask);
  const elapsed = unit === 'ELAPSEDTIME';
  // Spiegel van forwardDay (§5.2): de lag telt terug in de VOORGANGER-kalender; de
  // FS-gap-spiegel (prevWorkDayBefore) eveneens; de successor-zijde-datums in de successor-kalender.
  const pe = predEng;
  const se = succEng;
  const lagEng = LAG_CALENDAR === 'predecessor' ? predEng : succEng;
  const predDur = predTask.isMilestone ? 0 : predTask.time.scheduleDuration;
  const predBack = predDur > 0 ? predDur - 1 : 0;
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;

  switch (seq.type) {
    case 'START_START': {
      // Forward: succ.start = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateStart − lag;
      // het startmoment van een eindmijlpaal-voorganger ligt een werkdag vóór die grens.
      const predLS = elapsed
        ? lagEng.prevWorkDay(addCalendarDays(succResult.ls, -(predStartsNextDay ? lag + 1 : lag)))
        : predStartsNextDay
          ? pe.prevWorkDayBefore(lagEng.addWorkingDaysSigned(succResult.ls, -lag))
          : lagEng.addWorkingDaysSigned(succResult.ls, -lag);
      return pe.addWorkingDaysSigned(predLS, predBack); // pred.lateFinish
    }
    case 'FINISH_FINISH': {
      // Forward: succ.finish = pred.finish + lag ⇒ pred.finish ≤ succ.lateFinish − lag.
      // Een startmijlpaal-opvolger lag een werkdag ná de finish-grens (zie forward).
      const succLf = succIsStartMs && !predEndsBeginOfDay
        ? se.prevWorkDayBefore(succResult.lf)
        : succResult.lf;
      return elapsed
        ? lagEng.prevWorkDay(addCalendarDays(succLf, -lag))
        : lagEng.addWorkingDaysSigned(succLf, -lag);
    }
    case 'START_FINISH': {
      // Forward: succ.finish = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateFinish − lag.
      const predLS = elapsed
        ? lagEng.prevWorkDay(addCalendarDays(succResult.lf, -(predStartsNextDay ? lag + 1 : lag)))
        : predStartsNextDay
          ? pe.prevWorkDayBefore(lagEng.addWorkingDaysSigned(succResult.lf, -lag))
          : lagEng.addWorkingDaysSigned(succResult.lf, -lag);
      return pe.addWorkingDaysSigned(predLS, predBack);
    }
    case 'FINISH_START':
    default: {
      // Eind-Start: opvolger start `lag` dagen na de finish (de werkdag erná voor een echte
      // taak; bij een dagbegin-mijlpaal-voorganger of eindmijlpaal-opvolger géén extra dag).
      // Terug-inverteren; de FS-gap-spiegel (prevWorkDayBefore) telt in de VOORGANGER-kalender.
      if (elapsed) {
        const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
        return lagEng.prevWorkDay(addCalendarDays(succResult.ls, -plus));
      }
      const target = lagEng.addWorkingDaysSigned(succResult.ls, -lag);
      return succIsFinishMs || predEndsBeginOfDay ? target : pe.prevWorkDayBefore(target);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UUR-/CROSS-modus (engaged zodra minstens één zijde uur-modus is; §4.3/§5.2).
//  Spiegelt de dag-formules met instant-primitieven: `prevWorkInstantBefore` ↔
//  `nextWorkInstantAfter`, `subtractWorkMinutes` ↔ `addWorkMinutes`, lag terug in de
//  VOORGANGER-engine (`LAG_CALENDAR='predecessor'`).
// ═══════════════════════════════════════════════════════════════════════════

function forwardHour(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;
  const elapsedMin = () => deps.resolveElapsedMinutes(seq, predTask) * MS_PER_MIN;

  switch (seq.type) {
    case 'START_START': {
      const base = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
      if (elapsed) {
        return deps.snapOnOrAfter(se, new Date(base.getTime() + elapsedMin()));
      }
      return deps.snapOnOrAfter(se, deps.shiftLagPred(pe, base, seq, predTask, 1));
    }
    case 'FINISH_FINISH': {
      const reqFinish = elapsed
        ? deps.snapOnOrAfter(se, new Date(predResult.ef.getTime() + elapsedMin()))
        : deps.shiftLagPred(pe, predResult.ef, seq, predTask, 1);
      if (succIsStartMs && !predEndsBeginOfDay) return deps.snapStrictAfter(se, reqFinish);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      const startMoment = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
      const reqFinish = elapsed
        ? deps.snapOnOrAfter(se, new Date(startMoment.getTime() + elapsedMin()))
        : deps.shiftLagPred(pe, startMoment, seq, predTask, 1);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'FINISH_START':
    default: {
      // FS (§4.3): de opvolger consumeert de exclusieve "beschikbaar-vanaf"-instant van de
      // voorganger via `availableStart` — die ceilt een dag-opvolger correct naar de volgende
      // volledige werkdag (scenario 7 uur→dag) en snapt een uur-opvolger naar de eerstvolgende
      // werk-instant (scenario 1/6). Lag telt daarvóór in de voorganger-engine.
      if (elapsed) {
        // Klok-minuten 24/7 vanaf de exclusieve finish, dan vooruit-snap (scenario 6b).
        return se.availableStart(new Date(predResult.ef.getTime() + elapsedMin()));
      }
      const predDone = (succIsFinishMs || predEndsBeginOfDay)
        ? predResult.ef                       // mijlpaal-grens: geen dag-boundary-+1 (dag-conceptueel)
        : pe.predDoneAt(predResult.ef);
      return se.availableStart(deps.shiftLagPred(pe, predDone, seq, predTask, 1));
    }
  }
}

function backwardHour(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;
  const elapsedMin = () => deps.resolveElapsedMinutes(seq, predTask) * MS_PER_MIN;

  switch (seq.type) {
    case 'START_START': {
      const shifted = elapsed
        ? new Date(succResult.ls.getTime() - elapsedMin())
        : deps.shiftLagPred(pe, succResult.ls, seq, predTask, -1);
      const predStart = predStartsNextDay ? deps.snapStrictBefore(pe, shifted)
        : elapsed ? deps.snapOnOrBefore(pe, shifted) : shifted;
      return deps.finishFromStart(pe, predStart, predTask);
    }
    case 'FINISH_FINISH': {
      const succLf = (succIsStartMs && !predEndsBeginOfDay) ? deps.snapStrictBefore(se, succResult.lf) : succResult.lf;
      if (elapsed) {
        return deps.snapOnOrBefore(pe, new Date(succLf.getTime() - elapsedMin()));
      }
      return deps.shiftLagPred(pe, succLf, seq, predTask, -1);       // pred.LF
    }
    case 'START_FINISH': {
      const shifted = elapsed
        ? new Date(succResult.lf.getTime() - elapsedMin())
        : deps.shiftLagPred(pe, succResult.lf, seq, predTask, -1);
      const predStart = predStartsNextDay ? deps.snapStrictBefore(pe, shifted)
        : elapsed ? deps.snapOnOrBefore(pe, shifted) : shifted;
      return deps.finishFromStart(pe, predStart, predTask);
    }
    case 'FINISH_START':
    default: {
      if (elapsed) {
        // Klok-minuten terug vanaf succ.LS, dan achteruit-snap in de voorganger.
        return deps.snapOnOrBefore(pe, new Date(succResult.ls.getTime() - elapsedMin()));
      }
      const succDayStart = () => deps.startOfDay(succResult.ls);
      if (pe.isHourMode && se.isHourMode) {
        // hour-hour: pred.LF = prevWorkInstant( succ.LS ⊖ lag ) (scenario 1-6 backward).
        const target = (predEndsBeginOfDay || succIsFinishMs)
          ? succResult.ls
          : deps.shiftLagPred(pe, succResult.ls, seq, predTask, -1);
        return pe.prevWorkInstant(target);
      }
      if (pe.isHourMode && !se.isHourMode) {
        // (a) uur-voorganger, dag-opvolger: klaar vóór de middernacht van de succ-startdag.
        const target = deps.shiftLagPred(pe, succDayStart(), seq, predTask, -1);
        return pe.prevWorkInstant(target);
      }
      // (b) dag-voorganger, uur-opvolger: de grootste werkdag d waarvoor de forward-afleiding
      // se.nextWorkInstant( (d+1)@00:00 ⊕ lag ) ≤ succ.LS blijft (scenario 7 backward).
      const lagDays = deps.resolveEffectiveLagDays(seq, predTask);
      let d = succDayStart();
      for (let scan = 0; scan <= HOUR_SCAN; scan++) {
        if (pe.isWorkDay(d)) {
          const predDone = new Date(d.getTime() + MS_PER_DAY);       // (d+1)@00:00
          const shifted = pe.addWorkingDaysSigned(predDone, lagDays);          // lag in dag-pred
          if (se.nextWorkInstant(shifted).getTime() <= succResult.ls.getTime()) return d;
        }
        d = addCalendarDays(d, -1);
      }
      return deps.snapOnOrBefore(pe, succDayStart());   // best effort (kapotte kalender)
    }
  }
}
