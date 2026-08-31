import type { Task, TaskConstraint } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import type { CpmBackwardFloatTrace, CpmFreeFloatSource, CPMResult, CPMTaskResult } from './CPMSolver';
import { parseDate, formatInstant, type DateMode } from '@/utils/dateUtils';
import { traceFrom } from './graphWalk';
import { projectDurationOf } from './projectDuration';
import { isZeroDurationMilestone } from './duration';
import { explainP6CompletedDataDateWindow, usesP6CompletedDataDateWindow } from '@/utils/p6CompletedTargetWindow';
import { explainDisplayActualLateEligibility } from './p6CompletedRouteTrace';

/**
 * Invoer voor de resultaat-post-pass (`computeScheduleResults`). Puur data + een handvol
 * aan de solver gebonden kalender-helpers: de functie leest GEEN solver-instance-velden en
 * her-solvet niets — de vaste early/late-datums en de forward-pass-side-channels
 * (`seqConstraint`, `truncatedLeadIds`, `hardPinViolatedIds`, `hammockNoFinishDriverIds`)
 * zijn de enige bronnen.
 */
export interface ScheduleAnalysisInput {
  /** Topologische taakvolgorde uit de solver. */
  order: string[];
  earlyDates: Map<string, { es: Date; ef: Date }>;
  lateDates: Map<string, { ls: Date; lf: Date }>;
  outOfSequenceSequenceIds: string[];
  tasks: Map<string, Task>;
  sequences: Sequence[];
  /** taskId -> uitgaande relaties. */
  successors: Map<string, Sequence[]>;
  /** Per relatie de ruwe forward-pass-grens (één bron voor free float + driving, §CPMSolver). */
  seqConstraint: Map<string, Date>;
  schedulingOptions: SchedulingOptions | undefined;
  /** Werkdag-gesnapte statusdatum (fase 2.6), of null ⇒ geen statusdatum-gedrag. */
  dataDate: Date | null;
  truncatedLeadIds: string[];
  hardPinViolatedIds: string[];
  hammockNoFinishDriverIds: string[];
  projectEngine: CalendarEngine;
  // ── Aan de solver gebonden, stateless kalender-helpers (modus-bewust, §5) ──
  calendarFor: (task: Task) => CalendarEngine;
  progressCalendarFor: (task: Task) => CalendarEngine;
  /** `task` optioneel (T8): ELAPSEDTIME ⇒ kale klok-span i.p.v. werkdag-telling, zie
   *  `CPMSolver.signedFloat`/`duration.ts`'s `signedElapsedSpan`. */
  signedFloat: (a: Date, b: Date, eng: CalendarEngine, task?: Task) => number;
  /** Formaatgebonden projectie voor relationship free float; generieke kalenderalgebra blijft fysiek. */
  projectedWorkMinutesBetween: (eng: CalendarEngine, a: Date, b: Date) => number;
  constraintInstant: (c: TaskConstraint | undefined, eng: CalendarEngine) => Date | null;
  snapOnOrAfter: (eng: CalendarEngine, d: Date) => Date;
  snapOnOrBefore: (eng: CalendarEngine, d: Date) => Date;
  modeOf: (eng: CalendarEngine) => DateMode;
  /** Optionele XER-diagnose die de post-pass op haar eigen beslisplekken aanvult. */
  backwardFloatTrace?: CpmBackwardFloatTrace;
}

/**
 * Resultaat-post-pass van de CPM-berekening (voorheen `CPMSolver.computeResults`): leidt uit de
 * VASTE early/late-datums de floats, kritiek-markering, driving-relaties, waarschuwings-sets en
 * float-paden af. Pure functie — muteert zijn invoer niet en her-solvet expliciet niet.
 */
