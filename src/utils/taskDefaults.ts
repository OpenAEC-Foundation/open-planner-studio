import { parseDate, formatDate, addBusinessDays } from '@/utils/dateUtils';
import type { Task, TaskDurationUnit, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effHoursPerDay } from '@/utils/taskDuration';
import {
  rescaleContourForDuration, rescaleFactor, rescaleSplitGaps, taskWorkMinutes,
} from '@/engine/contour/contourEngine';

/**
 * Fabrieksfunctie voor een verse {@link TaskTime}. Leeft in de utils-laag (niet in `src/types/`)
 * omdat ze datum-helpers als WAARDE nodig heeft — `src/types/` blijft zo puur (alleen types).
 */
export function createDefaultTaskTime(
  start: string,
  durationDays: number,
  durationUnit: TaskDurationUnit = 'days',
): TaskTime {
  // Derive a finish consistent with the duration so the Gantt bar spans the
  // right number of days before CPM runs. Matches CalendarEngine.addWorkDays
  // (inclusive, weekends skipped); runCPM later refines it with the full calendar.
  // Bij een onparseerbare start (bv. corrupte import) NIET formatteren — formatDate
  // (toISOString) gooit dan. Val terug op `start`; de CPM-solver vangt de ongeldige
  // datum verderop af met een nette foutmelding i.p.v. een crash.
  const startDate = parseDate(start);
  const finish =
    durationDays > 0 && !isNaN(startDate.getTime())
      ? formatDate(addBusinessDays(startDate, durationDays))
      : start;
  return {
    durationType: 'WORKTIME',
    durationUnit,
    scheduleDuration: durationDays,
    ...(durationUnit === 'hours' ? { durationMinutes: durationDays * 60 } : {}),
    scheduleStart: start,
    scheduleFinish: finish,
    earlyStart: start,
    earlyFinish: finish,
    lateStart: start,
    lateFinish: finish,
    freeFloat: 0,
    totalFloat: 0,
    isCritical: false,
    completion: 0,
  };
}

