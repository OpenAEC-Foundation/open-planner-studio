// #804, opslag van een groot gebouwmodel, ingreep 1 (knownbug 1936): na een geslaagde E2/E3 telt de uitvoercontrole alleen
// wat tussen bron en uitvoer kan verschillen (`differenceCounts` in `mergeValidation.ts`). Bewaakt:
//   1. de stelling waar dat op leunt: voor een stuk zonder `/*` in zijn bytes ziet de scanner dezelfde verwijzingen als de
//      tekstregel (`argTokens`, dan `refsOutsideText`), en een stuk met `/*` telt als geraakt (`danglingMayChange`).
//      a. vaste gevallen: commentaar, `''`, `#` in een string, ids boven 2^31 − 1, voorloopnullen, niet-ASCII, ongeldige
//         UTF-8, een verwijzing direct na een haakje of komma, een regel over meerdere fysieke regels, en de twee vormen
//         waarin commentaar tegen een verwijzing aan staat (`#/*c*/2`, `#1/*c*/2`; knownbug 1951);
//      b. willekeurige regels uit stukjes, met een vast zaadje;
//   2. de verschiltoets: op gemuteerde uitvoer van elk corpusbestand (`tests/fixtures/ifc-foreign`, ook `council/`, en
//      `tests/planning/fixtures/oude-tags`) geeft `validateMergeOutput` dezelfde meldingen in dezelfde volgorde als met de
//      volledige telling. Liep de telling op het verschil, dan geeft die voor elke sleutel die tussen bron en uitvoer
//      verschilt dezelfde tellingen als de volledige, en de GlobalIds in dezelfde volgorde. Per soort melding: hoe vaak via
//      de nieuwe weg, met een ondergrens;
//   3. de echte opslagroute: commentaar tegen een verwijzing in een modelstuk naar een taak, de taak gewist: de opslag
//      weigert met dezelfde melding als met de volledige telling.
// Exit 0 = alles groen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, type Classification } from '@/services/ifc/foreign/classify';
import { refsOutsideText } from '@/services/ifc/foreign/lossCheck';
import {
  danglingMayChange, differenceCounts, structuralCounts, validateMergeOutput, type StructuralCounts,
} from '@/services/ifc/foreign/mergeValidation';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { scanStep, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { cloneDomain, openForeign, settle, tryMerge } from './ifcMergeKern';
import { storeEdit } from './ifcAppRoute';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const started = performance.now();
const seconds = (from: number) => `${((performance.now() - from) / 1000).toFixed(1)} s`;
let checks = 0;
const diffs: string[] = [];
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 400)} ≠ ${w?.slice(0, 400)}`);
};
const enc = new TextEncoder(), dec = new TextDecoder();
/** Byte ↔ teken één op één, voor ongeldige UTF-8 in een proef. */
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const concat = (parts: readonly Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
/** Een vaste toevalsreeks (mulberry32): ook de lage bits wisselen niet in een vast ritme. */
let seed = 1951;
const rnd = (n: number) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) % n;
};
const pick = <T>(xs: readonly T[]): T => xs[rnd(xs.length)];

/** Staat er `/*` in de bytes van de entiteit (van haar `#` tot en met de `;`)? */
const hasCommentOpen = (index: StepIndex, bytes: Uint8Array, i: number) => {
  for (let p = index.entityStart(i); p + 1 < index.end(i); p++) if (bytes[p] === 0x2f && bytes[p + 1] === 0x2a) return true;
  return false;
};
/** De doelen van de verwijzingen van stuk `i` volgens de scanner en volgens de tekstregel, in volgorde (-1 = niets). */
const scannerTargets = (index: StepIndex, i: number) => {
  const out: number[] = [];
  for (let k = index.outStart(i); k < index.outEnd(i); k++) out.push(index.outTarget(k));
  return out;
};
const textTargets = (index: StepIndex, i: number) =>
  (index.argTokens(i) ?? []).flatMap(a => refsOutsideText(a)).map(id => index.chunkOf(String(id)));
const named = (index: StepIndex, targets: number[]) => targets.map(t => (t < 0 ? '-1' : `#${index.id(t)}`)).join(' ');
const stepFile = (body: string) => `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nENDSEC;\nDATA;\n${body}ENDSEC;\nEND-ISO-10303-21;\n`;

