// MPP-kalenders (fase 3.8 etappe 1, T6): TBkndCal-lezer (`src/services/mpp/mppCalendars.ts`) —
// synthetische end-to-end-fixture, hostile varianten (T6-kwaliteitsreview: kalenderaantal-/holiday-
// budgetten, off-by-one, resource-UID-0, base-ketens), en de corpus-/crawl-secties.
//
// T6-KWALITEITSREVIEW (M7): dit bestand is GESPLITST uit `check-mpp-import.ts` — dat bestand droeg
// tot deze taak zowel de T3-T5-taken-/container-checks áls alle T6-kalenderchecks in één, snel
// groeiend bestand. De T6-fixturebouwers (`buildCalFixedMetaBlob`/`buildCalFixedDataRecord`/
// `buildCalHoursBlock`/`buildCalExceptionsTail`/`writeCalDayBlock`/`concatBytes`) wonen sinds deze
// splitsing in `mppFixtures.ts` (gedeeld); `check-mpp-import.ts` blijft T3-T5-territorium (CFB-laag,
// MPP-containerlaag, taken/hiërarchie), dit bestand is exclusief T6.
//
// Twee lagen dekking (zelfde structuur als check-mpp-import.ts):
//  1. SYNTHETISCHE FIXTURES — draaien ALTIJD, ook zonder corpus.
//  2. CORPUS-/CRAWL-GEDREVEN checks — optioneel, netjes overgeslagen zonder de map (OPS_MPP_CORPUS/
//     OPS_MPP_CRAWL), GEEN in-repo fixture (echte bedrijfsbestanden resp. mogelijk auteursrechtelijk
//     beschermd cursusmateriaal).
//
// Draait via run.sh en draait daarna ook mee in de tijdzone-matrix — bewust geen tijdzone-gevoelige
// logica hierin (zelfde discipline als check-mpp-import.ts).
//
// DEKKINGSKAART (T9 — dit bestand is exclusief T6-territorium):
//   - TBkndCal-lezer end-to-end + hostile varianten (kalenderaantal-/holiday-budgetten,
//     off-by-one, resource-UID-0, base-ketens)                         → SYNTHETISCH, altijd
//   - projectkalender workDays + holidays vs. MSPDI-ground-truth        → CORPUS (3 bestanden — de
//     holidaykant is hier toevallig altijd 0/0, zie de I2-toelichting; dus GEEN bewijslast voor
//     `parseExceptions` — die levert de crawl-sectie)
//   - holiday-materialisatie (EIGEN holidays, dubbeltelvrij, over ALLE
//     kalenders van een bestand)                                       → CRAWL (49 bestanden, T6)
// Corpus/crawl-afwezig ⇒ nette OK-skip, beïnvloedt nooit de einduitslag. Zie check-mpp-import.ts
// (taken/container/CFB) en check-mpp-relations.ts (relaties/resources/assignments) voor de andere
// domeinen.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CfbFile } from '@/services/mpp/cfb';
import { Props } from '@/services/mpp/mppContainer';
import { getDate } from '@/services/mpp/mppPrimitives';
import type { Holiday } from '@/types/calendar';
import {
  readCalendars, parseExceptions, promoteCalendarsForHourMode,
  MAX_CALENDARS, MAX_BASE_CHAIN_DEPTH,
} from '@/services/mpp/mppCalendars';
// Formaat-neutrale recurrentie-/precedentiekern (chunk-grens-fix, Opus-review) — rechtstreeks uit
// de bladmodule, niet via mppCalendars.ts's her-export (die bestaat alleen voor bestaande callers
// zoals mspdiReader.ts totdat T4 zijn eigen import repoint).
import {
  expandRecurrence, buildContributions, resolveContributions, newHolidayBudget,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS,
  MAX_RECURRENCE_DATES, MAX_RECURRENCE_ITERATIONS,
} from '@/services/calendarRecurrence';
import type { RawException } from '@/services/calendarRecurrence';
import { readMPP, openMppProject } from '@/services/mpp/mppReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { installDOMParser } from './xmldom-shim';
import { formatDate } from '@/utils/dateUtils';
// B2 (eindreview T16c): het echte "readMPP → solveProject → writeIFC → readIFC → solveProject"-pad
// voor de "0-feestdagen-blijft-0-feestdagen"-end-to-end-case — dezelfde rekenkern als
// `mppFidelity.ts` (`solveProject`, niet een losse `CPMSolver`), en de echte IFC-lezer/-schrijver.
import { solveProject } from '@/engine/scheduler/solveProject';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import {
  buildNestedCfb, encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry,
  buildCalFixedMetaBlob, buildCalFixedDataRecord, buildCalHoursBlock, buildCalExceptionsTail, concatBytes,
  buildVarMetaBytes,
  type CfbTreeNode,
} from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

const TIME_LIMIT_MS = 2000;

// ── Kleine, lokale byte-encoders voor de gecombineerde taak+kalender-fixture hieronder (bewust NIET
// gedeeld met check-mpp-import.ts se eigen taak-fixture-helpers — deze zijn tot een enkele taak
// geminimaliseerd, alleen om de taak→kalender-koppeling te bewijzen, geen hiërarchie/WBS/milestones;
// zie check-mpp-import.ts voor de volledige taak-fixture-dekking). ──────────────────────────────────
const FIXED_META_MAGIC = 0xfadfadba;
const PASSWORD_FLAG_KEY = 893386752;
const PROJECT_START_DATE_KEY = 37748738;
const PROJECT_FINISH_DATE_KEY = 37748739;
const MINUTES_PER_DAY_KEY = 37748765;
const TITLE_KEY = 37748744;
const DEFAULT_CALENDAR_NAME_KEY = 37748750;

function encodeUnicodeStringAscii(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
  return out;
}

function timestampBytes(time: number, days: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint16(0, time, true);
  view.setUint16(2, days, true);
  return out;
}

function int32Payload(value: number): Uint8Array {
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, value, true);
  return p;
}

/** Dagen sinds MPP-epoch (SHORT) → ISO-datumstring — voor het vertalen van fixture-`fromDay`-
 *  waarden naar de verwachte `Holiday.startDate`. */
function mppDayToIso(raw: number): string {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, raw, true);
  const d = getDate(buf, 0);
  return d ? formatDate(d) : '';
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// I4/T6 — end-to-end readMPP: één taak + TBkndCal (basis + afgeleide kalender + holiday), bewijst
// de taak→kalender-koppeling ÉN de kalenderlezer in dezelfde aanroep.
//
// De fixture zit sinds de eindreview-fixronde (T16c/B2) in een eigen functie
// (`buildI4T6FixtureBytes`) — niet meer inline in dit blok — zodat de B2-round-tripcase
// hieronder (`ifcReader.ts`'s "lege holidays telt als afwezig"-bugfix) DEZELFDE bytes hergebruikt
// i.p.v. een tweede, kunnen-afdrijven kopie te bouwen. Deze fixture se PROJECTKALENDER (calId=1,
// "Standaard fixture") draagt bewust GEEN enkele exception — `baseHours` concateneert geen
// `buildCalExceptionsTail(...)` — en is dus zelf al de "`.mpp` met 0 feestdagen"-casus die B2 nodig
// heeft; alleen de afgeleide resource-kalender (calId=5) draagt de ene holiday hieronder.
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Module-scope zodat zowel `buildI4T6FixtureBytes` (die de holiday materialiseert) als de
// I4/T6-assertieblok hieronder (die de gematerialiseerde datum controleert) 'm zien.
const HOLIDAY_FROM_DAY = 15005;

function buildI4T6FixtureBytes(): Uint8Array {
  // ── Taak (minimaal — alleen om calendarUniqueId=5 te dragen). FixedData op de LETTERLIJKE
  // default-offsets uit fieldMap14.ts (geen TASK_FIELD_MAP meegegeven, spiegelt check-mpp-import.ts
  // se I4-fixture). Index 0-2 zijn dummy (FIRST_TASK_INDEX=3 in mppReader.ts se readTasks). ────────
  function buildTaskFixedDataRecord(opts: { uniqueId: number; id: number; startDays: number; finishDays: number; calendarUniqueId: number }): Uint8Array {
    const out = new Uint8Array(130);
    const view = new DataView(out.buffer);
    view.setInt32(0, opts.uniqueId, true);
    view.setInt32(4, opts.id, true);
    view.setInt16(40, 1, true); // outlineLevel
    view.setInt32(42, 4800, true); // 4800 tienden-van-minuut = 8u = 1 dag @480 min/dag
    view.setInt16(56, 0, true); // constraintType = 0 (ASAP)
    view.setUint16(64, 0, true);
    view.setUint16(66, opts.startDays, true);
    view.setUint16(68, 0, true);
    view.setUint16(70, opts.finishDays, true);
    view.setInt32(118, opts.calendarUniqueId, true);
    return out;
  }
  function buildTaskFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
    const out = new Uint8Array(47);
    new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
    return out;
  }
  const dummy = buildTaskFixedMetaRecord(0);
  const metaTask = buildTaskFixedMetaRecord(3 * 130); // offset naar het echte taakrecord (index 3) in taskFixedDataBlob
  const taskFixedMetaBlob = new Uint8Array(16 + 4 * 47);
  {
    const v = new DataView(taskFixedMetaBlob.buffer);
    v.setUint32(0, FIXED_META_MAGIC, true);
    v.setInt32(8, 4, true);
    [dummy, dummy, dummy, metaTask].forEach((item, i) => taskFixedMetaBlob.set(item, 16 + i * 47));
  }
  const dataTask = buildTaskFixedDataRecord({ uniqueId: 10, id: 1, startDays: 15000, finishDays: 15001, calendarUniqueId: 5 });
  const taskFixedDataBlob = new Uint8Array(4 * 130);
  taskFixedDataBlob.set(dataTask, 3 * 130); // index 3 = het echte taakrecord

  const taskVarMetaBytes = buildVarMetaBytes([{ uniqueId: 10, type: 14, offset: 0 }]);
  const taskNamePayload = encodeUnicodeStringAscii('Task1');
  const taskVar2DataBuf = new Uint8Array(4 + taskNamePayload.length);
  new DataView(taskVar2DataBuf.buffer).setInt32(0, taskNamePayload.length, true);
  taskVar2DataBuf.set(taskNamePayload, 4);

  // ── Kalenders: calId=1 (basis, ma/wo/vr 08:00-17:00) + calId=5 (afgeleid, ALLE dagen
  // defaultFlag=1 ⇒ volledig geërfd, plus één eigen holiday) — calId=5 matcht de taak se
  // calendarUniqueId hierboven, zodat dit tegelijk de koppeling bewijst. ─────────────────────────
  const baseHours = buildCalHoursBlock([
    { defaultFlag: 0 },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0 },
  ]);
  const derivedHours = concatBytes(
    buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 1 as const }))),
    // freq76 bewust NIET 1 (default 256, zie buildCalExceptionsTail) — bewijst dat materialisatie
    // bij recurrenceTypeValue=1 (DAILY) onafhankelijk is van @76 (T6-spec-review-fix).
    buildCalExceptionsTail([{ fromDay: HOLIDAY_FROM_DAY, toDay: HOLIDAY_FROM_DAY }]),
  );
  const calFixedMetaBlob = buildCalFixedMetaBlob([0, 12]);
  const calFixedDataBlob = concatBytes(
    buildCalFixedDataRecord(1, 1, -1),
    buildCalFixedDataRecord(5, 1, 1),
  );
  const CAL_NAME1_OFF = 0, CAL_DATA1_OFF = 100, CAL_NAME5_OFF = 600, CAL_DATA5_OFF = 700;
  const calVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 1, type: 1, offset: CAL_NAME1_OFF },
    { uniqueId: 1, type: 8, offset: CAL_DATA1_OFF },
    { uniqueId: 5, type: 1, offset: CAL_NAME5_OFF },
    { uniqueId: 5, type: 8, offset: CAL_DATA5_OFF },
  ]);
  const calVar2DataBuf = new Uint8Array(1400);
  const calVar2View = new DataView(calVar2DataBuf.buffer);
  const writeCalVar2 = (offset: number, payload: Uint8Array) => {
    calVar2View.setInt32(offset, payload.length, true);
    calVar2DataBuf.set(payload, offset + 4);
  };
  writeCalVar2(CAL_NAME1_OFF, encodeUnicodeStringAscii('Standaard fixture'));
  writeCalVar2(CAL_DATA1_OFF, baseHours);
  writeCalVar2(CAL_NAME5_OFF, encodeUnicodeStringAscii('Kalender Res5'));
  writeCalVar2(CAL_DATA5_OFF, derivedHours);

  const projectPropsBytes = encodePropsEntries([
    { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
    { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
    { key: MINUTES_PER_DAY_KEY, data: int32Payload(480) },
    { key: TITLE_KEY, data: encodeUnicodeStringAscii('Fixture Project') },
    { key: DEFAULT_CALENDAR_NAME_KEY, data: encodeUnicodeStringAscii('Standaard fixture') },
  ]);

  const tree: Record<string, CfbTreeNode> = {
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(PASSWORD_FLAG_KEY, 0) },
    '   114': {
      children: {
        Props: { data: projectPropsBytes },
        TBkndTask: {
          children: {
            FixedMeta: { data: taskFixedMetaBlob },
            FixedData: { data: taskFixedDataBlob },
            VarMeta: { data: taskVarMetaBytes },
            Var2Data: { data: taskVar2DataBuf },
          },
        },
        TBkndCal: {
          children: {
            FixedMeta: { data: calFixedMetaBlob },
            FixedData: { data: calFixedDataBlob },
            VarMeta: { data: calVarMetaBytes },
            Var2Data: { data: calVar2DataBuf },
          },
        },
      },
    },
  };

  return buildNestedCfb(tree);
}

