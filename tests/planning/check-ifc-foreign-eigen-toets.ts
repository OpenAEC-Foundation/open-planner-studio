// #804 fase 1c, PR 12b: de andere toets voor de eigen projectgroepen in de verliescontrole (onderzoek van 14 november
// 2026, vraag 7, stap 2). Een verschil in O1 in een eigen groep op projectniveau hoeft geen bewerking te verklaren als de
// groep in de bron gedragen is (a) en het openen hem niet veranderde (a′); controle (c) en de controle na openen toetsen
// de echte uitvoer (`openedOwnGroups` in `mergeWriter.ts`, `ownGroups` in `lossCheck.ts`).
//
// Elk geval loopt door de echte open-route (bytes, flag aan) en `prepareIfcWrite`, met de teller van `generateId` op een
// vaste stand per geval (`idsAt`), zodat dezelfde check op de basiscode per geval dezelfde invoer krijgt. Elke uitkomst
// staat als `UITKOMST`-regel in het log (lengte en sha256): zo is de vergelijking oud tegen nieuw per geval te maken (zie de
// PR). De check zelf legt de uitkomst van de nieuwe toets vast, en toetst bij elke geschreven uitvoer dat het bestand heel
// is: het vreemde deel byte voor byte, het heropende domein gelijk aan wat de planner zag (of zoals een gewone opslag
// zonder vreemd deel), en een los veldverschil alleen zoals een gewone opslag het ook heeft.
//
// 1. Wat de nieuwe toets laat schrijven: de knownbugs 1582, 1585, 1586 (laatste gebruik van één type), 1587, 1589, 1110 en
//    de grens van 7d; de gevallen van 7c en 7d op drie bronnen; de reeksen; de sessieketen.
// 2. Wat blijft weigeren: een typedefinitie hernoemen (stap 4), 1588 en een onbekend definitieveld (de groep is niet
//    gedragen), de backup met herstelkenmerk (a′, knownbug 1703), en alles buiten de eigen groepen (de r7sol-bestanden, de
//    volgorde in `IfcRelNests`).
// 3. Een vreemd lid in een eigen pset.
// 4. De klok: de reeksen en de sessieketen ook met een lopende klok.
// 5. PR 12c, de baselinekop (E1): een kop in de aggregatie van het werkplan beweegt mee met zijn baseline (1581, 1700, de
//    baselinestappen van de reeksen en de sessieketen); de rest van die aggregatie blijft exact en in volgorde, ook in de
//    verliescontrole zelf op een nagebootste fout van de writer (`lossProbe`); en wat moet blijven weigeren. Daarin ook de
//    proef van knownbug 1708: (a′) op de bronvorm schrijft op `ifc-arity-oude-writer.ifc` waar de ruwe vorm zou weigeren.
import assert from 'node:assert/strict';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { parseOutLine, type OutLine } from '@/services/ifc/foreign/lossCheck';
import { PSET, ifcJson } from '@/services/ifc/ifcPsets';
import { decodeStepText } from '@/services/ifc/stepText';
import {
  applyEdit, basicEdits, canon, cloneDomain, fixedCatalogEdits, fixedSequenceEdits, lossProbe, mergeProblems, openForeign, ordinaryEdits,
  reopenPlain, sameBytes, savedCatalogStart, savedSequenceStart, shownAfterOpen, type Domain,
} from './ifcMergeKern';
import {
  SOURCES, addTask, bytesOf, clock, deleteAll, finish, foreignMemberKept, idsAt, latin1, leaves, ok, read, save, se, summary,
  withForeignMember, withLines, withWall, type Outcome, type S,
} from './ifcEigenKern';

type Expect = 'schrijft' | 'weigert';
type Edit = (d: Domain) => Promise<Domain> | Domain;

// ── Heel-zijn van een geschreven uitvoer ──
const FIELDS = ['activityCodeTypes', 'customTaskTypes', 'baselines', 'activeBaselineId', 'comparedBaselineIds'] as const;
const json = (x: unknown) => JSON.stringify(x ?? null);
const taskFields = (x: Domain) => x.tasks.map(t => [t.id, t.name, t.customTaskTypeId ?? null, t.activityCodes ?? null]);
const field = (x: Domain, f: string): unknown => f === 'taken' ? taskFields(x) : (x as unknown as Record<string, unknown>)[f];
const planning = (d: Domain) => canon(d, () => {});
/** Heel: het vreemde deel byte voor byte; heropend zoals de planner het zag of zoals een gewone opslag; elk veldverschil
 *  zoals een gewone opslag zonder vreemd deel (`writeIFC` en openen) het ook heeft. */
async function whole(label: string, source: Uint8Array, out: Uint8Array, d: Domain) {
  const foreign = mergeProblems(source, out);
  const reread = await openForeign(out);
  const got = planning(reread);
  const plain = await reopenPlain(d);
  const reopened = got === planning(await shownAfterOpen(d)) ? 'zoals getoond' : got === planning(plain) ? 'zoals een gewone opslag' : undefined;
  const unequal = [...FIELDS, 'taken'].filter(f => json(field(d, f)) !== json(field(reread, f)));
  const unlikePlain = unequal.filter(f => json(field(plain, f)) !== json(field(reread, f)));
  console.log(`HEEL ${clock.mode} ${label}: vreemd deel ${foreign.length === 0 ? 'bytegelijk' : foreign.slice(0, 2).join('; ')}; heropend ${reopened ?? 'ANDERS'}; velden anders: ${unequal.join(', ') || 'geen'}`);
  ok(`${clock.mode} ${label}: heel`, foreign.length === 0 && reopened !== undefined && unlikePlain.length === 0,
    `${foreign.slice(0, 2).join('; ')} ${reopened ?? 'heropend anders'} ${unlikePlain.join(', ')}`);
}

