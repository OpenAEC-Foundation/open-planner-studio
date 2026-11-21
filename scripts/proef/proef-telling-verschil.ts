// METING — meet-branch #804, opslag-geheugen deel 2, proef 'telling' (wegwerp, niet voor main).
// Verschiltoets: `validateMergeOutput` met de volledige telling en met de telling op het verschil moet op elke uitvoer
// dezelfde meldingen in dezelfde volgorde geven. De uitvoer is de bron met gemuteerde P-stukken (de niet-P-stukken blijven
// byte-gelijk, dus de proef neemt de nieuwe weg), plus willekeurige mutaties die ook niet-P-stukken raken (terugval).
//   esbuild scripts/proef/proef-telling-verschil.ts --bundle --platform=node --format=esm --alias:@=src … --outfile=/tmp/x.mjs
//   node /tmp/x.mjs tests/fixtures/ifc-foreign [meer mappen]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { classify } from '@/services/ifc/foreign/classify';
import { validateMergeOutput } from '@/services/ifc/foreign/mergeValidation';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';

let differenceRuns = 0;
const hook = { proef: {} as Record<string, boolean>, grens() {}, data(label: string) { if (label === 'proef telling') differenceRuns++; } };
(globalThis as { __opsMeting?: unknown }).__opsMeting = hook;

let seed = 4242;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const files: string[] = [];
const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.ifc')) files.push(p); } };
for (const d of process.argv.slice(2)) walk(d);

const enc = new TextEncoder(), dec = new TextDecoder();
let cases = 0, withProblems = 0, failures = 0, skipped = 0;
const kinds = new Map<string, number>();
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(file));
  let index, cls;
  try { index = scanForeignStep(bytes); cls = classify(index); } catch { skipped++; continue; }
  const text = (i: number) => dec.decode(bytes.subarray(index.start(i), index.end(i)));
  const P: number[] = [], N: number[] = [];
  for (let i = 0; i < index.count; i++) if (index.isEntity(i)) (cls.classes[i] === 1 ? P : N).push(i);
  if (P.length === 0) { skipped++; continue; }
  const guidOf = (i: number) => /^\s*#\d+\s*=\s*\w+\s*\(\s*('[0-9A-Za-z_$]{22}')/.exec(text(i))?.[1];
  const rootsN = N.filter(i => guidOf(i)), rootsP = P.filter(i => guidOf(i));
  const maxId = Math.max(...P.concat(N).map(i => Number(index.id(i))));
  /** Uitvoer: de bron met stuk `i` vervangen door `replacement` (ook leeg = weg). */
  const withChunk = (i: number, replacement: string) => {
    const out = new Uint8Array(bytes.length - (index.end(i) - index.start(i)) + enc.encode(replacement).length);
    out.set(bytes.subarray(0, index.start(i)), 0);
    const r = enc.encode(replacement);
    out.set(r, index.start(i));
    out.set(bytes.subarray(index.end(i)), index.start(i) + r.length);
    return out;
  };
  const mutations: [string, Uint8Array][] = [];
  for (let k = 0; k < 6; k++) {
    const p = P[rnd(P.length)];
    const t = text(p);
    // m1: een P-stuk krijgt de GlobalId van een niet-P-stuk (nieuwe dubbele GlobalId).
    if (rootsN.length && guidOf(p)) mutations.push(['guid van niet-P', withChunk(p, t.replace(guidOf(p)!, guidOf(rootsN[rnd(rootsN.length)])!))]);
    // m1b: van een ander P-stuk.
    if (rootsP.length > 1 && guidOf(p)) mutations.push(['guid van P', withChunk(p, t.replace(guidOf(p)!, guidOf(rootsP[rnd(rootsP.length)])!))]);
    // m2: een verwijzing in een P-stuk naar een id dat niet bestaat.
    if (/#\d+/.test(t.slice(t.indexOf('(')))) mutations.push(['loze verwijzing uit P', withChunk(p, t.slice(0, t.indexOf('(')) + t.slice(t.indexOf('(')).replace(/#\d+/, `#${maxId + 1000 + k}`))]);
    // m3: een P-stuk weg (een niet-P-stuk dat ernaar wees, krijgt een loze verwijzing).
    mutations.push(['P-stuk weg', withChunk(p, '')]);
    // m4: een P-stuk erbij met een lidmaatschap dat een niet-P-relatie al heeft, of een nieuwe relatie op een bestaand lid.
    const rels = N.filter(i => /IFCREL(AGGREGATES|NESTS|DECLARES)\s*\(/.test(text(i)));
    if (rels.length) {
      const r = rels[rnd(rels.length)];
      const m = /\(\s*(#\d+)[^()]*\)\s*\)\s*;\s*$/.exec(text(r)) ?? /,\s*\(\s*(#\d+)/.exec(text(r));
      const type = /IFCREL(AGGREGATES|NESTS|DECLARES)/.exec(text(r))![0];
      if (m) mutations.push(['dubbel lidmaatschap', withChunk(p, `${t}\n#${maxId + 1}=${type}('0aaaaaaaaaaaaaaaaaaaa${k}',$,$,$,#${index.id(p)},(${m[1]}));`)]);
    }
    // m5: dezelfde P-regel twee keer met een nieuw id (dubbele GlobalId binnen P).
    mutations.push(['P-regel dubbel', withChunk(p, `${t}\n${t.trim().replace(/^#\d+/, `#${maxId + 2 + k}`)}`)]);
    // m6: willekeurig een cijfer na een # in een willekeurig stuk (ook niet-P: dan de terugval).
    const any = [...P, ...N][rnd(P.length + N.length)];
    const at = [...text(any).matchAll(/#(\d+)/g)];
    if (at.length) {
      const hit = at[rnd(at.length)];
      const s = text(any);
      mutations.push(['cijfer na #', withChunk(any, s.slice(0, hit.index! + 1) + String(Number(hit[1]) + 1 + rnd(5)) + s.slice(hit.index! + hit[0].length))]);
    }
  }
  for (const [kind, out] of mutations) {
    cases++;
    let full: string[] | string, diff: string[] | string;
    hook.proef = {};
    try { full = validateMergeOutput(index, cls, bytes, out).problems; } catch (e) { full = `fout: ${String(e).slice(0, 80)}`; }
    hook.proef = { telling: true };
    try { diff = validateMergeOutput(index, cls, bytes, out).problems; } catch (e) { diff = `fout: ${String(e).slice(0, 80)}`; }
    if (Array.isArray(full) && full.length) withProblems++;
    const key = `${kind}: ${Array.isArray(full) ? (full.length ? full[0].replace(/ [\d'#(].*$/, '') : 'geen melding') : 'scanfout'}`;
    kinds.set(key, (kinds.get(key) ?? 0) + 1);
    if (JSON.stringify(full) !== JSON.stringify(diff)) {
      failures++;
      console.log(`XX ${file} ${kind}\n   volledig: ${JSON.stringify(full).slice(0, 300)}\n   verschil: ${JSON.stringify(diff).slice(0, 300)}`);
    }
  }
}
console.log(`${files.length} bestanden (${skipped} overgeslagen), ${cases} uitvoeren, ${withProblems} met meldingen, telling op het verschil ${differenceRuns} keer gebruikt, verschillen: ${failures}`);
for (const [k, v] of [...kinds].sort()) console.log(`  ${v}× ${k}`);
process.exitCode = failures ? 1 : 0;
