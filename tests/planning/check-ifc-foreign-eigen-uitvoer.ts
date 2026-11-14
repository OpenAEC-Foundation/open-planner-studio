// #804 fase 1c, PR 12a: controle (c) op de echte uitvoer. De eigen groepen op projectniveau lezen terug tot wat de writer
// ervan maakt (`ownGroups.ts`, `ownOutputProblem` in `mergeWriter.ts`). De controle kan alleen extra weigeren.
//
// 1. Geen nieuwe weigering: de gevallen van 7c en 7d, de reeksen, de sessieketen en een vreemd lid in een eigen pset
//    lopen door de echte open-route (bytes, flag aan) en `prepareIfcWrite`; geen enkel geval weigert met `eigen-uitvoer`.
//    Elke uitkomst staat als `UITKOMST`-regel in het log (lengte en sha256), zodat een run op de basis ernaast kan.
// 2. Tegenproeven: een fout in de echte uitvoer van een geslaagde opslag, door de volledige uitvoercontrole
//    (`checkMergeOutput`): zonder (c), zoals de basis, en met (c).
// 3. Niets veranderd: de bronbytes komen terug, zonder (c).
// 4. De klok: de gevallen van 1 ook met een lopende klok (elke "nu" een seconde later).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { checkMergeOutput, MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { parseOutLine, type OutLine } from '@/services/ifc/foreign/lossCheck';
import { BASELINE_HEADS, linesView, ownGroupMembers } from '@/services/ifc/foreign/ownGroups';
import { PSET, ifcJson, ifcStr } from '@/services/ifc/ifcPsets';
import { decodeStepText } from '@/services/ifc/stepText';
import { storeWith } from './ifcAppRoute';
import {
  applyEdit, cloneDomain, concat, fixedCatalogEdits, fixedSequenceEdits, mergeProblems, openForeign, sameBytes,
  savedCatalogStart, savedSequenceStart, type Domain,
} from './ifcMergeKern';
import { installDeterminism } from './ifcPariteitKern';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => new Uint8Array(readFileSync(join(root, rel)));
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const latin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const bytesOf = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

// ── Klok: vast, of lopend (elke "nu" een seconde later, ook binnen één opslag) ──
const RealDate = Date;
const reseed = installDeterminism();
const BASE = RealDate.UTC(2026, 10, 14, 11, 11, 48);
let clockMode: 'vast' | 'lopend' = 'vast', now = BASE;
class Clock extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length) super(...(args as [number])); else { if (clockMode === 'lopend') now += 1000; super(now); }
  }
  static now() { if (clockMode === 'lopend') now += 1000; return now; }
}
globalThis.Date = Clock as unknown as DateConstructor;
const clockStart = () => { now = BASE; reseed(0x804); };

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`OK ${name}`); } else { failed++; console.error(`XX ${name}${detail ? `: ${detail}` : ''}`); }
}

type S = any;
/** Eén plannerhandeling in een verse store; de proxy leest na elke handeling de actuele stand. */
const se = (f: (s: S) => void) => async (d: Domain): Promise<Domain> => {
  const { store, buildWriteIFCInput } = await storeWith(d);
  f(new Proxy({} as S, { get: (_, k) => (store.getState() as unknown as Record<string | symbol, unknown>)[k] }));
  return structuredClone(buildWriteIFCInput(store.getState(), 'merge')) as Domain;
};
const leaves = (s: S) => s.tasks.filter((t: any) => !t.isMilestone && !t.childIds.length);

type Outcome = { ok: true; bytes: Uint8Array; next: IfcSource } | { ok: false; kinds: string[]; detail: string };
async function save(d: Domain, source: IfcSource): Promise<Outcome> {
  clockStart();
  try {
    const prepared = await prepareIfcWrite(d, source);
    return { ok: true, bytes: concat(prepared.parts), next: prepared.source };
  } catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    return { ok: false, kinds: [...new Set(e.cases.map(c => c.kind))].sort(), detail: e.cases[0]?.detail.slice(0, 300) ?? '' };
  }
}
const summary = (o: Outcome) => o.ok ? `geschreven ${o.bytes.length} ${sha(o.bytes)}` : `geweigerd ${o.kinds.join(',')}`;