let caseNo = 0;
/** Een nieuw geval: de teller van `generateId` op zijn eigen vaste stand, de klok op de begintijd. */
function nextCase() { idsAt(++caseNo * 50_000); clock.start(); }

/** Eén opslag van een bewerkt domein op `source` (een uit de bron geopend document of de vorige uitvoer). */
async function attempt(label: string, original: Uint8Array, source: IfcSource, d: Domain, expect: Expect): Promise<Outcome> {
  const o = await save(d, source);
  console.log(`UITKOMST ${clock.mode} ${label}: ${summary(o)}`);
  ok(`${clock.mode} ${label}: ${expect}`, (expect === 'schrijft') === o.ok, o.ok ? 'schrijft' : `${o.kinds.join(',')}: ${o.detail}`);
  if (o.ok) await whole(label, original, o.bytes, d);
  return o;
}
/** Eén geval: openen, bewerken, opslaan. */
async function one(label: string, bytes: Uint8Array, edit: Edit, expect: Expect) {
  nextCase();
  const opened = await openForeign(bytes);
  assert(opened.ifcSource?.foreign, `${label}: echte vreemde bytes-openroute`);
  const d = await edit(cloneDomain(opened));
  return { o: await attempt(label, bytes, opened.ifcSource, d, expect), opened, d };
}
/** De bewerking van een stap. Gaat ze niet (een eerdere stap weigerde, en waar ze op werkt bestaat niet), dan is de stap
 *  niet van toepassing: dat is in deze check een fout, maar de keten gaat door (zo loopt de check ook op de basiscode). */
async function applied(label: string, f: () => Promise<Domain>): Promise<Domain | undefined> {
  try { return await f(); } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    console.log(`UITKOMST ${clock.mode} ${label}: n.v.t. (${e.message})`);
    ok(`${clock.mode} ${label}: van toepassing`, false, e.message);
    return undefined;
  }
}
/**
 * Een keten over opslaan en heropenen: elke stap opent de laatste uitvoer die schreef. Weigert een stap, dan gaat de keten
 * verder zonder die stap (de planner draait hem terug).
 */
async function reopenedChain(tag: string, bytes: Uint8Array, steps: readonly [string, (s: S) => void, Expect][]) {
  nextCase();
  for (const [label, f, expect] of steps) {
    clock.start();
    const opened = await openForeign(bytes);
    const d = await applied(`keten ${tag}: stap ${label}`, () => se(f)(cloneDomain(opened)));
    if (!d) continue;
    const o = await attempt(`keten ${tag}: stap ${label}`, bytes, opened.ifcSource!, d, expect);
    if (o.ok) bytes = o.bytes;
  }
}
/**
 * De sessieketen Opslaan als → verder werken → Ctrl+S, zonder heropenen: na een geslaagde opslag geldt de geschreven versie
 * als bron (`prepared.source`, zoals `fileSlice`), en de volgende bewerking gaat verder op hetzelfde domein. Weigert een
 * stap, dan gaat de sessie verder zonder die stap.
 */
async function session(tag: string, raw: Uint8Array, steps: readonly [string, (s: S) => void, Expect][]) {
  nextCase();
  const opened = await openForeign(raw);
  let source = opened.ifcSource!, d: Domain = cloneDomain(opened);
  for (const [label, f, expect] of steps) {
    const next = await applied(`sessie ${tag}: stap ${label}`, () => se(f)(d));
    if (!next) continue;
    const o = await attempt(`sessie ${tag}: stap ${label}`, raw, source, next, expect);
    if (!o.ok) continue;
    if (label.startsWith('7')) ok(`${clock.mode} sessie ${tag}: niets bewerkt geeft de vorige uitvoer terug`, sameBytes(o.bytes, source.bytes));
    source = o.next; d = next;
  }
}

/** Zet in de bron de waarde van één `IFCPROPERTYSINGLEVALUE` met JSON (op naam) anders; de rest byte voor byte gelijk. */
function withJson(bytes: Uint8Array, name: string, edit: (v: any) => void): Uint8Array {
  const text = latin1(bytes);
  const line = text.split('\n').map(l => parseOutLine(l.replace(/\r$/, ''))).find(l => l?.type === 'IFCPROPERTYSINGLEVALUE' && l.args[0] === `'${name}'`);
  assert(line, `property ${name} niet in de bron`);
  const v = JSON.parse(decodeStepText(/^IFCTEXT\(('[\s\S]*')\)$/.exec(line.args[2].trim())![1].slice(1, -1).replace(/''/g, "'")));
  edit(v);
  const next = `#${line.id}=${line.type}(${line.args.map((a, k) => k === 2 ? `IFCTEXT(${ifcJson(v)})` : a).join(',')});`;
  return bytesOf(text.replace(new RegExp(`^#${line.id}=[^\\r\\n]*`, 'm'), () => next));
}

// ── De bronnen; alles wat vóór de gevallen geschreven moet worden, eerst (op de basis schrijft dit ook) ──
const eigen = SOURCES.eigen;
const seq = await savedSequenceStart(eigen);
const cat = await savedCatalogStart(eigen);
const twee = await (async () => {
  clock.start();
  const opened = await openForeign(cat);
  const o = await save(await applyEdit(fixedCatalogEdits(cloneDomain(opened))[0], cloneDomain(opened)), opened.ifcSource!);
  assert(o.ok, 'voorbereiding: tweede code schrijft'); return o.bytes;
})();
const prepared = new Map<string, { saved: Uint8Array; single: Uint8Array }>();
const arity = withWall(read('tests/planning/fixtures/ifc-arity-oude-writer.ifc'));
/** De bronnen van de 7d-gevallen en de reeksen; `arity`: een oud eigen bestand waar het openen `OPS_Baselines` in de ruwe
 *  vorm verandert, niet in de bronvorm (onderzoek, vraag 2, tegenvoorbeeld 1). */