{
  let result: ReturnType<typeof readMPP> | null = null;
  let threw: string | null = null;
  try {
    result = readMPP(buildI4T6FixtureBytes());
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`I4/T6 end-to-end readMPP: gooit niet (${threw ?? ''})`, threw === null);

  if (result) {
    truthy('I4/T6 end-to-end readMPP: 1 taak', result.tasks.length === 1);
    truthy('I4/T6 end-to-end readMPP: projectkalender naam uit DEFAULT_CALENDAR_NAME', result.calendar.name === 'Standaard fixture');
    truthy('I4/T6 end-to-end readMPP: projectkalender workDays === ma-vr', JSON.stringify(result.calendar.workDays) === JSON.stringify([1, 2, 3, 4, 5]));
    truthy('I4/T6 end-to-end readMPP: projectkalender hoursPerDay === MINUTES_PER_DAY-override (480/60=8)', result.calendar.hoursPerDay === 8);
    truthy('I4/T6 end-to-end readMPP: projectkalender heeft géén eigen uitzonderingen', result.calendar.holidays.length === 0);
    truthy('I4/T6 end-to-end readMPP: precies 1 resourceCalendar (calId=5)', result.resourceCalendars?.length === 1);

    const derived = result.resourceCalendars?.[0];
    truthy('I4/T6 end-to-end readMPP: afgeleide kalender gevonden', !!derived);
    if (derived) {
      truthy('I4/T6 end-to-end readMPP: afgeleide kalender naam', derived.name === 'Kalender Res5');
      truthy(
        'I4/T6 end-to-end readMPP: afgeleide kalender erft workDays van de base (alle dagen defaultFlag=1)',
        JSON.stringify(derived.workDays) === JSON.stringify([1, 2, 3, 4, 5]),
      );
      truthy('I4/T6 end-to-end readMPP: afgeleide kalender heeft precies 1 eigen holiday', derived.holidays.length === 1);
      if (derived.holidays.length === 1) {
        const expectedIso = mppDayToIso(HOLIDAY_FROM_DAY);
        truthy('I4/T6 end-to-end readMPP: holiday-startdatum === HOLIDAY_FROM_DAY', derived.holidays[0].startDate === expectedIso);
        truthy('I4/T6 end-to-end readMPP: holiday is een 1-dags bereik (start===end)', derived.holidays[0].startDate === derived.holidays[0].endDate);
      }
      const task = result.tasks[0];
      truthy('I4/T6 end-to-end readMPP: Task1.calendarId === de afgeleide kalender (calendarUniqueId=5)', !!task && task.calendarId === derived.id);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// B2 (eindreview T16c) — de daadwerkelijke ".mpp met 0 feestdagen"-end-to-end-regressie die
// T14-scenario-4 had moeten zijn: readMPP (projectkalender ZONDER exceptions, zie boven) →
// solveProject (echte rekenkern, `runCPM`'s exacte keten, `mppFidelity.ts`'s precedent) →
// writeIFC → readIFC → solveProject nogmaals. De bug (`ifcReader.ts` `buildCalendarFromEntity`,
// `if (holidays.length > 0) calendar.holidays = holidays`) liet een lege ExceptionTimes-lijst de
// `createDefaultCalendar()`-bouwmodus-defaults (29 NL-feestdagen) laten staan — deze case bewijst
// zowel "0 feestdagen blijft 0 feestdagen" als "de datums blijven identiek" in één keten, met
// mutatiebewijs (zie de opdrachtrapportage: de oude guard teruggezet levert hier 29 feestdagen op).
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  const before = readMPP(buildI4T6FixtureBytes());
  truthy('B2 vóór save: projectkalender 0 feestdagen (voorwaarde van deze case)', before.calendar.holidays.length === 0);

  const solveInputBefore = {
    tasks: before.tasks, sequences: before.sequences, calendar: before.calendar,
    calendars: before.resourceCalendars ?? [], dataDate: before.project.statusDate,
    progressMode: before.project.progressMode, schedulingOptions: before.project.schedulingOptions,
    projectStartDate: before.project.startDate,
  };
  const cpmBefore = solveProject(solveInputBefore);
  truthy(`B2 vóór save: solveProject faalt niet (${cpmBefore.error ?? ''})`, !cpmBefore.error);
  const taskBefore = before.tasks[0];
  const esBefore = taskBefore?.time.earlyStart;
  const efBefore = taskBefore?.time.earlyFinish;
  truthy('B2 vóór save: taak heeft een earlyStart/earlyFinish', !!esBefore && !!efBefore);

  const ifcText = writeIFC(before as WriteIFCInput);
  const after = readIFC(ifcText);
  truthy('B2 ná save+heropenen: projectkalender NOG STEEDS 0 feestdagen (het bewijs van de fix)', after.calendar.holidays.length === 0);

  const solveInputAfter = {
    tasks: after.tasks, sequences: after.sequences, calendar: after.calendar,
    calendars: after.resourceCalendars ?? [], dataDate: after.project.statusDate,
    progressMode: after.project.progressMode, schedulingOptions: after.project.schedulingOptions,
    projectStartDate: after.project.startDate,
  };
  const cpmAfter = solveProject(solveInputAfter);
  truthy(`B2 ná save+heropenen: solveProject faalt niet (${cpmAfter.error ?? ''})`, !cpmAfter.error);
  const taskAfter = after.tasks.find(t => t.name === taskBefore?.name);
  truthy('B2 ná save+heropenen: taak teruggevonden op naam', !!taskAfter);
  if (taskAfter) {
    truthy(
      `B2 ná save+heropenen: earlyStart identiek (${esBefore} vs ${taskAfter.time.earlyStart})`,
      taskAfter.time.earlyStart === esBefore,
    );
    truthy(
      `B2 ná save+heropenen: earlyFinish identiek (${efBefore} vs ${taskAfter.time.earlyFinish})`,
      taskAfter.time.earlyFinish === efBefore,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T6-hostile: mppCalendars.ts tegen vijandige/geprepareerde invoer
// ═══════════════════════════════════════════════════════════════════════════════════════════

// ── T7-her-review restpunt (b): de ALTIJD-vangende `readCalendars`-wrapper (I1-fix, zie de
// toelichting bij die functie) had tot deze taak GEEN eigen regressienet — elke andere hostile-test
// hierboven/hieronder roept al ofwel `readCalendars` MET een geldige FixedMeta/FixedData aan
// (test het materialisatiegedrag, niet de wrapper zelf), ofwel een low-level primitief los
// (`parseExceptions`). Dit bewijst specifiek de wrapper: een FOUT FixedMeta-magic-getal op
// `TBkndCal/FixedMeta` gooit diep in `readCalendarsUnsafe` (via `FixedMeta.withItemSize`) — de
// wrapper moet dat vangen en `fallbackResult()` teruggeven (`calendarByUniqueId.size === 0`),
// nooit de fout laten doorlekken naar `readMPP`. ────────────────────────────────────────────────
{
  const badMagicFixedMeta = new Uint8Array(16 + 12); // header + 1 item, magic bewust fout
  new DataView(badMagicFixedMeta.buffer).setUint32(0, 0xdeadbeef, true); // ≠ BLOCK_MAGIC (0xfadfadba)
  const fixedData = buildCalFixedDataRecord(1, 1, -1);
  const projectProps = new Props(encodePropsEntries([]), 'T7-her-review-bad-magic');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCal: { children: { FixedMeta: { data: badMagicFixedMeta }, FixedData: { data: fixedData } } } } },
  }));

  let result: ReturnType<typeof readCalendars> | null = null;
  let threw: string | null = null;
  try {
    result = readCalendars(cfb, projectProps, null);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-her-review-b readCalendars-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-her-review-b readCalendars-wrapper: calendarByUniqueId.size === 0 (fallbackResult)', result?.calendarByUniqueId.size === 0);
  truthy('T7-her-review-b readCalendars-wrapper: projectCalendar blijft een geldige generieke default', !!result?.projectCalendar.workDays.length);
}

// ── Circulaire base-kalender-verwijzing: calId=10 verwijst naar base 20, calId=20 naar base 10 —
// GEEN van beide is ooit een "echte" basiskalender (baseId<=0 of ===zichzelf), dus beide belanden
// in `readCalendars`' Fase 2 (afgeleide kalenders) en verwijzen alleen naar elkaar. Zonder
// `MAX_BASE_CHAIN_DEPTH` zou de fixed-point-resolutie hier oneindig kunnen doorlopen — bewijst dat
// de lus na een begrensd aantal ronden stopt en BEIDE kalenders alsnog materialiseert (zonder
// overerving), i.p.v. te hangen of ze stilzwijgend te laten vallen.
{
  const fixedMeta = buildCalFixedMetaBlob([0, 12]);
  const fixedData = concatBytes(
    buildCalFixedDataRecord(10, 20, -1),
    buildCalFixedDataRecord(20, 10, -1),
  );
  const varMeta = buildVarMetaBytes([]);
  const projectProps = new Props(encodePropsEntries([]), 'T6-hostile-circular');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCal: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));

  const start = Date.now();
  let result: ReturnType<typeof readCalendars> | null = null;
  let threw: string | null = null;
  try {
    result = readCalendars(cfb, projectProps, null);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T6-hostile circulaire base-keten: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T6-hostile circulaire base-keten: gooit niet (${threw ?? ''})`, threw === null);
  truthy('T6-hostile circulaire base-keten: beide kalenders alsnog gematerialiseerd', result?.calendarByUniqueId.size === 2);
}

// ── resource-uniqueID 0 op een AFGELEIDE kalender blijft gekoppeld (asymmetrische guard). ─────────
{
  const fixedMeta = buildCalFixedMetaBlob([0, 12]);
  const fixedData = concatBytes(
    buildCalFixedDataRecord(1, 1, -1),
    buildCalFixedDataRecord(2, 1, 0),
  );
  const varMeta = buildVarMetaBytes([]);
  const projectProps = new Props(encodePropsEntries([]), 'T6-hostile-resourceUid0');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCal: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  const result = readCalendars(cfb, projectProps, null);
  truthy(
    'T6-spec-review-fix: afgeleide kalender met resource-uniqueID 0 blijft gekoppeld (geen >0-guard zoals MPXJ se afgeleide tak)',
    result.resourceCalendarUniqueIdByResourceUniqueId.get(0) === 2,
  );
  truthy(
    'T6-spec-review-fix: basiskalender met resource-uniqueID -1 blijft ONgekoppeld (>0-guard zoals MPXJ se basis-tak)',
    !result.resourceCalendarUniqueIdByResourceUniqueId.has(-1),
  );
}

// ── T16-veeglijst: MAX_DAY_HOUR_PERIODS-overlapfout (`mppCalendars.ts`, was 10, nu 5) — bewijst de
// fantoomband die de oude, te ruime klem toeliet. Maandag krijgt 5 ECHTE periodes (via
// `writeCalDayBlock`, dus `periodCount` staat na het bouwen op 5, veilig binnen i=0..4) plus een
// HANDMATIGE patch: `periodCount` naar 7, en start-slot 6 (`8+6*2=20`) is BYTE-IDENTIEK aan
// duur-slot 0 (`20+0*4=20`) — die bytes dragen al band 0 se eigen duur (600 tienden = 60 min),
// dus band 6 se "start" wordt `mppTimeToMinutes(600)=60` (01:00) zodra hij gelezen wordt. Duur-slot
// 6 (`20+6*4=44`) is fysiek ONGEBRUIKT door de 5 echte periodes (die gebruiken 20/24/28/32/36) —
// een patch daar (450 tienden = 45 min) simuleert restbytes die een geprepareerd bestand daar kan
// achterlaten. Geklemd op 5 (huidig, gefixt): band 6 wordt nooit gelezen, Maandag blijft op 5
// banden. MUTATIEBEWIJS (reviewer-repro, handmatig teruggezet naar 10 en herdraaid): met de oude
// klem van 10 leest de lus i=0..6, Maandag krijgt een 6e band (01:00-01:45) — exact de
// "fantoomband" die deze klem moet voorkomen. ──────────────────────────────────────────────────────
{
  const hoursBlock = buildCalHoursBlock([
    { defaultFlag: 0 }, // zo
    {
      defaultFlag: 0,
      bands: [
        { startMinutes: 360, durationMinutes: 60 }, // i=0: 06:00-07:00 (duur-slot 0 @+20 = 600 tienden)
        { startMinutes: 480, durationMinutes: 60 }, // i=1: 08:00-09:00
        { startMinutes: 600, durationMinutes: 30 }, // i=2: 10:00-10:30
        { startMinutes: 780, durationMinutes: 60 }, // i=3: 13:00-14:00
        { startMinutes: 900, durationMinutes: 60 }, // i=4: 15:00-16:00
      ],
    }, // ma
    { defaultFlag: 0 }, { defaultFlag: 0 }, { defaultFlag: 0 }, { defaultFlag: 0 }, { defaultFlag: 0 },
  ]);
  const hoursView = new DataView(hoursBlock.buffer);
  const MONDAY_OFFSET = 60; // dagIndex 1 = maandag, 60 bytes/dag
  hoursView.setInt16(MONDAY_OFFSET + 2, 7, true); // periodCount: 5 (echt) → 7 (geclaimd, buiten de klem)
  hoursView.setInt16(MONDAY_OFFSET + 44, 450, true); // duur-slot 6 (@20+6*4): fysiek ongebruikt door i=0..4

  const fixedMeta = buildCalFixedMetaBlob([0, 12]);
  const fixedData = buildCalFixedDataRecord(1, -1, -1);
  const varMeta = buildVarMetaBytes([
    { uniqueId: 1, type: 1, offset: 0 },
    { uniqueId: 1, type: 8, offset: 40 },
  ]);
  const namePayload = encodeUnicodeStringAscii('T16-fantoomband');
  const var2Data = new Uint8Array(40 + 4 + hoursBlock.length);
  const var2View = new DataView(var2Data.buffer);
  var2View.setInt32(0, namePayload.length, true);
  var2Data.set(namePayload, 4);
  var2View.setInt32(40, hoursBlock.length, true);
  var2Data.set(hoursBlock, 44);

  const projectProps = new Props(encodePropsEntries([]), 'T16-hostile-dayblock-overlap');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndCal: {
          children: {
            FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData },
            VarMeta: { data: varMeta }, Var2Data: { data: var2Data },
          },
        },
      },
    },
  }));
  const result = readCalendars(cfb, projectProps, null);
  const cal = result.calendarByUniqueId.get(1);
  truthy('T16-veeglijst dagblok-overlap: kalender gematerialiseerd', !!cal);
  if (cal) {
    promoteCalendarsForHourMode(result.calendarByUniqueId, new Set());
    const mondayBands = cal.workTime?.byWeekday[1] ?? [];
    truthy(
      `T16-veeglijst dagblok-overlap: Maandag heeft precies 5 banden, geen fantoomband (${mondayBands.length})`,
      mondayBands.length === 5,
    );
    truthy(
      'T16-veeglijst dagblok-overlap: geen band start om 01:00 (het fantoombandsymptoom)',
      !mondayBands.some((b) => b.start === 60),
    );
  }
}

// ── Extreem exception-aantal: MAX_CALENDAR_EXCEPTIONS klemt, ongeacht hoeveel geldige records de
// buffer daadwerkelijk aanbiedt. ───────────────────────────────────────────────────────────────────
{
  const EXTREME_COUNT = 5000;
  const exceptions = Array.from({ length: EXTREME_COUNT }, (_, i) => ({ fromDay: 10000 + i, toDay: 10000 + i }));
  const hoursBlock = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const })));
  const tail = buildCalExceptionsTail(exceptions);
  new DataView(tail.buffer).setInt16(0, 60000, true); // exceptionCount-claim > wat de buffer fysiek nodig heeft
  const data = concatBytes(hoursBlock, tail);

  const start = Date.now();
  let holidays: Holiday[] = [];
  let threw: string | null = null;
  try {
    holidays = parseExceptions(data, 'T6-hostile-exception-count', newHolidayBudget()).holidays;
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T6-hostile extreem exception-aantal: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T6-hostile extreem exception-aantal: gooit niet (${threw ?? ''})`, threw === null);
  truthy(
    // T3: elk record is nog steeds een LOS 1-dags entry (geen samenvoeging ACROSS records, ook al
    // zijn de dagen 10000..11999 toevallig aaneengesloten — zie `resolveContributions`'s
    // toelichting), dus de telling blijft exact op de record-klem staan.
    `T6-hostile extreem exception-aantal: geklemd op MAX_CALENDAR_EXCEPTIONS (${holidays.length}/${MAX_CALENDAR_EXCEPTIONS}, buffer bood ${EXTREME_COUNT} geldige records)`,
    holidays.length === MAX_CALENDAR_EXCEPTIONS,
  );
}

