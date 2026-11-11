// #804 fase 1b, fixronde 7 van #867: eigen bestanden van oudere OPS-versies, met een model erbij.
//
// Besluit van Trias: schreef OPS een waarde zelf, dan mag de merge daarom niet weigeren zolang de planner het veld niet
// wijzigde. Volgorde: leest de lezer de vorm exact, dan staat hij op de lijst; zo niet, dan blijft de bronwaarde letterlijk
// staan (bronslot); alleen als de planner het veld zelf wijzigde, mag de merge weigeren.
//
// Per punt van de review (ronde 6): zonder bewerking, met een andere bewerking, en met het veld zelf gewijzigd. Na elke merge
// die schrijft: heropenen via de route van de app geeft de planning die de planner zag, zoals de app haar na openen toont
// (`shownAfterOpen`: de tijden van elke taak, de lag van elke relatie, de resources en de toewijzingen). De bronnen komen
// uit `tests/planning/fixtures/oude-tags/` (gemaakt met de lezer en writer van die tag, `scripts/proef/maak-oude-uitvoer.mjs`)
// en `h7-tijden-oude-writer.ifc`, met een wand van Revit erbij.
//  - BLOKKEERT 1: een halve dag (`P0Y0M0.5D`, OPS tot `cbde9d4e7`);
//  - BLOKKEERT 2: resources met 9 argumenten (OPS tot `4f5008614`, was knownbug 1024);
//  - BLOKKEERT 3: een werktijd als uurbreuk (`'7.5:00:00'`, OPS tot `32b6222de`);
//  - BLOKKEERT 4: dagen met 17 cijfers en met een exponent (OPS tot `b738a5096`), per slot;
//  - bevinding 6: een urentaak van vóór `LiteralTimes` (v2026.7.7, v2026.9.0 en v2026.43.0);
//  - na de merge met main: de bestanden van v2026.7.12 (de baselinekop houdt het GlobalId van de bron; knownbug 1103 en
//    1104).
// Of elk eigen bestand zonder bewerking schrijft, telt `check-ifc-foreign-merge-telling.ts` (per bestand).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { bareBytes, plainSaveAfterF5, TRIAS_FILES, TRIAS_MODEL_FILE, type TriasEntry } from './ifcAppRoute';
import { createHash } from 'node:crypto';
import {
  canon, cloneDomain, mergeProblems, openForeign, openForeignRaw, openInStore, ordinaryEdits, plannerEdits, recalculated, reopenPlain, settle,
  shownAfterOpen, tryMerge, type Domain, type EditKind, type Opened,
} from './ifcMergeKern';
import { partialDateTime, sameMeaning } from '@/services/ifc/foreign/lossCheck';
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { clockToMinutes, getCalendarBands, minutesToClock } from '@/services/subdayIo';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const readText = (rel: string) => readFileSync(join(ROOT, rel), 'latin1');
const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
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

/** Heropenen geeft de planning die de planner zag (`shownAfterOpen`): per taak `time`, per relatie de lag, per resource
 *  de naam, per toewijzing de eenheden. */