// ── 1a. De stelling, vaste gevallen ──

{
  /** Argumenten van entiteit #9, en wat de scanner moet zien (bij een regel zonder `/*` ook de tekstregel). */
  const cases: [string, string, string][] = [
    ['gewoon', "'a',#1,(#2,#3),$", '#1 #2 #3'],
    ["'' in een string", "'it''s #2',#1", '#1'],
    ['# in een string', "'#2',#1", '#1'],
    ['id boven 2^31 − 1', '#2147483648,#99999999999999999999,#1', '-1 -1 #1'],
    ['precies 2^31 − 1 (bestaat niet)', '#2147483647,#1', '-1 #1'],
    ['voorloopnullen', '#007,#0000000000000000001,#01', '#7 #1 #1'],
    ['niet-ASCII in een string', "'é ü 漢 #2',#1", '#1'],
    ['ongeldige UTF-8 in een string', "'\u0080\u00ff#2\u00c3',#1", '#1'],
    ['direct na haakje en komma', '(#1,#2),#3', '#1 #2 #3'],
    ['over meerdere fysieke regels', "'a\n#2',\n#1,\r\n#3", '#1 #3'],
    ['commentaar met een spatie ertussen', "'a',/* #2 */ #1,$", '#1'],
    ['commentaar direct na #', '#/*c*/2,#1', '#1'],
    ['commentaar tussen de cijfers', '#1/*c*/2,#3', '#1 #3'],
    ['commentaar tussen twee strings', "'abc'/*c*/'#2',#1", '#1'],
  ];
  // Elke regel in UTF-8, behalve die met ongeldige UTF-8: daar is elk teken één byte.
  const [head, tail] = stepFile('@').split('@');
  const raw = concat([enc.encode(`${head}#1=IFCX($);\n#2=IFCX($);\n#3=IFCX($);\n#7=IFCX($);\n#12=IFCX($);\n`),
    ...cases.map(([label, args], k) => (label.startsWith('ongeldige') ? latin1 : (t: string) => enc.encode(t))(`#${100 + k}=IFCX(${args});\n`)),
    enc.encode(tail)]);
  const index = scanStep(raw);
  const mayChange = danglingMayChange(index, new Uint8Array(index.count), raw);
  for (const [k, [label, , want]] of cases.entries()) {
    const i = index.chunkOf(String(100 + k));
    const scanner = named(index, scannerTargets(index, i)), text = named(index, textTargets(index, i));
    eq(`1a ${label}: de scanner`, scanner, want);
    if (hasCommentOpen(index, raw, i)) {
      ok(`1a ${label}: met /* telt het stuk als geraakt`, mayChange(i));
      console.log(`  1a ${label}: met /*, scanner [${scanner}], tekstregel [${text}], geraakt`);
    } else eq(`1a ${label}: de tekstregel ziet hetzelfde als de scanner`, text, scanner);
  }
}

// ── 1b. De stelling, willekeurige regels ──