// ── Extreem bereik (range-lengte): MAX_HOLIDAY_RANGE_DAYS klemt het gematerialiseerde bereik. ──────
{
  const hoursBlock = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const })));
  const tail = buildCalExceptionsTail([{ fromDay: 0, toDay: 65534 }]);
  const data = concatBytes(hoursBlock, tail);
  const holidays = parseExceptions(data, 'T6-hostile-range', newHolidayBudget()).holidays;
  truthy('T6-hostile extreem bereik: precies 1 holiday gematerialiseerd', holidays.length === 1);
  if (holidays.length === 1) {
    const days = Math.round((new Date(holidays[0].endDate).getTime() - new Date(holidays[0].startDate).getTime()) / 86_400_000);
    truthy(
      `T6-hostile extreem bereik: geklemd op MAX_HOLIDAY_RANGE_DAYS (${days + 1}/${MAX_HOLIDAY_RANGE_DAYS} dagen)`,
      days + 1 === MAX_HOLIDAY_RANGE_DAYS,
    );
  }
}

// ── I1-fix-regressie: een 421-byte kalenderdatablob (net boven de 420-byte urensectie, maar te kort
// om de 2-byte exceptionCount op offset 420 veilig te lezen) mag readMPP niet meer laten falen — de
// import moet slagen met 0 holidays voor die kalender. ─────────────────────────────────────────────
{
  const data421 = new Uint8Array(421);
  data421.set(buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const }))), 0);
  const start = Date.now();
  let holidays: Holiday[] = [];
  let threw: string | null = null;
  try {
    holidays = parseExceptions(data421, 'I1-fix-421-bytes', newHolidayBudget()).holidays;
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`I1-fix: 421-byte blob (data.length<422) gooit niet (${threw ?? ''})`, threw === null);
  truthy('I1-fix: 421-byte blob levert 0 holidays (geen 2 bytes beschikbaar voor exceptionCount)', holidays.length === 0);
  truthy(`I1-fix: binnen tijdslimiet (${Date.now() - start}ms < ${TIME_LIMIT_MS}ms)`, Date.now() - start < TIME_LIMIT_MS);
}

// ── T3-GEDRAGSWIJZIGING (was: "recurrenceTypeValue=2 (YEARLY) wordt bewust NIET gematerialiseerd"
// — vóór T3 kende deze module geen enkele recurrente expansie). recurrenceTypeValue=2 = YEARLY
// absoluut; `freq76` (default 256 = 0x0100 little-endian ⇒ byte@76=0, byte@77=1) levert
// dayNumber=byte@77=1, monthNumber=byte@76+1=1 ⇒ "elk jaar 1 januari". fromDay=10000/toDay=10100
// (het RECURRENTIEVENSTER, niet de feestdag zelf) vertaalt naar 2011-05-18..2011-08-26 — geen 1
// januari daarbinnen. `getYearlyAbsoluteDates` (poort van MPXJ se `RecurringData.
// getYearlyAbsoluteDates`) evalueert de WHILE-conditie tegen de cursor VÓÓR de
// `isBefore(startDate) ⇒ +1 jaar`-correctie (zie de toelichting bij die functie in
// mppCalendars.ts) — dat levert hier `2012-01-01` op, net BUITEN het nominale venster. Dit is
// LETTERLIJK MPXJ-gedrag (bevestigd door de poort daadwerkelijk te draaien tegen deze fixture,
// niet aangenomen), geen eigen bug. ─────────────────────────────────────────────────────────────
{
  const hoursBlock = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const })));
  const tail = buildCalExceptionsTail([{ fromDay: 10000, toDay: 10100, recurrenceTypeValue: 2 }]);
  const data = concatBytes(hoursBlock, tail);
  const holidays = parseExceptions(data, 'T6-hostile-recurring', newHolidayBudget()).holidays;
  truthy('T3 YEARLY-recurrentie: precies 1 holiday gematerialiseerd (was 0 vóór T3)', holidays.length === 1);
  truthy(
    `T3 YEARLY-recurrentie: gegenereerde datum === 2012-01-01 (dayNumber=1, monthNumber=1, MPXJ se eigen buiten-het-venster-gedrag)`,
    holidays[0]?.startDate === '2012-01-01' && holidays[0]?.endDate === '2012-01-01',
  );
}

// ── T6-spec-review-fix-regressie: recurrenceTypeValue===1 (DAILY) negeert @76 volledig; type 7
// telt @76 wél mee. T3-GEDRAGSWIJZIGING op de LAATSTE case (was: "type-7 freq76=2 NIET
// gematerialiseerd" — vóór T3 werd elke recurrente uitzondering overgeslagen): `freq76=2` is nu een
// ECHTE recurrente DAILY-uitzondering (frequentie 2, niet geflattend). Met fromDate===toDate
// (20030/20030) genereert `getDailyDates` precies 1 datum: `moreDates(startDate,…)` is waar zodra
// `startDate<=finishDate` (0<=0), dus de datum wordt toegevoegd vóór de eerstvolgende `+2 dagen`-
// stap de lus al beëindigt (`startDate+2>finishDate`). Bevestigd door de poort daadwerkelijk te
// draaien (niet aangenomen). ─────────────────────────────────────────────────────────────────────
{
  const hoursBlock = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const })));
  const tail = buildCalExceptionsTail([
    { fromDay: 20000, toDay: 20000, recurrenceTypeValue: 1, freq76: 0 },
    { fromDay: 20010, toDay: 20010, recurrenceTypeValue: 1, freq76: 256 },
    { fromDay: 20020, toDay: 20020, recurrenceTypeValue: 7, freq76: 1 },
    { fromDay: 20030, toDay: 20030, recurrenceTypeValue: 7, freq76: 2 },
  ]);
  const data = concatBytes(hoursBlock, tail);
  const holidays = parseExceptions(data, 'T6-spec-review-type1-frequency', newHolidayBudget()).holidays;
  truthy('T3: alle 4 uitzonderingen gematerialiseerd (freq76=2 is nu een 1-occurrence recurrente DAILY, was NIET vóór T3)', holidays.length === 4);
  const materializedDays = new Set(holidays.map((h) => h.startDate));
  truthy('T6-spec-review-fix: type-1 freq76=0 gematerialiseerd', materializedDays.has(mppDayToIso(20000)));
  truthy('T6-spec-review-fix: type-1 freq76=256 gematerialiseerd', materializedDays.has(mppDayToIso(20010)));
  truthy('T6-spec-review-fix: type-7 freq76=1 gematerialiseerd', materializedDays.has(mppDayToIso(20020)));
  truthy('T3: type-7 freq76=2 NU OOK gematerialiseerd (1-occurrence recurrente DAILY)', materializedDays.has(mppDayToIso(20030)));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T3 (fase 3.8, MSP-pariteit) — werkende uitzonderingen, invariant, precedentie, vijandige