function sameAs(d: Opened, back: Opened): string | undefined {
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
  // Op id, en anders op voorganger en opvolger: een nieuwe relatie krijgt bij heropenen het id van de lezer.
  const SEQ_FIELDS = ['lagDays', 'lagMinutes', 'lagPercent', 'lagUnit', 'type'] as const;
  const seqs = new Map(back.sequences.map(q => [q.id, q]));
  const fresh = d.sequences.filter(q => !seqs.has(q.id));
  const unclaimed = back.sequences.filter(b => !d.sequences.some(q => q.id === b.id));
  for (const q of d.sequences) {
    const at = fresh.includes(q) ? unclaimed.findIndex(b => b.predecessorId === q.predecessorId && b.successorId === q.successorId
      && SEQ_FIELDS.every(k => JSON.stringify(q[k]) === JSON.stringify(b[k]))) : -1;
    const b = seqs.get(q.id) ?? (at >= 0 ? unclaimed.splice(at, 1)[0] : undefined);
    if (!b) { out.push(`relatie ${q.id} (${q.predecessorId} → ${q.successorId}) ontbreekt`); continue; }
    for (const k of SEQ_FIELDS) {
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
async function proof(group: string, label: string, src: string, want: string, edit?: (d: Domain, o: Opened) => void | Promise<void>,
  check?: (out: string) => string | undefined): Promise<void> {
  const name = `${group} · ${label}`;
  let o = openedOf.get(src);
  if (!o) { o = await openForeign(latin1(src)); openedOf.set(src, o); }
  if (!o.ifcSource?.foreign) { ok(`${name}: de bron heeft geen vreemd deel`, false); return; }
  const d = cloneDomain(o);
  await edit?.(d, o);
  const r = await tryMerge(d, o.ifcSource);
  const got = r.ok ? 'schrijft' : `weigert (${r.kinds.join(', ')})`;
  const first = r.ok ? '' : r.error.cases[0]?.detail ?? '';
  rows.push(`| ${name} | ${got}${first ? `: ${first.slice(0, 120).replace(/\|/g, '/')}` : ''} |`);
  const pass = want === 'schrijft' ? r.ok : !r.ok && r.kinds.includes(want);
  ok(`${name}: verwacht ${want}, kreeg ${got}${first ? ` — ${first.slice(0, 200)}` : ''}`, pass);
  if (!pass || !r.ok) return;
  const problems = mergeProblems(latin1(src), r.bytes);
  ok(`${name}: invarianten (${problems.slice(0, 2).join(' | ')})`, problems.length === 0);
  const same = sameAs(await shownAfterOpen(d), await openForeign(r.bytes));
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

// 1111: de vergelijking van gedragen waarden gebruikt in elke tijdzone dezelfde tijdas.
{
  const previous = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Europe/Amsterdam']) {
      process.env.TZ = tz;
      const index = scanStep(latin1("ISO-10303-21;HEADER;FILE_SCHEMA(('IFC4X3_ADD2'));ENDSEC;DATA;#1=IFCTASKTIME($,$,$,$,$,'2027-03-28T02:00:00');ENDSEC;END-ISO-10303-21;"));
      const r = { chunk: index.chunkOf('1'), arg: 5, outArg: 5, token: "'2027-03-28T02:00:00'", kind: 'samengesteld' as const };
      ok(`1111 ${tz}: twee wandkloktijden verschillen`, !sameMeaning(index, r, "'2027-03-28T03:00:00'"));
      ok(`1111 ${tz}: expliciete zone behoudt betekenis`, sameMeaning(index, r, "'2027-03-28T03:00:00+01:00'"));
      await proof(`1111 ${tz}`, 'oude eigen bron via de app', walled('tests/planning/fixtures/b5-lopend-oude-writer.ifc'), 'schrijft');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
}

// #898, fixronde 2: onmogelijke bronwaarden blijven staan of weigeren; JavaScript-doorschuiven draagt ze niet.
{
  const previous = process.env.TZ;
  const base = walled('tests/planning/fixtures/review886/taaktijd-1100.ifc');
  try {
    for (const tz of ['UTC', 'Europe/Amsterdam']) {
      process.env.TZ = tz;
      const vectors = [
        { type: 'IFCTASKTIME', arg: 5, kind: 'datum-tijd' as const, bad: ['2027-02-30T07:00:00', '2027-13-01', '2027-00-01', '2027-03-00', '2027-03-32', '2027-03-01T24:00:00', '2027-03-01T25:00:00', '2027-03-01T07:60:00', '2027-03-01garbage'], good: '2027-03-01T07:00:00' },
        { type: 'IFCWORKTIME', arg: 4, kind: 'datum' as const, bad: ['2027-02-30', '2027-13-01', '2027-03-01garbage'], good: '2027-03-01' },
        { type: 'IFCTIMEPERIOD', arg: 0, kind: 'tijd' as const, bad: ['24:30:00', '24:00:01', '25:00:00', '07:60:00'], good: '07:00:00' },
      ];
      for (const v of vectors) for (const bad of v.bad) {
        const args = [...Array<string>(v.arg).fill('$'), `'${bad}'`];
        const index = scanStep(latin1(`ISO-10303-21;HEADER;FILE_SCHEMA(('IFC4X3_ADD2'));ENDSEC;DATA;#1=${v.type}(${args.join(',')});ENDSEC;END-ISO-10303-21;`));
        const r = { chunk: index.chunkOf('1'), arg: v.arg, outArg: v.arg, token: `'${bad}'`, kind: 'samengesteld' as const };
        ok(`fix2 ${tz} ${v.type} ${bad}: vorm weigert`, partialDateTime(bad, v.kind) === 'vorm');
        ok(`fix2 ${tz} ${v.type} ${bad}: niet gedragen`, !sameMeaning(index, r, `'${v.good}'`));
        ok(`fix2 ${tz} ${v.type} ${bad}: ook niet gedragen tegenover zichzelf`, !sameMeaning(index, r, `'${bad}'`));
        if (bad === '2027-03-01garbage') ok(`1114 ${tz} ${v.type}: rommel is niet dezelfde datum`, !sameMeaning(index, r, "'2027-03-01'"));
      }
      for (const date of ['2028-02-29T07:00:00', '2000-02-29', '2027-03-01T23:59:00']) {
        ok(`fix2 ${tz} geldige datum ${date}`, partialDateTime(date, 'datum-tijd') === undefined);
      }
      for (const clock of ['24:00', '24:00:00', '24:00:00.0', '24:00:00.000']) {
        const index = scanStep(latin1(`ISO-10303-21;HEADER;FILE_SCHEMA(('IFC4X3_ADD2'));ENDSEC;DATA;#1=IFCTIMEPERIOD('16:00:00','${clock}');ENDSEC;END-ISO-10303-21;`));
        const r = { chunk: index.chunkOf('1'), arg: 1, outArg: 1, token: `'${clock}'`, kind: 'samengesteld' as const };
        ok(`fix2 ${tz} daggrens ${clock} bestaat`, partialDateTime(clock, 'tijd') === undefined);
        ok(`fix2 ${tz} daggrens ${clock} dezelfde betekenis`, sameMeaning(index, r, "'24:00:00'"));
      }
      ok(`fix2 ${tz} oude uurbreuk blijft geldig`, partialDateTime('7.25:00:00', 'tijd', true) === undefined);
      ok(`fix2 ${tz} oude uurbreuk buiten dag weigert`, partialDateTime('24.25:00:00', 'tijd', true) === 'vorm');
      const cases = [
        { label: 'Sol 30 februari', match: /#47=IFCTASKTIME/, arg: 5, value: '2027-02-30T07:00:00', sol: true },
        { label: 'klok 24 uur', match: /#47=IFCTASKTIME/, arg: 5, value: '2027-03-01T24:00:00' },
        { label: 'maand 13', match: /#47=IFCTASKTIME/, arg: 5, value: '2027-13-01' },
        { label: 'uitzondering 30 februari', match: /#20=IFCWORKTIME/, arg: 4, value: '2027-02-30' },
        { label: 'werktijd 24:30', match: /#89998=IFCTIMEPERIOD/, arg: 1, value: '24:30:00' },
        { label: 'werktijd 24:00:01', match: /#89998=IFCTIMEPERIOD/, arg: 1, value: '24:00:01' },
        { label: 'werktijd 25 uur', match: /#89998=IFCTIMEPERIOD/, arg: 1, value: '25:00:00' },
      ];
      for (const c of cases) {
        const label = `fix2 ${tz} · ${c.label}`;
        const src = patchArg(base, c.match, c.arg, `'${c.value}'`);
        const { store, snapshot } = await openInStore(latin1(src));
        const task = store.getState().tasks[0];
        const start = task.time.scheduleStart;
        store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: 1.5, durationMinutes: 720 } });
        store.getState().runCPM();
        const d = cloneDomain(snapshot(store) as Opened);
        if (c.sol) ok(`${label}: planner wijzigde de start niet`, d.tasks[0].time.scheduleStart === start);
        const r = await tryMerge(d, snapshot(store).ifcSource!);
        if (!r.ok) {
          ok(`${label}: getypeerd geweigerd`, r.kinds.includes('tijd-deels-gelezen'));
          rows.push(`| ${label} | weigert (${r.kinds.join(', ')}) |`);
        } else {
          // Zoek dezelfde entiteit op type en naam; hulpstukken krijgen nieuwe STEP-ids.
          const sourceIndex = scanStep(latin1(src)), outIndex = scanStep(r.bytes);
          const sourceLine = src.split('\n').find(l => c.match.test(l))!;
          const chunk = sourceIndex.chunkOf(/^#(\d+)/.exec(sourceLine)![1]);
          let token: string | undefined;
          for (let i = 0; i < outIndex.count; i++) if (outIndex.type(i) === sourceIndex.type(chunk) && outIndex.name(i) === sourceIndex.name(chunk)) token = outIndex.argTokens(i)?.[c.arg];
          ok(`${label}: bronwaarde letterlijk behouden`, token === `'${c.value}'`);
          rows.push(`| ${label} | schrijft; bronwaarde ${token} |`);
        }
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
}

// 1109: voortgang invoeren via de echte storeactie, en dezelfde invoer als de telling.
{
  const src = walled('tests/planning/fixtures/b5-lopend-oude-writer.ifc');
  await proof('1109', '50 procent via storeactie, bronbehoud weigert veilig', src, 'niet-gedragen', async (d) => {
    const { store, snapshot } = await openInStore(latin1(src));
    const task = store.getState().tasks.find(t => !t.isSummary)!;
    store.getState().updateTask(task.id, { time: { ...task.time, actualStart: task.time.scheduleStart, completion: 0.5 } });
    Object.assign(d, cloneDomain(snapshot(store) as Opened));
  });
  await proof('1109', '50 procent zoals de telling, bronbehoud weigert veilig', src, 'niet-gedragen', d => {
    ordinaryEdits(d).find(e => e.kind === 'voortgang')!.apply(d);
  });
}

// Review #898, fixronde 1: de bewerking van een ander veld mag exacte duur/rest niet afronden.
{
  const precise = 2.3333333333333335;
  const base = walled(`${OLD}/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc`);
  const otherRest = 1.2345678901234567;
  const variants = [
    { name: 'bestaande precieze rest', src: base, remaining: precise },
    { name: 'afzonderlijke niet-lege precieze rest', src: patchArg(base, /IFCTASKTIME\('Set up site Time'/, 18, `'P0Y0M${otherRest}D'`), remaining: otherRest },
  ];
  for (const { name, src, remaining } of variants) {
    for (const edit of ['completion', 'actualStart'] as const) {
      const label = `1109 behoud · ${name} · ${edit}`;
      const { store, snapshot } = await openInStore(latin1(src));
      const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
      ok(`${label}: duur vóór actie exact`, task.time.scheduleDuration === precise);
      ok(`${label}: rest vóór actie exact`, task.time.remainingTime === remaining);
      const value = edit === 'completion' ? 0.5 : task.time.scheduleStart;
      store.getState().updateTask(task.id, { time: { ...task.time, [edit]: value } });
      const d = cloneDomain(snapshot(store) as Opened);
      const after = d.tasks.find(t => t.id === task.id)!;
      ok(`${label}: duur na actie ongewijzigd`, after.time.scheduleDuration === precise);
      ok(`${label}: rest na actie ongewijzigd`, after.time.remainingTime === remaining);
      const r = await tryMerge(d, snapshot(store).ifcSource!);
      ok(`${label}: de merge schrijft`, r.ok);
      if (!r.ok) continue;
      const out = text(r.bytes);
      const line = out.split('\n').find(l => /IFCTASKTIME\('Set up site Time'/.test(l))!;
      const args = splitArgs(line.slice(line.indexOf('(') + 1, line.lastIndexOf(')')));
      ok(`${label}: slot 4 houdt precieze bronwaarde`, args[4] === `'P0Y0M${precise}D'`);
      ok(`${label}: slot 18 houdt precieze bronwaarde`, args[18] === `'P0Y0M${remaining}D'`);
      ok(`${label}: vreemde deel behouden`, mergeProblems(latin1(src), r.bytes).length === 0);
      const back = await openForeign(r.bytes);
      const restored = back.tasks.find(t => t.id === task.id)!;
      ok(`${label}: duur na heropenen exact`, restored.time.scheduleDuration === precise);
      ok(`${label}: rest na heropenen exact`, restored.time.remainingTime === remaining);
      rows.push(`| ${label} | schrijft; exactheid van duur en rest apart getoetst |`);
    }
  }
}

// 1108: alleen de ongewijzigde OPS-writerfixture moet als eigen bron schrijven.
{
  const src = walled('tests/planning/fixtures/h7-kalender-oude-writer.ifc');
  await proof('1108', 'oude kalender zonder bewerking', src, 'schrijft');
  await proof('1108', 'oude kalender hernoemen', src, 'schrijft', d => { d.tasks[0].name = 'Nieuwe naam'; });
}

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
  // record en maakt de kalender letterlijk. Dan gaan alle datums op die kalender in de vorm van de writer, zoals bij een
  // gewone opslag (#886, besluit van Trias over de vroegere knownbug 1102).
  await proof('BLOKKEERT 1', 'halve dag, de duur zelf op 2 dagen', half, 'schrijft', (d) => { taskNamed(d, name).time.scheduleDuration = 2; },
    has(`IFCTASKTIME('${name} Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D'`));
  await proof('BLOKKEERT 1', 'halve dag, de duur zelf op 1,5 dag (kalender letterlijk)', half, 'schrijft', (d) => { taskNamed(d, name).time.scheduleDuration = 1.5; },
    has('LiteralTimes'));
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
  const raw = await openForeignRaw(latin1(h7));
  const evening = raw.resourceCalendars?.find(c => c.name === 'Avond dag');
  ok('daggrens: de lezer leest 24:00:00 als 1440 minuten', clockToMinutes('24:00:00') === 1440);
  ok('daggrens: de gelezen avondkalender eindigt op uur 24', evening?.workEndHour === 24);
  ok('daggrens: de gelezen band is 960–1440', !!evening && getCalendarBands(evening)?.canonical.byWeekday[1].some(b => b.start === 960 && b.end === 1440) === true);
  const shown = await openForeign(latin1(h7));
  const written = writeIFC(cloneDomain(shown));
  ok('daggrens: de huidige writer schrijft 1440 als 24:00:00', minutesToClock(1440, true) === '24:00:00');
  ok('daggrens: gewone writer schrijft dezelfde avondperiode', written.includes("IFCTIMEPERIOD('16:00:00','24:00:00')"));
  ok("BLOKKEERT 3: h7 heeft '7.5:00:00'", h7.includes("IFCTIMEPERIOD('7.5:00:00','16:00:00')"));
  const keeps = has("IFCTIMEPERIOD('7.5:00:00','16:00:00')", "IFCTIMEPERIOD('7.25:00:00','15.75:00:00')", "IFCTIMEPERIOD('16:00:00','24:00:00')");
  await proof('BLOKKEERT 3', 'h7 met wand, zonder bewerking', h7, 'schrijft', undefined, keeps);
  await proof('BLOKKEERT 3', 'h7 met wand, een taak hernoemd', h7, 'schrijft', (d) => { leaves(d)[0].name = 'Hernoemd'; }, keeps);
  await proof('BLOKKEERT 3', 'h7 met wand, het begin van de werkdag zelf op 8 uur', h7, 'schrijft', (d) => {
    d.calendar.workStartHour = 8; d.calendar.hoursPerDay = d.calendar.workEndHour - 8;
  }, has("IFCTIMEPERIOD('08:00:00','16:00:00')", "IFCTIMEPERIOD('16:00:00','24:00:00')"));
  const eigen = text(await settle(new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))));
  const clock = eigen.replace("IFCTIMEPERIOD('07:00:00','16:00:00')", "IFCTIMEPERIOD('7.5:00:00','16:00:00')");
  ok("BLOKKEERT 3: eigen-plus-model met '7.5:00:00'", clock !== eigen);
  await proof('BLOKKEERT 3', "eigen-plus-model met '7.5:00:00', zonder bewerking", clock, 'schrijft', undefined, has("IFCTIMEPERIOD('7.5:00:00','16:00:00')"));
  const m = /#(\d+)=IFCRECURRENCEPATTERN\(([^\n]*),\((#\d+)\)\);/.exec(clock)!;
  const second = withLines(clock.replace(m[0], `#${m[1]}=IFCRECURRENCEPATTERN(${m[2]},(${m[3]},#90100));`), ["#90100=IFCTIMEPERIOD('16.5:00:00','17:00:00');"]);
  await proof('BLOKKEERT 3', "dezelfde vorm in een tweede periode ('16.5:00:00')", second, 'tijd-deels-gelezen');
}

// Het tweede eigen bestand uit de CI heeft dezelfde daggrens, nu in een uurkalender.
{
  const src = walled('tests/planning/fixtures/urenperdag-oude-writer.ifc');
  const raw = await openForeignRaw(latin1(src));
  const late = [raw.calendar, ...(raw.resourceCalendars ?? [])].find(c => c.name === 'Late ploeg');
  ok('daggrens urenperdag: gelezen band eindigt op 1440', !!late && getCalendarBands(late)?.canonical.byWeekday[1].some(b => b.start === 840 && b.end === 1440) === true);
  const shown = await openForeign(latin1(src));
  ok('daggrens urenperdag: gewone writer houdt 14:00–24:00', writeIFC(cloneDomain(shown)).includes("IFCTIMEPERIOD('14:00:00','24:00:00')"));
  const kept = has("IFCTIMEPERIOD('14:00:00','24:00:00')");
  await proof('daggrens urenperdag', 'met wand, zonder bewerking', src, 'schrijft', undefined, kept);
  await proof('daggrens urenperdag', 'met wand, hernoemen', src, 'schrijft', d => { leaves(d)[0].name = 'Hernoemd'; }, kept);
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
  // De urentaak zelf, geen samenvatting: na openen via de app rekent de store de samenvattingen door, en die staan dan ook
  // in uren.
  const hourTask = (d: Domain) => d.tasks.find(t => t.time.durationUnit === 'hours' && t.childIds.length === 0)!.time;
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

// ── Na de merge met main: v2026.7.12 ──
// OPS tot en met v2026.9.x gaf de kop van een baseline het GlobalId `ifcGuid('baseline_ws_' + id)`, zonder zout. De writer
// geeft die kop het GlobalId van de bron terug (`sourceBaselineHeadGuids`); anders weigerde het bestand zonder bewerking.
{
  const src = walled(`${OLD}/v2026.7.12-data-showcase-verbouwing-eengezinswoning.ifc`);
  const head = has("=IFCWORKSCHEDULE('fZpd3PzHHVE7QnlVVp6Jo9',");
  await proof('v2026.7.12', 'data, zonder bewerking (de baselinekop houdt zijn GlobalId)', src, 'schrijft', undefined, head);
  await proof('v2026.7.12', 'data, een taak hernoemd', src, 'schrijft', (d) => { leaves(d)[1].name = 'Hernoemd'; }, head);
  // Knownbug 1104 (opgelost in de vervolg-PR van #867): een taak uit de baseline wissen. De bron-JSON heeft het interne id,
  // zonder `TaskGuids`; de regel van de gewiste taak houdt met (b) dat id, en wijst net als in de vorm van de writer naar geen
  // taak (`orphanRowsWithoutId`). De bron-JSON blijft staan.
  await proof('v2026.7.12', 'data, een taak uit de baseline gewist (#886)', src, 'schrijft', (d, o) => {
    plannerEdits(o, 1).find(e => e.kind === 'taak-wissen')!.apply(d);
  }, head);
  // Knownbug 1103: de kop breekt de grammatica; met de wand erbij weigert de oude route het model.
  const ohara = readText(`${OLD}/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc`);
  ok('v2026.7.12: ohara zonder wand opent', await openForeign(latin1(ohara)).then(() => true, () => false));
  const refused = await openForeign(latin1(walled(`${OLD}/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc`)))
    .then(() => 'opent', (e: unknown) => (e instanceof IfcParseError ? e.reason : String(e)));
  ok(`v2026.7.12: ohara met wand weigert bij openen (building-model), kreeg ${refused}`, refused === 'building-model');
  rows.push(`| v2026.7.12 · ohara met wand, openen (knownbug 1103) | ${refused === 'building-model' ? 'weigert (building-model)' : refused} |`);
}

// ── Een werkende uitzondering in een kalender (`WorkingExceptionIds`) ──
// De oude eigenschap `WorkingExceptionIds` noemt de werkende uitzonderingen van een kalender bij het `#id` van hun
// `IFCWORKTIME`; OPS v2026.8.1 tot en met v2026.43.x lezen alleen die (daarna gaat `WorkingExceptionKeysV1` voor, knownbug
// 112). De merge geeft elk eigen stuk een nieuw id. De lijst moet dan naar de nieuwe ids wijzen, en een bewerking die de
// nummering van de writer verschuift (een relatie of taak erbij, een taak gewist) is geen wijziging van de kalender
// (#886). Het bestand van de oude writer, en hetzelfde bestand zoals de writer van nu het schrijft.
{
  const exceptionIds = (out: string) => {
    const ids = /'WorkingExceptionIds',\$,IFCTEXT\('\[([^\]]*)\]'\)/.exec(out)?.[1];
    if (ids === undefined) return 'geen WorkingExceptionIds in de uitvoer';
    const bad = ids.replace(/"/g, '').split(',').filter(id => !new RegExp(`^#${id}=IFCWORKTIME\\(`, 'm').test(out));
    return bad.length === 0 ? undefined : `WorkingExceptionIds wijst naar ${bad.map(id => `#${id}`).join(', ')}: geen werktijd`;
  };
  const rel = 'tests/planning/fixtures/ifc-arity-oude-writer.ifc';
  const now = withLines(writeIFC(cloneDomain(await openForeignRaw(latin1(readText(rel))))), REVIT_WALL);
  ok('werkende uitzondering: de writer van nu schrijft WorkingExceptionIds', now.includes("'WorkingExceptionIds',$,IFCTEXT('[\""));
  const edit = (kind: EditKind) => (d: Domain, o: Opened) => {
    [...plannerEdits(o, 1), ...ordinaryEdits(o)].find(e => e.kind === kind)!.apply(d);
  };
  for (const [label, src] of [['oude writer', walled(rel)], ['writer van nu', now]] as const) {
    await proof('werkende uitzondering', `${label}, zonder bewerking`, src, 'schrijft', undefined, exceptionIds);
    for (const kind of ['relatie-erbij', 'taak-erbij', 'taak-wissen'] as const) {
      await proof('werkende uitzondering', `${label}, ${kind}`, src, 'schrijft', edit(kind), exceptionIds);
    }
  }
}

// ── Was knownbug 1102: een kalender die bij deze opslag letterlijk wordt (#886, besluit van Trias, 10 november 2026) ──
// Dan schrijft de merge elke datum en werktijd op die kalender in de vorm van de writer, zoals een gewone opslag op main
// (`minuteModelPending`). De toets van Trias: een oud eigen bestand met model geeft na een duurwijziging, F5 en opslaan via
// de merge dezelfde planning als hetzelfde bestand zonder model na dezelfde bewerking en een gewone opslag op main.
// Fixronde 1 (besluit van Trias, 11 november 2026): die gewone opslag is die van main zelf. De route staat in
// `ifcAppRoute.ts` (`plainSaveAfterF5`); `scripts/proef/maak-main-toets-trias.mjs` draaide haar met de code van main en
// schreef de sha256 van de uitvoer naar `fixtures/main-toets-trias.json`. Hier draait dezelfde route met de code van de
// branch: dezelfde bytes als main, en pas dan de vergelijking. Herlezen gaat beide keren via de app; `canon` vergelijkt de
// hele planning (taken met hun tijden, relaties met lag, resources, toewijzingen, kalenders).
{
  const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/planning/fixtures/main-toets-trias.json'), 'utf8')) as { basis: string; bestanden: TriasEntry[] };
  ok('toets van Trias: de fixture van main noemt de tien bestanden', JSON.stringify(fixture.bestanden.map(b => b.pad)) === JSON.stringify(TRIAS_FILES));
  for (const rel of TRIAS_FILES) {
    const name = `toets van Trias · ${rel.split('/').pop()}`;
    const want = fixture.bestanden.find(b => b.pad === rel);
    const raw = readText(rel);
    const bare = bareBytes(ROOT, rel);
    const modelled = rel === TRIAS_MODEL_FILE ? raw : withLines(raw, REVIT_WALL);
    ok(`${name}: zonder model geen IFCWALL`, !text(bare).includes('IFCWALL('));
    ok(`${name}: de invoer is die van de fixture van main (anders: node scripts/proef/maak-main-toets-trias.mjs)`, want?.invoerSha256 === sha256(bare));
    const o = await openForeign(latin1(modelled));
    const edit = ordinaryEdits(o).find(e => e.kind === 'doorrekenen')!;
    const mine = cloneDomain(o);
    edit.apply(mine);
    const r = await tryMerge(await recalculated(mine), o.ifcSource!);
    if (!r.ok) {
      rows.push(`| ${name} | weigert (${r.kinds.join(', ')}): ${(r.error.cases[0]?.detail ?? '').slice(0, 100).replace(/\|/g, '/')} |`);
      ok(`${name}: de merge schrijft, kreeg ${r.kinds.join(', ')} — ${(r.error.cases[0]?.detail ?? '').slice(0, 200)}`, false);
      continue;
    }
    reseed(0x804);
    const plain = await plainSaveAfterF5(bare);
    ok(`${name}: de gewone opslag is byte-gelijk aan die van main ${fixture.basis}`, want?.uitvoerSha256 === sha256(plain));
    const viaMain = canon(await openForeign(new TextEncoder().encode(plain)), reseed);
    const viaMerge = canon(await openForeign(r.bytes), reseed);
    const a = viaMerge.split('\n'), b = viaMain.split('\n');
    const first = a.findIndex((line, i) => line !== b[i]);
    rows.push(`| ${name} | ${viaMerge === viaMain ? 'schrijft, dezelfde planning als een gewone opslag op main zonder model' : `schrijft, andere planning: ${(a[first] ?? '').slice(0, 80)}`} |`);
    ok(`${name}: dezelfde planning als een gewone opslag op main zonder model (eerste verschil: ${(a[first] ?? '').slice(0, 160)} tegenover ${(b[first] ?? '').slice(0, 160)})`, viaMerge === viaMain);
  }
}

// De grenzen. Op zo'n kalender houdt een slot dat de lezer niet draagt (de naam van een taaktijd, die de writer uit de taak
// afleidt) de bronwaarde via (b); alleen de datums en werktijden gaan in de vorm van de writer (`LITERAL_EXACT_SLOTS`). Een
// datum-tijd die de lezer deels leest (met een tijdzone), weigert, ook als de kalender letterlijk wordt. Een kalender die
// niet letterlijk wordt, houdt de bronvorm: zie BLOKKEERT 1 hierboven ("een andere taak hernoemd").
{
  const villa = walled(`${OLD}/v2026.43.0-10-villa-wassenaar.ifc`);
  const f5 = async (d: Domain, o: Opened) => {
    const edit = ordinaryEdits(o).find(e => e.kind === 'doorrekenen')!;
    edit.apply(d);
    Object.assign(d, await recalculated(d));
  };
  const named = villa.replace(/IFCTASKTIME\('[^']*'/, "IFCTASKTIME('Eigen naam'");
  ok('grens: de bron heeft een eigen naam in een taaktijd', named !== villa);
  await proof('grens', 'een eigen naam in een taaktijd, duur en F5 (kalender letterlijk)', named, 'schrijft', f5,
    has("IFCTASKTIME('Eigen naam'", 'LiteralTimes'));
  const zoned = villa.replace(/(IFCTASKTIME\('[^']*',\.PREDICTED\.,\$,\.[A-Z]+\.,'[^']*',)'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)'/, "$1'$2Z'");
  ok('grens: de bron heeft een begin met een tijdzone', zoned !== villa);
  await proof('grens', 'een begin met een tijdzone, duur en F5', zoned, 'tijd-deels-gelezen', f5);
}

// ── Fixronde 1 van #886 (review ronde 1): een slot is pas gedragen als de lezing van de bron zijn waarde teruggeeft ──
// De proeven van Sol. Een geldige schrijfwijze bewijst niet dat de lezer de waarde draagt: `'07:30:00'` in de enige
// periode van een scalaire kalender leest de lezer als 07:00, en `'2027-03-01T11:00:00'` op zo'n kalender op dagniveau.
// Zo'n bronwaarde blijft staan of de merge weigert getypeerd; nooit de waarde van de writer erover. Ook via de echte
// storeactie (`updateTask`, `runCPM`).
{
  const PERIOD = 'tests/planning/fixtures/review886/periode-0730.ifc';
  const START = 'tests/planning/fixtures/review886/taaktijd-1100.ifc';
  // De bronnen van Sol (`/tmp/claude-1000/review-886-sol-r1/`), zonder de wand; die zet de proef erbij (`walled`).
  ok('Sol: de periode-bron heeft 07:30', readText(PERIOD).includes("IFCTIMEPERIOD('07:30:00','16:00:00')"));
  ok('Sol: de taaktijd-bron heeft een begin om 11:00', readText(START).includes("'P0Y0M1D','2027-03-01T11:00:00'"));
  /** Schrijft de merge, dan staat `sentinel` er nog; anders weigert hij getypeerd. */
  const keepsOrRefuses = async (label: string, sentinel: string, input: () => Promise<{ d: Domain; o: Opened }>) => {
    const { d, o } = await input();
    const r = await tryMerge(d, o.ifcSource!);
    const kept = r.ok && text(r.bytes).includes(sentinel);
    rows.push(`| Sol · ${label} | ${r.ok ? (kept ? `schrijft, ${sentinel} blijft` : `schrijft zonder ${sentinel}`) : `weigert (${r.kinds.join(', ')})`} |`);
    ok(`Sol · ${label}: de bronwaarde ${sentinel} blijft staan of de merge weigert (${r.ok ? 'schrijft zonder' : r.kinds.join(', ')})`,
      kept || (!r.ok && r.kinds.length > 0));
    return r;
  };
  const viaInput = (rel: string, edit?: (d: Domain) => void) => async () => {
    const o = await openForeign(latin1(walled(rel)));
    const d = cloneDomain(o);
    edit?.(d);
    return { d, o };
  };
  const viaStore = (rel: string, act: (st: Awaited<ReturnType<typeof openInStore>>['store']) => void) => async () => {
    const { store, snapshot } = await openInStore(latin1(walled(rel)));
    act(store);
    const o = snapshot(store);
    return { d: cloneDomain(o), o };
  };
  const longer = (minutes: number) => (d: Domain) => {
    const time = d.tasks[0].time;
    time.scheduleDuration = minutes / 480; time.durationMinutes = minutes; time.remainingMinutes = minutes; time.remainingTime = minutes / 480;
  };
  // Proef 1: de periode.
  const none = await keepsOrRefuses('periode 07:30, zonder bewerking', "'07:30:00'", viaInput(PERIOD));
  ok('Sol · periode 07:30, zonder bewerking: schrijft', none.ok);
  await keepsOrRefuses('periode 07:30, duur 1,5 dag (invoer)', "'07:30:00'", viaInput(PERIOD, (d) => { d.tasks[0].time.scheduleDuration = 1.5; }));
  await keepsOrRefuses('periode 07:30, duur 1,5 dag (updateTask)', "'07:30:00'", viaStore(PERIOD, (store) => {
    const t = store.getState().tasks[0];
    store.getState().updateTask(t.id, { time: { ...t.time, scheduleDuration: 1.5 } });
  }));
  await keepsOrRefuses('periode 07:30, duur 1,5 dag en F5 (updateTask, runCPM)', "'07:30:00'", viaStore(PERIOD, (store) => {
    const t = store.getState().tasks[0];
    store.getState().updateTask(t.id, { time: { ...t.time, scheduleDuration: 1.5 } });
    store.getState().runCPM();
  }));
  // Proef 2: de taaktijd. De duur verandert, het begin niet.
  const start = await keepsOrRefuses('begin 11:00, zonder bewerking', "'2027-03-01T11:00:00'", viaInput(START));
  ok('Sol · begin 11:00, zonder bewerking: schrijft', start.ok);
  await keepsOrRefuses('begin 11:00, de duurvelden op 2 dagen (invoer)', "'2027-03-01T11:00:00'", viaInput(START, longer(960)));
  await keepsOrRefuses('begin 11:00, de duur op 2 dagen (updateTask)', "'2027-03-01T11:00:00'", viaStore(START, (store) => {
    const t = store.getState().tasks[0];
    store.getState().updateTask(t.id, { time: { ...t.time, durationMinutes: 960, scheduleDuration: 2 } });
  }));
}

// Proef 3 (Terra punt 4): de planner wijzigt de kalender en raakt geen taaktijd aan. Blijft de kalender scalair, dan blijft
// elke taaktijd van de bron letterlijk staan. Wordt hij letterlijk (een andere werkstart), dan gaan de datums in de vorm van
// de writer (besluit van Trias over 1102), en geeft herlezen via de app dezelfde planning als een gewone opslag van dezelfde
// invoer. Op `1cb0b0057` was deze proef al groen.
{
  const taskTimes = (s: string) => new Map([...s.matchAll(/^#\d+=IFCTASKTIME\('([^']*)',.*$/gm)].map(m => [m[1], m[0].slice(m[0].indexOf('('))]));
  for (const [file, src] of [['v2026.43.0', walled(`${OLD}/v2026.43.0-10-villa-wassenaar.ifc`)],
    ['eigen-plus-model', readText('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')]] as const) {
    const o = await openForeign(latin1(src));
    for (const [label, edit] of [
      ['werkdagen ma-za', (d: Domain) => { d.calendar.workDays = [1, 2, 3, 4, 5, 6]; }],
      ['werkstart 8-17', (d: Domain) => { d.calendar.workStartHour += 1; d.calendar.workEndHour += 1; }],
    ] as const) {
      const name = `Terra 4 · ${file}, ${label}`;
      const d = cloneDomain(o);
      edit(d);
      ok(`${name}: de taaktijden zijn gelijk aan opened`, d.tasks.every((t, i) => JSON.stringify(t.time) === JSON.stringify(o.tasks[i].time)));
      const r = await tryMerge(d, o.ifcSource!);
      if (!r.ok) { rows.push(`| ${name} | weigert (${r.kinds.join(', ')}) |`); continue; }
      const out = text(r.bytes);
      if (!out.includes("'LiteralTimes'")) {
        const before = taskTimes(src), after = taskTimes(out);
        const other = [...before].filter(([n, line]) => after.get(n) !== line);
        rows.push(`| ${name} | schrijft, kalender scalair, ${other.length} taaktijden anders dan de bron |`);
        ok(`${name}: elke taaktijd blijft zoals in de bron (${other[0]?.[0] ?? ''})`, other.length === 0);
      } else {
        const viaMerge = canon(await openForeign(r.bytes), reseed), viaPlain = canon(await reopenPlain(d), reseed);
        rows.push(`| ${name} | schrijft, kalender letterlijk, ${viaMerge === viaPlain ? 'dezelfde planning als een gewone opslag' : 'een andere planning'} |`);
        ok(`${name}: dezelfde planning als een gewone opslag van dezelfde invoer`, viaMerge === viaPlain);
      }
    }
  }
}

// Proef 2b (Terra punt 4, met de regel `plannerReplacedDate`): de planner zet de duur van de urentaak van v2026.7.7 in
// minuten (dezelfde halve dag) en raakt haar datums niet aan. De bron schrijft ze als `'2027-03-01T11:00'`; dezelfde waarde,
// in een andere vorm dan de writer. Een ander veld van de taak telt niet als wijziging van haar datums: de bronwaarden
// blijven staan, of de merge weigert.
{
  const src = walled(`${OLD}/v2026.7.7-urentaak-10-villa-wassenaar.ifc`);
  const o = await openForeign(latin1(src));
  const d = cloneDomain(o);
  const t = d.tasks.find(x => x.name === 'Bouwplaats inrichten')!;
  ok('proef 2b: de taak heeft nog geen duur in minuten', t.time.durationMinutes === undefined && t.time.scheduleDuration === 0.5);
  t.time.durationMinutes = 240;
  const r = await tryMerge(d, o.ifcSource!);
  const dates = (s: string) => splitArgs(/^#\d+=IFCTASKTIME\('Bouwplaats inrichten Time',(.*)\);$/m.exec(s)?.[1] ?? '').slice(4, 10);
  const kept = r.ok && JSON.stringify(dates(text(r.bytes))) === JSON.stringify(dates(src));
  rows.push(`| proef 2b · urentaak v2026.7.7, de duur in minuten | ${r.ok ? (kept ? 'schrijft, de datums van de bron blijven' : 'schrijft met andere datums') : `weigert (${r.kinds.join(', ')})`} |`);
  ok(`proef 2b: de datums van de bron blijven staan of de merge weigert (${r.ok ? dates(text(r.bytes)).join(',') : ''})`, kept || !r.ok);
}

// Proef 4 (Terra punt 3 en Sol): `literalBaselineForm`. Sectie 1 ziet de datums in de JSON van een baseline niet.
// (a) Een baselinestart met een tijdzone: de writer op de lezing (O0) schrijft haar als `'2027-05-07'`; de lezing draagt de
// waarde dus niet, (b) zet de JSON terug, en op een kalender die letterlijk wordt (de duur 1,5 dag) weigert de merge.
// (b) Een baseline die de lezer wel draagt, maar die de planner wijzigde: dat is geen vorm van de writer, dus geen
// verklaring; de merge weigert (de regel `plannerChanged` in `literalBaselineForm`). Zonder wijziging schrijft hij: zie
// de proeven "kalendertijd" in `check-ifc-foreign-strikt.ts`.
{
  const settled = text(await settle(latin1(readText('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'))));
  const zoned = settled.replace('"start":"2027-05-07"', '"start":"2027-05-07T07:00:00Z"');
  ok('baseline: de bron met tijdzone heeft er een', zoned.includes('"start":"2027-05-07T07:00:00Z"'));
  const halfDay = (d: Domain) => { d.tasks.find(t => !t.isMilestone && t.childIds.length === 0)!.time.scheduleDuration = 1.5; };
  await proof('baseline', 'een start met tijdzone, duur 1,5 dag (kalender letterlijk)', zoned, 'niet-gedragen', halfDay);
  await proof('baseline', 'de planner verschuift een baselinestart, duur 1,5 dag (kalender letterlijk)', settled, 'niet-gedragen', (d) => {
    halfDay(d);
    d.baselines![0].tasks[1].start = '2027-05-10T07:00';
  });
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
