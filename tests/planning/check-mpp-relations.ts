// MPP-relaties/resources/assignments (fase 3.8 etappe 1, T7): TBkndCons/TBkndRsc/TBkndAssn-lezers
// (`src/services/mpp/mppReader.ts`'s `readRelations`/`readResources`/`readAssignments`) — een
// synthetische end-to-end-fixture, hostile varianten, en de corpus-/crawl-secties.
//
// Naar het patroon van `check-mpp-calendars.ts` (T6, zelfde bestandsstructuur): dit bestand is
// EXCLUSIEF T7-territorium — `check-mpp-import.ts` blijft T3-T5 (CFB-laag, containerlaag, taken),
// `check-mpp-calendars.ts` blijft T6 (kalenders).
//
// Twee lagen dekking (zelfde structuur als de andere mpp-checks):
//  1. SYNTHETISCHE FIXTURES — draaien ALTIJD, ook zonder corpus.
//  2. CORPUS-/CRAWL-GEDREVEN checks — optioneel, netjes overgeslagen zonder de map (OPS_MPP_CORPUS/
//     OPS_MPP_CRAWL), GEEN in-repo fixture (echte bedrijfsbestanden resp. mogelijk auteursrechtelijk
//     beschermd cursusmateriaal).
//
// ⚠️ ZELFDE DOCUMENTVERSIE-WAARSCHUWING als check-mpp-import.ts se T5-sectie en check-mpp-
// calendars.ts se T6-sectie (plan-banner, 2026-08-14): de drie `.mpp.xml`-ground-truths zijn een
// ANDERE documentrevisie dan de bijbehorende `.mpp`'s. De link-/resource-/assignmentaantallen in
// het plan (104/111/225 links, 9/7/5 resources, 51/146/221 assignments) zijn daardoor NIET
// gezaghebbend voor de `.mpp`-inhoud — deze sectie gebruikt daarom NAAM-GEMATCHTE vergelijking
// (voorganger+opvolger-naam voor relaties, taak+resource-naam voor assignments, resourcenaam voor
// resources) en legt GEMETEN basislijnen vast, exact zoals de T5-sectie van check-mpp-import.ts dat
// al doet voor taken.
//
// ⚠️ DEKKINGSVOORBEHOUD (T7-spec-review, B1): het corpus draagt UITSLUITEND FINISH_START-relaties
// met lag=0 (gemeten: 464/464 relaties over alle drie bestanden) en assignment-`unitsPerDay` ∈
// {0, 1} (nooit een fractie zoals 0.5) — de corpussectie hieronder bewijst dus alleen dat de
// FS/lag-0-/volle-of-lege-units-paden kloppen tegen de MSPDI-ground-truth. De FF/SF/SS-typetabel,
// de WORKTIME-met-echte-dagenwaarde/ELAPSED/percent-lag-takken (`mppLagToSequenceFields`) en een
// fractionele assignment-unit (bv. 50%) worden UITSLUITEND door de synthetische I4/T7-fixture
// hieronder gedekt. Waar eerdere commentaren dit "HARD (100% gemeten)" noemden, was dat feitelijk
// correct voor wat het corpus daadwerkelijk aanbiedt, maar suggereerde ten onrechte bredere dekking
// — de labels hieronder zijn daarom preciezer: "corpus dekt FS/lag-0" resp. "synthetisch gedekt".
//
// ⚠️ BEWUSTE MPXJ-DIVERGENTIE (T7-spec-review, B3) — resource-uniqueID 0: MPXJ's eigen
// `createResourceMap` (MPP14Reader.java) slaat het TE KORTE plaatshouderrecord voor uniqueID 0 over
// (`data.length < fieldMap.getMaxFixedDataSize(0)`-guard — NIET geport, zie de taakvariant se
// toelichting bij `collectValidTaskIndices` in mppReader.ts), dus MPXJ's eigen resourcetelling voor
// dit corpus zou 8/6/4 zijn. MS Project schrijft dat record echter WÉL naar zijn eigen MSPDI-export
// (als "Niet toegekend", type Work, maxUnits 1) — deze lezer kiest bewust voor COUNT-PARITEIT MET
// readMSPDI (9/7/5) i.p.v. MPXJ-pariteit (8/6/4): zie `mppReader.ts`'s `readResourcesUnsafe` voor de
// vaste vorm (naam uit `ImportLabels.unassignedResource`, default `'Unassigned'`; type LABOR;
// maxUnits 1) die deze lezer aan dat record geeft i.p.v. de rauwe (onbetrouwbare) veldwaarden.
//
// Draait via run.sh (binnen het RUN_HOLIDAYS-blok) en draait daarna ook mee in de tijdzone-matrix —
// bewust geen tijdzone-gevoelige logica hierin (datums alleen als strings vergelijken).
//
// DEKKINGSKAART (T9 — dit bestand is exclusief T7-territorium):
//   - readRelations/readResources/readAssignments end-to-end + hostile
//     varianten (typetabel, WORKTIME/ELAPSED/percent-lag, fractionele units)  → SYNTHETISCH, altijd
//   - relaties/resources/assignments vs. MSPDI-ground-truth (naam-gematcht,
//     FS/lag-0-pad, resourcetype/maxUnits, assignment-units)                  → CORPUS (3 paren —
//     zie het DEKKINGSVOORBEHOUD hierboven voor wat het corpus wél/niet dekt)
//   - relatie-/resource-/assignmentaantallen + resourcetype LABOR/MATERIAL,
//     SAMEN over het hele corpus                                             → CRAWL (49 bestanden)
// Corpus/crawl-afwezig ⇒ nette OK-skip, beïnvloedt nooit de einduitslag. Zie check-mpp-import.ts
// (taken/container/CFB, plus de T9-taken-crawl) en check-mpp-calendars.ts (kalenders) voor de
// andere domeinen.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CfbFile } from '@/services/mpp/cfb';
import { readMPP } from '@/services/mpp/mppReader';
import { readRelations, readResources, readAssignments, type ReadResourcesResult } from '@/services/mpp/mppEntities';
import type { CalendarReadResult } from '@/services/mpp/mppCalendars';
import { DEFAULT_RESOURCE_FIELDS, DEFAULT_ASSIGNMENT_FIELDS, type FieldMapTable } from '@/services/mpp/fieldMap14';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { installDOMParser } from './xmldom-shim';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import {
  buildNestedCfb, encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry,
  concatBytes, buildVarMetaBytes, type CfbTreeNode,
} from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
// T7-kwaliteitsreview (M7): opgesplitst per domein i.p.v. één opgeteld "extra gematchte-paar-
// tellingen"-getal — dat mengde relatie-/resource-/assignment-tellingen van verschillende aard
// (type-ok/lag-ok/naam-ok/maxUnits-ok/units-ok) tot een getal zonder betekenisvolle interpretatie.
let softChecksRelationsTotal = 0;
let softChecksResourcesTotal = 0;
let softChecksAssignmentsTotal = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

const TIME_LIMIT_MS = 2000;

// ── Lokale byte-encoders (bewust NIET gedeeld met check-mpp-import.ts/check-mpp-calendars.ts se
// eigen kopieën — zelfde conventie als check-mpp-calendars.ts se moduleheader-toelichting: elk
// mpp-checkbestand bouwt zijn eigen, tot het strikt noodzakelijke geminimaliseerde fixture-set). ──
const FIXED_META_MAGIC = 0xfadfadba;
const PASSWORD_FLAG_KEY = 893386752;
const PROJECT_START_DATE_KEY = 37748738;
const PROJECT_FINISH_DATE_KEY = 37748739;
const MINUTES_PER_DAY_KEY = 37748765;
const TITLE_KEY = 37748744;

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

// ── Taak-fixturebouwers (minimaal — spiegelt check-mpp-calendars.ts se eigen taak-fixture, alleen
// om uniqueID's te dragen waar de relaties/assignments naar kunnen verwijzen; geen hiërarchie/WBS/
// milestones nodig, zie check-mpp-import.ts voor de volledige taak-fixture-dekking). ────────────────
function buildTaskFixedDataRecord(opts: { uniqueId: number; id: number; startDays: number; finishDays: number }): Uint8Array {
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
  view.setInt32(118, -1, true); // calendarUniqueId: geen taak-kalender-override
  return out;
}
function buildTaskFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
  const out = new Uint8Array(47);
  new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
  return out;
}
function buildTaskFixedMetaBlob(records: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(16 + records.length * 47);
  const view = new DataView(out.buffer);
  view.setUint32(0, FIXED_META_MAGIC, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 47));
  return out;
}

