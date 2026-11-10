// #804 fase 1b, fixronde 7 van #867: eigen bestanden van oudere OPS-versies, met een model erbij.
//
// Besluit van Trias: schreef OPS een waarde zelf, dan mag de merge daarom niet weigeren zolang de planner het veld niet
// wijzigde. Volgorde: leest de lezer de vorm exact, dan staat hij op de lijst; zo niet, dan blijft de bronwaarde letterlijk
// staan (bronslot); alleen als de planner het veld zelf wijzigde, mag de merge weigeren.
//
// Per punt van de review (ronde 6): zonder bewerking, met een andere bewerking, en met het veld zelf gewijzigd. Na elke merge
// die schrijft: herlezen geeft de planning van het domein terug (de tijden van elke taak, de lag van elke relatie, de
// resources en de toewijzingen). De bronnen komen uit `tests/planning/fixtures/oude-tags/` (gemaakt met de lezer en writer
// van die tag, `scripts/proef/maak-oude-uitvoer.mjs`) en `h7-tijden-oude-writer.ifc`, met een wand van Revit erbij.
//  - BLOKKEERT 1: een halve dag (`P0Y0M0.5D`, OPS tot `cbde9d4e7`);
//  - BLOKKEERT 2: resources met 9 argumenten (OPS tot `4f5008614`, was knownbug 1024);
//  - BLOKKEERT 3: een werktijd als uurbreuk (`'7.5:00:00'`, OPS tot `32b6222de`);
//  - BLOKKEERT 4: dagen met 17 cijfers en met een exponent (OPS tot `b738a5096`), per slot;
//  - bevinding 6: een urentaak van vóór `LiteralTimes` (v2026.7.7, v2026.9.0 en v2026.43.0).
// Of elk eigen bestand zonder bewerking schrijft, telt `check-ifc-foreign-merge-telling.ts` (per bestand).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { cloneDomain, mergeProblems, openForeign, settle, tryMerge, type Domain, type Opened } from './ifcMergeKern';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installDeterminism();
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const readText = (rel: string) => readFileSync(join(ROOT, rel), 'latin1');
const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
const withLines = (src: string, lines: readonly string[]) => {
  const at = src.lastIndexOf('ENDSEC;');
  return `${src.slice(0, at)}${lines.map(l => `${l}\n`).join('')}${src.slice(at)}`;
};
const OLD = 'tests/planning/fixtures/oude-tags';
const walled = (rel: string) => withLines(readText(rel), REVIT_WALL);

