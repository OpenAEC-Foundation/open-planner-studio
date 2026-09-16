import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult } from './CPMSolver';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { taskDurationUnit } from './duration';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';

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
 * Kalender-engine-fabriek voor de verzameltaak-rollup, met cache per kalender.
 *
 * Spiegelt `CPMSolver.engineForCal`/`calendarFor` (zelfde regel, zelfde cache-sleutel): de engine
 * volgt de EIGEN duur-eenheid van de taak, en alleen een urentaak krijgt de gematerialiseerde
 * uurbanden. De aparte sleutel voorkomt dat de dag- en uurvorm van dezelfde kalender elkaar
 * overschrijven.
 */
function summaryEngineFactory(cals: ApplyCpmCalendars): (task: Task) => CalendarEngine {
  const cache = new Map<string, CalendarEngine>();
  return (task: Task): CalendarEngine => {
    const cal = resolveCalendar(task.calendarId, cals.calendars, cals.projectCalendar);
    const hourMode = taskDurationUnit(task) === 'hours';
    const key = hourMode ? `${cal.id}\u0000effective-hour` : cal.id;
    let engine = cache.get(key);
    if (!engine) {
      engine = new CalendarEngine(hourMode ? calendarForEngine(cal) : cal);
      cache.set(key, engine);
    }
    return engine;
  };
}

/**
 * Issue #145 — de AFGELEIDE duur en datums van een auto-verzameltaak.
 *
 * Een verzameltaak komt nooit in de CPM-graaf (de solver krijgt alleen bladtaken), dus haar
 * `scheduleDuration`/`scheduleStart`/`scheduleFinish` werden door NIEMAND bijgewerkt: de rollup
 * hieronder zette alleen `earlyStart`/`earlyFinish`. Gevolg (gemeld gedrag): de balk rekte netjes
 * mee met een nieuw kind, maar de Duur-kolom bleef op de waarde staan die de taak toevallig had —
 * 5d uit `addTask`, of het getal uit het geïmporteerde `.mpp`. Berekenen/F5 hielp niet, want dat
 * IS dit pad. Onzichtbaar in een vers project, omdat een nieuwe taak én haar nieuwe kind allebei
 * op 5 dagen vanaf de projectstart beginnen en het getal dan toevallig klopt.
 *
 * De afleiding is dezelfde die `CPMSolver.forwardPass` al voor een hammock doet — "duur die
 * volledig afgeleid is, legt precies één passende bron vast" — hier toegepast op de span die de
 * rollup zojuist zelf bepaalde. De EENHEID van de taak blijft staan (anders dan bij de hammock,
 * die 'm naar de kalendermodus herschrijft): een verzameltaak is geen solver-taak, en een
 * geïmporteerd plan mag zijn dag-verzameltaken niet stil in uren zien omslaan omdat de
 * MSP-kalender toevallig werkbanden draagt.
 *
 * `scheduleStart`/`scheduleFinish` volgen de opgerolde datums RAUW (geen herformattering: die zou
 * een uur-component van een kind wegkappen). Dat mag hier wél, anders dan bij een bladtaak, waar
 * `scheduleStart` het planningsANKER is waarop de forward-pass voortbouwt: een verzameltaak heeft
 * geen anker — niets leest deze velden als solver-invoer (ze staat niet in de graaf, en
 * `GanttRenderer` weigert een sleep-hit op een rij met kinderen). Zonder deze regel zou het
 * bestand bovendien een verzameltaak wegschrijven wiens duur en eigen datums elkaar tegenspreken
 * — `ifcWriter`, CSV, MSPDI en P6 XML schrijven die velden allemaal.
 *
 * Defensief: zonder opgerolde datums (een lege/kapotte `earlyStart`/`earlyFinish` — afgeleide data,
 * dus in theorie te vervuilen via een hostiel bestand of de MCP-laag) gebeurt er NIETS, in plaats
 * van een `Invalid Date` als duur 0 en een leeg anker weg te schrijven.
 */
function applyDerivedSummarySpan(task: Task, engine: CalendarEngine): void {
  if (!task.time.earlyStart || !task.time.earlyFinish) return;
  const es = parseInstant(task.time.earlyStart);
  const ef = parseInstant(task.time.earlyFinish);
  if (Number.isNaN(es.getTime()) || Number.isNaN(ef.getTime())) return;
  if (taskDurationUnit(task) === 'hours') {
    const minutes = engine.workMinutesBetween(es, ef);
    task.time.durationMinutes = minutes;
    task.time.scheduleDuration = engine.hoursPerDay > 0 ? minutes / (engine.hoursPerDay * 60) : 0;
  } else {
    task.time.scheduleDuration = engine.workDaysBetween(es, ef);
    task.time.durationMinutes = undefined;
  }
  task.time.scheduleStart = task.time.earlyStart;
  task.time.scheduleFinish = task.time.earlyFinish;
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
    // UUR-MODUS (fase 2.8b, FIX golf, §2.4): scheduleStart/scheduleFinish moeten wél een
    // datetime-representatie dragen i.p.v. date-only/verouderd te blijven. scheduleFinish volgt de
    // berekende finish (geen anker ⇒ veilig; nooit meer stale na een duur-wijziging); scheduleStart
    // houdt zijn ANKER-instant maar wordt idempotent naar de datetime-vorm genormaliseerd
    // (parseInstant→formatInstant('hour') verandert de instant niet, dus geen drift). Dag-taken
    // blijven ONGEMOEID ⇒ byte-identiek (`formatDate`, verify:examples).
    if (taskDurationUnit(task) === 'hours') {
      task.time.scheduleFinish = r.earlyFinish;
      task.time.scheduleStart = formatInstant(parseInstant(task.time.scheduleStart), 'hour');
    }
  }

  // Verzameltaken: datums oprollen uit de kinderen.
  // A4 (prestatie): één vooraf gebouwde id→taak-Map i.p.v. `find` per taak én per kind (recursief) —
  // dat was O(n²) op de rollup.
  const byId = new Map<string, Task>(tasks.map(t => [t.id, t]));
  const engineFor = summaryEngineFactory(cals);
  const updateSummary = (taskId: string): void => {
    const task = byId.get(taskId);
    if (!task || task.childIds.length === 0) return;

    for (const childId of task.childIds) updateSummary(childId);

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

      // Issue #145: duur + eigen datums uit de zojuist opgerolde span. Bewust ALLEEN in deze
      // auto-tak: een `manuallyScheduled` verzameltaak (de tak hierboven) houdt haar eigen
      // opgeslagen datums ÉN haar eigen opgeslagen duur — daar is niets afgeleid, dus is er ook
      // niets te herberekenen, en een `.mpp`-geïmporteerde manual-fase mag haar bestandswaarde
      // niet kwijtraken aan een afleiding die de fidelity-poort (die alleen start/finish meet)
      // niet zou zien.
      applyDerivedSummarySpan(task, engineFor(task));
    }
  };

  for (const task of tasks) {
    if (!task.parentId) updateSummary(task.id);
  }
}