// occurrences+bereik-fixture (plan-§T3-acceptatie 5)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Lokale 92-byte-uitzonderingsrecord-bouwer met VOLLEDIGE controle over periodCount/banden/
 *  recurrentievelden — `buildCalExceptionsTail` (mppFixtures.ts, gedeelde infra buiten mijn
 *  bestandsscope voor T3) ondersteunt alleen niet-werkende, niet-recurrente uitzonderingen; deze
 *  T3-tests hebben zowel werkende uitzonderingen (banden) als alle vier recurrentietypes nodig
 *  (plan-§T3-byte-offsets: WEEKLY dagen-bitmap `+76`(byte)/frequentie `+78`(SHORT); MONTHLY
 *  absoluut dagnummer `+76`(byte)/frequentie `+78`(byte); YEARLY absoluut dagnummer `+77`(byte)/
 *  maand `+76`(byte)+1; DAILY(type 7) frequentie `+76`(SHORT)). */
interface ExceptionRecordSpec {
  fromDay: number;
  toDay: number;
  occurrences?: number;
  periodCount?: number;
  bands?: { startMinutes: number; durationMinutes: number }[];
  recurrenceTypeValue?: number;
  byte76?: number;
  byte77?: number;
  short76?: number;
  short78?: number;
  byte78?: number;
}
function buildExceptionRecord(spec: ExceptionRecordSpec): Uint8Array {
  const out = new Uint8Array(92);
  const view = new DataView(out.buffer);
  view.setInt16(0, spec.fromDay, true);
  view.setInt16(2, spec.toDay, true);
  view.setInt16(4, spec.occurrences ?? 0, true);
  view.setInt16(14, spec.periodCount ?? 0, true);
  (spec.bands ?? []).forEach((b, i) => {
    view.setInt16(20 + i * 2, b.startMinutes * 10, true);
    view.setInt16(32 + i * 4, b.durationMinutes * 10, true);
  });
  view.setInt16(72, spec.recurrenceTypeValue ?? 1, true);
  if (spec.short76 !== undefined) view.setInt16(76, spec.short76, true);
  else if (spec.byte76 !== undefined) view.setUint8(76, spec.byte76);
  if (spec.byte77 !== undefined) view.setUint8(77, spec.byte77);
  if (spec.short78 !== undefined) view.setInt16(78, spec.short78, true);
  else if (spec.byte78 !== undefined) view.setUint8(78, spec.byte78);
  view.setInt32(88, 0, true);
  return out;
}
function buildExceptionsTailRaw(records: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(4 + records.length * 92);
  new DataView(out.buffer).setInt16(0, records.length, true);
  let pos = 4;
  for (const r of records) {
    out.set(r, pos);
    pos += 92;
  }
  return out;
}
const T3_NO_BANDS_HOURS = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const })));

// ── expandRecurrence rechtstreeks (poort van RecurringData.populateDates): YEARLY-absoluut over 3
// jaar levert precies de 3 verwachte 1-januari-datums. Mutatiebewijs-acceptatie 2 (plan-§T3, hier op
// FUNCTIENIVEAU — de corpusbrede variant met ≥30 bestanden staat in het eindrapport). ─────────────
{
  const dates = expandRecurrence({
    type: 'YEARLY', relative: false,
    startDate: new Date(Date.UTC(2020, 0, 1)), finishDate: new Date(Date.UTC(2022, 11, 31)),
    occurrences: 0, frequency: 1, weeklyDayMask: 0, dayNumber: 1, dayOfWeekValue: 0, monthNumber: 1,
  });
  truthy('T3 expandRecurrence YEARLY: 3 datums (2020/2021/2022, telkens 1 januari)', dates.length === 3);
  truthy(
    'T3 expandRecurrence YEARLY: exacte datums',
    JSON.stringify(dates.map((d) => formatDate(d))) === JSON.stringify(['2020-01-01', '2021-01-01', '2022-01-01']),
  );
}

// ── Werkende uitzondering (periodCount>0) materialiseert als WorkingException met banden, NIET als
// Holiday — plan-§T3 verplichte stap. ──────────────────────────────────────────────────────────
{
  const WORK_DAY = 30000;
  const record = buildExceptionRecord({
    fromDay: WORK_DAY, toDay: WORK_DAY, recurrenceTypeValue: 0, // niet-recurrent
    periodCount: 1, bands: [{ startMinutes: 360, durationMinutes: 360 }], // 06:00-12:00
  });
  const data = concatBytes(T3_NO_BANDS_HOURS, buildExceptionsTailRaw([record]));
  const { holidays, workingExceptions } = parseExceptions(data, 'T3-working-exception', newHolidayBudget());
  truthy('T3 werkende uitzondering: 0 holidays', holidays.length === 0);
  truthy('T3 werkende uitzondering: 1 workingException', workingExceptions.length === 1);
  if (workingExceptions.length === 1) {
    const w = workingExceptions[0];
    truthy('T3 werkende uitzondering: juiste datum', w.startDate === mppDayToIso(WORK_DAY) && w.endDate === mppDayToIso(WORK_DAY));
    truthy('T3 werkende uitzondering: banden 06:00-12:00', JSON.stringify(w.bands) === JSON.stringify([{ start: 360, end: 720 }]));
  }
}

// ── Invariant (Opus-T2-review-eis, LAAG-6/7): dezelfde datum als holiday ÉN als werkende
// uitzondering in het bronbestand → de parser levert er EXACT ÉÉN op (nooit beide, nooit géén). Twee
// NIET-recurrente records met VERSCHILLENDE fromDates maar die BEIDE dezelfde dag claimen (record A
// een 3-daags holiday-bereik, record B — LATER in het bestand — een 1-dags werkende uitzondering
// midden in dat bereik) — MPXJ's eigen fromDate-only-sleutelde precedentiekaart zou dit NIET
// opvangen (de twee fromDates verschillen), maar `resolveContributions`'s per-DAG-autoriteitskaart
// (identiteit via contributie-index, niet waarde-gelijkheid) wel. ──────────────────────────────────
{
  const HOLIDAY_START = 31000;
  const COLLISION_DAY = 31001; // valt binnen het 3-daagse holiday-bereik [31000,31002]
  const holidayRecord = buildExceptionRecord({ fromDay: HOLIDAY_START, toDay: HOLIDAY_START + 2, recurrenceTypeValue: 0 });
  const workingRecord = buildExceptionRecord({
    fromDay: COLLISION_DAY, toDay: COLLISION_DAY, recurrenceTypeValue: 0,
    periodCount: 1, bands: [{ startMinutes: 480, durationMinutes: 240 }],
  });
  const data = concatBytes(T3_NO_BANDS_HOURS, buildExceptionsTailRaw([holidayRecord, workingRecord]));
  const { holidays, workingExceptions } = parseExceptions(data, 'T3-invariant', newHolidayBudget());
  const collisionIso = mppDayToIso(COLLISION_DAY);
  const inHolidays = holidays.filter((h) => h.startDate <= collisionIso && collisionIso <= h.endDate).length;
  const inWorking = workingExceptions.filter((w) => w.startDate <= collisionIso && collisionIso <= w.endDate).length;
  truthy(
    `T3 invariant: botsende datum (${collisionIso}) staat in PRECIES ÉÉN van de twee arrays (holidays=${inHolidays}, workingExceptions=${inWorking})`,
    inHolidays + inWorking === 1,
  );
  // Niet-recurrent+LATER-in-het-bestand wint (record-volgorde bepaalt bij gelijke prioriteit,
  // spiegelt MPXJ's map-put-per-record-volgorde): de werkende uitzondering (record B) wint dus over
  // het holidaybereik (record A) op de botsende dag — het holiday-bereik splitst rond de botsing.
  truthy('T3 invariant: de botsende dag is een WERKENDE uitzondering (later record wint)', inWorking === 1 && inHolidays === 0);
  truthy(
    'T3 invariant: het holiday-bereik is rond de botsing GESPLITST (2 losse 1-dags entries, niet 1 doorlopend bereik)',
    holidays.length === 2 && holidays.every((h) => h.startDate === h.endDate),
  );
}

// ── Precedentie WEEKLY→MONTHLY→YEARLY→DAILY (recurrent), dan niet-recurrent als hoogste laag —
// plan-§T3 verplichte stap + mutatiebewijs-acceptatie 3. Alle vijf lagen claimen DEZELFDE datum
// (2020-01-01, MPP-dag 13150): WEEKLY (alle dagen aangevinkt, dus triviaal inbegrepen), MONTHLY (dag
// 1 van elke maand — 1 januari IS dag 1), YEARLY (1 januari), DAILY (recurrent, frequentie 2,
// venster=exact die ene dag), en tot slot een niet-recurrente werkende uitzondering. ───────────────
{
  const TARGET_DAY = 13150; // 2020-01-01 (woensdag)
  const WINDOW_END = 13515; // 2020-12-31
  const targetIso = mppDayToIso(TARGET_DAY);
  truthy(`T3 precedentie: fixture-aanname TARGET_DAY===2020-01-01 (${targetIso})`, targetIso === '2020-01-01');

  const weekly = buildExceptionRecord({ fromDay: TARGET_DAY, toDay: WINDOW_END, recurrenceTypeValue: 6, byte76: 0x7f, short78: 1 });
  const monthly = buildExceptionRecord({ fromDay: TARGET_DAY, toDay: WINDOW_END, recurrenceTypeValue: 4, byte76: 1, byte78: 1 });
  const yearly = buildExceptionRecord({ fromDay: TARGET_DAY, toDay: WINDOW_END, recurrenceTypeValue: 2, byte76: 0, byte77: 1 });
  const daily = buildExceptionRecord({ fromDay: TARGET_DAY, toDay: TARGET_DAY, recurrenceTypeValue: 7, short76: 2 });
  const nonRecurring = buildExceptionRecord({
    fromDay: TARGET_DAY, toDay: TARGET_DAY, recurrenceTypeValue: 0,
    periodCount: 1, bands: [{ startMinutes: 360, durationMinutes: 360 }],
  });

  // (a) zonder niet-recurrente laag: DAILY (hoogste recurrente precedentie) moet winnen.
  {
    const data = concatBytes(T3_NO_BANDS_HOURS, buildExceptionsTailRaw([weekly, monthly, yearly, daily]));
    const { holidays, workingExceptions } = parseExceptions(data, 'T3-precedence-recurrent-only', newHolidayBudget());
    const holidayHits = holidays.filter((h) => h.startDate <= targetIso && targetIso <= h.endDate);
    const workingHits = workingExceptions.filter((w) => w.startDate <= targetIso && targetIso <= w.endDate);
    truthy(`T3 precedentie (alleen recurrent): precies 1 hit op ${targetIso}`, holidayHits.length + workingHits.length === 1);
    truthy(
      'T3 precedentie (alleen recurrent): DAILY (laatste in RECURRENCE_PRECEDENCE_ORDER) wint over WEEKLY/MONTHLY/YEARLY',
      holidayHits.length === 1 && workingHits.length === 0,
    );
  }

  // (b) MET niet-recurrente laag: die wint over ALLES, ook over DAILY.
  {
    const data = concatBytes(T3_NO_BANDS_HOURS, buildExceptionsTailRaw([weekly, monthly, yearly, daily, nonRecurring]));
    const { holidays, workingExceptions } = parseExceptions(data, 'T3-precedence-with-nonrecurring', newHolidayBudget());
    const holidayHits = holidays.filter((h) => h.startDate <= targetIso && targetIso <= h.endDate);
    const workingHits = workingExceptions.filter((w) => w.startDate <= targetIso && targetIso <= w.endDate);
    truthy(
      `T3 precedentie (met niet-recurrent): niet-recurrent wint — de dag is een WERKENDE uitzondering (${targetIso})`,
      holidayHits.length === 0 && workingHits.length === 1,
    );
    if (workingHits.length === 1) {
      truthy('T3 precedentie: de winnende banden zijn van de niet-recurrente laag (06:00-12:00)', JSON.stringify(workingHits[0].bands) === JSON.stringify([{ start: 360, end: 720 }]));
    }
  }
}