/**
 * T14b (gebruikstestbevinding, ernst hoog): `addTask` accepteert een meegegeven `partial.time` als
 * TYPE `TaskTime` (volledig), maar callers buiten de TS-typechecker (de extensie-sandbox draait
 * ongetypeerde `new Function`-code; MCP-tool-payloads worden alleen tegen JSON-schema gevalideerd,
 * niet tegen deze interface) kunnen op RUNTIME best een onvolledig object opsturen. Vóór deze fix
 * gebruikten `taskSlice.addTask` en `mcpTransaction.ts`'s `draft.addTask` domweg
 * `partial.time || createDefaultTaskTime(...)` — een meegegeven-maar-onvolledig object werd
 * ONGEWIJZIGD gebruikt, dus een ontbrekend `completion` bleef `undefined` tot de eerstvolgende
 * `writeIFC` crashte op `time.completion.toFixed(1)` (`src/services/ifc/ifcTaskSlots.ts`) — dat trof
 * auto-save, Opslaan/Opslaan-als én `planner_export_ifc` in één keer.
 *
 * **Twee aanroepsituaties, één functie — de `base` bepaalt het verschil:**
 *  - ADD (`taskSlice.addTask`, `mcpTransaction.draft.addTask`): `base` = een VERSE
 *    `createDefaultTaskTime(...)`. Er is nog geen bestaande taak, dus "ontbrekend ⇒ default" is
 *    ondubbelzinnig juist.
 *  - UPDATE (`taskSlice.updateTask`, T14b-vervolg — gebruikstestbevinding "partiële time-update wist
 *    bestaande waarden"): `base` = de BESTAANDE `time` van de taak, NOOIT een verse default. Een
 *    `Object.assign(task, { time: partial })` verving voorheen de HELE `time`-tak: een aanroeper die
 *    alleen `scheduleStart` wilde bijwerken (bv. via de publieke `api.data.updateTask`, waar
 *    `ExtTaskTime` z'n eigen `Required<>`-belofte op runtime niet afdwingt) wiste zo stil
 *    `completion`/`freeFloat`/`totalFloat`/etc. — dezelfde schadeklasse als de ADD-bug, alleen ipv.
 *    een crash een STILLE dataverlies.
 *
 * **Verplichte velden** (nooit `undefined` op `TaskTime`: durationType/scheduleDuration/
 * scheduleStart/scheduleFinish/early-/lateStart/-Finish/freeFloat/totalFloat/isCritical/completion)
 * krijgen de terugval-merge (`??`, dus expliciete `false`/`0` blijven staan).
 *
 * **Optionele velden** (interferingFloat/isNearCritical/floatPath/actualStart/
 * -Finish/actualDuration/remainingTime/-Minutes/resume/stop) krijgen de SLEUTEL-AANWEZIGHEID-conventie
 * (spec-review-fixronde 2026-08-17 — de eerdere "altijd 1-op-1 uit `partial`" bleek zelf een gat: een
 * partiële update die alleen `scheduleStart` noemde, wiste zo alsnog `durationMinutes`/`actualStart`/
 * `remainingTime`/etc., want die stonden simpelweg niet in `partial` — exact dezelfde schadeklasse als
 * de bug die deze hele helper moest dichten):
 *   - `'veld' in partial` **false** (de sleutel komt niet voor in het object) ⇒ AANROEPER NOEMDE HET
 *     NIET ⇒ behoud `base.veld` (de bestaande waarde bij UPDATE; bij ADD toch altijd `undefined`, want
 *     de verse default zet deze velden nooit).
 *   - `'veld' in partial` **true**, ook als de waarde `undefined` is ⇒ BEWUSTE CLEAR ⇒ neem
 *     `partial.veld` over (dus `undefined`). Dit is de vorm die `TaskDialog.tsx` nu gebruikt
 *     Voor `durationMinutes` geldt sinds de expliciete taakeenheid een strengere invariant: bij een
 *     urentaak is dat veld de verplichte bron van waarheid en kan een losse `undefined` de bron dus
 *     niet wissen. Wisselen naar `durationUnit: 'days'` wist hem wel atomair.
 * Dit is de enige manier waarop JS/TS "bewust gewist" van "nooit genoemd" kán onderscheiden — beide
 * zien er identiek uit zodra je alleen naar de WAARDE kijkt (`??`), dus de eerdere `??`-vorm voor
 * optionele velden kon de twee wensen fundamenteel niet uit elkaar houden. Voor ADD is dit
 * gedragsgelijk aan de vorige versie (de default zet deze velden nooit, dus `base.veld` is toch altijd
 * `undefined`); voor UPDATE is dit nu de correcte oplossing voor BEIDE wensen tegelijk (bestaande
 * optionele waarden overleven een partiële update, én een bewuste clear via `= undefined` werkt nog
 * steeds) — de eerdere docstring noemde dit ten onrechte "onverenigbaar".
 */