// ── TBkndCons-fixturebouwers (relaties) — FixedMeta itemSize=10, FixedData itemSize=20
// (`FixedData.withItemSizeOverride`, ConstraintFactory.java). Onze fixtures se CompObj-
// applicationName matcht `detectApplicationVersion`'s patroon nooit ⇒ `applicationVersion===null`
// ⇒ `project15===false` (mppReader.ts se `readRelationsUnsafe`) ⇒ durationUnitsOffset=14,
// durationOffset=16 — de layout die deze bouwer hieronder gebruikt. ──────────────────────────────
function buildConsFixedMetaBlob(offsets: number[], itemCountClaim = offsets.length, magic = FIXED_META_MAGIC): Uint8Array {
  const out = new Uint8Array(16 + offsets.length * 10);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setInt32(8, itemCountClaim, true); // C1-stijl: mag liegen, getItemCount() klemt op de echte blokgrootte
  offsets.forEach((offsetIntoFixedData, i) => {
    view.setInt16(16 + i * 10, 0, true); // deleted-vlag SHORT: 0 = niet verwijderd
    view.setInt32(16 + i * 10 + 4, offsetIntoFixedData, true);
  });
  return out;
}
function buildConsFixedDataRecord(opts: {
  uniqueId: number; predecessorTaskUid: number; successorTaskUid: number;
  relationType: number; durationUnits: number; duration: number;
}): Uint8Array {
  const out = new Uint8Array(20);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true);
  view.setInt32(4, opts.predecessorTaskUid, true);
  view.setInt32(8, opts.successorTaskUid, true);
  view.setInt16(12, opts.relationType, true);
  view.setInt16(14, opts.durationUnits, true); // niet-project15-layout: durationUnits@14
  view.setInt32(16, opts.duration, true); // niet-project15-layout: duration@16
  return out;
}

// ── TBkndRsc-fixturebouwers (resources) — FixedMeta itemSize=37 (typebit @9/0x02, want
// applicationVersion===null in deze fixtures ⇒ de ≤2010-layout, `resourceTypeBitFlag`). FixedData
// via `FixedData.fromMeta` (offset+auto-grootte uit de meta, net als de echte lezer). ─────────────
const RSC_RECORD_SIZE = 60; // ruim boven maxUnitsOffset(44)+8=52
function buildRscFixedMetaRecord(opts: { offsetIntoFixedData: number; isWork: boolean }): Uint8Array {
  const out = new Uint8Array(37);
  const view = new DataView(out.buffer);
  view.setInt32(4, opts.offsetIntoFixedData, true);
  if (opts.isWork) out[9] = 0x02; // PROJECT2010_RESOURCE_META_DATA_BIT_FLAGS: offset 9, mask 0x02
  return out;
}
function buildRscFixedMetaBlob(records: Uint8Array[], magic = FIXED_META_MAGIC): Uint8Array {
  const out = new Uint8Array(16 + records.length * 37);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 37));
  return out;
}
function buildRscFixedDataRecord(opts: { uniqueId: number; maxUnitsRaw: number }): Uint8Array {
  const out = new Uint8Array(RSC_RECORD_SIZE);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true); // uniqueIdOffset=0 — createResourceMap-equivalent leest de eerste 2 bytes als SHORT
  view.setFloat64(44, opts.maxUnitsRaw, true); // MAX_UNITS: DataType.UNITS, 8-byte double @44
  return out;
}

// ── TBkndRsc/Fixed2Meta-fixturebouwers (T7-spec-review, B7) — itemSize 50 (`FixedMeta.
// withHeuristicItemSize`'s kandidaten zijn [50, 51]; met N records van 50 bytes elk kiest de
// "available/testSize === otherCount"-tak van de heuristiek 50, want dat matcht exact — zie
// `mppReader.ts`'s `RESOURCE_FIXED2_META_ITEM_SIZES`). Alleen byte[8] doet ertoe (de COST-bit,
// mask 0x10); de rest van het record blijft nul. ────────────────────────────────────────────────
function buildRsc2MetaRecord(opts: { isCost: boolean }): Uint8Array {
  const out = new Uint8Array(50);
  if (opts.isCost) out[8] = 0x10;
  return out;
}
function buildRsc2MetaBlob(records: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(16 + records.length * 50);
  const view = new DataView(out.buffer);
  view.setUint32(0, FIXED_META_MAGIC, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 50));
  return out;
}

// ── TBkndAssn-fixturebouwers (assignments) — FixedMeta itemSize=34 (deleted-vlag: BYTE @0, niet
// SHORT), FixedData via `FixedData.withoutMeta(110, ...)` — contigue 110-byte blokken, dus de
// meta se offset MOET exact `index*110` zijn om via `getIndexFromOffset` gevonden te worden. ──────
const ASSN_ITEM_SIZE = 110;
function buildAssnFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
  const out = new Uint8Array(34);
  out[0] = 0; // deleted-vlag: BYTE, 0 = niet verwijderd
  new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
  return out;
}
function buildAssnFixedMetaBlob(records: Uint8Array[], magic = FIXED_META_MAGIC): Uint8Array {
  const out = new Uint8Array(16 + records.length * 34);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 34));
  return out;
}
function buildAssnFixedDataItem(opts: { uniqueId: number; taskUid: number; resourceUid: number; unitsRaw: number }): Uint8Array {
  const out = new Uint8Array(ASSN_ITEM_SIZE);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true);
  view.setInt32(4, opts.taskUid, true);
  view.setInt32(8, opts.resourceUid, true);
  view.setFloat64(46, opts.unitsRaw, true); // ASSIGNMENT_UNITS: DataType.UNITS, 8-byte double @46
  return out;
}