// ── Vijandige invoer (plan-§T3 acceptatie 5): occurrences=65535 + een 165-jaars bereik (1984-2149)
// moet KLEMMEN (MAX_RECURRENCE_DATES), niet hangen of exploderen. WEEKLY/alle-dagen/frequentie=1 is
// het ergste geval (zie MAX_RECURRENCE_DATES se meetcommentaar in limits.ts): ongeklemd zou dit
// ~60.000 datums genereren. ──────────────────────────────────────────────────────────────────────
{
  const record = buildExceptionRecord({
    fromDay: 1, toDay: 60267, occurrences: 65535, recurrenceTypeValue: 6, byte76: 0x7f, short78: 1,
  });
  const data = concatBytes(T3_NO_BANDS_HOURS, buildExceptionsTailRaw([record]));
  const start = Date.now();
  let result: ReturnType<typeof parseExceptions> | null = null;
  let threw: string | null = null;
  try {
    result = parseExceptions(data, 'T3-hostile-occurrences-and-range', newHolidayBudget());
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T3-hostile occurrences=65535+165-jaars-bereik: gooit niet (${threw ?? ''})`, threw === null);
  truthy(`T3-hostile occurrences=65535+165-jaars-bereik: binnen 100ms (${elapsedMs}ms < 100ms)`, elapsedMs < 100);
  // WEEKLY/alle-dagen genereert LETTERLIJK elke dag in het venster ⇒ de overlevende dagen van deze
  // ENE contributie zijn allemaal aaneengesloten en worden dus tot ÉÉN Holiday-bereik samengevoegd
  // (spiegelt het bestaande "MAX_HOLIDAY_RANGE_DAYS klemt de RANGE-lengte"-bewijs hierboven, niet
  // een entry-AANTAL — de klem zit op het aantal GEGENEREERDE datums, niet op de output-vorm).
  truthy('T3-hostile occurrences=65535+165-jaars-bereik: precies 1 (aaneengesloten) holiday-bereik', result?.holidays.length === 1);
  if (result?.holidays.length === 1) {
    const days = Math.round((new Date(result.holidays[0].endDate).getTime() - new Date(result.holidays[0].startDate).getTime()) / 86_400_000) + 1;
    truthy(
      `T3-hostile occurrences=65535+165-jaars-bereik: geklemd op MAX_RECURRENCE_DATES (${days}/${MAX_RECURRENCE_DATES} dagen)`,
      days === MAX_RECURRENCE_DATES,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Opus-review-fixronde (na commit eb074986) — HOOG-1 (oneindige-lus-hangs), MIDDEN-1
// (ongeklemde totale expansie in buildContributions), LAAG-1 (ontbrekende "1-datum-expansie telt
// als niet-recurrent"-regel), LAAG-2 (schrikkeljaar-rollover in getYearlyAbsoluteDates).
// ═══════════════════════════════════════════════════════════════════════════════════════════

// ── HOOG-1 (kritiek): MAX_RECURRENCE_DATES alleen klemt de OUTPUT (dates.length) — een
// generatorlus die NOOIT een datum toevoegt triggert die klem nooit en liep vóór deze fixronde
// ONEINDIG door. Twee reviewer-bevestigde, timeout-bewezen (≥45s vóór de fix) gevallen; beide nu
// gedekt door de onafhankelijke `MAX_RECURRENCE_ITERATIONS`-klem in `calendarRecurrence.ts`.
// Mutatiebewijs (uitgevoerd, niet permanent in dit bestand — een hangende test zou de suite zelf
// blokkeren): met de `iterations`-klem TIJDELIJK uit beide generatoren verwijderd liep dit blok
// vast; met `timeout 3 node …` op de gebundelde check kwam de run niet binnen 3s terug (exitcode
// 124). Hersteld: onderstaande twee gevallen lopen nu binnen milliseconden af. ──────────────────
{
  // (a) MONTHLY-relatief: dagnummer 1, dayOfWeekValue=-2 op een maand die op zaterdag begint (hier:
  // 2021-05-01) laat `ordinalRelativeDay` de cursor TERUGZETTEN in de vorige maand (negatieve
  // dag-offset); bij frequentie 1 komt de daaropvolgende "reset naar eerste-van-de-maand-plus-1-
  // maand"-stap exact weer uit op DEZELFDE maand — de cursor staat dan stil, `dates.length` blijft 0.
  const start = Date.now();
  const dates = expandRecurrence({
    type: 'MONTHLY', relative: true,
    startDate: new Date(Date.UTC(2021, 4, 1)), finishDate: null,
    occurrences: 5, frequency: 1, weeklyDayMask: 0, dayNumber: 1, dayOfWeekValue: -2, monthNumber: 0,
  });
  const elapsedMs = Date.now() - start;
  truthy(
    `HOOG-1a MONTHLY-relatief (stilstaande cursor): binnen 200ms (${elapsedMs}ms) — was ≥3s zonder MAX_RECURRENCE_ITERATIONS (${MAX_RECURRENCE_ITERATIONS} iteraties)`,
    elapsedMs < 200,
  );
  truthy('HOOG-1a: 0 datums (cursor kwam nooit voorbij startDate, correct gedegradeerd i.p.v. gehangen)', dates.length === 0);
}
{
  // (b) WEEKLY met een LEGE dagen-bitmap (`weeklyDayMask=0`) + `finishDate=null`: `moreDates()` valt
  // dan terug op `occurrences`, maar `dates.length` groeit nooit (geen enkele weekdag matcht) — de
  // vergelijking `dates.length<occurrences` blijft voor altijd waar, ongeacht hoe vaak de cursor
  // intussen vooruitschuift.
  const start = Date.now();
  const dates = expandRecurrence({
    type: 'WEEKLY', relative: false,
    startDate: new Date(Date.UTC(2020, 0, 1)), finishDate: null,
    occurrences: 5, frequency: 1, weeklyDayMask: 0, dayNumber: 0, dayOfWeekValue: 0, monthNumber: 0,
  });
  const elapsedMs = Date.now() - start;
  truthy(`HOOG-1b WEEKLY lege bitmap + finishDate=null: binnen 200ms (${elapsedMs}ms) — was ≥3s zonder MAX_RECURRENCE_ITERATIONS`, elapsedMs < 200);
  truthy('HOOG-1b: 0 datums (geen enkele weekdag matcht de lege bitmap)', dates.length === 0);
}

// ── MIDDEN-1: `buildContributions` moet de TOTALE generatie zelf al tegen het budget klemmen, niet
// pas `resolveContributions` daarna — anders alloceert een hostile bestand ALLE datums van ALLE
// records vóórdat er ook maar naar het budget gekeken wordt (gemeten vóór deze fixronde: 2000
// WEEKLY-records ≈ 5,2s/~1GB). Hier: 50 WEEKLY-alle-dagen-records (elk tot MAX_RECURRENCE_DATES
// datums potentieel) tegen een budget van slechts 100. ────────────────────────────────────────────
{
  const raw: RawException[] = Array.from({ length: 50 }, (_, i) => ({
    fromDate: new Date(Date.UTC(2000 + i, 0, 1)),
    toDate: new Date(Date.UTC(2000 + i, 0, 1)),
    periodCount: 0,
    bands: [],
    name: '',
    recurring: {
      type: 'WEEKLY' as const, relative: false,
      startDate: new Date(Date.UTC(2000 + i, 0, 1)), finishDate: new Date(Date.UTC(2000 + i + 100, 0, 1)),
      occurrences: 0, frequency: 1, weeklyDayMask: 0x7f, dayNumber: 0, dayOfWeekValue: 0, monthNumber: 0,
    },
  }));
  const budget = { remaining: 100 };
  const start = Date.now();
  const contributions = buildContributions(raw, budget);
  const elapsedMs = Date.now() - start;
  const totalDates = contributions.reduce((sum, c) => sum + c.ownDates.length, 0);
  truthy(`MIDDEN-1 buildContributions: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`MIDDEN-1 buildContributions: totale ownDates over ALLE contributies geklemd op het budget (${totalDates}/100)`, totalDates <= 100);
  truthy(
    `MIDDEN-1 buildContributions: latere records worden overgeslagen zodra het budget op is (${contributions.length}/50 records droegen bij)`,
    contributions.length < 50,
  );
}

// ── MIDDEN-A (Opus-review-herronde): MAX_RECURRENCE_ITERATIONS was per RECORD goedkoop (100.000 ×
// µs-schaal) maar per BESTAND niet — een gedegenereerd record (0 datums, geen budget-aftrek) kost
// nog steeds de volle klem. Reviewer mat 46,3s voor 2000 gedegenereerde MONTHLY-relatief-records
// (dezelfde stilstaande-cursor-bug als HOOG-1a hierboven, maar dan 2000× in één kalender — het
// aantal dat `MAX_CALENDAR_EXCEPTIONS` toestaat). Fix: `MAX_RECURRENCE_ITERATIONS` geklemd op
// `MAX_RECURRENCE_DATES + 16` i.p.v. een los, groot getal (plus een nevenoptimalisatie: één
// Date-allocatie minder per doorloop in de cursor-reset, zie `getMonthlyRelativeDates`) én de
// monotone-cursorcheck die een stilstaande maandcursor direct afbreekt — hier bewezen met exact
// dat ergste geval: 2000 records, elk gedegenereerd. De test blijft corpusloos en bewaakt de
// bestaande 5s-poort; de cursorcheck hoort de correcte uitkomst ruim daaronder te houden, terwijl
// de oude 100.000-iteratievariant zonder deze check de historische 46,3s-regressie terugbrengt.
//
// MARGE-HERZIENING (M3, Opus-eindreview 2026-08-17, precedent: check-adapters-hours.ts se
// T4-marge-herziening): 2s was ASYMMETRISCH krap. Lokaal herhaald gemeten: 1161-1224 ms — dat is
// maar ~1,65× speling t.o.v. de 2000ms-klem, en deze check draait 6× per `npm run verify`-aanroep
// (T16-veeglijst-correctie: 1× via run.sh se normale RUN_HOLIDAYS-blok + 5× opnieuw in de
// tijdzone-matrix — zie run.sh se `for TZONE in UTC America/New_York Pacific/Midway …` — dus 18
// kansen op gedeelde CI-runners, niet 15: ubuntu/windows/macos ×3 × 6, niet ×5)
// waar een 3-4× tragere machine niet uitzonderlijk is — dat vals-rode risico weegt zwaarder dan de
// mutatiedetectie verzwakken. 5000ms herstelt de marge (~4× t.o.v. de gemeten 1,2s) terwijl de
// regressie die de klem moet vangen (46,3s) er nog altijd ruim >9× overheen zit — de klem blijft
// dus net zo hard bewijs tegen een teruggekeerde stilstaande-cursor-bug, alleen niet meer krap
// tegen een normale, correcte run aan. ───────────────────────────────────────────────────────────
{
  const raw: RawException[] = Array.from({ length: 2000 }, () => ({
    fromDate: new Date(Date.UTC(2021, 4, 1)),
    toDate: new Date(Date.UTC(2021, 4, 1)),
    periodCount: 0,
    bands: [],
    name: '',
    recurring: {
      type: 'MONTHLY' as const, relative: true,
      startDate: new Date(Date.UTC(2021, 4, 1)), finishDate: null,
      occurrences: 5, frequency: 1, weeklyDayMask: 0, dayNumber: 1, dayOfWeekValue: -2, monthNumber: 0,
    },
  }));
  const budget = newHolidayBudget();
  const start = Date.now();
  const contributions = buildContributions(raw, budget);
  const elapsedMs = Date.now() - start;
  const totalDates = contributions.reduce((sum, c) => sum + c.ownDates.length, 0);
  truthy(
    `MIDDEN-A 2000 gedegenereerde MONTHLY-relatief-records: aantoonbaar snel (${elapsedMs}ms, geklemd op 5s) — was 46,3s vóór de iteratie- én monotone-cursorklem`,
    elapsedMs < 5000,
  );
  truthy('MIDDEN-A: 0 datums over alle 2000 records (allemaal gedegenereerd, geen enkele draagt bij)', totalDates === 0);
}

