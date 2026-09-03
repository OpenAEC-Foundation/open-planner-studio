import { Task, TaskConstraint, ConstraintType, MilestoneKind } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant, parseDate, isoDayOfWeek } from '@/utils/dateUtils';
import { normalizeImportedProgress, rebuildWbsHierarchy } from '@/services/importNormalize';
import { isoDatePrefixOrToday } from '@/services/importDates';
import { tenthsOfMinutesToDays } from '@/services/importDurations';
import { descendantText, toInt, toFloat } from '@/services/xmlDom';
import type { ImportResult } from '@/services/importTypes';
import type { CustomTaskType } from '@/types/taskType';
import {
  OPS_DURATION_UNIT_FIELD_ID,
  OPS_DURATION_UNIT_FIELD_NAME,
  WORKCONTOUR_TO_CURVE,
} from './mspdiWriter';
import {
  canonicalizeBands, clockToMinutes, getCalendarBands, hasNonAnchorTime, isSubDayMinutes,
  promoteHourCalendar, registerCalendarBands,
} from '@/services/subdayIo';

const OPS_CUSTOM_TASK_TYPE_FIELD_ID = '188743731';
const OPS_CUSTOM_TASK_TYPE_MARKER = 'OpenPlannerStudio.CustomTaskType.v1';
// T4 (MSPDI-uitzonderingssemantiek, spiegel van T3) — hergebruikt T3's `buildContributions`
// (record-opbouw MET budget-klem TIJDENS de opbouw, niet pas erna) en `resolveContributions`
// (precedentie-/invariant-motor) rechtstreeks i.p.v. een tweede expansie te bouwen (plan-§T4).
// `RECURRENCE_TYPES`/`RELATIVE_MAP` zijn LETTERLIJK dezelfde codetabellen als MSPDI's eigen
// `<Type>`-element gebruikt (geverifieerd tegen `org.mpxj.mspdi.MSPDIReader`'s eigen
// `RECURRENCE_TYPES`/`RELATIVE_MAP` — byte-voor-byte identiek aan de MPP-tabellen).
//
// SPEC-REVIEW-FIX (blokkerend, op 3dd6c3ba): de eerste versie bouwde zijn EIGEN
// `buildMspdiContributions`-functie die elk record EERST volledig materialiseerde (via
// `expandRecurrence`) en het `HolidayBudget` pas in `resolveContributions` toepaste — een DoS
// (reviewer-repro: 445 KB XML → 5192 ms/478 MB, waar het MPP-pad met identieke records 262 ms/26 MB
// doet). `buildContributions` (hieronder geïmporteerd i.p.v. gekopieerd) klemt WEL tijdens de
// opbouw: een lokale `remaining`-aftelling (gestart bij `budget.remaining`) begrenst de TOTALE
// hoeveelheid gematerialiseerde `ownDates` over ALLE records samen, ongeacht hoeveel records het
// bestand claimt — zie die functie se eigen toelichting (MIDDEN-1-fix) in `calendarRecurrence.ts`.
// Deze module bouwt daarom nu alleen nog zijn EIGEN `RawException[]` (uit `<Exception>`-elementen)
// en geeft die rechtstreeks aan `buildContributions`/`resolveContributions` door — geen eigen
// contributie-opbouw meer, dus geen tweede plek waar deze klem kan wegdriften.
//
// T3-CHUNK-GRENS-FIX (coördinatiepunt): dit importeert bewust rechtstreeks uit de FORMAAT-NEUTRALE
// bladmodule `@/services/calendarRecurrence` — NIET uit de MPP-kalendermodule (die her-exporteert
// dezelfde namen alleen nog backward-compatible voor bestaande callers, zie de toelichting daar). Een
// statische import uit de MPP-lezermodule zou de hele MPP-parser (CFB + fieldmaps) de main-chunk in
// trekken (zie `tests/planning/check-mpp-chunk-boundary.ts`, T11) — dat was precies deze module se
// eerdere fout, hier gecorrigeerd.
import {
  buildContributions, resolveContributions, newHolidayBudget, RECURRENCE_TYPES, RELATIVE_MAP,
  MAX_CALENDAR_EXCEPTIONS,
} from '@/services/calendarRecurrence';
import type { RecurrenceSpec, RawException, HolidayBudget } from '@/services/calendarRecurrence';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { MSPDI_WORKCONTOUR_CONTOURED } from '@/engine/contour/contourEngine';
import {
  absoluteItemsToContourPeriods, mspdiValueToMinutes, splitGapsFromContours, type AbsoluteWorkItem,
} from '@/services/contourIo';
import type { TaskTimephasedContour } from '@/types/task';

/** Synthetisch anker dat de DAG-schrijver op date-only datetimes plakt (§7.3). */
const MSP_TIME_ANCHOR = '08:00:00';

function taskDurationType(te: Element): 'WORKTIME' | 'ELAPSEDTIME' {
  const format = Number.parseInt(getElementText(te, 'DurationFormat'), 10);
  return [4, 6, 8, 10, 12].includes(format) ? 'ELAPSEDTIME' : 'WORKTIME';
}

function hasOpsDurationUnitDefinition(root: Element): boolean {
  const containers = root.getElementsByTagName('ExtendedAttributes');
  for (let i = 0; i < containers.length; i++) {
    if (containers[i].parentElement !== root) continue;
    const definitions = containers[i].getElementsByTagName('ExtendedAttribute');
    for (let j = 0; j < definitions.length; j++) {
      if (getElementText(definitions[j], 'FieldID') === OPS_DURATION_UNIT_FIELD_ID
        && getElementText(definitions[j], 'FieldName') === OPS_DURATION_UNIT_FIELD_NAME) return true;
    }
  }
  return false;
}

function explicitOpsDurationUnit(te: Element, enabled: boolean): 'days' | 'hours' | undefined {
  if (!enabled) return undefined;
  const values = te.getElementsByTagName('ExtendedAttribute');
  for (let i = 0; i < values.length; i++) {
    if (values[i].parentElement !== te) continue;
    if (getElementText(values[i], 'FieldID') !== OPS_DURATION_UNIT_FIELD_ID) continue;
    const value = getElementText(values[i], 'Value');
    if (value === 'days' || value === 'hours') return value;
  }
  return undefined;
}

/**
 * Alleen een door OPS zelf gedefinieerde marker is een expliciete taakeenheid. DurationFormat is in
 * MSPDI een presentatieformaat en mag een bestaand uurproject dus niet stil herinterpreteren. Een
 * vreemd of legacy bestand zonder marker volgt exact de pre-T1-regel: uurkalender => minutenbron.
 */
function taskDurationUnit(te: Element, hourCalendar: boolean, opsMarkerEnabled: boolean): 'days' | 'hours' {
  return explicitOpsDurationUnit(te, opsMarkerEnabled) ?? (hourCalendar ? 'hours' : 'days');
}