const emptyCalResult: CalendarReadResult = {
  calendarByUniqueId: new Map(),
  projectCalendar: createDefaultCalendar(),
  resourceCalendars: [],
  resourceCalendarUniqueIdByResourceUniqueId: new Map(),
  ownHolidayCountByUniqueId: new Map(),
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// I4/T7 — end-to-end readMPP: klein netwerk — 3 taken (A→B→C), 2 relaties MET LAG (één WORKTIME-
// dagenlag, één ELAPSED-dagenlag), 2 resources (waarvan één uniqueID 0), 2 assignments.
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  const dummy = buildTaskFixedMetaRecord(0);
  const metaA = buildTaskFixedMetaRecord(3 * 130);
  const metaB = buildTaskFixedMetaRecord(4 * 130);
  const metaC = buildTaskFixedMetaRecord(5 * 130);
  const taskFixedMetaBlob = buildTaskFixedMetaBlob([dummy, dummy, dummy, metaA, metaB, metaC]);

  const dataA = buildTaskFixedDataRecord({ uniqueId: 10, id: 1, startDays: 15000, finishDays: 15001 });
  const dataB = buildTaskFixedDataRecord({ uniqueId: 11, id: 2, startDays: 15002, finishDays: 15003 });
  const dataC = buildTaskFixedDataRecord({ uniqueId: 12, id: 3, startDays: 15004, finishDays: 15005 });
  // Index 0-2 blijven leeg (FIRST_TASK_INDEX=3 in mppReader.ts se readTasks skipt ze).
  const taskFixedDataBlob = new Uint8Array(6 * 130);
  taskFixedDataBlob.set(dataA, 3 * 130);
  taskFixedDataBlob.set(dataB, 4 * 130);
  taskFixedDataBlob.set(dataC, 5 * 130);

  const taskVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 10, type: 14, offset: 0 },
    { uniqueId: 11, type: 14, offset: 20 },
    { uniqueId: 12, type: 14, offset: 40 },
  ]);
  const taskVar2DataBuf = new Uint8Array(60);
  const tv2 = new DataView(taskVar2DataBuf.buffer);
  const writeTaskName = (offset: number, s: string) => {
    const payload = encodeUnicodeStringAscii(s);
    tv2.setInt32(offset, payload.length, true);
    taskVar2DataBuf.set(payload, offset + 4);
  };
  writeTaskName(0, 'A');
  writeTaskName(20, 'B');
  writeTaskName(40, 'C');

  // ── Relaties: A→B (FS, +2 werkdagen lag @8u/dag = 9600 tienden-van-minuut, code 7='days'),
  // B→C (SS, +1 kalenderdag ELAPSED lag = 14400 tienden-van-minuut, code 8='elapsedDays'). ────────
  const consFixedMetaBlob = buildConsFixedMetaBlob([0, 20]);
  const consFixedDataBlob = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 100, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 7, duration: 9600 }),
    buildConsFixedDataRecord({ uniqueId: 101, predecessorTaskUid: 11, successorTaskUid: 12, relationType: 3, durationUnits: 8, duration: 14400 }),
  );

  // ── Resources: uid=0 draagt BEWUST misleidende ruwe velden (naam "Onbenoemd", WORK-bit niet
  // gezet, geen MAX_UNITS-data) — dit BEWIJST dat `readResourcesUnsafe` deze rauwe waarden voor
  // uniqueID 0 NEGEERT en de vaste sentinelvorm dwingt (T7-spec-review, B3: naam uit
  // `ImportLabels.unassignedResource`/default `'Unassigned'`, type LABOR, maxUnits 1) i.p.v. de
  // (onbetrouwbare) plaatshouder-veldwaarden te vertrouwen. uid=5 ("Alice") is een normale WORK-
  // resource, MAX_UNITS 100% = raw 10000.0. ──────────────────────────────────────────────────────
  const rscFixedMetaBlob = buildRscFixedMetaBlob([
    buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: false }),
    buildRscFixedMetaRecord({ offsetIntoFixedData: RSC_RECORD_SIZE, isWork: true }),
  ]);
  const rscFixedDataBlob = concatBytes(
    buildRscFixedDataRecord({ uniqueId: 0, maxUnitsRaw: 0 }),
    buildRscFixedDataRecord({ uniqueId: 5, maxUnitsRaw: 10000 }),
  );
  const RSC_NAME0_OFF = 0, RSC_NAME5_OFF = 40;
  const rscVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 0, type: 1, offset: RSC_NAME0_OFF },
    { uniqueId: 5, type: 1, offset: RSC_NAME5_OFF },
  ]);
  const rscVar2DataBuf = new Uint8Array(120);
  const rv2 = new DataView(rscVar2DataBuf.buffer);
  const writeRscName = (offset: number, s: string) => {
    const payload = encodeUnicodeStringAscii(s);
    rv2.setInt32(offset, payload.length, true);
    rscVar2DataBuf.set(payload, offset + 4);
  };
  writeRscName(RSC_NAME0_OFF, 'Onbenoemd'); // ⚠️ genegeerd — zie de toelichting hierboven
  writeRscName(RSC_NAME5_OFF, 'Alice');

  // ── Assignments: A↔uid0 (100%), B↔uid5 (50%). ───────────────────────────────────────────────────
  const assnFixedMetaBlob = buildAssnFixedMetaBlob([
    buildAssnFixedMetaRecord(0),
    buildAssnFixedMetaRecord(ASSN_ITEM_SIZE),
  ]);
  const assnFixedDataBlob = concatBytes(
    buildAssnFixedDataItem({ uniqueId: 200, taskUid: 10, resourceUid: 0, unitsRaw: 10000 }),
    buildAssnFixedDataItem({ uniqueId: 201, taskUid: 11, resourceUid: 5, unitsRaw: 5000 }),
  );
  const assnVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 200, offset: 0, type: 0 },
    { uniqueId: 201, offset: 0, type: 0 },
  ]);

  const projectPropsBytes = encodePropsEntries([
    { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
    { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
    { key: MINUTES_PER_DAY_KEY, data: int32Payload(480) },
    { key: TITLE_KEY, data: encodeUnicodeStringAscii('T7 Fixture Project') },
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
        TBkndCons: {
          children: { FixedMeta: { data: consFixedMetaBlob }, FixedData: { data: consFixedDataBlob } },
        },
        TBkndRsc: {
          children: {
            FixedMeta: { data: rscFixedMetaBlob },
            FixedData: { data: rscFixedDataBlob },
            VarMeta: { data: rscVarMetaBytes },
            Var2Data: { data: rscVar2DataBuf },
          },
        },
        TBkndAssn: {
          children: { FixedMeta: { data: assnFixedMetaBlob }, FixedData: { data: assnFixedDataBlob }, VarMeta: { data: assnVarMetaBytes } },
        },
      },
    },
  };

  let result: ReturnType<typeof readMPP> | null = null;
  let threw: string | null = null;
  try {
    result = readMPP(buildNestedCfb(tree));
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`I4/T7 end-to-end readMPP: gooit niet (${threw ?? ''})`, threw === null);

  if (result) {
    truthy('I4/T7 end-to-end readMPP: 3 taken', result.tasks.length === 3);
    truthy('I4/T7 end-to-end readMPP: 2 relaties', result.sequences.length === 2);
    truthy('I4/T7 end-to-end readMPP: 2 resources', result.resources.length === 2);
    truthy('I4/T7 end-to-end readMPP: 2 assignments', result.assignments.length === 2);

    const taskByName = new Map(result.tasks.map((t) => [t.name, t]));
    const a = taskByName.get('A'), b = taskByName.get('B'), c = taskByName.get('C');
    truthy('I4/T7 end-to-end readMPP: A/B/C gevonden', !!a && !!b && !!c);

    if (a && b && c) {
      const seqAB = result.sequences.find((s) => s.predecessorId === a.id && s.successorId === b.id);
      const seqBC = result.sequences.find((s) => s.predecessorId === b.id && s.successorId === c.id);
      truthy('I4/T7 end-to-end readMPP: relatie A→B gevonden', !!seqAB);
      truthy('I4/T7 end-to-end readMPP: relatie B→C gevonden', !!seqBC);
      if (seqAB) {
        truthy('I4/T7 end-to-end readMPP: A→B type === FINISH_START', seqAB.type === 'FINISH_START');
        truthy('I4/T7 end-to-end readMPP: A→B lagDays === 2 (WORKTIME, 9600 tienden-van-minuut @8u/dag)', seqAB.lagDays === 2);
        truthy('I4/T7 end-to-end readMPP: A→B lagUnit is WORKTIME (undefined = default)', seqAB.lagUnit === undefined);
      }
      if (seqBC) {
        truthy('I4/T7 end-to-end readMPP: B→C type === START_START', seqBC.type === 'START_START');
        truthy('I4/T7 end-to-end readMPP: B→C lagDays === 1 (ELAPSED, 14400 tienden-van-minuut/10/60/24)', seqBC.lagDays === 1);
        truthy('I4/T7 end-to-end readMPP: B→C lagUnit === ELAPSEDTIME', seqBC.lagUnit === 'ELAPSEDTIME');
      }

      // T7-spec-review (B3): uniqueID 0 (raw naam "Onbenoemd", isWork:false, maxUnitsRaw:0 — zie de
      // fixture-toelichting hierboven) moet de VASTE sentinelvorm dragen, NIET de rauwe velden.
      // VarMeta12.getUniqueIdentifierArray() levert numeriek-gesorteerde unique-ID's, dus uniqueID 0
      // (de kleinst mogelijke) is — als aanwezig — altijd `result.resources[0]`.
      const unassigned = result.resources[0];
      const alice = result.resources.find((r) => r.name === 'Alice');
      truthy('I4/T7 end-to-end readMPP: resource uniqueID 0 gevonden — 0 is een geldige uniqueID', !!unassigned);
      truthy('I4/T7 end-to-end readMPP: resource "Alice" gevonden', !!alice);
      if (unassigned) {
        truthy('I4/T7-B3 uniqueID-0-resource: naam === default label "Unassigned" (raw "Onbenoemd" GENEGEERD)', unassigned.name === 'Unassigned');
        truthy('I4/T7-B3 uniqueID-0-resource: type === LABOR (raw isWork:false GENEGEERD)', unassigned.type === 'LABOR');
        truthy('I4/T7-B3 uniqueID-0-resource: maxUnits === 1 (raw maxUnitsRaw:0 GENEGEERD)', unassigned.maxUnits === 1);
      }
      if (alice) {
        truthy('I4/T7 end-to-end readMPP: "Alice".type === LABOR (WORK-bit gezet)', alice.type === 'LABOR');
        truthy('I4/T7 end-to-end readMPP: "Alice".maxUnits === 1 (100%, dubbele /100 t.o.v. MPXJ se percent-schaal)', alice.maxUnits === 1);
      }

      if (unassigned && alice) {
        const assnA = result.assignments.find((asg) => asg.taskId === a.id && asg.resourceId === unassigned.id);
        const assnB = result.assignments.find((asg) => asg.taskId === b.id && asg.resourceId === alice.id);
        truthy('I4/T7 end-to-end readMPP: assignment A↔uid-0-resource gevonden', !!assnA);
        truthy('I4/T7 end-to-end readMPP: assignment B↔Alice gevonden', !!assnB);
        if (assnA) truthy('I4/T7 end-to-end readMPP: A↔uid-0-resource unitsPerDay === 1 (100%)', assnA.unitsPerDay === 1);
        if (assnB) truthy('I4/T7 end-to-end readMPP: B↔Alice unitsPerDay === 0.5 (50% — synthetisch: corpus draagt alleen 0/1, zie moduleheader)', assnB.unitsPerDay === 0.5);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T7-hostile: mppReader.ts se relatie-/resource-/assignmentlezers tegen vijandige/geprepareerde
// invoer
// ═══════════════════════════════════════════════════════════════════════════════════════════

// ── (a) Relatie naar een niet-bestaande/gefilterde taak — overgeslagen zoals MPXJ, de rest van de
// relaties blijft gewoon leesbaar. taskIdByUniqueId kent alleen uid 10; de fixture claimt relaties
// 10→11 (11 bestaat niet) en 10→10 (circulair — ConstraintFactory.java's taskID1===taskID2-guard). ──
{
  const taskIdByUniqueId = new Map<number, string>([[10, 'task-A']]);
  const fixedMeta = buildConsFixedMetaBlob([0, 20, 40]);
  const fixedData = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 999, relationType: 1, durationUnits: 7, duration: 0 }),
    buildConsFixedDataRecord({ uniqueId: 2, predecessorTaskUid: 10, successorTaskUid: 10, relationType: 1, durationUnits: 7, duration: 0 }),
    buildConsFixedDataRecord({ uniqueId: 3, predecessorTaskUid: 0, successorTaskUid: 10, relationType: 1, durationUnits: 7, duration: 0 }),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  const sequences = readRelations(cfb, null, 8, taskIdByUniqueId);
  truthy(
    'T7-hostile relatie naar onbestaande/circulaire/projectsamenvattingstaak: alle drie overgeslagen (0 relaties)',
    sequences.length === 0,
  );
}

// ── (b) Extreem record-aantal ⇒ de bestaande FixedMeta-klem (mppPrimitives.ts se I1) beveiligt ook
// de relatielezer: de HEADER claimt 5.000.000 items, de buffer biedt er in werkelijkheid 50. Bewijst
// dat `readRelationsUnsafe` de RUWE headerwaarde niet als lusbovengrens gebruikt (plan-waarschuwing:
// "ConstraintFactory gebruikt de RUWE FixedMeta.getItemCount() als lusbovengrens — onze geklemde
// variant is veilig") — snel, geen crash, en precies de 50 echte relaties, niet meer/minder. ────────
{
  const RECORD_COUNT = 50;
  const taskIdByUniqueId = new Map<number, string>();
  for (let i = 1; i <= RECORD_COUNT + 1; i++) taskIdByUniqueId.set(i, `task-${i}`);
  const offsets = Array.from({ length: RECORD_COUNT }, (_, i) => i * 20);
  const fixedMeta = buildConsFixedMetaBlob(offsets, 5_000_000); // hostile itemCount-CLAIM
  const records = Array.from({ length: RECORD_COUNT }, (_, i) =>
    buildConsFixedDataRecord({ uniqueId: i + 1, predecessorTaskUid: i + 1, successorTaskUid: i + 2, relationType: 1, durationUnits: 7, duration: 0 }));
  const fixedData = concatBytes(...records);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));

  const start = Date.now();
  let sequences: Sequence[] = [];
  let threw: string | null = null;
  try {
    sequences = readRelations(cfb, null, 8, taskIdByUniqueId);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T7-hostile extreem record-aantal (headerclaim=5.000.000, buffer=${RECORD_COUNT}): binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T7-hostile extreem record-aantal: gooit niet (${threw ?? ''})`, threw === null);
  truthy(
    `T7-hostile extreem record-aantal: precies de ${RECORD_COUNT} echte relaties gelezen (niet de headerclaim, niet minder)`,
    sequences.length === RECORD_COUNT,
  );
}

// T7-kwaliteitsreview (M6): hergebruikt de ECHTE default-tabellen uit fieldMap14.ts i.p.v. een
// hardgecodeerd duplicaat aan te houden — rechtstreeks opgebouwd i.p.v. via `createResourceFieldMap
// (props)`/`createAssignmentFieldMap(props)`, zodat de hostile-tests hieronder niet ook nog een
// `Props`-fixture hoeven te bouwen.
const RESOURCE_DEFAULT_FIELD_MAP: FieldMapTable = new Map(Object.entries(DEFAULT_RESOURCE_FIELDS).map(([k, v]) => [Number(k), v]));
const ASSIGNMENT_DEFAULT_FIELD_MAP: FieldMapTable = new Map(Object.entries(DEFAULT_ASSIGNMENT_FIELDS).map(([k, v]) => [Number(k), v]));

// ── (c) Ontbrekende Var2Data op TBkndRsc — legitiem afwezig (mppPrimitives.ts se Var2Data-
// moduleheader), moet niet gooien: de resource wordt nog steeds gematerialiseerd, met de generieke
// naam-terugval ('Resource') omdat er geen naam-var-data is om te lezen. ──────────────────────────
{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })]);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 7, maxUnitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 7, type: 1, offset: 0 }]); // VarMeta claimt een naam-entry...
  // ...maar GEEN Var2Data-stream in de tree hieronder (bewust weggelaten, niet leeg — spiegelt het
  // corpusgeval "a69fec157074d056 mist Var2Data voor TBkndCons" (hash-only §8), hier toegepast op TBkndRsc).
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));

  let result: ReadResourcesResult | null = null;
  let threw: string | null = null;
  try {
    result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-hostile ontbrekende Var2Data op TBkndRsc: gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-hostile ontbrekende Var2Data op TBkndRsc: resource toch gematerialiseerd (1)', result?.resources.length === 1);
  truthy(
    'T7-hostile ontbrekende Var2Data op TBkndRsc: naam valt terug op "Resource" (geen var-data om te lezen)',
    result?.resources[0]?.name === 'Resource',
  );
}