/** Eén geval: openen, bewerken, opslaan. Geen weigering met `eigen-uitvoer`; `expectWrite`: het schrijft. */
async function edited(label: string, bytes: Uint8Array, edit: (d: Domain) => Promise<Domain> | Domain, expectWrite = false) {
  clockStart();
  const opened = await openForeign(bytes);
  assert(opened.ifcSource?.foreign, `${label}: echte vreemde bytes-openroute`);
  const d = await edit(cloneDomain(opened));
  const o = await save(d, opened.ifcSource);
  console.log(`UITKOMST ${clockMode} ${label}: ${summary(o)}`);
  ok(`${clockMode} ${label}: geen weigering door (c)`, o.ok || !o.kinds.includes('eigen-uitvoer'), o.ok ? '' : o.detail);
  if (expectWrite) ok(`${clockMode} ${label}: schrijft`, o.ok, o.ok ? '' : `${o.kinds.join(',')}: ${o.detail}`);
  if (o.ok) ok(`${clockMode} ${label}: vreemd deel byte voor byte`, mergeProblems(bytes, o.bytes).length === 0);
  return { o, d, opened };
}

const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
const withLines = (src: string, lines: readonly string[]) => { const at = src.lastIndexOf('ENDSEC;'); return `${src.slice(0, at)}${lines.map(l => `${l}\n`).join('')}${src.slice(at)}`; };
const SOURCES: Record<'eigen' | 'kantoor' | 'oud', Uint8Array> = {
  eigen: read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'),
  kantoor: bytesOf(withLines(latin1(read('public/examples/03-kantoorgebouw-zuidas.ifc')), REVIT_WALL)),
  oud: read('tests/fixtures/ifc-foreign/oud-eigen-0.1-plus-model.ifc'),
};

const addTask = (s: S, name: string) => {
  const id = s.addTask({ name, position: { anchorId: leaves(s)[0].id, where: 'below' } }, { phaseAssignments: 'move', answered: true });
  if (!id) throw new Error('taak toevoegen mislukt'); return id;
};
const deleteAll = (s: S) => {
  for (const b of [...s.baselines]) s.deleteBaseline(b.id);
  for (const c of [...s.activityCodeTypes]) s.removeActivityCodeType(c.id);
  for (const t of [...s.tasks].filter((t: any) => !t.parentId)) if (s.tasks.some((x: any) => x.id === t.id)) s.deleteTask(t.id);
};

