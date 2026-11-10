// #804 fase 1b, bijsturing 1 punt 2: hoe vaak ziet de planner `merge-needs-phase2`?
//
// Per corpusbestand met een vreemd deel (`tests/fixtures/ifc-foreign/`, ook `council/`, en de oude eigen bestanden in
// `tests/planning/fixtures/oude-tags/`) de gewone bewerkingen van
// `plannerEdits` (`ifcMergeKern.ts`): niets; een taak onder een andere ouder, een niveau hoger, de volgorde van kinderen;
// een relatie erbij; een taak wissen. Per taak of per paar; boven `MAX_PER_SOORT` een vaste steekproef.
//
// Per bewerking één van drie uitkomsten:
//   - gelukt: de merge schrijft, de invarianten kloppen (`mergeProblems`), geen object krijgt een tweede `Decomposes`,
//     `Nests` of `HasContext`, en de herlezing geeft dezelfde planning als dezelfde bewerking zonder vreemd deel (`canon`);
//   - merge-needs-phase2: de getypeerde weigering, met de gevallen;
//   - anders: een andere fout, een gebroken invariant of een andere planning na herlezen.
// De check drukt de tabel af en is rood bij elke "anders": elke bewerking schrijft goed of weigert getypeerd. Ook rood:
// een fout bij openen, behalve de verwachte weigering in `REFUSED_AT_OPEN` (met haar reden).
// Daarna (fixronde 2 van #867, bijsturing punt 2): hoeveel eigen bestanden (zonder vreemde herkomst) al zonder bewerking
// `niet-gedragen` krijgen, het totaal van die meldingen, en de velden (entiteit + slot, bij een pset of property de naam)
// die het vaakst de oorzaak zijn. Sinds fixronde 3 (de bronwaarden van (b)) schrijft bijna elk eigen bestand zonder
// bewerking; de telling splitst de bewerkingen daarom in drie groepen: eigen bestanden die zonder bewerking schrijven,
// eigen bestanden die al zonder bewerking weigeren, en planningen van een ander programma (`vreemde-herkomst`), met de
// velden achter `niet-gedragen` na een bewerking.
// Exit 0 = geen "anders".
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { canon, cloneDomain, doubleMemberships, mergeProblems, openForeign, plannerEdits, tryMerge, type EditKind, type Opened } from './ifcMergeKern';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { IfcParseError, type IfcParseErrorReason } from '@/services/ifc/ifcErrors';
import { scanStep, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import type { MergePhase2Case } from '@/services/ifc/foreign/mergeWriter';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');
const MAX_PER_SOORT = 40;

// Ook de oude eigen bestanden (fixronde 1 van #867): een bestand van v2026.7.2 heeft een los project (V) en gaat sinds
// het vervallen van de kortsluiting door de gewone merge. Paden vanaf `FOREIGN`.
const OLD_OWN = '../../planning/fixtures/oude-tags';
const files = [
  ...readdirSync(FOREIGN).filter(f => f.endsWith('.ifc')),
  ...readdirSync(join(FOREIGN, 'council')).filter(f => f.endsWith('.ifc')).map(f => `council/${f}`),
  ...readdirSync(join(FOREIGN, OLD_OWN)).filter(f => f.endsWith('.ifc')).map(f => `${OLD_OWN}/${f}`),
].sort();

interface Tally { n: number; ok: number; refused: Map<string, number>; other: Map<string, number> }
const tally = new Map<string, Map<EditKind, Tally>>();
const others: string[] = [];
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
// `installDeterminism` zet de klok vast; de looptijd komt daarom uit `performance.now`.
const started = performance.now();
let merges = 0;

/** Bestanden die al bij openen geweigerd worden, met de reden (VERVOLG van Terra, fixronde 1 van #867): IFC2X3 valt
 *  buiten de bytes-route, en de huidige route weigert een model (knownbug 110). Elke andere fout bij openen is rood. */
const REFUSED_AT_OPEN: Readonly<Record<string, IfcParseErrorReason>> = { 'model-ifc2x3.ifc': 'building-model' };
const refusedAtOpen: string[] = [];

/** Zonder bewerking, per eigen bestand: de meldingen `niet-gedragen`. */
const notCarried = new Map<string, readonly MergePhase2Case[]>();
/** Per bestand: de velden achter `niet-gedragen` na een bewerking (niet bij "niets"). */
const editFields = new Map<string, Map<string, number>>();
let ownFiles = 0;
/** Het veld van een melding: type, de naam van de pset of property, en het slot. */
function fieldOf(index: StepIndex, c: MergePhase2Case): string {
  const i = index.chunkOf(String(c.sourceId));
  const type = index.type(i);
  const named = type === 'IFCRELDEFINESBYPROPERTIES' ? index.refAt(i, 5) : type.startsWith('IFCPROPERTY') ? i : -1;
  const name = named >= 0 ? index.name(named) : undefined;
  const slot = c.field?.whole ?? (c.field?.slotless ? `argument ${c.field.arg} (geen slot in de ${c.field.slotless})` : `argument ${c.field?.arg}`);
  return `${type}${name ? ` (${type === 'IFCRELDEFINESBYPROPERTIES' ? 'van ' : ''}${name})` : ''} ${slot}`;
}

for (const file of files) {
  const bytes = new Uint8Array(readFileSync(join(FOREIGN, file)));
  const shown = file.startsWith(OLD_OWN) ? `oude-tags${file.slice(OLD_OWN.length)}` : file;
  let opened;
  try {
    opened = await openForeign(bytes);
  } catch (e) {
    const want = REFUSED_AT_OPEN[file];
    if (want !== undefined && e instanceof IfcParseError && e.reason === want) { refusedAtOpen.push(file); continue; }
    others.push(`${shown} · openen: ${e instanceof IfcParseError ? `IfcParseError ${e.reason}` : (e as Error).message.slice(0, 160)}`);
    continue;
  }
  if (REFUSED_AT_OPEN[file] !== undefined) { others.push(`${shown} · openen: verwacht geweigerd (${REFUSED_AT_OPEN[file]}), maar opent`); continue; }
  if (!opened.ifcSource?.foreign) continue;
  const perKind = await runEdits(shown, bytes, opened);
  tally.set(shown, perKind);
}

/** De gewone bewerkingen op één bestand, met per bewerking één van de drie uitkomsten. */
async function runEdits(shown: string, bytes: Uint8Array, opened: Opened): Promise<Map<EditKind, Tally>> {
  const source = opened.ifcSource!;
  const perKind = new Map<EditKind, Tally>();
  const sourceDoubles = doubleMemberships(bytes);
  const index = scanStep(bytes);
  const fields = new Map<string, number>();
  editFields.set(shown, fields);
  const where = shown;
  for (const edit of plannerEdits(opened, MAX_PER_SOORT)) {
    const t = perKind.get(edit.kind) ?? { n: 0, ok: 0, refused: new Map(), other: new Map() };
    perKind.set(edit.kind, t);
    t.n++;
    merges++;
    const fail = (reason: string) => { bump(t.other, reason); others.push(`${where} · ${edit.label}: ${reason}`); };
    try {
      const d = cloneDomain(opened);
      edit.apply(d);
      const outcome = await tryMerge(d, source);
      if (edit.kind === 'niets' && (outcome.ok || !outcome.kinds.includes('vreemde-herkomst'))) {
        ownFiles++;
        notCarried.set(shown, outcome.ok ? [] : outcome.error.cases.filter(c => c.kind === 'niet-gedragen'));
      }
      if (!outcome.ok) {
        for (const k of outcome.kinds) bump(t.refused, k);
        if (edit.kind !== 'niets') {
          for (const key of new Set(outcome.error.cases.filter(c => c.kind === 'niet-gedragen' && c.sourceId !== undefined).map(c => fieldOf(index, c)))) bump(fields, key);
        }
        continue;
      }
      const problems = mergeProblems(source.bytes, outcome.bytes);
      if (problems.length > 0) { fail(`invariant: ${problems[0]}`); continue; }
      const doubles = doubleMemberships(outcome.bytes).filter(k => !sourceDoubles.includes(k));
      if (doubles.length > 0) { fail(`dubbel lidmaatschap: ${doubles[0]}`); continue; }
      const reread = await openForeign(outcome.bytes);
      const plain = readIFC(writeIFC(d));
      if (canon(reread, reseed) !== canon(plain, reseed)) { fail('andere planning na herlezen'); continue; }
      t.ok++;
    } catch (e) {
      fail(`fout: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return perKind;
}

// ── De tabellen ──
const KINDS: EditKind[] = ['niets', 'andere-ouder', 'niveau-hoger', 'volgorde-kinderen', 'relatie-erbij', 'taak-wissen'];
const fmt = (m: Map<string, number>) => [...m].sort().map(([k, v]) => `${k} ${v}`).join(', ') || '–';
/** Per bestand en per bewerking, dan de totalen per bewerking. Geeft het totaal terug. */
function printTally(byFile: ReadonlyMap<string, ReadonlyMap<EditKind, Tally>>): { n: number; ok: number; other: number } {
  console.log('| bestand | bewerking | aantal | gelukt | merge-needs-phase2 (geval: aantal) | anders |');
  console.log('|---|---|---|---|---|---|');
  const total = new Map<EditKind, Tally>();
  for (const [file, perKind] of byFile) {
    for (const kind of KINDS) {
      const t = perKind.get(kind);
      if (!t) continue;
      const refusedN = t.n - t.ok - [...t.other.values()].reduce((a, b) => a + b, 0);
      console.log(`| ${file} | ${kind} | ${t.n} | ${t.ok} | ${refusedN}${refusedN ? ` (${fmt(t.refused)})` : ''} | ${fmt(t.other)} |`);
      const all = total.get(kind) ?? { n: 0, ok: 0, refused: new Map(), other: new Map() };
      all.n += t.n; all.ok += t.ok;
      for (const [k, v] of t.refused) all.refused.set(k, (all.refused.get(k) ?? 0) + v);
      for (const [k, v] of t.other) all.other.set(k, (all.other.get(k) ?? 0) + v);
      total.set(kind, all);
    }
  }
  console.log('');
  console.log('| bewerking | aantal | gelukt | merge-needs-phase2 | anders |');
  console.log('|---|---|---|---|---|');
  for (const kind of KINDS) {
    const t = total.get(kind);
    if (!t) continue;
    const otherN = [...t.other.values()].reduce((a, b) => a + b, 0);
    console.log(`| ${kind} | ${t.n} | ${t.ok} | ${t.n - t.ok - otherN} (${fmt(t.refused)}) | ${otherN} |`);
  }
  return {
    n: [...total.values()].reduce((a, t) => a + t.n, 0),
    ok: [...total.values()].reduce((a, t) => a + t.ok, 0),
    other: [...total.values()].reduce((a, t) => a + [...t.other.values()].reduce((x, y) => x + y, 0), 0),
  };
}
const asRead = printTally(tally);
console.log('');
console.log(`Totaal: ${asRead.n} bewerkingen, ${asRead.ok} gelukt, ${asRead.n - asRead.ok - asRead.other} merge-needs-phase2, ${asRead.other} anders; `
  + `${tally.size} bestanden met een vreemd deel; geweigerd bij openen: ${refusedAtOpen.join(', ') || '–'}.`);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

// ── Per groep: eigen bestanden die zonder bewerking schrijven, die al weigeren, en andere programma's ──
{
  const GROUPS = ['eigen, schrijft zonder bewerking', 'eigen, weigert zonder bewerking', 'ander programma'] as const;
  const groupOf = (file: string) => {
    const plain = notCarried.get(file);
    return plain === undefined ? GROUPS[2] : plain.length === 0 ? GROUPS[0] : GROUPS[1];
  };
  console.log('');
  console.log('Per groep (alle bewerkingen behalve "niets"):');
  console.log('');
  console.log('| groep | bestanden | bewerkingen | gelukt | merge-needs-phase2 (geval: aantal) | anders |');
  console.log('|---|---|---|---|---|---|');
  for (const group of GROUPS) {
    const files = [...tally.keys()].filter(f => groupOf(f) === group);
    let n = 0; let okN = 0; let otherN = 0;
    const refusedKinds = new Map<string, number>();
    const fields = new Map<string, number>();
    for (const f of files) {
      for (const [kind, t] of tally.get(f)!) {
        if (kind === 'niets') continue;
        n += t.n; okN += t.ok; otherN += [...t.other.values()].reduce((a, b) => a + b, 0);
        for (const [k, v] of t.refused) refusedKinds.set(k, (refusedKinds.get(k) ?? 0) + v);
      }
      for (const [k, v] of editFields.get(f) ?? []) fields.set(k, (fields.get(k) ?? 0) + v);
    }
    console.log(`| ${group} | ${files.length} | ${n} | ${okN} | ${n - okN - otherN} (${fmt(refusedKinds)}) | ${otherN} |`);
    const top = [...fields].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
    if (top.length > 0) console.log(`|  | velden achter niet-gedragen: ${top.map(([k, v]) => `${v} × ${k}`).join('; ')} | | | | |`);
  }
}

// ── Zonder bewerking: eigen bestanden met `niet-gedragen` ──
{
  const fields = new Map<string, { n: number; files: Set<string> }>();
  let total = 0;
  for (const [file, cases] of notCarried) {
    const full = file.startsWith('oude-tags/') ? join(FOREIGN, OLD_OWN, file.slice('oude-tags/'.length)) : join(FOREIGN, file);
    const index = scanStep(new Uint8Array(readFileSync(full)));
    for (const c of cases) {
      total++;
      const key = fieldOf(index, c);
      const g = fields.get(key) ?? { n: 0, files: new Set<string>() };
      g.n++; g.files.add(file); fields.set(key, g);
    }
  }
  const withCases = [...notCarried.values()].filter(c => c.length > 0).length;
  console.log('');
  console.log(`Zonder bewerking: ${withCases} van de ${ownFiles} eigen bestanden met een vreemd deel krijgen niet-gedragen, samen ${total} meldingen.`);
  console.log('De velden die het vaakst de oorzaak zijn:');
  for (const [k, g] of [...fields].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 10)) console.log(`  ${g.n} × ${k} (${g.files.size} bestanden)`);
}

if (others.length > 0) {
  console.log(`XX  ifc-foreign-merge-telling: ${others.length} bewerking(en) met een andere uitkomst dan gelukt of merge-needs-phase2`);
  for (const o of others.slice(0, 40)) console.log(`   - ${o}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-merge-telling: ${merges} merges over ${tally.size} bestanden, elk gelukt of getypeerd geweigerd (${seconds} s)`);
process.exit(0);