// ── (d1) T7-spec-review (B7): Fixed2Meta AANWEZIG — COST-bit (byte[8]&0x10) beslist tussen LABOR
// (Cost, spiegelt mspdiReader se collapse: alleen MSP-Type 0 is MATERIAL) en MATERIAL voor een
// niet-WORK resource. Twee resources, allebei isWork:false: uid=1 met de COST-bit gezet (→ LABOR
// verwacht), uid=2 zonder (→ MATERIAL verwacht, bewijst dat de niet-COST-tak nog steeds klopt). ────
{
  const fixedMeta = buildRscFixedMetaBlob([
    buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: false }),
    buildRscFixedMetaRecord({ offsetIntoFixedData: RSC_RECORD_SIZE, isWork: false }),
  ]);
  const fixedData = concatBytes(
    buildRscFixedDataRecord({ uniqueId: 1, maxUnitsRaw: 10000 }),
    buildRscFixedDataRecord({ uniqueId: 2, maxUnitsRaw: 10000 }),
  );
  const fixed2Meta = buildRsc2MetaBlob([
    buildRsc2MetaRecord({ isCost: true }), // index 0 ⇒ uid=1
    buildRsc2MetaRecord({ isCost: false }), // index 1 ⇒ uid=2
  ]);
  // VarMeta12.getUniqueIdentifierArray() is de bron van WELKE uniqueID's `readResourcesUnsafe`
  // materialiseert (niet alleen namen!) — een dummy type/offset per uid volstaat, deze test leest
  // geen var-data.
  const varMeta = buildVarMetaBytes([
    { uniqueId: 1, type: 99, offset: 0 },
    { uniqueId: 2, type: 99, offset: 0 },
  ]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndRsc: {
          children: {
            FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData },
            Fixed2Meta: { data: fixed2Meta }, VarMeta: { data: varMeta },
          },
        },
      },
    },
  }));

  const result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  const byUid1 = result.resources.find((r) => result.resourceIdByUniqueId.get(1) === r.id);
  const byUid2 = result.resources.find((r) => result.resourceIdByUniqueId.get(2) === r.id);
  truthy('T7-spec-review-B7 Fixed2Meta COST-bit: 2 resources gelezen', result.resources.length === 2);
  truthy('T7-spec-review-B7 Fixed2Meta COST-bit gezet (uid=1) ⇒ type LABOR (Cost → LABOR, spiegelt mspdiReader)', byUid1?.type === 'LABOR');
  truthy('T7-spec-review-B7 Fixed2Meta COST-bit NIET gezet (uid=2) ⇒ type MATERIAL', byUid2?.type === 'MATERIAL');
}

