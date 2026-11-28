import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { normalizeTaskDates } from '@/state/migrations/minuteModel';
import type { ImportResult } from '@/services/importTypes';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OLD = readFileSync(join(HERE, 'fixtures', 'ifc-arity-oude-writer.ifc'), 'utf8');

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`, isDeepStrictEqual(got, want));
}
function firstDiffs(a: unknown, b: unknown, path = '', out: string[] = []): string[] {
  if (out.length >= 5 || isDeepStrictEqual(a, b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      firstDiffs((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
    }
  } else {
    out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`);
  }
  return out;
}
const comparable = (r: ImportResult): ImportResult => ({ ...r, assignments: r.assignments.map(a => ({ ...a, id: '' })) });
function same(label: string, got: ImportResult, want: ImportResult): void {
  const [g, w] = [comparable(got), comparable(want)];
  ok(`${label}: ${firstDiffs(g, w).join('; ')}`, isDeepStrictEqual(g, w));
}

const RESOURCE_TYPES = ['IFCLABORRESOURCE', 'IFCCONSTRUCTIONEQUIPMENTRESOURCE', 'IFCCONSTRUCTIONMATERIALRESOURCE',
  'IFCSUBCONTRACTRESOURCE', 'IFCCREWRESOURCE'];

function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of inner) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
type Line = { id: string; type: string; args: string[] };
function lines(ifc: string): Line[] {
  const out: Line[] = [];
  for (const l of ifc.split('\n')) {
    const m = /^#(\d+)=([A-Z0-9]+)\((.*)\);$/.exec(l);
    if (m) out.push({ id: m[1], type: m[2], args: splitArgs(m[3]) });
  }
  return out;
}
function arities(ifc: string, types: string[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const t of types) out[t] = [...new Set(lines(ifc).filter(l => l.type === t).map(l => l.args.length))].sort();
  return out;
}
function rewrite(ifc: string, pick: (type: string) => boolean, fn: (args: string[]) => string[]): string {
  return ifc.split('\n').map((l) => {
    const m = /^(#\d+)=([A-Z0-9]+)\((.*)\);$/.exec(l);
    if (!m || !pick(m[2])) return l;
    return `${m[1]}=${m[2]}(${fn(splitArgs(m[3])).join(',')});`;
  }).join('\n');
}
const withoutProjectDates = (ifc: string) => ifc.replace("'ProjectStartDate'", "'Onbekend1'").replace("'ProjectEndDate'", "'Onbekend2'");

const CONTROL = ['IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCWORKCALENDAR', ...RESOURCE_TYPES];
const OLD_ARITY = { IFCWORKPLAN: [15], IFCWORKSCHEDULE: [15], IFCWORKCALENDAR: [8], ...Object.fromEntries(RESOURCE_TYPES.map(t => [t, [9]])) };
const NEW_ARITY = { IFCWORKPLAN: [14], IFCWORKSCHEDULE: [14], IFCWORKCALENDAR: [9], ...Object.fromEntries(RESOURCE_TYPES.map(t => [t, [11]])) };
eq('1 fixture heeft de oude ariteit', arities(OLD, CONTROL), OLD_ARITY);

const rOld = readIFC(OLD);
{
  const lib = (name: 'Tweeploegen' | 'Nachtploeg' | 'Eigen rooster') => (rOld.resourceCalendars ?? []).find(c => c.name === name);
  ok('1a projectkalender: feestdagen gelezen', rOld.calendar.holidays.length > 10);
  eq('1b projectkalender: werkende uitzondering met banden', rOld.calendar.workingExceptions,
    [{ name: 'Inhaalzaterdag', startDate: '2027-06-12', endDate: '2027-06-12', bands: [{ start: 420, end: 720 }] }]);
  eq('1c bibliotheek: ploeg per kalender', [lib('Tweeploegen')?.shift, lib('Nachtploeg')?.shift, lib('Eigen rooster')?.shift],
    ['SECOND', 'THIRD', 'USERDEFINED']);
  ok('1d bibliotheek: tweeploegenkalender is een uurkalender met twee banden',
    lib('Tweeploegen')?.workTime?.byWeekday[1]?.length === 2);
  eq('1e bibliotheek: werkende uitzondering op de tweeploegenkalender', lib('Tweeploegen')?.workingExceptions?.map(e => e.name), ['Zaterdagdienst']);
  eq('1f baselines', (rOld.baselines ?? []).map(b => b.name), ['Baseline plan', 'Herplanning']);
  eq('1g vijf resourcesoorten', [...new Set(rOld.resources.map(r => r.type))].sort(), ['CREW', 'EQUIPMENT', 'LABOR', 'MATERIAL', 'SUBCONTRACTOR']);
  eq('1h contractuele projectinvoer uit het pset, inclusief leeg einde',
    [rOld.project.startDate, rOld.project.endDate], ['2027-05-06', '']);
}

const NEW = writeIFC(rOld);
eq('2a de huidige writer schrijft de schema-ariteit', arities(NEW, CONTROL), NEW_ARITY);
const moments = (r: ImportResult): ImportResult => ({ ...r,
  tasks: r.tasks.map(t => JSON.parse(JSON.stringify(normalizeTaskDates(t, { calendar: r.calendar, calendars: r.resourceCalendars ?? [] })))) });
const rNew = readIFC(writeIFC(moments(rOld)));
eq('2b het oude bestand heeft geen LiteralTimes-markering', rOld.ifcLiteralCalendarIds, undefined);
same('2b oud bestand en nieuw equivalent lezen dezelfde momenten op TimeModel na', moments(rNew), moments({ ...rOld, timeModel: 'MINUTES-1', ifcLiteralCalendarIds: rNew.ifcLiteralCalendarIds }));
const earthworksRest = (r: ImportResult) => r.tasks.find(t => t.name === 'Earthworks for extension')?.time.remainingTime;
eq('2c oud bestand: de opgeslagen rest blijft staan (2 d, niet de exacte 1,8 d)', [earthworksRest(rOld), earthworksRest(rNew)], [2, 2]);
const rFrac: ImportResult = { ...rOld, tasks: rOld.tasks.map(t => t.name === 'Earthworks for extension'
  ? { ...t, time: { ...t.time, remainingTime: 1.8 } } : t) };
const rNewFrac = readIFC(writeIFC(moments(rFrac)));
same('2b gebroken rest: dezelfde momenten op TimeModel na', moments(rNewFrac), moments({ ...rFrac, timeModel: 'MINUTES-1', ifcLiteralCalendarIds: rNewFrac.ifcLiteralCalendarIds }));
eq('2c gebroken rest (B3) blijft bewaard', earthworksRest(rNewFrac), 1.8);
eq('2d een planningseinde zonder tijd komt terug als het einde van die werkdag',
  [rFrac.tasks[1].time.scheduleFinish, rNewFrac.tasks[1].time.scheduleFinish], ['2027-05-12', '2027-05-12T16:00']);
const rRaw = readIFC(writeIFC(rFrac));
same('2e ruwe route: dezelfde momenten als het oude bestand, op TimeModel na', moments(rRaw), moments({ ...rFrac, timeModel: 'MINUTES-1', ifcLiteralCalendarIds: rRaw.ifcLiteralCalendarIds }));
const prep = (r: ImportResult) => r.tasks.find(t => t.name === '1. Preparation')?.time;
eq('2e ruwe route: "1. Preparation" eindigt op 12 mei 16:00, vroeg einde 19 mei 16:00',
  [prep(rRaw)?.scheduleFinish, prep(rRaw)?.earlyFinish, prep(rRaw)?.lateFinish], ['2027-05-12T16:00', '2027-05-19T16:00', '2027-05-19T16:00']);
eq('2e ruwe route: een kale werkelijke start blijft het 07:00-anker',
  rRaw.tasks.find(t => t.name === 'Set up site')?.time.actualStart?.slice(11), '07:00');

const converted = rewrite(
  rewrite(
    rewrite(OLD, t => t === 'IFCWORKPLAN' || t === 'IFCWORKSCHEDULE', a => [...a.slice(0, 11), ...a.slice(12)]),
    t => t === 'IFCWORKCALENDAR', a => [...a.slice(0, 5), '$', ...a.slice(5)]),
  t => RESOURCE_TYPES.includes(t), a => [...a.slice(0, 8), '$', '$', ...a.slice(8)]);
eq('3a omzetting levert de schema-ariteit', arities(converted, CONTROL), NEW_ARITY);
same('3b zelfde inhoud in oude en nieuwe ariteit leest identiek', readIFC(converted), rOld);

{
  const oldPlan = lines(OLD).find(l => l.type === 'IFCWORKPLAN')!.args;
  const samePlan = rewrite(NEW, type => type === 'IFCWORKPLAN', a =>
    [...a.slice(0, 11), oldPlan[12], oldPlan[13], ...a.slice(13)]);
  eq('4a fixture: nieuwe ariteit blijft behouden', arities(samePlan, ['IFCWORKPLAN']), { IFCWORKPLAN: [14] });
  const fromOld = readIFC(withoutProjectDates(OLD)).project;
  const fromNew = readIFC(withoutProjectDates(samePlan)).project;
  const fromConverted = readIFC(withoutProjectDates(converted)).project;
  ok('4a controle: de pset-namen zijn echt weg', !withoutProjectDates(OLD).includes("'ProjectStartDate'"));
  eq('4b oud: start/einde uit het WORKPLAN-slot', [fromOld.startDate, fromOld.endDate], ['2027-05-06', '2027-05-13']);
  eq('4c nieuw: zelfde start/einde', [fromNew.startDate, fromNew.endDate], [fromOld.startDate, fromOld.endDate]);
  eq('4d omgezet: zelfde start/einde', [fromConverted.startDate, fromConverted.endDate], [fromOld.startDate, fromOld.endDate]);
  const nativeProject = readIFC(NEW).project;
  eq('4e nieuw met pset: contractuele projectinvoer blijft staan',
    [nativeProject.startDate, nativeProject.endDate], ['2027-05-06', '']);
  const shownPlan = readIFC(withoutProjectDates(NEW)).project;
  eq('4f nieuw zonder pset: getoonde planomvang uit het werkplan',
    [shownPlan.startDate, shownPlan.endDate], ['2027-05-06', '2027-07-07']);
}

for (const [label, ifc] of [['oud', OLD], ['nieuw', NEW]] as const) {
  const all = ifc.split('\n');
  const isBaseline = (l: string) => l.includes('=IFCWORKSCHEDULE(') && l.includes('.BASELINE.');
  const isPlanned = (l: string) => l.includes('=IFCWORKSCHEDULE(') && l.includes('.PLANNED.');
  const planned = all.find(isPlanned)!;
  const plannedGuid = /\('([^']+)'/.exec(planned)![1];
  const rest = all.filter(l => !isBaseline(l));
  const at = rest.indexOf(planned);
  const reordered = [...rest.slice(0, at), ...all.filter(isBaseline), ...rest.slice(at)].join('\n');
  ok(`5a ${label}: controle, de baseline staat nu vóór het gewone werkschema`,
    reordered.indexOf('.BASELINE.') >= 0 && reordered.indexOf('.BASELINE.') < reordered.indexOf(planned));
  const r = readIFC(reordered);
  eq(`5b ${label}: het werkschema-GlobalId is dat van het gewone schema`, r.ifcGlobalIds?.[`ws:${r.project.id}`], plannedGuid);
}