const RAW = { ...SOURCES, arity } as const;
type Which = keyof typeof RAW;
for (const which of ['eigen', 'kantoor', 'oud', 'arity'] as const) {
  const raw = RAW[which];
  prepared.set(which, { saved: await savedCatalogStart(raw), single: await savedCatalogStart(raw, false) });
}
const unused = withJson(cat, 'TaskTypes', v => { v.definitions.push({ id: 'ongebruikt', name: 'Ongebruikt bron-type' }); });
const unknownField = withJson(cat, 'TaskTypes', v => { v.definitions[0].onbekend = 'bewaar-mij'; });
const unknownKey = withJson(cat, 'Baselines', v => { v[0].onbekendeSleutel = 'bewaar-mij'; });
const beschrijving = se(s => { s.setProject({ description: 'Alleen de projectbeschrijving is gewijzigd' }); });
/** Een omschrijving op elk eigen codetemplate (`IfcSimplePropertyTemplate`, argument 3): de lezer leest haar niet, dus de
 *  herleestoets (b) zet haar terug en `OPS_StructureMeta` is in de bron niet gedragen. */
const describedTemplates = (() => {
  let n = 0;
  const text = latin1(twee).split('\n').map(l => {
    const line = parseOutLine(l.replace(/\r$/, ''));
    if (line?.type !== 'IFCSIMPLEPROPERTYTEMPLATE' || line.args[3].trim() !== '$') return l;
    n++;
    return `#${line.id}=${line.type}(${line.args.map((a, k) => k === 3 ? "'Omschrijving van een ander programma'" : a).join(',')});${l.endsWith('\r') ? '\r' : ''}`;
  }).join('\n');
  assert(n >= 2, 'twee codetemplates zonder omschrijving');
  return bytesOf(text);
})();