// ── T3-hostile occurrences=65535+165-jaars-bereik (regressie ná MIDDEN-A): de bestaande hostile-
// fixture (hierboven, vóór dit blok) moet met de VERLAAGDE MAX_RECURRENCE_ITERATIONS nog steeds
// correct klemmen — die assertie draait al mee in de suite (regel "T3-hostile occurrences=65535…"),
// hier alleen een expliciete herbevestiging dat de WEEKLY/alle-dagen-productieve lus (die WEL elke
// doorloop een datum toevoegt) niet per ongeluk te vroeg afkapt door de kleinere iteratieklem. ────
{
  const dates = expandRecurrence({
    type: 'WEEKLY', relative: false,
    startDate: new Date(Date.UTC(2020, 0, 1)), finishDate: new Date(Date.UTC(2020, 11, 31)),
    occurrences: 0, frequency: 1, weeklyDayMask: 0x7f, dayNumber: 0, dayOfWeekValue: 0, monthNumber: 0,
  });
  truthy(
    `MIDDEN-A-regressie: een PRODUCTIEVE WEEKLY/alle-dagen-lus (2020, 366 dagen) wordt NIET voortijdig afgekapt door de kleinere MAX_RECURRENCE_ITERATIONS (${dates.length} datums)`,
    dates.length === 366,
  );
}

// ── LAAG-2 (schrikkeljaar-rollover): de `+1-jaar`-correctie in `getYearlyAbsoluteDates` moet het
// AL-GEKLEMDE dagnummer van het BRONjaar herklemmen tegen het GECORRIGEERDE jaar — niet het RAUWE
// gevraagde dagnummer. Reviewer-repro (LAAG-2, eerste ronde): dag 29, maand 2 (februari), startDate
// 2020-06-01 — 2020 is een schrikkeljaar (29 feb bestaat), 2021 niet; de correctie moet naar
// 2021-02-28 klemmen, niet doorrollen naar 2021-03-01. ─────────────────────────────────────────────
{
  const dates = expandRecurrence({
    type: 'YEARLY', relative: false,
    startDate: new Date(Date.UTC(2020, 5, 1)), finishDate: new Date(Date.UTC(2021, 11, 31)),
    occurrences: 0, frequency: 1, weeklyDayMask: 0, dayNumber: 29, dayOfWeekValue: 0, monthNumber: 2,
  });
  truthy(
    `LAAG-2 schrikkeljaar: precies 1 datum, geklemd op 2021-02-28 (kreeg ${dates.map((d) => formatDate(d)).join(',')})`,
    dates.length === 1 && formatDate(dates[0]) === '2021-02-28',
  );
}

// ── LAAG-A (Opus-review-herronde): de EERSTE LAAG-2-fix klemde het RAUWE `dayNumber` opnieuw tegen
// het gecorrigeerde jaar — fout, want `LocalDate.plusYears` (MPXJ/Java) klemt het AL-GEKLEMDE
// dagnummer van het BRONjaar, niet het oorspronkelijk gevraagde getal. Reviewer-repro: dag 29,
// maand 2, startDate 2019-06-01 — 2019 is GEEN schrikkeljaar (29 feb bestaat niet, klemt naar 28),
// dus de cursor start op 2019-02-28. Die datum valt vóór startDate, correctie naar 2020 (WEL een
// schrikkeljaar): met het rauwe dagnummer (29) herklemmen geeft `min(29,29)=29` ⇒ 2020-02-29 — FOUT.
// Met het AL-28-GEWORDEN `useDay` herklemmen geeft `min(28,29)=28` ⇒ 2020-02-28 — CORRECT (het
// bronjaar se eigen klem "kleeft", ook al biedt het doeljaar zelf ruimte voor 29). ─────────────────
{
  const dates = expandRecurrence({
    type: 'YEARLY', relative: false,
    startDate: new Date(Date.UTC(2019, 5, 1)), finishDate: new Date(Date.UTC(2020, 11, 31)),
    occurrences: 0, frequency: 1, weeklyDayMask: 0, dayNumber: 29, dayOfWeekValue: 0, monthNumber: 2,
  });
  truthy(
    `LAAG-A schrikkeljaar (bronjaar-klem kleeft): precies 1 datum, geklemd op 2020-02-28 (kreeg ${dates.map((d) => formatDate(d)).join(',')})`,
    dates.length === 1 && formatDate(dates[0]) === '2020-02-28',
  );
}

// ── LAAG-1 (ontbrekende MPXJ-regel): `ProjectCalendar.populateExpandedExceptions()` classificeert
// een uitzondering op `expanded.size()===1` (expandeert tot PRECIES ÉÉN datum), niet op haar
// recurrentietype — zo'n uitzondering krijgt dan NIET-recurrente (hoogste) prioriteit, ONGEACHT
// welk type ze heeft. Reviewer-repro: een DAILY-frequentie-2-werkende-uitzondering (record 1,
// normaliter de HOOGSTE recurrente precedentie) en een YEARLY-absolute holiday die toevallig tot
// precies 1 datum inklapt (record 2, LATER in het bestand) botsen op dezelfde dag — de YEARLY
// (tot niet-recurrent gepromoveerd, en LATER in het bestand) moet winnen: een holiday, geen
// werkende uitzondering. ─────────────────────────────────────────────────────────────────────────
{
  const dailyRecord: RawException = {
    fromDate: new Date(Date.UTC(2020, 0, 1)), toDate: new Date(Date.UTC(2020, 0, 1)),
    periodCount: 1, bands: [{ start: 480, end: 720 }], name: 'DailyWorking',
    recurring: {
      type: 'DAILY', relative: false,
      startDate: new Date(Date.UTC(2020, 0, 1)), finishDate: new Date(Date.UTC(2020, 0, 1)),
      occurrences: 0, frequency: 2, weeklyDayMask: 0, dayNumber: 0, dayOfWeekValue: 0, monthNumber: 0,
    },
  };
  const yearlyRecord: RawException = {
    fromDate: new Date(Date.UTC(2020, 0, 1)), toDate: new Date(Date.UTC(2020, 0, 1)),
    periodCount: 0, bands: [], name: 'YearlyOnce',
    recurring: {
      type: 'YEARLY', relative: false,
      startDate: new Date(Date.UTC(2020, 0, 1)), finishDate: new Date(Date.UTC(2020, 0, 1)),
      occurrences: 0, frequency: 1, weeklyDayMask: 0, dayNumber: 1, dayOfWeekValue: 0, monthNumber: 1,
    },
  };
  const budget = newHolidayBudget();
  const contributions = buildContributions([dailyRecord, yearlyRecord], budget);
  const { holidays, workingExceptions } = resolveContributions(contributions, budget);
  truthy('LAAG-1: precies 1 hit op 2020-01-01 (holidays+workingExceptions samen)', holidays.length + workingExceptions.length === 1);
  truthy(
    'LAAG-1: YEARLY (tot 1 datum ingeklapt, niet-recurrent-equivalent, LATER in het bestand) wint over DAILY (normaliter hogere recurrente precedentie)',
    holidays.length === 1 && holidays[0]?.name === 'YearlyOnce' && workingExceptions.length === 0,
  );
}

// ── T6-kwaliteitsreview (M8-a): ≥3-niveau-keten — transitieve overerving. calId=1 (basis, ma/wo/vr
// + 1 holiday) → calId=2 (afgeleid van 1, alles default) → calId=3 (afgeleid van 2, alles default).
// calId=3 moet zowel de workDays ALS de holiday van calId=1 dragen — via TWEE overervingsstappen. ───
{
  const MWF_HOURS = buildCalHoursBlock([
    { defaultFlag: 0 }, // zo
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] }, // ma
    { defaultFlag: 0 }, // di
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] }, // wo
    { defaultFlag: 0 }, // do
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] }, // vr
    { defaultFlag: 0 }, // za
  ]);
  const baseData = concatBytes(MWF_HOURS, buildCalExceptionsTail([{ fromDay: 15005, toDay: 15005 }]));
  const allDefault = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 1 as const })));

  const fixedMeta = buildCalFixedMetaBlob([0, 12, 24]);
  const fixedData = concatBytes(
    buildCalFixedDataRecord(1, 1, -1),
    buildCalFixedDataRecord(2, 1, -1),
    buildCalFixedDataRecord(3, 2, -1),
  );
  const OFF1 = 0, OFF2 = 700;
  const varMeta = buildVarMetaBytes([
    { uniqueId: 1, type: 8, offset: OFF1 },
    { uniqueId: 2, type: 8, offset: OFF2 },
  ]);
  const var2Buf = new Uint8Array(1400);
  const v2v = new DataView(var2Buf.buffer);
  v2v.setInt32(OFF1, baseData.length, true);
  var2Buf.set(baseData, OFF1 + 4);
  v2v.setInt32(OFF2, allDefault.length, true);
  var2Buf.set(allDefault, OFF2 + 4);

  const projectProps = new Props(encodePropsEntries([]), 'T6-M8a-chain3');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndCal: {
          children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta }, Var2Data: { data: var2Buf } },
        },
      },
    },
  }));
  const result = readCalendars(cfb, projectProps, null);
  const cal3 = result.calendarByUniqueId.get(3);
  truthy('T6-M8a 3-niveau-keten: calId=3 gevonden', !!cal3);
  if (cal3) {
    truthy('T6-M8a 3-niveau-keten: calId=3 erft workDays TRANSITIEF (ma/wo/vr)', JSON.stringify(cal3.workDays) === JSON.stringify([1, 3, 5]));
    truthy('T6-M8a 3-niveau-keten: calId=3 erft de holiday TRANSITIEF (via calId=2)', cal3.holidays.length === 1);
  }
}