/** De argumenten van een STEP-regel, op de komma's van het hoogste niveau (tekst tussen quotes en haakjes blijft heel). */
function splitArgs(body: string): string[] {
  const out: string[] = [];
  let depth = 0; let quoted = false; let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'") quoted = !quoted;
    else if (!quoted && c === '(') depth++;
    else if (!quoted && c === ')') depth--;
    else if (!quoted && depth === 0 && c === ',') { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  return out;
}
/** Zet argument `k` van de eerste regel die `match` past. */
function patchArg(src: string, match: RegExp, k: number, value: string): string {
  const m = new RegExp(`^(#\\d+=[A-Z0-9]+)\\((.*)\\);$`, 'm');
  const line = src.split('\n').find(l => match.test(l));
  if (!line) throw new Error(`geen regel voor ${match}`);
  const parts = m.exec(line.trim())!;
  const args = splitArgs(parts[2]);
  args[k] = value;
  return src.replace(line, `${parts[1]}(${args.join(',')});`);
}

/** Herlezen geeft het domein terug: per taak `time`, per relatie de lag, per resource de naam, per toewijzing de eenheden. */
function sameAs(d: Domain, back: Opened): string | undefined {
  const out: string[] = [];
  const tasks = new Map(back.tasks.map(t => [t.id, t]));
  for (const t of d.tasks) {
    const b = tasks.get(t.id);
    if (!b) { out.push(`taak ${t.name} ontbreekt`); continue; }
    for (const k of new Set([...Object.keys(t.time), ...Object.keys(b.time)])) {
      const want = (t.time as unknown as Record<string, unknown>)[k];
      const got = (b.time as unknown as Record<string, unknown>)[k];
      if (JSON.stringify(want) !== JSON.stringify(got)) out.push(`${t.name}.${k}: ${JSON.stringify(want)} → ${JSON.stringify(got)}`);
    }
  }
  const seqs = new Map(back.sequences.map(q => [q.id, q]));
  for (const q of d.sequences) {
    const b = seqs.get(q.id);
    if (!b) { out.push(`relatie ${q.id} ontbreekt`); continue; }
    for (const k of ['lagDays', 'lagMinutes', 'lagPercent', 'lagUnit', 'type'] as const) {
      if (JSON.stringify(q[k]) !== JSON.stringify(b[k])) out.push(`relatie ${q.id}.${k}: ${JSON.stringify(q[k])} → ${JSON.stringify(b[k])}`);
    }
  }
  const res = new Map(back.resources.map(r => [r.id, r]));
  for (const r of d.resources) if (res.get(r.id)?.name !== r.name) out.push(`resource ${r.name}: ${res.get(r.id)?.name}`);
  const asg = new Map(back.assignments.map(a => [`${a.taskId}|${a.resourceId}`, a]));
  for (const a of d.assignments) {
    const b = asg.get(`${a.taskId}|${a.resourceId}`);
    if (!b || b.unitsPerDay !== a.unitsPerDay) out.push(`toewijzing ${a.taskId}|${a.resourceId}: ${a.unitsPerDay} → ${b?.unitsPerDay}`);
  }
  if (back.assignments.length !== d.assignments.length) out.push(`toewijzingen: ${d.assignments.length} → ${back.assignments.length}`);
  return out.length === 0 ? undefined : `herlezen geeft een andere planning: ${out.slice(0, 3).join(' | ')}${out.length > 3 ? ` (+${out.length - 3})` : ''}`;
}

const rows: string[] = [];
const openedOf = new Map<string, Opened>();
/**
 * Eén proef: openen, bewerken, mergen. `want` is `schrijft` of het geval van de weigering. Schrijft de merge, dan gaan
 * de invarianten (`mergeProblems`), de herlezing (`sameAs`) en `check` op de uitvoer na.
 */
async function proof(group: string, label: string, src: string, want: string, edit?: (d: Domain, o: Opened) => void,
  check?: (out: string) => string | undefined): Promise<void> {
  const name = `${group} · ${label}`;
  let o = openedOf.get(src);
  if (!o) { o = await openForeign(latin1(src)); openedOf.set(src, o); }
  if (!o.ifcSource?.foreign) { ok(`${name}: de bron heeft geen vreemd deel`, false); return; }
  const d = cloneDomain(o);
  edit?.(d, o);
  const r = await tryMerge(d, o.ifcSource);
  const got = r.ok ? 'schrijft' : `weigert (${r.kinds.join(', ')})`;
  const first = r.ok ? '' : r.error.cases[0]?.detail ?? '';
  rows.push(`| ${name} | ${got}${first ? `: ${first.slice(0, 120).replace(/\|/g, '/')}` : ''} |`);
  const pass = want === 'schrijft' ? r.ok : !r.ok && r.kinds.includes(want);
  ok(`${name}: verwacht ${want}, kreeg ${got}${first ? ` — ${first.slice(0, 200)}` : ''}`, pass);
  if (!pass || !r.ok) return;
  const problems = mergeProblems(latin1(src), r.bytes);
  ok(`${name}: invarianten (${problems.slice(0, 2).join(' | ')})`, problems.length === 0);
  const same = sameAs(d, await openForeign(r.bytes));
  ok(`${name}: ${same}`, same === undefined);
  const problem = check?.(text(r.bytes));
  ok(`${name}: ${problem}`, problem === undefined);
}
const has = (...needles: string[]) => (out: string) => {
  const missing = needles.filter(n => !out.includes(n));
  return missing.length === 0 ? undefined : `mist ${missing.join(', ')}`;
};
const hasNot = (...needles: string[]) => (out: string) => {
  const found = needles.filter(n => out.includes(n));
  return found.length === 0 ? undefined : `heeft nog ${found.join(', ')}`;
};
const both = (...fs: ((out: string) => string | undefined)[]) => (out: string) => fs.map(f => f(out)).find(x => x !== undefined);
const leaves = (d: Domain) => d.tasks.filter(t => t.childIds.length === 0);
const renameOther = (keep: string) => (d: Domain) => { leaves(d).find(t => t.name !== keep)!.name = 'Hernoemd'; };
const taskNamed = (d: Domain, name: string) => d.tasks.find(t => t.name === name)!;

// ── BLOKKEERT 1: een halve dag (`P0Y0M0.5D`) ──
// De bron: de villa van v2026.43.0 met een wand, en de duur van één taak een halve dag (zoals OPS die tot `cbde9d4e7`
// schreef). Zonder wijziging van de duur blijft de bronduur staan, en maakt die taak de kalender niet letterlijk.
{
  const villa = walled(`${OLD}/v2026.43.0-10-villa-wassenaar.ifc`);
  const m = /#\d+=IFCTASKTIME\('([^']*) Time',\.PREDICTED\.,\$,\.WORKTIME\.,'P0Y0M5D'/.exec(villa)!;
  const name = m[1];
  const half = villa.replace(m[0], m[0].replace("'P0Y0M5D'", "'P0Y0M0.5D'"));
  ok('BLOKKEERT 1: de bron heeft een halve dag', half !== villa);
  const kept = both(has(`IFCTASKTIME('${name} Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M0.5D'`), hasNot('LiteralTimes', 'DayMeasureDurations'));
  await proof('BLOKKEERT 1', 'halve dag, zonder bewerking', half, 'schrijft', undefined, kept);
  await proof('BLOKKEERT 1', 'halve dag, een andere taak hernoemd', half, 'schrijft', renameOther(name), kept);
  // De planner wijzigt de duur zelf: dan geldt de writer. 2 dagen past in hele dagen; 1,5 dag gaat als `PT…` met een
  // record en maakt de kalender letterlijk, en daarmee lezen de oude datums van de andere taken anders: weigeren mag
  // (eigen wijziging; knownbug 1102).
  await proof('BLOKKEERT 1', 'halve dag, de duur zelf op 2 dagen', half, 'schrijft', (d) => { taskNamed(d, name).time.scheduleDuration = 2; },
    has(`IFCTASKTIME('${name} Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D'`));
  await proof('BLOKKEERT 1', 'halve dag, de duur zelf op 1,5 dag (knownbug 1102)', half, 'niet-gedragen', (d) => { taskNamed(d, name).time.scheduleDuration = 1.5; });
  // Het bestand dat de writer van v2026.43.0 zelf maakte, met een taak van een halve dag.
  const own = walled(`${OLD}/v2026.43.0-halve-dag-10-villa-wassenaar.ifc`);
  ok('BLOKKEERT 1: v2026.43.0-halve-dag heeft een halve dag', own.includes("'P0Y0M0.5D'"));
  await proof('BLOKKEERT 1', 'v2026.43.0-halve-dag, zonder bewerking', own, 'schrijft', undefined, both(has("'P0Y0M0.5D'"), hasNot('LiteralTimes')));
  await proof('BLOKKEERT 1', 'v2026.43.0-halve-dag, een taak hernoemd', own, 'schrijft', (d) => { leaves(d)[0].name = 'Hernoemd'; }, has("'P0Y0M0.5D'"));
}

// ── BLOKKEERT 2: resources met 9 argumenten (was knownbug 1024) ──
// OPS tot `4f5008614` (v2026.9.0 en ouder) schreef `(GlobalId,OwnerHistory,Name,Description,$,$,$,$,.USERDEFINED.)`.
{
  const RES9 = /^#\d+=IFC(?:LABOR|CONSTRUCTIONEQUIPMENT|CONSTRUCTIONMATERIAL|SUBCONTRACT|CREW)RESOURCE\((?:'[^']*'|[^,'])*(?:,(?:'[^']*'|[^,'])*){8}\);$/m;
  const v9 = walled(`${OLD}/v2026.9.0-10-villa-wassenaar.ifc`);
  const v72 = readText(`${OLD}/v2026.7.2-woongebouw-nieuwbouw.ifc`);
  const df9 = readText(`${OLD}/main-df9eafc7d-woongebouw-nieuwbouw.ifc`);
  for (const [n, src] of [['v2026.9.0', v9], ['v2026.7.2', v72], ['main-df9', df9]] as const) ok(`BLOKKEERT 2: ${n} heeft een resource met 9 argumenten`, RES9.test(src));
  await proof('BLOKKEERT 2', 'v2026.9.0 villa, zonder bewerking', v9, 'schrijft');
  await proof('BLOKKEERT 2', 'v2026.9.0 villa, een resource hernoemd', v9, 'schrijft', (d) => { d.resources[0].name = 'Hernoemd'; }, has("'Hernoemd'"));
  await proof('BLOKKEERT 2', 'v2026.9.0 villa, een taak hernoemd', v9, 'schrijft', (d) => { leaves(d)[0].name = 'Hernoemd'; });
  await proof('BLOKKEERT 2', 'v2026.7.2 woongebouw, zonder bewerking', v72, 'schrijft');
  await proof('BLOKKEERT 2', 'main-df9 woongebouw (kale sleutels in OPS_Assignments), zonder bewerking', df9, 'schrijft');
  await proof('BLOKKEERT 2', 'main-df9, de eenheden van een toewijzing verdubbeld', df9, 'schrijft', (d) => { d.assignments[0].unitsPerDay *= 2; });
  await proof('BLOKKEERT 2', 'main-df9, een toewijzing gewist', df9, 'schrijft', (d) => { d.assignments.splice(0, 1); });
  await proof('BLOKKEERT 2', 'main-df9, een resource hernoemd', df9, 'schrijft', (d) => { d.resources[0].name = 'Hernoemd'; }, has("'Hernoemd'"));
}

// ── BLOKKEERT 3: een werktijd als uurbreuk (`'7.5:00:00'`) ──
// De lezer leest die vorm exact als enige periode van het enige patroon (`scalarHourFromClock`); daar staat hij op de
// lijst. In een tweede periode leest `clockToMinutes` hem niet: daar weigert de merge nog.
{
  const h7 = walled('tests/planning/fixtures/h7-tijden-oude-writer.ifc');
  ok("BLOKKEERT 3: h7 heeft '7.5:00:00'", h7.includes("IFCTIMEPERIOD('7.5:00:00','16:00:00')"));
  const keeps = has("IFCTIMEPERIOD('7.5:00:00','16:00:00')", "IFCTIMEPERIOD('7.25:00:00','15.75:00:00')");
  await proof('BLOKKEERT 3', 'h7 met wand, zonder bewerking', h7, 'schrijft', undefined, keeps);
  await proof('BLOKKEERT 3', 'h7 met wand, een taak hernoemd', h7, 'schrijft', (d) => { leaves(d)[0].name = 'Hernoemd'; }, keeps);
  await proof('BLOKKEERT 3', 'h7 met wand, het begin van de werkdag zelf op 8 uur', h7, 'schrijft', (d) => {
    d.calendar.workStartHour = 8; d.calendar.hoursPerDay = d.calendar.workEndHour - 8;
  }, has("IFCTIMEPERIOD('08:00:00','16:00:00')"));
  const eigen = text(await settle(new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))));
  const clock = eigen.replace("IFCTIMEPERIOD('07:00:00','16:00:00')", "IFCTIMEPERIOD('7.5:00:00','16:00:00')");
  ok("BLOKKEERT 3: eigen-plus-model met '7.5:00:00'", clock !== eigen);
  await proof('BLOKKEERT 3', "eigen-plus-model met '7.5:00:00', zonder bewerking", clock, 'schrijft', undefined, has("IFCTIMEPERIOD('7.5:00:00','16:00:00')"));
  const m = /#(\d+)=IFCRECURRENCEPATTERN\(([^\n]*),\((#\d+)\)\);/.exec(clock)!;
  const second = withLines(clock.replace(m[0], `#${m[1]}=IFCRECURRENCEPATTERN(${m[2]},(${m[3]},#90100));`), ["#90100=IFCTIMEPERIOD('16.5:00:00','17:00:00');"]);
  await proof('BLOKKEERT 3', "dezelfde vorm in een tweede periode ('16.5:00:00')", second, 'tijd-deels-gelezen');
}

