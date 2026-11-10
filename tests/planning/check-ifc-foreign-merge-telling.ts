// #804 fase 1b, bijsturing 1 punt 2: hoe vaak ziet de planner `merge-needs-phase2`?
//
// Per corpusbestand met een vreemd deel (`tests/fixtures/ifc-foreign/`, ook `council/`) de gewone bewerkingen van
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
// Exit 0 = geen "anders".
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { canon, cloneDomain, doubleMemberships, mergeProblems, openForeign, plannerEdits, tryMerge, type EditKind } from './ifcMergeKern';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { IfcParseError, type IfcParseErrorReason } from '@/services/ifc/ifcErrors';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');
const MAX_PER_SOORT = 40;

const files = [
  ...readdirSync(FOREIGN).filter(f => f.endsWith('.ifc')),
  ...readdirSync(join(FOREIGN, 'council')).filter(f => f.endsWith('.ifc')).map(f => `council/${f}`),
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

for (const file of files) {
  const bytes = new Uint8Array(readFileSync(join(FOREIGN, file)));
  let opened;
  try {
    opened = await openForeign(bytes);
  } catch (e) {
    const want = REFUSED_AT_OPEN[file];
    if (want !== undefined && e instanceof IfcParseError && e.reason === want) { refusedAtOpen.push(file); continue; }
    others.push(`${file} · openen: ${e instanceof IfcParseError ? `IfcParseError ${e.reason}` : (e as Error).message.slice(0, 160)}`);
    continue;
  }
  if (REFUSED_AT_OPEN[file] !== undefined) { others.push(`${file} · openen: verwacht geweigerd (${REFUSED_AT_OPEN[file]}), maar opent`); continue; }
  const source = opened.ifcSource;
  if (!source?.foreign) continue;
  const perKind = new Map<EditKind, Tally>();
  tally.set(file, perKind);
  const sourceDoubles = doubleMemberships(bytes);
  for (const edit of plannerEdits(opened, MAX_PER_SOORT)) {
    const t = perKind.get(edit.kind) ?? { n: 0, ok: 0, refused: new Map(), other: new Map() };
    perKind.set(edit.kind, t);
    t.n++;
    merges++;
    const fail = (reason: string) => { bump(t.other, reason); others.push(`${file} · ${edit.label}: ${reason}`); };
    try {
      const d = cloneDomain(opened);
      edit.apply(d);
      const outcome = tryMerge(d, source);
      if (!outcome.ok) { for (const k of outcome.kinds) bump(t.refused, k); continue; }
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
}

// ── De tabel ──
const KINDS: EditKind[] = ['niets', 'andere-ouder', 'niveau-hoger', 'volgorde-kinderen', 'relatie-erbij', 'taak-wissen'];
const fmt = (m: Map<string, number>) => [...m].sort().map(([k, v]) => `${k} ${v}`).join(', ') || '–';
console.log('| bestand | bewerking | aantal | gelukt | merge-needs-phase2 (geval: aantal) | anders |');
console.log('|---|---|---|---|---|---|');
const total = new Map<EditKind, Tally>();
for (const [file, perKind] of tally) {
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
const seconds = ((performance.now() - started) / 1000).toFixed(1);
const totalN = [...total.values()].reduce((a, t) => a + t.n, 0);
const totalOk = [...total.values()].reduce((a, t) => a + t.ok, 0);
const totalOther = [...total.values()].reduce((a, t) => a + [...t.other.values()].reduce((x, y) => x + y, 0), 0);
console.log('');
console.log(`Totaal: ${totalN} bewerkingen, ${totalOk} gelukt, ${totalN - totalOk - totalOther} merge-needs-phase2, ${totalOther} anders; `
  + `${tally.size} bestanden met een vreemd deel; geweigerd bij openen: ${refusedAtOpen.join(', ') || '–'}.`);

if (others.length > 0) {
  console.log(`XX  ifc-foreign-merge-telling: ${others.length} bewerking(en) met een andere uitkomst dan gelukt of merge-needs-phase2`);
  for (const o of others.slice(0, 40)) console.log(`   - ${o}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-merge-telling: ${merges} merges over ${tally.size} bestanden, elk gelukt of getypeerd geweigerd (${seconds} s)`);
process.exit(0);
