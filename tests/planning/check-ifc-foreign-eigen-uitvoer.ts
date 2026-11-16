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
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { checkMergeOutput, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { parseOutLine, type OutLine } from '@/services/ifc/foreign/lossCheck';
import { BASELINE_HEADS, indexView, linesView, ownGroupMembers, ownGroupTrees } from '@/services/ifc/foreign/ownGroups';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import { PSET, ifcJson, ifcStr } from '@/services/ifc/ifcPsets';
import { decodeStepText } from '@/services/ifc/stepText';
import {
  applyEdit, cloneDomain, fixedCatalogEdits, fixedSequenceEdits, mergeProblems, openForeign, sameBytes,
  savedCatalogStart, savedSequenceStart, type Domain,
} from './ifcMergeKern';
import {
  BASE, SOURCES, addTask, bytesOf, clock, deleteAll, finish, foreignMemberKept, idsAt, latin1, leaves, ok, save, se, summary,
  withForeignMember, withLines, type S,
} from './ifcEigenKern';

const clockStart = () => clock.start();
let caseNo = 0;
/** Een nieuw geval: de teller van `generateId` op zijn eigen vaste stand (`idsAt`), de klok op de begintijd. Zo krijgt een
 *  geval op de basiscode dezelfde invoer, ook als een eerder geval daar weigerde en hier schrijft (PR 12c). */
function nextCase() { idsAt(++caseNo * 50_000); clockStart(); }
/** De opgeslagen beginstanden, elk met een eigen vaste stand van de teller (anders hangen hun nieuwe ids af van de gevallen
 *  ervoor). */
const savedCatalog = (raw: Uint8Array, twoTypes = true) => { nextCase(); return savedCatalogStart(raw, twoTypes); };
const savedSequence = (raw: Uint8Array) => { nextCase(); return savedSequenceStart(raw); };

/** Eén geval: openen, bewerken, opslaan. Geen weigering met `eigen-uitvoer`; `expectWrite`: het schrijft. */
async function edited(label: string, bytes: Uint8Array, edit: (d: Domain) => Promise<Domain> | Domain, expectWrite = false) {
  nextCase();
  const opened = await openForeign(bytes);
  assert(opened.ifcSource?.foreign, `${label}: echte vreemde bytes-openroute`);
  const d = await edit(cloneDomain(opened));
  const o = await save(d, opened.ifcSource);
  console.log(`UITKOMST ${clock.mode} ${label}: ${summary(o)}`);
  ok(`${clock.mode} ${label}: geen weigering door (c)`, o.ok || !o.kinds.includes('eigen-uitvoer'), o.ok ? '' : o.detail);
  if (expectWrite) ok(`${clock.mode} ${label}: schrijft`, o.ok, o.ok ? '' : `${o.kinds.join(',')}: ${o.detail}`);
  if (o.ok) ok(`${clock.mode} ${label}: vreemd deel byte voor byte`, mergeProblems(bytes, o.bytes).length === 0);
  return { o, d, opened };
}

// ── 1 en 4. Geen nieuwe weigering, met een vaste en een lopende klok ──
async function noNewRefusal(which: keyof typeof SOURCES) {
  const raw = SOURCES[which], tag = which;
  const saved = await savedCatalog(raw), single = await savedCatalog(raw, false);
  // 7d: de vier vaste bewerkingen op de catalogus (de tweede op de bron met één type) schrijven op de basis.
  for (const i of [0, 1, 2, 3]) await edited(`7d ${tag}: ${fixedCatalogEdits({} as Domain)[i].label}`, i === 1 ? single : saved, d => applyEdit(fixedCatalogEdits(d)[i], d), true);
  await edited(`7d ${tag}: actieve baseline uitzetten`, saved, se(s => { s.setActiveBaseline(null); }));
  await edited(`7d ${tag}: baseline erbij en bestaande actief`, saved, se(s => { const id = s.baselines[0].id; s.saveBaseline('Nieuw 7d'); s.setActiveBaseline(id); }));
  await edited(`7d ${tag}: waarde bij bestaande codedefinitie`, saved, se(s => { s.addActivityCodeValue(s.activityCodeTypes[0].id, { code: 'EXTRA', description: 'Extra' }); }));
  await edited(`7d ${tag}: getypeerde taak hernoemen`, saved, se(s => { const t = s.tasks.find((t: any) => t.customTaskTypeId); s.updateTask(t.id, { name: `${t.name} hernoemd` }); }));
  await edited(`7d ${tag}: één bestaande baseline wissen`, saved, se(s => { s.deleteBaseline(s.baselines[0].id); }));
  // 7c: de vaste reeksen op een opgeslagen beginstand (alleen op de eigen bron, zoals check-ifc-foreign-preserve).
  if (which === 'eigen') {
    const seq = await savedSequence(raw);
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
  nextCase();
  const opened = await openForeign(SOURCES[which]);
  let source = opened.ifcSource!, d: Domain = cloneDomain(opened);
  for (const [label, f] of steps) {
    const next = await se(f)(d);
    const o = await save(next, source);
    console.log(`UITKOMST ${clock.mode} sessie ${which}: stap ${label}: ${summary(o)}`);
    ok(`${clock.mode} sessie ${which}: stap ${label}: geen weigering door (c)`, o.ok || !o.kinds.includes('eigen-uitvoer'), o.ok ? '' : o.detail);
    if (!o.ok) break;
    if (label.startsWith('7')) ok(`${clock.mode} sessie ${which}: niets bewerkt geeft de vorige uitvoer terug`, sameBytes(o.bytes, source.bytes));
    source = o.next; d = next;
  }
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
  const cat = withForeignMember(await savedCatalog(eigen), PSET.StructureMeta);
  const cases: [string, Uint8Array, (d: Domain) => Promise<Domain> | Domain][] = [
    ['vreemd lid in OPS_Baselines: projectbeschrijving', bl, se(s => s.setProject({ description: 'Alleen beschrijving' }))],
    ['vreemd lid in OPS_Baselines: baseline erbij', bl, se(s => s.saveBaseline('Met vreemd lid'))],
    ['vreemd lid in OPS_StructureMeta: tweede code', cat, se(s => { const c = s.addActivityCodeType('Code met vreemd lid'); s.addActivityCodeValue(c, { code: 'V', description: 'V' }); })],
  ];
  for (const [label, bytes, edit] of cases) {
    const { o } = await edited(label, bytes, edit, true);
    if (!o.ok) continue;
    const text = latin1(o.bytes);
    ok(`${label}: het vreemde lid blijft staan`, foreignMemberKept(text, label.includes('Baselines') ? PSET.Baselines : PSET.StructureMeta));
  }
  // Een vreemd lid in een eigen template (review van #953, ronde 1): de basis schrijft dit met lid en koppeling.
  const tmpl = withForeignTemplate(await savedCatalog(eigen));
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
  // Het laatste eigen lid valt weg, alleen het vreemde lid blijft (review van #953, ronde 2): een pset met uitsluitend
  // vreemde leden is geen groep van (c). De verliescontrole weigert dit al, net als op main; (c) voegt niets toe.
  {
    const { o } = await edited('vreemd lid in OPS_Baselines: alle baselines weg', bl, se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); }));
    ok('vreemd lid in OPS_Baselines: alle baselines weg weigert als niet-gedragen, niet als eigen-uitvoer',
      !o.ok && o.kinds.includes('niet-gedragen') && !o.kinds.includes('eigen-uitvoer'), summary(o));
  }
  // Niets bewerkt: de bronbytes terug.
  clockStart();
  const opened = await openForeign(bl);
  const o = await save(cloneDomain(opened), opened.ifcSource!);
  console.log(`UITKOMST ${clock.mode} vreemd lid in OPS_Baselines: niets: ${summary(o)}`);
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
{
  // Review van #953, ronde 2: alleen een niet-lege lijst met uitsluitend vreemde leden maakt een pset of IfcRelDeclares geen groep.
  const groupsOf = (members: string, declared: string) => new Set(ownGroupMembers(linesView([
    { id: 1, type: 'IFCPROJECT', args: [] },
    { id: 2, type: 'IFCPROPERTYSINGLEVALUE', args: ["'Eigen'", '$', "IFCLABEL('x')", '$'] },
    { id: 3, type: 'IFCPROPERTYSET', args: ["'g1'", '$', `'${PSET.SchedulingProfile}'`, '$', members] },
    { id: 4, type: 'IFCRELDEFINESBYPROPERTIES', args: ["'g2'", '$', '$', '$', '(#1)', '#3'] },
    { id: 5, type: 'IFCPROPERTYSETTEMPLATE', args: ["'g3'", '$', `'${PSET.ActivityCodes}'`, '$', '.PSET_TYPEDRIVENOVERRIDE.', '$', '()'] },
    { id: 6, type: 'IFCRELDECLARES', args: ["'g4'", '$', '$', '$', '#1', declared] },
  ])).values());
  const empty = groupsOf('()', '()'), own = groupsOf('(#2,#900)', '(#5,#901)'), foreign = groupsOf('(#900)', '(#901)');
  ok('indeling: een lege pset en een lege IfcRelDeclares zijn een groep', empty.has(PSET.SchedulingProfile) && empty.has(PSET.StructureMeta), [...empty].join(','));
  ok('indeling: met minstens één eigen lid een groep', own.has(PSET.SchedulingProfile) && own.has(PSET.StructureMeta), [...own].join(','));
  ok('indeling: uitsluitend vreemde leden is geen groep', !foreign.has(PSET.SchedulingProfile) && !foreign.has(PSET.StructureMeta), [...foreign].join(','));
}