/** SPEC-REVIEW-FIX (blokkerend, op 3dd6c3ba) — bovengrens op het aantal `<Calendar>`-elementen dat
 *  de resource-kalenderlus in `readMSPDI` materialiseert. Vóór deze klem was de lus ONBEGRENSD: elke
 *  bibliotheek-kalender krijgt via `applyCalendarBody` zijn EIGEN `WorkCalendar`-object (workDays,
 *  bandstructuren, en sinds T4 evt. `holidays`/`workingExceptions`) — een geprepareerd, tekstueel
 *  (dus GOEDKOOP op te blazen, in tegenstelling tot MPP se binaire encoding) XML-bestand met N
 *  `<Calendar>`-elementen zou N volledige kalenderobjecten alloceren, ongeacht hoe klein elk element
 *  zelf is. Dit is dezelfde bugklasse als `mppCalendars.ts`'s `MAX_CALENDARS` (T6-kwaliteitsreview
 *  C1): het PER-KALENDER `MAX_CALENDAR_EXCEPTIONS`/gedeelde `HolidayBudget` begrenst alleen de
 *  UITZONDERINGS-materialisatie per kalender, niet het AANTAL kalender-OBJECTEN zelf.
 *
 *  Gemeten corpuswaarde: de drie `.mpp.xml`-ground-truths dragen 9, 11 en 13 `<Calendar>`-elementen
 *  (dezelfde bronprojecten als `mppCalendars.ts`'s eigen "hoogstens 13 kalenders per bestand"-
 *  meting — MPP en MSPDI zijn hier letterlijk dezelfde onderliggende MS-Project-data, alleen anders
 *  geserialiseerd). 1024 (dezelfde bovengrens als `MAX_CALENDARS` in `mppCalendars.ts`, bewust
 *  gelijkgehouden i.p.v. een eigen, afwijkend getal te verzinnen voor identieke brondata) is ruim
 *  boven elk realistisch project, maar begrenst een geprepareerd bestand hard: de lus stopt zodra
 *  `resourceCalendars.length` deze klem raakt, de rest van (mogelijk zeer veel) resterende
 *  `<Calendar>`-elementen wordt dan simpelweg niet meer bekeken. Ergste geval zonder klem: een
 *  100.001-`<Calendar>`-XML (elk element kan minimaal zijn — alleen `<UID>`/`<Name>`, enkele
 *  tientallen bytes) laat deze module 100.001 volledige `WorkCalendar`-objecten alloceren, die
 *  daarna via `ImportResult.resourceCalendars` in de app-state/undo-snapshots/IFC-saves belanden. */
const MAX_MSPDI_CALENDARS = 1_024;

// De rauwe-banden-registry (voorheen een lokale WeakMap) en `synth*BandsFromScalar` wonen nu gedeeld
// in subdayIo (F5-c/d/e). WORKCONTOUR_TO_CURVE (spiegel van mspdiWriter's CURVE_TO_WORKCONTOUR, §8.3)
// komt uit de writer — daar programmatisch afgeleid, dus reader en writer kunnen niet divergeren.

// Dunne lokale wrappers rond de gedeelde XML-primitieven (F5-b). MSPDI leest DESCENDANT-tags
// (`getElementsByTagName`), waar P6 juist alleen directe kinderen leest — die scope-keuze blijft
// hiermee per formaat bewaard terwijl de parse-fallback-conventie gedeeld is.
function getElementText(parent: Element, tagName: string): string {
  return descendantText(parent, tagName);
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  return toInt(getElementText(parent, tagName), fallback);
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  return toFloat(getElementText(parent, tagName), fallback);
}

/** T4 (§9/O6-vervolg) — MSPDI-spiegel van mppReader.ts's `deriveMilestoneKind` (T11, `fb385191`,
 *  vervolgens `c0c2cd27` — beide niet geëxporteerd daar; dit bestand zit buiten T4's exclusieve
 *  scope om te wijzigen, dus hier lokaal herhaald): een UUR-modus-mijlpaal krijgt `milestoneKind`
 *  wanneer het opgeslagen anker exact op een bandgrens van de EFFECTIEVE (gepromoveerde) kalender
 *  ligt — bandbegin ⇒ `'START'`, bandeinde (vandaag, of gisteren over middernacht) ⇒ `'FINISH'`.
 *  Kijkt uitsluitend naar de kalender-eigen weekdagbanden (`cal.workTime.byWeekday`), geen holiday-/
 *  werkuitzondering-materialisatie (dat is `CalendarEngine`'s taak in de solver, buiten deze lezer
 *  se scope).
 *
 *  SPEC-REVIEW-FIX (should-fix, op 3dd6c3ba) — deze spiegel citeerde `fb385191` maar miste
 *  `c0c2cd27` (6 minuten later gecommit, dus vóór 3dd6c3ba al bestaand): de GISTEREN-tak gebruikte
 *  hier nog de VERVANGEN, STRIKTE `b.end > 1440` i.p.v. mppReader.ts's gecorrigeerde `b.end >= 1440`
 *  — een band die EXACT om middernacht eindigt (`end === 1440`, bv. een ploegendienst 20:00–24:00;
 *  `resolveOneDay`/`applyCalendarBody` bouwen zo'n band zonder clamp, dus een normale vorm, geen
 *  theoretisch randgeval) gaf hier `undefined` waar MPP al `'FINISH'` gaf sinds `c0c2cd27` — een
 *  pariteitsregressie tussen de twee MS-Project-lezers. Fix: `>=`; `b.end - 1440` blijft dan `0` en
 *  matcht correct met `minuteOfDay` van een 00:00-anker de dag erna. Twee aangrenzende banden zonder
 *  pauze ertussen (bandeinde van de ene band == bandbegin van de andere, op dezelfde dag) zijn een
 *  gedegenereerd geval dat hier als `'START'` uitvalt (de bandbegin-check loopt eerst) — onschadelijk:
 *  bij een pauzeloze aaneensluiting is het gat tussen de banden nul, dus of het anker als START van
 *  de tweede band of als FINISH van de eerste wordt geclassificeerd maakt voor de datumberekening
 *  niets uit. */
