#!/usr/bin/env node
/**
 * Generates IFC file from Oosterhoutse Baai planning PDF data.
 * Run with: node scripts/generate-oosterhoutse-baai.mjs
 */

import { writeFileSync } from 'fs';

// ====== TASK DATA extracted from PDF ======
// Format: [id, name, startDate, endDate, parentId, isMilestone]
const tasks = [
  // --- Aankoop en overdracht ---
  [1, 'Aankoop en overdracht', '2024-02-09', '2024-10-14', null],
  [2, 'Aankoop en overeenkomst', '2024-02-09', '2024-10-14', 1],
  [3, 'Voorlopige gunning', '2024-09-23', '2024-09-23', 1, true],
  [4, 'Definitieve gunning', '2024-02-09', '2024-04-09', 1],
  [5, 'Indienen plan', '2024-07-08', '2024-07-08', 1, true],
  [6, 'Presenteren plan', '2024-07-09', '2024-07-09', 1, true],
  [7, 'Voorlopige gunningsbeslissing', '2024-09-23', '2024-09-23', 1, true],
  [8, 'Definitieve gunningsbeslissing', '2024-10-14', '2024-10-14', 1, true],

  // --- Definitief ontwerp ---
  [9, 'Definitief ontwerp', '2024-10-15', '2025-01-20', null],
  [10, 'Vaststellen eventuele bijstellen en startdocument', '2024-10-15', '2024-10-28', 9],
  [11, 'Doorvoeren wijzigingen in ontwerp', '2024-10-29', '2024-11-11', 9],
  [12, 'Bouwfysica en bouwbesluittoets', '2024-11-12', '2024-12-09', 9],
  [13, 'Constructieberekeningen en tekeningen', '2024-11-12', '2024-12-09', 9],
  [14, 'Installatieadviezen', '2024-11-12', '2024-12-09', 9],
  [15, 'Bijstellen bouwkundige stukken', '2024-12-10', '2024-12-16', 9],
  [16, 'Begroting', '2024-12-19', '2025-01-13', 9],
  [17, 'Vaststellen stukken voor aanvraag omgevingsvergunning', '2025-01-14', '2025-01-20', 9],

  // --- Uitvoerings ontwerp ---
  [18, 'Uitvoerings ontwerp', '2025-01-21', '2025-10-14', null],
  [19, 'Maken Technisch model', '2025-01-21', '2025-02-17', 18],
  [20, 'Maken uitvoeringstekeningen per type', '2025-02-04', '2025-03-03', 18],
  [21, 'Constructieve tekeningen en waperingstekeningen per type', '2025-02-04', '2025-03-03', 18],
  [22, 'Bouwkundige details per type', '2025-03-04', '2025-03-31', 18],
  [23, 'Woningspecifieke wijzigingen doorvoeren', '2025-04-01', '2025-10-14', 18],

  // --- Vergunningen ---
  [24, 'Vergunningen', '2025-01-21', '2025-05-15', null],
  [25, 'Indienen aanvraag omgevingsvergunning', '2025-01-21', '2025-01-27', 24],
  [26, 'Behandeltermijn', '2025-01-28', '2025-03-24', 24],
  [27, 'Ter inzagelegging', '2025-03-25', '2025-05-08', 24],
  [28, 'Vergunning onherroepelijk', '2025-05-09', '2025-05-15', 24, true],

  // --- Verkoop ---
  [29, 'Verkoop', '2025-01-21', '2026-04-23', null],
  [30, 'Produceren verkoopstukken', '2025-01-21', '2025-02-10', 29],
  [31, 'Verkoopvoorbereiding', '2025-02-11', '2025-03-03', 29],
  [32, 'Start verkoop', '2025-03-04', '2025-03-04', 29, true],
  [33, 'Verkooptijd tot min. 80% verkocht (per fase)', '2025-03-04', '2025-04-14', 29],
  [34, 'Mijlpaal 80% verkocht => is bouwen', '2025-04-14', '2025-04-14', 29, true],
  [35, 'Koperskeuze traject (1e won)', '2025-03-25', '2025-06-05', 29],
  [36, 'Grondoverdracht van gemeente naar ontwikkelaar', '2025-06-03', '2025-04-23', 29],
  [37, 'Grondoverdracht van ontwikkelaar naar kopers', '2025-06-03', '2026-04-23', 29],
  [38, 'Start bouw', '2025-06-06', '2025-06-06', 29, true],

  // --- Realisatie ---
  [39, 'Realisatie', '2025-04-15', '2027-03-19', null],
  [40, 'FASE 1', '2025-04-15', '2026-04-21', 39],
  [41, 'Realisatie woningen fase 1', '2025-04-15', '2026-04-21', 40],

  // --- Bouwvoorbereiding ---
  [42, 'Bouwvoorbereiding', '2025-04-15', '2025-05-22', 41],
  [43, 'Bouwplaatsinrichting incl. Hellingbaan', '2025-05-16', '2025-06-10', 41],

  // --- Woningen fase 1 ---
  [44, 'Woning 1', '2025-06-06', '2025-11-28', 41],
  [45, 'Woning 2', '2025-06-23', '2025-12-12', 41],
  [46, 'Woning 3', '2025-07-07', '2026-01-09', 41],
  [47, 'Woning 4', '2025-07-21', '2026-01-23', 41],
  [48, 'Woning 5', '2025-08-25', '2026-02-06', 41],
  [49, 'Woning 6', '2025-09-08', '2026-02-20', 41],
  [50, 'Woning 7', '2025-09-22', '2026-03-06', 41],
  [51, 'Woning 8', '2025-10-06', '2026-03-20', 41],
  [52, 'Woning 9', '2025-10-20', '2026-04-07', 41],
  [53, 'Woning 10', '2025-11-03', '2026-04-21', 41],

  // --- Realisatie steigers fase 1 ---
  [54, 'Realisatie steigers fase 1', '2025-06-23', '2025-11-14', 40],
  [55, 'Aanbrengen afmeervoorziening fase 1 + afbouwlocatie (steiger 0, 1 en 2)', '2025-06-23', '2025-07-11', 54],
  [56, 'Drijvend steiger 0', '2025-07-14', '2025-08-01', 54],
  [57, 'Drijvend steiger 1', '2025-08-25', '2025-10-24', 54],
  [58, 'Drijvend steiger 2', '2025-09-15', '2025-11-14', 54],

  // --- Openbaar ruimte fase 1 ---
  [59, 'Openbaar ruimte fase 1', '2025-05-16', '2025-11-14', 40],
  [60, 'Aanleg infra', '2025-05-16', '2025-06-10', 59],
  [61, 'Kabels en leidingen (NUTS)', '2025-05-16', '2025-07-01', 59],
  [62, 'Landhoofd brug (1, 2 en 4)', '2025-07-21', '2025-09-12', 59],
  [63, 'Meterkasten en aansluiten (steiger 1 en 2)', '2025-09-08', '2025-09-19', 59],
  [64, 'Bekabeling en verlichting', '2025-09-22', '2025-10-17', 59],
  [65, 'Oevers', '2025-09-29', '2025-10-17', 59],
  [66, 'Verharding', '2025-10-13', '2025-10-31', 59],
  [67, 'Beplanting', '2025-10-27', '2025-11-14', 59],

  // --- FASE 2 ---
  [68, 'FASE 2', '2025-11-17', '2026-10-02', 39],
  [69, 'Realisatie woningen fase 2', '2025-11-17', '2026-10-02', 68],
  [70, 'Woning 11', '2025-11-17', '2026-05-05', 69],
  [71, 'Woning 12', '2025-12-01', '2026-05-21', 69],
  [72, 'Woning 13', '2025-12-15', '2026-06-05', 69],
  [73, 'Woning 14', '2026-01-12', '2026-06-19', 69],
  [74, 'Woning 15', '2026-01-26', '2026-07-03', 69],
  [75, 'Woning 16', '2026-02-09', '2026-07-17', 69],
  [76, 'Woning 17', '2026-02-23', '2026-07-31', 69],
  [77, 'Woning 18', '2026-03-09', '2026-09-04', 69],
  [78, 'Woning 19', '2026-03-23', '2026-09-18', 69],
  [79, 'Woning 20', '2026-04-06', '2026-10-02', 69],

  // --- Realisatie steigers fase 2 ---
  [80, 'Realisatie steigers fase 2', '2026-01-05', '2026-04-21', 68],
  [81, 'Aanbrengen afmeervoorziening fase 2 en 3 (steiger 3, 4 en 5)', '2026-01-05', '2026-01-23', 80],
  [82, 'Drijvend steiger 3', '2026-01-26', '2026-03-27', 80],
  [83, 'Drijvend steiger 4', '2026-02-16', '2026-04-21', 80],

  // --- Openbaar ruimte fase 2 ---
  [84, 'Openbaar ruimte fase 2', '2026-02-02', '2026-04-21', 68],
  [85, 'Landhoofd brug (steiger 3 en 4)', '2026-02-02', '2026-02-13', 84],
  [86, 'Meterkasten en aansluiten (steiger 3 en 4)', '2026-02-09', '2026-02-20', 84],
  [87, 'Bekabeling en verlichting', '2026-02-23', '2026-03-20', 84],
  [88, 'Oevers', '2026-03-02', '2026-03-20', 84],
  [89, 'Verharding', '2026-03-16', '2026-04-07', 84],
  [90, 'Beplanting', '2026-03-30', '2026-04-21', 84],

  // --- Openbaar gebied fase 2 ---
  [91, 'Openbaar gebied fase 2', '2026-02-09', '2026-04-21', 68],
  [92, 'Grondverzet', '2026-02-09', '2026-02-27', 91],
  [93, 'Bekabeling en verlichting', '2026-02-23', '2026-03-20', 91],
  [94, 'Oevers', '2026-03-02', '2026-03-20', 91],
  [95, 'Verharding', '2026-03-16', '2026-04-07', 91],
  [96, 'Beplanting', '2026-03-30', '2026-04-21', 91],

  // --- FASE 3 ---
  [97, 'FASE 3', '2026-04-22', '2027-03-19', 39],
  [98, 'Realisatie woningen fase 3', '2026-04-22', '2027-03-19', 97],
  [99, 'Woning 21', '2026-04-22', '2026-10-16', 98],
  [100, 'Woning 22', '2026-05-06', '2026-10-30', 98],
  [101, 'Woning 23', '2026-05-22', '2026-11-13', 98],
  [102, 'Woning 24', '2026-06-08', '2026-11-27', 98],
  [103, 'Woning 25', '2026-06-22', '2026-12-11', 98],
  [104, 'Woning 26', '2026-07-06', '2027-01-08', 98],
  [105, 'Woning 27', '2026-07-20', '2027-01-22', 98],
  [106, 'Woning 28', '2026-08-24', '2027-02-19', 98],
  [107, 'Woning 29', '2026-09-07', '2027-03-05', 98],
  [108, 'Woning 30', '2026-09-21', '2027-03-19', 98],

  // --- Verwijderen bouwplaats ---
  [109, 'Verwijderen Bouwplaatsinrichting incl. Hellingbaan', '2026-11-30', '2027-01-08', 97],

  // --- Realisatie steigers fase 3 ---
  [110, 'Realisatie steigers fase 3', '2026-06-22', '2027-03-05', 97],
  [111, 'Drijvend steiger 5', '2026-06-22', '2026-09-11', 110],
  [112, 'Drijvend steiger 6', '2027-01-25', '2027-03-05', 110],

  // --- Openbaar ruimte fase 3 ---
  [113, 'Openbaar ruimte fase 3', '2026-09-29', '2027-03-19', 97],
  [114, 'Landhoofd brug (steiger 5)', '2026-09-29', '2026-10-07', 113],
  [115, 'Meterkasten en aansluiten (steiger 5 en 6)', '2026-10-07', '2027-01-22', 113],
  [116, 'Bekabeling en verlichting', '2027-01-25', '2027-03-19', 113],
  [117, 'Oevers', '2027-02-01', '2027-03-19', 113],
  [118, 'Verharding', '2027-02-15', '2027-03-05', 113],
  [119, 'Beplanting', '2027-03-01', '2027-03-19', 113],

  // --- Openbaar gebied fase 3 ---
  [120, 'Openbaar gebied fase 3', '2027-01-11', '2027-03-19', 97],
  [121, 'Grondverzet', '2027-01-11', '2027-01-29', 120],
  [122, 'Bekabeling en verlichting', '2027-01-25', '2027-02-19', 120],
  [123, 'Oevers', '2027-02-01', '2027-02-19', 120],
  [124, 'Verharding', '2027-02-15', '2027-03-05', 120],
  [125, 'Beplanting', '2027-03-01', '2027-03-19', 120],
];

