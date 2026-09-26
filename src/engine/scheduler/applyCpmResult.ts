import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { CPMResult } from './CPMSolver';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { taskDurationUnit, writeDerivedSpan, isZeroDurationMilestone } from './duration';
import { CalendarEngine } from './CalendarEngine';
import { descendantLeaves, summaryProgressOf, taskWorkDays, writeSummaryProgress } from './summaryProgress';
import { finishInstant, latestFinish } from '@/utils/taskDates';

/**
 * Schrijf een CPM-resultaat terug op de taken: per blad de berekende velden, daarna de
 * verzameltaak-rollup.
 *
 * Eén definitie voor `solveProject` én de benchmark (`src/services/benchmark/runner.ts`), zodat de
 * benchmark meet wat de app doet.
 *
 * Muteert de meegegeven taken in-place. Werkt zowel op een gewone array als op een Immer-draft
 * (`s.tasks`): de elementen blijven dezelfde proxies, dus `task.time.x = …` gedraagt zich identiek.
 */
export interface ApplyCpmCalendars {
  /** De projectkalender (fallback wanneer een taak geen eigen kalender heeft). */
  projectCalendar: WorkCalendar;
  /** De gedeelde kalenderbibliotheek, voor `task.calendarId`. */
  calendars: WorkCalendar[];
}

/**
 * De AFGELEIDE duur van een auto-verzameltaak.
 *
 * Een verzameltaak komt nooit in de CPM-graaf (`solveProject` geeft de solver alleen bladtaken),
 * dus niemand anders werkt haar `scheduleDuration` bij; zonder dit blijft de Duur-kolom staan op
 * de waarde die de taak toevallig droeg (5d uit `addTask`, of het `.mpp`-getal).
 *
 * DE AFLEIDING ZELF IS NIET VAN HIER: `writeDerivedSpan` (`duration.ts`) deelt de definitie met de
 * hammock-tak van `CPMSolver.forwardPass` — beide hebben een volledig afgeleide duur. Een eigen
 * kopie verliest makkelijk de ELAPSEDTIME-takken of de kalender-dispatch (en kost dan stil één
 * werkdag op een uur-taak met dag-kinderen).
 *
 * DE PROJECTKALENDER, NIET `task.calendarId`. Een verzameltaak heeft geen eigen werk, dus haar
 * taakkalender is betekenisloos — MS Project biedt dat veld op een samenvattingstaak niet eens
 * aan. Rekende deze afleiding wél in de eigen kalender, dan kreeg een fase met een 7-daagse
 * kalender "14d" te zien terwijl haar enige kind over exact hetzelfde datumbereik "10d" is.
 *
 * WAT HIER BEWUST NIET GEBEURT: `scheduleStart`/`scheduleFinish` worden NIET meegeschreven. Die
 * twee staan in `ifcTaskSlots.ts` geregistreerd als `RECORDED_INPUT_SLOT_KEYS` — "wat het bestand
 * zei" — en `captureRecordedDates` leest ze als de "datums zoals opgeslagen"-laag terwijl
 * `showRecordedDates` ze niet herstelt. Ze hier overschrijven laat "Datums zoals opgeslagen" op
 * verzameltaakrijen twee elkaar tegensprekende kolommen tonen en schrijft bij een save in die
 * modus een herberekening het IFC in, precies wat die modus belooft niet te doen.
 */
function applyDerivedSummaryDuration(task: Task, engine: CalendarEngine): void {
  // Een als mijlpaal gemarkeerde rij met duur 0 blijft een ruit: `isZeroDurationMilestone` stuurt
  // de ruit-tekening in `GanttRenderer`, en de Duur-kolom hanteert al dezelfde uitzondering. Een
  // afgeleide duur zou die markering stil in een balk veranderen.
  if (isZeroDurationMilestone(task)) return;
  // Zonder opgerolde datums gebeurt er niets. Dit is geen theoretische netheid: een `Invalid Date`
  // levert `workDaysBetween` 0 op, en duur 0 maakt van de rij visueel een mijlpaal.
  if (!task.time.earlyStart || !task.time.earlyFinish) return;
  const es = parseInstant(task.time.earlyStart);
  // Een einde zonder tijd (een dagkind wint de rollup) loopt in een UUR-projectkalender tot het
  // einde van die dag (`finishInstant`), niet tot middernacht aan het begin ervan. In dagmodus telt
  // `workDaysBetween` beide kalenderdagen inclusief, dus daar blijft het de dagstart.
  const ef = engine.isHourMode ? finishInstant(task.time.earlyFinish) : parseInstant(task.time.earlyFinish);
  if (Number.isNaN(es.getTime()) || Number.isNaN(ef.getTime())) return;
  writeDerivedSpan(task, es, ef, engine);
}