function deriveMspdiMilestoneKind(cal: WorkCalendar, anchor: Date): MilestoneKind | undefined {
  const bands = cal.workTime;
  if (!bands) return undefined;
  const wd = isoDayOfWeek(anchor) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const prevWd = (((wd + 5) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7; // wd - 1, gewrapt naar 1..7
  const minuteOfDay = anchor.getUTCHours() * 60 + anchor.getUTCMinutes();
  const todays = bands.byWeekday[wd] ?? [];
  for (const b of todays) {
    if (b.start === minuteOfDay) return 'START';
  }
  for (const b of todays) {
    if (b.end === minuteOfDay) return 'FINISH';
  }
  const yesterdays = bands.byWeekday[prevWd] ?? [];
  for (const b of yesterdays) {
    if (b.end >= 1440 && b.end - 1440 === minuteOfDay) return 'FINISH';
  }
  return undefined;
}

/** MS Project-datum in DAG-modus (`2026-03-09T08:00:00` → `2026-03-09`); gedeeld met P6 (F5-a). */
function parseMSPDate(s: string): string {
  return isoDatePrefixOrToday(s);
}

/** Datum uit MSPDI in UUR-modus: echte tijd-van-de-dag behouden (`parseInstant`+`formatInstant`, §7.3). */
function parseMSPInstant(s: string): string {
  if (!s) return formatDate(new Date());
  return formatInstant(parseInstant(s), 'hour');
}

/** ISO-8601-duur met tijdcomponent (`PT{H}H{M}M{S}S`) → minuten; `null` als er geen tijdcomponent is. */
function mspDurationMinutes(s: string): number | null {
  if (!s) return null;
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (parseInt(m[1] || '0', 10)) * 60 + parseInt(m[2] || '0', 10) + Math.round(parseInt(m[3] || '0', 10) / 60);
}

/**
 * Duur in DAGEN (dag-modus). Fase 2.8b (§7.3): de hardcoded `/8` is vervangen door `hoursPerDay`
 * (latente bug bij niet-8u-kalenders), en de uren komen uit `mspDurationMinutes`. `PnD` blijft
 * elapsed-dagen. In uur-modus gebruikt de reader `mspDurationMinutes` rechtstreeks (geen afronding).
 */
function parseMSPDuration(s: string, hoursPerDay: number): number {
  if (!s) return 0;
  const mins = mspDurationMinutes(s);
  if (mins != null) {
    const perDay = hoursPerDay * 60;
    return perDay > 0 ? Math.round(mins / perDay) : 0;
  }
  const dayMatch = s.match(/P(\d+)D/);
  if (dayMatch) return parseInt(dayMatch[1]);
  return 0;
}

/** Eigen MSPDI-uitbreiding; andere clients mogen de vrije ExtendedAttribute negeren. */
function readOpsCustomTaskType(task: Element): { id: string; name?: string } | undefined {
  const attrs = task.getElementsByTagName('ExtendedAttribute');
  for (const attr of attrs) {
    if (attr.parentElement !== task || getElementText(attr, 'FieldID') !== OPS_CUSTOM_TASK_TYPE_FIELD_ID) continue;
    try {
      const raw: unknown = JSON.parse(getElementText(attr, 'Value'));
      if (raw && typeof raw === 'object'
        && (raw as { ops?: unknown }).ops === OPS_CUSTOM_TASK_TYPE_MARKER
        && typeof (raw as { id?: unknown }).id === 'string') {
        const id = (raw as { id: string }).id.trim();
        const name = typeof (raw as { name?: unknown }).name === 'string'
          ? (raw as { name: string }).name.trim()
          : '';
        if (id) return { id, ...(name ? { name } : {}) };
      }
    } catch { /* vreemde vrije attributen zijn geen taaktype */ }
  }
  return undefined;
}

/** Geëxporteerd (fase 3.8 e1, T7) zodat `mppReader.ts`'s TBkndCons-relatielezer exact dezelfde
 *  code-tabel gebruikt i.p.v. een eigen kopie — MPXJ's `RelationType.getInstance` (ConstraintFactory
 *  .java) gebruikt letterlijk dezelfde 0=FF/1=FS/2=SF/3=SS-codering met dezelfde FS-terugval voor
 *  een onbekende/buiten-bereik-waarde, dus hergebruik i.p.v. spiegelen is hier de correcte poort. */
export function mspTypeToSequenceType(type: number): SequenceType {
  switch (type) {
    case 0: return 'FINISH_FINISH';
    case 1: return 'FINISH_START';
    case 2: return 'START_FINISH';
    case 3: return 'START_START';
    default: return 'FINISH_START';
  }
}

/**
 * Fase 2.9 (§6) — MSPDI `ConstraintType`-code → OPS-constraint (spiegel van `mspConstraintCode`).
 * 2/3 (Must Start/Finish On) zijn HARD ⇒ `MSO`/`MFO` mét `hard:true` (daar klopt de semantiek); 4-7
 * zijn de soft SNET/SNLT/FNET/FNLT; 0 (ASAP, default) en onbekend ⇒ `undefined` (geen constraint).
 */
export function mspCodeToConstraint(code: number): { type: ConstraintType; hard?: boolean } | undefined {
  switch (code) {
    case 1: return { type: 'ALAP' };
    case 2: return { type: 'MSO', hard: true };
    case 3: return { type: 'MFO', hard: true };
    case 4: return { type: 'SNET' };
    case 5: return { type: 'SNLT' };
    case 6: return { type: 'FNET' };
    case 7: return { type: 'FNLT' };
    default: return undefined;
  }
}

export function readMSPDI(content: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }

  const root = doc.documentElement;
  const opsDurationUnitMarkerEnabled = hasOpsDurationUnitDefinition(root);

  // Parse project
  const project = parseProject(root);
  // T4: één gedeeld `HolidayBudget` over ALLE kalenders in dit document (projectkalender + elke
  // resourcekalender) — zie `applyCalendarBody`'s toelichting (spiegelt mppCalendars.ts's C1-
  // discipline, `MAX_TOTAL_HOLIDAY_SLOTS`).
  const holidayBudget = newHolidayBudget();
  const calendar = parseCalendar(root, holidayBudget);
  const hoursPerDay = calendar.hoursPerDay;

  // Resource-kalenders (fase 2.5, §8.2): elk <Calendar>-element in <Calendars> behalve UID 1
  // (de projectkalender, altijd als eerste geschreven/gelezen — zelfde aanname als parseCalendar).
  const calendarsRoot = root.getElementsByTagName('Calendars')[0];
  const calUidToId = new Map<number, string>();
  const resourceCalendars: WorkCalendar[] = [];
  if (calendarsRoot) {
    const calElements = calendarsRoot.getElementsByTagName('Calendar');
    // MAX_MSPDI_CALENDARS: zie de constante se meetcommentaar hierboven — begrenst het AANTAL
    // gematerialiseerde resource-kalenderOBJECTEN, niet alleen hun uitzonderingsinhoud.
    for (let i = 0; i < calElements.length && resourceCalendars.length < MAX_MSPDI_CALENDARS; i++) {
      const calEl = calElements[i];
      if (calEl.parentElement !== calendarsRoot) continue;
      const uid = getElementInt(calEl, 'UID', -1);
      if (uid <= 1) continue; // UID 1 = projectkalender, al gelezen door parseCalendar
      const cal = createDefaultCalendar();
      cal.id = generateId('rescal');
      cal.name = getElementText(calEl, 'Name') || cal.name;
      // §8.3: werkweek/uren/feestdagen ook voor bibliotheek-kalenders teruglezen (voorheen alleen
      // naam/id — dezelfde beperking die de projectkalender vóór 2.8a had). MSPDI kent geen
      // regelset-herkomst (verliesmatrix §8.4) — generation blijft altijd undefined.
      applyCalendarBody(calEl, cal, holidayBudget);
      delete cal.generation;
      calUidToId.set(uid, cal.id);
      resourceCalendars.push(cal);
    }
  }

  // Resources (fase 2.5, §8.2)
  const resourcesRoot = root.getElementsByTagName('Resources')[0];
  const resources: Resource[] = [];
  const resUidToId = new Map<number, string>();
  if (resourcesRoot) {
    const resElements = resourcesRoot.getElementsByTagName('Resource');
    for (let i = 0; i < resElements.length; i++) {
      const resEl = resElements[i];
      if (resEl.parentElement !== resourcesRoot) continue;
      const uid = getElementInt(resEl, 'UID', -1);
      if (uid < 0) continue;
      const id = generateId('res');
      resUidToId.set(uid, id);

      const name = getElementText(resEl, 'Name') || 'Resource';
      const type = getElementInt(resEl, 'Type', 1);
      const maxUnits = getElementFloat(resEl, 'MaxUnits', 1);
      const materialLabel = getElementText(resEl, 'MaterialLabel');
      const calUid = getElementInt(resEl, 'CalendarUID', -1);
      const standardRate = getElementText(resEl, 'StandardRate');

      // MSP maakt geen onderscheid tussen LABOR/EQUIPMENT/CREW/SUBCONTRACTOR (Type=1 =
      // "Work") — zonder verdere hint komt dat terug als LABOR (geaccepteerd verlies, §8.4).
      const resource: Resource = {
        id,
        name,
        type: type === 0 ? 'MATERIAL' : 'LABOR',
        description: '',
        maxUnits,
      };
      if (materialLabel) resource.unitOfMeasure = materialLabel;
      if (calUid >= 0 && calUidToId.has(calUid)) resource.calendarId = calUidToId.get(calUid);
      const rate = parseFloat(standardRate);
      if (Number.isFinite(rate) && standardRate) resource.costPerHour = rate;
      resources.push(resource);
    }
  }

  // Parse tasks
  const taskElements = root.getElementsByTagName('Task');
  const tasks: Task[] = [];
  const customTaskTypes = new Map<string, CustomTaskType>();
  const uidToId = new Map<number, string>();
  const uidToWbs = new Map<number, string>();
  const pendingLinks: { successorId: string; predUid: number; type: number; lag: number; lagFormat: number }[] = [];
  // Baseline 0 (fase 2.6, §9.1): per taak de gesnapshotte Start/Finish/Duration.
  const baselineEntries: BaselineTask[] = [];

  // Fase 2.8b (§7.3): uur-modus-beslissing per kalender (discriminator a/b/c) vóór het bouwen van de
  // taken. `effCalIdOfUid` geeft per taak de effectieve kalender-id (CalendarUID 1/ontbrekend =
  // projectkalender). `taskHourById` voedt de lag-eenheid-keuze verderop.
  const calById = new Map<string, WorkCalendar>();
  calById.set(calendar.id, calendar);
  for (const c of resourceCalendars) calById.set(c.id, c);
  const effCalIdOfUid = (calUid: number): string => (calUid > 1 && calUidToId.get(calUid)) || calendar.id;
  const taskHourById = new Map<string, boolean>();

  const cSignalCalIds = new Set<string>();
  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    if (te.parentElement?.tagName !== 'Tasks') continue;
    const calId = effCalIdOfUid(getElementInt(te, 'CalendarUID', 1));
    const cal = calById.get(calId);
    if (!cal) continue;
    const durMin = mspDurationMinutes(getElementText(te, 'Duration'));
    const durSignal = durMin != null && isSubDayMinutes(durMin, cal.hoursPerDay);
    const dateSignal = hasNonAnchorTime(getElementText(te, 'Start'), MSP_TIME_ANCHOR)
      || hasNonAnchorTime(getElementText(te, 'Finish'), MSP_TIME_ANCHOR);
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  // MSPDI valt terug op de scalar-synth zodra de geregistreerde canonical geen werkdag draagt
  // (preferCanonicalWhenEmpty = false) — zie de F5-noot bij `promoteHourCalendar`.
  const hourModeCalIds = new Set<string>();
  for (const [id, cal] of calById) {
    if (promoteHourCalendar(cal, getCalendarBands(cal), cSignalCalIds.has(id), false)) {
      hourModeCalIds.add(id);
    }
  }

  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    // Skip if this is nested inside another element (like PredecessorLink)
    if (te.parentElement?.tagName !== 'Tasks') continue;

    const uid = getElementInt(te, 'UID', -1);
    if (uid < 0) continue;

    // Skip project summary task (UID 0)
    const outlineLevel = getElementInt(te, 'OutlineLevel', 1);
    if (uid === 0 && outlineLevel === 0) continue;

    const id = generateId('task');
    uidToId.set(uid, id);

    const name = getElementText(te, 'Name') || 'Task';
    const wbs = getElementText(te, 'WBS') || `${uid}`;
    uidToWbs.set(uid, wbs);
    // Taak-kalender (fase 2.8a, §8.3): effectieve <CalendarUID> → task.calendarId. UID 1 (of
    // ontbrekend, legacy-bestanden) = projectkalender ⇒ undefined (bestaande conventie).
    const taskCalUid = getElementInt(te, 'CalendarUID', 1);
    const taskCalendarId = taskCalUid > 1 ? calUidToId.get(taskCalUid) : undefined;
    // Fase 2.8b (§7.3): uur- vs dag-modus voor deze taak.
    const effCalId = effCalIdOfUid(taskCalUid);
    const isHour = hourModeCalIds.has(effCalId);
    const effHpd = calById.get(effCalId)?.hoursPerDay ?? hoursPerDay;

    const durationStr = getElementText(te, 'Duration');
    // Duur: uur ⇒ minuten (bron van waarheid, geen afronding, §7.3); dag ⇒ het bestaande dag-pad.
    const durationUnit = taskDurationUnit(te, isHour, opsDurationUnitMarkerEnabled);
    const durationMinutes = durationUnit === 'hours' ? (mspDurationMinutes(durationStr) ?? 0) : undefined;
    const duration = durationUnit === 'hours'
      ? (effHpd > 0 ? durationMinutes! / (effHpd * 60) : 0)
      : parseMSPDuration(durationStr, effHpd);
    const start = isHour ? parseMSPInstant(getElementText(te, 'Start')) : parseMSPDate(getElementText(te, 'Start'));
    const finish = isHour ? parseMSPInstant(getElementText(te, 'Finish')) : parseMSPDate(getElementText(te, 'Finish'));
    const isMilestone = getElementInt(te, 'Milestone') === 1;
    // T4 (§9/O6-vervolg) — MSPDI-spiegel van mppReader.ts's T11-afleiding (`fb385191` + de
    // her-reviewfix `c0c2cd27`, niet geëxporteerd daar, dus hier lokaal herhaald in
    // `deriveMspdiMilestoneKind`, zie die functie se docblock voor de exacte-middernacht-nuance):
    // een UUR-modus-mijlpaal krijgt `milestoneKind` wanneer het opgeslagen anker (finish, of start als
    // finish ontbreekt, exact op een bandgrens van de EFFECTIEVE (gepromoveerde) kalender ligt.
    // `finish`/`start` zijn al de juiste, per-taakmodus geparste waarden (isHour ⇒
    // `parseMSPInstant`-string, minuutprecisie) — hergebruikt i.p.v. een tweede DOM-lookup, zodat dit
    // nooit een ANDER Finish-element kan raken dan waar `time.scheduleFinish` al op gebaseerd is.
    //
    // H2 (Opus-review T15-iteratie-2): de eerdere formulering hier ("bij een echte mijlpaal, duur 0,
    // zijn beide gelijk") ging er stilzwijgend van uit dat `isMilestone` ALTIJD duur 0 impliceert —
    // exact de aanname die T15's mijlpaal-met-duur-bevinding weerlegde (`isMilestone=true` mét een
    // reële duur is MSP-legitiem, zie `CPMSolver.isZeroDurationMilestone`'s toelichting). Spiegelt nu
    // de `mppReader.ts`-guard (`raw.durationRaw === 0`): `durationMinutes` is hier al de kant-en-klare
    // uur-modus-duur (regel ~360, `0` bij een echte mijlpaal) — zónder de `=== 0`-guard zou een taak
    // met `Milestone=1` én een reële duur alsnog een `milestoneKind` krijgen die haar opvolger via
    // `snapSuccessorEarlyStart` (CPMSolver.ts) verkeerd zou landen, exact de mppReader-bug vóór T15.
    const effCalForMilestone = calById.get(effCalId);
    const milestoneKind = isMilestone && isHour && durationMinutes === 0 && effCalForMilestone
      ? deriveMspdiMilestoneKind(effCalForMilestone, parseInstant(finish || start))
      : undefined;
    const percentComplete = getElementInt(te, 'PercentComplete');
    const priority = getElementInt(te, 'Priority', 500);
    const description = getElementText(te, 'Notes');
    const customTaskType = readOpsCustomTaskType(te);
    if (customTaskType?.name && !customTaskTypes.has(customTaskType.id)) {
      customTaskTypes.set(customTaskType.id, { id: customTaskType.id, name: customTaskType.name });
    }

    // Actuals (fase 2.6, §9.1) — leeg ⇒ undefined (invarianten volgen bij normalizeImportedProgress).
    const actualStartRaw = getElementText(te, 'ActualStart');
    const actualFinishRaw = getElementText(te, 'ActualFinish');
    const remainingRaw = getElementText(te, 'RemainingDuration');
    const actualStart = actualStartRaw ? (isHour ? parseMSPInstant(actualStartRaw) : parseMSPDate(actualStartRaw)) : undefined;
    const actualFinish = actualFinishRaw ? (isHour ? parseMSPInstant(actualFinishRaw) : parseMSPDate(actualFinishRaw)) : undefined;
    // RemainingDuration: uur ⇒ minuten; dag ⇒ het bestaande dag-pad.
    const remainingMinutes = durationUnit === 'hours' && remainingRaw ? (mspDurationMinutes(remainingRaw) ?? undefined) : undefined;
    const remainingTime = durationUnit === 'days' && remainingRaw ? parseMSPDuration(remainingRaw, effHpd) : undefined;

    let status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED' = 'NOT_STARTED';
    if (percentComplete >= 100) status = 'COMPLETED';
    else if (percentComplete > 0) status = 'STARTED';

    // Datum-constraint (fase 2.9, §6): ConstraintType/ConstraintDate. 0/ontbrekend ⇒ geen constraint
    // (default-inert). MSPDI kent geen secundaire constraint. Datum: uur ⇒ echte tijd, dag ⇒ strip.
    const parseCstrDate = (raw: string): string => isHour ? parseMSPInstant(raw) : parseMSPDate(raw);
    let constraint: TaskConstraint | undefined;
    const cTypeRaw = getElementText(te, 'ConstraintType');
    if (cTypeRaw) {
      const mapped = mspCodeToConstraint(parseInt(cTypeRaw, 10));
      if (mapped) {
        const cdateRaw = getElementText(te, 'ConstraintDate');
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(cdateRaw ? { date: parseCstrDate(cdateRaw) } : {}),
        };
      }
    }
    // Zachte deadline (fase 2.9, §6): native <Deadline> → task.deadline.
    const deadlineRaw = getElementText(te, 'Deadline');
    const deadline = deadlineRaw ? parseCstrDate(deadlineRaw) : undefined;

    // Baseline 0: eerste direct-kind <Baseline> met <Number>0</Number>.
    const baselineEls = te.getElementsByTagName('Baseline');
    for (let b = 0; b < baselineEls.length; b++) {
      const bEl = baselineEls[b];
      if (bEl.parentElement !== te) continue;
      if (getElementInt(bEl, 'Number', -1) !== 0) continue;
      baselineEntries.push({
        taskId: id,
        start: parseMSPDate(getElementText(bEl, 'Start')),
        finish: parseMSPDate(getElementText(bEl, 'Finish')),
        duration: parseMSPDuration(getElementText(bEl, 'Duration'), hoursPerDay),
        isMilestone,
      });
      break;
    }

    tasks.push({
      id,
      name,
      description,
      wbsCode: wbs,
      taskType: customTaskType ? 'USERDEFINED' : 'CONSTRUCTION',
      ...(customTaskType ? { customTaskTypeId: customTaskType.id } : {}),
      status,
      isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority,
      parentId: null,
      childIds: [],
      time: {
        durationType: taskDurationType(te),
        // DurationFormat bepaalt in MSPDI de schrijfnotatie (en elapsed-vlag), niet een
        // afzonderlijke dagtaaksemantiek. De bestaande precisiediscriminator bepaalt de
        // blijvende OPS-eenheid zodat de geplande brondata niet van betekenis verandert.
        durationUnit,
        scheduleDuration: duration,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        remainingTime,
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: percentComplete / 100,
      },
      resourceIds: [],
      ...(constraint ? { constraint } : {}),
      ...(deadline ? { deadline } : {}),
      ...(taskCalendarId ? { calendarId: taskCalendarId } : {}),
    });
    taskHourById.set(id, isHour);

    // Parse predecessor links within task element
    const predLinks = te.getElementsByTagName('PredecessorLink');
    for (let j = 0; j < predLinks.length; j++) {
      const pl = predLinks[j];
      const predUid = getElementInt(pl, 'PredecessorUID', -1);
      const linkType = getElementInt(pl, 'Type', 1);
      const linkLag = getElementInt(pl, 'LinkLag', 0);
      const lagFormat = getElementInt(pl, 'LagFormat', 7);
      if (predUid >= 0) {
        pendingLinks.push({
          successorId: id,
          predUid,
          type: linkType,
          lag: linkLag,
          lagFormat,
        });
      }
    }
  }

  // Parent-child-hiërarchie uit gepunte WBS-codes (gedeeld met CSV, F5-f).
  rebuildWbsHierarchy(tasks);

  // Resolve sequences. LagFormat (subset van MSPDI DurationFormat): 19/20 = (elapsed) procent
  // met LinkLag in tienden van een procent; 4/6/8/10/12 = elapsed duren (24/7); rest = werktijd
  // in tienden van minuten (bestaand pad).
  const ELAPSED_DURATION_FORMATS = new Set([4, 6, 8, 10, 12]);
  const sequences: Sequence[] = [];
  for (const link of pendingLinks) {
    const predId = uidToId.get(link.predUid);
    if (!predId) continue;
    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: link.successorId,
      type: mspTypeToSequenceType(link.type),
      lagDays: 0,
    };
    if (link.lagFormat === 19 || link.lagFormat === 20) {
      seq.lagPercent = link.lag / 10;
      if (link.lagFormat === 20) seq.lagUnit = 'ELAPSEDTIME';
    } else if (ELAPSED_DURATION_FORMATS.has(link.lagFormat)) {
      seq.lagDays = Math.round(link.lag / 10 / 60 / 24);
      seq.lagUnit = 'ELAPSEDTIME';
    } else if (taskHourById.get(link.successorId)) {
      // Fase 2.8b (§7.3): uur-opvolger ⇒ lag minuut-precies (tienden-van-minuten ÷ 10, geen
      // dag-afronding). LinkLag is al in tienden van minuten.
      seq.lagMinutes = Math.round(link.lag / 10);
    } else {
      seq.lagDays = tenthsOfMinutesToDays(link.lag, hoursPerDay);
    }
    sequences.push(seq);
  }

  // Assignments (fase 2.5, §8.2)
  const assignmentsRoot = root.getElementsByTagName('Assignments')[0];
  const assignments: ResourceAssignment[] = [];
  // Contour-engine (2026-09): taak-lookup + kalender-engine per taakkalender voor de as-vertaling
  // van `<TimephasedData>` (zie `contourIo.ts`). Kalenders zijn hierboven al gepromoveerd naar
  // uur-modus waar de discriminator dat besliste, dus `calendarForEngine` levert de juiste modus.
  const taskById = new Map(tasks.map(t => [t.id, t] as const));
  const engineCache = new Map<string, CalendarEngine>();
  const engineForTask = (task: Task): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = engineCache.get(key);
    if (!eng) {
      eng = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, resourceCalendars, calendar)));
      engineCache.set(key, eng);
    }
    return eng;
  };
  const contoursByTaskId = new Map<string, TaskTimephasedContour[]>();
  if (assignmentsRoot) {
    const asgnElements = assignmentsRoot.getElementsByTagName('Assignment');
    for (let i = 0; i < asgnElements.length; i++) {
      const asgnEl = asgnElements[i];
      if (asgnEl.parentElement !== assignmentsRoot) continue;
      const taskUid = getElementInt(asgnEl, 'TaskUID', -1);
      const resourceUid = getElementInt(asgnEl, 'ResourceUID', -1);
      if (taskUid < 0 || resourceUid < 0) continue;
      const taskId = uidToId.get(taskUid);
      const resourceId = resUidToId.get(resourceUid);
      if (!taskId || !resourceId) continue;

      const unitsText = getElementText(asgnEl, 'Units');
      const units = parseFloat(unitsText);
      const contour = getElementInt(asgnEl, 'WorkContour', 0);
      const curve = WORKCONTOUR_TO_CURVE[contour];

      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId,
        unitsPerDay: Number.isFinite(units) && unitsText ? units : 1,
        ...(curve && curve !== 'UNIFORM' ? { curve } : {}),
      });

      // Contour-engine (2026-09): native `<TimephasedData>` (Type 1 = resterend, 2 = verricht werk;
      // MPXJ `MSPDIReader.readTimephasedWork`) → contourperiodes op de taak-as van déze taak,
      // gekoppeld aan de toewijzing via `resourceId`. Vlakke data (één item, of alleen nul-werk)
      // levert géén contour op — een contour die niets toevoegt aan `Units × duur` is ruis.
      // `WorkContour === 8` (Contoured) is het MSP-signaal, maar de data zelf is leidend.
      const task = taskById.get(taskId);
      if (task) {
        const items: AbsoluteWorkItem[] = [];
        const tpElements = asgnEl.getElementsByTagName('TimephasedData');
        for (let j = 0; j < tpElements.length; j++) {
          const tp = tpElements[j];
          if (tp.parentElement !== asgnEl) continue;
          const type = getElementInt(tp, 'Type', -1);
          if (type !== 1 && type !== 2) continue;
          const startRaw = getElementText(tp, 'Start');
          const finishRaw = getElementText(tp, 'Finish');
          if (!startRaw || !finishRaw) continue;
          const workMinutes = mspdiValueToMinutes(getElementText(tp, 'Value'));
          if (workMinutes === null) continue;
          items.push({
            start: parseInstant(startRaw), finish: parseInstant(finishRaw), workMinutes,
            kind: type === 2 ? 'actual' : 'remaining',
          });
        }
        if (items.length > 0 && task.time.scheduleStart) {
          const periods = absoluteItemsToContourPeriods(
            engineForTask(task), parseInstant(task.time.scheduleStart), items,
          );
          const hasWork = periods.some(p => p.workMinutes > 0);
          const informative = periods.length > 1 || contour === MSPDI_WORKCONTOUR_CONTOURED;
          if (hasWork && informative) {
            const list = contoursByTaskId.get(taskId) ?? [];
            list.push({ resourceUid, resourceId, periods });
            contoursByTaskId.set(taskId, list);
          }
        }
      }
    }
  }
  // Contour-engine: contouren én de daaruit afgeleide werkonderbrekingen op de taken zetten —
  // dezelfde afleiding als de .mpp-lezer (`splitGapsFromContours`), alleen voor taken die nog geen
  // gaten dragen (MSPDI kent geen andere split-bron, dus dat is per constructie elke taak).
  for (const [taskId, contours] of contoursByTaskId) {
    const task = taskById.get(taskId);
    if (!task || task.childIds.length > 0) continue;
    task.timephasedContours = contours;
    if (!task.splitGaps || task.splitGaps.length === 0) {
      const gaps = splitGapsFromContours(contours.map(c => c.periods));
      if (gaps.length > 0) task.splitGaps = gaps;
    }
  }

  // Baseline 0 → één actieve OPS-baseline "Baseline (MSPDI)" (fase 2.6, §9.1).
  const baselines: Baseline[] = [];
  let activeBaselineId: string | null = null;
  if (baselineEntries.length > 0) {
    const id = generateId('baseline');
    const finishes = baselineEntries.map(b => b.finish).filter(Boolean).sort();
    baselines.push({
      id,
      name: 'Baseline (MSPDI)',
      createdAt: new Date().toISOString(),
      tasks: baselineEntries,
      projectEnd: finishes[finishes.length - 1] || '',
      projectDuration: 0,
    });
    activeBaselineId = id;
  }

  // Voortgang-invarianten op de rauw ingelezen actuals (§3.2/§15.6).
  normalizeImportedProgress(tasks, project.statusDate);

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars,
    customTaskTypes: [...customTaskTypes.values()],
    baselines,
    activeBaselineId,
  };
}