let withoutComment = 0, withComment = 0, joinedDiffer = 0;
{
  const TARGETS = 40;
  const ws = () => pick(['', '', ' ', '  ', '\n', '\r\n', '\t']);
  const commentChar = () => pick(['#12', '#', "'", "''", '(', ')', ',', ';', '\n', '*', '/', 'x', ' ', 'é']);
  const comment = () => {
    let c = '';
    do c = Array.from({ length: rnd(4) }, commentChar).join(''); while (c.includes('*/'));
    return `/*${c}*/`;
  };
  /** Per regel: met of zonder commentaar en `/*` in strings, zodat beide groepen groot zijn. */
  let comments = false;
  const gap = () => (comments && rnd(4) === 0 ? ws() + comment() + ws() : ws());
  const digits = () => pick([
    () => String(1 + rnd(TARGETS)),
    () => '0'.repeat(1 + rnd(3)) + String(1 + rnd(TARGETS)),
    () => pick(['2147483647', '2147483648', '4294967296', '99999999999', '9'.repeat(25), '0000000000000000000012']),
    () => String(TARGETS + 1 + rnd(50)),
  ])();
  const ref = () => {
    const d = digits();
    if (!comments || rnd(8) !== 0) return `#${d}`;
    const at = rnd(d.length); // commentaar tegen de verwijzing aan: direct na `#` of tussen de cijfers
    return `#${d.slice(0, at)}${comment()}${d.slice(at)}`;
  };
  // Zonder commentaar ook geen `/*` in een string: `/` en `*/` dan alleen met een teken erachter, zodat geen twee stukjes
  // samen `/*` vormen.
  const stringChar = () => pick(["''", '#12', '#', 'é', '漢', '\n', '\r\n', ',', '(', ')', '$', 'a', ' ', '*', ';',
    ...(comments ? ['/*', '*/', '/'] : ['/x', '*/x'])]);
  const string = () => `'${Array.from({ length: rnd(5) }, stringChar).join('')}'`;
  const value = (depth: number): string => {
    const r = rnd(14);
    if (r < 4) return ref();
    if (r < 6) return string();
    if (r < 7) return '$';
    if (r < 8) return pick(['1.5', '.T.', '*', '-3', '0.', '1.E-5']);
    if (r < 9 && comments) return string() + comment() + string(); // twee strings die door het weghalen van commentaar aan elkaar komen
    if (r < 10 && comments) return string() + comment() + ref();
    if (r < 11 && depth < 3) return `IFCLABEL(${gap()}${string()}${gap()})`;
    if (depth < 3) return `(${list(depth + 1)})`;
    return ref();
  };
  const list = (depth: number): string => Array.from({ length: 1 + rnd(4) }, () => gap() + value(depth) + gap()).join(',');
  const LINES = 6000;
  let body = '';
  for (let t = 1; t <= TARGETS; t++) body += `#${t}=IFCX($);\n`;
  for (let k = 0; k < LINES; k++) {
    const lead = rnd(5) === 0 ? comment() + '\n' : ''; // commentaar vóór de entiteit: hoort bij het stuk, niet bij de regel
    comments = rnd(2) === 0;
    body += `${lead}#${1000 + k}${gap()}=${gap()}IFCX${gap()}(${list(0)})${gap()};\n`;
  }
  const bytes = enc.encode(stepFile(body));
  const index = scanStep(bytes);
  const mayChange = danglingMayChange(index, new Uint8Array(index.count), bytes);
  for (let k = 0; k < LINES; k++) {
    const i = index.chunkOf(String(1000 + k));
    const scanner = named(index, scannerTargets(index, i)), text = named(index, textTargets(index, i));
    if (hasCommentOpen(index, bytes, i)) {
      withComment++;
      if (scanner !== text) joinedDiffer++;
      ok(`1b regel #${1000 + k} met /* telt als geraakt`, mayChange(i));
    } else {
      withoutComment++;
      eq(`1b regel #${1000 + k} zonder /*: scanner en tekstregel`, text, scanner);
    }
  }
  console.log(`1b: ${LINES} willekeurige regels, ${withoutComment} zonder /* (scanner = tekstregel), ${withComment} met /* `
    + `(geraakt; daarvan ${joinedDiffer} waar scanner en tekstregel verschillen)`);
  ok(`1b: genoeg regels in beide groepen (${withoutComment} / ${withComment})`, withoutComment >= 1500 && withComment >= 1500);
  ok(`1b: de verschillende vormen komen voor (${joinedDiffer})`, joinedDiffer >= 100);
}

console.log(`1: ${seconds(started)}`);
const corpusStarted = performance.now();

// ── 2. De verschiltoets op het corpus ──

/** De niet-P-stukken van bron en uitvoer in volgorde, zoals E2 ze paart. */
function pairs(source: StepIndex, cls: Classification, index: StepIndex): { preserved: number[]; actual: number[] } {
  const preserved: number[] = [], actual: number[] = [];
  for (let i = 0; i < source.count; i++) if (cls.classes[i] !== 1) preserved.push(i);
  for (let i = 0; i < index.count; i++) {
    const original = index.isEntity(i) ? source.chunkOf(index.id(i)) : -1;
    if (!index.isEntity(i) || (original >= 0 && cls.classes[original] !== 1)) actual.push(i);
  }
  return { preserved, actual };
}
/** De telling op het verschil mist geen verschil: voor elke sleutel waar de volledige telling bron en uitvoer anders telt
 *  (bij GlobalIds: vaker in de uitvoer), en voor elke sleutel die ze zelf heeft, dezelfde aantallen; de GlobalIds in de
 *  volgorde van de uitvoer; de lidmaatschappen gelijk. */