// ── T6-kwaliteitsreview (M8-b): keten DIEPER dan MAX_BASE_CHAIN_DEPTH — het restanten-pad. Een
// keten van MAX_BASE_CHAIN_DEPTH+3 afgeleide kalenders, IN OMGEKEERDE VOLGORDE in FixedData gezet
// (de meest-afhankelijke eerst) zodat elke fixed-point-ronde hoogstens één extra niveau oplost (het
// worst-case-pad — in oplopende volgorde zou de hele keten al in ronde 1 oplossen, wat de klem niet
// zou testen). Kalenders binnen het budget erven correct (ma/wo/vr); kalenders erna vallen terug op
// de project-brede default (ma-vr) — geen crash, geen weggevallen kalenders. ───────────────────────
{
  const DEPTH = MAX_BASE_CHAIN_DEPTH + 3;
  const MWF_HOURS = buildCalHoursBlock([
    { defaultFlag: 0 },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0 },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0 },
    { defaultFlag: 0, bands: [{ startMinutes: 480, durationMinutes: 540 }] },
    { defaultFlag: 0 },
  ]);
  // calId 1 = basis (ma/wo/vr); calId (2..DEPTH+1) = keten, calId k erft van calId (k-1).
  const records: Uint8Array[] = [buildCalFixedDataRecord(1, 1, -1)];
  for (let k = 2; k <= DEPTH + 1; k++) records.push(buildCalFixedDataRecord(k, k - 1, -1));
  // Omgekeerde volgorde voor de AFGELEIDE records (basis blijft vooraan — Fase 1 raakt niet aan
  // volgorde, alleen Fase 2's fixed-point-lus doet dat): [basis, DEPTH+1, DEPTH, ..., 3, 2].
  const orderedRecords = [records[0], ...records.slice(1).reverse()];
  const offsets: number[] = [];
  let off = 0;
  for (const r of orderedRecords) {
    offsets.push(off);
    off += r.length;
  }
  const fixedMeta = buildCalFixedMetaBlob(offsets);
  const fixedData = concatBytes(...orderedRecords);
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 8, offset: 0 }]);
  const var2Buf = new Uint8Array(4 + MWF_HOURS.length);
  new DataView(var2Buf.buffer).setInt32(0, MWF_HOURS.length, true);
  var2Buf.set(MWF_HOURS, 4);

  const projectProps = new Props(encodePropsEntries([]), 'T6-M8b-deep-chain');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndCal: {
          children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta }, Var2Data: { data: var2Buf } },
        },
      },
    },
  }));

  const start = Date.now();
  let result: ReturnType<typeof readCalendars> | null = null;
  let threw: string | null = null;
  try {
    result = readCalendars(cfb, projectProps, null);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T6-M8b keten dieper dan MAX_BASE_CHAIN_DEPTH: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T6-M8b keten dieper dan MAX_BASE_CHAIN_DEPTH: gooit niet (${threw ?? ''})`, threw === null);
  truthy(
    `T6-M8b keten dieper dan MAX_BASE_CHAIN_DEPTH: alle ${DEPTH + 1} kalenders gematerialiseerd (geen crash, geen weggevallen kalenders)`,
    result?.calendarByUniqueId.size === DEPTH + 1,
  );
  if (result) {
    // Binnen budget (diepte MAX_BASE_CHAIN_DEPTH, calId = MAX_BASE_CHAIN_DEPTH+1): correct geketend.
    const withinBudget = result.calendarByUniqueId.get(MAX_BASE_CHAIN_DEPTH + 1);
    truthy(
      `T6-M8b binnen budget (calId=${MAX_BASE_CHAIN_DEPTH + 1}): correct geketend (ma/wo/vr)`,
      !!withinBudget && JSON.stringify(withinBudget.workDays) === JSON.stringify([1, 3, 5]),
    );
    // Voorbij budget (diepte DEPTH, calId = DEPTH+1): restanten-pad, project-default-terugval (ma-vr).
    const beyondBudget = result.calendarByUniqueId.get(DEPTH + 1);
    truthy(
      `T6-M8b voorbij budget (calId=${DEPTH + 1}): restanten-terugval op project-default (ma-vr), NIET de geketende ma/wo/vr`,
      !!beyondBudget && JSON.stringify(beyondBudget.workDays) === JSON.stringify([1, 2, 3, 4, 5]),
    );
  }
}

// ── T6-kwaliteitsreview (C1, kritiek): "veel-kalenders"-hostile-fixture — 1100 nep-basiskalender-
// records (> MAX_CALENDARS=1024) in een FixedData-blok dat via `buildNestedCfb`'s gewone-sectorpad
// (≥4096 bytes) gaat. Bewijst dat de FixedData-iteratie in `readCalendars` afkapt zodra
// `rawByUniqueId.size` de klem raakt — NIET dat 1100 volledige `WorkCalendar`-objecten alloceren. ───
{
  const CAL_COUNT = 1100;
  const records: Uint8Array[] = [];
  for (let uid = 1; uid <= CAL_COUNT; uid++) records.push(buildCalFixedDataRecord(uid, uid, -1)); // elk zijn eigen base (zelf-referentie)
  const offsets = records.map((_, i) => i * 12);
  const fixedMeta = buildCalFixedMetaBlob(offsets);
  const fixedData = concatBytes(...records);
  const varMeta = buildVarMetaBytes([]); // geen namen/uren nodig

  const projectProps = new Props(encodePropsEntries([]), 'T6-C1-many-calendars');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCal: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));

  const start = Date.now();
  let result: ReturnType<typeof readCalendars> | null = null;
  let threw: string | null = null;
  try {
    result = readCalendars(cfb, projectProps, null);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T6-C1 veel-kalenders: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T6-C1 veel-kalenders: gooit niet (${threw ?? ''})`, threw === null);
  truthy(
    `T6-C1 veel-kalenders: geklemd op MAX_CALENDARS (${result?.calendarByUniqueId.size}/${MAX_CALENDARS}, bestand bood ${CAL_COUNT})`,
    result?.calendarByUniqueId.size === MAX_CALENDARS,
  );
}