function parseProject(root: Element): Project {
  const project: Project = {
    id: generateId('proj'),
    name: getElementText(root, 'Name') || getElementText(root, 'Title') || 'MS Project Import',
    description: '',
    startDate: parseMSPDate(getElementText(root, 'StartDate')),
    endDate: parseMSPDate(getElementText(root, 'FinishDate')),
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: getElementText(root, 'Author'),
    company: getElementText(root, 'Company'),
  };
  // Statusdatum (fase 2.6, §9.1) → project.statusDate. Alleen wanneer aanwezig.
  const statusDateRaw = getElementText(root, 'StatusDate');
  if (statusDateRaw) project.statusDate = parseMSPDate(statusDateRaw);
  // Scheduling-options (fase 2.9, §6): CriticalSlackLimit → criticalDefinition.threshold (dagen,
  // mode 'totalFloat'). Alleen wanneer het element aanwezig is (spiegel van de writer). threshold 0
  // is de default (tf≤0) en dus inert. De overige opties zitten niet in MSPDI (alleen via IFC).
  const cslRaw = getElementText(root, 'CriticalSlackLimit');
  if (cslRaw) {
    const csl = parseInt(cslRaw, 10);
    if (Number.isFinite(csl)) {
      project.schedulingOptions = { criticalDefinition: { mode: 'totalFloat', threshold: csl } };
    }
  }
  return project;
}