export function mergeTaskTime(base: TaskTime, partial: Partial<TaskTime> | undefined): TaskTime {
  if (!partial) partial = {};
  const legacyBase = base as TaskTime & { durationUnit?: TaskDurationUnit };
  const durationUnit = partial.durationUnit
    ?? (('durationMinutes' in partial && partial.durationMinutes != null) ? 'hours' : undefined)
    ?? legacyBase.durationUnit
    ?? (('durationMinutes' in partial ? partial.durationMinutes : legacyBase.durationMinutes) != null ? 'hours' : 'days');
  const merged: TaskTime = {
    durationType: partial.durationType ?? base.durationType,
    durationUnit,
    scheduleDuration: partial.scheduleDuration ?? base.scheduleDuration,
    scheduleStart: partial.scheduleStart ?? base.scheduleStart,
    scheduleFinish: partial.scheduleFinish ?? base.scheduleFinish,
    earlyStart: partial.earlyStart ?? base.earlyStart,
    earlyFinish: partial.earlyFinish ?? base.earlyFinish,
    lateStart: partial.lateStart ?? base.lateStart,
    lateFinish: partial.lateFinish ?? base.lateFinish,
    freeFloat: partial.freeFloat ?? base.freeFloat,
    totalFloat: partial.totalFloat ?? base.totalFloat,
    isCritical: partial.isCritical ?? base.isCritical,
    completion: partial.completion ?? base.completion,
    // Optioneel — sleutel-aanwezigheid, zie docstring hierboven ('in' i.p.v. '??').
    durationMinutes: 'durationMinutes' in partial ? partial.durationMinutes : base.durationMinutes,
    interferingFloat: 'interferingFloat' in partial ? partial.interferingFloat : base.interferingFloat,
    isNearCritical: 'isNearCritical' in partial ? partial.isNearCritical : base.isNearCritical,
    floatPath: 'floatPath' in partial ? partial.floatPath : base.floatPath,
    actualStart: 'actualStart' in partial ? partial.actualStart : base.actualStart,
    actualFinish: 'actualFinish' in partial ? partial.actualFinish : base.actualFinish,
    actualDuration: 'actualDuration' in partial ? partial.actualDuration : base.actualDuration,
    remainingTime: 'remainingTime' in partial ? partial.remainingTime : base.remainingTime,
    remainingMinutes: 'remainingMinutes' in partial ? partial.remainingMinutes : base.remainingMinutes,
    // Z12-herwerk — resume/stop, zelfde sleutel-aanwezigheid-conventie als actualStart/actualFinish
    // hierboven. Gevonden tijdens fase-2-implementatie (T14b-achtige bugklasse): deze functie
    // somt elk TaskTime-veld EXPLICIET op (geen spread), dus een nieuw optioneel veld dat hier niet
    // genoemd wordt, wordt STIL gedropt bij elke `updateTask({ time: {...} })`-aanroep — `tsc` ziet
    // dat niet (het returntype `TaskTime` staat een object toe dat een optioneel veld weglaat).
    resume: 'resume' in partial ? partial.resume : base.resume,
    stop: 'stop' in partial ? partial.stop : base.stop,
  };
  if (merged.durationUnit === 'days') {
    merged.durationMinutes = undefined;
  } else if (merged.durationMinutes == null && taskDurationUnitOfTime(base) === 'hours') {
    // Een partiele update mag de enige native bron van een bestaande urentaak niet los wissen.
    // De expliciete eenheidswissel naar dagen hierboven blijft de enige geldige clear-operatie.
    merged.durationMinutes = base.durationMinutes;
  }
  return merged;
}

function taskDurationUnitOfTime(time: TaskTime): TaskDurationUnit {
  const legacy = time as TaskTime & { durationUnit?: TaskDurationUnit };
  return legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
}

/** Deterministische leesmigratie voor documentpayloads en recoverydata van vóór de eenheidskeuze. */
export function normalizeTaskDurationUnits(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    // Het documentcontract wordt ook met bewust onvolledige poison-fixtures getest. Laat zulke
    // bestaande invaliditeit aan de contracttest over; de leesmigratie heeft uitsluitend iets te
    // normaliseren wanneer er daadwerkelijk een TaskTime-tak aanwezig is.
    if (!task?.time) return task;
    const legacy = task.time as TaskTime & { durationUnit?: TaskDurationUnit };
    const durationUnit = legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
    if (legacy.durationUnit === durationUnit && !(durationUnit === 'days' && legacy.durationMinutes != null)) {
      return task;
    }
    const time: TaskTime = { ...legacy, durationUnit };
    if (durationUnit === 'days') time.durationMinutes = undefined;
    return { ...task, time };
  });
}

