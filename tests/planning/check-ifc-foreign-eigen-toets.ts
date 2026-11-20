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
// 2. Wat blijft weigeren: 1588 en een onbekend definitieveld (de groep is niet gedragen; een typedefinitie hernoemen
//    schrijft sinds PR 12d, blok 6), de backup met herstelkenmerk (a′, knownbug 1703), en alles buiten de eigen groepen (de r7sol-bestanden, de
//    volgorde in `IfcRelNests`).
// 3. Een vreemd lid in een eigen pset: het blijft staan, ook als het laatste eigen lid wegvalt (stap 5 deel 1, was knownbug 1707).
// 4. De klok: de reeksen en de sessieketen ook met een lopende klok.
// 5. PR 12c, de baselinekop (E1): een kop in de aggregatie van het werkplan beweegt mee met zijn baseline (1581, 1700, de
//    baselinestappen van de reeksen en de sessieketen); de rest van die aggregatie blijft exact en in volgorde, ook in de
//    verliescontrole zelf op een nagebootste fout van de writer (`lossProbe`); en wat moet blijven weigeren. Daarin ook de
//    proef van knownbug 1708: (a′) op de bronvorm schrijft op `ifc-arity-oude-writer.ifc` waar de ruwe vorm zou weigeren.
// 6. PR 12d, de typenaam op de taak (E2): hernoemt de planner een eigen taaktype, dan beweegt `ObjectType` (slot 4) van elke
//    taak met dat type mee (1586), op drie bronnen, samen met andere bewerkingen, in een keten en in een sessie met een vaste
//    en een lopende klok; wat moet blijven weigeren; en de verliescontrole zelf op een nagebootste fout van de writer.
//    Het hernoemen van een projecttype is hier domeininvoer; in de app loopt het sinds #804 keuze 7 via `renameProjectTaskType`.
// 7. PR 12e, de weesrij (knownbug 1702): de rij van een gewiste taak in een baseline houdt haar taak-id en GlobalId over
//    opslaan en heropenen, en `OPS_Baselines` blijft daarna gedragen; daardoor schrijft de keten op het oude bestand nu ook
//    de stappen na "taak wissen". Op de oude showcase houdt de weesrij haar GlobalId (haar taak-id wordt één keer de interne
//    id uit de bron, knownbug 1770), en blijft `OPS_Baselines` niet gedragen, zoals op het onbewerkte bestand.
// 8. Stap 5 deel 1 (was knownbug 1707): na "het laatste eigen lid weg" heropenen, zonder bewerking (dezelfde bytes) en met de
//    handeling andersom (het vreemde lid weer in de eigen pset); het vreemde lid niet achteraan in de ledenlijst (weigert,
//    zoals op de basis); een vreemde `Creators`-verwijzing in een kop.
// 9. Stap 5, PR A: de toets en (c) per slot. Een omschrijving van een ander programma op een eigen pset (die zet (b) terug),
//    dan de gewone handeling: schrijft en is heel, (c) toetst precies dat ene slot niet, en de verliescontrole laat in die groep
//    geen verschil meer door een oude verklaring gaan. Daarna de slotgevallen: twee slots in één groep, een slot in een
//    andere groep, een kop, een typenaam, en wat niet eenduidig aan te wijzen is.
import assert from 'node:assert/strict';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { parseOutLine, type OutLine } from '@/services/ifc/foreign/lossCheck';
import { PROP, PSET, ifcJson } from '@/services/ifc/ifcPsets';
import type { RestoredOwnSlots } from '@/services/ifc/foreign/ownGroups';
import { decodeStepText } from '@/services/ifc/stepText';
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import {
  applyEdit, basicEdits, canon, cloneDomain, fixedCatalogEdits, fixedSequenceEdits, lossProbe, mergeProblems, openForeign, ordinaryEdits,
  reopenPlain, sameBytes, savedCatalogStart, savedSequenceStart, shownAfterOpen, type Domain,
} from './ifcMergeKern';
import {
  DESCRIPTION, SOURCES, addTask, bytesOf, clock, deleteAll, finish, foreignMemberKept, idsAt, latin1, leaves, linesOfBytes, ok,
  propertyDescriptionPlace, psetDescriptionPlace, read, save, se, summary, withForeignMember, withLabelOnUntypedTask, withLines,
  withPropertyDescription, withPsetDescription, withWall, type Outcome, type S,
} from './ifcEigenKern';

type Expect = 'schrijft' | 'weigert';
type Edit = (d: Domain) => Promise<Domain> | Domain;
/** Eén stap van een keten of sessie: een plannerhandeling in de store, of een bewerking van het domein (zoals een eigen
 *  taaktype van het project hernoemen, knownbug 1586; de store kan dat sinds #804 keuze 7 ook, via `renameProjectTaskType`). */
type Step = ((s: S) => void) | { readonly domain: Edit };
const runStep = (f: Step, d: Domain): Promise<Domain> => typeof f === 'function' ? se(f)(d) : Promise.resolve(f.domain(d));

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
async function reopenedChain(tag: string, bytes: Uint8Array, steps: readonly [string, Step, Expect][],
  after?: (label: string, before: Uint8Array, written: Uint8Array) => Promise<void>) {
  nextCase();
  for (const [label, f, expect] of steps) {
    clock.start();
    const opened = await openForeign(bytes);
    const d = await applied(`keten ${tag}: stap ${label}`, () => runStep(f, cloneDomain(opened)));
    if (!d) continue;
    const o = await attempt(`keten ${tag}: stap ${label}`, bytes, opened.ifcSource!, d, expect);
    if (!o.ok) continue;
    await after?.(label, bytes, o.bytes);
    bytes = o.bytes;
  }
}
/**
 * De sessieketen Opslaan als → verder werken → Ctrl+S, zonder heropenen: na een geslaagde opslag geldt de geschreven versie
 * als bron (`prepared.source`, zoals `fileSlice`), en de volgende bewerking gaat verder op hetzelfde domein. Weigert een
 * stap, dan gaat de sessie verder zonder die stap.
 */