{
  const ext = [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('x.ifc','',(''),(''),'','','');",
    "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('0proj000000000000000001',$,'Extern',$,$,$,$,$,$);",
    "#2=IFCWORKPLAN('0plan000000000000000001',$,'Plan',$,$,$,'2026-01-01T00:00:00',$,$,$,$,'2026-03-02T08:00:00','2026-04-30T17:00:00',.PLANNED.);",
    'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n');
  const p = readIFC(ext).project;
  eq('6a 14-argument-IfcWorkPlan: StartTime en FinishTime op hun schemaplek', [p.startDate, p.endDate], ['2026-03-02', '2026-04-30']);
  eq('6b het schema uit de kop', p.ifcSchema, 'IFC4');
}

{
  const head = [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('x.ifc','',(''),(''),'','','');",
    "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('0proj000000000000000001',$,'Extern',$,$,$,$,$,$);",
  ];
  const tail = ['ENDSEC;', 'END-ISO-10303-21;', ''];
  const schedule = (id: number, guid: string, type: string, arity: 14 | 15) =>
    `#${id}=IFCWORKSCHEDULE('${guid}',$,'${type}',$,$,$,'2026-01-01T00:00:00',$,$,$,$,${arity === 15 ? '$,' : ''}'2026-03-02T08:00:00','2026-04-30T17:00:00',.${type}.);`;
  const task = (id: number, name: string) =>
    `#${id}=IFCTASK('0tsk00000000000000000${id}',$,'${name}',$,$,'${name}',$,$,$,.F.,$,$,.CONSTRUCTION.);`;
  const names = (ifc: string) => readIFC(ifc).tasks.map(t => t.name);

  for (const arity of [14, 15] as const) {
    const only = [...head, schedule(2, '0sch0000000000000000001', 'BASELINE', arity), task(10, 'A'), task(11, 'B'),
      "#20=IFCRELASSIGNSTOCONTROL('0rel0000000000000000001',$,$,$,(#10,#11),$,#2);", ...tail].join('\n');
    eq(`7a alleen een .BASELINE.-werkschema (${arity} argumenten): de taken blijven`, names(only), ['A', 'B']);
  }

  const bonsai = [...head,
    schedule(2, '0sch0000000000000000001', 'PLANNED', 14), schedule(3, '0sch0000000000000000002', 'BASELINE', 14),
    task(10, 'R'), task(11, 'T1'), task(12, 'T2'), task(20, 'R-bl'), task(21, 'T1-bl'), task(22, 'T2-bl'), task(23, 'T3-bl'),
    "#30=IFCRELASSIGNSTOCONTROL('0rel0000000000000000001',$,$,$,(#10),$,#2);",
    "#31=IFCRELASSIGNSTOCONTROL('0rel0000000000000000002',$,$,$,(#20),$,#3);",
    "#32=IFCRELNESTS('0rel0000000000000000003',$,$,$,#10,(#11,#12));",
    "#33=IFCRELNESTS('0rel0000000000000000004',$,$,$,#20,(#21,#22));",
    "#34=IFCRELNESTS('0rel0000000000000000005',$,$,$,#22,(#23));",
    ...tail].join('\n');
  eq('7b Bonsai-vorm: alleen de boom van het gewone werkschema, zonder losse baselinekinderen',
    names(bonsai), ['R', 'T1', 'T2']);
  for (const arity of [14, 15] as const) {
    eq(`7c dezelfde vorm met ${arity} argumenten per werkschema`,
      names(bonsai.replace(/#(2|3)=IFCWORKSCHEDULE\([^\n]*/g, (line) => {
        const id = Number(/^#(\d+)/.exec(line)![1]);
        return schedule(id, id === 2 ? '0sch0000000000000000001' : '0sch0000000000000000002', id === 2 ? 'PLANNED' : 'BASELINE', arity);
      })), ['R', 'T1', 'T2']);
  }

  const shared = bonsai.replace("(#10),$,#2);", "(#10,#21),$,#2);");
  eq('7d een taak die ook aan het gewone werkschema hangt, blijft', names(shared), ['R', 'T1', 'T2', 'T1-bl']);

  for (const arity of [14, 15] as const) {
    const emptyPlanned = [...head,
      schedule(2, '0sch0000000000000000001', 'PLANNED', arity), schedule(3, '0sch0000000000000000002', 'BASELINE', arity),
      task(10, 'A'), task(11, 'B'),
      "#31=IFCRELASSIGNSTOCONTROL('0rel0000000000000000002',$,$,$,(#10,#11),$,#3);", ...tail].join('\n');
    eq(`7e leeg gewoon werkschema naast een gevuld baselineschema (${arity} argumenten): de taken blijven`,
      names(emptyPlanned), ['A', 'B']);
  }
}