// ── 1 en 2. De knownbugs en hun grenzen ──
await one('1582 type weghalen bij de laatste getypeerde taak', seq, se(s => {
  const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-7c'); s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
}), 'schrijft');
await one('1582/1110 de laatste getypeerde taak wissen', seq, se(s => { s.deleteTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7c').id); }), 'schrijft');
for (const id of ['task-mula7vhy623330', 'task-mula7vi5vfge34']) {
  await one(`1110 ifc-arity-oude-writer + wand: ${id} wissen`, arity, se(s => { s.deleteTask(id); }), 'schrijft');
}
await one('1585 code hernoemen, een andere code blijft', twee, se(s => { s.renameActivityCodeType(s.activityCodeTypes[0].id, 'Hernoemde code'); }), 'schrijft');
await one('1585 code wissen, een andere code blijft', twee, se(s => { s.removeActivityCodeType(s.activityCodeTypes[0].id); }), 'schrijft');
await one('1586 laatste gebruik van type A weg, B blijft', cat, se(s => {
  for (const t of s.tasks.filter((t: any) => t.customTaskTypeId === 'type-7d-a')) s.updateTask(t.id, { customTaskTypeId: 'type-7d-b' });
}), 'schrijft');
await one('1587 de laatste codedefinitie wissen', cat, se(s => { s.removeActivityCodeType(s.activityCodeTypes[0].id); }), 'schrijft');
await one('7d-grens: de enige codedefinitie hernoemen', cat, se(s => { s.renameActivityCodeType(s.activityCodeTypes[0].id, 'Andere codenaam'); }), 'schrijft');
await one('1589 de tweede A-taak wissen', cat, se(s => { s.deleteTask(leaves(s)[2].id); }), 'schrijft');
await one('1589 de laatste B-taak wissen', cat, se(s => { s.deleteTask(leaves(s)[1].id); }), 'schrijft');
await one('grens: onbekend definitieveld, alleen de projectbeschrijving', unknownField, beschrijving, 'schrijft');
await one('grens: onbekende baselinesleutel, alleen de projectbeschrijving', unknownKey, beschrijving, 'schrijft');
await one('grens: onbekende baselinesleutel, baseline erbij', unknownKey, se(s => { s.saveBaseline('Nieuwe baseline grens'); }), 'schrijft');

await one('1581 alle baselines wissen', eigen, se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); }), 'schrijft');
await one('1700 één baseline wissen', cat, se(s => { s.deleteBaseline(s.baselines[0].id); }), 'schrijft');
await one('1586 een taaktypedefinitie hernoemen (stap 4)', cat, d => { d.customTaskTypes![0].name = 'Hernoemd projecttype'; return d; }, 'weigert');
await one('1588 ongebruikte brondefinitie, alleen de projectbeschrijving', unused, beschrijving, 'weigert');
await one('1588 ongebruikte brondefinitie, nieuw type', unused, d => applyEdit(fixedCatalogEdits(d)[1], d), 'weigert');
// (a): een groep met een bronwaarde van (b) is niet gedragen, ook niet in zijn andere stukken; (c) toetst zo'n groep niet.
await one('niet gedragen: omschrijving op de codetemplates, alleen de projectbeschrijving', describedTemplates, beschrijving, 'schrijft');
await one('niet gedragen: omschrijving op de codetemplates, code hernoemen (1585)', describedTemplates, se(s => { s.renameActivityCodeType(s.activityCodeTypes[0].id, 'Hernoemde code'); }), 'weigert');
await one('grens: onbekend definitieveld, typegroei', unknownField, d => applyEdit(fixedCatalogEdits(d)[1], d), 'weigert');
await one('grens: onbekend definitieveld, taak met dat type wissen', unknownField, se(s => { s.deleteTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a').id); }), 'weigert');
await one('grens: onbekende baselinesleutel, een andere baseline wissen', unknownKey, se(s => { s.deleteBaseline(s.baselines[1].id); }), 'schrijft');
// (a′): bij het openen van een backup met een vreemd deel verdwijnt het herstelkenmerk (knownbug 1703); de toets weigert
// daar zoals main.
const backup = withWall(read('tests/planning/fixtures/backup-met-kenmerk.ifc'));
await one('backup met kenmerk + wand: projectbeschrijving (a′)', backup, beschrijving, 'weigert');
await one('backup met kenmerk + wand: taak hernoemen (a′)', backup, d => applyEdit(ordinaryEdits(d).find(e => e.kind === 'hernoemen')!, d), 'weigert');
// Buiten de eigen groepen: een vreemd lid in een per-taak-pset (r7sol), de volgorde in `IfcRelNests` en de kalender.
for (const file of ['r7sol-vreemd-lid-bij-notitie', 'r7sol-vreemd-lid-bij-toewijzing']) {
  const bytes = read(`tests/fixtures/ifc-foreign/council/${file}.ifc`);
  for (const kind of ['hernoemen', 'duur'] as const) {
    await one(`buiten de groepen: ${file}, ${kind}`, bytes, d => applyEdit(ordinaryEdits(d).find(e => e.kind === kind)!, d), 'weigert');
  }
}
{
  const merged = read('tests/planning/fixtures/ifc-arity-oude-writer-merged.ifc');
  await one('buiten de groepen: ifc-arity-oude-writer-merged, projectbeschrijving', merged, beschrijving, 'weigert');
  await one('buiten de groepen: ifc-arity-oude-writer-merged, hernoemen', merged, d => applyEdit(ordinaryEdits(d).find(e => e.kind === 'hernoemen')!, d), 'weigert');
}

// ── 1. De gevallen van 7c en 7d, op de eigen bron, het kantoorvoorbeeld met een wand en de oude eigen bron ──
{
  const taakBaseline = (d: Domain) => applyEdit(fixedSequenceEdits(d)[0], d);
  await one('7c eigen: taak → baseline', eigen, taakBaseline, 'schrijft');
  await one('7c eigen: baselines wissen → taak → nieuwe baseline', eigen, async d => taakBaseline(await se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); })(d)), 'schrijft');
  const met = await one('7c eigen: taak tussentijds opslaan', eigen, d => applyEdit(basicEdits(d).find(e => e.kind === 'taak-erbij')!, d), 'schrijft');
  if (met.o.ok) await one('7c eigen: heropenen → baseline', met.o.bytes, se(s => { s.saveBaseline('Na tussentijdse opslag'); }), 'schrijft');
  for (const i of [0, 1, 2, 3]) await one(`7c eigen: vaste reeks ${i}`, seq, d => applyEdit(fixedSequenceEdits(d)[i], d), 'schrijft');
}
for (const which of ['eigen', 'kantoor', 'oud'] as const) {
  const { saved, single } = prepared.get(which)!;
  for (const i of [0, 1, 2, 3]) await one(`7d ${which}: vaste bewerking ${i}`, i === 1 ? single : saved, d => applyEdit(fixedCatalogEdits(d)[i], d), 'schrijft');
  await one(`7d ${which}: code + nieuw type + nieuwe taak + typewissel`, single, async d => {
    for (const i of [0, 1]) d = await applyEdit(fixedCatalogEdits(d)[i], d);
    return se(s => {
      s.updateTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a').id, { customTaskTypeId: 'type-7d-c' });
      const id = s.addTask({ name: 'Nieuwe taak 7d' }, { phaseAssignments: 'move', answered: true });
      if (!id) throw new Error('7d: geen nieuwe taak');
      s.updateTask(id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7d-c' });
    })(d);
  }, 'schrijft');
  await one(`7d ${which}: actieve baseline uitzetten`, saved, se(s => { s.setActiveBaseline(null); }), 'schrijft');
  await one(`7d ${which}: baseline erbij en bestaande actief`, saved, se(s => { const id = s.baselines[0].id; s.saveBaseline('Nieuw 7d'); s.setActiveBaseline(id); }), 'schrijft');
  await one(`7d ${which}: type verliezen met andere getypeerde taken`, saved, se(s => {
    s.updateTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a').id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
  }), 'schrijft');
  await one(`7d ${which}: waarde bij bestaande codedefinitie`, saved, se(s => { s.addActivityCodeValue(s.activityCodeTypes[0].id, { code: 'EXTRA', description: 'Extra' }); }), 'schrijft');
  const second = await one(`7d ${which}: tweede code opslaan`, saved, d => applyEdit(fixedCatalogEdits(d)[0], d), 'schrijft');
  if (second.o.ok) await one(`7d ${which}: heropenen en derde code`, second.o.bytes, se(s => {
    const id = s.addActivityCodeType('Code C 7d'); s.addActivityCodeValue(id, { code: 'C', description: 'Derde waarde' });
  }), 'schrijft');
  await one(`7d ${which}: bestaande code aan andere taak`, saved, se(s => {
    const t = leaves(s).find((t: any) => !t.activityCodes?.[s.activityCodeTypes[0].id]);
    s.setTaskActivityCode(t.id, s.activityCodeTypes[0].id, s.activityCodeTypes[0].values[0].id);
  }), 'schrijft');
  await one(`7d ${which}: getypeerde taak hernoemen`, saved, se(s => { const t = s.tasks.find((t: any) => t.customTaskTypeId); s.updateTask(t.id, { name: `${t.name} hernoemd` }); }), 'schrijft');
}

// ── 1 en 4. De reeksen en de sessieketen, met een vaste en een lopende klok ──
async function series(which: Which) {
  const raw = RAW[which], { saved } = prepared.get(which)!;
  await one(`reeks ${which}: taak + baseline (bron)`, raw, se(s => { addTask(s, 'Reeks taak'); s.saveBaseline('Reeks baseline'); }), 'schrijft');
  await one(`reeks ${which}: taak + baseline (catalogus)`, saved, se(s => { addTask(s, 'Reeks taak'); s.saveBaseline('Reeks baseline'); }), 'schrijft');
  await one(`reeks ${which}: code hernoemen + toewijzen (catalogus)`, saved, se(s => {
    const c = s.activityCodeTypes[0]; s.renameActivityCodeType(c.id, 'Hernoemde code reeks');
    const t = leaves(s).find((t: any) => !t.activityCodes?.[c.id]); s.setTaskActivityCode(t.id, c.id, c.values[0].id);
  }), 'schrijft');
  await one(`reeks ${which}: code maken + toewijzen + hernoemen (bron)`, raw, se(s => {
    const c = s.addActivityCodeType('Reeks code'), v = s.addActivityCodeValue(c, { code: 'R', description: 'Reeks' });
    s.setTaskActivityCode(leaves(s)[0].id, c, v); s.renameActivityCodeType(c, 'Reeks code hernoemd');
  }), 'schrijft');
  for (const [where, bytes] of [['bron', raw], ['catalogus', saved]] as const) {
    await one(`reeks ${which}: type maken + geven + weghalen (${where})`, bytes, se(s => {
      s.ensureProjectTaskType({ id: 'type-reeks', name: 'Type reeks' });
      const t = leaves(s).find((t: any) => !t.customTaskTypeId); s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-reeks' });
      s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
    }), 'schrijft');
    await one(`reeks ${which}: baseline maken + wissen + maken (${where})`, bytes, se(s => {
      s.saveBaseline('Reeks X'); s.deleteBaseline(s.baselines.find((b: any) => b.name === 'Reeks X').id); s.saveBaseline('Reeks Y');
    }), 'schrijft');
  }
  await one(`reeks ${which}: oude baseline wissen + nieuwe maken (catalogus)`, saved, se(s => { s.deleteBaseline(s.baselines[0].id); s.saveBaseline('Reeks vervanger'); }), 'schrijft');
  await one(`reeks ${which}: alles wissen (catalogus)`, saved, se(deleteAll), 'schrijft');
  // Op `ifc-arity-oude-writer.ifc` heeft geen kop een StartTime; de writer schrijft er een, dus (b) zet `$` terug en de koppen
  // zijn in de bron niet gedragen. Dan beweegt een kop niet mee (E1): (c) toetst zo'n groep niet.
  await one(`reeks ${which}: alles wissen (bron)`, raw, se(deleteAll), which === 'arity' ? 'weigert' : 'schrijft');
  await reopenedChain(which, raw, [
    ['1 type, code en baseline maken', s => {
      s.ensureProjectTaskType({ id: 'type-k', name: 'Type keten' });
      for (const t of leaves(s).slice(0, 2)) s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-k' });
      const c = s.addActivityCodeType('Code keten'), v = s.addActivityCodeValue(c, { code: 'K', description: 'Keten' });
      s.setTaskActivityCode(leaves(s)[0].id, c, v); s.saveBaseline('Keten B1');
    }, 'schrijft'],
    ['2 code hernoemen, getypeerde taak wissen, baseline B2', s => {
      s.renameActivityCodeType(s.activityCodeTypes.find((c: any) => c.name === 'Code keten').id, 'Code keten hernoemd');
      s.deleteTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-k').id); s.saveBaseline('Keten B2');
    }, 'schrijft'],
    // Op het oude bestand is `OPS_Baselines` na stap 2 niet meer gedragen: de GlobalId van de baselinerij van de gewiste
    // taak verandert bij herlezen (knownbug 1702). Dan geldt de controle van main, en die kan een kop die wegvalt niet
    // verklaren.
    ['3 baseline B1 wissen, B2 actief, type aan nieuwe taak', s => {
      s.deleteBaseline(s.baselines.find((b: any) => b.name === 'Keten B1').id);
      s.setActiveBaseline(s.baselines.find((b: any) => b.name === 'Keten B2').id);
      const id = addTask(s, 'Keten nieuw'); s.updateTask(id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-k' });
    }, which === 'oud' ? 'weigert' : 'schrijft'],
    ['4 alles wissen', deleteAll, which === 'oud' ? 'weigert' : 'schrijft'],
    ['5 taak en baseline erbij', s => { addTask(s, 'Keten na wissen'); s.saveBaseline('Keten B3'); }, which === 'oud' ? 'weigert' : 'schrijft'],
  ]);
}
const SESSION: [string, (s: S) => void, Expect][] = [
  ['1 type, code en twee baselines maken', s => {
    s.ensureProjectTaskType({ id: 'type-s', name: 'Type sessie' });
    for (const t of leaves(s).slice(0, 2)) s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-s' });
    const c = s.addActivityCodeType('Code sessie'), v = s.addActivityCodeValue(c, { code: 'S', description: 'Sessie' });
    s.setTaskActivityCode(leaves(s)[0].id, c, v); s.saveBaseline('Sessie B1'); s.saveBaseline('Sessie B2');
  }, 'schrijft'],
  ['2 code hernoemen en aan een tweede taak', s => {
    const c = s.activityCodeTypes.find((c: any) => c.name === 'Code sessie'); s.renameActivityCodeType(c.id, 'Code sessie hernoemd');
    s.setTaskActivityCode(leaves(s)[1].id, c.id, c.values[0].id);
  }, 'schrijft'],
  ['3 een getypeerde taak wissen', s => { s.deleteTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-s').id); }, 'schrijft'],
  ['4 baseline B1 wissen en B2 actief', s => {
    s.deleteBaseline(s.baselines.find((b: any) => b.name === 'Sessie B1').id); s.setActiveBaseline(s.baselines.find((b: any) => b.name === 'Sessie B2').id);
  }, 'schrijft'],
  ['5 het type van de laatste taak weghalen', s => { for (const t of s.tasks.filter((t: any) => t.customTaskTypeId)) s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined }); }, 'schrijft'],
  ['6 code wissen', s => { for (const c of [...s.activityCodeTypes]) s.removeActivityCodeType(c.id); }, 'schrijft'],
  ['7 niets bewerken (opnieuw Ctrl+S)', () => {}, 'schrijft'],
];
for (const mode of ['vast', 'lopend'] as const) {
  clock.mode = mode;
  for (const which of mode === 'vast' ? ['eigen', 'kantoor', 'oud', 'arity'] as const : ['eigen', 'kantoor', 'oud'] as const) await series(which);
  for (const which of ['eigen', 'kantoor'] as const) await session(which, SOURCES[which], SESSION);
}
clock.mode = 'vast';

// ── 3. Een vreemd lid in een eigen pset: blijft staan waar de writer de pset schrijft ──
{
  const bl = withForeignMember(eigen, PSET.Baselines);
  const types = withForeignMember(seq, PSET.TaskTypes);
  const meta = withForeignMember(cat, PSET.StructureMeta);
  const kept = async (label: string, bytes: Uint8Array, pset: string, edit: Edit, expect: Expect) => {
    const { o } = await one(label, bytes, edit, expect);
    if (o.ok) ok(`${label}: het vreemde lid blijft staan`, foreignMemberKept(latin1(o.bytes), pset));
    return o;
  };
  const same = await kept('vreemd lid in OPS_Baselines: niets', bl, PSET.Baselines, d => d, 'schrijft');
  ok('vreemd lid in OPS_Baselines: niets bewerkt geeft de bronbytes terug', same.ok && sameBytes(same.bytes, bl));
  await kept('vreemd lid in OPS_Baselines: projectbeschrijving', bl, PSET.Baselines, beschrijving, 'schrijft');
  await kept('vreemd lid in OPS_Baselines: baseline erbij', bl, PSET.Baselines, se(s => s.saveBaseline('Met vreemd lid')), 'schrijft');
  await kept('vreemd lid in OPS_StructureMeta: tweede code', meta, PSET.StructureMeta, se(s => { const c = s.addActivityCodeType('Code met vreemd lid'); s.addActivityCodeValue(c, { code: 'V', description: 'V' }); }), 'schrijft');
  // Het laatste eigen lid valt weg: alleen het vreemde lid blijft in de pset over. Een groep met een vreemd lid is niet
  // gedragen (de writer schrijft dat lid niet): de controle van main weigert, zoals op de basis. Dan beweegt ook de
  // baselinekop niet mee (E1 eist een gedragen `OPS_Baselines`).
  await kept('vreemd lid in OPS_Baselines: alle baselines wissen', bl, PSET.Baselines, se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); }), 'weigert');
  await kept('vreemd lid in OPS_TaskTypes: type weghalen bij de laatste taak', types, PSET.TaskTypes, se(s => {
    const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-7c'); s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
  }), 'weigert');
  await kept('vreemd lid in OPS_StructureMeta: de laatste code wissen', meta, PSET.StructureMeta, se(s => { for (const c of [...s.activityCodeTypes]) s.removeActivityCodeType(c.id); }), 'weigert');
}