function sameDifferences(full: { before: StructuralCounts; after: StructuralCounts }, part: { before: StructuralCounts; after: StructuralCounts }): string | undefined {
  for (const kind of ['dangling', 'guids'] as const) {
    const fb = full.before[kind], fa = full.after[kind], pb = part.before[kind], pa = part.after[kind];
    const keys = new Set([...pb.keys(), ...pa.keys()]);
    for (const key of new Set([...fb.keys(), ...fa.keys()])) {
      const differs = kind === 'dangling' ? (fb.get(key) ?? 0) !== (fa.get(key) ?? 0) : (fa.get(key) ?? 0) > (fb.get(key) ?? 0);
      if (differs) keys.add(key);
    }
    for (const key of keys) {
      if ((pb.get(key) ?? 0) !== (fb.get(key) ?? 0) || (pa.get(key) ?? 0) !== (fa.get(key) ?? 0)) {
        return `${kind} ${key}: verschil ${pb.get(key) ?? 0} → ${pa.get(key) ?? 0}, volledig ${fb.get(key) ?? 0} → ${fa.get(key) ?? 0}`;
      }
    }
    if (kind === 'guids') {
      const order = [...fa.keys()].filter(key => pa.has(key));
      if (JSON.stringify(order) !== JSON.stringify([...pa.keys()])) return `volgorde van de GlobalIds: ${[...pa.keys()].slice(0, 4)} ≠ ${order.slice(0, 4)}`;
    }
  }
  if (JSON.stringify([...full.after.members]) !== JSON.stringify([...part.after.members])) return 'lidmaatschappen';
  return undefined;
}

/** De plaatsen van een `$` als heel argument (buiten strings en commentaar) in de tekst van een entiteit. */
function dollarSlots(text: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'") { i++; while (i < text.length && !(text[i] === "'" && text[i + 1] !== "'")) i += text[i] === "'" ? 2 : 1; continue; }
    if (c === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); if (end < 0) break; i = end + 1; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '$' && depth >= 1 && /[(,]\s*$/.test(text.slice(0, i)) && /^\s*[,)]/.test(text.slice(i + 1))) out.push(i);
  }
  return out;
}

const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.ifc')) files.push(p);
  }
};
walk(join(ROOT, 'tests/fixtures/ifc-foreign'));
walk(join(ROOT, 'tests/planning/fixtures/oude-tags'));

const KINDS = ['nieuwe loze verwijzing', 'nieuwe dubbele GlobalId', 'nieuw dubbel lidmaatschap'] as const;
const viaDifference = new Map<string, number>(KINDS.map(k => [k, 0]));
const mutationRuns = new Map<string, { all: number; difference: number }>();
let outputs = 0, differenceRuns = 0, fullRuns = 0, scanErrors = 0, skipped = 0;
const newGuid = (k: number) => `'0ops${String(k).padStart(18, '0')}'`;
let guidCounter = 0;