// ── 1 en 4. Geen nieuwe weigering, met een vaste en een lopende klok ──
async function noNewRefusal(which: keyof typeof SOURCES) {
  const raw = SOURCES[which], tag = which;
  const saved = await savedCatalogStart(raw), single = await savedCatalogStart(raw, false);
  // 7d: de vier vaste bewerkingen op de catalogus (de tweede op de bron met één type) schrijven op de basis.
  for (const i of [0, 1, 2, 3]) await edited(`7d ${tag}: ${fixedCatalogEdits({} as Domain)[i].label}`, i === 1 ? single : saved, d => applyEdit(fixedCatalogEdits(d)[i], d), true);
  await edited(`7d ${tag}: actieve baseline uitzetten`, saved, se(s => { s.setActiveBaseline(null); }));
  await edited(`7d ${tag}: baseline erbij en bestaande actief`, saved, se(s => { const id = s.baselines[0].id; s.saveBaseline('Nieuw 7d'); s.setActiveBaseline(id); }));
  await edited(`7d ${tag}: waarde bij bestaande codedefinitie`, saved, se(s => { s.addActivityCodeValue(s.activityCodeTypes[0].id, { code: 'EXTRA', description: 'Extra' }); }));
  await edited(`7d ${tag}: getypeerde taak hernoemen`, saved, se(s => { const t = s.tasks.find((t: any) => t.customTaskTypeId); s.updateTask(t.id, { name: `${t.name} hernoemd` }); }));
  await edited(`7d ${tag}: één bestaande baseline wissen`, saved, se(s => { s.deleteBaseline(s.baselines[0].id); }));
  // 7c: de vaste reeksen op een opgeslagen beginstand (alleen op de eigen bron, zoals check-ifc-foreign-preserve).
  if (which === 'eigen') {
    const seq = await savedSequenceStart(raw);
    for (const i of [0, 1, 2, 3]) await edited(`7c ${tag}: vaste reeks ${i}`, seq, d => applyEdit(fixedSequenceEdits(d)[i], d), true);
  }
  // Reeksen in één sessie.
  await edited(`reeks ${tag}: taak + baseline (bron)`, raw, se(s => { addTask(s, 'Reeks taak'); s.saveBaseline('Reeks baseline'); }), true);
  await edited(`reeks ${tag}: code maken + toewijzen + hernoemen (bron)`, raw, se(s => {
    const c = s.addActivityCodeType('Reeks code'), v = s.addActivityCodeValue(c, { code: 'R', description: 'Reeks' });
    s.setTaskActivityCode(leaves(s)[0].id, c, v); s.renameActivityCodeType(c, 'Reeks code hernoemd');
  }), true);
  await edited(`reeks ${tag}: type maken + geven + weghalen (catalogus)`, saved, se(s => {
    s.ensureProjectTaskType({ id: 'type-reeks', name: 'Type reeks' });
    const t = leaves(s).find((t: any) => !t.customTaskTypeId); s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-reeks' });
    s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
  }));
  await edited(`reeks ${tag}: baseline maken + wissen + maken (catalogus)`, saved, se(s => {
    s.saveBaseline('Reeks X'); s.deleteBaseline(s.baselines.find((b: any) => b.name === 'Reeks X').id); s.saveBaseline('Reeks Y');
  }));
  await edited(`reeks ${tag}: alles wissen (bron)`, raw, se(deleteAll));
  // Keten over opslaan en heropenen: stap 1 schrijft; daarna verder met de uitvoer zolang die schrijft.
  let bytes = raw;
  const chain: [string, (s: S) => void][] = [
    ['1 type, code en baseline maken', s => {
      s.ensureProjectTaskType({ id: 'type-k', name: 'Type keten' });
      for (const t of leaves(s).slice(0, 2)) s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-k' });
      const c = s.addActivityCodeType('Code keten'), v = s.addActivityCodeValue(c, { code: 'K', description: 'Keten' });
      s.setTaskActivityCode(leaves(s)[0].id, c, v); s.saveBaseline('Keten B1');
    }],
    ['2 een taak uit B1 wissen (de weesregel)', s => { s.deleteTask(leaves(s)[2].id); }],
    ['3 alleen de projectbeschrijving', s => { s.setProject({ description: 'Alleen beschrijving' }); }],
    ['4 baseline B2 vastleggen', s => { s.saveBaseline('Keten B2'); }],
  ];
  for (const [i, [label, f]] of chain.entries()) {
    const r = await edited(`keten ${tag}: stap ${label}`, bytes, se(f), i < 3);
    if (!r.o.ok) break;
    bytes = r.o.bytes;
  }
}

async function session(which: 'eigen' | 'kantoor') {
  const steps: [string, (s: S) => void][] = [
    ['1 type, code en twee baselines maken', s => {
      s.ensureProjectTaskType({ id: 'type-s', name: 'Type sessie' });
      for (const t of leaves(s).slice(0, 2)) s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-s' });
      const c = s.addActivityCodeType('Code sessie'), v = s.addActivityCodeValue(c, { code: 'S', description: 'Sessie' });
      s.setTaskActivityCode(leaves(s)[0].id, c, v); s.saveBaseline('Sessie B1'); s.saveBaseline('Sessie B2');
    }],
    ['2 code hernoemen en aan tweede taak', s => {
      const c = s.activityCodeTypes.find((c: any) => c.name === 'Code sessie'); s.renameActivityCodeType(c.id, 'Code sessie hernoemd');
      s.setTaskActivityCode(leaves(s)[1].id, c.id, c.values[0].id);
    }],
    ['7 niets bewerken (opnieuw Ctrl+S)', () => {}],
  ];
  clockStart();
  const opened = await openForeign(SOURCES[which]);
  let source = opened.ifcSource!, d: Domain = cloneDomain(opened);
  for (const [label, f] of steps) {
    const next = await se(f)(d);
    const o = await save(next, source);
    console.log(`UITKOMST ${clockMode} sessie ${which}: stap ${label}: ${summary(o)}`);
    ok(`${clockMode} sessie ${which}: stap ${label}: geen weigering door (c)`, o.ok || !o.kinds.includes('eigen-uitvoer'), o.ok ? '' : o.detail);
    if (!o.ok) break;
    if (label.startsWith('7')) ok(`${clockMode} sessie ${which}: niets bewerkt geeft de vorige uitvoer terug`, sameBytes(o.bytes, source.bytes));
    source = o.next; d = next;
  }
}