for (const mode of ['vast', 'lopend'] as const) {
  clock.mode = mode;
  for (const which of mode === 'vast' ? ['eigen', 'kantoor', 'oud'] as const : ['eigen'] as const) await noNewRefusal(which);
  for (const which of mode === 'vast' ? ['eigen', 'kantoor'] as const : ['eigen'] as const) await session(which);
  if (mode === 'vast') await foreignMember();
}
clock.mode = 'vast';

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
  nextCase();
  const opened = await openForeign(bytes), source = opened.ifcSource!;
  const input = await edit(cloneDomain(opened));
  const o = await save(input, source);
  assert(o.ok, `basis ${label} schrijft`);
  const own = { stepIds: o.next.stepIds, writtenAt: new Date(BASE), skip: new Set<string>() };
  ok(`basis ${label}: de echte uitvoer slaagt met (c)`, await verdict(o.bytes, input, source, own) === 'laat door');
  return { bytes: o.bytes, input, source, own };
}
const caughtOnlyByC: string[] = [];
async function counterProof(b: Awaited<ReturnType<typeof base>>, label: string, mutate: Mutate | Uint8Array, onlyC = false) {
  const m = mutate instanceof Uint8Array ? mutate : mutated(b.bytes, mutate);
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
  const cat = await savedCatalog(eigen), single = await savedCatalog(eigen, false);
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
  // PR 12c: fouten rond de baselinekop in de echte uitvoer van "één baseline wissen" (sinds PR 12c schrijft die opslag; de
  // kop in de aggregatie van het werkplan beweegt in de verliescontrole mee met zijn baseline). Elke fout moet de controle
  // op de echte uitvoer vangen; de regel zegt welke.
  {
    const b = await base('kop: één baseline wissen', cat, se(s => { s.deleteBaseline(s.baselines[0].id); }));
    const ls0 = linesIn(b.bytes).map(l => parseOutLine(l.replace(/\r$/, ''))).filter((l): l is OutLine => !!l);
    const isHead = (l: OutLine) => l.type === 'IFCWORKSCHEDULE' && l.args.some(a => a.trim() === '.BASELINE.');
    const planId = ls0.find(l => l.type === 'IFCWORKPLAN')!.id;
    const agg = (ls: OutLine[]) => ls.find(l => l.type === 'IFCRELAGGREGATES' && l.args[4].trim() === `#${planId}`)!;
    const projectAgg = (ls: OutLine[]) => ls.find(l => l.type === 'IFCRELAGGREGATES' && ls.find(x => `#${x.id}` === l.args[4].trim())?.type === 'IFCPROJECT')!;
    const members = (l: OutLine) => l.args[5].trim().slice(1, -1).split(',').map(x => x.trim());
    const heads = ls0.filter(isHead);
    assert(heads.length === 2 && projectAgg(ls0), 'kop: twee koppen na wissen, en een aggregatie van het project');
    const [h1] = heads;
    const gone = linesIn(cat).find(l => /^#\d+=IFCWORKSCHEDULE\(/.test(l) && l.includes('.BASELINE.')
      && !heads.some(h => l.startsWith(`#${h.id}=`)))!;
    assert(gone, 'kop: de kop van de gewiste baseline in de bron');
    const goneId = /^#(\d+)=/.exec(gone)![1];
    const nextId = Math.max(...ls0.map(l => l.id)) + 1;
    const dropLine = (bytes: Uint8Array, id: number) => bytesOf(linesIn(bytes).filter(l => !l.startsWith(`#${id}=`)).join('\n'));
    const moved = mutated(b.bytes, ls => {
      setArg(agg(ls), 5, `(${members(agg(ls)).filter(id => id !== `#${h1.id}`).join(',')})`);
      setArg(projectAgg(ls), 5, `(${[...members(projectAgg(ls)), `#${h1.id}`].join(',')})`);
    });
    const proofs: [string, Uint8Array][] = [
      ['een kop te veel', bytesOf(withLines(latin1(mutated(b.bytes, ls => { setArg(agg(ls), 5, `(${[...members(agg(ls)), `#${nextId}`].join(',')})`); })),
        [`#${nextId}=IFCWORKSCHEDULE('0R12CEXTRAKOP0000000000',${h1.args.slice(1).join(',')});`]))],
      ['een kop te weinig', dropLine(mutated(b.bytes, ls => { setArg(agg(ls), 5, `(${members(agg(ls)).filter(id => id !== `#${h1.id}`).join(',')})`); }), h1.id)],
      ['een kop met een verkeerde naam', mutated(b.bytes, ls => { setArg(ls.find(l => l.id === h1.id)!, 2, "'Verkeerde kopnaam'"); })],
      ['een kop met een verkeerde aanmaakdatum', mutated(b.bytes, ls => { setArg(ls.find(l => l.id === h1.id)!, 6, "'2001-01-01T00:00:00'"); })],
      ['een kop in de aggregatie van het project (1705)', moved],
      ['de kop van de gewiste baseline blijft staan', bytesOf(withLines(latin1(mutated(b.bytes, ls => {
        setArg(agg(ls), 5, `(${[...members(agg(ls)), `#${goneId}`].join(',')})`);
      })), [gone.replace(/\r$/, '')]))],
    ];
    // (c) zelf: de boomvorm van de koppen in de uitvoer. De lezer leest de koppen niet (de baselines staan in het JSON), dus
    // de herschreven kant is voor elke tegenproef dezelfde als voor de goede uitvoer; ziet de boomvorm van de uitvoer een
    // verschil, dan weigert (c), ook als de volledige uitvoercontrole hem niet eerder had gevangen. Zo ook knownbug 1705: de
    // boomvorm noemt de aggregatie van elke kop.
    // Eigen regels zoals in `ownOutputProblem`: een stuk dat in de bron P is, of nieuw.
    const sourceIndex = scanForeignStep(b.source.bytes), sourceCls = classify(sourceIndex);
    const headTrees = (bytes: Uint8Array) => {
      const index = scanForeignStep(bytes);
      const own = (i: number) => { const c = sourceIndex.chunkOf(index.id(i)); return c < 0 || sourceCls.classes[c] === 1; };
      return ownGroupTrees(indexView(index, own), new Set(b.input.tasks.map(t => t.id))).get(BASELINE_HEADS)?.join('\n') ?? '';
    };
    const good = headTrees(b.bytes);
    ok('kop: de koppen staan in de aggregatie van het eigen werkplan', good.split('\n').every(t => t.startsWith('eigen IFCWORKPLAN|')), good);
    for (const [label, m] of proofs) {
      await counterProof(b, `kop: ${label}`, m);
      const tree = headTrees(m);
      console.log(`BEWIJS (c) kop: ${label}: ${tree === good ? 'GEEN VERSCHIL' : `verschil, «${tree.split('\n').filter(t => !good.split('\n').includes(t)).join(' / ').slice(0, 160) || `${tree.split('\n').length} koppen in plaats van ${good.split('\n').length}`}»`}`);
      ok(`kop: ${label}: (c) zelf ziet het`, tree !== good);
    }
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
    const seq = await savedSequence(eigen);
    const b = await base('7c taak + baseline', seq, d => applyEdit(fixedSequenceEdits(d)[0], d));
    const added = b.input.tasks.find(t => !b.source.opened!.tasks.some(o => o.id === t.id))!;
    await counterProof(b, 'TaskGuids: nieuwe GUID verkeerd', alterJson('TaskGuids', v => { v[added.id] = 'verkeerde-guid'; }), true);
    await counterProof(b, 'TaskGuids: oude koppeling weg', alterJson('TaskGuids', v => { delete v[Object.keys(v).find(k => k !== added.id)!]; }), true);
  }
  // Een lege eigen pset erbij (review van #953, ronde 2): de writer schrijft geen OPS_SchedulingProfile, (c) moet hem vangen.
  {
    const b = await base('lege eigen pset: projectbeschrijving', eigen, se(s => s.setProject({ description: 'Review 953 psetgrens' })));
    const ls = linesIn(b.bytes).map(l => parseOutLine(l.replace(/\r$/, ''))).filter((l): l is OutLine => !!l);
    ok('lege eigen pset: de goede uitvoer heeft geen OPS_SchedulingProfile', !ls.some(l => l.type === 'IFCPROPERTYSET' && l.args[2] === `'${PSET.SchedulingProfile}'`));
    const owner = ls.find(l => l.type === 'IFCPROPERTYSET')!.args[1];
    const schedule = ls.find(l => l.type === 'IFCWORKSCHEDULE' && !l.args.includes('.BASELINE.'))!;
    const m = bytesOf(withLines(latin1(b.bytes), [
      `#95500=IFCPROPERTYSET('0R953REVIEWEMPTYPS0000',${owner},'${PSET.SchedulingProfile}',$,());`,
      `#95501=IFCRELDEFINESBYPROPERTIES('0R953REVIEWEMPTYREL000',${owner},$,$,(#${schedule.id}),#95500);`,
    ]));
    const without = await verdict(m, b.input, b.source), withC = await verdict(m, b.input, b.source, b.own);
    console.log(`TEGENPROEF lege eigen ${PSET.SchedulingProfile}-pset erbij: zonder (c) ${without}; met (c) ${withC} (${lastDetail})`);
    ok('tegenproef lege eigen pset erbij: de basis laat hem door, (c) vangt hem', without === 'laat door' && withC === 'eigen-uitvoer', `${without} / ${withC}`);
    if (without === 'laat door' && withC === 'eigen-uitvoer') caughtOnlyByC.push('lege eigen pset erbij');
  }
  console.log(`BEWIJS alleen (c) vangt: ${caughtOnlyByC.length} — ${caughtOnlyByC.join('; ')}`);
}

// ── De andere tegenproeven van het onderzoek (`proef-mutaties.ts`; PR 12b) ──
// Sinds PR 12b hoeft een verschil in een gedragen eigen groep in de verliescontrole geen bewerking meer te verklaren. Een
// fout van de writer in zo'n groep moet dus de controle op de echte uitvoer vangen: (c) of de controle na openen. Op de
// basis ving de verliescontrole deze fouten al in O1; hier staan ze op de uitvoer van een geslaagde opslag, door de volledige
// uitvoercontrole met (c). Plus "de echte uitvoer zonder dat de planner iets deed": de uitvoer van een bewerking, getoetst
// tegen het onbewerkte domein.
{
  const eigen = SOURCES.eigen;
  const seq = await savedSequence(eigen), cat = await savedCatalog(eigen), single = await savedCatalog(eigen, false);
  const json = (bytes: Uint8Array, name: string) => jsonOf(prop(linesIn(bytes).map(l => parseOutLine(l.replace(/\r$/, ''))).filter((l): l is OutLine => !!l), name));
  const unedited = async (b: Awaited<ReturnType<typeof base>>, label: string) => {
    const withC = await verdict(b.bytes, cloneDomain(b.source.opened! as Parameters<typeof cloneDomain>[0]), b.source, b.own);
    console.log(`TEGENPROEF ${label}: echte uitvoer zonder plannerhandeling: met (c) ${withC} (${lastDetail})`);
    ok(`tegenproef ${label}: echte uitvoer zonder plannerhandeling geweigerd`, withC !== 'laat door');
  };
  // 7c: de twee groeiende kaarten (TaskGuids bij taak + baseline, TaskTypes bij taak + bestaand type).
  for (const [kind, i] of [['TaskGuids', 0], ['TaskTypes', 2]] as const) {
    const b = await base(`7c ${kind}`, seq, d => applyEdit(fixedSequenceEdits(d)[i], d));
    const map = (v: any) => kind === 'TaskGuids' ? v : v.taskTypeIds;
    const before = json(b.source.bytes, kind), after = json(b.bytes, kind);
    const oldKey = Object.keys(map(before))[0], newKey = Object.keys(map(after)).find(k => !(k in map(before)))!;
    assert(oldKey && newKey, `7c ${kind}: een oude en een nieuwe koppeling`);
    const variants: [string, (v: any) => void][] = [
      ['oude koppeling gewijzigd', v => { map(v)[oldKey] = 'verkeerde-waarde'; }],
      ['nieuwe koppeling weg', v => { delete map(v)[newKey]; }],
    ];
    if (kind === 'TaskGuids') {
      // Bekend gat (knownbug 1706): een extra sleutel zonder taak in `TaskGuids` ziet (c) niet (de weesregel van de canon),
      // en de controle na openen ook niet. Op de basis ving de verliescontrole hem in O1; in een gedragen `OPS_Baselines`
      // niet meer. Er gaat niets verloren. Slaat deze proef om, dan is het gat dicht: werk dan 1706 bij.
      const m = mutated(b.bytes, alterJson(kind, v => { map(v)['onverwacht'] = map(v)[newKey]; }));
      const withC = await verdict(m, b.input, b.source, b.own);
      console.log(`TEGENPROEF 7c TaskGuids: onverwachte nieuwe sleutel zonder taak: met (c) ${withC} (bekend gat, knownbug 1706)`);
      ok('tegenproef 7c TaskGuids: onverwachte nieuwe sleutel zonder taak: laat door (bekend gat, knownbug 1706)', withC === 'laat door', withC);
    } else variants.push(['onverwachte nieuwe sleutel', v => { map(v)['onverwacht'] = map(v)[newKey]; }]);
    if (kind === 'TaskTypes') variants.push(['oude koppeling weg', v => { delete map(v)[oldKey]; }],
      ['nieuwe sleutel verkeerd', v => { map(v)['verkeerde-taak'] = map(v)[newKey]; delete map(v)[newKey]; }],
      ['definitie gewijzigd', v => { v.definitions[0].name = 'Ongevraagde naam'; }], ['nieuw type verkeerd', v => { map(v)[newKey] = 'onbekend-type'; }]);
    for (const [label, f] of variants) await counterProof(b, `7c ${kind}: ${label}`, alterJson(kind, f));
    await unedited(b, `7c ${kind}`);
  }
  // 7d: de templates van de codes (tweede code).
  {
    const b = await base('7d tweede code (onderzoek)', cat, d => applyEdit(fixedCatalogEdits(d)[0], d));
    const tmpl = (ls: OutLine[]) => ls.find(l => l.type === 'IFCPROPERTYSETTEMPLATE' && l.args[2] === `'${PSET.ActivityCodes}'`)!;
    const refsOf = (ls: OutLine[]) => tmpl(ls).args[6].trim().slice(1, -1).split(',');
    const byRef = (ls: OutLine[], r: string) => ls.find(l => `#${l.id}` === r.trim())!;
    await counterProof(b, 'template: verwachte wijziging ontbreekt (alleen de oude definitie)', ls => { setArg(tmpl(ls), 6, `(${refsOf(ls)[0]})`); });
    await counterProof(b, 'template: twee keer dezelfde definitie', ls => { const r = refsOf(ls); setArg(tmpl(ls), 6, `(${r[0]},${r[0]})`); });
    await counterProof(b, 'template: extra definitie zonder handeling', ls => { const r = refsOf(ls); setArg(tmpl(ls), 6, `(${[...r, r[0]].join(',')})`); });
    await counterProof(b, 'template: nieuwe definitie verkeerde naam', ls => { setArg(byRef(ls, refsOf(ls)[1]), 2, "'Ongevraagde code'"); });
    await unedited(b, '7d tweede code');
  }
  // 7d: TaskTypes bij een nieuw type en bij een typewissel.
  for (const [label, bytes, i] of [['nieuw type', single, 1], ['typewissel', cat, 2]] as const) {
    const b = await base(`7d ${label} (onderzoek)`, bytes, d => applyEdit(fixedCatalogEdits(d)[i], d));
    const before = json(b.source.bytes, 'TaskTypes'), after = json(b.bytes, 'TaskTypes');
    const changed = Object.keys(after.taskTypeIds).find(k => before.taskTypeIds[k] !== after.taskTypeIds[k])!;
    const other = Object.keys(before.taskTypeIds).find(k => k !== changed)!;
    assert(changed && other, `7d ${label}: een gewijzigde en een andere koppeling`);
    const variants: [string, (v: any) => void][] = [
      ['oude definitie weg', v => { v.definitions.shift(); }],
      ['oude definitie gewijzigd', v => { v.definitions[0].name = 'Verloren naam'; }],
      ['onaangeraakte koppeling gewijzigd', v => { v.taskTypeIds[other] = v.taskTypeIds[other] === 'type-7d-b' ? 'type-7d-a' : 'type-7d-b'; }],
      ['gewijzigde koppeling verkeerde waarde', v => { v.taskTypeIds[changed] = before.taskTypeIds[changed] ?? 'type-7d-a'; }],
      ['koppeling naar een onbekende definitie', v => { v.taskTypeIds[changed] = 'onbekend'; }],
    ];
    for (const [l, f] of variants) await counterProof(b, `TaskTypes ${label}: ${l}`, alterJson('TaskTypes', f));
    await unedited(b, `7d ${label}`);
  }
  // 7d: de actieve baseline en de baselinegegevens.
  {
    const b = await base('7d actieve baseline (onderzoek)', cat, d => applyEdit(fixedCatalogEdits(d)[3], d));
    const opened = b.source.opened!, other = b.input.baselines!.find(x => x.id !== b.input.activeBaselineId && x.id !== opened.activeBaselineId);
    await counterProof(b, 'ActiveBaselineId wijst naar de oude actieve', ls => { setArg(prop(ls, 'ActiveBaselineId'), 2, `IFCTEXT(${ifcStr(opened.activeBaselineId!)})`); });
    if (other) await counterProof(b, 'ActiveBaselineId wijst naar een andere bestaande', ls => { setArg(prop(ls, 'ActiveBaselineId'), 2, `IFCTEXT(${ifcStr(other.id)})`); });
    await counterProof(b, 'Baselines leeg', ls => { setArg(prop(ls, 'Baselines'), 2, "IFCTEXT('[]')"); });
    await counterProof(b, 'Baselines: één rijdatum anders', alterJson('Baselines', v => {
      const row = v[0].tasks[0]; const k = Object.keys(row).find(k => /start/i.test(k))!; row[k] = '2001-01-01';
    }));
    await unedited(b, '7d actieve baseline');
  }
  // Projectinstellingen: een veld dat de lezer leest.
  {
    const b = await base('projectbeschrijving (onderzoek)', cat, se(s => { s.setProject({ description: 'Nieuwe omschrijving' }); }));
    await counterProof(b, 'ProjectSettings: ProjectDescription anders', ls => { setArg(prop(ls, 'ProjectDescription'), 2, "IFCTEXT('Verkeerd')"); });
  }
}

// ── De indeling: wat de writer op project en werkschema zet, is een groep; per-taak-psets niet. ──
{
  clockStart();
  const out = await base('indeling', await savedCatalog(SOURCES.eigen), d => d);
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

finish();