for (const file of files) {
  const original = new Uint8Array(readFileSync(file));
  const where = file.slice(ROOT.length + 1);
  let base: { index: StepIndex; cls: Classification };
  try { const index = scanForeignStep(original); base = { index, cls: classify(index) }; } catch { skipped++; continue; }
  /** Een uitvoer of een gemuteerde bron: `bytes` met stuk `i` vervangen door `replacement` (leeg = weg). */
  const withChunk = (bytes: Uint8Array, index: StepIndex, i: number, replacement: string) => {
    const r = enc.encode(replacement);
    const out = new Uint8Array(bytes.length - (index.end(i) - index.start(i)) + r.length);
    out.set(bytes.subarray(0, index.start(i)), 0);
    out.set(r, index.start(i));
    out.set(bytes.subarray(index.end(i)), index.start(i) + r.length);
    return out;
  };
  type Source = { bytes: Uint8Array; index: StepIndex; cls: Classification };
  const sourceOf = (bytes: Uint8Array): Source | undefined => {
    try { const index = scanForeignStep(bytes); return { bytes, index, cls: classify(index) }; } catch { return undefined; }
  };
  const plain: Source = { bytes: original, ...base };
  const mutations: { kind: string; source: Source; out: Uint8Array }[] = [];

  const mutate = (src: Source, rounds: number, only?: (kind: string) => boolean) => {
    const { bytes, index, cls } = src;
    const text = (i: number) => dec.decode(bytes.subarray(index.start(i), index.end(i)));
    const entity = (i: number) => dec.decode(bytes.subarray(index.entityStart(i), index.end(i)));
    const P: number[] = [], N: number[] = [];
    for (let i = 0; i < index.count; i++) if (index.isEntity(i)) (cls.classes[i] === 1 ? P : N).push(i);
    if (P.length === 0) return;
    const guidOf = (i: number) => /^\s*#\d+\s*=\s*\w+\s*\(\s*('[0-9A-Za-z_$]{22}')/.exec(entity(i))?.[1];
    const rootsN = N.filter(i => guidOf(i)), rootsP = P.filter(i => guidOf(i));
    const maxId = Math.max(...P.concat(N).map(i => Number(index.id(i))));
    const add = (kind: string, out: Uint8Array) => { if (!only || only(kind)) mutations.push({ kind, source: src, out }); };
    const rels = [...P, ...N].filter(i => ['IFCRELAGGREGATES', 'IFCRELNESTS', 'IFCRELDECLARES'].includes(index.type(i)) && index.refsAt(i, 5).length > 0);
    const dTasks = P.filter(i => index.type(i) === 'IFCTASK' && cls.selection.inD[i] === 1);
    for (let k = 0; k < rounds; k++) {
      const p = P[rnd(P.length)];
      const t = text(p);
      // Een P-stuk krijgt de GlobalId van een niet-P-stuk, of van een ander P-stuk (nieuwe dubbele GlobalId).
      if (rootsN.length && guidOf(p)) add('guid van niet-P', withChunk(bytes, index, p, t.replace(guidOf(p)!, guidOf(pick(rootsN))!)));
      if (rootsP.length > 1 && guidOf(p)) add('guid van P', withChunk(bytes, index, p, t.replace(guidOf(p)!, guidOf(pick(rootsP))!)));
      // Twee P-stukken krijgen de GlobalIds van twee niet-P-stukken, gekruist: de volgorde van de meldingen telt.
      if (rootsN.length > 1 && rootsP.length > 1) {
        const [p1, p2] = [pick(rootsP), pick(rootsP)].sort((a, b) => a - b);
        const [n1, n2] = [pick(rootsN), pick(rootsN)].sort((a, b) => a - b);
        if (p1 !== p2 && n1 !== n2) {
          // Eerst p2, dan p1: p1 staat ervóór en verschuift niet.
          const step = withChunk(bytes, index, p2, text(p2).replace(guidOf(p2)!, guidOf(n1)!));
          add('guids gekruist', withChunk(step, index, p1, text(p1).replace(guidOf(p1)!, guidOf(n2)!)));
        }
      }
      // Een verwijzing in een P-stuk naar een id dat niet bestaat.
      const open = t.indexOf('(');
      if (/#\d+/.test(t.slice(open))) add('loze verwijzing uit P', withChunk(bytes, index, p, t.slice(0, open) + t.slice(open).replace(/#\d+/, `#${maxId + 1000 + k}`)));
      // Een P-stuk weg (een niet-P-stuk dat ernaar wees, krijgt een loze verwijzing).
      add('P-stuk weg', withChunk(bytes, index, p, ''));
      // Lidmaatschappen: een nieuwe relatie op een lid dat al een relatie van dat type heeft, met dezelfde ouder (een P-stuk
      // als de bestaande relatie er een is); twee nieuwe relaties op hetzelfde lid; en twee nieuwe tussen twee taken van het
      // werkschema (P-stukken: de nieuwe weg).
      if (rels.length) {
        const r = pick(rels), member = pick(index.refsAt(r, 5)), relating = index.refAt(r, 4);
        add(`dubbel lidmaatschap (${cls.classes[r] === 1 ? 'P' : 'niet-P'})`, withChunk(bytes, index, p,
          `${t}\n#${maxId + 1}=${index.type(r)}(${newGuid(guidCounter++)},$,$,$,#${index.id(relating >= 0 ? relating : p)},(#${index.id(member)}));`));
      }
      const type = pick(['IFCRELAGGREGATES', 'IFCRELNESTS', 'IFCRELDECLARES']), m = pick([...P, ...N]);
      add('twee keer hetzelfde lid', withChunk(bytes, index, p, `${t}\n#${maxId + 1}=${type}(${newGuid(guidCounter++)},$,$,$,#${index.id(p)},(#${index.id(m)}));`
        + `\n#${maxId + 2}=${type}(${newGuid(guidCounter++)},$,$,$,#${index.id(p)},(#${index.id(m)}));`));
      if (dTasks.length > 1) {
        const parent = pick(dTasks), child = pick(dTasks.filter(x => x !== parent));
        const nest = (id: number) => `#${id}=IFCRELNESTS(${newGuid(guidCounter++)},$,$,$,#${index.id(parent)},(#${index.id(child)}));`;
        add('twee nesten tussen taken', withChunk(bytes, index, p, `${t}\n${nest(maxId + 1)}\n${nest(maxId + 2)}`));
      }
      // Dezelfde P-regel twee keer met een nieuw id (dubbele GlobalId binnen P).
      add('P-regel dubbel', withChunk(bytes, index, p, `${t}\n${t.trim().replace(/^#\d+/, `#${maxId + 3 + k}`)}`));
      // Willekeurig een cijfer na een # in een willekeurig stuk (ook niet-P: dan de volledige telling).
      const any = pick([...P, ...N]), s = text(any), at = [...s.matchAll(/#(\d+)/g)];
      if (at.length) {
        const hit = pick(at);
        add('cijfer na #', withChunk(bytes, index, any, s.slice(0, hit.index! + 1) + String(Number(hit[1]) + 1 + rnd(5)) + s.slice(hit.index! + hit[0].length)));
      }
    }
  };
  mutate(plain, 6);

  // Gemuteerde bronnen. Een niet-P-stuk met een `$`-slot, en een P-stuk.
  const { index, cls } = base;
  const N = [] as number[], P = [] as number[];
  for (let i = 0; i < index.count; i++) if (index.isEntity(i)) (cls.classes[i] === 1 ? P : N).push(i);
  const entityText = (src: Source, i: number) => dec.decode(src.bytes.subarray(src.index.entityStart(i), src.index.end(i)));
  const withSlots = N.filter(i => index.type(i) !== '(COMPLEX)' && dollarSlots(entityText(plain, i)).length > 0);
  if (P.length && withSlots.length) {
    for (let k = 0; k < 4; k++) {
      const n = pick(withSlots), slots = dollarSlots(entityText(plain, n)), slot = pick(slots);
      const lead = dec.decode(original.subarray(index.start(n), index.entityStart(n))).length;
      const nText = dec.decode(original.subarray(index.start(n), index.end(n)));
      const at = lead + slot;
      const setSlot = (value: string) => withChunk(original, index, n, nText.slice(0, at) + value + nText.slice(at + 1));
      const p = pick(P), pid = index.id(p);
      // Commentaar tegen een verwijzing naar een P-stuk (knownbug 1951), in beide vormen; de uitvoer zonder dat P-stuk,
      // en een uitvoer die het P-stuk houdt.
      for (const [form, value] of [['commentaar na #', `#/*c*/${pid}`], ['commentaar tussen de cijfers', `#${pid.slice(0, 1)}/*c*/${pid.slice(1)}`]] as const) {
        if (form === 'commentaar tussen de cijfers' && pid.length < 2) continue;
        const src = sourceOf(setSlot(value));
        if (!src) continue;
        const target = src.index.chunkOf(pid);
        mutations.push({ kind: `${form}, P-stuk weg`, source: src, out: withChunk(src.bytes, src.index, target, '') });
        mutate(src, 1, kind => kind === 'P-regel dubbel' || kind === 'guid van niet-P');
      }
      // Een loze verwijzing in een niet-P-stuk waarvan het doel in de uitvoer erbij komt (de telling ziet hem verdwijnen).
      const maxId = Math.max(...[...P, ...N].map(i => Number(index.id(i))));
      const fresh = String(maxId + 777 + k);
      const src = sourceOf(setSlot(`#${fresh}`));
      if (src) {
        const q = src.index.chunkOf(pid), qText = dec.decode(src.bytes.subarray(src.index.start(q), src.index.end(q)));
        mutations.push({ kind: 'loze verwijzing opgelost', source: src,
          out: withChunk(src.bytes, src.index, q, `${qText}\n${qText.trim().replace(/^#\d+/, `#${fresh}`)}`) });
      }
    }
  }
  // Twee strings die door het weghalen van commentaar tegen elkaar komen, in een bewaard stuk (bron) en in een P-stuk
  // (uitvoer): de GlobalId van een niet-P-stuk gesplitst, en een P-stuk met die GlobalId heel, gesplitst of twee keer.
  const roots = N.filter(i => /^\s*#\d+\s*=\s*\w+\s*\(\s*'[0-9A-Za-z_$]{22}'/.test(entityText(plain, i)));
  const rootsP = P.filter(i => /^\s*#\d+\s*=\s*\w+\s*\(\s*'[0-9A-Za-z_$]{22}'/.test(entityText(plain, i)));
  if (roots.length && rootsP.length > 1) {
    for (let k = 0; k < 2; k++) {
      const n = pick(roots), nText = dec.decode(original.subarray(index.start(n), index.end(n)));
      const guid = /'([0-9A-Za-z_$]{22})'/.exec(nText)![1];
      const split = `'${guid.slice(0, 11)}'/*c*/'${guid.slice(11)}'`;
      const src = sourceOf(withChunk(original, index, n, nText.replace(`'${guid}'`, split)));
      if (!src) continue;
      const [p1, p2] = [pick(rootsP), pick(rootsP)].sort((a, b) => a - b);
      const pText = (i: number) => dec.decode(src.bytes.subarray(src.index.start(i), src.index.end(i)));
      const pGuid = (i: number) => /'[0-9A-Za-z_$]{22}'/.exec(pText(i))![0];
      const whole = (i: number, bytes: Uint8Array, idx: StepIndex) => withChunk(bytes, idx, i, pText(i).replace(pGuid(i), `'${guid}'`));
      mutations.push({ kind: 'strings door commentaar: GlobalId heel in P', source: src, out: whole(p1, src.bytes, src.index) });
      mutations.push({ kind: 'strings door commentaar: GlobalId gesplitst in P', source: src,
        out: withChunk(src.bytes, src.index, p1, pText(p1).replace(pGuid(p1), split)) });
      if (p1 !== p2) {
        const once = whole(p2, src.bytes, src.index); // p2 eerst: p1 staat ervóór en verschuift niet
        mutations.push({ kind: 'strings door commentaar: GlobalId twee keer in P', source: src, out: withChunk(once, src.index, p1, pText(p1).replace(pGuid(p1), `'${guid}'`)) });
      }
    }
  }

  for (const { kind, source, out } of mutations) {
    outputs++;
    const runs = mutationRuns.get(kind) ?? { all: 0, difference: 0 };
    mutationRuns.set(kind, runs);
    runs.all++;
    let full: ReturnType<typeof validateMergeOutput> | string, diff: ReturnType<typeof validateMergeOutput> | string;
    try { full = validateMergeOutput(source.index, source.cls, source.bytes, out, { full: true }); } catch (e) { full = `fout: ${String(e)}`; }
    try { diff = validateMergeOutput(source.index, source.cls, source.bytes, out); } catch (e) { diff = `fout: ${String(e)}`; }
    if (typeof full === 'string' || typeof diff === 'string') {
      scanErrors++;
      eq(`2 ${where} ${kind}: dezelfde fout`, diff, full);
      continue;
    }
    eq(`2 ${where} ${kind}: dezelfde meldingen in dezelfde volgorde`, diff.problems, full.problems);
    if (diff.counting === 'volledig') { fullRuns++; continue; }
    differenceRuns++;
    runs.difference++;
    for (const k of KINDS) if (full.problems.some(m => m.startsWith(k))) viaDifference.set(k, viaDifference.get(k)! + 1);
    const { preserved, actual } = pairs(source.index, source.cls, diff.index);
    const problem = sameDifferences({ before: structuralCounts(source.index), after: structuralCounts(diff.index) },
      differenceCounts(source.index, source.cls, source.bytes, diff.index, out, preserved, actual));
    ok(`2 ${where} ${kind}: de telling op het verschil mist geen verschil${problem ? ` (${problem})` : ''}`, problem === undefined);
  }
}
console.log(`2: ${files.length} bestanden (${skipped} overgeslagen), ${outputs} uitvoeren, ${differenceRuns} via de telling op het verschil, `
  + `${fullRuns} volledig, ${scanErrors} met een scanfout`);
for (const [kind, n] of [...mutationRuns].sort()) console.log(`  ${kind}: ${n.all}, waarvan ${n.difference} via het verschil`);
for (const k of KINDS) console.log(`  via het verschil met de melding "${k}": ${viaDifference.get(k)}`);
/** Ondergrenzen van de dekking: rood als een soort melding (bijna) niet meer via de nieuwe weg loopt. */
const FLOORS: Record<(typeof KINDS)[number], number> = { 'nieuwe loze verwijzing': 300, 'nieuwe dubbele GlobalId': 300, 'nieuw dubbel lidmaatschap': 300 };
for (const k of KINDS) ok(`2: dekking "${k}" via het verschil ${viaDifference.get(k)} ≥ ${FLOORS[k]}`, viaDifference.get(k)! >= FLOORS[k]);
for (const kind of ['commentaar na #, P-stuk weg', 'commentaar tussen de cijfers, P-stuk weg', 'loze verwijzing opgelost',
  'strings door commentaar: GlobalId heel in P', 'strings door commentaar: GlobalId twee keer in P']) {
  const n = mutationRuns.get(kind)?.difference ?? 0;
  ok(`2: "${kind}" liep via het verschil (${n} ≥ 20)`, n >= 20);
}

// ── 3. De echte opslagroute ──

const routeStarted = performance.now();
console.log(`2: ${seconds(corpusStarted)}`);
{
  const wall = "#354=IFCWALL('242F3AJ$ylGv3IUzUFH5GZ',#331,'Wand B',$,$,#336,#353,$,$);";
  const settled = dec.decode(await settle(new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))));
  ok('3: de wand staat in de bron', settled.includes(wall));
  for (const tag of ['$', '#/*c*/53', '#5/*c*/3']) {
    const bytes = enc.encode(settled.replace(wall, wall.replace(/,\$,\$\);$/, `,${tag},$);`)));
    const opened = await openForeign(bytes);
    const task = opened.tasks.find(t => t.name === 'Demolish existing extension');
    ok(`3 Tag ${tag}: de taak #53 staat in de planning`, task !== undefined && opened.ifcSource?.stepIds[`task:${task.id}`] === 53);
    if (!task) continue;
    const r = await tryMerge(await storeEdit(cloneDomain(opened), s => s.deleteTask(task.id)), opened.ifcSource!);
    if (tag === '$') {
      ok('3 Tag $: de taak wissen schrijft', r.ok && scanStep(r.bytes).chunkOf('53') < 0);
      continue;
    }
    eq(`3 Tag ${tag}: de taak wissen weigert met de melding van de volledige telling`,
      r.ok ? 'schrijft' : r.error.cases.map(c => `${c.kind}: ${c.detail}`), ['uitvoer-controle: nieuwe loze verwijzing 354|7|53']);
  }
}

console.log(`3: ${seconds(routeStarted)}; samen ${seconds(started)}`);
if (diffs.length) {
  // Per deel (1a, 1b, 2, 3) de eerste regels en het aantal.
  const parts = new Map<string, string[]>();
  for (const d of diffs) { const part = d.slice(0, d.indexOf(' ')); parts.set(part, [...(parts.get(part) ?? []), d]); }
  for (const [part, list] of parts) {
    for (const d of list.slice(0, 8)) console.log(`XX ${d}`);
    console.log(`XX deel ${part}: ${list.length} rood`);
  }
  console.log(`XX telling op het verschil: ${diffs.length} van ${checks} checks rood`);
  process.exitCode = 1;
} else console.log(`telling op het verschil: ${checks} checks groen`);