{
  const combined = readFileSync(join(HERE, 'fixtures', 'ifc-arity-oude-writer-merged.ifc'), 'utf8');
  let blocked = false;
  try { readIFC(combined); }
  catch (error) { blocked = error instanceof IfcParseError && error.reason === 'building-model'; }
  ok('8 voorpoort: oorspronkelijke 4D-fixture wordt geweigerd', blocked);
  const modelLines = combined.split('\n').filter(line => /^#(?:6=IFCSITE|8=IFCWALL)\(/.test(line));
  eq('8 fixture bevat precies de twee bekende modelregels', modelLines.length, 2);
  const MERGED = combined.split('\n').filter(line => !modelLines.includes(line)).join('\n');
  const all = lines(MERGED);
  const ofType = (...types: string[]) => all.filter(l => types.includes(l.type));
  eq('8a fixture: elke kalender heeft 9 argumenten en een lijst op Identification (5)',
    ofType('IFCWORKCALENDAR').map(l => [l.args.length, l.args[5].trim().startsWith('(')]), Array(4).fill([9, true]));
  eq('8b fixture: werkplan en werkschema\'s hebben 14 argumenten en tekst op PredefinedType (13)',
    ofType('IFCWORKPLAN', 'IFCWORKSCHEDULE').map(l => [l.args.length, l.args[13].trim().startsWith("'")]), Array(4).fill([14, true]));

  const r = readIFC(MERGED);
  const libByName = (res: ImportResult, name: string) => (res.resourceCalendars ?? []).find(c => c.name === name);
  const LIB = ['Tweeploegen', 'Nachtploeg', 'Eigen rooster'];
  eq('8c taken', r.tasks.length, rOld.tasks.length);
  eq('8d projectkalender: 19 feestdagen (de 18 van het origineel plus de werkende uitzondering)', r.calendar.holidays.length, 19);
  ok('8e projectkalender: elke feestdag van het origineel is er',
    rOld.calendar.holidays.every(h => r.calendar.holidays.some(m => isDeepStrictEqual(m, h))));
  eq('8f projectkalender: werkdagen, werkuren 07–16 en banden gelijk aan het origineel',
    [r.calendar.workDays, r.calendar.workStartHour, r.calendar.workEndHour, r.calendar.workTime],
    [rOld.calendar.workDays, 7, 16, rOld.calendar.workTime]);
  eq('8g bibliotheek: feestdagen per kalender', LIB.map(n => libByName(r, n)?.holidays.length), [2, 1, 1]);
  eq('8h bibliotheek: werkdagen en banden gelijk aan het origineel',
    LIB.map(n => [libByName(r, n)?.workDays, libByName(r, n)?.workTime]),
    LIB.map(n => [libByName(rOld, n)?.workDays, libByName(rOld, n)?.workTime]));
  eq('8i baselines', (r.baselines ?? []).map(b => b.name), ['Baseline plan', 'Herplanning']);
  eq('8j projectstart uit het pset', r.project.startDate, '2027-05-06');
  const noPset = readIFC(withoutProjectDates(MERGED)).project;
  eq('8k zonder pset: start en einde uit het werkplan, gelijk aan het origineel', [noPset.startDate, noPset.endDate], ['2027-05-06', '2027-05-13']);

  const schemaForm = rewrite(
    rewrite(MERGED, t => t === 'IFCWORKCALENDAR', a => [...a.slice(0, 5), '$', a[5], a[6], '$']),
    t => t === 'IFCWORKPLAN' || t === 'IFCWORKSCHEDULE', a => [...a.slice(0, 11), a[12], a[13], '$']);
  same('8l samengevoegd bestand leest gelijk aan dezelfde inhoud in schema-indeling', r, readIFC(schemaForm));

  const add2 = readIFC(MERGED.replace("FILE_SCHEMA(('IFC4'));", "FILE_SCHEMA(('IFC4X3_ADD2'));"));
  eq('8m ADD2-kop: zelfde kalenders en taken', [add2.calendar, add2.resourceCalendars, add2.tasks.length],
    [r.calendar, r.resourceCalendars, r.tasks.length]);

  const withIdentification = rewrite(NEW, t => t === 'IFCWORKCALENDAR', a => [...a.slice(0, 5), "'KAL-1'", ...a.slice(6)]);
  same('8n tegenproef: tekst op Identification verandert niets', readIFC(withIdentification), readIFC(NEW));
}

if (diffs.length === 0) {
  console.log(`OK  ifc-legacy-arity: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-legacy-arity: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
