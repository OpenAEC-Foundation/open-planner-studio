import type { Task, TaskConstraint } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import type { CPMResult, CPMTaskResult } from './CPMSolver';
import { parseDate, formatDate, formatInstant, type DateMode } from '@/utils/dateUtils';
import { traceFrom } from './graphWalk';

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
  signedFloat: (a: Date, b: Date, eng: CalendarEngine) => number;
  constraintInstant: (c: TaskConstraint | undefined, eng: CalendarEngine) => Date | null;
  snapOnOrAfter: (eng: CalendarEngine, d: Date) => Date;
  snapOnOrBefore: (eng: CalendarEngine, d: Date) => Date;
  modeOf: (eng: CalendarEngine) => DateMode;
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
    calendarFor, signedFloat, constraintInstant, snapOnOrAfter, snapOnOrBefore, modeOf,
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
    const succCal = calendarFor(succTask);
    const reqStart = snapOnOrAfter(succCal, cRaw);
    const relFloat = succCal.isHourMode
      ? succCal.workMinutesBetween(reqStart, succEarly.es) / (succCal.hoursPerDay * 60)
      : succCal.workDaysBetween(reqStart, succEarly.es) - 1;
    sequenceFreeFloat[seq.id] = relFloat;
    if (relFloat === 0) drivingSequenceIds.push(seq.id);
  }

  // Fase 2.9 golf 2 (§3.4/§4.6) — project-scoped reken-opties + longest-path-kritiek-set. Elke
  // tak staat strak achter zijn optie-conditie; afwezig ⇒ exact de bestaande expressie (byte-
  // identiek: de 333 cases kennen `schedulingOptions` nergens).
  const so = schedulingOptions;
  const tfMode = so?.totalFloatMode ?? 'smallest';
  const makeOpenEndedCritical = so?.makeOpenEndedCritical === true;
  const nearCriticalThreshold = so?.nearCriticalThreshold;
  const critDef = so?.criticalDefinition;
  const critThreshold = critDef?.threshold ?? 0;
  const useLongestPath = critDef?.mode === 'longestPath';
  // Longest-path-kritiek (§4.6, normatief): de Free-Float-peel van pad 1 — de driving-keten(s)
  // vanaf de taak/taken met de grootste EF; bij ties (meerdere eindtaken met dezelfde grootste EF)
  // is de UNIE van alle peels kritiek. tf speelt in deze modus geen rol. Alleen opgebouwd in
  // longestPath-modus (anders leeg ⇒ geen effect). Hammocks worden pas in golf 4 speciaal behandeld.
  const longestPathCritical = new Set<string>();
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
    const succs = successors.get(taskId) || [];
    if (succs.length === 0) {
      // Eindtaak: vrije speling = totale-speling-equivalent (finish kan opschuiven tot
      // lateFinish) — getekend: een deadline/late-zijde-constraint kan hem negatief maken.
      // Uur-taak ⇒ fractionele-dag-float (§5.5); dag ⇒ integer (byte-identiek).
      freeFloat = signedFloat(early.ef, late.lf, cal);
    } else {
      for (const seq of succs) {
        const ff = sequenceFreeFloat[seq.id];
        if (ff !== undefined && ff < freeFloat) freeFloat = ff;
      }
    }
    if (freeFloat === Infinity) freeFloat = 0;

    // Totale speling: getekend (fase 2.3 — negatieve float bij geschonden late-zijde-
    // constraints/deadlines), MSP-veilig als min van finish- en start-float (die kunnen
    // verschillen wanneer een SNLT alleen de late start kapt). Kritiek = tf ≤ 0.
    const tt = taskObj.time;
    // Voortgang (fase 2.6, §4.5): voor in-progress/voltooide taken is de start-zijde-float
    // betekenisloos (de ES is een actual in het verleden) ⇒ alleen finish-zijde (LF−EF).
    const hasProgress = !!dataDate && (!!tt.actualStart || tt.completion > 0);
    const completed = !!dataDate && tt.completion >= 1;
    const finishFloat = signedFloat(early.ef, late.lf, cal);
    const startFloat = signedFloat(early.es, late.ls, cal);
    // TF-berekeningswijze (§3.4): default 'smallest' = min(finish,start) ⇒ byte-identiek. Een taak
    // met voortgang houdt zijn finish-zijde-float (bestaande invariant, §4.5), ongeacht de modus.
    let tf = hasProgress
      ? finishFloat
      : tfMode === 'finish' ? finishFloat
      : tfMode === 'start' ? startFloat
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
    // Kritiek-definitie (§4.6): hammock ⇒ NOOIT kritiek (P6: LOE is een gevolg, geen oorzaak);
    // voltooid ⇒ nooit kritiek (P6, opvolgers wél); longestPath ⇒ op een driving-keten naar de
    // laatste finish (tf-onafhankelijk); anders tf ≤ drempel (default 0 = het huidige tf≤0).
    const isCritical = isHammock
      ? false
      : completed
      ? false
      : useLongestPath
        ? longestPathCritical.has(taskId)
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
    const mode = modeOf(cal);
    taskResults.set(taskId, {
      earlyStart: formatInstant(early.es, mode),
      earlyFinish: formatInstant(early.ef, mode),
      lateStart: formatInstant(late.ls, mode),
      lateFinish: formatInstant(late.lf, mode),
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

  // Projectduur = werkdag-spanne van de vroegste start tot de laatste finish. Een project dat
  // op één moment valt (uitsluitend mijlpalen, geen echt werk) heeft duur 0 i.p.v. de 1 die de
  // inclusieve telling anders zou geven.
  let projStart: Date | null = null;
  for (const { es } of earlyDates.values()) {
    if (!projStart || es < projStart) projStart = es;
  }
  projStart = projStart || new Date();
  let projectDuration = projectEngine.workDaysBetween(projStart, projectEnd);
  if (formatDate(projStart) === formatDate(projectEnd)) {
    const anyRealWork = [...tasks.values()].some(
      (t) => !t.isMilestone && t.time.scheduleDuration > 0,
    );
    if (!anyRealWork) projectDuration = 0;
  }

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
    projectEnd: formatInstant(projectEnd, modeOf(projectEngine)),
    projectDuration,
  };
}