// ── 5. PR 12c: de baselinekop beweegt mee met zijn baseline (E1) ──
const parsedLines = (bytes: Uint8Array) => latin1(bytes).split('\n').map(l => parseOutLine(l.replace(/\r$/, ''))).filter((l): l is OutLine => !!l);
const isHead = (l: OutLine) => l.type === 'IFCWORKSCHEDULE' && l.args.some(a => a.trim() === '.BASELINE.');
/** De aggregatie van het eigen werkplan: de `IfcRelAggregates` met het `IfcWorkPlan` als geheel. */
const planAggregate = (ls: readonly OutLine[]) => {
  const plan = ls.find(l => l.type === 'IFCWORKPLAN')!;
  const agg = ls.find(l => l.type === 'IFCRELAGGREGATES' && l.args[4].trim() === `#${plan.id}`);
  assert(agg, 'aggregatie van het werkplan niet gevonden'); return agg;
};
const membersOf = (l: OutLine) => l.args[5].trim().slice(1, -1).split(',').map(x => x.trim());
const withMembers = (l: OutLine, m: readonly string[]): OutLine => ({ ...l, args: l.args.map((a, k) => k === 5 ? `(${m.join(',')})` : a) });
/** Vervang regels in de bytes (op id); de rest byte voor byte gelijk. */
function replaced(bytes: Uint8Array, changed: readonly OutLine[], extra: readonly string[] = []): Uint8Array {
  const byId = new Map(changed.map(l => [l.id, l]));
  const text = latin1(bytes).split('\n').map(t => {
    const l = parseOutLine(t.replace(/\r$/, ''));
    const c = l && byId.get(l.id);
    return c ? `#${c.id}=${c.type}(${c.args.join(',')});${t.endsWith('\r') ? '\r' : ''}` : t;
  }).join('\n');
  return bytesOf(extra.length ? withLines(text, extra) : text);
}
const wisEen = se(s => { s.deleteBaseline(s.baselines[0].id); });
const wisAlle = se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); });

