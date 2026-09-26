import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { CPMResult } from './CPMSolver';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { taskDurationUnit, writeDerivedSpan, isZeroDurationMilestone } from './duration';
import { CalendarEngine } from './CalendarEngine';

/**
 * Schrijf een CPM-resultaat terug op de taken: per blad de berekende velden, daarna de
 * verzameltaak-rollup.
 *
 * Waarom dit een eigen module is (K-item 30). Deze logica stond twee keer: in `runCPM`
 * (`scheduleSlice`) en nog een keer in `src/services/benchmark/runner.ts`, met een comment die
 * toegaf dat het een kopie was. Die kopie wás al gedivergeerd — hij miste `interferingFloat`,
 * `isNearCritical`, `floatPath`, de late-datum-rollup, de min-over-kinderen voor
 * `totalFloat`/`freeFloat` én de uur-modus-normalisatie. Gevolg: de benchmark mat niet meer wat de
 * app doet, en dat is precies het soort meting waar je beslissingen op baseert.
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
 * Issue #145 — de AFGELEIDE duur van een auto-verzameltaak.
 *
 * Een verzameltaak komt nooit in de CPM-graaf (`solveProject` geeft de solver alleen bladtaken),
 * dus werd haar `scheduleDuration` door NIEMAND bijgewerkt: de rollup hieronder zette alleen
 * `earlyStart`/`earlyFinish`. De Gantt-balk rekte daardoor netjes mee met een nieuw kind, maar de
 * Duur-kolom bleef staan op de waarde die de taak toevallig droeg — 5d uit `addTask`, of het getal
 * uit het geïmporteerde `.mpp`. Berekenen/F5 hielp niet, want dát IS dit pad. Onzichtbaar in een
 * vers project, omdat een nieuwe taak én haar nieuwe kind allebei op 5 dagen vanaf de projectstart
 * beginnen en het getal dan toevallig klopt.
 *
 * DE AFLEIDING ZELF IS NIET VAN HIER: `writeDerivedSpan` (`duration.ts`) is het blok dat al in
 * `CPMSolver.forwardPass`s hammock-tak stond. Een hammock en een verzameltaak zitten in dezelfde
 * categorie — duur volledig afgeleid, niet door de gebruiker gekozen — dus delen ze de definitie
 * in plaats van dat hier een derde kopie staat. Een eerdere versie van deze fix dééd dat wel, en
 * liet daarbij de twee ELAPSEDTIME-takken vallen en verving de kalender-dispatch door een
 * taak-eenheid-dispatch; dat kostte stil één werkdag op een uur-taak met dag-kinderen.
 *
 * DE PROJECTKALENDER, NIET `task.calendarId`. Een verzameltaak heeft geen eigen werk, dus haar
 * taakkalender is betekenisloos — MS Project biedt dat veld op een samenvattingstaak niet eens
 * aan. Rekende deze afleiding wél in de eigen kalender, dan kreeg een fase met een 7-daagse
 * kalender "14d" te zien terwijl haar enige kind over exact hetzelfde datumbereik "10d" is.
 *
 * WAT HIER BEWUST NIET GEBEURT: `scheduleStart`/`scheduleFinish` worden NIET meegeschreven. Die
 * twee staan in `ifcTaskSlots.ts` geregistreerd als `RECORDED_INPUT_SLOT_KEYS` — "wat het bestand
 * zei" — en `captureRecordedDates` leest ze als de datumlaag van issue #63 terwijl
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
  const ef = parseInstant(task.time.earlyFinish);
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
    // Fase 2.9 golf 2 (§4.6): analyse-afleidingen. `interferingFloat` is ALTIJD aanwezig (tf−ff);
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
    // nulduur-grenspaar, het LOE-doelvenster, de voltooid-routes). Tot gebruikstest 24-09 (B1)
    // schreef deze functie in uur-modus `scheduleFinish = earlyFinish` terug (fase 2.8b, "nooit
    // meer stale na een duur-wijziging"); daardoor werd de uitvoer van de ene berekening invoer
    // voor de volgende. Gemeten: XER onder P6 → OPS → P6 gaf de eindmijlpaal ES 27-03 / EF 13-03
    // (einde vóór start), en Bereken herstelde het niet. De berekende finish leeft in `earlyFinish`.
    // LET OP (rechtzetting critreview 24-09): niet ÁLLE weergave en export lezen
    // `earlyFinish || scheduleFinish` — de gridkolom "Gepland einde", IfcTaskTime.ScheduleFinish, het
    // IFC-werkplan-einde en de extensie-mapping lezen `scheduleFinish` RAUW, als ingevoerd einde. Die
    // blijft daarom coherent aan de INVOERKANT: nieuwe taak en elke duur-/start-/kalenderwijziging
    // leiden het einde van een niet-gestarte urentaak af uit start + duur (`reconcileHourInputFinish`,
    // `seedNewHourTaskFinish` en `createDefaultTaskTime` in utils/taskDefaults.ts) — nooit hier.
    //
    // UUR-MODUS (fase 2.8b, FIX golf, §2.4): scheduleStart houdt zijn ANKER-instant maar wordt
    // idempotent naar de datetime-vorm genormaliseerd (parseInstant→formatInstant('hour') verandert
    // de instant niet, dus geen drift). Voor scheduleFinish kan dat niet: een date-only finish naar
    // T00:00 normaliseren zou het einde een dag vervroegen, dus die blijft zoals hij is ingevoerd.
    // Dag-taken blijven ONGEMOEID ⇒ byte-identiek (`formatDate`, verify:examples).
    if (taskDurationUnit(task) === 'hours') {
      task.time.scheduleStart = formatInstant(parseInstant(task.time.scheduleStart), 'hour');
    }
  }

  rollupSummaryTasks(tasks, { projectCalendar: cals.projectCalendar });
}

/**
 * Verzameltaken: datums oprollen uit de kinderen. Uitgefactoriseerd uit `applyCpmResult` (her-check
 * laag 3, bevinding 3) zodat "datums zoals opgeslagen" (`applyRecordedTimesToTasks`,
 * `recordedDates.ts`) DEZELFDE rollup draait: P6 legt zijn zes uitvoerkolommen alleen op TASK-rijen
 * vast, nooit op PROJWBS-rijen, dus een XER-WBS-rij heeft nooit een eigen vastlegging — zonder deze
 * rollup hield zo'n samenvattingsbalk de datums van de solve die de modus zojuist verwierp (gemeten:
 * hoofd-WBS een half jaar ná de `projectEnd` die dezelfde modus rapporteert). Gedrag byte-identiek
 * aan de inline-versie van vóór de uitfactorisering; alleen de aanroepplek is erbij gekomen.
 */