// ── BLOKKEERT 4: dagen met 17 cijfers en met een exponent, per slot ──
// De bron (v2026.9.0, `maak-oude-uitvoer.mjs`): een duur en rest van 7/3 dag, een speling van 0,1 + 0,2 en 1e-7 dag,
// een werkelijke duur van 0,1 + 0,2 dag en een lag van 0,1 + 0,2 dag. Zolang de planner het veld niet wijzigt, blijft
// de bronwaarde letterlijk, zonder record (`DayMeasureDurations`, `ExactFloat`, `DayMeasureLags`) dat de planning
// anders zou maken. De herlezing toetst de getallen exact.
{
  const d17 = walled(`${OLD}/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc`);
  const SOURCE = ["'P0Y0M2.3333333333333335D'", "'P0Y0M1e-7D'", "'P0Y0M0.30000000000000004D'", "IFCDURATION('P0.30000000000000004D')"];
  for (const v of SOURCE) ok(`BLOKKEERT 4: de bron heeft ${v}`, d17.includes(v));
  const kept = both(has(...SOURCE), hasNot('ExactFloat', 'DayMeasureDurations', 'DayMeasureLags'));
  await proof('BLOKKEERT 4', 'zonder bewerking', d17, 'schrijft', undefined, kept);
  await proof('BLOKKEERT 4', 'een andere taak hernoemd', d17, 'schrijft', renameOther('Set up site'), kept);
  // Het veld zelf gewijzigd: dan geldt de writer, en de bronwaarde verdwijnt.
  await proof('BLOKKEERT 4', 'duur: de planner zet 3 dagen', d17, 'schrijft', (d) => {
    const t = taskNamed(d, 'Set up site').time; t.scheduleDuration = 3; t.remainingTime = 3;
  }, both(has("IFCTASKTIME('Set up site Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M3D'"), hasNot("'P0Y0M2.3333333333333335D'")));
  await proof('BLOKKEERT 4', 'speling: de planner zet de totale speling op 2 dagen', d17, 'schrijft', (d) => {
    taskNamed(d, 'Protect trees').time.totalFloat = 2;
  }, hasNot("'P0Y0M0.30000000000000004D',.F."));
  await proof('BLOKKEERT 4', 'werkelijk: de planner zet 1 dag', d17, 'schrijft', (d) => {
    taskNamed(d, 'Excavate swimming pool').time.actualDuration = 1;
  });
  await proof('BLOKKEERT 4', 'lag: de planner zet 1 dag', d17, 'schrijft', (d) => {
    d.sequences.find(q => q.lagDays !== undefined && !Number.isInteger(q.lagDays))!.lagDays = 1;
  }, hasNot('P0.30000000000000004D'));
  // Dezelfde vormen in de andere slots: 1e-7 in duur, rest, werkelijke duur en lag; 17 cijfers in de vrije speling.
  const TT = (name: string) => new RegExp(`IFCTASKTIME\\('${name} Time'`);
  const variants: [string, string, string][] = [
    ['duur 1e-7', patchArg(d17, TT('Set up site'), 4, "'P0Y0M1e-7D'"), "'P0Y0M1e-7D','2027-03-01T07:00:00'"],
    ['rest 1e-7', patchArg(d17, TT('Set up site'), 18, "'P0Y0M1e-7D'"), "'P0Y0M1e-7D'"],
    ['werkelijk 1e-7', patchArg(d17, TT('Excavate swimming pool'), 15, "'P0Y0M1e-7D'"), "'P0Y0M1e-7D'"],
    ['vrije speling 17 cijfers, totale 1e-7', patchArg(patchArg(d17, TT('Protect trees'), 11, "'P0Y0M0.30000000000000004D'"), TT('Protect trees'), 12, "'P0Y0M1e-7D'"),
      "'P0Y0M0.30000000000000004D','P0Y0M1e-7D'"],
    ['lag 1e-7', d17.replace("IFCDURATION('P0.30000000000000004D')", "IFCDURATION('P1e-7D')"), "IFCDURATION('P1e-7D')"],
  ];
  for (const [label, src, needle] of variants) {
    ok(`BLOKKEERT 4: ${label} staat in de bron`, src !== d17 && src.includes(needle));
    await proof('BLOKKEERT 4', `${label}, zonder bewerking`, src, 'schrijft', undefined, both(has(needle), hasNot('ExactFloat', 'DayMeasureDurations', 'DayMeasureLags')));
    await proof('BLOKKEERT 4', `${label}, een andere taak hernoemd`, src, 'schrijft', renameOther('Set up site'), has(needle));
  }
}