/**
 * Z14b — edit-time-invalidatie van het GELEZEN Z8-venster (plan-Z14, "Nataken vóór Z17" punt 1;
 * EIGENAARSPRINCIPE 2026-08-18: "er gaat nooit stilzwijgend broninformatie verloren, ook niet ná
 * bewerken"). Wanneer een gebruiker een taak inhoudelijk bewerkt, mag de gelezen venster-sturing de
 * motor niet langer ankeren — maar de RAUWE bron (`Task.timephasedContours`) blijft ALTIJD staan,
 * ook ná die bewerking; alleen de AFGELEIDE sturing wordt uitgeschakeld. Deze twee functies zijn de
 * ENIGE plek die dat doet, aangeroepen vanuit `taskSlice.ts` (`updateTask`/`setTaskCalendar`),
 * `mcpTransaction.ts` (`updateTaskFields`/`patchTaskFields`/`assignResource`/`unassignResource`/
 * `moveAssignment`) en `resourceSlice.ts` (`assignResource`/`unassignResource`/`moveAssignment`) —
 * de gedocumenteerde tweeling-paden, zodat ze niet uit de pas kunnen lopen.
 *
 * SCOPE — twee aparte wis-functies, want de twee lagen hebben ANDERE stale-voorwaarden:
 *  - `clearTimephasedWindow` — LAAG 3 (`timephasedFinishFloor`, een GELEZEN, bevroren MSP-antwoord;
 *    `CPMSolver.ts`'s `timephasedFinish`) + het RAUWE wortel-anker (`timephasedStartAnchor`,
 *    `forwardPass`'s `preds.length===0`-tak). Beide zijn GELEZEN waarden die niet reageren op een
 *    latere duur-/datum-/kalenderwijziging — MOET dus bij die triggerset invalideren.
 *  - `clearTimephasedDurationWalks` — LAAG 4 (`timephasedDurationWalks`). GEEN gelezen antwoord op
 *    de ANKERS zelf (`anchor`/`resourceCalendarId` blijven geldig): `CPMSolver.ts` wandelt
 *    `task.time.durationMinutes` (edit-live) door elke toewijzing se EIGEN resourcekalender bij
 *    ELKE `runCPM` — MAAR alleen voor een item ZONDER `workMinutes`. N2 (Opus-her-check, tweede
 *    ronde, corpusbevinding): bij >1 toewijzing zet `mppReader.ts` per item een BEVROREN
 *    `workMinutes` (F2-apportionering), en `CPMSolver.ts`'s `timephasedFinish` gebruikt
 *    `walk.workMinutes ?? durMin` — die bevroren waarde WINT dus altijd van een latere duur-/datum-
 *    wijziging zodra ze gezet is (`durMin` = `task.time.durationMinutes`, een stabiel veld — een
 *    taakkalenderwissel raakt het NIET, zie de "kalender"-paragraaf hieronder, dus DIE trigger valt
 *    hier bewust buiten scope). De eerdere claim hier ("stroomt AL vanzelf mee") was dus alleen waar
 *    voor de PRECIES-1-toewijzing-tak (waar `workMinutes` per constructie ontbreekt); voor de
 *    walks>1-apportioneringstak (148 corpustaken, zie N3-blast-radius in `mppReader.ts`) deed een
 *    duur-/datumwijziging tot deze fix NIETS.
 *    MAAR (F2-fixronde, spec-review op 526af9f9): elk item in de `walks`-lijst is zelf een BEVROREN
 *    import-snapshot PER TOEWIJZING (`{ anchor, resourceCalendarId }`, `mppReader.ts`'s
 *    `deriveTimephasedWindowsForTasks`) — verandert de TOEWIJZINGENSET (een andere resource, dus
 *    mogelijk een andere resourcekalender: precies de laag-4-activeringsvoorwaarde,
 *    `calendarBandsDiffer`/`calendarDiffersIncludingExceptions`), dan is die bevroren lijst stale.
 *    Vandaar WEL een aanroep bij de toewijzingen-trigger.
 *  - `splitGaps`/`timephasedContours` — de RAUWE bron/reeds-geconsumeerde CPM-invoer, geen "gelezen
 *    venster dat de motor ankert" in dezelfde bevroren zin; het eigenaarsprincipe eist juist dat
 *    déze blijven staan. NOOIT hier wissen, in GEEN van beide functies.
 *
 * TRIGGERSET (plan: "duur, datums, kalender, toewijzingen") — bepaald en hier vastgelegd:
 *  - duur/datums: `time.scheduleDuration`/`durationMinutes`/`scheduleStart`/`scheduleFinish`/
 *    `durationType` — elke sleutel die de solver rechtstreeks voor de LAAG-3/4-berekening gebruikt
 *    (`durationType` telt mee omdat WORKTIME↔ELAPSEDTIME de hele kalenderwandeling omslaat).
 *    Raakt laag 3 (`clearTimephasedWindow`) ALTIJD, én raakt laag 4 (`clearTimephasedDurationWalks`)
 *    zodra `timephasedDurationWalksHaveFrozenWork` waar is (N2-correctie: laag 4 stroomt NIET
 *    altijd live mee, zie hierboven) — bij géén bevroren `workMinutes` blijft laag 4 met rust,
 *    want die tak wandelt toch al de live duur.
 *  - kalender: `Task.calendarId` (bepaalt de kalender waarin het venster ooit berekend werd).
 *    Raakt UITSLUITEND laag 3 — GEEN N2-uitbreiding hier: `CPMSolver.ts`'s `timephasedFinish`
 *    resolvet per walk-item ZIJN EIGEN `resourceCalendarId` (nooit `task.calendarId`), en
 *    `durMin`/`task.time.durationMinutes` is een stabiel veld dat `setTaskCalendar` niet aanraakt
 *    (geverifieerd: de enige `task.time.durationMinutes = `-schrijfplekken in CPMSolver.ts zitten
 *    in de hammock-tak, hierboven expliciet buiten laag 3/4 gehouden) — een taakkalenderwissel kan
 *    de laag-4-uitkomst dus letterlijk niet beïnvloeden, met of zonder bevroren `workMinutes`.
 *    De andere helft van de reden (Opus-her-check ronde 3, gemeten): een edit op de
 *    RESOURCEkalender zelf (`resourceSlice.updateCalendar`) is wél relevant voor de walk-uitkomst,
 *    maar stroomt LIVE door zonder invalidatie — elke walk resolvet zijn `resourceCalendarId`
 *    opnieuw bij élke `runCPM` (meting: bandwijziging op de walk-kalender verschoof de ef van
 *    13:10 naar de volgende ochtend 08:10, zonder enige clear). Ook die trigger hoort er dus
 *    bewust NIET bij.
 *  - toewijzingen: resource-assign/unassign/verplaatsen (aparte aanroepplekken, zie hierboven) —
 *    raakt BEIDE lagen ONVOORWAARDELIJK (`clearTimephasedWindow` ÉN `clearTimephasedDurationWalks`):
 *    een andere resource kan een andere resourcekalender betekenen, en dat is exact de
 *    laag-4-discriminator (F2). Ook `resourceSlice.removeCalendar`/`commitCalendarLibrary` (F3): die
 *    zetten `t.calendarId = undefined` rechtstreeks, buiten `setTaskCalendar` om, dus die twee roepen
 *    `clearTimephasedWindow` zelf aan voor elke geraakte taak.
 *  GEEN trigger: alles wat de solver zelf terugschrijft (earlyStart/earlyFinish/floats/…, zie
 *  `TaskTimeComputed`/`TaskTimeAnalysis` in task.ts) — F5/`runCPM`/documentwissel gaan nooit via
 *  `updateTask`/`updateTaskFields`/`patchTaskFields` (ze muteren de Immer-draft rechtstreeks), dus
 *  dat onderscheid hoeft hier niet apart bewaakt te worden.
 */
