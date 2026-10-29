// De IFC-lezer leest BEIDE indelingen: de oude OPS-indeling (zie docs/ifc-round-trip.md, alinea
// Schemageldigheid) en het schema (zoals OPS nu schrijft en zoals andere tools schrijven). Herkenning op
// de argumenten (`ifcWorkControlSlots.ts`), niet op een gok.
// Tegenhanger van de schemapoort `check-ifc-schema.ts`; toelichting in docs/ifc-round-trip.md.
//
//   A. Hetzelfde rijke project, eenmaal in de norm geschreven en eenmaal omgezet naar de oude
//      OPS-indeling (IfcWorkPlan/IfcWorkSchedule 15 attributen, resources 9 met `.USERDEFINED.`,
//      IfcWorkCalendar 8 zonder `Identification`, REAL zonder punt, Completion `0.00`), leest exact
//      gelijk. De kop blijft staan: sinds #292 is hij projectdata (`Project.ifcSchema`, eigen toets in
//      check-ifc-schema-question.ts). Ook zonder de OPS_ProjectSettings-datums, zodat de projectdatums
//      echt uit het IfcWorkPlan-slot komen. De kalenders (project, bibliotheek, uurkalender, ploegen,
//      feestdagen, werkende uitzonderingen) vallen onder A1.
//   B. Een geldig bestand van een andere tool (indeling zoals bSI/xbim `construction-scheduling-task`):
//      de projectstart komt uit IfcWorkPlan.StartTime (index 11), maar niet later dan de vroegste
//      INGELEZEN taakstart (een taak zonder ScheduleStart telt niet mee); taken onder een `.BASELINE.`-IfcWorkSchedule (index 13) zijn geen live taken.
//   C. Een IFC2X3-indeling (ook 15 attributen, maar de enum op index 13 en de tijden als verwijzing):
//      geen verzonnen datum uit een verwijzing, en `.BASELINE.` op index 13 telt.
//   D. De kalender uit dat bSI/xbim-bestand (IfcWorkCalendar met 9 attributen, ma–vr 08:00–16:00):
//      die werktijd komt binnen. Vóór de fix kwam de standaardweek (07:00–16:00) binnen.
//
// Draait via run.sh. Exit 0 = alles groen.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import type { ImportResult } from '@/services/importTypes';
import { buildRichSchemaProject } from './ifcSchemaFixture';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');

let checks = 0;
const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) fails.push(label); };