/** Poort van `MSPDIReader.readRecurringData` (org.mpxj.mspdi) — MSPDI-equivalent van
 *  mppCalendars.ts's `readRecurringData`, maar leest genaamde XML-elementen i.p.v. byte-offsets.
 *  `<Type>` draagt LETTERLIJK dezelfde codewaarde als MPP se `recurrenceTypeValue` (geverifieerd
 *  tegen de MPXJ-bron — `RECURRENCE_TYPES`/`RELATIVE_MAP` zijn daarom hergebruikt, niet gekopieerd).
 *  Retourneert `null` voor een out-of-range/afwezig `<Type>` ÉÉN voor een geflattende DAILY-
 *  recurrentie (frequentie 1 — spiegelt MSPDIReader se eigen slotblok: "flatten daily recurring
 *  exceptions if they only result in one date range"). */
function readMspdiRecurringData(exc: Element, fromDate: Date, toDate: Date | null): RecurrenceSpec | null {
  const typeValue = getElementInt(exc, 'Type', 0);
  const type = typeValue >= 0 && typeValue < RECURRENCE_TYPES.length ? RECURRENCE_TYPES[typeValue] : null;
  if (type === null) return null;
  const relative = typeValue < RELATIVE_MAP.length ? RELATIVE_MAP[typeValue] : false;
  const occurrences = getElementInt(exc, 'Occurrences', 0);
  // `getFrequency` (MSPDIReader.java): `<Period>` afwezig ⇒ 1 — spiegelt mppCalendars.ts's
  // DAILY-`@76`-asymmetrie functioneel (bij een niet-recurrente Type=1-export schrijft MSPDIWriter
  // nooit `<Period>`, dus de default-1 hier heeft hetzelfde effect als MPP se harde `frequency=1`
  // bij recurrenceTypeValue===1).
  const period = getElementInt(exc, 'Period', 1);

  let frequency = 1;
  let weeklyDayMask = 0;
  let dayNumber = 0;
  let dayOfWeekValue = 0;
  let monthNumber = 0;

  switch (type) {
    case 'DAILY':
      frequency = period;
      break;
    case 'WEEKLY':
      // `<DaysOfWeek>` is al de bitmap in DAY_MASKS-layout (bit0=zondag..bit6=zaterdag) — zelfde
      // conventie als MPP se `weeklyDayMask` (geverifieerd: MSPDIReader se `DAY_MASKS` is byte-voor-
      // byte gelijk aan mppCalendars.ts's aanname), dus geen vertaalslag nodig.
      weeklyDayMask = getElementInt(exc, 'DaysOfWeek', 0);
      frequency = period;
      break;
    case 'MONTHLY':
      if (relative) {
        dayOfWeekValue = getElementInt(exc, 'MonthItem', 0) - 2;
        dayNumber = getElementInt(exc, 'MonthPosition', 0) + 1;
      } else {
        dayNumber = getElementInt(exc, 'MonthDay', 0);
      }
      frequency = period;
      break;
    case 'YEARLY':
      if (relative) {
        dayOfWeekValue = getElementInt(exc, 'MonthItem', 0) - 2;
        dayNumber = getElementInt(exc, 'MonthPosition', 0) + 1;
      } else {
        dayNumber = getElementInt(exc, 'MonthDay', 0);
      }
      monthNumber = getElementInt(exc, 'Month', 0) + 1;
      // MSPDIReader leest hier GEEN `<Period>` (YEARLY kent geen frequentie-veld in het schema) —
      // `frequency` blijft op de default (1), ongebruikt door `expandRecurrence`'s YEARLY-tak.
      break;
  }

  if (type === 'DAILY' && frequency === 1) return null; // flatten, spiegelt MSPDIReader
  return { type, relative, startDate: fromDate, finishDate: toDate, occurrences, frequency, weeklyDayMask, dayNumber, dayOfWeekValue, monthNumber };
}