export function rollupSummaryTasks(
  tasks: Task[],
  options?: {
    /** Her-check laag 3, R1: een samenvatting die het bestand ZÉLF vastlegde (de #63-IFC-route
     *  draagt op fasen gewoon een `IfcTaskTime`) blijft staan zoals het bestand haar gaf — de rollup
     *  mag daar niet overheen schrijven, anders zegt de modus iets wat het bestand niet zei. De
     *  kinderen eronder worden nog wél bezocht (die kunnen zelf weer onvastgelegde samenvattingen
     *  zijn). Afwezig ⇒ elke samenvatting rolt op, byte-identiek aan `applyCpmResult`. */
    skip?: (task: Task) => boolean;
    /** Issue #145: de projectkalender waarin de AFGELEIDE duur van een auto-verzameltaak wordt
     *  gerekend (`applyDerivedSummaryDuration`). Afwezig ⇒ alleen de datum-/spelingrollup, de duur
     *  blijft onaangeraakt. */
    projectCalendar?: WorkCalendar;
  },
): void {
  // A4 (prestatie): één vooraf gebouwde id→taak-Map i.p.v. `find` per taak én per kind (recursief) —
  // dat was O(n²) op de rollup.
  const byId = new Map<string, Task>(tasks.map(t => [t.id, t]));
  // Eén engine voor alle verzameltaken: de afleiding rekent per definitie in de projectkalender,
  // dus is er niets per taak te resolven en niets te cachen.
  const summaryEngine = options?.projectCalendar ? new CalendarEngine(options.projectCalendar) : null;
  const updateSummary = (taskId: string): void => {
    const task = byId.get(taskId);
    if (!task || isLeafTask(task)) return;

    for (const childId of task.childIds) updateSummary(childId);
    if (options?.skip?.(task)) return;

    const children = task.childIds
      .map(cid => byId.get(cid))
      .filter(Boolean) as Task[];

    // Handmatig gepland (Z9b, etappe "nul afwijkingen"): in MS Project rolt een manual
    // SAMENVATTINGSTAAK NIET op — ze houdt haar eigen opgeslagen start/finish. CORPUSBEWIJS: het
    // gemengde corpusbestand droeg elf manual-verzameltaken (childIds 2..28) wier berekende
    // earlyStart/earlyFinish via de onvoorwaardelijke min/max-rollup hieronder kwamen i.p.v. hun
    // eigen datums — precies deze afwijkingen moeten door deze tak verdwijnen.
    //
    // Wisselwerking met Z9a (item 4, plan-§Z9b): een manual samenvattingstaak komt NOOIT in de
    // CPM-graaf — `runCPM`/`projectSlice` geven de solver alleen BLADtaken mee (`childIds.length
    // === 0`, zie het T8-docblock verderop in dit bestand en `CPMSolver.ts`s eigen leaf-only-
    // aanname), dus `result.tasks.get(taskId)` in de hoofdlus hierboven is voor haar altijd
    // `undefined` en de `if (!r) continue`-guard slaat haar sowieso over. Haar `earlyStart`/
    // `earlyFinish` komen dus NERGENS uit een forwardPass — dit is de EERSTE en ENIGE plek in de
    // hele keten waar ze gezet worden, niet een "overschrijving" van een eerder CPM-resultaat.
    // `time.scheduleStart`/`scheduleFinish` dragen voor een manual taak (blad ÉN samenvatting)
    // sinds Z9a al het juiste veldpaar (`mppReader.ts`s `resolveScheduleField`) — deze tak
    // respecteert dat gewoon, net als de manual-tak in `CPMSolver.forwardPass`.
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
      const starts = children.map(c => c.time.earlyStart).sort();
      const finishes = children.map(c => c.time.earlyFinish).sort();
      task.time.earlyStart = starts[0];
      task.time.earlyFinish = finishes[finishes.length - 1];
      task.time.isCritical = children.some(c => c.time.isCritical);

      // Ook de LATE datums en speling oprollen — anders bleven die op de
      // createDefaultTaskTime-defaults staan (lf=es, tf=0) en schreef o.a. ifcWriter misleidende
      // fase-speling weg (een niet-kritieke fase met "tf=0").
      const lateStarts = children.map(c => c.time.lateStart).sort();
      const lateFinishes = children.map(c => c.time.lateFinish).sort();
      task.time.lateStart = lateStarts[0];
      task.time.lateFinish = lateFinishes[lateFinishes.length - 1];
      // Een verzameltaak kan maar zo veel opschuiven als zijn krapste kind: min over de kinderen.
      task.time.totalFloat = Math.min(...children.map(c => c.time.totalFloat));
      task.time.freeFloat = Math.min(...children.map(c => c.time.freeFloat));
      // Interfererende speling op de samenvatting = tf−ff (fase 2.9 golf 2, §4.6) — houdt de
      // invariant ook op verzameltaken en vult de kolom voor WBS-rijen.
      task.time.interferingFloat = task.time.totalFloat - task.time.freeFloat;

      // Issue #145: de duur uit de zojuist opgerolde span. Bewust ALLEEN in deze auto-tak: een
      // `manuallyScheduled` verzameltaak (de tak hierboven) houdt haar eigen opgeslagen datums ÉN
      // haar eigen opgeslagen duur — daar is niets afgeleid, en een `.mpp`-geïmporteerde
      // manual-fase mag haar bestandswaarde niet kwijtraken aan een afleiding die de
      // fidelity-poort (die alleen start/finish meet) niet zou zien.
      if (summaryEngine) applyDerivedSummaryDuration(task, summaryEngine);
    }
  };

  for (const task of tasks) {
    if (!task.parentId) updateSummary(task.id);
  }
}