/** Splitst de argumenten van één STEP-regel op het hoogste niveau (strings en haakjes respecterend). */
function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inStr) {
      cur += c;
      if (c === "'") {
        if (inner[i + 1] === "'") { cur += "'"; i++; } else inStr = false;
      }
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** Past `edit(type, args)` toe op elke `#id=IFCXXX(...);`-regel. */
function mapEntities(ifc: string, edit: (type: string, args: string[]) => string[] | undefined): string {
  return ifc.split('\n').map((line) => {
    const m = /^(#\d+=)([A-Z0-9]+)\((.*)\);$/.exec(line);
    if (!m) return line;
    const next = edit(m[2], splitArgs(m[3]));
    return next ? `${m[1]}${m[2]}(${next.join(',')});` : line;
  }).join('\n');
}

const RESOURCES = new Set([
  'IFCLABORRESOURCE', 'IFCCONSTRUCTIONEQUIPMENTRESOURCE', 'IFCCONSTRUCTIONMATERIALRESOURCE',
  'IFCSUBCONTRACTRESOURCE', 'IFCCREWRESOURCE',
]);

/**
 * Zet een bestand van de huidige writer om naar de indeling die OPS t/m v2026.9.0 schreef (de initiële
 * release schreef al zo). Alleen de attributen; de kop blijft (zie de kop van dit bestand).
 */
function toLegacyOpsLayout(ifc: string): string {
  const out = mapEntities(ifc, (type, args) => {
    if (type === 'IFCWORKPLAN' || type === 'IFCWORKSCHEDULE') {
      if (args.length !== 14) throw new Error(`${type} heeft geen 14 attributen`);
      // Een baseline-werkschema had StartTime `$`; daarna de extra `$` vóór StartTime.
      const start = args[13] === '.BASELINE.' ? '$' : args[11];
      return [...args.slice(0, 11), '$', start, args[12], args[13]];
    }
    if (RESOURCES.has(type)) {
      if (args.length !== 11) throw new Error(`${type} heeft geen 11 attributen`);
      return [...args.slice(0, 4), '$', '$', '$', '$', '.USERDEFINED.'];
    }
    if (type === 'IFCWORKCALENDAR') {
      // Zonder `Identification` (index 5, altijd `$` bij OPS).
      if (args.length !== 9 || args[5] !== '$') throw new Error('IFCWORKCALENDAR heeft geen 9 attributen met `$` op index 5');
      return [...args.slice(0, 5), ...args.slice(6)];
    }
    if (type === 'IFCTASKTIME' && args[19] === '$') return [...args.slice(0, 19), '0.00'];
    if (type === 'IFCTASK') {
      const next = [...args];
      if (next[2] === "''") next[2] = '$';
      if (next[4] === "'USERDEFINED'") next[4] = '$';
      return next;
    }
    return undefined;
  });
  return out.replace(/\b(IFCREAL|IFCMONETARYMEASURE|IFCRATIOMEASURE)\((-?\d+)\.\)/g, '$1($2)');
}

/** Leesresultaat zonder wat per keer lezen verschilt (toewijzings-id's komen uit `generateId`). */
function canon(r: ImportResult): string {
  return JSON.stringify({ ...r, assignments: r.assignments.map(a => ({ ...a, id: '' })) });
}

/** Eerste verschil tussen twee JSON-bomen, als pad, voor een leesbare foutmelding. */
function firstDiff(a: unknown, b: unknown, path = ''): string | undefined {
  if (JSON.stringify(a) === JSON.stringify(b)) return undefined;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`;
}

// ── A. Oude OPS-indeling en de norm lezen gelijk ─────────────────────────────────────────────────
{
  const rich = buildRichSchemaProject(ROOT);
  // Een lege tekstwaarde schrijft de writer als `IFCTEXT('')`; de oude writer schreef het ongeldige
  // `IFCTEXT($)`, dat als "geen waarde" las. Een bewuste verbetering, dus hier niet in de vergelijking.
  const input: ImportResult = {
    ...rich,
    tasks: rich.tasks.map(t => {
      if (t.customFields?.['sf-text'] !== '') return t;
      const { 'sf-text': _drop, ...customFields } = t.customFields;
      void _drop;
      return { ...t, customFields };
    }),
  };
  const modern = writeIFC(input);
  const legacy = toLegacyOpsLayout(modern);
  const argCounts = (ifc: string, type: string) => {
    const counts: number[] = [];
    mapEntities(ifc, (t, args) => { if (t === type) counts.push(args.length); return undefined; });
    return counts;
  };
  eq('A0 omzetting raakt het werkplan (15 attributen)', argCounts(legacy, 'IFCWORKPLAN'), [15]);
  eq('A0 de norm: werkplan met 14 attributen', argCounts(modern, 'IFCWORKPLAN'), [14]);
  ok('A0 omzetting raakt de resources (9 attributen, .USERDEFINED.)', /IFCLABORRESOURCE\([^\n]*,\$,\$,\$,\$,\.USERDEFINED\.\);/.test(legacy));
  ok('A0 omzetting raakt de REAL-waarden (zonder punt)', /IFCREAL\(\d+\)/.test(legacy) && !/IFCREAL\(\d+\.\)/.test(legacy));
  ok('A0 omzetting raakt Completion (0.00)', legacy.includes(',0.00);'));
  // Eén IfcWorkCalendar per kalender: de projectkalender en de bibliotheekkalenders.
  const calendarCount = 1 + (input.resourceCalendars ?? []).length;
  ok('A0 setup: het rijke project heeft bibliotheekkalenders', calendarCount >= 4);
  eq('A0 omzetting raakt de kalenders (8 attributen)', argCounts(legacy, 'IFCWORKCALENDAR'), Array(calendarCount).fill(8));
  eq('A0 de norm: kalenders met 9 attributen', argCounts(modern, 'IFCWORKCALENDAR'), Array(calendarCount).fill(9));
  const readCalendars = (r: ImportResult) => [r.calendar, ...(r.resourceCalendars ?? [])];
  const richCalendars = readCalendars(readIFC(modern));
  ok('A0 setup: de kalenders dragen feestdagen, werkende uitzonderingen, ploegen en een uurweek',
    richCalendars.some(c => c.holidays.length > 0) && richCalendars.some(c => (c.workingExceptions ?? []).length > 0)
    && richCalendars.some(c => c.shift === 'THIRD') && richCalendars.some(c => c.shift === 'USERDEFINED')
    && richCalendars.some(c => !!c.workTime));

  const readModern = readIFC(modern);
  const readLegacy = readIFC(legacy);
  const diff = firstDiff(JSON.parse(canon(readModern)), JSON.parse(canon(readLegacy)));
  ok(`A1 rijk project: oude OPS-indeling leest gelijk aan de norm${diff ? ` — eerste verschil ${diff}` : ''}`, !diff);

  // Zonder de OPS_ProjectSettings-datums (zoals een bestand van vóór die pset, of een ander tool):
  // dan komen projectstart en -einde uit IfcWorkPlan.StartTime/FinishTime, in beide indelingen.
  const strip = (ifc: string) => ifc.replace("'ProjectStartDate'", "'OnbekendVeld1'").replace("'ProjectEndDate'", "'OnbekendVeld2'");
  // Expliciete lezerankers, onafhankelijk van de omvang die writeIFC uit getoonde taken afleidt.
  // De start ligt vóór alle taak-invoer, zodat de projectstart-vloer hem niet vervangt. Het einde
  // verschilt van invoer én berekende taken; verkeerde slotposities kunnen zo niet toevallig slagen.
  const planStart = '2026-02-03';
  const planEnd = '2030-08-17';
  ok('A2 fixture: werkplanstart ligt vóór de ingelezen taakstarts',
    input.tasks.every(t => !t.time.scheduleStart || planStart < t.time.scheduleStart.slice(0, 10)));
  const anchoredModern = mapEntities(modern, (type, args) => type === 'IFCWORKPLAN'
    ? [...args.slice(0, 11), "'2026-02-03T07:00:00'", "'2030-08-17T07:00:00'", ...args.slice(13)]
    : undefined);
  const anchoredLegacy = toLegacyOpsLayout(anchoredModern);
  eq('A2 fixture: werkplan houdt de schema-ariteit', argCounts(anchoredModern, 'IFCWORKPLAN'), [14]);
  eq('A3 fixture: oud werkplan houdt de oude ariteit', argCounts(anchoredLegacy, 'IFCWORKPLAN'), [15]);
  for (const [label, text] of [['norm', anchoredModern], ['oud', anchoredLegacy]] as const) {
    const p = readIFC(text).project;
    eq(`A1 ${label}: contractuele projectinvoer wint van andere werkplanankers`,
      [p.startDate, p.endDate], [input.project.startDate, input.project.endDate]);
  }
  const plainModern = readIFC(strip(anchoredModern));
  const plainLegacy = readIFC(strip(anchoredLegacy));
  eq('A2 norm zonder pset: projectstart uit IfcWorkPlan.StartTime (index 11)', plainModern.project.startDate, planStart);
  eq('A2 norm zonder pset: projecteinde uit IfcWorkPlan.FinishTime (index 12)', plainModern.project.endDate, planEnd);
  eq('A3 oude indeling zonder pset: projectstart uit index 12', plainLegacy.project.startDate, planStart);
  eq('A3 oude indeling zonder pset: projecteinde uit index 13', plainLegacy.project.endDate, planEnd);
  const diff2 = firstDiff(JSON.parse(canon(plainModern)), JSON.parse(canon(plainLegacy)));
  ok(`A4 zonder pset: oude indeling leest gelijk aan de norm${diff2 ? ` — eerste verschil ${diff2}` : ''}`, !diff2);
  // Het werkschema-GlobalId (anker voor 4D-koppelingen) is dat van het niet-baseline-schema.
  const wsGuid = /IFCWORKSCHEDULE\('([^']+)',[^\n]*\.PLANNED\.\);/.exec(modern)?.[1];
  ok('A5 setup: het niet-baseline-werkschema staat in het bestand', !!wsGuid);
  eq('A5 GlobalId van het werkschema (norm)', readModern.ifcGlobalIds?.[`ws:${readModern.project.id}`], wsGuid);
  eq('A5 GlobalId van het werkschema (oude indeling)', readLegacy.ifcGlobalIds?.[`ws:${readLegacy.project.id}`], wsGuid);
}

// ── B/C. Bestanden van andere tools ──────────────────────────────────────────────────────────────

/** Minimaal planningsbestand; `plan`/`schedules` zijn de IfcWorkPlan- en IfcWorkSchedule-regels. */
function foreignFile(schema: string, plan: string, schedules: string[], nests: string[]): string {
  return [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('x.ifc','2026-10-13T00:00:00',(''),(''),'','','');",
    `FILE_SCHEMA(('${schema}'));`, 'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('3x9fqFQJ5Bmv2kNtW0sQ0a',$,'Extern',$,$,$,$,$,$);",
    plan,
    ...schedules,
    "#20=IFCTASKTIME('Live Time',$,$,.WORKTIME.,'P5D','2010-10-04T08:00:00','2010-10-08T16:00:00',$,$,$,$,$,$,$,$,$,$,$,$,$);",
    "#21=IFCTASK('1PvbZ4lhv8QPYrhvdzM8Jg',$,'Live taak',$,$,'A',$,$,$,.F.,$,#20,.CONSTRUCTION.);",
    "#22=IFCTASKTIME('Basis Time',$,$,.WORKTIME.,'P5D','2010-09-27T08:00:00','2010-10-01T16:00:00',$,$,$,$,$,$,$,$,$,$,$,$,$);",
    "#23=IFCTASK('2B8yE8mTn1mAnyUFh2s$3b',$,'Baselinetaak',$,$,'B',$,$,$,.F.,$,#22,.CONSTRUCTION.);",
    ...nests,
    'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n');
}

{
  // B. Norm (IFC 4 / 4.3): 14 attributen, StartTime op 11, PredefinedType op 13.
  const ifc = foreignFile('IFC4X3_ADD2',
    "#10=IFCWORKPLAN('0eVhmaYyb3sBLb0LoNiW62',$,'Work Plan #1',$,$,$,'2010-09-23T16:26:16',$,$,$,$,'2010-09-23T00:00:00',$,$);",
    [
      "#11=IFCWORKSCHEDULE('2LoWUCZHr7YvZks8lmqjcw',$,'Planning',$,$,$,'2010-09-23T16:26:42',$,$,$,$,'2010-09-23T00:00:00',$,.PLANNED.);",
      "#12=IFCWORKSCHEDULE('1Ezw2Gk6v8ufQJ8nB4Zr8m',$,'Basis',$,$,$,'2010-09-20T10:00:00',$,$,$,$,'2010-09-20T00:00:00',$,.BASELINE.);",
    ],
    [
      "#30=IFCRELNESTS('0aQgg3GdP0BB8_2Y5UbS6u',$,$,$,#11,(#21));",
      "#31=IFCRELNESTS('3GmKhDwhD1i9mKk4jZ3h4R',$,$,$,#12,(#23));",
    ]);
  const r = readIFC(ifc);
  // De live taak begint 2010-10-04, ná StartTime: StartTime wint (zoals de kubusbestanden van BlenderBIM).
  eq('B1 norm: projectstart uit IfcWorkPlan.StartTime (index 11) als die vóór de eerste taak valt', r.project.startDate, '2010-09-23');
  // Zoals het bSI/xbim-voorbeeld: StartTime (2010-09-23) valt ná de eerste taak (2010-09-20). Dan wint
  // StartTime niet; anders begonnen de taken via de projectstart-vloer drie dagen later.
  const early = readIFC(ifc.replace("'P5D','2010-10-04T08:00:00','2010-10-08T16:00:00'", "'P5D','2010-09-20T08:00:00','2010-09-24T16:00:00'"));
  eq('B1 testvoorwaarde: de live taak begint nu 2010-09-20', early.tasks[0]?.time.scheduleStart.slice(0, 10), '2010-09-20');
  eq('B1 norm: StartTime ná de eerste taakstart wint niet (de vroegste taakstart)', early.project.startDate, '2010-09-20');
  // Alleen een INGELEZEN taakstart telt. Een taak zonder ScheduleStart (`$`) krijgt bij het lezen eerst
  // de plaatshouder "vandaag"; die mag StartTime niet verdringen. Daarom ligt StartTime hier ná vandaag
  // (2099), en de taak met een start nog later: StartTime blijft staan.
  const future = readIFC(ifc
    .replace("'2010-09-23T00:00:00',$,.PLANNED.);", "'2099-01-05T00:00:00',$,.PLANNED.);")
    .replace("'2010-09-23T00:00:00',$,$);", "'2099-01-05T00:00:00',$,$);")
    .replace("'P5D','2010-10-04T08:00:00','2010-10-08T16:00:00'", "'P5D','2099-02-02T08:00:00','2099-02-06T16:00:00'")
    .replace("#30=IFCRELNESTS('0aQgg3GdP0BB8_2Y5UbS6u',$,$,$,#11,(#21));", [
      "#24=IFCTASKTIME('Zonder start',$,$,.WORKTIME.,'P5D',$,$,$,$,$,$,$,$,$,$,$,$,$,$,$);",
      "#25=IFCTASK('0Xx2uJ8Rn5Bf0pMZp3wQ9k',$,'Taak zonder start',$,$,'C',$,$,$,.F.,$,#24,.CONSTRUCTION.);",
      "#30=IFCRELNESTS('0aQgg3GdP0BB8_2Y5UbS6u',$,$,$,#11,(#21,#25));",
    ].join('\n')));
  eq('B1 testvoorwaarde: twee live taken, één zonder ingelezen start', future.tasks.map(t => t.name), ['Live taak', 'Taak zonder start']);
  eq('B1 norm: een taak zonder ingelezen start verdringt StartTime niet', future.project.startDate, '2099-01-05');
  eq('B2 norm: taak onder het .BASELINE.-werkschema (index 13) is geen live taak', r.tasks.map(t => t.name), ['Live taak']);
  eq('B3 norm: werkschema-GlobalId is dat van het .PLANNED.-schema', r.ifcGlobalIds?.[`ws:${r.project.id}`], '2LoWUCZHr7YvZks8lmqjcw');
}
{
  // C. IFC2X3: IfcWorkControl telt ook 15 attributen, maar met WorkControlType op 13 en
  //    UserDefinedControlType op 14; StartTime/FinishTime zijn verwijzingen (IfcDateTimeSelect).
  const ifc = foreignFile('IFC2X3',
    "#10=IFCWORKPLAN('3jFxrHuvvB9Axuu2YDFOLK',$,'Workplan',$,$,'WP-1',#40,$,$,$,$,#41,$,.PLANNED.,$);",
    [
      "#11=IFCWORKSCHEDULE('3fDfjRHgHEF9k6AoFnMQHP',$,'Planning',$,$,'WS-1',#40,$,$,$,$,#41,$,.PLANNED.,$);",
      "#12=IFCWORKSCHEDULE('1Ezw2Gk6v8ufQJ8nB4Zr8m',$,'Basis',$,$,'WS-2',#40,$,$,$,$,#41,$,.BASELINE.,$);",
    ],
    [
      "#30=IFCRELNESTS('0aQgg3GdP0BB8_2Y5UbS6u',$,$,$,#11,(#21));",
      "#31=IFCRELNESTS('3GmKhDwhD1i9mKk4jZ3h4R',$,$,$,#12,(#23));",
      "#40=IFCCALENDARDATE(23,9,2010);",
      "#41=IFCCALENDARDATE(23,9,2010);",
    ]);
  const r = readIFC(ifc);
  ok(`C1 IFC2X3: geen datum uit een verwijzing (kreeg "${r.project.startDate}")`, !r.project.startDate.startsWith('#'));
  eq('C1 IFC2X3: projectstart = vroegste taakstart (geen WorkPlan-tekst)', r.project.startDate, '2010-10-04');
  eq('C2 IFC2X3: taak onder het .BASELINE.-werkschema (index 13) is geen live taak', r.tasks.map(t => t.name), ['Live taak']);
}

{
  // D. De kalender zoals bSI/xbim (`construction-scheduling-task`) hem schrijft: 9 attributen, Name `$`,
  //    `Identification` `$`, één IfcWorkTime ma–vr 08:00–16:00 zonder datum.
  const ifc = foreignFile('IFC4X3_ADD2',
    "#10=IFCWORKPLAN('0eVhmaYyb3sBLb0LoNiW62',$,'Work Plan #1',$,$,$,'2010-09-23T16:26:16',$,$,$,$,'2010-09-23T00:00:00',$,$);",
    ["#11=IFCWORKSCHEDULE('2LoWUCZHr7YvZks8lmqjcw',$,'Planning',$,$,$,'2010-09-23T16:26:42',$,$,$,$,'2010-09-23T00:00:00',$,.PLANNED.);"],
    [
      "#30=IFCRELNESTS('0aQgg3GdP0BB8_2Y5UbS6u',$,$,$,#11,(#21,#23));",
      "#783=IFCWORKCALENDAR('0LHFCz8r5EQw4GeNNMS$Xp',$,$,$,$,$,(#789),$,.FIRSTSHIFT.);",
      "#787=IFCTIMEPERIOD('08:00:00','16:00:00');",
      "#788=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#787));",
      "#789=IFCWORKTIME('Standard',$,$,#788,$,$);",
    ]);
  const cal = readIFC(ifc).calendar;
  eq('D1 kalender met 9 attributen: ma–vr 08:00–16:00, 8 u',
    [cal.workDays, cal.workStartHour, cal.workEndHour, cal.hoursPerDay], [[1, 2, 3, 4, 5], 8, 16, 8]);
  eq('D2 kalender met 9 attributen: WorkingTimes wordt geen uitzondering', [cal.holidays, cal.workingExceptions ?? []], [[], []]);
}

if (fails.length) {
  for (const f of fails) console.log(`   XX ${f}`);
  console.log(`XX check-ifc-schema-reader: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`OK check-ifc-schema-reader: ${checks}/${checks} groen`);