// Sequences (dependencies visible in the Gantt chart)
// Format: [predecessorId, successorId, type, lagDays]
const sequences = [
  // Aankoop -> Definitief ontwerp
  [8, 10, 'FS', 0],  // Gunningsbeslissing -> Vaststellen
  // Definitief ontwerp chain
  [10, 11, 'FS', 0],
  [11, 12, 'FS', 0],
  [11, 13, 'FS', 0],
  [11, 14, 'FS', 0],
  [12, 15, 'FS', 0],
  [13, 15, 'FS', 0],
  [14, 15, 'FS', 0],
  [15, 16, 'FS', 0],
  [16, 17, 'FS', 0],
  // DO -> UO + Vergunningen + Verkoop
  [17, 19, 'FS', 0],
  [17, 25, 'FS', 0],
  [17, 30, 'FS', 0],
  // UO chain
  [19, 20, 'FS', 0],
  [19, 21, 'FS', 0],
  [20, 22, 'FS', 0],
  [21, 22, 'FS', 0],
  [22, 23, 'FS', 0],
  // Vergunningen chain
  [25, 26, 'FS', 0],
  [26, 27, 'FS', 0],
  [27, 28, 'FS', 0],
  // Verkoop chain
  [30, 31, 'FS', 0],
  [31, 32, 'FS', 0],
  [32, 33, 'FS', 0],
  [33, 34, 'FS', 0],
  // Verkoop -> Bouw
  [34, 42, 'FS', 0],
  [28, 42, 'FS', 0],
  // Bouwvoorbereiding chain
  [42, 43, 'FS', 0],
  [43, 44, 'FS', 0],
  // Woningen fase 1 staggered (SS+2w)
  [44, 45, 'SS', 0],
  [45, 46, 'SS', 0],
  [46, 47, 'SS', 0],
  [47, 48, 'SS', 0],
  [48, 49, 'SS', 0],
  [49, 50, 'SS', 0],
  [50, 51, 'SS', 0],
  [51, 52, 'SS', 0],
  [52, 53, 'SS', 0],
  // Steigers fase 1
  [55, 56, 'FS', 0],
  [56, 57, 'FS', 0],
  [57, 58, 'FS', 0],
  // Openbaar ruimte fase 1
  [60, 61, 'SS', 0],
  [61, 62, 'FS', 0],
  [62, 63, 'FS', 0],
  [63, 64, 'FS', 0],
  [64, 65, 'SS', 0],
  [65, 66, 'FS', 0],
  [66, 67, 'FS', 0],
  // Fase 1 -> Fase 2
  [53, 70, 'SS', 0],
  // Woningen fase 2 staggered
  [70, 71, 'SS', 0],
  [71, 72, 'SS', 0],
  [72, 73, 'SS', 0],
  [73, 74, 'SS', 0],
  [74, 75, 'SS', 0],
  [75, 76, 'SS', 0],
  [76, 77, 'SS', 0],
  [77, 78, 'SS', 0],
  [78, 79, 'SS', 0],
  // Steigers fase 2
  [81, 82, 'FS', 0],
  [82, 83, 'FS', 0],
  // Openbaar ruimte fase 2
  [85, 86, 'SS', 0],
  [86, 87, 'FS', 0],
  [87, 88, 'SS', 0],
  [88, 89, 'FS', 0],
  [89, 90, 'FS', 0],
  // Openbaar gebied fase 2
  [92, 93, 'FS', 0],
  [93, 94, 'SS', 0],
  [94, 95, 'FS', 0],
  [95, 96, 'FS', 0],
  // Fase 2 -> Fase 3
  [79, 99, 'SS', 0],
  // Woningen fase 3 staggered
  [99, 100, 'SS', 0],
  [100, 101, 'SS', 0],
  [101, 102, 'SS', 0],
  [102, 103, 'SS', 0],
  [103, 104, 'SS', 0],
  [104, 105, 'SS', 0],
  [105, 106, 'SS', 0],
  [106, 107, 'SS', 0],
  [107, 108, 'SS', 0],
  // Steigers fase 3
  [111, 112, 'FS', 0],
  // Openbaar ruimte fase 3
  [114, 115, 'FS', 0],
  [115, 116, 'FS', 0],
  [116, 117, 'SS', 0],
  [117, 118, 'FS', 0],
  [118, 119, 'FS', 0],
  // Openbaar gebied fase 3
  [121, 122, 'FS', 0],
  [122, 123, 'SS', 0],
  [123, 124, 'FS', 0],
  [124, 125, 'FS', 0],
];