/** Een vreemde property in de ledenlijst van de eerste pset met deze naam; de rest byte voor byte gelijk. */
function withForeignMember(bytes: Uint8Array, pset: string): Uint8Array {
  let t = latin1(bytes);
  const re = new RegExp(`^(#\\d+=IFCPROPERTYSET\\('[^']*',#\\d+,'${pset}',\\$,\\()([^)]*)(\\)\\);)`, 'm');
  assert(re.test(t), `pset ${pset} niet gevonden`);
  t = t.replace(re, (_, a, m, z) => `${a}${m},#95000${z}`);
  const at = t.lastIndexOf('ENDSEC;');
  return bytesOf(`${t.slice(0, at)}#95000=IFCPROPERTYSINGLEVALUE('VendorNote',$,IFCTEXT('van een ander programma'),$);\n${t.slice(at)}`);
}

/** Een onbekende `IfcSimplePropertyTemplate` van een ander programma in de lijst van het codetemplate (review van #953). */
function withForeignTemplate(bytes: Uint8Array): Uint8Array {
  let owner = '';
  let t = latin1(bytes).split('\n').map(s => {
    const l = parseOutLine(s.replace(/\r$/, ''));
    if (!l || l.type !== 'IFCPROPERTYSETTEMPLATE' || l.args[2] !== `'${PSET.ActivityCodes}'`) return s;
    owner = l.args[1];
    const args = [...l.args]; args[6] = args[6].replace(/\)$/, ',#95001)');
    return `#${l.id}=${l.type}(${args.join(',')});${s.endsWith('\r') ? '\r' : ''}`;
  }).join('\n');
  assert(owner, 'codetemplate niet gevonden');
  const at = t.lastIndexOf('ENDSEC;');
  t = `${t.slice(0, at)}#95001=IFCSIMPLEPROPERTYTEMPLATE('0MVR953FOREIGNTEMPLATE',${owner},'VendorReviewTemplate',$,.P_SINGLEVALUE.,'IfcText',$,$,$,$,$,$);\n${t.slice(at)}`;
  return bytesOf(t);
}
const foreignTemplateKept = (text: string) => text.includes("#95001=IFCSIMPLEPROPERTYTEMPLATE('0MVR953FOREIGNTEMPLATE'")
  && new RegExp(`=IFCPROPERTYSETTEMPLATE\\('[^']*',#\\d+,'${PSET.ActivityCodes}',[^\\n]*#95001[,)]`).test(text);