// ── Bevinding 6: een urentaak van vóór `LiteralTimes` (`d3e7c885f`) ──
// v2026.43.0 schreef de kalender van een urentaak met blokken (07–12, 13–16) en `IsHourCalendar .F.`, zonder
// `LiteralTimes`; de lezer leest de urentaak daar op de minuut. De writer schrijft die kalender weer zo
// (`sourceBandCalendarIds`), en de momenten van de urentaak letterlijk. v2026.9.0 schreef één periode (07–16), v2026.7.7
// de urentaak als halve dag.
{
  for (const tag of ['v2026.7.7', 'v2026.9.0', 'v2026.43.0']) {
    const src = walled(`${OLD}/${tag}-urentaak-10-villa-wassenaar.ifc`);
    await proof('bevinding 6', `${tag} urentaak, zonder bewerking`, src, 'schrijft');
    await proof('bevinding 6', `${tag} urentaak, een andere taak hernoemd`, src, 'schrijft', (d) => {
      leaves(d).find(t => t.time.durationUnit !== 'hours' && !/^Set up site|^Bouwplaats/.test(t.name))!.name = 'Hernoemd';
    });
  }
  const src = walled(`${OLD}/v2026.43.0-urentaak-10-villa-wassenaar.ifc`);
  ok('bevinding 6: de bron van v2026.43.0 heeft blokken en IsHourCalendar .F., zonder LiteralTimes',
    src.includes("IFCTIMEPERIOD('13:00:00','16:00:00')") && src.includes("'IsHourCalendar',$,IFCBOOLEAN(.F.)") && !src.includes('LiteralTimes'));
  const calendar = both(has("IFCTIMEPERIOD('07:00:00','12:00:00')", "IFCTIMEPERIOD('13:00:00','16:00:00')", "'IsHourCalendar',$,IFCBOOLEAN(.F.)"), hasNot('LiteralTimes'));
  await proof('bevinding 6', 'v2026.43.0 urentaak: de kalender blijft zoals in de bron', src, 'schrijft', undefined,
    both(calendar, has("'PT4H0M0S','2027-03-01T07:00:00','2027-03-01T11:00:00'")));
  const hourTask = (d: Domain) => d.tasks.find(t => t.time.durationUnit === 'hours')!.time;
  const longer = (minutes: number, finish: string) => (d: Domain) => {
    const t = hourTask(d);
    t.scheduleDuration = t.scheduleDuration * minutes / t.durationMinutes!;
    t.durationMinutes = minutes;
    for (const k of ['scheduleFinish', 'earlyFinish', 'lateFinish'] as const) t[k] = t[k]!.replace('T11:00', finish);
  };
  await proof('bevinding 6', 'v2026.43.0 urentaak, de planner zet 5 uur (07–12)', src, 'schrijft', longer(300, 'T12:00'),
    both(calendar, has("'PT5H0M0S','2027-03-01T07:00:00','2027-03-01T12:00:00'")));
  await proof('bevinding 6', 'v2026.43.0 urentaak, de planner zet 8 uur (07–16)', src, 'schrijft', longer(480, 'T16:00'), calendar);
  await proof('bevinding 6', 'v2026.43.0 urentaak, de planner schuift haar een dag op', src, 'schrijft', (d) => {
    const t = hourTask(d) as unknown as Record<string, unknown>;
    for (const k of Object.keys(t)) if (typeof t[k] === 'string' && (t[k] as string).startsWith('2027-03-01T')) t[k] = (t[k] as string).replace('2027-03-01', '2027-03-02');
  }, both(calendar, has("'2027-03-02T07:00:00','2027-03-02T11:00:00'")));
}

console.log('| proef | uitkomst |');
console.log('|---|---|');
for (const r of rows) console.log(r);
if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-oude-eigen: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-oude-eigen: alle checks groen (${checks}; ${rows.length} proeven)`);
process.exit(0);