export function applyCpmResult(tasks: Task[], result: CPMResult, cals: ApplyCpmCalendars): void {
  for (const task of tasks) {
    const r = result.tasks.get(task.id);
    if (!r) continue;
    task.time.earlyStart = r.earlyStart;
    task.time.earlyFinish = r.earlyFinish;
    task.time.lateStart = r.lateStart;
    task.time.lateFinish = r.lateFinish;
    task.time.totalFloat = r.totalFloat;
    task.time.freeFloat = r.freeFloat;
    task.time.isCritical = r.isCritical;
    // Analyse-afleidingen. `interferingFloat` is ALTIJD aanwezig (tf−ff);
    // `isNearCritical`/`floatPath` alleen wanneer de bijbehorende optie draait — afwezig ⇒ het veld
    // wordt gewist (zodat een uitgezette optie geen stale markering laat staan).
    task.time.interferingFloat = r.interferingFloat;
    task.time.isNearCritical = r.isNearCritical !== undefined ? r.isNearCritical : undefined;
    task.time.floatPath = r.floatPath !== undefined ? r.floatPath : undefined;
    // BEWUST GEEN scheduleStart-ANKER-drift: scheduleStart is het GEPLANDE anker (waarop de
    // forward-pass voortbouwt, `CPMSolver` snapt hierop) en mag NIET de berekende earlyStart
    // worden — anders bleef een taak na het verwijderen van een relatie op z'n gedrifte datum
    // hangen. De berekende planning leeft in earlyStart/earlyFinish; weergave/export gebruikt
    // `earlyStart || scheduleStart`.
    //
    // EN OOK GEEN scheduleFinish: net als scheduleStart is het INVOER (`TaskTimeInput`, en in de
    // IFC-laag `RECORDED_INPUT_SLOT_KEYS`: "wat het bestand zei"). De P6-conventies lezen het als
    // het geplande bronvenster (`target_end_date`: A16-vloer, het TT_FinMile-grensvenster, het
    // nulduur-grenspaar, het LOE-doelvenster, de voltooid-routes). Terugschrijven zou de uitvoer van
    // de ene berekening invoer voor de volgende maken (bv. P6 → OPS → P6 geeft dan een eindmijlpaal
    // met einde vóór start). De berekende finish leeft in `earlyFinish`.
    // LET OP: niet ÁLLE weergave en export lezen
    // `earlyFinish || scheduleFinish` — de gridkolom "Gepland einde", IfcTaskTime.ScheduleFinish, het
    // IFC-werkplan-einde en de extensie-mapping lezen `scheduleFinish` RAUW, als ingevoerd einde. Die
    // blijft daarom coherent aan de INVOERKANT: nieuwe taak en elke duur-/start-/kalenderwijziging
    // leiden het einde van een niet-gestarte urentaak af uit start + duur (`reconcileHourInputFinish`,
    // `seedNewHourTaskFinish` en `createDefaultTaskTime` in utils/taskDefaults.ts) — nooit hier.
    //
    // UUR-MODUS: scheduleStart houdt zijn ANKER-instant maar wordt
    // idempotent naar de datetime-vorm genormaliseerd (parseInstant→formatInstant('hour') verandert
    // de instant niet, dus geen drift). Voor scheduleFinish kan dat niet: een date-only finish naar
    // T00:00 normaliseren zou het einde een dag vervroegen, dus die blijft zoals hij is ingevoerd.
    // Dag-taken blijven ONGEMOEID (`formatDate`, verify:examples).
    if (taskDurationUnit(task) === 'hours') {
      task.time.scheduleStart = formatInstant(parseInstant(task.time.scheduleStart), 'hour');
    }
  }

  rollupSummaryTasks(tasks, { projectCalendar: cals.projectCalendar, progressCalendars: cals.calendars });
}

/**
 * Verzameltaken: datums oprollen uit de kinderen. Gedeeld met "datums zoals opgeslagen"
 * (`applyRecordedTimesToTasks`, `recordedDates.ts`): P6 legt zijn zes uitvoerkolommen alleen op
 * TASK-rijen vast, nooit op PROJWBS-rijen, dus een XER-WBS-rij heeft nooit een eigen vastlegging —
 * zonder deze rollup hield zo'n samenvattingsbalk de datums van de solve die de modus verwerpt.
 */