async function foreignMember() {
  const eigen = SOURCES.eigen;
  const bl = withForeignMember(eigen, PSET.Baselines);
  const cat = withForeignMember(await savedCatalogStart(eigen), PSET.StructureMeta);
  const cases: [string, Uint8Array, (d: Domain) => Promise<Domain> | Domain][] = [
    ['vreemd lid in OPS_Baselines: projectbeschrijving', bl, se(s => s.setProject({ description: 'Alleen beschrijving' }))],
    ['vreemd lid in OPS_Baselines: baseline erbij', bl, se(s => s.saveBaseline('Met vreemd lid'))],
    ['vreemd lid in OPS_StructureMeta: tweede code', cat, se(s => { const c = s.addActivityCodeType('Code met vreemd lid'); s.addActivityCodeValue(c, { code: 'V', description: 'V' }); })],
  ];
  for (const [label, bytes, edit] of cases) {
    const { o } = await edited(label, bytes, edit, true);
    if (!o.ok) continue;
    const text = latin1(o.bytes);
    ok(`${label}: het vreemde lid blijft staan`, text.includes("#95000=IFCPROPERTYSINGLEVALUE('VendorNote'")
      && new RegExp(`=IFCPROPERTYSET\\('[^']*',#\\d+,'${label.includes('Baselines') ? PSET.Baselines : PSET.StructureMeta}',\\$,\\([^)]*#95000[,)]`).test(text));
  }
  // Een vreemd lid in een eigen template (review van #953, ronde 1): de basis schrijft dit met lid en koppeling.
  const tmpl = withForeignTemplate(await savedCatalogStart(eigen));
  {
    const { o } = await edited('vreemd lid in het codetemplate: projectbeschrijving', tmpl, se(s => s.setProject({ description: 'Alleen de projectbeschrijving door review 953' })), true);
    if (o.ok) {
      ok('vreemd lid in het codetemplate: lid en koppeling blijven staan', foreignTemplateKept(latin1(o.bytes)));
    }
    clockStart();
    const opened = await openForeign(tmpl);
    const same = await save(cloneDomain(opened), opened.ifcSource!);
    ok('vreemd lid in het codetemplate: niets bewerkt geeft de bronbytes terug', same.ok && sameBytes(same.bytes, tmpl));
  }
  // Niets bewerkt: de bronbytes terug.
  clockStart();
  const opened = await openForeign(bl);
  const o = await save(cloneDomain(opened), opened.ifcSource!);
  console.log(`UITKOMST ${clockMode} vreemd lid in OPS_Baselines: niets: ${summary(o)}`);
  ok('vreemd lid in OPS_Baselines: niets bewerkt geeft de bronbytes terug', o.ok && sameBytes(o.bytes, bl));
}

{
  // Een `#n` in tekst is geen verwijzing (review van #953, ronde 1): #6 hoort via #7/#8 bij OPS_Project.
  const lines: OutLine[] = [
    { id: 1, type: 'IFCPROJECT', args: [] },
    { id: 2, type: 'IFCPROPERTYSINGLEVALUE', args: ["'Author'", '$', "IFCTEXT('#6')", '$'] },
    { id: 3, type: 'IFCPROPERTYSET', args: ["'g1'", '$', `'${PSET.ProjectSettings}'`, '$', '(#2)'] },
    { id: 4, type: 'IFCRELDEFINESBYPROPERTIES', args: ["'g2'", '$', '$', '$', '(#1)', '#3'] },
    { id: 6, type: 'IFCPROPERTYSINGLEVALUE', args: ["'TimeModel'", '$', "IFCLABEL('MINUTES')", '$'] },
    { id: 7, type: 'IFCPROPERTYSET', args: ["'g3'", '$', `'${PSET.Project}'`, '$', '(#6)'] },
    { id: 8, type: 'IFCRELDEFINESBYPROPERTIES', args: ["'g4'", '$', '$', '$', '(#1)', '#7'] },
  ];
  const m = ownGroupMembers(linesView(lines));
  ok("indeling: IFCTEXT('#6') verwijst niet; #6 hoort bij OPS_Project", m.get(6) === PSET.Project && m.get(2) === PSET.ProjectSettings, `${m.get(6)} / ${m.get(2)}`);
}

for (const mode of ['vast', 'lopend'] as const) {
  clockMode = mode;
  for (const which of mode === 'vast' ? ['eigen', 'kantoor', 'oud'] as const : ['eigen'] as const) await noNewRefusal(which);
  for (const which of mode === 'vast' ? ['eigen', 'kantoor'] as const : ['eigen'] as const) await session(which);
  if (mode === 'vast') await foreignMember();
}
clockMode = 'vast';

// ── 3. Niets veranderd: de bronbytes terug, zonder (c). Op die bytes zegt (c) soms "nee": ze zijn niet door deze writer
// geschreven (een oudere versie, of een bron die niet in de vorm van de writer staat). Dat legt dit vast. ──
for (const [which, raw] of Object.entries(SOURCES)) {
  clockStart();
  const opened = await openForeign(raw), source = opened.ifcSource!, input = cloneDomain(opened);
  const o = await save(input, source);
  ok(`${which}: niets bewerkt geeft de bronbytes terug`, o.ok && sameBytes(o.bytes, raw));
  clockStart();
  let verdict = 'ja';
  try { await checkMergeOutput(raw, input, source, { stepIds: source.stepIds, writtenAt: new Date(), skip: new Set() }); }
  catch (e) { if (!(e instanceof MergeNeedsPhase2Error)) throw e; verdict = `nee (${e.cases[0].detail.slice(0, 160)})`; }
  console.log(`BEWIJS ${which}: (c) op de bronbytes zelf: ${verdict}`);
}