async function session(tag: string, raw: Uint8Array, steps: readonly [string, Step, Expect][]) {
  nextCase();
  const opened = await openForeign(raw);
  let source = opened.ifcSource!, d: Domain = cloneDomain(opened);
  for (const [label, f, expect] of steps) {
    const next = await applied(`sessie ${tag}: stap ${label}`, () => runStep(f, typeof f === 'function' ? d : structuredClone(d)));
    if (!next) continue;
    const o = await attempt(`sessie ${tag}: stap ${label}`, raw, source, next, expect);
    if (!o.ok) continue;
    if (label.includes('niets bewerken')) ok(`${clock.mode} sessie ${tag}: niets bewerkt geeft de vorige uitvoer terug`, sameBytes(o.bytes, source.bytes));
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
await one('1586 een taaktypedefinitie hernoemen (stap 4)', cat, d => { d.customTaskTypes![0].name = 'Hernoemd projecttype'; return d; }, 'schrijft');
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
/**
 * De keten over opslaan en heropenen (ook in blok 7, op de oude showcase). Tot PR 12e was `OPS_Baselines` op het oude
 * bestand na stap 2 niet meer gedragen: de GlobalId van de baselinerij van de gewiste taak veranderde bij herlezen (knownbug
 * 1702), en dan weigerden de stappen 3 tot en met 5. De merge houdt die GlobalId nu (`withOrphanRowGuids`); blok 7 meet het.
 */
const CHAIN: [string, Step, Expect][] = [
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
  ['3 baseline B1 wissen, B2 actief, type aan nieuwe taak', s => {
    s.deleteBaseline(s.baselines.find((b: any) => b.name === 'Keten B1').id);
    s.setActiveBaseline(s.baselines.find((b: any) => b.name === 'Keten B2').id);
    const id = addTask(s, 'Keten nieuw'); s.updateTask(id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-k' });
  }, 'schrijft'],
  ['4 alles wissen', deleteAll, 'schrijft'],
  ['5 taak en baseline erbij', s => { addTask(s, 'Keten na wissen'); s.saveBaseline('Keten B3'); }, 'schrijft'],
];
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
  await reopenedChain(which, raw, CHAIN);
}
const SESSION: [string, Step, Expect][] = [
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
const linesOf = (text: string) => text.split('\n').map(l => parseOutLine(l.replace(/\r$/, ''))).filter((l): l is OutLine => !!l);
/**
 * Na "het laatste eigen lid weg": de uitvoer heeft precies één pset `pset`, met alleen het vreemde lid `#95000`, met de
 * GlobalId van de pset uit de bron, en een `IfcRelDefinesByProperties` met de GlobalId van de bronrelatie op hetzelfde
 * object (op GlobalId). Leeg: zo is het; anders wat er anders is.
 */
function onlyForeignMember(out: string, source: string, pset: string): string {
  const named = (ls: OutLine[]) => ls.filter(l => l.type === 'IFCPROPERTYSET' && l.args[2] === `'${pset}'`);
  const relOf = (ls: OutLine[], p: OutLine) => ls.find(l => l.type === 'IFCRELDEFINESBYPROPERTIES' && l.args[5].trim() === `#${p.id}`);
  const guidOf = (ls: OutLine[], ref: string) => ls.find(l => `#${l.id}` === ref.trim())?.args[0];
  const src = linesOf(source), dst = linesOf(out);
  const sp = named(src).find(l => /[(,]#95000[,)]/.test(l.args[4])), ps = named(dst);
  if (!sp) return 'bron: geen pset met het vreemde lid';
  if (ps.length !== 1) return `${ps.length} psets ${pset} in de uitvoer`;
  const [p] = ps, sr = relOf(src, sp), r = relOf(dst, p);
  if (p.args[4].trim() !== '(#95000)') return `leden ${p.args[4]}`;
  if (p.args[0] !== sp.args[0]) return `GlobalId van de pset ${p.args[0]} in plaats van ${sp.args[0]}`;
  if (!sr || !r) return 'geen relatie bij de pset';
  if (r.args[0] !== sr.args[0]) return `GlobalId van de relatie ${r.args[0]} in plaats van ${sr.args[0]}`;
  if (guidOf(dst, r.args[4].slice(1, -1)) !== guidOf(src, sr.args[4].slice(1, -1))) return `ander object: ${r.args[4]}`;
  return '';
}
/** De uitvoer van elk geval "het laatste eigen lid weg", voor de vervolgstap in blok 8. */
const lastOwnGoneOutputs: { label: string; bytes: Uint8Array; pset: string; reverse: Edit }[] = [];
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
  // Het laatste eigen lid valt weg (was knownbug 1707, stap 5 deel 1): een vreemd lid maakt een groep niet meer ongedragen;
  // (a) is alleen nog "geen stuk had (b) nodig". De writer schrijft de pset niet meer, en de merge zet een pset met alleen
  // het vreemde lid neer, met de GlobalIds van de bron (`extraPsets` in `mergeWriter.ts`, zoals bij een notitie per taak).
  // De vervolgstap op de uitvoer (heropenen en de handeling andersom) staat in blok 8.
  const lastOwnGone = async (label: string, bytes: Uint8Array, pset: string, edit: Edit, reverse: Edit) => {
    const o = await kept(label, bytes, pset, edit, 'schrijft');
    if (!o.ok) return;
    const only = onlyForeignMember(latin1(o.bytes), latin1(bytes), pset);
    ok(`${label}: een pset ${pset} met alleen het vreemde lid, met de GlobalIds van de bron`, only === '', only);
    lastOwnGoneOutputs.push({ label, bytes: o.bytes, pset, reverse });
  };
  await lastOwnGone('vreemd lid in OPS_Baselines: alle baselines wissen', bl, PSET.Baselines, se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); }),
    se(s => { s.saveBaseline('Baseline terug na wissen'); }));
  await lastOwnGone('vreemd lid in OPS_TaskTypes: type weghalen bij de laatste taak', types, PSET.TaskTypes, se(s => {
    const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-7c'); s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
  }), se(s => {
    s.ensureProjectTaskType({ id: 'type-terug', name: 'Type terug na weghalen' });
    s.updateTask(leaves(s)[0].id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-terug' });
  }));
  await lastOwnGone('vreemd lid in OPS_StructureMeta: de laatste code wissen', meta, PSET.StructureMeta, se(s => { for (const c of [...s.activityCodeTypes]) s.removeActivityCodeType(c.id); }),
    se(s => { const c = s.addActivityCodeType('Code terug na wissen'), v = s.addActivityCodeValue(c, { code: 'T', description: 'Terug' }); s.setTaskActivityCode(leaves(s)[0].id, c, v); }));
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
  // Een vreemd lid in `OPS_Baselines` maakt de groep niet meer ongedragen (stap 5 deel 1, was knownbug 1707): de kop beweegt
  // mee, en het vreemde lid blijft in de pset.
  const vreemdePset = withForeignMember(cat, PSET.Baselines);
  await one('kop: vreemd lid in OPS_Baselines, projectbeschrijving', vreemdePset, beschrijving, 'schrijft');
  const een = await one('kop: vreemd lid in OPS_Baselines, één baseline wissen', vreemdePset, wisEen, 'schrijft');
  if (een.o.ok) ok('kop: vreemd lid in OPS_Baselines, één baseline wissen: het vreemde lid blijft staan', foreignMemberKept(latin1(een.o.bytes), PSET.Baselines));
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
  // De koppen niet gedragen (een omschrijving van een ander programma op een kop: (b) zet haar terug): dan beweegt geen kop
  // mee. Bij een echte opslag weigert "één baseline wissen" dan al (hierboven); hier valt alleen de kop van de gewiste
  // baseline weg en blijft het JSON staan (een nagebootste fout van de writer), zodat alleen deze voorwaarde de weigering
  // draagt. Tot stap 5 deel 1 stond deze proef op een vreemd lid in `OPS_Baselines`; dat maakt de groep niet meer ongedragen.
  // `lossProbe` neemt de bron als O0, en dan zet (b) niets terug; de proef geeft daarom een O0 in de vorm van de writer
  // mee (de bron zonder de omschrijving, zoals de writer de kop schrijft). Met de bron als O0 beweegt de kop wel mee: dat
  // is de tegenhanger, en zo draagt de herstelde omschrijving de weigering.
  const ls = parsedLines(cat), m0 = membersOf(planAggregate(ls)), described = ls.find(l => `#${l.id}` === m0[2])!;
  const omschrijving = replaced(cat, [{ ...described, args: described.args.map((a, k) => k === 3 ? "'Omschrijving van een ander programma'" : a) }]);
  const { p, agg } = await probe('kop: omschrijving van een ander programma op een kop, projectbeschrijving (verliesproef)', omschrijving, beschrijving);
  const writerO0 = ls, chunk = p.index.chunkOf(String(agg.id));
  ok('verliesproef kop niet gedragen: met O0 in de vorm van de writer slaagt de echte O1', p.run(p.o1, undefined, writerO0).length === 0);
  const m = membersOf(agg), head = m[1];
  // Het domein van O1 (de projectbeschrijving) plus de gewiste baseline: dan is de kop het enige verschil zonder bewerking.
  const deleted = await wisEen(await beschrijving(cloneDomain(p.opened)));
  const lines = p.o1.filter(l => `#${l.id}` !== head).map(l => l === agg ? withMembers(l, m.filter(id => id !== head)) : l);
  const where = (found: number[]) => found.length ? `geweigerd op ${found.map(c => `${p.index.type(c)} #${p.index.id(c)}`).join(', ')}` : 'LAAT DOOR';
  const notCarried = p.run(lines, deleted, writerO0), carried = p.run(lines, deleted);
  console.log(`VERLIESPROEF kop niet gedragen: de kop van een gewiste baseline valt weg, het JSON niet: O0 in writervorm ${where(notCarried)}; O0 = bron ${where(carried)}`);
  ok('verliesproef kop niet gedragen: de kop van een gewiste baseline valt weg, het JSON niet: weigert op de aggregatie', notCarried.includes(chunk));
  ok('verliesproef kop niet gedragen: tegenhanger met de bron als O0 (niets hersteld): de kop beweegt mee', !carried.includes(chunk));
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

// ── 6. PR 12d: de typenaam op de taak beweegt mee met de definitie (E2) ──
// De catalogus van elke bron: type A (`type-7d-a`, 'Type 0 7d') op twee taken, type B (`type-7d-b`, 'Type 1 7d') op één.
/** Een eigen taaktype van het project hernoemen, als domeininvoer (in de app sinds #804 keuze 7 via `renameProjectTaskType`).
 *  Gooit een `TypeError` als het type er niet is (dan is de stap niet van toepassing). */
const renameType = (id: string, name: string): Edit => d => {
  const t = d.customTaskTypes?.find(x => x.id === id);
  if (!t) throw new TypeError(`geen taaktype ${id}`);
  t.name = name; return d;
};
const then = (...edits: Edit[]): Edit => async d => { for (const e of edits) d = await e(d); return d; };
const hernoemA = renameType('type-7d-a', 'Hernoemd type A');
for (const which of ['eigen', 'kantoor', 'oud'] as const) {
  const { saved } = prepared.get(which)!;
  await one(`typenaam ${which}: type A hernoemen, twee taken (1586)`, saved, hernoemA, 'schrijft');
  await one(`typenaam ${which}: type B hernoemen, één taak (1586)`, saved, renameType('type-7d-b', 'Hernoemd type B'), 'schrijft');
  await one(`typenaam ${which}: beide typen hernoemen`, saved, then(hernoemA, renameType('type-7d-b', 'Hernoemd type B')), 'schrijft');
  await one(`typenaam ${which}: hernoemen met een apostrof en een #`, saved, renameType('type-7d-a', "Type O'Brien #804"), 'schrijft');
  await one(`typenaam ${which}: hernoemen en weer terug`, saved, then(hernoemA, renameType('type-7d-a', 'Type 0 7d')), 'schrijft');
  await one(`typenaam ${which}: hernoemen en een A-taak hernoemen`, saved, then(hernoemA, se(s => {
    const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a'); s.updateTask(t.id, { name: `${t.name} hernoemd` });
  })), 'schrijft');
  await one(`typenaam ${which}: hernoemen en een duur wijzigen`, saved, then(hernoemA, d => applyEdit(ordinaryEdits(d).find(e => e.kind === 'duur')!, d)), 'schrijft');
  await one(`typenaam ${which}: hernoemen en type A aan een nieuwe taak`, saved, then(hernoemA, se(s => {
    const id = addTask(s, 'Nieuwe taak typenaam'); s.updateTask(id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7d-a' });
  })), 'schrijft');
  await one(`typenaam ${which}: hernoemen en een A-taak wisselt naar B`, saved, then(hernoemA, se(s => {
    s.updateTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a').id, { customTaskTypeId: 'type-7d-b' });
  })), 'schrijft');
  await one(`typenaam ${which}: hernoemen en het type weghalen bij een A-taak`, saved, then(hernoemA, se(s => {
    s.updateTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a').id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
  })), 'schrijft');
  await one(`typenaam ${which}: hernoemen en een nieuw type maken en toewijzen`, saved, then(hernoemA, se(s => {
    s.ensureProjectTaskType({ id: 'type-12d', name: 'Nieuw type 12d' });
    s.updateTask(leaves(s).find((t: any) => !t.customTaskTypeId).id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-12d' });
  })), 'schrijft');
  await one(`typenaam ${which}: hernoemen en de B-taak wissen`, saved, then(hernoemA, se(s => {
    s.deleteTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-b').id);
  })), 'schrijft');
  await one(`typenaam ${which}: hernoemen en een baseline wissen`, saved, then(hernoemA, wisEen), 'schrijft');
  // Twee typen met dezelfde naam leest de lezer niet terug (hij laat de tweede vallen): dat mag niet schrijven.
  await one(`typenaam ${which}: A krijgt de naam van B (botsing)`, saved, renameType('type-7d-a', 'Type 1 7d'), 'weigert');
  await reopenedChain(`typenaam ${which}`, saved, [
    ['1 type A hernoemen', { domain: hernoemA }, 'schrijft'],
    ['2 een A-taak hernoemen', s => { const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a'); s.updateTask(t.id, { name: `${t.name} keten` }); }, 'schrijft'],
    ['3 opnieuw hernoemen en A aan een nieuwe taak', { domain: then(renameType('type-7d-a', 'Type A keten'), se(s => {
      const id = addTask(s, 'Keten typenaam'); s.updateTask(id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-7d-a' });
    })) }, 'schrijft'],
    ['4 het type weghalen bij alle A-taken', s => {
      for (const t of s.tasks.filter((t: any) => t.customTaskTypeId === 'type-7d-a')) s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
    }, 'schrijft'],
  ]);
}
const TYPE_SESSION: [string, Step, Expect][] = [
  ['1 een type maken en aan twee taken geven', s => {
    s.ensureProjectTaskType({ id: 'type-st', name: 'Type sessie typenaam' });
    for (const t of leaves(s).slice(0, 2)) s.updateTask(t.id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-st' });
  }, 'schrijft'],
  ['2 het type hernoemen', { domain: renameType('type-st', 'Type sessie hernoemd') }, 'schrijft'],
  ['3 een taak met dat type hernoemen', s => { const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-st'); s.updateTask(t.id, { name: `${t.name} sessie` }); }, 'schrijft'],
  ['4 opnieuw hernoemen en een taak verliest het type', { domain: then(renameType('type-st', 'Type sessie twee keer'), se(s => {
    s.updateTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-st').id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
  })) }, 'schrijft'],
  ['5 niets bewerken (opnieuw Ctrl+S)', () => {}, 'schrijft'],
];
for (const mode of ['vast', 'lopend'] as const) {
  clock.mode = mode;
  for (const which of ['eigen', 'kantoor'] as const) await session(`typenaam ${which}`, SOURCES[which], TYPE_SESSION);
}
clock.mode = 'vast';

// Wat moet blijven weigeren: `OPS_TaskTypes` niet gedragen (1588, een onbekend definitieveld), en een
// typenaam die de herleestoets (b) terugzet (dan beweegt de typenaam niet mee: (c) toetst die groep niet).
await one('typenaam: 1588 ongebruikte brondefinitie, type A hernoemen', unused, hernoemA, 'weigert');
await one('typenaam: onbekend definitieveld, dat type hernoemen', unknownField, hernoemA, 'weigert');
{
  // Een vreemd lid in `OPS_TaskTypes` maakt de groep niet meer ongedragen (stap 5 deel 1): de typenaam beweegt mee.
  const r = await one('typenaam: vreemd lid in OPS_TaskTypes, type A hernoemen', withForeignMember(cat, PSET.TaskTypes), hernoemA, 'schrijft');
  if (r.o.ok) ok('typenaam: vreemd lid in OPS_TaskTypes, type A hernoemen: het vreemde lid blijft staan', foreignMemberKept(latin1(r.o.bytes), PSET.TaskTypes));
}
const labelZonderType = withLabelOnUntypedTask(cat, 'Type 0 7d');
await one('typenaam: typenaam op een taak zonder type (b), projectbeschrijving', labelZonderType, beschrijving, 'schrijft');
await one('typenaam: typenaam op een taak zonder type (b), type A hernoemen', labelZonderType, hernoemA, 'weigert');

// De verliescontrole zelf, op een nagebootste fout van de writer in O1 (`lossProbe`, met de toets aan). De echte O1 van
// "type A hernoemen" slaagt; elke andere fout op de taakregel weigert daar.
const taskLines = (ls: readonly OutLine[], typeName: string) => ls.filter(l => l.type === 'IFCTASK' && l.args[4].trim() === `'${typeName}'`);
const setSlot = (ls: readonly OutLine[], target: OutLine, k: number, v: string) => ls.map(l => l === target ? { ...l, args: l.args.map((a, i) => i === k ? v : a) } : l);
{
  const { o, d } = await one('typenaam: verliesproef, type A hernoemen', cat, hernoemA, 'schrijft');
  assert(o.ok, 'verliesproef typenaam: de opslag schrijft');
  const p = await lossProbe(cat, d, o.bytes, true);
  ok('verliesproef typenaam: de echte O1 slaagt', p.run(p.o1).length === 0);
  const [a1] = taskLines(p.o1, 'Hernoemd type A'), chunk = p.index.chunkOf(String(a1.id));
  const refuses = (what: string, lines: OutLine[], edited?: Domain, at = chunk) => {
    const found = p.run(lines, edited);
    console.log(`VERLIESPROEF typenaam: ${what}: ${found.length ? `geweigerd op ${found.map(c => `${p.index.type(c)} #${p.index.id(c)}`).join(', ')}` : 'LAAT DOOR'}`);
    ok(`verliesproef typenaam: ${what} weigert op de taak`, found.includes(at));
  };
  refuses('een ander slot van een A-taak verandert (naam)', setSlot(p.o1, a1, 2, "'Verkeerde taaknaam'"));
  refuses('een ander slot van een A-taak verandert (omschrijving)', setSlot(p.o1, a1, 3, "'Verkeerde omschrijving'"));
  refuses('PredefinedType van een A-taak .USERDEFINED. → .NOTDEFINED.', setSlot(p.o1, a1, 12, '.NOTDEFINED.'));
  const plain = p.o1.find(l => l.type === 'IFCTASK' && l.args[4].trim() === '$')!;
  refuses('een typenaam op een taak zonder eigen type', setSlot(p.o1, plain, 4, "'Hernoemd type A'"), undefined, p.index.chunkOf(String(plain.id)));
  const b1 = taskLines(p.o1, 'Type 1 7d')[0];
  refuses('de B-taak krijgt de nieuwe naam van A', setSlot(p.o1, b1, 4, "'Hernoemd type A'"), undefined, p.index.chunkOf(String(b1.id)));
}
{
  // Geen hernoeming: dan verandert geen typenaam. Hier verandert alleen de projectbeschrijving, en staat in O1 toch een
  // andere naam op een A-taak.
  const { o, d } = await one('typenaam: verliesproef, projectbeschrijving', cat, beschrijving, 'schrijft');
  assert(o.ok, 'verliesproef typenaam: de opslag schrijft');
  const p = await lossProbe(cat, d, o.bytes, true);
  const [a1] = taskLines(p.o1, 'Type 0 7d');
  const found = p.run(setSlot(p.o1, a1, 4, "'Hernoemd type A'"));
  console.log(`VERLIESPROEF typenaam: zonder hernoeming verandert een typenaam: ${found.length ? 'geweigerd' : 'LAAT DOOR'}`);
  ok('verliesproef typenaam: zonder hernoeming verandert een typenaam: weigert op de taak', found.includes(p.index.chunkOf(String(a1.id))));
}
{
  // De typenaam niet gedragen (een typenaam op een taak zonder type: (b) zet hem terug): dan beweegt geen typenaam mee. Een
  // echte hernoeming weigert dan al (hierboven); hier verandert in O1 alleen de typenaam van de A-taken (een nagebootste fout
  // van de writer), bij een domein waarin het type wel hernoemd is, zodat alleen deze voorwaarde de weigering draagt. Tot
  // stap 5 deel 1 stond deze proef op een vreemd lid in `OPS_TaskTypes`; dat maakt de groep niet meer ongedragen. Zoals bij
  // de kop: `lossProbe` neemt de bron als O0 (dan zet (b) niets terug), dus de proef geeft een O0 in de vorm van de writer
  // mee (de bron zonder die typenaam), met de bron als O0 als tegenhanger.
  const { o, d } = await one('typenaam: verliesproef, typenaam op een taak zonder type (b), projectbeschrijving', labelZonderType, beschrijving, 'schrijft');
  assert(o.ok, 'verliesproef typenaam: de opslag schrijft');
  const p = await lossProbe(labelZonderType, d, o.bytes, true);
  const writerO0 = parsedLines(cat);
  ok('verliesproef typenaam niet gedragen: met O0 in de vorm van de writer slaagt de echte O1', p.run(p.o1, undefined, writerO0).length === 0);
  const lines = taskLines(p.o1, 'Type 0 7d').filter(l => l.args[12]?.trim() === '.USERDEFINED.');
  assert(lines.length === 2, 'verliesproef typenaam: twee A-taken');
  const mutated = p.o1.map(l => lines.includes(l) ? { ...l, args: l.args.map((a, i) => i === 4 ? "'Hernoemd type A'" : a) } : l);
  const renamed = await hernoemA(structuredClone(d)), chunk = p.index.chunkOf(String(lines[0].id));
  const where = (found: number[]) => found.length ? `geweigerd op ${found.map(c => `${p.index.type(c)} #${p.index.id(c)}`).join(', ')}` : 'LAAT DOOR';
  const notCarried = p.run(mutated, renamed, writerO0), carried = p.run(mutated, renamed);
  console.log(`VERLIESPROEF typenaam: niet gedragen, de typenaam beweegt zonder JSON: O0 in writervorm ${where(notCarried)}; O0 = bron ${where(carried)}`);
  ok('verliesproef typenaam: niet gedragen: de typenaam weigert op de taak', notCarried.includes(chunk));
  ok('verliesproef typenaam: tegenhanger met de bron als O0 (niets hersteld): de typenaam beweegt mee', !carried.includes(chunk));
}

// ── 7. PR 12e: de weesrij houdt haar identiteit (knownbug 1702) ──
// Wist de planner een taak die in een baseline staat, dan blijft haar rij in de baseline (een weesrij). De lezer zet in
// `ifcGlobalIds` alleen de GlobalIds van taken die er zijn; tot PR 12e schreef de writer daarom na heropenen een nieuwe hash
// in `TaskGuids` voor die rij, en was `OPS_Baselines` in het bestand daarna niet meer gedragen. De merge geeft de writer nu
// de GlobalId die de lezer zelf voor de rij aannam (`withOrphanRowGuids` met `ImportResult.baselineOrphanGuids`).
// 7a. De weesrij zelf: taak wissen → opslaan → heropenen → opslaan zonder bewerking (de bytes van de eerste), met een
//     kleine bewerking, met een baseline erbij en die baseline weer wissen (dat vraagt een gedragen `OPS_Baselines`) →
//     heropenen. Per weesrij (baseline en plaats) de taak-id en de GlobalId zoals de lezer hem aanneemt:
//     gelijk in alle lezingen, en de GlobalId gelijk aan die in het domein. Op drie bronnen, met een gewone taak en met een
//     samenvattingstaak (de rijen van de kinderen). Op de oude showcase (OPS v2026.7.12, baseline-JSON zonder `TaskGuids`
//     en met de interne ids van toen) zet (b) het JSON in de vorm van de bron terug (#1104): daar krijgt de weesrij bij de
//     eerste lezing de interne id uit de bron terug, met dezelfde GlobalId (knownbug 1770); de canon ziet dat bewust niet.
// 7b. De keten op het oude bestand: na elke geschreven stap houdt elke weesrij haar taak-id en GlobalId in de volgende
//     uitvoer, en is `OPS_Baselines` in de volgende opslag gedragen. Gemeten met de handeling die alleen schrijft als hij
//     gedragen is (één baseline wissen: de kop beweegt dan mee, E1). Op de oude showcase is `OPS_Baselines` dat nooit, ook
//     niet zonder weesrij: zijn JSON blijft in de vorm van de bron (een baseline vastleggen of wissen weigert daar al op het
//     onbewerkte bestand, ook op de basis). Daar meet 7b alleen de weesrij na taak wissen, en dat het zo blijft.
const showcase = withWall(read('tests/planning/fixtures/oude-tags/v2026.7.12-data-showcase-verbouwing-eengezinswoning.ifc'));
/** Per weesrij (`baseline#plaats`): de taak-id en de GlobalId die de lezer van `bytes` ervoor aannam (zijn eigen lezing,
 *  `baselineOrphanGuids`); `guids`: eerst de GlobalIds van het domein (een domein dat nog niet geschreven is). */
async function orphanRows(d: Domain, bytes: Uint8Array, guids?: Readonly<Record<string, string>>): Promise<Map<string, { id: string; guid: string }>> {
  const reading = (await readIfcBytesDetailed(bytes, {}, { createWorker: () => null })).result;
  const assumed = new Map(Object.entries(reading.baselineOrphanGuids ?? {}));
  const read = (id: string) => assumed.get(id) ?? '(geen weesrij voor de lezer)', live = new Set(d.tasks.map(t => t.id));
  const out = new Map<string, { id: string; guid: string }>();
  for (const b of d.baselines ?? []) b.tasks.forEach((r, i) => {
    if (!live.has(r.taskId)) out.set(`${b.id}#${i}`, { id: r.taskId, guid: guids?.[`task:${r.taskId}`] ?? read(r.taskId) });
  });
  return out;
}
const rowsText = (m: ReadonlyMap<string, { id: string; guid: string }>) => [...m].map(([k, v]) => `${k}=${v.id}/${v.guid}`).join(' ');
const sameGuids = (a: ReadonlyMap<string, { guid: string }>, b: ReadonlyMap<string, { guid: string }>) =>
  a.size === b.size && [...a].every(([k, v]) => b.get(k)?.guid === v.guid);
const sameIds = (a: ReadonlyMap<string, { id: string }>, b: ReadonlyMap<string, { id: string }>) =>
  a.size === b.size && [...a].every(([k, v]) => b.get(k)?.id === v.id);
/** De taak die de proef wist: een gewone taak in een baseline, of een samenvattingstaak waarvan de kinderen in een baseline
 *  staan (een baseline van nu heeft alleen rijen van gewone taken; die van v2026.7.12 ook van de samenvatting). */
function orphanTarget(d: Domain, withSummary: boolean) {
  const inBaseline = new Set((d.baselines ?? []).flatMap(b => b.tasks.map(r => r.taskId)));
  return withSummary
    ? d.tasks.find(t => t.childIds.length > 0 && t.childIds.every(c => inBaseline.has(c)) && t.childIds.every(c => !d.tasks.find(x => x.id === c)?.childIds.length))
    : d.tasks.find(t => !t.isMilestone && !t.childIds.length && inBaseline.has(t.id) && !t.customTaskTypeId);
}
const ORPHAN_SOURCES: [string, Uint8Array][] = [['eigen', SOURCES.eigen], ['oud', SOURCES.oud], ['showcase', showcase]];
for (const [tag, raw] of ORPHAN_SOURCES) for (const withSummary of [false, true]) {
  const label = `weesrij ${tag} (${withSummary ? 'samenvattingstaak' : 'gewone taak'})`;
  nextCase();
  // De beginstand: een baseline met de taak; zonder zo'n taak eerst een samenvatting met twee kinderen en een baseline.
  let start = raw;
  if (!orphanTarget(await openForeign(raw), withSummary)) {
    const { o } = await one(`${label}: beginstand`, raw, se(s => {
      if (withSummary) {
        const parent = addTask(s, 'Wees ouder'), opts = { phaseAssignments: 'move', answered: true };
        const c1 = s.addTask({ name: 'Wees kind 1', position: { anchorId: parent, where: 'below' } }, opts);
        const c2 = s.addTask({ name: 'Wees kind 2', position: { anchorId: c1, where: 'below' } }, opts);
        s.indentTasks([c1, c2], opts);
      }
      s.saveBaseline('Wees B');
    }), 'schrijft');
    if (!o.ok) continue;
    start = o.bytes;
  }
  const opened = await openForeign(start);
  const target = orphanTarget(opened, withSummary);
  assert(target, `${label}: een taak in een baseline`);
  const d1 = await se(s => s.deleteTask(target.id))(cloneDomain(opened));
  // Op de oude showcase geeft de canon de weesrij zonder id terug (#1104), een gewone opslag houdt de id: `whole` zou dat
  // als anders zien. Daar toetst de proef het vreemde deel en de planning zonder de ids van de weesrijen.
  const legacy = tag === 'showcase';
  const o1 = legacy ? await save(d1, opened.ifcSource!) : await attempt(`${label}: taak wissen`, start, opened.ifcSource!, d1, 'schrijft');
  if (legacy) {
    console.log(`UITKOMST ${clock.mode} ${label}: taak wissen: ${summary(o1)}`);
    ok(`${label}: taak wissen schrijft`, o1.ok, o1.ok ? '' : o1.detail);
  }
  if (!o1.ok) continue;
  // De lezingen van `orphanRows` pas na de laatste opslag van dit geval: de lezer neemt ids van `generateId`, en een lezing
  // tussen twee opslagen gaf een latere opslag dan andere ids dan op de basis (fixronde 1).
  const r1 = await openForeign(o1.bytes);
  if (legacy) {
    ok(`${label}: vreemd deel byte voor byte`, mergeProblems(start, o1.bytes).length === 0);
    ok(`${label}: heropend zoals getoond, op de ids van de weesrijen na`, canon(r1, () => {}) === canon(await shownAfterOpen(d1), () => {}));
  }
  const again = await save(cloneDomain(r1), r1.ifcSource!);
  ok(`${label}: opslaan zonder bewerking geeft de bytes van de eerste`, again.ok && sameBytes(again.bytes, o1.bytes));
  const r2 = again.ok ? await openForeign(again.bytes) : r1;
  const o3 = legacy ? await save(await beschrijving(cloneDomain(r1)), r1.ifcSource!)
    : await attempt(`${label}: daarna alleen de projectbeschrijving`, start, r1.ifcSource!, await beschrijving(cloneDomain(r1)), 'schrijft');
  if (legacy) ok(`${label}: daarna alleen de projectbeschrijving schrijft`, o3.ok, o3.ok ? '' : o3.detail);
  const r3 = o3.ok ? await openForeign(o3.bytes) : r1;
  // Een opslag die `OPS_Baselines` wel raakt (een baseline erbij): daar schrijft de writer `TaskGuids` uit de lezing, en
  // tot PR 12e kreeg de weesrij dan een nieuwe hash, en weigerde de merge (de groep was niet gedragen). Niet op de oude
  // showcase: daar weigert een baseline erbij al op het onbewerkte bestand.
  // Daarna die baseline weer wissen: dat schrijft alleen als `OPS_Baselines` gedragen is (de kop beweegt mee, E1).
  let read4: [Domain, Uint8Array] | undefined, read5: [Domain, Uint8Array] | undefined;
  if (!legacy) {
    const o4 = await attempt(`${label}: daarna een baseline erbij`, start, r3.ifcSource!, await se(s => s.saveBaseline('Wees B2'))(cloneDomain(r3)), 'schrijft');
    if (o4.ok) {
      const r4 = await openForeign(o4.bytes);
      read4 = [r4, o4.bytes];
      const o5 = await attempt(`${label}: daarna die baseline weer wissen`, start, r4.ifcSource!,
        await se(s => s.deleteBaseline(s.baselines.find((b: any) => b.name === 'Wees B2').id))(cloneDomain(r4)), 'schrijft');
      if (o5.ok) read5 = [await openForeign(o5.bytes), o5.bytes];
    }
  }
  const shown = await orphanRows(d1, start, d1.ifcGlobalIds);
  ok(`${label}: weesrijen`, shown.size >= (withSummary ? 2 : 1), rowsText(shown));
  const l4 = read4 && await orphanRows(...read4), l5 = read5 && await orphanRows(...read5);
  const [l1, l2, l3] = [await orphanRows(r1, o1.bytes), await orphanRows(r2, again.ok ? again.bytes : o1.bytes), await orphanRows(r3, o3.ok ? o3.bytes : o1.bytes)];
  console.log(`WEESRIJ ${label}: domein ${rowsText(shown)}`);
  console.log(`WEESRIJ ${label}: lezing 1 ${rowsText(l1)}; lezing 2 ${rowsText(l2)}; lezing 3 ${rowsText(l3)}${l4 ? `; lezing 4 ${rowsText(l4)}` : ''}${l5 ? `; lezing 5 ${rowsText(l5)}` : ''}`);
  ok(`${label}: taak-id en GlobalId gelijk in alle lezingen`, rowsText(l1) === rowsText(l2) && rowsText(l1) === rowsText(l3) && l1.size === shown.size
    && (legacy || (l4 !== undefined && l5 !== undefined && rowsText(l4) === rowsText(l1) && rowsText(l5) === rowsText(l1))),
    `${rowsText(l1)} | ${rowsText(l2)} | ${rowsText(l3)} | ${l4 ? rowsText(l4) : '-'} | ${l5 ? rowsText(l5) : '-'}`);
  ok(`${label}: de GlobalId van het domein blijft`, sameGuids(shown, l1), `${rowsText(shown)} | ${rowsText(l1)}`);
  // De taak-id van het domein: gelijk, behalve op de oude showcase (knownbug 1770).
  ok(`${label}: de taak-id van het domein ${legacy ? 'wordt bij de eerste lezing de interne id uit de bron (1770)' : 'blijft'}`,
    sameIds(shown, l1) === !legacy, `${rowsText(shown)} | ${rowsText(l1)}`);
}
// 7b. De keten, met na elke geschreven stap de meting op de uitvoer.
// De lezingen van `orphanRows` komen pas na de hele keten (`settleMeasured`), om dezelfde reden als in 7a.
const pendingRows: (() => Promise<void>)[] = [];
async function settleMeasured() { for (const f of pendingRows.splice(0)) await f(); }
const measured = (tag: string, carriedAfter: boolean) => async (label: string, before: Uint8Array, written: Uint8Array) => {
  const reread = await openForeign(written), prior = await openForeign(before);
  // Elke weesrij van de vorige uitvoer die er nog is, houdt haar taak-id en GlobalId (op baseline en plaats).
  pendingRows.push(async () => {
    const was = await orphanRows(prior, before), now = await orphanRows(reread, written);
    const kept = [...was].filter(([k]) => now.has(k));
    console.log(`WEESRIJ keten ${tag}: na stap ${label}: ${rowsText(now) || 'geen'}`);
    ok(`keten ${tag}: stap ${label}: de weesrijen houden taak-id en GlobalId`, kept.every(([k, v]) => now.get(k)!.guid === v.guid && now.get(k)!.id === v.id),
      `${rowsText(was)} | ${rowsText(now)}`);
  });
  if (!reread.baselines?.length) return;
  const probe = await save(await se(s => s.deleteBaseline(s.baselines[0].id))(cloneDomain(reread)), reread.ifcSource!);
  console.log(`GEDRAGEN keten ${tag}: na stap ${label}: één baseline wissen ${summary(probe)}`);
  ok(`keten ${tag}: na stap ${label}: OPS_Baselines ${carriedAfter ? 'gedragen (één baseline wissen schrijft)' : 'niet gedragen, zoals op de onbewerkte bron'}`,
    probe.ok === carriedAfter, probe.ok ? 'schrijft' : `${probe.kinds.join(',')}: ${probe.detail}`);
};
await reopenedChain('weesrij oud', SOURCES.oud, CHAIN, measured('weesrij oud', true));
await settleMeasured();
// De oude showcase: `OPS_Baselines` is daar al op het onbewerkte bestand niet gedragen, en na een taak wissen ook niet.
{
  nextCase();
  const opened = await openForeign(showcase);
  const before = await save(await se(s => s.deleteBaseline(s.baselines[0].id))(cloneDomain(opened)), opened.ifcSource!);
  console.log(`GEDRAGEN weesrij showcase: onbewerkt: één baseline wissen ${summary(before)}`);
  ok('weesrij showcase: onbewerkt: OPS_Baselines niet gedragen (één baseline wissen weigert)', !before.ok);
  const wiped = await save(await se(s => s.deleteTask(orphanTarget(s, false)!.id))(cloneDomain(opened)), opened.ifcSource!);
  assert(wiped.ok, 'weesrij showcase: taak wissen schrijft');
  await measured('weesrij showcase', false)('1 een taak uit de baseline wissen', showcase, wiped.bytes);
  await settleMeasured();
}

// ── 8. Stap 5 deel 1 (was knownbug 1707): de vervolgstap na "het laatste eigen lid weg", het vreemde lid in het midden van de
// ledenlijst, en een vreemde verwijzing in een kop ──
/** Het vreemde lid staat in een pset `pset` met minstens één eigen lid, en er is maar één pset met die naam. */
const inOwnPset = (text: string, pset: string) => {
  const ps = linesOf(text).filter(l => l.type === 'IFCPROPERTYSET' && l.args[2] === `'${pset}'`);
  const refs = ps[0]?.args[4].trim().slice(1, -1).split(',').map(x => x.trim()) ?? [];
  return ps.length === 1 && refs.includes('#95000') && refs.length > 1 ? '' : `${ps.length} psets: ${ps.map(l => l.args[4]).join(' | ')}`;
};
/** Opnieuw opslaan zonder bewerking geeft dezelfde bytes. */
async function sameWithoutEdit(label: string, bytes: Uint8Array) {
  nextCase();
  const opened = await openForeign(bytes);
  const o = await save(cloneDomain(opened), opened.ifcSource!);
  console.log(`UITKOMST ${clock.mode} ${label}: ${summary(o)}`);
  ok(`${label}: niets bewerkt geeft dezelfde bytes`, o.ok && sameBytes(o.bytes, bytes), o.ok ? 'andere bytes' : `${o.kinds.join(',')}: ${o.detail}`);
}
for (const { label, bytes, pset, reverse } of lastOwnGoneOutputs) {
  await sameWithoutEdit(`${label}, heropend`, bytes);
  const { o } = await one(`${label}, heropend: de handeling andersom`, bytes, reverse, 'schrijft');
  if (!o.ok) continue;
  const where = inOwnPset(latin1(o.bytes), pset);
  ok(`${label}, heropend: de handeling andersom: het vreemde lid staat weer in de eigen pset`, where === '', where);
  await sameWithoutEdit(`${label}, heropend: de handeling andersom, heropend`, o.bytes);
}
/** Als `withForeignMember`, maar niet achteraan in de ledenlijst: na het eerste eigen lid, en vooraan in een pset met één
 *  eigen lid (`OPS_TaskTypes` en `OPS_StructureMeta` hebben er één). */
function withForeignMemberInMiddle(bytes: Uint8Array, pset: string): Uint8Array {
  let n = 0;
  const text = latin1(bytes).split('\n').map(t => {
    const l = parseOutLine(t.replace(/\r$/, ''));
    if (l?.type !== 'IFCPROPERTYSET' || l.args[2] !== `'${pset}'`) return t;
    const refs = l.args[4].trim().slice(1, -1).split(',');
    const at = refs.length >= 2 ? 1 : 0;
    n++;
    return `#${l.id}=${l.type}(${l.args.map((a, k) => k === 4 ? `(${[...refs.slice(0, at), '#95000', ...refs.slice(at)].join(',')})` : a).join(',')});${t.endsWith('\r') ? '\r' : ''}`;
  }).join('\n');
  assert(n === 1, `pset ${pset} niet gevonden`);
  return bytesOf(withLines(text, ["#95000=IFCPROPERTYSINGLEVALUE('VendorNote',$,IFCTEXT('van een ander programma'),$);"]));
}
// Het vreemde lid niet achteraan: de merge hangt het achteraan (`mergeWriter.ts`, stap 6), dus de pset leest anders dan
// de bron. Dit legt vast wat er gebeurt.
{
  const cases: [string, Uint8Array, string, Edit, Expect][] = [
    ['OPS_Baselines', withForeignMemberInMiddle(eigen, PSET.Baselines), PSET.Baselines, se(s => { for (const b of [...s.baselines]) s.deleteBaseline(b.id); }), 'weigert'],
    ['OPS_TaskTypes', withForeignMemberInMiddle(seq, PSET.TaskTypes), PSET.TaskTypes, se(s => {
      const t = s.tasks.find((t: any) => t.customTaskTypeId === 'type-7c'); s.updateTask(t.id, { taskType: 'CONSTRUCTION', customTaskTypeId: undefined });
    }), 'weigert'],
    ['OPS_StructureMeta', withForeignMemberInMiddle(cat, PSET.StructureMeta), PSET.StructureMeta, se(s => { for (const c of [...s.activityCodeTypes]) s.removeActivityCodeType(c.id); }), 'weigert'],
  ];
  for (const [name, bytes, pset, lastGone, expect] of cases) {
    await sameWithoutEdit(`vreemd lid in het midden van ${name}`, bytes);
    for (const [what, edit, want] of [['projectbeschrijving', beschrijving, 'weigert'], ['het laatste eigen lid weg', lastGone, expect]] as const) {
      const { o } = await one(`vreemd lid in het midden van ${name}: ${what}`, bytes, edit, want);
      if (o.ok) ok(`vreemd lid in het midden van ${name}: ${what}: het vreemde lid blijft staan`, foreignMemberKept(latin1(o.bytes), pset));
      else console.log(`MIDDEN ${name}: ${what}: ${o.kinds.join(',')}: ${o.detail.slice(0, 200)}`);
    }
  }
}
// Een vreemde verwijzing in een kop (`Creators`, slot 7, naar een persoon van een ander programma): de lezer leest dat slot
// niet. Bij een opslag die de baselines niet raakt, zet (b) het terug (de verwijzing blijft staan), en dan beweegt de kop niet
// mee, zoals bij een omschrijving van een ander programma (blok 5). Wist de planner een baseline, dan zet (b) het slot niet
// terug en zou de verwijzing wegvallen: dat weigert de controle op de kop zelf, ook als de vorm wel mee zou bewegen (gemeten
// met een mutatie in de PR). Tot stap 5 deel 1 sloot ook de voorwaarde "geen vreemd lid" deze vorm uit.
{
  const ls = parsedLines(cat), m = membersOf(planAggregate(ls)), head = ls.find(l => `#${l.id}` === m[2])!;
  const creators = replaced(cat, [{ ...head, args: head.args.map((a, k) => k === 7 ? '(#95300)' : a) }],
    ["#95300=IFCPERSON($,'Planner van een ander programma',$,$,$,$,$,$);"]);
  await one('kop: vreemde Creators op een kop, projectbeschrijving', creators, beschrijving, 'schrijft');
  await one('kop: vreemde Creators op een kop, de andere baseline wissen', creators, wisEen, 'weigert');
}

// ── 9. Stap 5, PR A: de toets en (c) per slot (knownbugs 1953 en 1747) ──
// Zette (b) een slot terug, dan valt alleen dat slot buiten de toets en buiten (c); de rest van zijn groep valt eronder. Het
// slot staat op zijn plaats in de boom van (c): de groep, de weg via typen en namen vanaf de wortel, en het argument, zonder
// id's (`restoredOwnSlots` in `ownGroups.ts`). Is die plaats niet eenduidig, dan valt de groep helemaal buiten de toets, zoals
// tot PR A. Per geval: het schrijft en is heel, de omschrijving blijft staan, (c) slaat geen groep over en toetst precies de
// verwachte slots niet (`restored`, zoals de opslag het meldt), heropenen en zonder bewerking opnieuw opslaan geeft dezelfde
// bytes, en de verliescontrole zelf (`lossProbe`, met O0 in de vorm van de writer, zodat (b) het slot terugzet zoals bij
// opslaan) laat in de groep geen verschil meer door een oude verklaring (lijst A) gaan. De tegenproeven op de echte uitvoer
// staan in `check-ifc-foreign-eigen-uitvoer.ts`, blok 10.
const restoredText = (r: RestoredOwnSlots | undefined) => r
  ? `overslaan: ${[...r.skip].join(', ') || 'niets'}; masker: ${[...r.mask].join(' + ') || 'niets'}` : 'niet gemeld';
const sameSet = (a: ReadonlySet<string> | undefined, b: readonly string[]) => !!a && a.size === b.length && b.every(x => a.has(x));
const descriptions = (b: Uint8Array) => latin1(b).split(DESCRIPTION).length - 1;
/**
 * Eén geval per slot: `start` in de vorm van de writer, `slotted` met de slots van een ander programma erin (die zet (b)
 * terug), `edit` de handeling. `places`: wat (c) niet mag toetsen; `groups`: de groepen waarin de verliescontrole geen oude
 * verklaring meer mag gebruiken.
 */
async function perSlot(label: string, start: Uint8Array, slotted: Uint8Array, edit: Edit, places: readonly string[], groups: readonly string[]) {
  const { o, d } = await one(label, slotted, edit, 'schrijft');
  if (!o.ok) return undefined;
  console.log(`SLOT ${label}: ${restoredText(o.restored)}`);
  ok(`${label}: (c) slaat geen groep over`, o.restored?.skip.size === 0, restoredText(o.restored));
  ok(`${label}: (c) toetst precies het teruggezette slot niet`, sameSet(o.restored?.mask, places), restoredText(o.restored));
  ok(`${label}: de omschrijving van het andere programma blijft staan`, descriptions(o.bytes) === descriptions(slotted), `${descriptions(o.bytes)} van ${descriptions(slotted)}`);
  await sameWithoutEdit(`${label}, heropend`, o.bytes);
  const p = await lossProbe(slotted, d, o.bytes, true);
  const old: string[] = [];
  const found = p.run(p.o1, undefined, linesOfBytes(start), (c, why) => {
    const g = p.ownGroups?.get(c);
    if (g !== undefined && groups.includes(g)) old.push(`${p.index.type(c)} #${p.index.id(c)}: ${why}`);
  });
  ok(`verliesproef ${label}: de echte O1 slaagt, met (b) zoals bij opslaan`, found.length === 0, found.map(c => `${p.index.type(c)} #${p.index.id(c)}`).join(', '));
  console.log(`OUDE VERKLARING ${label}: ${old.join(' | ') || 'geen'}`);
  ok(`verliesproef ${label}: geen oude verklaring in ${groups.join(', ')}`, old.length === 0, old.slice(0, 3).join(' | '));
  return o;
}
{
  const single = prepared.get('eigen')!.single;
  const SEVEN: [string, Uint8Array, string, Edit][] = [
    ['OPS_StructureMeta: tweede code (1953)', single, PSET.StructureMeta, se(s => {
      const c = s.addActivityCodeType('Code per slot'); s.addActivityCodeValue(c, { code: 'P', description: 'Per slot' });
    })],
    ['OPS_TaskTypes: nieuw type en toewijzen', single, PSET.TaskTypes, se(s => {
      s.ensureProjectTaskType({ id: 'type-slot', name: 'Type per slot' });
      s.updateTask(leaves(s).find((t: any) => !t.customTaskTypeId).id, { taskType: 'USERDEFINED', customTaskTypeId: 'type-slot' });
    })],
    ['OPS_TaskTypes: type wisselen', cat, PSET.TaskTypes, se(s => {
      s.updateTask(s.tasks.find((t: any) => t.customTaskTypeId === 'type-7d-a').id, { customTaskTypeId: 'type-7d-b' });
    })],
    ['OPS_Baselines: taak en baseline erbij', single, PSET.Baselines, se(s => { addTask(s, 'Taak per slot'); s.saveBaseline('Baseline per slot'); })],
    ['OPS_Baselines: andere baseline actief', single, PSET.Baselines, se(s => { s.setActiveBaseline(s.baselines.find((b: any) => b.id !== s.activeBaselineId).id); })],
    ['OPS_ProjectSettings: statusdatum zetten', single, PSET.ProjectSettings, se(s => { s.setStatusDate('2026-12-01'); })],
    ['OPS_ProjectSettings: WBS-nummering uit', single, PSET.ProjectSettings, se(s => { s.setWbsAutoNumber(false); })],
  ];
  for (const [label, start, pset, edit] of SEVEN) {
    await perSlot(`per slot: omschrijving op ${label}`, start, withPsetDescription(start, pset), edit, [psetDescriptionPlace(pset)], [pset]);
  }
  // Twee slots in één groep: de omschrijving op de pset en op een property die de handeling niet raakt.
  const PS = PSET.ProjectSettings, statusdatum = se(s => { s.setStatusDate('2026-12-01'); });
  await perSlot('per slot: twee slots in OPS_ProjectSettings, statusdatum zetten', single,
    withPropertyDescription(withPsetDescription(single, PS), PS, PROP.ProjectSettings.IfcSchemaConfirmed), statusdatum,
    [psetDescriptionPlace(PS), propertyDescriptionPlace(PS, PROP.ProjectSettings.IfcSchemaConfirmed)], [PS]);
  // Een slot in de ene groep sluit een andere groep niet uit: de omschrijving op `OPS_TaskTypes`, de handeling in
  // `OPS_StructureMeta` (de tegenproef dat (c) die groep helemaal toetst, staat in eigen-uitvoer).
  await perSlot('per slot: omschrijving op OPS_TaskTypes, tweede code', single, withPsetDescription(single, PSET.TaskTypes), SEVEN[0][3],
    [psetDescriptionPlace(PSET.TaskTypes)], [PSET.TaskTypes, PSET.StructureMeta]);
  // Een slot op een tweede vorm: de typenaam op een taak zonder type, en een omschrijving of een vreemde `Creators` op een
  // kop. (c) toetst dan alleen dat ene slot van die ene taak of kop niet (was knownbug 1747: de hele vorm). De vorm zelf
  // beweegt niet mee (blok 5 en 6, hierboven): dat blijft per vorm.
  const guidOf = (b: Uint8Array, pick: (l: OutLine) => boolean) => linesOfBytes(b).find(pick)!.args[0].trim();
  {
    const labelled = withLabelOnUntypedTask(cat, 'Type 0 7d');
    const task = guidOf(labelled, l => l.type === 'IFCTASK' && l.args[4].trim() === "'Type 0 7d'" && l.args[12]?.trim() !== '.USERDEFINED.');
    for (const [what, edit] of [['projectbeschrijving', beschrijving], ['typewissel (1747)', (d: Domain) => applyEdit(fixedCatalogEdits(d)[2], d)]] as const) {
      await perSlot(`per slot: typenaam op een taak zonder type, ${what}`, cat, labelled, edit, [`taak:ObjectType|${task}#4`], []);
    }
  }
  {
    const ls = parsedLines(cat), m = membersOf(planAggregate(ls)), head = ls.find(l => `#${l.id}` === m[2])!;
    const described = replaced(cat, [{ ...head, args: head.args.map((a, k) => k === 3 ? DESCRIPTION : a) }]);
    await perSlot('per slot: omschrijving op een kop, projectbeschrijving', cat, described, beschrijving, [`kop:OPS_Baselines|${head.args[0].trim()}#3`], []);
    const creators = replaced(cat, [{ ...head, args: head.args.map((a, k) => k === 7 ? '(#95300)' : a) }],
      ["#95300=IFCPERSON($,'Planner van een ander programma',$,$,$,$,$,$);"]);
    nextCase();
    const opened = await openForeign(creators);
    const r = await attempt('per slot: vreemde Creators op een kop, projectbeschrijving', creators, opened.ifcSource!, await beschrijving(cloneDomain(opened)), 'schrijft');
    if (r.ok) {
      console.log(`SLOT vreemde Creators op een kop: ${restoredText(r.restored)}`);
      ok('per slot: vreemde Creators op een kop: (c) toetst alleen dat slot van die kop niet',
        r.restored?.skip.size === 0 && sameSet(r.restored.mask, [`kop:OPS_Baselines|${head.args[0].trim()}#7`]), restoredText(r.restored));
      ok('per slot: vreemde Creators op een kop: de verwijzing blijft staan', /=IFCWORKSCHEDULE\([^\n]*\(#95300\)/.test(latin1(r.bytes)));
    }
  }
  // Wat (c) niet eenduidig kan aanwijzen, komt niet bij (c): twee eigen properties met dezelfde naam, en twee eigen psets met
  // dezelfde naam, paren in de verliescontrole niet eenduidig of hebben geen tegenhanger in O0. Dat weigert, zoals op de
  // basis. Wat `restoredOwnSlots` doet als het toch zo ver komt (de hele groep buiten de toets), toetst
  // `check-ifc-foreign-slotplaats.ts` los.
  {
    const ls = linesOfBytes(single);
    const settings = ls.find(l => l.type === 'IFCPROPERTYSET' && l.args[2].trim() === `'${PS}'`)!;
    const confirmed = ls.find(l => l.type === 'IFCPROPERTYSINGLEVALUE' && l.args[0].trim() === `'${PROP.ProjectSettings.IfcSchemaConfirmed}'`)!;
    const twice = replaced(withPsetDescription(single, PS), [{ ...settings, args: settings.args.map((a, k) => k === 3 ? DESCRIPTION : k === 4 ? a.replace(/\)$/, ',#95400)') : a) }],
      [`#95400=IFCPROPERTYSINGLEVALUE(${confirmed.args.join(',')});`]);
    await one('per slot: twee properties met dezelfde naam in OPS_ProjectSettings, statusdatum zetten', twice, statusdatum, 'weigert');
    const rel = ls.find(l => l.type === 'IFCRELDEFINESBYPROPERTIES' && l.args[5].trim() === `#${settings.id}`)!;
    const second = replaced(withPsetDescription(single, PS), [], [
      `#95401=IFCPROPERTYSET('0R804SLOTTWEEDEPSET000',${settings.args[1]},'${PS}',$,(#95402));`,
      `#95402=IFCPROPERTYSINGLEVALUE(${confirmed.args.join(',')});`,
      `#95403=IFCRELDEFINESBYPROPERTIES('0R804SLOTTWEEDEREL0000',${rel.args[1]},$,$,${rel.args[4]},#95401);`,
    ]);
    await one('per slot: twee psets OPS_ProjectSettings op het project, statusdatum zetten', second, statusdatum, 'weigert');
  }
  // Een slot dat (b) terugzet en dat de planner wijzigde, weigert zoals tot nu: een onbekend veld in de typedefinities (JSON,
  // de lezer draagt een deel) en een nieuw type (blok 2, "grens: onbekend definitieveld, typegroei").
  await one('per slot: onbekend definitieveld (b) en een nieuw type', unknownField, d => applyEdit(fixedCatalogEdits(d)[1], d), 'weigert');
  // Meting, geen eis van deze PR: een omschrijving op een property waarvan de handeling de waarde zet (`ModifiedAt` verandert
  // bij elke bewerking). Dit legt vast wat er met de omschrijving gebeurt, op de basis en hier.
  {
    const slotted = withPropertyDescription(single, PS, PROP.ProjectSettings.ModifiedAt);
    const { o } = await one('per slot (meting): omschrijving op ModifiedAt, statusdatum zetten', slotted, statusdatum, 'schrijft');
    if (o.ok) console.log(`MEETGEVAL omschrijving op ModifiedAt, statusdatum zetten: omschrijving ${descriptions(o.bytes)} van ${descriptions(slotted)}; ${restoredText(o.restored)}`);
  }
}

finish();