export function computeScheduleResults(input: ScheduleAnalysisInput): CPMResult {
  const {
    order, earlyDates, lateDates, outOfSequenceSequenceIds,
    tasks, sequences, successors, seqConstraint,
    schedulingOptions, dataDate,
    truncatedLeadIds, hardPinViolatedIds, hammockNoFinishDriverIds,
    projectEngine,
    calendarFor, progressCalendarFor, signedFloat, projectedWorkMinutesBetween,
    constraintInstant, snapOnOrAfter, snapOnOrBefore, modeOf,
    backwardFloatTrace,
  } = input;

  const taskResults = new Map<string, CPMTaskResult>();
  const criticalPath: string[] = [];

  // Vrije speling per relatie: werkdag-stappen tussen de (gesnapte) geëiste start en de
  // werkelijke vroegste start van de opvolger. 0 = de relatie bindt = driving (P6:
  // relationship free float = 0; gelijkspel ⇒ meerdere driving relaties). Wordt de opvolger
  // door de projectstart-vloer bepaald (volledig geklemde lead), dan bindt geen relatie.
  const sequenceFreeFloat: Record<string, number> = {};
  const drivingSequenceIds: string[] = [];
  const violatedConstraintTaskIds: string[] = [];
  const missedDeadlineTaskIds: string[] = [];
  const nearCriticalTaskIds: string[] = [];
  for (const seq of sequences) {
    const cRaw = seqConstraint.get(seq.id);
    const succEarly = earlyDates.get(seq.successorId);
    const succTask = tasks.get(seq.successorId);
    if (!cRaw || !succEarly || !succTask) continue;
    // Relatie-vrije-speling in de kalender van de OPVOLGER (diens vroegste start rekent daar, §5.2).
    // Uur-opvolger ⇒ fractionele-dag-float via `workMinutesBetween` (§5.5); dag ⇒ integer (byte-identiek).
    //
    // BEKENDE BEPERKING (T8-review M2/L3, herformulering T8-hercheck 2 — niet gefixt): deze
    // berekening is NIET durationType-bewust — ze rekent altijd in WERKtijd
    // (`workMinutesBetween`/`workDaysBetween`), ook wanneer de OPVOLGER van deze relatie (`succTask`
    // hierboven — het is dié taak se eigen vroege start, `succEarly.es`, die hier tegen `reqStart`
    // wordt afgezet) ELAPSEDTIME is.
    //
    // CORRECTIE (T8-hercheck 2): eerdere lezingen van dit blok suggereerden dat het probleem zat in
    // "een NIET-elapsed opvolger wordt wél gesnapt, een elapsed opvolger niet" — dat is precies
    // ANDERSOM. Sinds de T8-hercheck-BLOCKER-fix (`CPMSolver.snapSuccessorEarlyStart`/`ownAnchor`/
    // `rootFloor`) is het juist zo dat `succEarly.es` voor een ELAPSEDTIME opvolger BEWUST NIET meer
    // gesnapt wordt (die taak mag op een niet-werk-instant staan — dat is het hele punt van
    // ELAPSEDTIME) — terwijl `reqStart` hier op de regel eronder (`snapOnOrAfter(succCal, cRaw)`)
    // ONVOORWAARDELIJK wél snapt, ongeacht `succTask`'s durationType. Voor een ELAPSEDTIME opvolger
    // vergelijkt deze berekening dus een GESNAPTE grens (`reqStart`) met een ONGESNAPTE waarde
    // (`succEarly.es`) — geverifieerd (niet gegist, msp-23's probe-voorloper): dat geeft niet alleen
    // een verkeerde EENHEID maar kan `reqStart > succEarly.es` opleveren (de grens ligt dan NÁ de
    // taak se eigen vroege start), waarop `workDaysBetween`/`workMinutesBetween` hun eigen
    // "endMs<startMs ⇒ 0"-vangnet raken — het resultaat is dan een STILLE, niet-voor-de-hand-liggende
    // waarde (bv. −1) i.p.v. een crash, maar wel degelijk fout. Voor een NIET-ELAPSEDTIME opvolger
    // (het gebruikelijke geval, ook in de meeste H1/H2-cases) blijft `succEarly.es` zelf al op een
    // geldige werk-instant staan (ongewijzigd gedrag), dus daar telt dit blok nog steeds correct.
    // GEVOLG ELDERS (T8-hercheck 3, gemeten feit): een `relFloat` die door dit gat ONTERECHT ≠ 0
    // uitkomt (bv. de −1 hierboven, ook al zou de relatie eigenlijk driving moeten zijn — een FF+0
    // bijvoorbeeld) sluit die relatie ook uit `drivingSequenceIds` hieronder (`if (relFloat === 0)
    // drivingSequenceIds.push(seq.id)`) — dat raakt niet alleen de driving-markering zelf, maar ook
    // `floatPath` (fase 2.9 golf 3) en de `longestPath`-kritiek-modus, die beide op
    // `drivingSequenceIds` leunen om de kritieke keten(s) op te bouwen.
    // Zie `msp-21-t8-review-m1-eenheden-float` voor het eenhedendeel van dit gat (A.ff=1 naast
    // A.tf=2 op dezelfde taak — `signedElapsedSpan`'s doc-commentaar in `duration.ts` bevat het
    // volledige eenhedenbesluit) en `msp-23`/`msp-24` in `cases-msp-pariteit.json` voor waar de
    // gesnapt/ongesnapt-mismatch zelf optreedt (daar bewust NIET op `ff` geasserteerd, om dit gat
    // niet te verwarren met wat die cases wél bewijzen). Een echte fix vergt een eigen ELAPSEDTIME-
    // tak hier (`signedElapsedSpan`-stijl, gebaseerd op de ONgesnapte `cRaw`/`succEarly.es` i.p.v.
    // werkdag-telling) — buiten de scope van deze fixronde; orkestrator registreert voor T13/T15.
    const succCal = calendarFor(succTask);
    const reqStart = snapOnOrAfter(succCal, cRaw);
    const relFloat = succCal.isHourMode
      ? projectedWorkMinutesBetween(succCal, reqStart, succEarly.es) / (succCal.hoursPerDay * 60)
      : succCal.workDaysBetween(reqStart, succEarly.es) - 1;
    sequenceFreeFloat[seq.id] = relFloat;
    if (relFloat === 0) drivingSequenceIds.push(seq.id);
  }

  // Fase 2.9 golf 2 (§3.4/§4.6) — project-scoped reken-opties + longest-path-kritiek-set. Elke
  // tak staat strak achter zijn optie-conditie; afwezig ⇒ exact de bestaande expressie (byte-
  // identiek: de 333 cases kennen `schedulingOptions` nergens).
  const so = schedulingOptions;
  const tfMode = so?.totalFloatMode;
  const makeOpenEndedCritical = so?.makeOpenEndedCritical === true;
  const nearCriticalThreshold = so?.nearCriticalThreshold;
  const critDef = so?.criticalDefinition;
  const critThreshold = critDef?.threshold ?? 0;
  const critThresholdHours = critDef?.thresholdHours;
  const useLongestPath = critDef?.mode === 'longestPath';
  // Longest-path-kritiek (§4.6, normatief): de Free-Float-peel van pad 1 — de driving-keten(s)
  // vanaf de taak/taken met de grootste EF; bij ties (meerdere eindtaken met dezelfde grootste EF)
  // is de UNIE van alle peels kritiek. tf speelt in deze modus geen rol. Alleen opgebouwd in
  // longestPath-modus (anders leeg ⇒ geen effect). Hammocks worden pas in golf 4 speciaal behandeld.
  // Handmatig gepland (Z9b): BEWUST GEEN `manuallyScheduled`-tegenhanger van de hammock-uitsluiting
  // hierboven/hieronder. Een hammock is "een gevolg, geen oorzaak" (§4.4) — hij mag nooit als
  // keten-EINDPUNT gelden, want zijn EF is zelf al een AFGELEIDE van zijn eigen finish-drivers. Een
  // manual taak is het omgekeerde: haar EF is een ECHT, rechtstreeks anker (geen afleiding) — als
  // dat toevallig de grootste EF van het project is, IS ze legitiem het eindpunt van het langste
  // pad. `drivingSet`/`traceFrom` blijven hier vanzelf correct: `seqConstraint` wordt voor een
  // relatie die een manual taak als OPVOLGER heeft nooit gezet (`CPMSolver.forwardPass`s manual-tak
  // slaat de voorganger-lus over; `applyAlap` sluit haar sinds Z9b expliciet uit, zie de
  // moduleheader daar) — zo'n relatie kan dus nooit in `drivingSequenceIds` belanden en `traceFrom`
  // kan nooit "doorheen" een manual taak terugtracen via een relatie die ze feitelijk negeert.
  const longestPathCritical = new Set<string>();
  // Eenmalige relatie-index voor bronregels die onderscheid maken tussen een echt netwerkeinde
  // en een volledig geïsoleerde mijlpaal. Geen per-taak-scan over `sequences` (O(T+E), niet O(T×E)).
  const tasksWithPredecessor = new Set(sequences.map(sequence => sequence.successorId));
  let scheduleProjectEnd = new Date(0);
  for (const { ef } of earlyDates.values()) {
    if (ef > scheduleProjectEnd) scheduleProjectEnd = ef;
  }
  if (useLongestPath) {
    let maxEf = -Infinity;
    for (const { ef } of earlyDates.values()) {
      if (ef.getTime() > maxEf) maxEf = ef.getTime();
    }
    const drivingSet = new Set(drivingSequenceIds);
    for (const [id, { ef }] of earlyDates) {
      if (ef.getTime() !== maxEf) continue;
      if (tasks.get(id)?.isHammock === true) continue;   // hammock nooit kritiek (§4.4)
      longestPathCritical.add(id);
      for (const p of traceFrom(id, sequences, drivingSet).drivingPredecessors) {
        longestPathCritical.add(p);
      }
    }
  }

  let projectEnd = new Date(0);

  for (const taskId of order) {
    const early = earlyDates.get(taskId)!;
    const late = lateDates.get(taskId)!;
    // Float rekent per taak in diens eigen kalender (P6-semantiek, §5.2).
    const taskObj = tasks.get(taskId)!;
    const cal = calendarFor(taskObj);

    // Vrije speling van een taak: hoeveel werkdagen hij kan uitlopen zonder de vroegste datum
    // van een opvolger te raken = min van de relatie-vrije-spelingen hierboven. Voor werkdag-lag
    // is dat exact gelijk aan de klassieke per-type formules (gap − lag, met de
    // FS-finishdag-correctie); voor kalenderdag- en procent-lag volgt de juiste waarde
    // automatisch uit dezelfde bron als de planningsberekening zelf.
    let freeFloat = Infinity;
    let freeFloatSource: CpmFreeFloatSource = 'derivedFromSuccessor';
    const succs = successors.get(taskId) || [];
    if (succs.length === 0) {
      // Eindtaak: vrije speling = totale-speling-equivalent (finish kan opschuiven tot
      // lateFinish) — getekend: een deadline/late-zijde-constraint kan hem negatief maken.
      // Uur-taak ⇒ fractionele-dag-float (§5.5); dag ⇒ integer (byte-identiek).
      freeFloat = signedFloat(early.ef, late.lf, cal, taskObj);
    } else {
      for (const seq of succs) {
        const ff = sequenceFreeFloat[seq.id];
        if (ff !== undefined && ff < freeFloat) freeFloat = ff;
      }
    }
    if (freeFloat === Infinity) freeFloat = 0;
    // De late grens van een verbonden open P6-finishmijlpaal is zijn eigen vroege grens, maar zijn
    // vrije float blijft de ruimte tot het (door een andere open tak bepaalde) projecteinde. Houd
    // die twee P6-betekenissen dus apart: TF komt verderop uit de verankerde LS/LF; FF uit dezelfde
    // project-eindruimte die vóór de late-ankerfix al werd gerapporteerd. Expliciete PROJECT-end-
    // float heeft hieronder zijn eigen, smallere nulregel en valt niet in deze variant.
    if (so?.p6Source === 'XER' && so.p6FinishMilestoneBoundaryWindow === true
      && so.useProjectEndDateForFloat !== true && succs.length === 0
      && tasksWithPredecessor.has(taskId)
      && taskObj.milestoneKind === 'FINISH' && isZeroDurationMilestone(taskObj)) {
      freeFloat = signedFloat(early.ef, scheduleProjectEnd, cal, taskObj);
      freeFloatSource = 'projectEndFinishMilestoneBoundary';
    }
    // P6's expliciete PROJECT-einddatum is voor een door het netwerk bereikte, open TT_FinMile
    // een late-pass-/TF-anker, geen echte opvolger. Zo'n eindmijlpaal kan wel totale float hebben,
    // maar geen vrije float: zonder opvolger is er geen opvolgerdatum die hij vrij kan opsouperen.
    // Nauwe bronregel voor precies die P6-taaksoort; gewone open activiteiten en volledig
    // geïsoleerde finishmijlpalen houden hun bestaande freeFloat=totalFloat-equivalent (de brede
    // variant verslechterde 19 publieke taken, de zonder-predecessor-variant nog één).
    if (so?.useProjectEndDateForFloat === true && succs.length === 0
      && tasksWithPredecessor.has(taskId)
      && taskObj.milestoneKind === 'FINISH' && isZeroDurationMilestone(taskObj)) {
      freeFloat = 0;
      freeFloatSource = 'clampedZero';
    }

    // Totale speling: getekend (fase 2.3 — negatieve float bij geschonden late-zijde-
    // constraints/deadlines), MSP-veilig als min van finish- en start-float (die kunnen
    // verschillen wanneer een SNLT alleen de late start kapt). Kritiek = tf ≤ 0.
    const tt = taskObj.time;
    const completed = !!dataDate && tt.completion >= 1;
    const completedDisplayWindow = completed
      && usesP6CompletedDataDateWindow(taskObj, so)
      ? (() => {
        const progressCal = progressCalendarFor(taskObj);
        const es = snapOnOrAfter(progressCal, dataDate!);
        return {
          es,
          ef: progressCal.prevWorkInstant(es),
          mode: modeOf(progressCal),
        };
      })()
      : null;
    const finishFloat = signedFloat(early.ef, late.lf, cal, taskObj);
    const startFloat = signedFloat(early.es, late.ls, cal, taskObj);
    // Een EXPLICIETE P6-modus geldt ook voor lopende taken: start = LS−ES, finish = LF−EF en
    // smallest = min(beide). Ontbreekt de bronoptie, dan blijft de oudere OPS-invariant behouden:
    // een lopende taak gebruikt finish-float en een overige taak de kleinste — zo blijven verse,
    // MSPDI-, MPP- en P6XML-projecten zonder deze bronwaarde byte-identiek.
    let tf = tfMode === 'finish'
      ? finishFloat
      : tfMode === 'start'
        ? startFloat
        : tfMode === 'smallest'
          ? Math.min(finishFloat, startFloat)
          : (!!dataDate && (!!tt.actualStart || tt.completion > 0))
            ? finishFloat
            : Math.min(finishFloat, startFloat);
    // Open-ended kritiek (§3.4): alleen bij `makeOpenEndedCritical` krijgt een taak zonder opvolger
    // tf=ff=0 (P6: LF=EF ⇒ kritiek). Default (optie afwezig) ⇒ ongewijzigd.
    if (makeOpenEndedCritical && succs.length === 0 && !completed) {
      tf = 0;
      freeFloat = 0;
    }
    // Hammock (§4.4, normatief): tf=ff=0 DEFINITORISCH (LS=ES/LF=EF uit de backward pass), maar dit
    // is géén kritiek-signaal — het forceren houdt de invariant ook als een niet-driving opvolger
    // anders positieve free float zou geven. `isCritical` wordt hieronder geforceerd `false`.
    const isHammock = taskObj.isHammock === true;
    if (isHammock) {
      tf = 0;
      freeFloat = 0;
    }
    // Handmatig gepland (Z9b, etappe "nul afwijkingen"): `CPMSolver.backwardPass` geeft een manual
    // taak DEFINITORISCH `ls=es`/`lf=ef` (verplichte early-return, zelfde vorm als de hammock-tak
    // — zie het docblock daar). tf/ff zouden op zo'n IDENTIEK es/ls-paar dus ALTIJD 0 moeten zijn,
    // ongeacht welke dag het is — maar de generieke `signedFloat` hierboven is een WERKDAG-tellende
    // formule, gebouwd om een venster tussen twee (potentieel verschillende) werk-instanten te
    // meten, niet om "0" te garanderen op een paar identieke, mogelijk NIET-werk-instanten. Op een
    // manual taak met een rauw anker BUITEN de werkband (bv. een zaterdag-mijlpaal) geeft die
    // formule daardoor een ARTEFACT: gemeten tf=-1 (`msp-56-z9a-manual-anchor-raw-no-snap`, vóór
    // deze fix bewust zonder tf/crit-assert gelaten — zie de note daar). Force tf=ff=0: dat is geen
    // hammock-achtige "geen kritiek-signaal"-forcing (zie hieronder — `isCritical` wordt voor een
    // manual taak NIET geforceerd), maar een correctie van de FORMULE-INVOER op een paar dat door
    // constructie al identiek is. Op een werkdag-anker (het gewone geval, `msp-57`) gaf de formule
    // toch al 0 — deze forcing is daar een no-op, geen gedragswijziging.
    if (taskObj.manuallyScheduled) {
      tf = 0;
      freeFloat = 0;
    }
    // P6/XER toont bij voltooid werk wel het historische actual-venster als LS/LF, maar TF blijft
    // de backward-recurrentie van nog open downstream werk volgen. FF is voor historie nul: een
    // voltooide activiteit kan haar opvolger niet meer vrij verschuiven. De floats hierboven zijn
    // daarom bewust uit de netwerk-late-datums berekend; alleen de uiteindelijke datumweergave
    // hieronder wordt op actuals teruggezet.
    if (completed && so?.preserveActualDatesInBackwardPass === true) {
      freeFloat = 0;
      freeFloatSource = 'clampedZero';
    }
    // P6/XER houdt vrije float op nul wanneer een late constraint de totale float negatief maakt.
    // De publieke P6-meetmassa bevat wel 63 negatieve TF-cellen maar geen negatieve FF-cel; case 05
    // bevestigt hetzelfde op een FNLT-eindtaak. Brongebonden, zodat de algemene getekende OPS-
    // semantiek zonder vlag ongewijzigd blijft.
    if (so?.clampNegativeFreeFloat === true && freeFloat < 0) {
      freeFloat = 0;
      freeFloatSource = 'clampedZero';
    }
    // Kritiek-definitie (§4.6): hammock ⇒ NOOIT kritiek (P6: LOE is een gevolg, geen oorzaak);
    // voltooid ⇒ nooit kritiek (P6, opvolgers wél); longestPath ⇒ op een driving-keten naar de
    // laatste finish (tf-onafhankelijk); anders tf ≤ drempel (default 0 = het huidige tf≤0).
    // Handmatig gepland: BEWUST GEEN eigen forceringstak (in tegenstelling tot hammock) — "MS
    // Project toont voor manual taken gewoon float" (plan-§Z9b): met tf hierboven al op 0 gezet,
    // geeft de gewone `tf ≤ drempel`-regel het juiste (kritiek) antwoord vanzelf, zónder een
    // hammock-achtige "nooit kritiek"-blindering. Een manual taak IS immers een echt anker (geen
    // afgeleid gevolg zoals een hammock) en kan dus legitiem op het kritieke pad staan.
    const isCritical = isHammock
      ? false
      : completed
      ? false
      : useLongestPath
        ? longestPathCritical.has(taskId)
        : critThresholdHours !== undefined
          ? tf * cal.hoursPerDay <= critThresholdHours
          : tf <= critThreshold;

    if (isCritical) criticalPath.push(taskId);
    // Interfererende speling (§4.6): ALTIJD berekend, getekend (fractioneel in uur-modus, erft
    // `signedFloat` via tf/ff). Byte-veilig: niet geserialiseerd (§6), niet in de digest.
    const interferingFloat = tf - freeFloat;
    // Near-critical (§4.6): 0 < tf ≤ drempel; alleen wanneer de drempel gezet is (anders undefined
    // ⇒ ongeschreven veld). tf=0 is NIET near; tf=drempel wél.
    const isNear = nearCriticalThreshold !== undefined && nearCriticalThreshold !== null
      ? tf > 0 && tf <= nearCriticalThreshold
      : undefined;
    if (isNear) nearCriticalTaskIds.push(taskId);
    if (early.ef > projectEnd) projectEnd = early.ef;

    // Geschonden constraints / gemiste deadlines (bron van de negatieve float). Beide constraints
    // worden geëvalueerd (§4.3). Een harde MSO/MFO-pin telt hier NIET mee — diens logica-schending
    // (rawMax > pin) is al in de forward pass geregistreerd (§4.2) en wordt onderaan toegevoegd.
    const task = taskObj;
    {
      for (const cc of [task.constraint, task.constraint2]) {
        if (!cc) continue;
        if (cc.hard && (cc.type === 'MSO' || cc.type === 'MFO')) continue;
        const cd = constraintInstant(cc, cal);
        if (!cd) continue;
        const dW = snapOnOrBefore(cal, cd);
        const ct = cc.type;
        if (((ct === 'SNLT' || ct === 'MSO') && early.es > dW)
          || ((ct === 'FNLT' || ct === 'MFO') && early.ef > dW)) {
          if (!violatedConstraintTaskIds.includes(taskId)) violatedConstraintTaskIds.push(taskId);
        }
      }
      if (task.deadline) {
        const dl = parseDate(task.deadline);
        if (!isNaN(dl.getTime()) && early.ef > cal.prevWorkDay(dl)) {
          missedDeadlineTaskIds.push(taskId);
        }
      }
    }

    // Serialisatie (§2.4/§5): de MODUS van de eigen kalender is de enige discriminator — dag-taak ⇒
    // `formatDate` (byte-identiek), uur-taak ⇒ `YYYY-MM-DDTHH:mm`.
    const mode = completedDisplayWindow?.mode ?? modeOf(cal);
    const displayActualLateDecision = explainDisplayActualLateEligibility(taskObj, dataDate, so);
    const displayActualLate = displayActualLateDecision.eligible;
    if (backwardFloatTrace) {
      const prior = backwardFloatTrace.byTaskId[taskId] ?? {
        lateFinishSource: 'projectEnd' as const,
        lateStartSource: 'subDuration' as const,
        freeFloatSource: 'derivedFromSuccessor' as const,
        displayActualLate: false,
        completedWindow: explainP6CompletedDataDateWindow(taskObj, so),
        backwardActualPin: { eligible: false, reason: 'missingDataDate' } as const,
        displayActualLateDecision: { eligible: false, reason: 'missingDataDate' } as const,
      };
      backwardFloatTrace.byTaskId[taskId] = {
        ...prior,
        freeFloatSource,
        displayActualLate,
        displayActualLateDecision,
      };
    }
    taskResults.set(taskId, {
      earlyStart: formatInstant(completedDisplayWindow?.es ?? early.es, mode),
      earlyFinish: formatInstant(completedDisplayWindow?.ef ?? early.ef, mode),
      lateStart: formatInstant(displayActualLate ? early.es : late.ls, mode),
      lateFinish: formatInstant(displayActualLate ? early.ef : late.lf, mode),
      totalFloat: tf,
      freeFloat,
      isCritical,
      interferingFloat,
      ...(isNear !== undefined ? { isNearCritical: isNear } : {}),
    });
  }

  // Harde-pin-logicaschendingen (§4.2): de voorganger-druk viel later dan de pin ⇒ de taak start
  // vóór z'n voorganger klaar is. Toegevoegd aan de geschonden-constraint-verzameling (deduped).
  for (const id of hardPinViolatedIds) {
    if (!violatedConstraintTaskIds.includes(id)) violatedConstraintTaskIds.push(id);
  }

  // Een project ZONDER geplande taken heeft geen projecteinde. De accumulator hierboven start op
  // de epoch en wordt alleen door een echte earlyFinish opgetild; zonder resultaten zou hij dus
  // `1970-01-01` rapporteren — een datum die overal als een ECHT projecteinde leest. Conditie is
  // daarom "nul early-resultaten" (`earlyDates` is per constructie 1-op-1 met `order`: de forward
  // pass vult hem uit diezelfde volgorde), niet "nul taken": het is precies de verzameling die de
  // accumulator voedt. Uitkomst = dezelfde vorm die `emptyResult()` in CPMSolver voor de
  // degradatiepaden teruggeeft: leeg einde, duur 0.
  const hasSchedule = earlyDates.size > 0;

  // Projectduur = werkdag-spanne van de vroegste start tot de laatste finish, MET de
  // mijlpaal-alleen-uitzondering — gedeeld met de "datums zoals opgeslagen"-reconstructie via
  // `projectDurationOf` (`projectDuration.ts`), zodat beide callsites dezelfde regel toepassen.
  // `projStart` blijft null bij nul early-resultaten (⟺ !hasSchedule) — dan is er niets te meten
  // en blijft de duur 0, i.p.v. de spanne "vandaag → epoch" die de oude terugval opleverde.
  let projStart: Date | null = null;
  for (const { es } of earlyDates.values()) {
    if (!projStart || es < projStart) projStart = es;
  }
  const projectDuration = projectDurationOf(projectEngine, projStart, projectEnd, tasks.values());

  // ── Fase 2.9 golf 3 (§4.6) — multiple float paths (POST-PASS op het VASTE resultaat) ──────────
  // De vroege datums veranderen NIET door het peelen: dit is een goedkope graaf-peel resp.
  // TF-rangschikking, geen her-solve. Uit ⇒ `criticalPaths = [criticalPath]` en `floatPathByTask =
  // {}` — byte-identiek aan het golf-0-gedrag (de tak wordt dan niet betreden). `criticalPaths[0]`
  // blijft ALTIJD de bestaande `criticalPath` (byte-compat, expliciet gecheckt in de check-batterij).
  let criticalPaths: string[][] = [criticalPath];
  const floatPathByTask: Record<string, number> = {};
  const fpOpt = so?.floatPaths;
  if (fpOpt?.enabled) {
    // Hard begrensd op `maxPaths` (ook bij grote netten); <1 ⇒ geen paden.
    const maxPaths = Math.max(0, Math.floor(fpOpt.maxPaths));
    // Hammocks (§4.4 — het veld bestaat al, het gedrag komt in golf 4): nooit end-kandidaat, tellen
    // niet mee in een keten. Nu al respecteren zodat golf 4 hier niets meer hoeft te wijzigen.
    const isHammock = (id: string) => tasks.get(id)?.isHammock === true;
    const candidates = new Set<string>();
    for (const id of order) if (!isHammock(id)) candidates.add(id);

    if (fpOpt.method === 'TOTAL_FLOAT') {
      // TF-methode: rangschik op DISTINCT tf (1 = kleinste tf); `floatPath` = rang. Een rang boven
      // `maxPaths` krijgt géén nummer (harde begrenzing). Peelt geen ketens ⇒ criticalPaths blijft
      // de enkele bestaande keten.
      const tfOf = (id: string) => taskResults.get(id)!.totalFloat;
      const distinct = [...new Set([...candidates].map(tfOf))].sort((a, b) => a - b);
      const rankOf = new Map<number, number>();
      distinct.forEach((tf, i) => rankOf.set(tf, i + 1));
      for (const id of candidates) {
        const rank = rankOf.get(tfOf(id))!;
        if (rank <= maxPaths) floatPathByTask[id] = rank;
      }
    } else {
      // FREE_FLOAT (driving-logic-peeling, default): peel ketens naar afnemende EF.
      //   (1) end = niet-toegewezen kandidaat met de grootste EF (topo-volgorde = stabiele tie-break).
      //   (2) keten = traceFrom(end).drivingPredecessors ∪ {end} (hammocks uitgesloten).
      //   (3) ken het padnummer toe aan de nog NIET-toegewezen taken in de keten (een gedeelde
      //       voorganger houdt zo het nummer van de EERSTE peel waarin hij voorkomt).
      //   (4) verwijder de héle keten uit de kandidaten; herhaal tot `maxPaths` of leeg.
      const drivingSet = new Set(drivingSequenceIds);
      const efMs = (id: string) => earlyDates.get(id)!.ef.getTime();
      // Elke gepeelde keten + of hij (volledig) kritiek is — voor de `criticalPaths`-opbouw.
      const peeled: { ids: string[]; critical: boolean }[] = [];
      let p = 0;
      while (candidates.size > 0 && p < maxPaths) {
        let end: string | null = null;
        let bestEf = -Infinity;
        for (const id of order) {
          if (!candidates.has(id)) continue;
          const e = efMs(id);
          if (e > bestEf) { bestEf = e; end = id; }
        }
        if (end === null) break;
        p += 1;
        const chain = new Set<string>([end]);
        for (const q of traceFrom(end, sequences, drivingSet).drivingPredecessors) {
          if (!isHammock(q)) chain.add(q);
        }
        for (const id of chain) {
          if (floatPathByTask[id] === undefined && candidates.has(id)) floatPathByTask[id] = p;
        }
        for (const id of chain) candidates.delete(id);
        const ids = [...chain].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        peeled.push({ ids, critical: ids.every((id) => taskResults.get(id)?.isCritical === true) });
      }
      // criticalPaths = alle gepeelde ketens die kritiek zijn. Pad 1 is (indien kritiek) al door
      // `criticalPath` gerepresenteerd op index 0 (byte-compat); extra kritieke ketens (bij ties)
      // komen erachteraan.
      for (let i = 1; i < peeled.length; i++) {
        if (peeled[i].critical) criticalPaths.push(peeled[i].ids);
      }
    }

    // Per-taak `floatPath` op het resultaat (alleen bij enabled ⇒ default byte-identiek ongeschreven).
    for (const [id, r] of taskResults) {
      if (floatPathByTask[id] !== undefined) r.floatPath = floatPathByTask[id];
    }
  }

  return {
    tasks: taskResults,
    criticalPath,
    drivingSequenceIds,
    sequenceFreeFloat,
    truncatedLeadSequenceIds: [...truncatedLeadIds],
    violatedConstraintTaskIds,
    missedDeadlineTaskIds,
    outOfSequenceSequenceIds,
    // Fase 2.9 golf 2/3 — analyse-laag: near-critical-set gevuld bij ingestelde drempel (§4.6);
    // `interferingFloat` altijd per taak geschreven. `criticalPaths`/`floatPathByTask` gevuld door de
    // golf-3-post-pass hierboven (uit ⇒ `[criticalPath]` resp. `{}`, byte-identiek).
    nearCriticalTaskIds,
    criticalPaths,
    floatPathByTask,
    // Hammocks zonder finish-driver (§4.4): waarschuwing (nul-lengte-terugval).
    hammockNoFinishDriverTaskIds: [...hammockNoFinishDriverIds],
    // Projecteinde in de projectkalendermodus (§5.4): dag-project ⇒ `formatDate` (byte-identiek).
    // Zonder early-resultaten leeg (zie `hasSchedule` hierboven) i.p.v. de epoch.
    projectEnd: hasSchedule ? formatInstant(projectEnd, modeOf(projectEngine)) : '',
    projectDuration,
  };
}