// ── 2. Tegenproeven op de echte uitvoer ──
const linesIn = (bytes: Uint8Array) => latin1(bytes).split('\n');
type Mutate = (lines: OutLine[]) => void;
/** Pas de geparste regels van de uitvoer aan en zet ze terug in de bytes; de rest blijft byte voor byte gelijk. */
function mutated(bytes: Uint8Array, mutate: Mutate): Uint8Array {
  const raw = linesIn(bytes);
  const parsed = raw.map(l => parseOutLine(l.replace(/\r$/, '')));
  const lines = parsed.filter((l): l is OutLine => !!l).map(l => ({ ...l, args: [...l.args] }));
  const before = lines.map(l => JSON.stringify(l.args));
  mutate(lines);
  const byId = new Map(lines.map((l, i) => [l.id, { l, changed: JSON.stringify(l.args) !== before[i] }]));
  let changed = 0;
  const out = raw.map(text => {
    const p = parseOutLine(text.replace(/\r$/, ''));
    const m = p && byId.get(p.id);
    if (!m?.changed) return text;
    changed++;
    return `#${m.l.id}=${m.l.type}(${m.l.args.join(',')});${text.endsWith('\r') ? '\r' : ''}`;
  });
  assert(changed > 0, 'de tegenproef veranderde de uitvoer niet');
  return bytesOf(out.join('\n'));
}
const prop = (ls: OutLine[], name: string) => {
  const l = ls.find(l => l.type === 'IFCPROPERTYSINGLEVALUE' && l.args[0] === `'${name}'`);
  assert(l, `property ${name} niet in de uitvoer`); return l;
};
const setArg = (l: OutLine, k: number, v: string) => { (l.args as string[])[k] = v; };
const jsonOf = (l: OutLine): any => JSON.parse(decodeStepText(/^IFCTEXT\(('[\s\S]*')\)$/.exec(l.args[2].trim())![1].slice(1, -1).replace(/''/g, "'")));
const alterJson = (name: string, edit: (v: any) => void): Mutate => ls => { const l = prop(ls, name), v = jsonOf(l); edit(v); setArg(l, 2, `IFCTEXT(${ifcJson(v)})`); };