// 1700 en 1581 op de drie bronnen (de catalogus van elk: de baselines van de bron plus twee, de laatste actief), en de
// baselinestappen.
for (const which of ['eigen', 'kantoor', 'oud'] as const) {
  const { saved } = prepared.get(which)!;
  await one(`kop ${which}: één bestaande baseline wissen (1700)`, saved, wisEen, 'schrijft');
  await one(`kop ${which}: de actieve baseline wissen (1700)`, saved, se(s => { s.deleteBaseline(s.activeBaselineId); }), 'schrijft');
  await one(`kop ${which}: alle baselines wissen (1581)`, saved, wisAlle, 'schrijft');
  await one(`kop ${which}: een baseline wissen en een nieuwe met dezelfde naam maken`, saved, se(s => {
    const b = s.baselines[0]; s.deleteBaseline(b.id); s.saveBaseline(b.name);
  }), 'schrijft');
  await one(`kop ${which}: actieve baseline wisselen, dan de oude actieve wissen`, saved, se(s => {
    const was = s.activeBaselineId; s.setActiveBaseline(s.baselines.find((b: any) => b.id !== was).id); s.deleteBaseline(was);
  }), 'schrijft');
  await one(`kop ${which}: actieve baseline wisselen, dan de nieuwe actieve wissen`, saved, se(s => {
    const next = s.baselines.find((b: any) => b.id !== s.activeBaselineId).id; s.setActiveBaseline(next); s.deleteBaseline(next);
  }), 'schrijft');
  await one(`kop ${which}: een baseline hernoemen`, saved, se(s => { s.renameBaseline(s.baselines[0].id, 'Hernoemde baseline'); }), 'schrijft');
  await reopenedChain(`kop ${which} vergelijking`, saved, [
    ['1 baseline C erbij, de eerste in de vergelijking', s => { s.saveBaseline('Baseline C kop'); s.toggleComparedBaseline(s.baselines[0].id); }, 'schrijft'],
    ['2 de vergeleken baseline wissen', s => { s.deleteBaseline(s.comparedBaselineIds.find((id: any) => id)); }, 'schrijft'],
  ]);
}
// Knownbug 1708: op `ifc-arity-oude-writer.ifc` (+ wand) verandert het openen `OPS_Baselines` in de ruwe vorm, niet in de
// bronvorm. Op dat bestand zelf beweegt de kop niet mee: (b) zet de lege StartTime van de koppen terug (hierboven). In een
// variant met de StartTime van de koppen zoals de writer hem schrijft (de baselines zelf blijven in hun oude vorm) valt
// `OPS_Baselines` met (a′) op de bronvorm onder de toets en beweegt de kop mee; met (a′) op de ruwe vorm gold de controle
// van main, en die verklaart een kop die wegvalt niet.
await one('arity: één baseline wissen (koppen niet gedragen)', arity, wisEen, 'weigert');
const arityKoppen = (() => {
  let n = 0;
  const text = latin1(arity).split('\n').map(t => {
    const l = parseOutLine(t.replace(/\r$/, ''));
    if (!l || !isHead(l) || l.args.length !== 15 || l.args[12].trim() !== '$') return t;
    n++;
    return `#${l.id}=${l.type}(${l.args.map((a, k) => k === 12 ? "'2027-05-07T07:00:00'" : a).join(',')});${t.endsWith('\r') ? '\r' : ''}`;
  }).join('\n');
  assert(n === 2, 'arity: twee koppen zonder StartTime');
  return bytesOf(text);
})();
await one('1708 arity met koppen in writervorm: projectbeschrijving', arityKoppen, beschrijving, 'schrijft');
await one('1708 arity met koppen in writervorm: één baseline wissen (a′ op de bronvorm)', arityKoppen, wisEen, 'schrijft');
await one('1708 arity met koppen in writervorm: alle baselines wissen (a′ op de bronvorm)', arityKoppen, wisAlle, 'schrijft');