// ====== IFC GENERATION ======

function workDaysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Math.max(count, 0);
}

function fmtDate(iso) {
  return `'${iso}T07:00:00'`;
}

function fmtEndDate(iso) {
  return `'${iso}T16:00:00'`;
}

function fmtDuration(days) {
  return `'P0Y0M${days}D'`;
}

function esc(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

let stepId = 100;
function nextId() { return stepId++; }

const lines = [];
function emit(id, type, args) {
  lines.push(`#${id}=${type}(${args});`);
}

// Header
const header = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');
FILE_NAME('oosterhoutse-baai-drijvende-woningen.ifc','2024-06-13T10:00:00',('Open Planner Studio'),('OpenAEC Foundation'),'Open Planner Studio 0.1','Open Planner Studio','');
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;`;

// Basic entities
const personId = nextId();
emit(personId, 'IFCPERSON', "$,$,'Geerts','B. van Selm',$,$,$,$");

const orgId = nextId();
emit(orgId, 'IFCORGANIZATION', "$,'Schietfaciliteit Soesterberg',$,$,$");

const personOrgId = nextId();
emit(personOrgId, 'IFCPERSONANDORGANIZATION', `#${personId},#${orgId},$`);

const appId = nextId();
emit(appId, 'IFCAPPLICATION', `#${orgId},'0.1','Open Planner Studio','OPS'`);

const ownerHistId = nextId();
emit(ownerHistId, 'IFCOWNERHISTORY', `#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,0`);

// Units
const unitIds = [];
const u1 = nextId(); emit(u1, 'IFCSIUNIT', `*,.LENGTHUNIT.,$,.METRE.`); unitIds.push(u1);
const u2 = nextId(); emit(u2, 'IFCSIUNIT', `*,.AREAUNIT.,$,.SQUARE_METRE.`); unitIds.push(u2);
const u3 = nextId(); emit(u3, 'IFCSIUNIT', `*,.TIMEUNIT.,$,.SECOND.`); unitIds.push(u3);
const unitAssignId = nextId();
emit(unitAssignId, 'IFCUNITASSIGNMENT', `(${unitIds.map(u=>'#'+u).join(',')})`);

// Project
const ctxPtId = nextId();
emit(ctxPtId, 'IFCCARTESIANPOINT', `(0.,0.,0.)`);
const ctxPlacementId = nextId();
emit(ctxPlacementId, 'IFCAXIS2PLACEMENT3D', `#${ctxPtId},$,$`);
const ctxId = nextId();
emit(ctxId, 'IFCGEOMETRICREPRESENTATIONCONTEXT', `'Model','Model',3,1.0E-5,#${ctxPlacementId},$`);

const projectId = nextId();
emit(projectId, 'IFCPROJECT', `'2A1Bq03dDC2R0RlJos9Qm4',#${ownerHistId},'Ontwikkeling 30 drijvende woningen Oosterhoutseplas','Schietfaciliteit Soesterberg - Geerts',$,$,$,(#${ctxId}),#${unitAssignId}`);

// Work Calendar
const calId = nextId();
emit(calId, 'IFCWORKCALENDAR', `'3C2Dr14eED3S1SmKpt0Rn5',#${ownerHistId},'Standaard NL Werkkalender','Maandag t/m vrijdag, Nederlandse feestdagen',$,$,$,$,.NOTDEFINED.`);

// Work Plan & Schedule
const wpId = nextId();
emit(wpId, 'IFCWORKPLAN', `'4D3Es25fFE4T2TnLqu1So6',#${ownerHistId},'Overall-planning Oosterhoutseplas','Ontwikkeling 30 drijvende woningen',$,$,$,'2024-06-13',$,$,$,$,'2024-02-09T07:00:00','2027-03-19T16:00:00',.ACTUAL.,$,$`);

const wsId = nextId();
emit(wsId, 'IFCWORKSCHEDULE', `'5E4Ft36gGF5U3UoMrv2Tp7',#${ownerHistId},'Hoofdplanning','Overall planning',$,$,$,'2024-06-13',$,$,$,$,'2024-02-09T07:00:00','2027-03-19T16:00:00',.ACTUAL.,$,$`);

// Generate tasks
const taskStepIds = new Map(); // taskId -> step entity id
const taskTimeStepIds = new Map(); // taskId -> step entity id for TaskTime

for (const [id, name, startDate, endDate, parentId, isMilestone] of tasks) {
  const dur = isMilestone ? 0 : workDaysBetween(startDate, endDate);
  const isParent = tasks.some(t => t[4] === id);

  // TaskTime
  const ttId = nextId();
  taskTimeStepIds.set(id, ttId);
  emit(ttId, 'IFCTASKTIME', [
    '$', '.WORKTIME.', '$', '.WORKTIME.',
    fmtDuration(dur),
    fmtDate(startDate),
    fmtEndDate(endDate),
    fmtDate(startDate),
    fmtEndDate(endDate),
    fmtDate(startDate),
    fmtEndDate(endDate),
    fmtDuration(0),
    fmtDuration(0),
    isMilestone ? '.T.' : '.F.',
    '$','$','$','$','$',
    '0.0',
  ].join(','));

  // Task
  const tId = nextId();
  taskStepIds.set(id, tId);

  // WBS code
  let wbs = `${id}`;
  if (parentId) {
    const parentTask = tasks.find(t => t[0] === parentId);
    if (parentTask) {
      const siblings = tasks.filter(t => t[4] === parentId);
      const idx = siblings.findIndex(t => t[0] === id);
      wbs = `${parentId}.${idx + 1}`;
    }
  }

  emit(tId, 'IFCTASK', [
    `'${String(id).padStart(4,'0')}uid${String(id).padStart(8,'0')}'`,
    `#${ownerHistId}`,
    esc(name),
    '$', '$',
    esc(wbs),
    '$',
    `'${isMilestone ? 'Milestone' : (isParent ? 'Summary' : 'Active')}'`,
    '$',
    isMilestone ? '.T.' : '.F.',
    `#${ttId}`,
    '.CONSTRUCTION.',
  ].join(','));
}

// Nesting relations (parent-child)
const parentGroups = new Map();
for (const [id, , , , parentId] of tasks) {
  if (parentId !== null) {
    if (!parentGroups.has(parentId)) parentGroups.set(parentId, []);
    parentGroups.get(parentId).push(id);
  }
}

for (const [parentId, childIds] of parentGroups) {
  const nestId = nextId();
  const parentStepId = taskStepIds.get(parentId);
  const childRefs = childIds.map(cid => `#${taskStepIds.get(cid)}`).join(',');
  emit(nestId, 'IFCRELNESTS', `'${nestId}nest${parentId}',#${ownerHistId},$,$,#${parentStepId},(${childRefs})`);
}

// Root tasks nested under WorkSchedule
const rootTasks = tasks.filter(t => t[4] === null);
const rootNestId = nextId();
const rootRefs = rootTasks.map(t => `#${taskStepIds.get(t[0])}`).join(',');
emit(rootNestId, 'IFCRELNESTS', `'${rootNestId}nestroot',#${ownerHistId},$,$,#${wsId},(${rootRefs})`);

// Sequences
for (const [predId, succId, type, lag] of sequences) {
  const seqId = nextId();
  const predStepId = taskStepIds.get(predId);
  const succStepId = taskStepIds.get(succId);
  if (!predStepId || !succStepId) {
    console.warn(`Missing task step ID for seq ${predId} -> ${succId}`);
    continue;
  }

  let lagRef = '$';
  if (lag > 0) {
    const lagEntityId = nextId();
    emit(lagEntityId, 'IFCLAGTIME', `$,.WORKTIME.,$,.WORKTIME.,${fmtDuration(lag)}`);
    lagRef = `#${lagEntityId}`;
  }

  const seqType = type === 'SS' ? '.START_START.' :
                  type === 'FF' ? '.FINISH_FINISH.' :
                  type === 'SF' ? '.START_FINISH.' : '.FINISH_START.';

  emit(seqId, 'IFCRELSEQUENCE', `'${seqId}seq${predId}to${succId}',#${ownerHistId},$,$,#${predStepId},#${succStepId},${lagRef},${seqType},$`);
}

// Assemble file
const output = [
  header,
  '',
  '/* === Basis entiteiten === */',
  ...lines,
  '',
  'ENDSEC;',
  'END-ISO-10303-21;',
  '',
].join('\n');

// Write files
writeFileSync('examples/oosterhoutse-baai-drijvende-woningen.ifc', output);
writeFileSync('public/examples/oosterhoutse-baai-drijvende-woningen.ifc', output);
console.log(`Generated IFC with ${tasks.length} tasks, ${sequences.length} sequences`);
console.log(`Total STEP entities: ${lines.length}`);
console.log(`Written to examples/ and public/examples/`);