const TIMEPHASED_WINDOW_TIME_TRIGGERS = new Set<keyof TaskTime>([
  'scheduleDuration', 'durationMinutes', 'durationUnit', 'scheduleStart', 'scheduleFinish', 'durationType',
]);

/** `true` als `timeUpdate` minstens één trigger-sleutel NOEMT (sleutel-aanwezigheid, spiegelt
 *  `mergeTaskTime`'s `'veld' in partial`-conventie hierboven) — de WAARDE hoeft niet te wijzigen;
 *  een aanroeper die de volledige bestaande `time` spreadt telt dus ook mee (consistent met hoe de
 *  rest van deze module "genoemd" interpreteert, geen aparte diff-tracking). */
export function timeUpdateTouchesTimephasedWindow(timeUpdate: Partial<TaskTime> | undefined): boolean {
  if (!timeUpdate) return false;
  return Object.keys(timeUpdate).some((k) => TIMEPHASED_WINDOW_TIME_TRIGGERS.has(k as keyof TaskTime));
}

/** Wist `timephasedFinishFloor`/`timephasedStartAnchor` als ze gezet zijn — idempotent, geen effect
 *  op een taak zonder Z8-venster. Muteert `task` in-place (Immer-draft-stijl, spiegelt de rest van
 *  taskSlice.ts/mcpTransaction.ts). Retourneert `true` als er ECHT iets gewist is (mpp-nul-data-
 *  etappe, bewerkmelding): de aanroepers gebruiken dat om te bepalen of een gebruiker zojuist
 *  aantoonbaar de MSP-sturing van een taak heeft losgemaakt (voor de eenmalige K8a-melding, zie
 *  `state/timephasedLossNotice.ts`) — een `false` betekent een no-op-aanroep (bv. een edit op een
 *  taak die nooit een Z8-venster had), waarvoor NOOIT gemeld mag worden. */