// ── T6-kwaliteitsreview (C1, kritiek): "keten-met-veel-holidays"-hostile-fixture — één basiskalender
// met 400 holidays + 300 afgeleide kalenders die ELK de volledige 400 erven (300×400=120.000 >
// MAX_TOTAL_HOLIDAY_SLOTS=100.000). Bewijst dat `budgetedInherit` de OVERERVINGSKOPIE afkapt — de
// per-kalender-klem (MAX_CALENDAR_EXCEPTIONS) alléén zou dit NIET vangen, want elke individuele
// kalender (basis: 400 < 2000; elke afgeleide: 0 eigen, alles geërfd) blijft ruim binnen die klem. ──
{
  const HOLIDAY_COUNT = 400;
  const DERIVED_COUNT = 300;
  const hoursBlock = buildCalHoursBlock(Array.from({ length: 7 }, () => ({ defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 540 }] })));
  const exceptions = Array.from({ length: HOLIDAY_COUNT }, (_, i) => ({ fromDay: 10000 + i, toDay: 10000 + i }));
  const baseData = concatBytes(hoursBlock, buildCalExceptionsTail(exceptions));

  const records: Uint8Array[] = [buildCalFixedDataRecord(1, 1, -1)];
  for (let k = 2; k <= DERIVED_COUNT + 1; k++) records.push(buildCalFixedDataRecord(k, 1, -1)); // allemaal direct van de basis
  const offsets = records.map((_, i) => i * 12);
  const fixedMeta = buildCalFixedMetaBlob(offsets);
  const fixedData = concatBytes(...records);
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 8, offset: 0 }]);
  const var2Buf = new Uint8Array(4 + baseData.length);
  new DataView(var2Buf.buffer).setInt32(0, baseData.length, true);
  var2Buf.set(baseData, 4);

  const projectProps = new Props(encodePropsEntries([]), 'T6-C1-many-holidays-chain');
  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndCal: {
          children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta }, Var2Data: { data: var2Buf } },
        },
      },
    },
  }));

  const start = Date.now();
  let result: ReturnType<typeof readCalendars> | null = null;
  let threw: string | null = null;
  try {
    result = readCalendars(cfb, projectProps, null);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T6-C1 keten-met-veel-holidays: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T6-C1 keten-met-veel-holidays: gooit niet (${threw ?? ''})`, threw === null);
  if (result) {
    let totalHolidaySlots = 0;
    for (const cal of result.calendarByUniqueId.values()) totalHolidaySlots += cal.holidays.length;
    // T7-her-review restpunt (c): `<=` ⇒ `===` — de uitkomst is deterministisch exact
    // MAX_TOTAL_HOLIDAY_SLOTS (budget.remaining decrementeert per gematerialiseerde holiday en
    // breekt precies af zodra hij 0 bereikt, zie `budgetedInherit`/`parseExceptions`), geen
    // "hoogstens"-bovengrens die ook een kleinere, per ongeluk te vroeg afgekapte uitkomst zou
    // laten slagen.
    truthy(
      `T6-C1 keten-met-veel-holidays: totale holiday-materialisatie exact op MAX_TOTAL_HOLIDAY_SLOTS (${totalHolidaySlots}/${MAX_TOTAL_HOLIDAY_SLOTS}, ongeklemd zou ${(DERIVED_COUNT + 1) * HOLIDAY_COUNT} zijn)`,
      totalHolidaySlots === MAX_TOTAL_HOLIDAY_SLOTS,
    );
    truthy(
      `T6-C1 keten-met-veel-holidays: alle ${DERIVED_COUNT + 1} kalenders gematerialiseerd (klem raakt alleen de HOLIDAY-inhoud, niet het aantal kalenders)`,
      result.calendarByUniqueId.size === DERIVED_COUNT + 1,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T6 — kalenders: readMPP vs. de MSPDI-ground-truth (structureel) + de I2-correctie
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ Zelfde documentversie-waarschuwing als check-mpp-import.ts se T5-sectie (plan-banner,
// 2026-08-14): kalender-AANTALLEN (13/11/9 in het plan) zijn NIET gezaghebbend voor de `.mpp`'s —
// dus GEEN harde eis op het aantal kalenders, alleen structurele eigenschappen (≥1 kalender; de
// projectkalender bestaat en heeft ≥1 werkdag). `workDays` bleek bij meting WÉL 100% stabiel (alle
// drie bestanden: ma-vr, identiek aan de MSPDI-ground-truth) — dat is een structurele
// kalendereigenschap die het documentversieverschil niet raakt, en is daarom een harde assert.
//
// T6-KWALITEITSREVIEW-FIX (I2, BLOKKEREND — een eerdere versie van deze sectie beweerde onterecht
// "29 echte feestdagen in de MSPDI-ground-truth"): byte-voor-byte onderzoek van alle drie
// `.mpp.xml`-bestanden toont 0 `<Exception>`-elementen — er zijn GEEN echte feestdagen in de ground
// truth. De "29" kwam uit `mspdiReader.ts`'s `parseCalendar`, die start bij `createDefaultCalendar()`
// (die in bouwmodus de NL-feestdagenset genereert) en `calendar.holidays` ALLEEN overschrijft als er
// ≥1 echt `<Exception>`-element gevonden wordt (zie `mppCalendars.ts`'s moduleheader, punt 2, voor
// de volledige toelichting) — bij 0 exceptions bleef die gegenereerde default dus stil staan. Dat is
// GEEN documentgegeven, het is mspdiReader's eigen "geen data ⇒ behoud de default"-gedrag, en die
// eerdere versie verwarde het met een echt ground-truth-feit. De .mpp's zelf dragen — onafhankelijk
// hiervan, byte-voor-byte bevestigd (zie `mppCalendars.ts`'s Fase-1-toelichting) — OOK 0
// uitzonderingen op hun "Standaard"-basiskalender. Beide kanten zijn dus 0; de vergelijking wordt
// daarom een HARDE `=== 0`-assert op de MPP-kant (met de correcte verklaring), i.p.v. een budget
// tegen een besmette XML-telling. De crawl-sectie hieronder blijft de daadwerkelijke bewijslast voor
// "materialiseert deze lezer holidays uberhaupt correct" — dít blok kan dat per-constructie niet
// testen (beide kanten zijn hier toevallig 0, ongeacht of `parseExceptions` correct werkt).
if (existsSync(process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation')) {
  const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
  const corpusFiles = readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.mpp'));
  if (corpusFiles.length === 0) {
    console.log(`OK  mpp-calendars: corpusmap aanwezig maar geen .mpp-bestanden erin (${CORPUS}) — corpuslus overgeslagen`);
  } else {
    installDOMParser();
    // Hash-only (§8, Z20-veeg): zelfde patroon als check-mpp-import.ts/-relations.ts — geen
    // bedrijfsbestandsnamen in de broncode, alleen hun SHA-256-hash (16 hex).
    const corpusHashToFileT6 = new Map<string, string>();
    for (const f of corpusFiles) {
      try {
        corpusHashToFileT6.set(
          createHash('sha256').update(readFileSync(join(CORPUS, f))).digest('hex').slice(0, 16),
          f,
        );
      } catch {
        // Onleesbaar bestand — genegeerd; het bestand komt dan simpelweg niet in de index.
      }
    }
    const EXPECTED_HASHES = ['870d339f60603f71', '787efb968ae72fe4', 'a69fec157074d056'];
    for (const hash of EXPECTED_HASHES) {
      const file = corpusHashToFileT6.get(hash);
      if (!file) {
        console.log(`OK  mpp-calendars: T6 ${hash} niet in dit corpus (${CORPUS}) — overgeslagen`);
        continue;
      }
      const mppPath = join(CORPUS, file);
      const xmlPath = `${mppPath}.xml`;
      if (!existsSync(xmlPath)) {
        checks++;
        diffs.push(`[T6 ${hash}] .mpp aanwezig maar .mpp.xml ontbreekt`);
        continue;
      }

      let mppResult: ReturnType<typeof readMPP>;
      let xmlResult: ReturnType<typeof readMSPDI>;
      try {
        mppResult = readMPP(new Uint8Array(readFileSync(mppPath)));
        xmlResult = readMSPDI(readFileSync(xmlPath, 'utf-8'));
      } catch (err) {
        checks++;
        diffs.push(`[T6 ${hash}] readMPP/readMSPDI gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      const mppCalCount = 1 + (mppResult.resourceCalendars?.length ?? 0);
      truthy(`[T6 ${hash}] ≥1 kalender gelezen (projectkalender + resourceCalendars)`, mppCalCount >= 1);
      truthy(`[T6 ${hash}] projectkalender heeft ≥1 werkdag`, mppResult.calendar.workDays.length >= 1);
      truthy(
        `[T6 ${hash}] projectkalender workDays === MSPDI-ground-truth workDays`,
        JSON.stringify([...mppResult.calendar.workDays].sort((a, b) => a - b)) === JSON.stringify([...xmlResult.calendar.workDays].sort((a, b) => a - b)),
      );
      // I2-fix: hard `=== 0` i.p.v. een budget tegen de besmette XML-"29" — zie de sectietoelichting.
      truthy(
        `[T6 ${hash}] projectkalender heeft 0 holidays (.mpp draagt zelf geen enkele uitzondering, byte-voor-byte bevestigd — zie de sectietoelichting)`,
        mppResult.calendar.holidays.length === 0,
      );

      console.log(
        `   . [T6 ${hash}] kalenders=${mppCalCount} (aantal NIET gezaghebbend, zie moduleheader) `
        + `projectkalender="${mppResult.calendar.name}" workDays=${JSON.stringify(mppResult.calendar.workDays)} holidays=${mppResult.calendar.holidays.length}:`,
      );
    }
  }
} else {
  console.log('OK  mpp-calendars: corpus niet aanwezig (OPS_MPP_CORPUS) — corpuslus overgeslagen');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T6-crawl — breed corpus (49 `.mpp`, submappen MSP2016_OzBuild/MSP2021_OzBuild): holiday-
// materialisatie ONAFHANKELIJK van de (toevallig holiday-arme) drie ground-truth-bestanden bewezen
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Zie de I2-toelichting hierboven: de T6-corpussectie kan een regressie in `parseExceptions` NOOIT
// vangen (beide kanten zijn daar 0, per bronbestand). Dit bredere corpus draagt WEL feestdag-
// uitzonderingen ("Easter <jaar>") en is de daadwerkelijke tegenhanger.
//
// T6-KWALITEITSREVIEW (M6): gebruikt nu `openMppProject` (mppReader.ts) i.p.v. een handmatige kopie
// van de CfbFile/assertReadable/detectApplicationVersion/Props-preambule — voorheen hield deze
// sectie zo'n kopie apart aan, met het risico dat de twee stilzwijgend uit elkaar liepen.
{
  const CRAWL = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-mpp';
  if (!existsSync(CRAWL)) {
    console.log('OK  mpp-calendars: T6-crawl niet aanwezig (OPS_MPP_CRAWL) — crawlsectie overgeslagen');
  } else {
    function listMppFilesRecursive(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listMppFilesRecursive(full));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
      }
      return out;
    }
    const crawlFiles = listMppFilesRecursive(CRAWL);
    if (crawlFiles.length === 0) {
      console.log(`OK  mpp-calendars: T6-crawl-map aanwezig maar geen .mpp-bestanden erin (${CRAWL}) — crawlsectie overgeslagen`);
    } else {
      /** Dubbeltelvrije som van EIGEN holidays over ALLE kalenders (project + resource) van één
       *  bestand — `openMppProject` (mppReader.ts, M6) levert de container-/Props-preambule
       *  drift-vrij; `readCalendars` rechtstreeks aanroepen (i.p.v. `readMPP`) is nodig omdat
       *  `ownHolidayCountByUniqueId` (T6-slot) niet in `ImportResult` zit. T3: telt ALLEEN
       *  `holidays` (ongewijzigde semantiek — zie `ownHolidayCountByUniqueId`'s eigen toelichting in
       *  mppCalendars.ts); `workingExceptionFileTotal` hieronder is de T3-tegenhanger voor
       *  `workingExceptions` (géén dubbeltel-vrije EIGEN-telling nodig, want die array wordt niet via
       *  overerving gedeeld op eenzelfde manier bewaakt — hier volstaat "heeft dit bestand er ≥1"). */
      function ownHolidayTotal(bytes: Uint8Array): number {
        const { cfb, projectProps, applicationVersion } = openMppProject(bytes);
        const calResult = readCalendars(cfb, projectProps, applicationVersion);
        let total = 0;
        for (const count of calResult.ownHolidayCountByUniqueId.values()) total += count;
        return total;
      }

      /** T3: heeft minstens één kalender (project of resource) van dit bestand een
       *  `workingExceptions`-entry? Plan-§T3-acceptatiecriterium 4 ("de 10 bestanden met werkende
       *  uitzonderingen") als PERMANENTE regressievloer, niet alleen een eenmalige meting. */
      function hasWorkingExceptions(bytes: Uint8Array): boolean {
        const { cfb, projectProps, applicationVersion } = openMppProject(bytes);
        const calResult = readCalendars(cfb, projectProps, applicationVersion);
        for (const cal of calResult.calendarByUniqueId.values()) {
          if ((cal.workingExceptions?.length ?? 0) > 0) return true;
        }
        return false;
      }

      // Basislijn vóór T3 (2026-08-14, dit corpus, 49 bestanden): 208 EIGEN holidays — recurrente
      // uitzonderingen (Easter e.d.) werden toen nog NIET geëxpandeerd. NA T3 (2026-08-15, ONGEWIJZIGD
      // corpus): 2968 EIGEN holidays (14× — de recurrente expansie is de "grootste enkele winst" uit
      // het plan). `>=` (geen `===`): een toekomstige verbetering mag dit laten STIJGEN zonder de
      // poort te breken; een REGRESSIE — óók één die uitsluitend een niet-projectkalender raakt —
      // laat het zakken en faalt hier.
      const CRAWL_HOLIDAY_BASELINE = 2968;
      // T3: gemeten 2026-08-15 — dit specifieke 49-bestanden-corpus (crawl-mpp, MSP2016/2021 OzBuild-
      // workshopmateriaal) draagt 0 werkende uitzonderingen (`periodCount>0`); de "10 bestanden" uit
      // plan-§1.2.2 slaat op het BREDERE testdata-crawl-corpus (o.a. de MPXJ-junit-testset, die
      // specifiek voor deze functie gebouwde fixtures bevat). Geen `>=1`-regressievloer HIER dus —
      // die zou een no-op zijn op deze deelverzameling. De permanente regressiebescherming voor de
      // werkende-uitzondering-FUNCTIE zelf zit in de synthetische T3-tests hierboven
      // (T3-working-exception, T3-precedentie); acceptatiecriterium 4 (plan-§T3) is apart, ad-hoc
      // tegen het bredere corpus geverifieerd — zie het implementatierapport.
      let totalHolidays = 0;
      let filesWithHolidays = 0;
      let filesWithWorkingExceptions = 0;
      let readFailures = 0;
      for (const file of crawlFiles) {
        try {
          const bytes = new Uint8Array(readFileSync(file));
          const count = ownHolidayTotal(bytes);
          totalHolidays += count;
          if (count > 0) filesWithHolidays++;
          if (hasWorkingExceptions(bytes)) filesWithWorkingExceptions++;
        } catch (err) {
          readFailures++;
          checks++;
          diffs.push(`[T6-crawl] readCalendars gooide onverwacht op ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      truthy(`[T6-crawl] geen leesfouten over ${crawlFiles.length} bestanden`, readFailures === 0);
      truthy(`[T6-crawl] totaal aantal gematerialiseerde holidays > 0 (${totalHolidays})`, totalHolidays > 0);
      truthy(
        `[T6-crawl] holiday-telling (projectkalender + resourceCalendars, dubbeltelvrij) op/boven de gemeten basislijn (${totalHolidays}/${CRAWL_HOLIDAY_BASELINE})`,
        totalHolidays >= CRAWL_HOLIDAY_BASELINE,
      );
      console.log(
        `   . [T6-crawl] ${crawlFiles.length} bestanden, ${filesWithHolidays} met ≥1 eigen holiday (over alle kalenders), `
        + `totaal ${totalHolidays} holidays (basislijn ${CRAWL_HOLIDAY_BASELINE}); ${filesWithWorkingExceptions} met ≥1 werkende uitzondering `
        + '(dit corpus draagt er geen — zie de toelichting bij CRAWL_HOLIDAY_BASELINE)',
      );

      // ── ETAPPE 1.5 — DRIFT-PIN, GEEN signaal-regressiepoort (uurmodus-review-correctie, R1):
      // vergelijkt de FULL-PIPELINE hour-kalendertelling (via `readMPP`, inclusief het taak-(c)-
      // signaal) tegen een A/B-ALLEEN-baseline (`promoteCalendarsForHourMode` met een LEGE
      // signaal-set — exact het gedrag van vóór etappe 1.5). BEVINDING (2026-08-15, dit corpus): de
      // twee tellingen zijn IDENTIEK (321/345 op beide manieren) — niet toevallig gelijk, maar
      // STRUCTUREEL gegarandeerd gelijk op dit corpus: mutatietest bevestigt dat de 24 kalenders die
      // NIET via (a)/(b) deviëren NOOIT de effectieve kalender van een taak zijn (0 van 24, over alle
      // 49 bestanden — geverifieerd door voor elke niet-deviërende kalender-UID te controleren of
      // enige `Task.calendarId`/de projectkalender ernaar verwijst). Dit corpus kan het taak-signaal
      // op kalenderpromotie-NIVEAU dus NIET oefenen — elke taak zit al op een kalender die sowieso
      // via (a)/(b) promoveert (MS Project's standaard-"Standard"-kalender met een lunchpauze-
      // splitsing, discriminator (a), bestond al sinds T6). EEN EERDERE VERSIE van dit commentaar
      // beweerde dat een kapotte taak-signaal-berekening (bv. de scalar-vóór-promotie-`hoursPerDay`
      // per ongeluk vervangen door de ná-promotie-waarde) deze telling zou laten STIJGEN en hier zou
      // falen — DAT IS ONWAAR gebleken: zo'n mutatie raakt uitsluitend `isSubDayMinutes`/
      // `hasNonAnchorTime`-uitkomsten op kalenders die al (a)/(b)-gepromoveerd zijn (`promoteHour
      // Calendar`'s `deviates || signaled`-disjunctie kortsluit al op `deviates`, dus de
      // signaalwaarde beslist daar niets meer voor de PROMOTIE-uitkomst), dus deze telling blijft
      // 321/345 ONGEACHT die mutatie. Wat deze poort WEL vangt: een REGRESSIE in de a/b-discriminator
      // zelf, of een structurele wijziging in
      // welke kalenders taken feitelijk gebruiken (bv. als een toekomstige crawl-corpusaanvulling wél
      // een niet-deviërende, taak-gerefereerde kalender bevat — dan zou deze `<=` alsnog zinvol
      // worden). Zie `check-mpp-import.ts`'s uurmodus-sectie voor de bijbehorende taak-tellingpin, die
      // dezelfde beperking deelt. `<=`: een bewust ruimere signaal-definitie mag dit laten STIJGEN.
      let fullPipelineHourCalendars = 0;
      let abOnlyHourCalendars = 0;
      let totalCalendarsSeen = 0;
      let leakReadFailures = 0;
      for (const file of crawlFiles) {
        try {
          const bytes = new Uint8Array(readFileSync(file));
          const result = readMPP(bytes);
          const allCals = [result.calendar, ...(result.resourceCalendars ?? [])];
          fullPipelineHourCalendars += allCals.filter((c) => !!c.workTime).length;

          const { cfb, projectProps, applicationVersion } = openMppProject(bytes);
          const calResult = readCalendars(cfb, projectProps, applicationVersion);
          totalCalendarsSeen += calResult.calendarByUniqueId.size;
          abOnlyHourCalendars += promoteCalendarsForHourMode(calResult.calendarByUniqueId, new Set()).size;
        } catch (err) {
          leakReadFailures++;
          checks++;
          diffs.push(`[T6-crawl uurmodus-lek] mislukte lezing op ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      truthy('[T6-crawl uurmodus-lek] geen leesfouten', leakReadFailures === 0);
      truthy(
        `[T6-crawl uurmodus-lek] taak-signaal promoveert GEEN extra kalenders t.o.v. discriminator (a)/(b) alleen (full=${fullPipelineHourCalendars} vs a/b-alleen=${abOnlyHourCalendars}, van ${totalCalendarsSeen} kalenders totaal)`,
        fullPipelineHourCalendars <= abOnlyHourCalendars,
      );
    }
  }
}

// ── Uitslag ────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  mpp-calendars: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mpp-calendars: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