// Wat moet blijven weigeren: de bronnen.
{
  const ls = parsedLines(cat), agg = planAggregate(ls), m = membersOf(agg);
  assert(m.length === 4 && m.slice(1).every(id => isHead(ls.find(l => `#${l.id}` === id)!)), 'catalogus: live schema en drie koppen');
  // Een lid van een ander programma in de aggregatie van het werkplan: de aggregatie is dan gemengd en blijft byte voor
  // byte staan; een kop die daaruit weg moet, weigert (`verwijderd`, fase 2).
  const vreemdLid = replaced(cat, [withMembers(agg, [m[0], '#95200', ...m.slice(1)])],
    ["#95200=IFCCOSTSCHEDULE('0R12CVREEMDSCHEMA00000',$,'Kosten van een ander programma',$,$,$,$,$,$,$);"]);
  await one('kop: vreemd lid in de werkplanaggregatie, projectbeschrijving', vreemdLid, beschrijving, 'schrijft');
  await one('kop: vreemd lid in de werkplanaggregatie, één baseline wissen', vreemdLid, wisEen, 'weigert');
  // Een andere volgorde van de leden (een ander programma schreef de aggregatie anders): de writer schrijft zijn eigen
  // volgorde, dus de leden zouden van plaats wisselen.
  const volgorde = replaced(cat, [withMembers(agg, [m[1], m[0], m[2]])]);
  await one('kop: aggregatie in een andere volgorde, één baseline wissen', volgorde, se(s => { s.deleteBaseline(s.baselines[1].id); }), 'weigert');
  // Een kop met een omschrijving van een ander programma: de lezer leest haar niet, (b) zet haar terug, dus de koppen zijn in
  // de bron niet gedragen.
  const head = ls.find(l => `#${l.id}` === m[2])!;
  const omschrijving = replaced(cat, [{ ...head, args: head.args.map((a, k) => k === 3 ? "'Omschrijving van een ander programma'" : a) }]);
  await one('kop: omschrijving van een ander programma op een kop, projectbeschrijving', omschrijving, beschrijving, 'schrijft');
  await one('kop: omschrijving van een ander programma op een kop, de andere baseline wissen', omschrijving, wisEen, 'weigert');
  // `OPS_Baselines` niet gedragen: een vreemd lid in de pset.
  const vreemdePset = withForeignMember(cat, PSET.Baselines);
  await one('kop: vreemd lid in OPS_Baselines, projectbeschrijving', vreemdePset, beschrijving, 'schrijft');
  await one('kop: vreemd lid in OPS_Baselines, één baseline wissen', vreemdePset, wisEen, 'weigert');
}