export function clearTimephasedWindow(task: Task): boolean {
  let cleared = false;
  if (task.timephasedFinishFloor !== undefined) { delete task.timephasedFinishFloor; cleared = true; }
  if (task.timephasedStartAnchor !== undefined) { delete task.timephasedStartAnchor; cleared = true; }
  return cleared;
}

/** F2 (spec-review-fixronde op 526af9f9) — wist `timephasedDurationWalks` (LAAG 4) als gezet.
 *  Aanroepen bij een toewijzingswijziging (assign/unassign/move) ONVOORWAARDELIJK, én — sinds N2
 *  (Opus-her-check, tweede ronde) — bij een duur-/datumwijziging (GEEN kalenderwijziging, zie deze
 *  module se hoofddocblok "kalender"-paragraaf voor het waarom niet) zodra
 *  `timephasedDurationWalksHaveFrozenWork(task)` waar is (zie die functie hieronder en deze module
 *  se hoofddocblok hierboven voor het WAAROM). Zonder bevroren `workMinutes` blijft laag 4 met rust:
 *  die tak wandelt toch al de live `task.time.durationMinutes`, dus wissen zou alleen een gratis
 *  laag-4→laag-5-degradatie zijn zonder dat er iets stale was.
 *  Elk item in de lijst is een bevroren `{ anchor, resourceCalendarId, workMinutes? }`-snapshot per
 *  toewijzing uit de .mpp-import; een andere resource kan een andere resourcekalender betekenen (de
 *  laag-4-activeringsvoorwaarde), dus die lijst is sowieso stale zodra de toewijzingenset verandert.
 *  Na het wissen valt de taak terug op laag 5 (gewone CPM-duurberekening, geen Z8-venster) totdat
 *  een volgende .mpp-import de lijst opnieuw vult — er is geen "live herberekende" laag-4-vervanger.
 *  Retourneert `true` als er ECHT iets gewist is — zelfde reden/gebruik als `clearTimephasedWindow`
 *  hierboven (mpp-nul-data-etappe, bewerkmelding). */
export function clearTimephasedDurationWalks(task: Task): boolean {
  if (task.timephasedDurationWalks !== undefined) { delete task.timephasedDurationWalks; return true; }
  return false;
}

/**
 * Wist de door de nivelleerder ingevoegde werkonderbrekingen (`source === 'leveling'`) van `task` en
 * laat IMPORTSPLITS (gaten zonder `source`) staan — B1c-plan-2 taak 7, spec §4, "Herkomst"/
 * "Invalidatie". Geeft `true` terug wanneer er daadwerkelijk iets gewist is; zelfde contract als
 * `clearTimephasedWindow` hierboven (mpp-nul-data-etappe, bewerkmelding). Blijft er niets over, dan
 * wordt `splitGaps` op `undefined` gezet (niet op een lege array) — de golden rule van de
 * IFC-round-trip is "leeg/afwezig ⇒ niets geschreven".
 *
 * De AANROEPPLEKKEN (bewerkingen die de tijdbasis van een taak raken: duur, kalender, handmatige
 * datums, voortgang) worden in B1c-etappe 3 bedraad; zolang niets leveling-gaps schrijft, kan er ook
 * niets verouderen.
 */