let lastDetail = '';
async function verdict(bytes: Uint8Array, input: WriteIFCInput, source: IfcSource, own?: Parameters<typeof checkMergeOutput>[3]): Promise<string> {
  clockStart(); lastDetail = '';
  try { await checkMergeOutput(bytes, input, source, own); return 'laat door'; }
  catch (e) { if (!(e instanceof MergeNeedsPhase2Error)) throw e; lastDetail = e.cases[0].detail.slice(0, 200); return e.cases[0].kind; }
}
/** Een basis: een geslaagde opslag, en wat (c) daarvoor nodig heeft (de sessiekaart en de klok van die opslag). */
async function base(label: string, bytes: Uint8Array, edit: (d: Domain) => Promise<Domain> | Domain) {
  clockStart();
  const opened = await openForeign(bytes), source = opened.ifcSource!;
  const input = await edit(cloneDomain(opened));
  const o = await save(input, source);
  assert(o.ok, `basis ${label} schrijft`);
  const own = { stepIds: o.next.stepIds, writtenAt: new Date(BASE), skip: new Set<string>() };
  ok(`basis ${label}: de echte uitvoer slaagt met (c)`, await verdict(o.bytes, input, source, own) === 'laat door');
  return { bytes: o.bytes, input, source, own };
}
const caughtOnlyByC: string[] = [];
async function counterProof(b: Awaited<ReturnType<typeof base>>, label: string, mutate: Mutate, onlyC = false) {
  const m = mutated(b.bytes, mutate);
  const without = await verdict(m, b.input, b.source), withC = await verdict(m, b.input, b.source, b.own);
  console.log(`TEGENPROEF ${label}: zonder (c) ${without}; met (c) ${withC} (${lastDetail})`);
  const named = /niet-P-stuk #(\d+)/.exec(lastDetail);
  if (named) console.log(`  dat stuk: ${linesIn(m).find(l => l.startsWith(`#${named[1]}=`))?.slice(0, 200)}`);
  ok(`tegenproef ${label}: geweigerd`, withC !== 'laat door');
  if (without === 'laat door' && withC === 'eigen-uitvoer') caughtOnlyByC.push(label);
  if (onlyC) ok(`tegenproef ${label}: de basis laat hem door, (c) vangt hem`, without === 'laat door' && withC === 'eigen-uitvoer', `${without} / ${withC}`);
}

{
  const eigen = SOURCES.eigen;
  const cat = await savedCatalogStart(eigen), single = await savedCatalogStart(eigen, false);
  // De twee die de basis doorlaat: een verkeerde typenaam (ObjectType) op de taak waarvan de planner het type veranderde.
  for (const [label, bytes, i] of [['nieuw type', single, 1], ['typewissel', cat, 2]] as const) {
    const b = await base(`7d ${label}`, bytes, d => applyEdit(fixedCatalogEdits(d)[i], d));
    const before = b.source.opened!.tasks, after = b.input.tasks;
    const changed = after.find(t => t.customTaskTypeId && t.customTaskTypeId !== before.find(o => o.id === t.id)?.customTaskTypeId)!;
    const guid = b.input.ifcGlobalIds?.[`task:${changed.id}`];
    assert(guid, `${label}: GlobalId van de gewijzigde taak`);
    await counterProof(b, `ObjectType ${label}: typenaam op de gewijzigde taak fout`, ls => {
      const t = ls.find(l => l.type === 'IFCTASK' && l.args[0] === `'${guid}'`)!; setArg(t, 4, "'Verkeerde typenaam'");
    }, true);
    await counterProof(b, `TaskTypes ${label}: extra definitie zonder handeling`, alterJson('TaskTypes', v => { v.definitions.push({ id: 'ongevraagd', name: 'Ongevraagd' }); }));
  }
  // Templates en enumeraties (1591), op de tweede code.
  {
    const b = await base('7d tweede code', cat, d => applyEdit(fixedCatalogEdits(d)[0], d));
    const tmpl = (ls: OutLine[]) => ls.find(l => l.type === 'IFCPROPERTYSETTEMPLATE' && l.args[2] === `'${PSET.ActivityCodes}'`)!;
    const byRef = (ls: OutLine[], r: string) => ls.find(l => `#${l.id}` === r.trim())!;
    const refsOf = (ls: OutLine[]) => tmpl(ls).args[6].trim().slice(1, -1).split(',');
    const enumOf = (ls: OutLine[], k: number) => byRef(ls, byRef(ls, refsOf(ls)[k]).args[7].trim());
    await counterProof(b, '1591 enumeratielabel nieuwe code B → DAK', ls => { setArg(enumOf(ls, 1), 1, "(IFCLABEL('DAK'))"); }, true);
    await counterProof(b, '1591 enumeratielabel oude code A → DAK', ls => { setArg(enumOf(ls, 0), 1, "(IFCLABEL('DAK'))"); }, true);
    await counterProof(b, 'template: oude definitie gewijzigd', ls => { setArg(byRef(ls, refsOf(ls)[0]), 2, "'Verloren oude code'"); });
    await counterProof(b, 'template: oude definitie weg', ls => { setArg(tmpl(ls), 6, `(${refsOf(ls).slice(1).join(',')})`); });
    await counterProof(b, 'template: meettype toegevoegd', ls => { setArg(byRef(ls, refsOf(ls)[1]), 5, "'IfcText'"); }, true);
    await counterProof(b, 'StructureMeta: codewaarde gewijzigd', alterJson('structure', v => { v.activityCodeTypes[0].values[0].code = 'X'; }));
  }
  // TaskGuids en de baselinekop, op een andere actieve baseline.
  {
    const b = await base('7d actieve baseline', cat, d => applyEdit(fixedCatalogEdits(d)[3], d));
    await counterProof(b, 'TaskGuids: één GUID anders', alterJson('TaskGuids', v => { v[Object.keys(v)[0]] = '0000000000000000000000'; }), true);
    await counterProof(b, 'baselinekop: naam anders (alleen de kop)', ls => {
      const h = ls.find(l => l.type === 'IFCWORKSCHEDULE' && l.args.some(a => a.trim() === '.BASELINE.'))!; setArg(h, 2, "'Andere kopnaam'");
    });
    const head = (ls: OutLine[]) => ls.find(l => l.type === 'IFCWORKSCHEDULE' && l.args.some(a => a.trim() === '.BASELINE.'))!;
    await counterProof(b, 'baselinekop: omschrijving anders', ls => { setArg(head(ls), 3, "'Andere omschrijving'"); }, true);
    await counterProof(b, 'baselinekop: aanmaakdatum anders', ls => { setArg(head(ls), 6, "'2001-01-01T00:00:00'"); });
    await counterProof(b, 'ActiveBaselineId wijst naar een onbekende', ls => { setArg(prop(ls, 'ActiveBaselineId'), 2, `IFCTEXT(${ifcStr('onbekend')})`); });
  }
  // Een fout in een eigen template van een bestand met een vreemd templatelid blijft geweigerd (review van #953).
  {
    const b = await base('vreemd templatelid: projectbeschrijving', withForeignTemplate(cat), se(s => s.setProject({ description: 'Alleen beschrijving' })));
    const own = (ls: OutLine[]) => {
      const t = ls.find(l => l.type === 'IFCPROPERTYSETTEMPLATE' && l.args[2] === `'${PSET.ActivityCodes}'`)!;
      return ls.find(l => `#${l.id}` === t.args[6].trim().slice(1, -1).split(',')[0].trim())!;
    };
    await counterProof(b, 'vreemd templatelid: AccessState van een eigen template $ → .READONLY.', ls => { setArg(own(ls), 11, '.READONLY.'); }, true);
  }
  // 7c: TaskGuids groeit (taak + baseline).
  {
    const seq = await savedSequenceStart(eigen);
    const b = await base('7c taak + baseline', seq, d => applyEdit(fixedSequenceEdits(d)[0], d));
    const added = b.input.tasks.find(t => !b.source.opened!.tasks.some(o => o.id === t.id))!;
    await counterProof(b, 'TaskGuids: nieuwe GUID verkeerd', alterJson('TaskGuids', v => { v[added.id] = 'verkeerde-guid'; }), true);
    await counterProof(b, 'TaskGuids: oude koppeling weg', alterJson('TaskGuids', v => { delete v[Object.keys(v).find(k => k !== added.id)!]; }), true);
  }
  console.log(`BEWIJS alleen (c) vangt: ${caughtOnlyByC.length} — ${caughtOnlyByC.join('; ')}`);
}

// ── De indeling: wat de writer op project en werkschema zet, is een groep; per-taak-psets niet. ──
{
  clockStart();
  const out = await base('indeling', await savedCatalogStart(SOURCES.eigen), d => d);
  const lines = linesIn(out.bytes).map(l => parseOutLine(l.replace(/\r$/, ''))).filter((l): l is OutLine => !!l);
  const groups = new Set(ownGroupMembers(linesView(lines)).values());
  const register = new Set<string>(Object.values(PSET));
  console.log(`BEWIJS groepen in de catalogusuitvoer: ${[...groups].sort().join(', ')}`);
  ok('indeling: elke groep is een eigen registerpset of de baselinekop', [...groups].every(g => register.has(g) || g === BASELINE_HEADS));
  for (const g of [PSET.Project, PSET.ProjectSettings, PSET.StructureMeta, PSET.TaskTypes, PSET.Baselines]) {
    ok(`indeling: ${g} is een groep`, groups.has(g));
  }
  for (const g of [PSET.TaskNotes, PSET.Assignments, PSET.Resource, PSET.Calendar, PSET.WorkRule]) ok(`indeling: ${g} (per object) is geen groep`, !groups.has(g));
}

console.log(`\n${passed} OK, ${failed} XX`);
if (failed > 0) process.exit(1);