/** Leest alle `<Exception>`-elementen van één `<Calendar>` in RUWE vorm — geklemd op
 *  `MAX_CALENDAR_EXCEPTIONS` (gedeeld met de MPP-kant via `@/services/calendarRecurrence`). Spiegelt
 *  MSPDIReader.readException's guard: een record zonder BEIDE FromDate/ToDate wordt overgeslagen
 *  ("Vico Schedule Planner"-leeg-record-guard); een record met een fromDate maar zonder toDate is
 *  alleen bruikbaar als het een RECURRENTE (occurrences-begrensde) uitzondering is — een niet-
 *  recurrent bereik heeft een expliciet einde nodig (spiegelt `RawException`'s eigen "niet-recurrent
 *  zonder toDate wordt overgeslagen"-conventie in `calendarRecurrence.ts`).
 *
 *  Retourneert `RawException[]` — de FORMAAT-NEUTRALE ruwe-recordvorm uit `calendarRecurrence.ts`
 *  zelf (spec-review-fix op 3dd6c3ba, zie de importtoelichting bovenaan dit bestand): dit bestand
 *  vult uitsluitend die vorm uit `<Exception>`-elementen en geeft het resultaat rechtstreeks aan
 *  `buildContributions` door, i.p.v. een eigen tussenvorm + een eigen contributie-opbouw te
 *  onderhouden. `periodCount` spiegelt hier MPP se `periodCount>0`-signaal (het GETAL zelf is
 *  betekenisloos — de banden zelf dragen de echte data — alleen "> 0" telt als DayWorking-vlag):
 *  `Math.max(bands.length, 1)` bij een werkende uitzondering (zodat ook een werkende uitzondering
 *  ZONDER expliciete `<WorkingTimes>` — de banden-optioneel-fallback-keten in `types/calendar.ts`'s
 *  `WorkingException` — als werkend blijft signaleren), anders `0`. */