// ── (d2) T7-spec-review (B7): Fixed2Meta AFWEZIG — defensieve terugval blijft het WORK-bit-only-
// gedrag van vóór deze fix (niet-WORK ⇒ altijd MATERIAL, ongeacht wat een aanwezige Fixed2Meta ooit
// zou hebben gezegd). Bewijst dat een oudere/kleinere `.mpp` zonder deze stream niet crasht en niet
// stilzwijgend LABOR gokt. ─────────────────────────────────────────────────────────────────────────
{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: false })]);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 3, maxUnitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 3, type: 99, offset: 0 }]); // zie (d1)'s toelichting
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));

  let result: ReadResourcesResult | null = null;
  let threw: string | null = null;
  try {
    result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-spec-review-B7 Fixed2Meta afwezig: gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-spec-review-B7 Fixed2Meta afwezig: 1 resource gelezen', result?.resources.length === 1);
  truthy('T7-spec-review-B7 Fixed2Meta afwezig: type valt terug op MATERIAL (WORK-bit-only-gedrag)', result?.resources[0]?.type === 'MATERIAL');
}

// ── (e) T7-spec-review (B2): percent-/elapsedPercent-lag (unit-code 19/20) — BESLUIT: `lagPercent
// = rawLag / 10`, zodat deze lezer dezelfde domeinsemantiek (HELE procenten) levert als
// `mspdiReader.ts` (LagFormat 19/20: `link.lag / 10`). Twee relaties: A→B met unit-code 19
// (percent, rawLag=500 ⇒ lagPercent 50, WORKTIME/geen lagUnit) en B→C met unit-code 20
// (elapsedPercent, rawLag=800 ⇒ lagPercent 80, lagUnit ELAPSEDTIME) — zie `mppLagToSequenceFields`
// in mppReader.ts voor de volledige herleiding. ─────────────────────────────────────────────────────
{
  const taskIdByUniqueId = new Map<number, string>([[10, 'task-A'], [11, 'task-B'], [12, 'task-C']]);
  const fixedMeta = buildConsFixedMetaBlob([0, 20]);
  const fixedData = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 19, duration: 500 }),
    buildConsFixedDataRecord({ uniqueId: 2, predecessorTaskUid: 11, successorTaskUid: 12, relationType: 1, durationUnits: 20, duration: 800 }),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  const sequences = readRelations(cfb, null, 8, taskIdByUniqueId);
  truthy('T7-spec-review-B2 percent-lag: 2 relaties gelezen', sequences.length === 2);
  const percentSeq = sequences.find((s) => s.predecessorId === 'task-A');
  const elapsedPercentSeq = sequences.find((s) => s.predecessorId === 'task-B');
  truthy('T7-spec-review-B2 percent-lag (code 19): lagPercent === 50 (rawLag 500 / 10)', percentSeq?.lagPercent === 50);
  truthy('T7-spec-review-B2 percent-lag (code 19): geen lagUnit (WORKTIME-default)', percentSeq?.lagUnit === undefined);
  truthy('T7-spec-review-B2 elapsedPercent-lag (code 20): lagPercent === 80 (rawLag 800 / 10)', elapsedPercentSeq?.lagPercent === 80);
  truthy('T7-spec-review-B2 elapsedPercent-lag (code 20): lagUnit === ELAPSEDTIME', elapsedPercentSeq?.lagUnit === 'ELAPSEDTIME');
}

// ── readAssignments/readResources: lege/ontbrekende storage ⇒ lege array, gooit niet (spiegelt
// readRelations se lege-stream-terugval hierboven). ──────────────────────────────────────────────
{
  const cfb = new CfbFile(buildNestedCfb({ '   114': { children: {} } }));
  truthy('T7 readRelations op ontbrekende TBkndCons: lege array', readRelations(cfb, null, 8, new Map()).length === 0);
  truthy('T7 readResources op ontbrekende TBkndRsc: lege array', readResources(cfb, new Map(), null, emptyCalResult).resources.length === 0);
  truthy('T7 readAssignments op ontbrekende TBkndAssn: lege array', readAssignments(cfb, new Map(), new Map(), new Map()).length === 0);

  // T7-kwaliteitsreview (I1, regressienet): TWEE losse lege lezingen mogen NOOIT dezelfde
  // array-/Map-instantie terugkrijgen. Zou `emptyResourcesResult()` ooit weer een module-singleton
  // worden (zie de toelichting daar), dan bevriest Immer's autoFreeze die instantie bij de eerste
  // mutatiepoging in de store — en elke VOLGENDE lege lezing (een ander, later geopend document)
  // zou tegen datzelfde bevroren object aanlopen. Referentie-ongelijkheid is hier het contract.
  const first = readResources(cfb, new Map(), null, emptyCalResult);
  const second = readResources(cfb, new Map(), null, emptyCalResult);
  truthy('T7-kwaliteitsreview-I1 readResources: twee lege lezingen delen NIET dezelfde array-instantie', first.resources !== second.resources);
  truthy('T7-kwaliteitsreview-I1 readResources: twee lege lezingen delen NIET dezelfde Map-instantie', first.resourceIdByUniqueId !== second.resourceIdByUniqueId);
}