export function clearLevelingGaps(task: Task): boolean {
  const gaps = task.splitGaps;
  if (!gaps || gaps.length === 0) return false;
  const kept = gaps.filter(g => g.source !== 'leveling');
  if (kept.length === gaps.length) return false;
  task.splitGaps = kept.length > 0 ? kept : undefined;
  return true;
}

/** OPTIONEEL — TRUE zodra de taak nog ACTIEVE Z8-sturing draagt (laag 3 en/of laag 4): een gezet
 *  `timephasedFinishFloor`/`timephasedStartAnchor` (laag 3) of een niet-lege
 *  `timephasedDurationWalks` (laag 4). Bedoeld voor de eigenschappenpaneel-markering (mpp-nul-data-
 *  etappe, DEEL 2) — "volgt de urenverdeling uit MS Project" hoort hier, niet op de kale aanwezigheid
 *  van `timephasedContours` (dat is de rauwe bron, zie `taskHasTimephasedContours` hieronder). */
export function taskHasActiveTimephasedSteering(task: Task): boolean {
  return task.timephasedFinishFloor !== undefined
    || task.timephasedStartAnchor !== undefined
    || (task.timephasedDurationWalks?.length ?? 0) > 0;
}

/** OPTIONEEL — TRUE zodra de taak rauwe, uit een .mpp-import afkomstige contourperiodes draagt
 *  (`Task.timephasedContours`). Dit veld wordt NOOIT gewist door een edit (eigenaarsprincipe
 *  2026-08-18) — samen met `taskHasActiveTimephasedSteering` hierboven onderscheidt dit de twee
 *  paneel-toestanden (mpp-nul-data-etappe, DEEL 2): actieve sturing vs. een taak die zijn sturing
 *  ná een bewerking heeft losgelaten maar waarvan de bron nog altijd in het bestand staat. */
export function taskHasTimephasedContours(task: Task): boolean {
  return (task.timephasedContours?.length ?? 0) > 0;
}

/** N2 (Opus-her-check, tweede ronde) — TRUE zodra minstens één item in `timephasedDurationWalks`
 *  een gezette `workMinutes` draagt. `CPMSolver.ts`'s `timephasedFinish` gebruikt per item
 *  `walk.workMinutes ?? task.time.durationMinutes` — is `workMinutes` gezet, dan WINT die bevroren
 *  import-tijd-waarde altijd van een latere duur-/datumwijziging op de taak; die editie had zonder
 *  deze check dus zichtbaar GEEN effect op de berekende finish (de N2-bevinding). LET OP: toets
 *  hier NOOIT op `walks.length` — 19 corpustaken dragen een lijst van LENGTE 1 mét `workMinutes`
 *  (de MATERIAL-gefilterde >1-tak in `mppReader.ts`'s finalisatielus); de garantie "geen
 *  workMinutes" zit op de PRODUCERENDE tak, niet op de uiteindelijke array-lengte. Daarom toetst
 *  deze functie veld-aanwezigheid (`.some`). Een walk zónder `workMinutes` wandelt de live duur en
 *  blijft terecht ongemoeid door de aanroepers hieronder. */
export function timephasedDurationWalksHaveFrozenWork(task: Task): boolean {
  return (task.timephasedDurationWalks ?? []).some((w) => w.workMinutes !== undefined);
}

// ── Contour-engine (2026-09): herschaling bij een duurwijziging ──────────────────────────────────

/** `hoursPerDay` van de TAAKkalender (scalar uit de `WorkCalendar`, dezelfde bron als
 *  `CPMSolver.calendarFor`/`ResourceLoad.engineForTask`: `task.calendarId` → bibliotheek, anders
 *  de projectkalender). Voor de HERSCHALINGSFACTOR is de exacte waarde alleen relevant bij een
 *  eenheidswissel dagen↔uren (bij dagen↔dagen en uren↔uren valt hij tegen elkaar weg). */