export function rollupSummaryTasks(
  tasks: Task[],
  options?: {
    /** Een samenvatting die het bestand ZÉLF vastlegde (de IFC-route draagt op fasen gewoon een
     *  `IfcTaskTime`) blijft staan zoals het bestand haar gaf — de rollup
     *  mag daar niet overheen schrijven, anders zegt de modus iets wat het bestand niet zei. De
     *  kinderen eronder worden nog wél bezocht (die kunnen zelf weer onvastgelegde samenvattingen
     *  zijn). Afwezig ⇒ elke samenvatting rolt op, zoals in `applyCpmResult`. */
    skip?: (task: Task) => boolean;
    /** De projectkalender waarin de AFGELEIDE duur van een auto-verzameltaak wordt
     *  gerekend (`applyDerivedSummaryDuration`). Afwezig ⇒ alleen de datum-/spelingrollup, de duur
     *  blijft onaangeraakt. */
    projectCalendar?: WorkCalendar;
    /** De kalenderbibliotheek voor de voortgangsrollup van verzameltaken
     *  (`summaryProgressOf`, gewogen naar werkdagen). Alleen samen met `projectCalendar`; afwezig ⇒
     *  voortgang en status van de samenvatting blijven onaangeroerd. */
    progressCalendars?: WorkCalendar[];
  },
): void {
  // Eén vooraf gebouwde id→taak-Map i.p.v. `find` per taak én per kind (dat is O(n²)).
  const byId = new Map<string, Task>(tasks.map(t => [t.id, t]));
  // Eén engine voor alle verzameltaken: de afleiding rekent per definitie in de projectkalender,
  // dus is er niets per taak te resolven en niets te cachen.
  const summaryEngine = options?.projectCalendar ? new CalendarEngine(options.projectCalendar) : null;
  // Elke verzameltaak wordt één keer opgerold (kinderen vóór ouders). Dat is ook de cyclusbewaking:
  // een corrupte `childIds`-kring liep hier anders eindeloos rond tot de stack overliep. Een taak die
  // (corrupt) onder twee ouders hangt, levert bij een tweede bezoek toch hetzelfde resultaat op.
  const visited = new Set<string>();
  // Voortgangsrollup: bladnakomelingen en hun gewicht (werkdagen) één keer per taak, want een blad
  // telt mee in álle verzameltaken boven hem. Alleen met `progressCalendars` (de `applyCpmResult`-
  // route); "datums zoals opgeslagen" laat de voortgang zoals hij was.
  const progressCals = options?.projectCalendar && options.progressCalendars
    ? { projectCalendar: options.projectCalendar, calendars: options.progressCalendars }
    : null;
  const leafCache = new Map<string, Task[]>();
  const workDaysCache = new Map<string, number>();
  const workDaysOf = (leaf: Task): number => {
    let d = workDaysCache.get(leaf.id);
    if (d === undefined) {
      d = progressCals ? taskWorkDays(leaf, progressCals.projectCalendar, progressCals.calendars) : 0;
      workDaysCache.set(leaf.id, d);
    }
    return d;
  };
  const updateSummary = (taskId: string): void => {
    const task = byId.get(taskId);
    if (!task || isLeafTask(task) || visited.has(taskId)) return;
    visited.add(taskId);

    for (const childId of task.childIds) updateSummary(childId);
    if (options?.skip?.(task)) return;

    const children = task.childIds
      .map(cid => byId.get(cid))
      .filter(Boolean) as Task[];

    // Handmatig gepland: in MS Project rolt een manual SAMENVATTINGSTAAK NIET op — ze houdt haar
    // eigen opgeslagen start/finish (corpusbewijs: een gemengd corpusbestand met elf
    // manual-verzameltaken).
    //
    // Een samenvattingstaak komt NOOIT in de CPM-graaf — `solveProject` geeft de solver alleen
    // BLADtaken mee — dus haar `earlyStart`/`earlyFinish` komen nergens uit een forwardPass: dit is
    // de ENIGE plek waar ze gezet worden. `time.scheduleStart`/`scheduleFinish` dragen voor een
    // manual taak (blad ÉN samenvatting) het juiste veldpaar (`mppReader.ts`s
    // `resolveScheduleField`) — deze tak respecteert dat, net als de manual-tak in
    // `CPMSolver.forwardPass`.
    //
    // `es`/`ef` als STRINGS vergeleken: `scheduleStart`/`scheduleFinish` zijn altijd ISO-
    // genormaliseerde datum(tijd)-strings (`YYYY-MM-DD` of `YYYY-MM-DDTHH:mm`), dus lexicografische
    // vergelijking is hier datumvergelijking — spiegelt de `ef<es`-inversiecorrectie van de manual-
    // bladtak in `CPMSolver.forwardPass` defensief (geen corpusgeval gevonden dat dit raakt).
    //
    // Late datums/floats zijn NIET corpus-gemeten (de fidelity-check meet uitsluitend start/
    // finish) — hier gepind op dezelfde DEFINITORISCHE conventie als de manual-bladtaak-forcing in
    // `scheduleAnalysis.ts` (ls=es/lf=ef ⇒ tf=ff=0): met eigen, van de kinderen losgekoppelde
    // datums zou een kinderen-afgeleide late datum/float onzinnig zijn (kan negatief of enorm
    // uitvallen t.o.v. de eigen span). `isCritical` blijft WEL van de kinderen afgeleid — of een
    // fase kritiek werk bevat is, anders dan de datums zelf, geen eigenschap die de eigen
    // opgeslagen datums tegenspreekt.
    if (task.manuallyScheduled && children.length > 0) {
      const es = task.time.scheduleStart;
      const ef = task.time.scheduleFinish;
      const [start, finish] = ef < es ? [ef, es] : [es, ef];
      task.time.earlyStart = start;
      task.time.earlyFinish = finish;
      task.time.lateStart = start;
      task.time.lateFinish = finish;
      task.time.totalFloat = 0;
      task.time.freeFloat = 0;
      task.time.interferingFloat = 0;
      task.time.isCritical = children.some(c => c.time.isCritical);
      return;
    }

    if (children.length > 0) {
      // Starts mogen als tekst: een datum zonder tijd (middernacht) sorteert vóór dezelfde dag mét
      // tijd, en dat klopt ook als tijdstip. Einden NIET: "…-05T13:00" sorteert ná "…-05", terwijl
      // een dagkind pas aan het einde van die dag klaar is — dus als tijdstip (`latestFinish`, de
      // balkregel van `finishInstant`). Zelfde voor de late einden.
      const starts = children.map(c => c.time.earlyStart).sort();
      task.time.earlyStart = starts[0];
      task.time.earlyFinish = latestFinish(children.map(c => c.time.earlyFinish));
      task.time.isCritical = children.some(c => c.time.isCritical);

      // Ook de LATE datums en speling oprollen — anders bleven die op de
      // createDefaultTaskTime-defaults staan (lf=es, tf=0) en schreef o.a. ifcWriter misleidende
      // fase-speling weg (een niet-kritieke fase met "tf=0").
      const lateStarts = children.map(c => c.time.lateStart).sort();
      task.time.lateStart = lateStarts[0];
      task.time.lateFinish = latestFinish(children.map(c => c.time.lateFinish));
      // Een verzameltaak kan maar zo veel opschuiven als zijn krapste kind: min over de kinderen.
      task.time.totalFloat = Math.min(...children.map(c => c.time.totalFloat));
      task.time.freeFloat = Math.min(...children.map(c => c.time.freeFloat));
      // Interfererende speling op de samenvatting = tf−ff — houdt de
      // invariant ook op verzameltaken en vult de kolom voor WBS-rijen.
      task.time.interferingFloat = task.time.totalFloat - task.time.freeFloat;

      // De duur uit de zojuist opgerolde span. Bewust ALLEEN in deze auto-tak: een
      // `manuallyScheduled` verzameltaak (de tak hierboven) houdt haar eigen opgeslagen datums ÉN
      // haar eigen opgeslagen duur — daar is niets afgeleid, en een `.mpp`-geïmporteerde
      // manual-fase mag haar bestandswaarde niet kwijtraken aan een afleiding die de
      // fidelity-poort (die alleen start/finish meet) niet zou zien.
      if (summaryEngine) applyDerivedSummaryDuration(task, summaryEngine);

      // Voortgang en status: afgeleid uit de bladen met de gewogen formule van het WBS-rapport
      // (`summaryProgressOf`, één definitie voor beide). Eigen voortgang op een fase bestaat niet
      // (MCP, voortgangsimport, paneel en raster weigeren hem), dus hier gaat niets verloren.
      // Dezelfde uitzonderingen als de datums: de `manuallyScheduled`-tak hierboven keert eerder
      // terug (de fase houdt haar opgeslagen voortgang), en "datums zoals opgeslagen" zet de
      // bestandswaarde terug via `showRecordedDates` (`RecordedTime.summaryProgress`).
      // De werkelijke datums komen uit dezelfde helper en volgen dezelfde regels (vroegste werkelijke
      // start; laatste werkelijke einde pas als alle bladen klaar zijn). De restduur niet.
      if (progressCals) {
        writeSummaryProgress(task, summaryProgressOf(descendantLeaves(task, byId, leafCache), workDaysOf));
      }
    }
  };

  for (const task of tasks) {
    if (!task.parentId) updateSummary(task.id);
  }
}