// ── (f) T7-kwaliteitsreview (I3, BLOKKEREND): de ALTIJD-vangende `readRelations`/`readResources`/
// `readAssignments`-wrappers (I1-les uit T6) hadden GEEN eigen regressienet — elke hostile fixture
// hierboven loopt via een EARLY RETURN (ontbrekende stream, niet-gevonden veld), nooit via de
// try/catch zelf. De drie blokken hieronder geven `FixedMeta` een KAPOT magic-getal (0xdeadbeef ≠
// BLOCK_MAGIC) — dat gooit diep in `FixedMeta.withItemSize`, VOORBIJ de early-return-checks — en
// bewijzen dat de wrapper 'm daadwerkelijk vangt (spiegelt check-mpp-calendars.ts se T7-her-review-
// restpunt (b) voor `readCalendars`). Zonder de try/catch zou elk van deze drie ongevangen gooien
// en de hele `readMPP`-aanroep laten falen. ─────────────────────────────────────────────────────────
const BAD_MAGIC = 0xdeadbeef;
{
  const fixedMeta = buildConsFixedMetaBlob([0], 1, BAD_MAGIC);
  const fixedData = buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 7, duration: 0 });
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  let sequences: Sequence[] = [];
  let threw: string | null = null;
  try {
    sequences = readRelations(cfb, null, 8, new Map([[10, 'a'], [11, 'b']]));
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-kwaliteitsreview-I3 readRelations-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-kwaliteitsreview-I3 readRelations-wrapper: lege array (fallback)', sequences.length === 0);
}
{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })], BAD_MAGIC);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 1, maxUnitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  let result: ReadResourcesResult | null = null;
  let threw: string | null = null;
  try {
    result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-kwaliteitsreview-I3 readResources-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-kwaliteitsreview-I3 readResources-wrapper: lege resourcelijst (fallback)', result?.resources.length === 0);
}
{
  const fixedMeta = buildAssnFixedMetaBlob([buildAssnFixedMetaRecord(0)], BAD_MAGIC);
  const fixedData = buildAssnFixedDataItem({ uniqueId: 1, taskUid: 10, resourceUid: 5, unitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndAssn: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  let assignments: ResourceAssignment[] = [];
  let threw: string | null = null;
  try {
    assignments = readAssignments(cfb, ASSIGNMENT_DEFAULT_FIELD_MAP, new Map([[10, 'task']]), new Map([[5, 'res']]));
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-kwaliteitsreview-I3 readAssignments-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-kwaliteitsreview-I3 readAssignments-wrapper: lege array (fallback)', assignments.length === 0);
}

// ── (g) T7-kwaliteitsreview (I2, BLOKKEREND): een geprepareerd ±Infinity-double-bitpatroon op
// MAX_UNITS/ASSIGNMENT_UNITS mag niet doorlekken naar `Resource.maxUnits`/`ResourceAssignment.
// unitsPerDay` (die zouden anders `Infinity` worden — corrupt bij een latere IFC-save, zie
// `getDouble`'s I2-toelichting in mppPrimitives.ts). End-to-end door `readResources`/
// `readAssignments` heen (niet alleen het primitief zelf, dat is al los gedekt in
// check-mpp-import.ts). ─────────────────────────────────────────────────────────────────────────
{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })]);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 1, maxUnitsRaw: Infinity });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  const result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  truthy('T7-kwaliteitsreview-I2 readResources: 1 resource gelezen', result.resources.length === 1);
  truthy('T7-kwaliteitsreview-I2 readResources: maxUnits eindig (Infinity-double ⇒ 0, geen Infinity-lek)', Number.isFinite(result.resources[0]?.maxUnits));
  truthy('T7-kwaliteitsreview-I2 readResources: maxUnits === 0', result.resources[0]?.maxUnits === 0);
}
{
  const fixedMeta = buildAssnFixedMetaBlob([buildAssnFixedMetaRecord(0)]);
  const fixedData = buildAssnFixedDataItem({ uniqueId: 1, taskUid: 10, resourceUid: 5, unitsRaw: -Infinity });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndAssn: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  const assignments = readAssignments(cfb, ASSIGNMENT_DEFAULT_FIELD_MAP, new Map([[10, 'task']]), new Map([[5, 'res']]));
  truthy('T7-kwaliteitsreview-I2 readAssignments: 1 assignment gelezen', assignments.length === 1);
  truthy('T7-kwaliteitsreview-I2 readAssignments: unitsPerDay eindig (-Infinity-double ⇒ 0)', Number.isFinite(assignments[0]?.unitsPerDay));
  truthy('T7-kwaliteitsreview-I2 readAssignments: unitsPerDay === 0', assignments[0]?.unitsPerDay === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T7 — corpus: readMPP vs. de MSPDI-ground-truth (naam-gematchte relaties/resources/assignments)
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Zie de moduleheader-waarschuwing: de link-/resource-/assignmentAANTALLEN in de MSPDI-ground-truth
// zijn NIET gezaghebbend voor de `.mpp`-inhoud (documentversieverschil). Deze sectie matcht daarom
// op NAAM (relaties: voorganger+opvolger-taaknaam; assignments: taak+resource-naam; resources:
// resourcenaam) en legt GEMETEN basislijnen vast (2026-08-14, dit corpus, deze code) i.p.v. de
// XML-aantallen hard te asserteren.
const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const corpusPresent = existsSync(CORPUS);
const corpusFiles = corpusPresent ? readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.mpp')) : [];

// Hash-only (§8, Z20-veeg): zelfde patroon als `check-mpp-fidelity.ts`/`check-mpp-import.ts` —
// bedrijfsbestanden identificeer je uitsluitend via hun SHA-256-hash (16 hex), nooit hun naam.
function hashOfT7(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}
const corpusHashToFileT7 = new Map<string, string>();
for (const file of corpusFiles) {
  try {
    corpusHashToFileT7.set(hashOfT7(new Uint8Array(readFileSync(join(CORPUS, file)))), file);
  } catch {
    // Onleesbaar bestand — genegeerd; het corpuslus hieronder rapporteert zijn eigen leesfout.
  }
}
function resolveT7FileByHash(hash: string): string | null {
  return corpusHashToFileT7.get(hash) ?? null;
}

if (!corpusPresent) {
  console.log('OK  mpp-relations: corpus niet aanwezig (OPS_MPP_CORPUS) — corpuslus overgeslagen');
} else if (corpusFiles.length === 0) {
  console.log(`OK  mpp-relations: corpusmap aanwezig maar geen .mpp-bestanden erin (${CORPUS}) — corpuslus overgeslagen`);
} else {
  installDOMParser();

  /** Gemeten basislijnen (2026-08-14, dit corpus, deze code) — NIET de plan-tabel se XML-aantallen
   *  (104/111/225 links, 9/7/5 resources, 51/146/221 assignments): die zijn voor een andere
   *  documentrevisie, zie de moduleheader. Toevallig komen de resource-/assignmentaantallen hier wél
   *  overeen met de tabel — dat is een gemeten uitkomst, geen aanname. */
  // Hash-only (§8, Z20-veeg): sleutels zijn de bekende corpushashes, geen bedrijfsbestandsnamen.
  const EXPECTED_COUNTS: Record<string, { relations: number; resources: number; assignments: number }> = {
    '870d339f60603f71': { relations: 105, resources: 9, assignments: 32 },
    '787efb968ae72fe4': { relations: 120, resources: 7, assignments: 125 },
    'a69fec157074d056': { relations: 239, resources: 5, assignments: 173 },
  };

  /** T7-spec-review (B5) — gemeten resourcetype-mismatchbasislijn PER BESTAND (mpp `type` vs. XML
   *  Work/Material, per naam-gematcht paar, UITSLUITEND de niet-plaatshouderresources — zie
   *  `RESOURCE_TYPE_MISMATCH_BUDGET`'s gebruik hieronder). Gemeten NÁ de B7-Fixed2Meta-COST-bit-
   *  port: 787efb968ae72fe4 en a69fec157074d056 zijn nu 100% gelijk aan de ground truth (0
   *  afwijkingen — vóór de B7-port waren dat allebei foute MATERIAL-indelingen). 870d339f60603f71
   *  blijft 6 van de 8 niet-plaatshouderresources MATERIAL waar de XML ze als Work (LABOR) toont —
   *  matcht MPXJ's eigen bit-voor-bit-uitkomst exact (dit is dus geen bug in de poort), en volgt
   *  hetzelfde documentversieverschil-patroon als de taak-/kalendervergelijkingen elders in dit
   *  bestand (check-mpp-import.ts se T5-sectie, check-mpp-calendars.ts se T6-sectie): de XML is een
   *  andere documentrevisie, dus een afwijking hier is geen bewijs van een leesfout. */
  const RESOURCE_TYPE_MISMATCH_BUDGET: Record<string, number> = {
    '870d339f60603f71': 6,
    '787efb968ae72fe4': 0,
    'a69fec157074d056': 0,
  };

  function taskNameById(tasks: Task[]): Map<string, string> {
    return new Map(tasks.map((t) => [t.id, t.name.trim()]));
  }
  function resNameById(resources: Resource[]): Map<string, string> {
    return new Map(resources.map((r) => [r.id, r.name.trim()]));
  }

  for (const [hash, expected] of Object.entries(EXPECTED_COUNTS)) {
    const file = resolveT7FileByHash(hash);
    if (!file) {
      console.log(`OK  mpp-relations: T7 ${hash} niet in dit corpus (${CORPUS}) — overgeslagen`);
      continue;
    }
    const mppPath = join(CORPUS, file);
    const xmlPath = `${mppPath}.xml`;
    if (!existsSync(xmlPath)) {
      checks++;
      diffs.push(`[T7 ${hash}] .mpp aanwezig maar .mpp.xml ontbreekt`);
      continue;
    }

    let mpp: ReturnType<typeof readMPP>;
    let xml: ReturnType<typeof readMSPDI>;
    try {
      mpp = readMPP(new Uint8Array(readFileSync(mppPath)));
      xml = readMSPDI(readFileSync(xmlPath, 'utf-8'));
    } catch (err) {
      checks++;
      diffs.push(`[T7 ${hash}] readMPP/readMSPDI gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // ── Gemeten-basislijn-poorten (T7-kwaliteitsreview M3: commentaar in lijn gebracht met de
    // asserts — de drie tellingen zijn NIET allemaal hetzelfde soort poort). Relaties: `>=` (zie
    // check-mpp-calendars.ts se crawl-sectie voor hetzelfde precedent) — een toekomstige verbetering
    // (bv. een filter die MPXJ nu wel toepast en deze lezer nog niet) mag het aantal laten dalen
    // richting de XML-telling zonder de poort te breken, minder dan de gemeten basislijn is een
    // regressie. Resources/assignments: `===` — deze twee tellingen zijn in dit corpus STABIEL
    // (deterministisch gemeten, geen documentversie-gevoelige filterstap zoals bij relaties), dus een
    // exacte match is hier de juiste, striktere poort. ─────────────────────────────────────────────
    truthy(`[T7 ${hash}] relatie-aantal >= gemeten basislijn (${mpp.sequences.length}/${expected.relations})`, mpp.sequences.length >= expected.relations);
    truthy(`[T7 ${hash}] resource-aantal === gemeten basislijn (${mpp.resources.length}/${expected.resources})`, mpp.resources.length === expected.resources);
    truthy(`[T7 ${hash}] assignment-aantal === gemeten basislijn (${mpp.assignments.length}/${expected.assignments})`, mpp.assignments.length === expected.assignments);

    // ── Relaties: naam-gematchte vergelijking (voorganger+opvolger-taaknaam), type+lag per gematcht
    // paar — HARD op wat het corpus daadwerkelijk aanbiedt (100% gemeten, T7-onderzoek 2026-08-14).
    // Dekkingsvoorbehoud (B1, zie moduleheader): dit corpus draagt UITSLUITEND FINISH_START met
    // lag=0 (464/464 relaties) — deze hard assert bewijst dus alleen dat pad; de type-tabel-varianten
    // en de lag-takken (WORKTIME-met-dagenwaarde/ELAPSED/percent) zijn uitsluitend synthetisch gedekt
    // (de I4/T7-fixture bovenaan dit bestand). ─────────────────────────────────────────────────────
    const mppTaskName = taskNameById(mpp.tasks);
    const xmlTaskName = taskNameById(xml.tasks);
    const relKey = (seq: Sequence, names: Map<string, string>): string | null => {
      const p = names.get(seq.predecessorId);
      const s = names.get(seq.successorId);
      return p && s ? `${p} -> ${s}` : null;
    };
    const xmlRelByKey = new Map<string, Sequence[]>();
    for (const seq of xml.sequences) {
      const k = relKey(seq, xmlTaskName);
      if (!k) continue;
      const arr = xmlRelByKey.get(k) ?? [];
      arr.push(seq);
      xmlRelByKey.set(k, arr);
    }
    let relMatched = 0, relTypeOk = 0, relLagOk = 0;
    const relDiag: string[] = [];
    for (const seq of mpp.sequences) {
      const k = relKey(seq, mppTaskName);
      if (!k) continue;
      const queue = xmlRelByKey.get(k);
      const xseq = queue && queue.length > 0 ? queue.shift() : undefined;
      if (!xseq) continue;
      relMatched++;
      if (seq.type === xseq.type) relTypeOk++;
      else relDiag.push(`${k}: type mpp=${seq.type} xml=${xseq.type}`);
      const lagOk = (seq.lagDays ?? 0) === (xseq.lagDays ?? 0) && (seq.lagUnit ?? 'WORKTIME') === (xseq.lagUnit ?? 'WORKTIME');
      if (lagOk) relLagOk++;
      else relDiag.push(`${k}: lag mpp=(${seq.lagDays},${seq.lagUnit ?? 'WORKTIME'}) xml=(${xseq.lagDays},${xseq.lagUnit ?? 'WORKTIME'})`);
    }
    truthy(`[T7 ${hash}] relaties: alle op naam gematchte paren hebben gelijk type (${relTypeOk}/${relMatched})`, relTypeOk === relMatched);
    truthy(`[T7 ${hash}] relaties: alle op naam gematchte paren hebben gelijke lag (${relLagOk}/${relMatched})`, relLagOk === relMatched);

    // ── Resources (T7-spec-review, B3/B4/B5): de uniqueID-0-plaatshouder wordt EXPLICIET op
    // uniqueID gepaard (niet op naam — MSPDI toont 'm gelokaliseerd als "Niet toegekend", deze lezer
    // gebruikt de vaste `ImportLabels`-default "Unassigned", zie de moduleheader). VarMeta12.
    // getUniqueIdentifierArray() levert numeriek-gesorteerde unique-ID's, dus de uniqueID-0-resource
    // is — als aanwezig — altijd `mpp.resources[0]`; de sentinelvorm (naam/type/maxUnits, zie
    // `readResourcesUnsafe`) bevestigt dat het echt de plaatshouder is, geen toevalstreffer. ─────────
    const ourUnassigned = mpp.resources[0];
    const isOurUnassignedSentinel = !!ourUnassigned
      && ourUnassigned.name === 'Unassigned' && ourUnassigned.type === 'LABOR' && ourUnassigned.maxUnits === 1;
    truthy(`[T7 ${hash}] uid-0-plaatshouderresource materialiseert als de vaste sentinelvorm (mpp.resources[0])`, isOurUnassignedSentinel);
    const xmlUnassigned = xml.resources.find((r) => r.name.trim() === 'Niet toegekend');
    truthy(`[T7 ${hash}] MSPDI-ground-truth draagt zelf ook een "Niet toegekend"-plaatshouder`, !!xmlUnassigned);
    if (isOurUnassignedSentinel && xmlUnassigned && ourUnassigned) {
      truthy(`[T7 ${hash}] uid-0-plaatshouder: type gelijk aan XML se "Niet toegekend"`, ourUnassigned.type === xmlUnassigned.type);
      truthy(`[T7 ${hash}] uid-0-plaatshouder: maxUnits gelijk aan XML se "Niet toegekend"`, ourUnassigned.maxUnits === xmlUnassigned.maxUnits);
    }

    // Overige (niet-plaatshouder) resources: 1:1 naam-matching + HARDE maxUnits-assert (B4 —
    // vervangt de eerdere naam-only-vergelijking die de dubbele-/100-schaalfout niet had kunnen
    // vangen, zie de T7-spec-review-toelichting) + een PER-BESTAND GEMETEN type-mismatchbudget (B5,
    // `RESOURCE_TYPE_MISMATCH_BUDGET` hierboven — 870d339f60603f71 wijkt af, documentversieverschil).
    const restMppResources = isOurUnassignedSentinel ? mpp.resources.slice(1) : mpp.resources;
    const xmlResourcesByName = new Map(xml.resources.filter((r) => r.name.trim() !== 'Niet toegekend').map((r) => [r.name.trim(), r]));
    let resMatched = 0, maxUnitsOk = 0, typeMismatches = 0;
    const resDiag: string[] = [];
    for (const r of restMppResources) {
      const xr = xmlResourcesByName.get(r.name.trim());
      if (!xr) {
        resDiag.push(`resource "${r.name}" niet gevonden in MSPDI-ground-truth`);
        continue;
      }
      resMatched++;
      if (Math.abs(r.maxUnits - xr.maxUnits) < 0.001) maxUnitsOk++;
      else resDiag.push(`resource "${r.name}": maxUnits mpp=${r.maxUnits} xml=${xr.maxUnits}`);
      if (r.type === xr.type) {
        // gelijk — geen diagnostiek nodig
      } else {
        typeMismatches++;
        resDiag.push(`resource "${r.name}": type mpp=${r.type} xml=${xr.type}`);
      }
    }
    truthy(`[T7 ${hash}] resources: alle niet-plaatshouder-resources op naam gematcht (${resMatched}/${restMppResources.length})`, resMatched === restMppResources.length);
    truthy(`[T7 ${hash}] resources: maxUnits gelijk voor alle gematchte paren (${maxUnitsOk}/${resMatched})`, maxUnitsOk === resMatched);
    const typeBudget = RESOURCE_TYPE_MISMATCH_BUDGET[hash] ?? 0;
    truthy(
      `[T7 ${hash}] resources: type-afwijkingen binnen de gemeten basislijn (${typeMismatches}/${typeBudget}, documentversieverschil — zie B5-toelichting)`,
      typeMismatches <= typeBudget,
    );

    // ── Assignments: naam-gematchte vergelijking (taak+resourcenaam), units per gematcht paar —
    // HARD op wat het corpus daadwerkelijk aanbiedt (100% gemeten, T7-onderzoek 2026-08-14).
    // Dekkingsvoorbehoud (B1): assignment-`unitsPerDay` is in dit corpus altijd 0 of 1 (nooit een
    // fractie) — de 50%-tak is uitsluitend synthetisch gedekt (de I4/T7-fixture). ─────────────────────
    const mppResName = resNameById(mpp.resources);
    const xmlResName = resNameById(xml.resources);
    const asgnKey = (a: ResourceAssignment, taskNames: Map<string, string>, resNames: Map<string, string>): string | null => {
      const t = taskNames.get(a.taskId);
      const r = resNames.get(a.resourceId);
      return t && r ? `${t} :: ${r}` : null;
    };
    const xmlAsgnByKey = new Map<string, ResourceAssignment[]>();
    for (const a of xml.assignments) {
      const k = asgnKey(a, xmlTaskName, xmlResName);
      if (!k) continue;
      const arr = xmlAsgnByKey.get(k) ?? [];
      arr.push(a);
      xmlAsgnByKey.set(k, arr);
    }
    let asgnMatched = 0, unitsOk = 0;
    const asgnDiag: string[] = [];
    for (const a of mpp.assignments) {
      const k = asgnKey(a, mppTaskName, mppResName);
      if (!k) continue;
      const queue = xmlAsgnByKey.get(k);
      const xa = queue && queue.length > 0 ? queue.shift() : undefined;
      if (!xa) continue;
      asgnMatched++;
      if (Math.abs(a.unitsPerDay - xa.unitsPerDay) < 0.001) unitsOk++;
      else asgnDiag.push(`${k}: units mpp=${a.unitsPerDay} xml=${xa.unitsPerDay}`);
    }
    truthy(`[T7 ${hash}] assignments: alle op naam gematchte paren hebben gelijke units (${unitsOk}/${asgnMatched})`, unitsOk === asgnMatched);
    truthy(`[T7 ${hash}] assignments: alle assignments zijn op naam gematcht (${asgnMatched}/${mpp.assignments.length})`, asgnMatched === mpp.assignments.length);

    softChecksRelationsTotal += relMatched * 2; // type-ok + lag-ok, elk relMatched-tellingen
    softChecksResourcesTotal += resMatched + maxUnitsOk; // naam-ok + maxUnits-ok
    softChecksAssignmentsTotal += unitsOk;
    console.log(
      `   . [T7 ${hash}] relaties=${mpp.sequences.length} (${relMatched} gematcht, ${relTypeOk} type-ok, ${relLagOk} lag-ok) `
      + `resources=${mpp.resources.length} (${resMatched} niet-plaatshouder naam-ok, ${maxUnitsOk} maxUnits-ok, ${typeMismatches}/${typeBudget} type-afwijkingen) `
      + `assignments=${mpp.assignments.length} (${asgnMatched} gematcht, ${unitsOk} units-ok):`,
    );
    // F5 (eindreview): deze detailregels bevatten corpus-resourcenamen/-waarden — alleen op
    // expliciet verzoek naar stdout (CI-logs en transcripts zijn publiek oppervlak, §2/§8).
    if (process.env.OPS_MPP_DIAG === 'detail') {
      for (const d of [...relDiag, ...resDiag, ...asgnDiag]) console.log(`      · ${d}`);
    } else if (relDiag.length + resDiag.length + asgnDiag.length > 0) {
      console.log(`      · ${relDiag.length + resDiag.length + asgnDiag.length} detailregel(s) verborgen — zet OPS_MPP_DIAG=detail om ze te tonen (corpusinhoud)`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// T7-crawl — breed corpus (49 `.mpp`): geen-crash/plausibiliteitspoort + gemeten totaalbasislijnen
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  const CRAWL = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-mpp';
  if (!existsSync(CRAWL)) {
    console.log('OK  mpp-relations: T7-crawl niet aanwezig (OPS_MPP_CRAWL) — crawlsectie overgeslagen');
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
      console.log(`OK  mpp-relations: T7-crawl-map aanwezig maar geen .mpp-bestanden erin (${CRAWL}) — crawlsectie overgeslagen`);
    } else {
      // Gemeten basislijnen (2026-08-14, dit corpus, 49 bestanden, deze code): 604 relaties, 175
      // resources, 320 assignments SAMEN over alle bestanden. `>=` (geen `===`, zie check-mpp-
      // calendars.ts se crawl-sectie voor hetzelfde precedent): een toekomstige verbetering mag deze
      // laten stijgen zonder de poort te breken; een regressie laat 'm zakken en faalt hier.
      const CRAWL_RELATIONS_BASELINE = 604;
      const CRAWL_RESOURCES_BASELINE = 175;
      const CRAWL_ASSIGNMENTS_BASELINE = 320;
      // T7-kwaliteitsreview (M4): LABOR/MATERIAL-telling over dezelfde 49 bestanden — pint de B7-
      // Fixed2Meta-heuristiek (`FixedMeta.withHeuristicItemSize`) breder dan de drie ground-truth-
      // bestanden alleen. Gemeten: 157 LABOR, 18 MATERIAL (175 totaal, klopt met de resource-
      // basislijn hierboven). `>=` op elke teller apart (niet een gecombineerde som — een regressie
      // die LABOR laat zakken terwijl MATERIAL toevallig evenveel stijgt zou een enkele-som-poort
      // niet vangen).
      const CRAWL_LABOR_BASELINE = 157;
      const CRAWL_MATERIAL_BASELINE = 18;

      let totalRelations = 0, totalResources = 0, totalAssignments = 0, totalLabor = 0, totalMaterial = 0, readFailures = 0;
      for (const file of crawlFiles) {
        try {
          const r = readMPP(new Uint8Array(readFileSync(file)));
          totalRelations += r.sequences.length;
          totalResources += r.resources.length;
          totalAssignments += r.assignments.length;
          for (const res of r.resources) {
            if (res.type === 'LABOR') totalLabor++;
            else if (res.type === 'MATERIAL') totalMaterial++;
          }
        } catch (err) {
          readFailures++;
          checks++;
          diffs.push(`[T7-crawl] readMPP gooide onverwacht op ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      truthy(`[T7-crawl] geen leesfouten over ${crawlFiles.length} bestanden`, readFailures === 0);
      truthy(`[T7-crawl] totaal relaties > 0 (${totalRelations})`, totalRelations > 0);
      truthy(`[T7-crawl] totaal resources > 0 (${totalResources})`, totalResources > 0);
      truthy(`[T7-crawl] totaal assignments > 0 (${totalAssignments})`, totalAssignments > 0);
      truthy(`[T7-crawl] relaties op/boven de gemeten basislijn (${totalRelations}/${CRAWL_RELATIONS_BASELINE})`, totalRelations >= CRAWL_RELATIONS_BASELINE);
      truthy(`[T7-crawl] resources op/boven de gemeten basislijn (${totalResources}/${CRAWL_RESOURCES_BASELINE})`, totalResources >= CRAWL_RESOURCES_BASELINE);
      truthy(`[T7-crawl] assignments op/boven de gemeten basislijn (${totalAssignments}/${CRAWL_ASSIGNMENTS_BASELINE})`, totalAssignments >= CRAWL_ASSIGNMENTS_BASELINE);
      truthy(`[T7-crawl] resourcetype LABOR op/boven de gemeten basislijn (${totalLabor}/${CRAWL_LABOR_BASELINE})`, totalLabor >= CRAWL_LABOR_BASELINE);
      truthy(`[T7-crawl] resourcetype MATERIAL op/boven de gemeten basislijn (${totalMaterial}/${CRAWL_MATERIAL_BASELINE})`, totalMaterial >= CRAWL_MATERIAL_BASELINE);
      console.log(
        `   . [T7-crawl] ${crawlFiles.length} bestanden: relaties=${totalRelations} (basislijn ${CRAWL_RELATIONS_BASELINE}), `
        + `resources=${totalResources} (basislijn ${CRAWL_RESOURCES_BASELINE}, LABOR=${totalLabor}/${CRAWL_LABOR_BASELINE} MATERIAL=${totalMaterial}/${CRAWL_MATERIAL_BASELINE}), `
        + `assignments=${totalAssignments} (basislijn ${CRAWL_ASSIGNMENTS_BASELINE})`,
      );
    }
  }
}

// ── Uitslag ────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(
    `OK  mpp-relations: alle checks groen (${checks} hard + ${softChecksRelationsTotal} relatie-paar-tellingen `
    + `+ ${softChecksResourcesTotal} resource-paar-tellingen + ${softChecksAssignmentsTotal} assignment-paar-tellingen)`,
  );
  process.exit(0);
} else {
  console.log(`XX  mpp-relations: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