export function taskCalendarHoursPerDay(task: Task, calendars: WorkCalendar[], projectCalendar: WorkCalendar): number {
  // Reviewronde G5 (2026-09-05): de EFFECTIEVE uren per dag — op een uurkalender uit de banden
  // afgeleid — zodat contourreferentie, werkdriehoek en raster dezelfde slot zien.
  return effHoursPerDay(resolveCalendar(task.calendarId, calendars, projectCalendar));
}

/** Werkduur van de taak in werkminuten (zie `contourEngine.ts`'s `taskWorkMinutes`) — aan te
 *  roepen VÓÓR een `mergeTaskTime`, zodat `rescaleTaskContours` de oude waarde kent. */
export function taskWorkMinutesOf(task: Task, hoursPerDay: number): number {
  return taskWorkMinutes(task.time, hoursPerDay);
}

/**
 * Contour-engine (2026-09) — de bewerkregel "een bewerking op een gecontourde taak neemt de
 * verdeling mee" (taaktypes-spec, "Wat er onder de motorkap nodig is" punt 3). Aan te roepen NÁ de
 * duurmutatie op een taak die `timephasedContours` draagt: herschaalt de contourperiodes én de
 * IMPORTsplits (`splitGaps` zonder `source`) proportioneel van `oldWorkMinutes` naar de nieuwe
 * werkduur van de taak, volgens `contourEngine.ts`'s `rescaleContourForDuration` (actual-periodes
 * blijven staan, FIXED_WORK houdt het werk vast). Idempotent: gelijke duur ⇒ niets gewijzigd.
 * Muteert `task` in-place (Immer-draft-stijl, zoals `clearTimephasedWindow`). Retourneert `true`
 * als er ECHT iets herschaald is.
 *
 * Bewust GEEN aanroep bij een datumverschuiving: de as is offset-gebaseerd (shift-invariant, zie
 * `TaskSplitGap`'s docblok), dus een verplaatsing kost geen herschaling. Een kalenderwissel die de
 * SLOT verandert (uren per dag) is sinds K2 (2026-09-05) wél een aanroeper — via
 * `workRuleApply.ts`'s `settleCalendarChange`: dezelfde dagen zijn dan een andere hoeveelheid
 * werkminuten, en de as leeft op werkminuten.
 */
export function rescaleTaskContours(
  task: Task,
  oldWorkMinutes: number,
  hoursPerDay: number,
  // Taaktypes-etappe (2026-09, bouwstap 4): werkbehoud is een REGELkeuze (`workRuleApply.ts`'s
  // `contourKeepsWork`), niet langer alleen een MSP-herkomstvinkje. Zonder argument geldt de oude
  // afleiding, zodat elke bestaande aanroeper byte-identiek blijft.
  keepWork: boolean = task.mspTaskType === 'FIXED_WORK',
): boolean {
  const contours = task.timephasedContours;
  if (!contours || contours.length === 0) return false;
  const newWorkMinutes = taskWorkMinutes(task.time, hoursPerDay);
  // Eén gedeeld profiel voor de factor: de contour met de langste asspanne bepaalt de taakduur
  // (dezelfde "langste toewijzing bepaalt de finish"-regel als laag 3/4), dus die is de referentie
  // voor zowel de periodes als de gaten.
  const reference = contours.reduce((best, c) => {
    const span = c.periods.reduce((m, p) => Math.max(m, p.afterMinutes + p.minutes), 0);
    return span > best.span ? { span, periods: c.periods } : best;
  }, { span: -1, periods: contours[0].periods });
  if (!rescaleFactor(reference.periods, oldWorkMinutes, newWorkMinutes)) return false;
  task.timephasedContours = contours.map((c) => ({
    ...c,
    periods: rescaleContourForDuration(c.periods, oldWorkMinutes, newWorkMinutes, keepWork ? 'FIXED_WORK' : undefined),
  }));
  const gaps = rescaleSplitGaps(task.splitGaps, reference.periods, oldWorkMinutes, newWorkMinutes);
  if (gaps !== undefined) task.splitGaps = gaps;
  return true;
}
