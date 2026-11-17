// #804 fase 1c, PR 12a en 12b: de gedeelde proefkern van de checks voor de eigen groepen op projectniveau
// (`check-ifc-foreign-eigen-uitvoer.ts`, controle (c); `check-ifc-foreign-eigen-toets.ts`, de andere toets).
//
// Een klok die vast staat of loopt, een plannerhandeling in een verse store, opslaan via `prepareIfcWrite`, de bronnen van
// het onderzoek (de eigen bron, het kantoorvoorbeeld met een wand, de oude eigen bron) en een vreemd lid in een eigen pset.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { generateId } from '@/utils/id';
import { storeWith } from './ifcAppRoute';
import { concat, type Domain } from './ifcMergeKern';
import { installDeterminism } from './ifcPariteitKern';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const read = (rel: string) => new Uint8Array(readFileSync(join(root, rel)));
export const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
export const latin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
export const bytesOf = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

// ── Klok: vast, of lopend (elke "nu" een seconde later, ook binnen één opslag) ──
const RealDate = Date;
const reseed = installDeterminism();
export const BASE = RealDate.UTC(2026, 10, 14, 11, 11, 48);
let mode: 'vast' | 'lopend' = 'vast', now = BASE;
class Clock extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length) super(...(args as [number])); else { if (mode === 'lopend') now += 1000; super(now); }
  }
  static now() { if (mode === 'lopend') now += 1000; return now; }
}
globalThis.Date = Clock as unknown as DateConstructor;
export const clock = {
  get mode() { return mode; },
  set mode(m: 'vast' | 'lopend') { mode = m; },
  /** De klok terug op de vaste begintijd en de willekeur op een vaste stand. */
  start() { now = BASE; reseed(0x804); },
};

/**
 * De teller van `generateId` (een moduleteller, ook in de lezer en de store) op een vaste stand `target`. Zonder deze stap
 * hangt een id die een geval maakt (een nieuwe baseline, een code) af van hoeveel gevallen er vóór hem schreven; dan geven
 * de basis en een versie die meer laat schrijven voor een later geval andere invoer. Gooit als de teller al voorbij is.
 */
export function idsAt(target: number) {
  const random = Math.random;
  Math.random = () => 0.5; // `generateId` neemt `(0.5).toString(36).substring(2, 6)` = 'i'
  try {
    for (;;) {
      // `${tijd}${'i'}${teller}`: de teller is het getal achter de laatste 'i'.
      const counter = Number(/i(\d+)$/.exec(generateId())![1]);
      if (counter > target) throw new Error(`idsAt: de teller staat al op ${counter}, voorbij ${target}`);
      if (counter === target) return;
    }
  } finally { Math.random = random; }
}

let passed = 0, failed = 0;
export function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`OK ${name}`); } else { failed++; console.error(`XX ${name}${detail ? `: ${detail}` : ''}`); }
}
export function finish() {
  console.log(`\n${passed} OK, ${failed} XX`);
  if (failed > 0) process.exit(1);
}

export type S = any;
/** Eén plannerhandeling in een verse store; de proxy leest na elke handeling de actuele stand. */
export const se = (f: (s: S) => void) => async (d: Domain): Promise<Domain> => {
  const { store, buildWriteIFCInput } = await storeWith(d);
  f(new Proxy({} as S, { get: (_, k) => (store.getState() as unknown as Record<string | symbol, unknown>)[k] }));
  return structuredClone(buildWriteIFCInput(store.getState(), 'merge')) as Domain;
};
export const leaves = (s: S) => s.tasks.filter((t: any) => !t.isMilestone && !t.childIds.length);
/** Een taak onder de eerste gewone taak; zonder taken (na "alles wissen") de eerste taak van het project. */
export const addTask = (s: S, name: string) => {
  const anchor = leaves(s)[0];
  const id = s.addTask(anchor ? { name, position: { anchorId: anchor.id, where: 'below' } } : { name }, { phaseAssignments: 'move', answered: true });
  if (!id) throw new Error('taak toevoegen mislukt'); return id;
};
export const deleteAll = (s: S) => {
  for (const b of [...s.baselines]) s.deleteBaseline(b.id);
  for (const c of [...s.activityCodeTypes]) s.removeActivityCodeType(c.id);
  for (const t of [...s.tasks].filter((t: any) => !t.parentId)) if (s.tasks.some((x: any) => x.id === t.id)) s.deleteTask(t.id);
};

export type Outcome = { ok: true; bytes: Uint8Array; next: IfcSource } | { ok: false; kinds: string[]; detail: string };
/** Opslaan zoals de app: `prepareIfcWrite`, met de klok op de begintijd. */
export async function save(d: Domain, source: IfcSource): Promise<Outcome> {
  clock.start();
  try {
    const prepared = await prepareIfcWrite(d, source);
    return { ok: true, bytes: concat(prepared.parts), next: prepared.source };
  } catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    return { ok: false, kinds: [...new Set(e.cases.map(c => c.kind))].sort(), detail: e.cases[0]?.detail.slice(0, 300) ?? '' };
  }
}
export const summary = (o: Outcome) => o.ok ? `geschreven ${o.bytes.length} ${sha(o.bytes)}` : `geweigerd ${o.kinds.join(',')}`;

export const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
export const withLines = (src: string, lines: readonly string[]) => { const at = src.lastIndexOf('ENDSEC;'); return `${src.slice(0, at)}${lines.map(l => `${l}\n`).join('')}${src.slice(at)}`; };
export const withWall = (b: Uint8Array) => bytesOf(withLines(latin1(b), REVIT_WALL));
export const SOURCES: Record<'eigen' | 'kantoor' | 'oud', Uint8Array> = {
  eigen: read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'),
  kantoor: withWall(read('public/examples/03-kantoorgebouw-zuidas.ifc')),
  oud: read('tests/fixtures/ifc-foreign/oud-eigen-0.1-plus-model.ifc'),
};

/** Een vreemde property in de ledenlijst van de eerste pset met deze naam; de rest byte voor byte gelijk. */
export function withForeignMember(bytes: Uint8Array, pset: string): Uint8Array {
  let t = latin1(bytes);
  const re = new RegExp(`^(#\\d+=IFCPROPERTYSET\\('[^']*',#\\d+,'${pset}',\\$,\\()([^)]*)(\\)\\);)`, 'm');
  assert(re.test(t), `pset ${pset} niet gevonden`);
  t = t.replace(re, (_, a, m, z) => `${a}${m},#95000${z}`);
  const at = t.lastIndexOf('ENDSEC;');
  return bytesOf(`${t.slice(0, at)}#95000=IFCPROPERTYSINGLEVALUE('VendorNote',$,IFCTEXT('van een ander programma'),$);\n${t.slice(at)}`);
}
/** Staat het vreemde lid van `withForeignMember` nog in een pset met deze naam? */
export const foreignMemberKept = (text: string, pset: string) => text.includes("#95000=IFCPROPERTYSINGLEVALUE('VendorNote'")
  && new RegExp(`=IFCPROPERTYSET\\('[^']*',#\\d+,'${pset}',\\$,\\([^)]*#95000[,)]`).test(text);