function readRawMspdiExceptions(calEl: Element): RawException[] {
  const exceptionsRoot = calEl.getElementsByTagName('Exceptions')[0];
  if (!exceptionsRoot) return [];
  const exceptionEls = exceptionsRoot.getElementsByTagName('Exception');
  const out: RawException[] = [];
  const limit = Math.min(exceptionEls.length, MAX_CALENDAR_EXCEPTIONS); // zie MAX_CALENDAR_EXCEPTIONS (calendarRecurrence.ts)
  for (let i = 0; i < limit; i++) {
    const exc = exceptionEls[i];
    if (exc.parentElement !== exceptionsRoot) continue;

    const timePeriod = exc.getElementsByTagName('TimePeriod')[0];
    if (!timePeriod) continue;
    const fromDateRaw = getElementText(timePeriod, 'FromDate');
    const toDateRaw = getElementText(timePeriod, 'ToDate');
    if (!fromDateRaw && !toDateRaw) continue; // beide leeg — spiegelt MSPDIReader's Vico-guard
    if (!fromDateRaw) continue; // startdatum is altijd vereist om te kunnen materialiseren

    const fromDate = parseDate(parseMSPDate(fromDateRaw));
    const toDate = toDateRaw ? parseDate(parseMSPDate(toDateRaw)) : null;

    const dayWorking = getElementInt(exc, 'DayWorking', 0) === 1;
    const name = getElementText(exc, 'Name');

    const bands: { start: number; end: number }[] = [];
    if (dayWorking) {
      const timesRoot = exc.getElementsByTagName('WorkingTimes')[0];
      if (timesRoot) {
        const workingTimeEls = timesRoot.getElementsByTagName('WorkingTime');
        for (let k = 0; k < workingTimeEls.length; k++) {
          const wt = workingTimeEls[k];
          if (wt.parentElement !== timesRoot) continue;
          const s = clockToMinutes(getElementText(wt, 'FromTime'));
          const e = clockToMinutes(getElementText(wt, 'ToTime'));
          if (s != null && e != null) bands.push({ start: s, end: e });
        }
      }
    }

    const recurring = readMspdiRecurringData(exc, fromDate, toDate);
    if (!recurring && !toDate) continue; // niet-recurrent bereik zonder einddatum: geen bruikbaar bereik

    const periodCount = dayWorking ? Math.max(bands.length, 1) : 0;
    out.push({ fromDate, toDate, periodCount, bands, name, recurring });
  }
  return out;
}