// Wat moet blijven weigeren: de verliescontrole zelf, op een nagebootste fout van de writer in O1 (`lossProbe`, met de
// andere toets en de kop aan, zoals `prepareIfcWrite`). De echte O1 slaagt; elke fout in de aggregatie weigert daar.
async function probe(label: string, bytes: Uint8Array, edit: Edit) {
  const { o, d } = await one(label, bytes, edit, 'schrijft');
  assert(o.ok, `${label}: basis voor de verliesproef schrijft`);
  const p = await lossProbe(bytes, d, o.bytes, true);
  ok(`verliesproef ${label}: de echte O1 slaagt`, p.run(p.o1).length === 0);
  const agg = planAggregate(p.o1), chunk = p.index.chunkOf(String(agg.id));
  const refuses = (what: string, lines: OutLine[], edited?: Domain) => {
    const found = p.run(lines, edited);
    console.log(`VERLIESPROEF ${label}: ${what}: ${found.length ? `geweigerd op ${found.map(c => `${p.index.type(c)} #${p.index.id(c)}`).join(', ')}` : 'LAAT DOOR'}`);
    ok(`verliesproef ${label}: ${what} weigert op de aggregatie`, found.includes(chunk));
  };
  const swap = (f: (m: string[]) => string[]) => p.o1.map(l => l === agg ? withMembers(l, f(membersOf(l))) : l);
  return { p, agg, refuses, swap };
}
{
  const { p, agg, refuses, swap } = await probe('kop: één baseline wissen', cat, wisEen);
  const m = membersOf(agg);
  assert(m.length === 3, 'na wissen: live schema en twee koppen');
  refuses('het live schema valt weg', swap(x => x.slice(1)));
  refuses('een ander lid erbij (een bouwdeel)', swap(x => [...x, `#${p.o1.find(l => l.type === 'IFCBUILDING' || l.type === 'IFCWALL')?.id ?? p.o1.find(l => l.type === 'IFCPROJECT')!.id}`]));
  refuses('de leden wisselen van plaats', swap(x => [...x].reverse()));
  refuses('de kop van de blijvende baseline valt weg', swap(x => x.filter(id => !isHead(p.o1.find(l => `#${l.id}` === id)!))));
  const other = p.o1.find(l => l.type === 'IFCRELAGGREGATES' && l !== agg);
  if (other) {
    const head = m.find(id => isHead(p.o1.find(l => `#${l.id}` === id)!))!;
    refuses('de kop verhuist naar een andere aggregatie', p.o1.map(l => l === agg ? withMembers(l, m.filter(id => id !== head))
      : l === other ? withMembers(l, [...membersOf(l), head]) : l));
  }
}
{
  const { p, agg, refuses } = await probe('kop: projectbeschrijving', cat, beschrijving);
  const m = membersOf(agg), head = m[2];
  refuses('een kop valt weg zonder dat de planner een baseline wiste', p.o1.filter(l => `#${l.id}` !== head)
    .map(l => l === agg ? withMembers(l, m.filter(id => id !== head)) : l));
}
{
  // `OPS_Baselines` niet gedragen (een vreemd lid in de pset): dan beweegt geen kop mee. Bij een echte opslag weigert de
  // controle van main dan al op het JSON van de gewiste baseline; hier valt alleen de kop weg en blijft het JSON staan
  // (een nagebootste fout van de writer), zodat alleen deze voorwaarde de weigering draagt.
  const { p, agg, refuses } = await probe('kop: vreemd lid in OPS_Baselines, projectbeschrijving', withForeignMember(cat, PSET.Baselines), beschrijving);
  const m = membersOf(agg), head = m[1];
  const deleted = await wisEen(cloneDomain(p.opened));
  refuses('niet gedragen: de kop van een gewiste baseline valt weg, het JSON niet', p.o1.filter(l => `#${l.id}` !== head)
    .map(l => l === agg ? withMembers(l, m.filter(id => id !== head)) : l), deleted);
}
{
  // Welke kop bij welke baseline hoort, ziet de verliescontrole niet: zij telt de koppen die wegvallen. Staat na het wissen
  // van baseline A de kop van A er nog en die van een blijvende baseline niet (een nagebootste fout van de writer), dan laat
  // zij dat door; controle (c) vangt het op de echte uitvoer (`check-ifc-foreign-eigen-uitvoer.ts`, "een kop verwisseld").
  const { p, agg } = await probe('kop: één baseline wissen (verwisselde kop)', cat, wisEen);
  const source = parsedLines(cat), sourceAgg = planAggregate(source);
  const goneId = membersOf(sourceAgg).find(id => !membersOf(agg).includes(id))!, gone = source.find(l => `#${l.id}` === goneId)!;
  const keptHead = membersOf(agg).find(id => isHead(p.o1.find(l => `#${l.id}` === id)!))!;
  const swapped = [...p.o1.filter(l => `#${l.id}` !== keptHead).map(l => l === agg ? withMembers(l, membersOf(sourceAgg).filter(id => id !== keptHead)) : l), gone];
  const found = p.run(swapped);
  console.log(`VERLIESPROEF verwisselde kop: ${found.length ? 'geweigerd' : 'laat door'} (bekend: alleen (c) toetst welke kop bij welke baseline hoort)`);
  ok('verliesproef: een verwisselde kop laat de verliescontrole door (alleen (c) vangt hem)', found.length === 0);
}

finish();