/**
 * Werkdagen/uren/feestdagen uit een `<Calendar>`-element in `calendar` toepassen (spiegel van
 * `writeCalendarBlock`) — gedeeld tussen de projectkalender (`parseCalendar`) en elke
 * bibliotheek-kalender (fase 2.8a, §8.3: voorheen kregen resource-kalenders alleen naam/id, nooit
 * hun eigen werkweek/uren/feestdagen terug — dezelfde beperkte lezing als de projectkalender vóór
 * 2.8a). Golden rule: ontbrekende WeekDay/WorkingTime/Exception-elementen laten de
 * `createDefaultCalendar()`-defaults ongemoeid.
 *
 * `budget` (T4) — één gedeeld `HolidayBudget` over ALLE kalenders in één `readMSPDI`-aanroep (zie de
 * aanroepplekken in `parseCalendar`/`readMSPDI`) — spiegelt mppCalendars.ts's C1-discipline
 * (`MAX_TOTAL_HOLIDAY_SLOTS`): zonder gedeeld budget zou N kalenders × M uitzonderingen elk apart
 * binnen `MAX_CALENDAR_EXCEPTIONS` kunnen blijven maar SAMEN alsnog een onbegrensde totale
 * dag-voor-dag-materialisatie kunnen forceren (dezelfde klasse bug die T6-kwaliteitsreview C1 voor
 * MPP al vond — hier voorkomen vóórdat hij ooit bestond, niet achteraf gefixt).
 */
function applyCalendarBody(calEl: Element, calendar: WorkCalendar, budget: HolidayBudget): void {
  // Parse work days from WeekDay elements
  const weekDays = calEl.getElementsByTagName('WeekDay');
  const workDays: number[] = [];
  // Fase 2.8b (§7.3): ALLE <WorkingTime>-banden per weekdag lezen (nu las de reader alleen het eerste
  // blok als scalar) → rauwe banden voor de uur-modus-beslissing.
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};

  for (let i = 0; i < weekDays.length; i++) {
    const wd = weekDays[i];
    // Only process direct children of WeekDays
    if (wd.parentElement?.tagName !== 'WeekDays') continue;

    const dayType = getElementInt(wd, 'DayType');
    const dayWorking = getElementInt(wd, 'DayWorking');

    if (dayWorking === 1 && dayType >= 1 && dayType <= 7) {
      // Convert MSP day (1=Sun, 2=Mon, ..., 7=Sat) to ISO (1=Mon, ..., 7=Sun)
      const isoDay = dayType === 1 ? 7 : dayType - 1;
      workDays.push(isoDay);
      const wts = wd.getElementsByTagName('WorkingTime');
      const dayBands: { start: number; end: number }[] = [];
      for (let k = 0; k < wts.length; k++) {
        const s = clockToMinutes(getElementText(wts[k], 'FromTime'));
        const e = clockToMinutes(getElementText(wts[k], 'ToTime'));
        if (s != null && e != null) dayBands.push({ start: s, end: e });
      }
      if (dayBands.length > 0) rawByWeekday[isoDay as 1] = dayBands;
    }
  }

  if (workDays.length > 0) {
    calendar.workDays = workDays.sort((a, b) => a - b);
  }

  // Parse working times for start/end hours (scalar, bestaand dag-pad)
  const workingTimes = calEl.getElementsByTagName('WorkingTime');
  if (workingTimes.length > 0) {
    const fromTime = getElementText(workingTimes[0], 'FromTime');
    const toTime = getElementText(workingTimes[0], 'ToTime');
    if (fromTime) {
      const h = parseInt(fromTime.split(':')[0]);
      if (!isNaN(h)) calendar.workStartHour = h;
    }
    if (toTime) {
      const h = parseInt(toTime.split(':')[0]);
      if (!isNaN(h)) calendar.workEndHour = h;
    }
    calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    if (calendar.hoursPerDay <= 0) calendar.hoursPerDay = 8;
  }

  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  registerCalendarBands(calendar, { canonical: bands, deviates });

  // T4: uitzonderingen (holidays + werkende uitzonderingen + recurrente expansie) — hergebruikt T3's
  // `buildContributions` (budget-geklemde opbouw) + `resolveContributions` (precedentie-/invariant-
  // resolutie) rechtstreeks, zie de importtoelichting bovenaan dit bestand. Golden rule ONGEWIJZIGD:
  // 0 `<Exception>`-elementen in het bestand ⇒ `createDefaultCalendar()`'s NL-feestdagen-default
  // blijft ongemoeid — de override-beslissing hangt daarom af van `rawExceptions.length` (zag het
  // bestand ÉCHTE uitzonderingsdata), niet van de RESOLVED output-lengte (die kan 0 zijn terwijl het
  // bestand wél degelijk data droeg, bv. een kalender met uitsluitend werkende uitzonderingen en 0
  // feestdagen).
  const rawExceptions = readRawMspdiExceptions(calEl);
  if (rawExceptions.length > 0) {
    const contributions = buildContributions(rawExceptions, budget);
    const { holidays, workingExceptions } = resolveContributions(contributions, budget);
    calendar.holidays = holidays;
    // Spiegelt mppCalendars.ts: `workingExceptions` blijft AFWEZIG (niet `[]`) wanneer leeg — byte-
    // identiek gedrag met vóór deze taak voor elke kalender zonder werkende uitzonderingen.
    if (workingExceptions.length > 0) calendar.workingExceptions = workingExceptions;
    else delete calendar.workingExceptions;
  }
}

function parseCalendar(root: Element, budget: HolidayBudget): WorkCalendar {
  const calElements = root.getElementsByTagName('Calendar');
  if (calElements.length === 0) return createDefaultCalendar();

  const cal = calElements[0];
  const calName = getElementText(cal, 'Name') || 'Imported Calendar';
  const calendar = createDefaultCalendar();
  calendar.name = calName;
  // MSPDI kent geen regelset-herkomst (verliesmatrix §8.4) — createDefaultCalendar() zet 'm altijd
  // (nieuwe projecten zijn per definitie gegenereerd); een uit MSPDI gelezen kalender is dat niet.
  delete calendar.generation;

  applyCalendarBody(cal, calendar, budget);

  // Parse minutes per day from project level — authoritatief, overschrijft de
  // WorkingTime-afgeleide waarde uit applyCalendarBody (bestaand gedrag).
  const minutesPerDay = getElementInt(root, 'MinutesPerDay');
  if (minutesPerDay > 0) {
    calendar.hoursPerDay = minutesPerDay / 60;
  }

  return calendar;
}
