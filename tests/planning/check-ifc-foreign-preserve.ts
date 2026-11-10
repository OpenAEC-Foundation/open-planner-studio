// #804 fase 1b: de writer behoudt het vreemde deel (ontwerp "Gebouwmodel behouden in IFC en IFCX", §4.3, §4.4, §4.6,
// §4.10 eerste drie alinea's). Headless tegen `writeIfcMerge`; Opslaan gebruikt die nog niet (dat is 1c). Bewaakt:
//   1. elk corpusbestand met een vreemd deel, zonder wijziging: de merge schrijft, of weigert getypeerd
//      (`merge-needs-phase2`) met precies de verwachte gevallen. Schrijft hij, dan: kop, staart en elk niet-P-stuk
//      byte-gelijk met hetzelfde `#id` en in dezelfde volgorde; geen ander niet-P-stuk erbij; geen dubbel `#id`; hetzelfde
//      regeleinde; de herlezing geeft dezelfde planning en dezelfde bron-ids (`stepIds`); een tweede ronde is byte-gelijk;
//      geen object krijgt een tweede `Decomposes`, `Nests` of `HasContext`; niet meer `IfcProject` dan de bron;
//   2. varianten met een eigen planning (de structuur van Bonsai, maar zonder vreemde herkomst):
//      a. een tweede live-schema van een ander programma met een eigen taak: het schema en zijn relaties byte-gelijk,
//         de taak niet in het D-schema, een nieuwe taak wel, heropenen kiest hetzelfde D-schema;
//      b. het D-schema onder een vreemd werkplan (`r6opus-twee-werkplannen.na.ifc`): geen tweede `Decomposes`;
//      c. 'Proj' en 'Plan' (§4.4): het project is niet P; 'Proj' staat in `OPS_ProjectSettings` en blijft na herlezen;
//      d. een eigen bestand van v2026.7.2 met een los `IfcProject` (ook met een extra eenheid, millimeter of een model
//         onder het project): project, eenheden en context byte-gelijk, één `IfcProject`, daarna C, tweede ronde byte-gelijk;
//      e. CRLF met commentaar, een rauw Latin-1-byte en twee taken met dezelfde GlobalId;
//   3. de keuzes "de eerste X" van de lezer: na de merge dezelfde auteur en hetzelfde bedrijf (ook leeg), werkplan,
//      werkschema en projectkalender;
//   4. de bewerkingen van 1b (taak erbij, hernoemen, duur, toewijzing erbij): het vreemde deel blijft byte-gelijk en de
//      herlezing is gelijk aan dezelfde bewerking zonder vreemd deel;
//   5. elk geval van `merge-needs-phase2` met een kleine proef: de fout heeft de vaste code en de gevallen; met de
//      leesverliestoets (fixronde 2 van #867) de negen tegenvoorbeelden van ronde 2, elk met een bewuste bewerking van
//      hetzelfde veld, en de normalisaties;
//   6. de invarianten zelf: een uitvoer met een weggelaten, verschoven, verwisseld of gewijzigd vreemd stuk is rood.
// Een eigen bestand van een oudere versie weigert sinds fixronde 2 met `niet-gedragen` (de lezer draagt niet elk veld).
// Proeven die over iets anders gaan, nemen daarom de bron zoals de huidige writer haar schrijft (`settle`); sectie 1
// bewaakt de weigering van het bestand zelf.
// Exit 0 = alles groen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import {
  basicEdits, canon, cloneDomain, concat, doubleMemberships, firstDiff, mergeProblems, openForeign, plannerEdits, sameBytes, settle, tryMerge,
  type Domain, type Opened,
} from './ifcMergeKern';
import { MergeNeedsPhase2Error, mergeIdPlan, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { changedScopes, lossCheck, parseOutLine, pristineDomain, sameDuration, sameNumber, type OutLine } from '@/services/ifc/foreign/lossCheck';
import { scanStep, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import type { Task } from '@/types/task';
import { classify } from '@/services/ifc/foreign/classify';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');

let checks = 0;
const diffs: string[] = [];
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 300)} ≠ ${w?.slice(0, 300)}`);
};
const enc = new TextEncoder();
/** Byte ↔ teken één op één (geen `TextDecoder('latin1')`: dat is windows-1252 en verandert 0x80–0x9F). */
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};
const read = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));

// ── Hulp: lidmaatschappen en tellingen in een bestand ──

const countType = (bytes: Uint8Array, type: string) => {
  const index = scanStep(bytes);
  let n = 0;
  for (let i = 0; i < index.count; i++) if (index.isEntity(i) && index.type(i) === type) n++;
  return n;
};
/** De regel (zonder regeleinde) van entiteit `#id`, of ''. */
function lineOf(bytes: Uint8Array, id: string): string {
  const index = scanStep(bytes);
  for (let i = 0; i < index.count; i++) {
    if (index.isEntity(i) && index.id(i) === id) return text(bytes.subarray(index.entityStart(i), index.end(i))).trim();
  }
  return '';
}
/** De relaties van een type in een bestand, als `relating → [related]`. */
function relationsOf(bytes: Uint8Array, type: string, relatingArg: number, relatedArg: number): { id: string; relating: string; related: string[] }[] {
  const index: StepIndex = scanStep(bytes);
  const out: { id: string; relating: string; related: string[] }[] = [];
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i) || index.type(i) !== type) continue;
    const relating = index.refAt(i, relatingArg);
    out.push({ id: index.id(i), relating: relating >= 0 ? index.id(relating) : '', related: index.refsAt(i, relatedArg).filter(x => x >= 0).map(x => index.id(x)) });
  }
  return out;
}

/** Eén volledige ronde: openen, merge zonder wijziging (of met `edit`), alle invarianten, herlezen en een tweede ronde. */
async function roundTrip(label: string, bytes: Uint8Array, edit?: (d: Domain) => void): Promise<{ out: Uint8Array; reread: Opened; opened: Opened } | undefined> {
  const opened = await openForeign(bytes);
  const source = opened.ifcSource;
  if (!source?.foreign) { diffs.push(`${label}: geen vreemd deel na openen`); checks++; return undefined; }
  const d = cloneDomain(opened);
  edit?.(d);
  let parts: Uint8Array[];
  try { parts = writeIfcMerge(d, source); } catch (e) {
    diffs.push(`${label}: de merge weigert (${e instanceof MergeNeedsPhase2Error ? e.cases.map(c => `${c.kind}: ${c.detail}`).slice(0, 3).join(' | ') : (e as Error).message})`);
    checks++;
    return undefined;
  }
  ok(`${label}: de uitvoer is een lijst Uint8Array-delen`, Array.isArray(parts) && parts.length > 0 && parts.every(p => p instanceof Uint8Array));
  const out = concat(parts);
  eq(`${label}: invarianten`, mergeProblems(bytes, out), []);
  ok(`${label}: geen nieuw dubbel lidmaatschap`, doubleMemberships(out).every(k => doubleMemberships(bytes).includes(k)));
  ok(`${label}: niet meer IfcProject dan de bron`, countType(out, 'IFCPROJECT') <= Math.max(1, countType(bytes, 'IFCPROJECT')));
  const reread = await openForeign(out);
  const want = edit ? canon(readIFC(writeIFC(d)), reseed) : canon(opened, reseed);
  const got = canon(reread, reseed);
  ok(`${label}: herlezen geeft dezelfde planning${got === want ? '' : ` (${firstDiff(got, want)})`}`, got === want);
  if (!edit) {
    const kept = Object.entries(source.stepIds).filter(([k, v]) => reread.ifcSource?.stepIds[k] !== v);
    eq(`${label}: herlezen geeft dezelfde bron-ids (stepIds)`, kept.slice(0, 5), []);
  }
  const second = reread.ifcSource ? tryMerge(cloneDomain(reread), reread.ifcSource) : undefined;
  if (!second?.ok) {
    diffs.push(`${label}: tweede ronde ${second ? `weigert (${second.kinds.join(', ')})` : 'zonder bron'}`);
    checks++;
  } else {
    ok(`${label}: tweede ronde byte-gelijk${sameBytes(second.bytes, out) ? '' : ` (${firstDiff(text(second.bytes), text(out))})`}`, sameBytes(second.bytes, out));
  }
  return { out, reread, opened };
}

// ── 1. Het corpus, zonder wijziging ──

/** Bestanden waarvan de merge zonder wijziging schrijft. Elk ander bestand weigert met de gevallen uit `REFUSED`. */
const WRITES: ReadonlySet<string> = new Set(['complexe-instanties.ifc', 'model-ifc4.ifc', 'model-ifc4x3.ifc']);
/** Een planning van Bonsai: werkplan, werkschema's en taken hebben de owner history van Bonsai (§4.5), en `Creators`
 *  staat in een slot dat de writer leeg schrijft. Behouden kan pas met `sourceSlots` en herkomstmerken. */
const BONSAI = ['niet-gedragen', 'vreemde-herkomst'];
const REFUSED: Readonly<Record<string, readonly string[]>> = {
  'bonsai-4d.ifc': BONSAI, 'crlf-commentaar.ifc': BONSAI, 'dubbele-globalids.ifc': BONSAI, 'latin1.ifc': BONSAI,
  'twee-werkplannen.ifc': BONSAI, 'council/proef-bonsai-achtig.ifc': BONSAI, 'council/r5sol-parallelle-relaties.ifc': BONSAI,
  'council/r6opus-twee-werkplannen.ifc': BONSAI, 'council/r6opus-twee-werkplannen.na.ifc': BONSAI,
  'council/r6sol-herkomst-na-eerste-opslag.ifc': BONSAI, 'council/r7fable-eigen-oh-planning.ifc': BONSAI,
  // Kalender en psets van een ander programma (VendorOps).
  'council/fix2-vendor-ops.ifc': ['niet-gedragen', 'vreemde-herkomst'],
  // Plus een gemengde IfcRelAssignsToProcess die de writer anders zou schrijven.
  'council/r6sol-losse-bonsai-toewijzing.ifc': ['gemengde-relatie', 'niet-gedragen', 'vreemde-herkomst'],
};
/** Eigen bestanden die ook met `settle` niet door de toets komen, met de reden. De rest van de eigen bestanden moet na
 *  `settle` de hele ronde halen (`roundTrip`). */
const NOT_SETTLED: Readonly<Record<string, RegExp>> = {
  // Het oude werkplan en werkschema hebben geen PredefinedType; de writer schrijft `.PLANNED.` (lay-out van v0.1).
  'oud-eigen-0.1-plus-model.ifc': /IFCWORKPLAN #36 \(New-Build Villa, Wassenaar\), argument 13 van de uitvoer \(geen slot in de bron\): \.PLANNED\./,
  // Een lege notitielijst (`'[]'`): de writer schrijft dan geen `OPS_TaskNotes` (knownbug 1024).
  'council/r7sol-vreemd-lid-bij-notitie.ifc': /IFCPROPERTYSINGLEVALUE #9110 \(Notes\): ontbreekt in de uitvoer/,
  'council/r7sol-vreemd-lid-bij-toewijzing.ifc': /IFCPROPERTYSINGLEVALUE #9110 \(Notes\): ontbreekt in de uitvoer/,
};

const corpus = [
  ...readdirSync(FOREIGN).filter(f => f.endsWith('.ifc')),
  ...readdirSync(join(FOREIGN, 'council')).filter(f => f.endsWith('.ifc')).map(f => `council/${f}`),
].sort();
let written = 0;
let refused = 0;
let settledOwn = 0;
for (const file of corpus) {
  const bytes = new Uint8Array(readFileSync(join(FOREIGN, file)));
  let opened: Opened;
  try { opened = await openForeign(bytes); } catch { continue; } // het IFC2X3-model blijft geweigerd bij openen
  if (!opened.ifcSource?.foreign) continue;
  if (WRITES.has(file)) { if (await roundTrip(file, bytes)) written++; continue; }
  const want = REFUSED[file] ?? ['niet-gedragen'];
  const outcome = tryMerge(cloneDomain(opened), opened.ifcSource);
  if (outcome.ok) { diffs.push(`${file}: de merge schrijft, maar weigeren werd verwacht`); checks++; continue; }
  eq(`${file}: de gevallen van de weigering`, outcome.kinds, want);
  eq(`${file}: de vaste code`, outcome.error.code, 'merge-needs-phase2');
  ok(`${file}: elk geval heeft een id en een uitleg`, outcome.error.cases.every(c => c.detail.length > 0));
  ok(`${file}: elk niet-gedragen geval heeft het veld`, outcome.error.cases.every(c => c.kind !== 'niet-gedragen' || c.field !== undefined));
  refused++;
  if (REFUSED[file]) continue;
  // Een eigen bestand: zoals de huidige writer het schrijft, haalt het de hele ronde.
  const stuck = NOT_SETTLED[file];
  let settled: Uint8Array | undefined;
  try { settled = await settle(bytes); } catch (e) {
    ok(`${file}: settle ${stuck ? `stopt op ${stuck}` : 'lukt'} (${(e as Error).message.slice(0, 200)})`, stuck !== undefined && stuck.test((e as Error).message));
    continue;
  }
  if (stuck) { diffs.push(`${file}: settle lukt, maar ${stuck} werd verwacht`); checks++; continue; }
  if (await roundTrip(`${file} (zoals de writer het schrijft)`, settled)) settledOwn++;
  // O1 is niet leeg: zonder bewerking is het domein na openen gelijk aan het domein van de toets (`changedScopes`).
  const again = await openForeign(settled);
  const index = scanStep(settled);
  const changed = changedScopes(cloneDomain(again), pristineDomain(index, classify(index), again.ifcSource!));
  eq(`${file}: zonder bewerking verandert er niets (O1)`, [changed.any, [...changed.keys].slice(0, 3)], [false, []]);
}
eq('corpus: elk bestand uit REFUSED en NOT_SETTLED bestaat', [...Object.keys(REFUSED), ...Object.keys(NOT_SETTLED)].filter(f => !corpus.includes(f)), []);

// ── 2. Varianten met een eigen planning ──

const BASE = 'tests/fixtures/ifc-foreign/council/r6sol-twee-werkplannen.ifc';
// De bronnen van de proeven, zoals de huidige writer ze schrijft (`settle`, fixronde 2 van #867): zonder wijziging komen
// ze door de leesverliestoets, dus meet elke proef hieronder alleen haar eigen waarde.
const settledText = async (bytes: Uint8Array) => new TextDecoder().decode(await settle(bytes));
const baseText = await settledText(read(BASE));
const eigen = await settledText(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
const r4 = await settledText(read('tests/fixtures/ifc-foreign/council/r4-k1.ifc'));
/** Een wand van Revit, zodat een eigen voorbeeld een vreemd deel heeft. */
const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);",
  "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);",
  '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);',
  "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
/** Voeg regels toe vóór de laatste `ENDSEC;`. */
const withLines = (src: string, lines: readonly string[]) => {
  const at = src.lastIndexOf('ENDSEC;');
  return `${src.slice(0, at)}${lines.map(l => `${l}\n`).join('')}${src.slice(at)}`;
};
/** Vervang de regel die met `prefix` begint (of haal hem weg met `null`). */
const replaceLine = (src: string, prefix: string, line: string | null) => {
  const lines = src.split('\n');
  const k = lines.findIndex(l => l.startsWith(prefix));
  if (k < 0) throw new Error(`geen regel ${prefix}`);
  if (line === null) lines.splice(k, 1); else lines[k] = line;
  return lines.join('\n');
};
/** De showcase met een wand van Revit, zoals de writer haar schrijft. */
const showcaseApp = await settledText(enc.encode(withLines(new TextDecoder().decode(read('public/examples/showcase-appartementencomplex.ifc')), REVIT_WALL)));

// 2a. Een tweede live-schema van Revit (#907) met een eigen taak (#909) in zijn eigen IfcRelNests en
// IfcRelAssignsToControl, onder het tweede werkplan (#906). Zoals het tweede schema in `bonsai-4d.ifc`.
// De nieuwe eigen taken hieronder hebben de tijden van taak #57 (#56): met een dag van 07:00 tot 16:00 zou de lezer de
// kalender als uurkalender van 9 uur lezen, en dan draagt hij `HoursPerDay` van de bron niet (de leesverliestoets weigert).
const SECOND_SCHEDULE = [
  "#907=IFCWORKSCHEDULE('3tweedeSchema000000000',#903,'Schema van Revit',$,$,$,'2026-08-26T20:21:10',$,$,$,$,$,'2026-09-01T07:00:00','2026-09-02T07:00:00',.PLANNED.);",
  "#908=IFCTASKTIME('Taak van het tweede schema Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,$);",
  "#909=IFCTASK('3tweedeTaak00000000000',#6,'Taak van het tweede schema',$,$,'2',$,$,$,.F.,$,#908,.CONSTRUCTION.);",
  "#910=IFCRELNESTS('0tweedeNest00000000000',#903,'WBS van Revit','Twee leden',#907,(#909));",
  "#911=IFCRELASSIGNSTOCONTROL('1tweedeCtrl00000000000',#903,$,$,(#909),$,#907);",
  "#912=IFCRELAGGREGATES('2tweedeAgg000000000000',#903,$,$,#906,(#907));",
];
const secondSchedule = enc.encode(withLines(baseText, SECOND_SCHEDULE));
{
  const label = 'tweede live-schema';
  const r = await roundTrip(label, secondSchedule);
  if (r) {
    const taskIds = new Set(r.opened.tasks.map(t => t.name));
    ok(`${label}: de taak van het tweede schema staat in de planning`, taskIds.has('Taak van het tweede schema'));
    const ownOf54 = [
      ...relationsOf(r.out, 'IFCRELASSIGNSTOCONTROL', 6, 4).filter(x => x.relating === '54'),
      ...relationsOf(r.out, 'IFCRELNESTS', 4, 5).filter(x => x.relating === '54'),
    ];
    ok(`${label}: het D-schema heeft een eigen control en nest`, ownOf54.length >= 2);
    eq(`${label}: de taak van het tweede schema staat niet in het D-schema`, ownOf54.filter(x => x.related.includes('909')).map(x => x.id), []);
    eq(`${label}: heropenen kiest hetzelfde D-schema`, r.reread.ifcSource?.stepIds[Object.keys(r.reread.ifcSource.stepIds).find(k => k.startsWith('ws:')) ?? ''], 54);
  }
  // Een nieuwe taak komt onder het eerste schema.
  const added = await roundTrip(`${label} + nieuwe taak`, secondSchedule, (d) => basicEdits(d).find(e => e.kind === 'taak-erbij')!.apply(d));
  if (added) {
    const newId = /#(\d+)=IFCTASK\('[^']*',#\d+,'Nieuwe taak 1b'/.exec(text(added.out))?.[1] ?? '';
    ok(`${label} + nieuwe taak: de nieuwe taak staat in de uitvoer`, newId !== '');
    ok(`${label} + nieuwe taak: onder het D-schema (nest en control)`,
      relationsOf(added.out, 'IFCRELNESTS', 4, 5).some(x => x.relating === '54' && x.related.includes(newId))
      && relationsOf(added.out, 'IFCRELASSIGNSTOCONTROL', 6, 4).some(x => x.relating === '54' && x.related.includes(newId)));
  }
}

// 2b. Het D-schema hangt alleen onder het tweede (vreemde) werkplan, zoals in `r6opus-twee-werkplannen.na.ifc`.
{
  const label = 'D-schema onder een vreemd werkplan';
  const src = withLines(replaceLine(baseText, '#55=', null), ["#907=IFCRELAGGREGATES('0schemaOnderTweede0000',#903,$,$,#906,(#54));"]);
  const r = await roundTrip(label, enc.encode(src));
  if (r) {
    eq(`${label}: geen object met twee Decomposes of Nests`, doubleMemberships(r.out), []);
    eq(`${label}: geen eigen aggregatie van het D-schema`, relationsOf(r.out, 'IFCRELAGGREGATES', 4, 5).filter(x => x.related.includes('54')).map(x => x.id), ['907']);
  }
}

// 2c. 'Proj' (§4.4): een eigen planning onder het project van een model. Het project is C, dus niet P. Het eigen werkplan
// heet zoals het project (de writer leidt die naam af). Een werkplan 'Plan' naast project 'Proj' heeft een naam die de
// writer niet terugschrijft: dat is een geval van fase 2 (sectie 5b, fixronde 1 van #867).
{
  const label = "project 'Proj'";
  const src = eigen.replace(/^(#\d+=IFCPROJECT\('[^']*',#\d+,)'[^']*'/m, "$1'Proj'").replace(/^(#\d+=IFCWORKPLAN\('[^']*',#\d+,)'[^']*'/m, "$1'Proj'");
  const bytes = enc.encode(src);
  const sourceIndex = scanStep(bytes);
  const sourceCls = classify(sourceIndex);
  let projectChunk = -1;
  for (let i = 0; i < sourceIndex.count; i++) if (sourceIndex.isEntity(i) && sourceIndex.type(i) === 'IFCPROJECT') projectChunk = i;
  ok(`${label}: in de bron is het project niet P`, projectChunk >= 0 && sourceCls.classes[projectChunk] !== 1);
  const r = await roundTrip(label, bytes);
  if (r) {
    eq(`${label}: na openen`, r.opened.project.name, 'Proj');
    eq(`${label}: één IfcProject, byte-gelijk aan de bron`, [countType(r.out, 'IFCPROJECT'), lineOf(r.out, sourceIndex.id(projectChunk))], [1, lineOf(bytes, sourceIndex.id(projectChunk))]);
    ok(`${label}: de naam staat in OPS_ProjectSettings`, text(r.out).includes("IFCPROPERTYSINGLEVALUE('ProjectName',$,IFCTEXT('Proj'),$)"));
    eq(`${label}: na herlezen`, r.reread.project.name, 'Proj');
  }
}

// 2d. Een eigen bestand van v2026.7.2 met een los IfcProject (fixronde 1 van #867, BLOKKEERT 2; besluit wrakko 9 november
// 2026). Project, eenheden en context zijn in de bron V; de gewone merge laat ze byte-gelijk staan. Na het eerste opslaan
// is het project C (`classify`: `ProjectName` in OPS_ProjectSettings), dus ook de tweede ronde is een merge: byte-gelijk,
// met één IfcProject. Met de proeven van Sol (een massa-eenheid erbij) en Terra (millimeter in plaats van meter), en die
// van wrakko: een model van een ander programma onder dat project, zoals Bonsai het schrijft.
const OLD_OWN = 'tests/planning/fixtures/oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc';
// Zonder wijziging weigert het bestand (fixronde 2): v2026.7.2 schreef resources met 9 argumenten, en de writer schrijft
// er 11. Dat is geen bekende lay-out (de lezer weet niet welk slot welk was), dus `niet-gedragen`.
await expectRefusal('v2026.7.2 zoals opgeslagen', read(OLD_OWN), 'niet-gedragen', undefined,
  /^IFCLABORRESOURCE #156: 9 argumenten → 11 argumenten, geen bekende lay-out/);
// Voor de proeven hieronder: de resources in de lay-out van nu (LongDescription, Usage, BaseCosts en BaseQuantity leeg),
// daarna `settle`.
const oldText = text(await settle(latin1(text(read(OLD_OWN)).split(',$,$,$,$,.USERDEFINED.);').join(',$,$,$,$,$,$,.USERDEFINED.);'))));
const OLD_MODEL = [
  "#9100=IFCPERSON($,'Modelleur',$,$,$,$,$,$);",
  "#9101=IFCORGANIZATION($,'IfcOpenShell',$,$,$);",
  '#9102=IFCPERSONANDORGANIZATION(#9100,#9101,$);',
  "#9103=IFCAPPLICATION(#9101,'0.8.0','Bonsai','Bonsai');",
  '#9104=IFCOWNERHISTORY(#9102,#9103,.READWRITE.,.ADDED.,1767268800,#9102,#9103,1767268800);',
  "#9105=IFCSITE('1hmdB8sWkqNaYGbHVTqH7m',#9104,'Terrein',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);",
  "#9106=IFCBUILDING('0nzaF7HzRLQiJzWJUv7jb9',#9104,'Gebouw',$,$,$,$,$,.ELEMENT.,$,$,$);",
  "#9107=IFCBUILDINGSTOREY('2Yu_ER7xRbKmEePdDO4n3l',#9104,'Begane grond',$,$,$,$,$,.ELEMENT.,0.);",
  "#9108=IFCWALL('242F3AJ$ylGv3IUzUFH5GA',#9104,'Wand A',$,$,$,$,$,$);",
  "#9109=IFCRELAGGREGATES('1CzF1RtKY7Mk4G4G19UaJf',#9104,$,$,#13,(#9105));",
  "#9110=IFCRELAGGREGATES('086uMHkomrXvegkmkDXq7n',#9104,$,$,#9105,(#9106));",
  "#9111=IFCRELAGGREGATES('086uMHkomrXvegkmkDXq7o',#9104,$,$,#9106,(#9107));",
  "#9112=IFCRELCONTAINEDINSPATIALSTRUCTURE('3e_i_5xIJ8piwr$BUMaHmD',#9104,$,$,(#9108),#9107);",
];
const OLD_VARIANTS: readonly { label: string; src: string; keep: readonly string[] }[] = [
  { label: 'v2026.7.2 met een los IfcProject', src: oldText, keep: ['7', '8', '9', '12', '13'] },
  {
    label: 'v2026.7.2 + massa-eenheid (Sol)',
    src: withLines(oldText.replace('#9=IFCUNITASSIGNMENT((#7,#8));', '#9=IFCUNITASSIGNMENT((#7,#8,#9001));'), ['#9001=IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.);']),
    keep: ['7', '8', '9', '9001', '12', '13'],
  },
  {
    label: 'v2026.7.2 in millimeter (Terra)',
    src: oldText.replace('#7=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);', '#7=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);'),
    keep: ['7', '8', '9', '12', '13'],
  },
  {
    label: 'v2026.7.2 met een model onder het project (wrakko)',
    src: withLines(oldText, OLD_MODEL),
    keep: ['7', '8', '9', '12', '13', ...OLD_MODEL.map(l => /^#(\d+)=/.exec(l)![1])],
  },
];
for (const v of OLD_VARIANTS) {
  ok(`${v.label}: de proef verandert de bron`, v === OLD_VARIANTS[0] || v.src !== oldText);
  const bytes = latin1(v.src);
  const r = await roundTrip(v.label, bytes);
  if (!r) continue;
  eq(`${v.label}: één IfcProject`, countType(r.out, 'IFCPROJECT'), 1);
  // Project, eenheden, context (en het model) byte-gelijk, met hetzelfde #id. Het project is hetzelfde object: de eigen
  // psets van het project (OPS_Project en OPS_ProjectSettings) wijzen naar #13.
  eq(`${v.label}: byte-gelijk met hetzelfde #id`, v.keep.filter(id => lineOf(r.out, id) !== lineOf(bytes, id) || !lineOf(bytes, id)), []);
  ok(`${v.label}: de psets van het project hangen aan het project van de bron (#13)`,
    relationsOf(r.out, 'IFCRELDEFINESBYPROPERTIES', 5, 4).filter(x => x.related.includes('13')).length >= 2);
  const outIndex = scanStep(r.out);
  const outCls = classify(outIndex);
  const classOf = (id: string) => { for (let i = 0; i < outIndex.count; i++) if (outIndex.isEntity(i) && outIndex.id(i) === id) return outCls.classes[i]; return -1; };
  eq(`${v.label}: na het eerste opslaan is het project C, net als eenheden en context`, ['13', '9', '12'].map(classOf), [2, 2, 2]);
  ok(`${v.label}: na herlezen nog een vreemd deel (de tweede ronde is een merge)`, r.reread.ifcSource?.foreign === true);
  eq(`${v.label}: de naam blijft`, r.reread.project.name, 'Nieuwbouw Woongebouw Parkzicht');
}
// Ook met een bewerking: hernoemen en een taak erbij, twee rondes.
{
  const bytes = latin1(oldText);
  const opened = await openForeign(bytes);
  for (const edit of basicEdits(opened)) await roundTrip(`v2026.7.2 · ${edit.label}`, bytes, edit.apply);
}

/** Een tweede taak (#908, met #907) met de GlobalId van taak #57, in dezelfde nest en control. */
function withDuplicateGuid(src: string): string {
  return withLines(src.replace(/^(#58=IFCRELNESTS\(.*,#54,)\(#57\)\);/m, '$1(#57,#908));').replace(/^(#59=IFCRELASSIGNSTOCONTROL\(.*)\(#57\),\$,#54\);/m, '$1(#57,#908),$$,#54);'),
    ["#907=IFCTASKTIME('Tweede taak met dezelfde GlobalId Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,$);",
      "#908=IFCTASK('urgPb5NfMvjfZ9SFNfwJQl',#6,'Tweede taak met dezelfde GlobalId',$,$,'2',$,$,$,.F.,$,#907,.CONSTRUCTION.);"]);
}

// 2e. CRLF met commentaar, een rauw Latin-1-byte en twee taken met dezelfde GlobalId.
{
  const crlf = baseText
    .replace("#904=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOH',#903,'Wand'", "#904=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOH',#903,/* een opmerking */'Wand'")
    .replace('#905=', '/* tussen twee stukken */\n#905=')
    .replace(/\n/g, '\r\n');
  const r = await roundTrip('CRLF met commentaar', enc.encode(crlf));
  if (r) {
    ok('CRLF met commentaar: geen los LF in de uitvoer', !/[^\r]\n/.test(text(r.out)));
    eq('CRLF met commentaar: dezelfde planning als met LF', canon(r.opened, reseed), canon(await openForeign(enc.encode(baseText)), reseed));
  }
  const [before, after] = baseText.split("#903,'Wand'");
  const raw = concat([enc.encode(`${before}#903,'Wand`), Uint8Array.of(0xe9), enc.encode(`'${after}`)]);
  const l = await roundTrip('Latin-1-byte in het model', raw);
  if (l) ok('Latin-1-byte in het model: het rauwe byte staat er nog', lineOf(l.out, '904').includes('Wandé'));

  // Twee taken met dezelfde GlobalId: de lezer leest beide, maar de writer geeft de tweede een eigen GlobalId. Die waarde
  // komt dus niet terug (fixronde 2): `niet-gedragen`, alleen op die taak.
  const dup = enc.encode(withDuplicateGuid(baseText));
  eq('dubbele GlobalId: twee taken na openen', (await openForeign(dup)).tasks.length, 2);
  await expectRefusal('twee taken met dezelfde GlobalId', dup, 'niet-gedragen', undefined,
    /^IFCTASK #908, argument 0: 'urgPb5NfMvjfZ9SFNfwJQl' → /, /^IFCTASK #908\b/);
}

// ── 3. "De eerste X": auteur en bedrijf, ook leeg ──
{
  const r = await roundTrip('model-ifc4 (eerste owner history)', read('tests/fixtures/ifc-foreign/model-ifc4.ifc'));
  if (r) {
    eq('model-ifc4: auteur en bedrijf na openen', [r.opened.project.author, r.opened.project.company], ['', '']);
    eq('model-ifc4: auteur en bedrijf na herlezen, ook leeg', [r.reread.project.author, r.reread.project.company], ['', '']);
  }
  const named = await roundTrip('model-ifc4 met auteur', read('tests/fixtures/ifc-foreign/model-ifc4.ifc'), (x) => { x.project.author = 'Ethan'; x.project.company = 'OpenAEC'; });
  if (named) eq('model-ifc4 met auteur: na herlezen', [named.reread.project.author, named.reread.project.company], ['Ethan', 'OpenAEC']);
}

// ── 4. De bewerkingen van 1b ──
// Elk zoals de writer het schrijft (`settle`); `oud-eigen-0.1-plus-model.ifc` komt daar niet door (sectie 1).
const EDIT_FILES = [
  'tests/fixtures/ifc-foreign/eigen-plus-model.ifc',
  'tests/fixtures/ifc-foreign/council/r4-k1.ifc',
  'tests/fixtures/ifc-foreign/council/r5sol-gedeelde-calendar-pset.ifc',
  'tests/fixtures/ifc-foreign/council/fix1-leeg-live-bl.ifc',
];
let edited = 0;
for (const rel of [...EDIT_FILES, 'tweede live-schema']) {
  const bytes = rel === 'tweede live-schema' ? secondSchedule : await settle(read(rel));
  const opened = await openForeign(bytes);
  for (const edit of basicEdits(opened)) {
    const r = await roundTrip(`${rel.split('/').pop()} · ${edit.label}`, bytes, edit.apply);
    if (!r) continue;
    edited++;
    if (edit.kind === 'hernoemen') ok(`${rel} · hernoemen: zichtbaar na herlezen`, r.reread.tasks.some(t => t.name === 'Hernoemd in 1b'));
    if (edit.kind === 'taak-erbij') ok(`${rel} · taak erbij: zichtbaar na herlezen`, r.reread.tasks.some(t => t.name === 'Nieuwe taak 1b'));
  }
}

// ── 5. Elk geval van merge-needs-phase2 ──
/** De merge weigert met `kind` (en een geval dat `detail` noemt). Met `only`: elk geval `niet-gedragen` noemt `only`, dus de
 *  proef meet alleen haar eigen waarde. */
async function expectRefusal(label: string, bytes: Uint8Array, kind: string, edit?: (d: Domain) => void, detail?: RegExp, only?: RegExp) {
  let opened: Opened;
  try { opened = await openForeign(bytes); } catch (e) { diffs.push(`${label}: openen faalt (${(e as Error).message.slice(0, 120)})`); checks++; return; }
  if (!opened.ifcSource?.foreign) { diffs.push(`${label}: geen vreemd deel`); checks++; return; }
  const d = cloneDomain(opened);
  edit?.(d);
  let error: unknown;
  let parts: Uint8Array[] | undefined;
  try { parts = writeIfcMerge(d, opened.ifcSource); } catch (e) { error = e; }
  ok(`${label}: geeft niets terug`, parts === undefined);
  ok(`${label}: MergeNeedsPhase2Error met code merge-needs-phase2`, error instanceof MergeNeedsPhase2Error && error.code === 'merge-needs-phase2');
  if (error instanceof MergeNeedsPhase2Error) {
    eq(`${label}: het geval`, error.cases.some(c => c.kind === kind), true);
    if (detail) ok(`${label}: het geval noemt ${detail} (${error.cases.map(c => c.detail).slice(0, 3).join(' | ')})`, error.cases.some(c => c.kind === kind && (detail.test(c.detail) || detail.test(unnamed(c.detail)))));
    if (only) {
      const other = error.cases.filter(c => c.kind === 'niet-gedragen' && !only.test(unnamed(c.detail))).map(c => c.detail);
      eq(`${label}: alleen ${only}`, other.slice(0, 3), []);
    }
  }
}
/** Een melding zonder de naam van het stuk: `IFCTASK #51 (Set up site), argument 7` → `IFCTASK #51, argument 7`. */
function unnamed(detail: string): string { return detail.replace(/^([A-Z0-9]+ #\d+) \(.*?\)(?=[,:] )/, '$1'); }
/** `only` voor een proef op één stuk: het begin van `detail` (`^IFCTASK #51`). */
const pieceOf = (detail: RegExp) => new RegExp(`${/^\^[A-Z0-9]+ #\d+/.exec(detail.source)?.[0] ?? '^$'}\\b`);
await expectRefusal('vreemde herkomst (bonsai-4d)', read('tests/fixtures/ifc-foreign/bonsai-4d.ifc'), 'vreemde-herkomst');
await expectRefusal('LongDescription op een eigen taak', enc.encode(replaceLine(baseText, '#57=',
  "#57=IFCTASK('urgPb5NfMvjfZ9SFNfwJQl',#6,'Externe bronactiviteit',$,$,'1','Lange omschrijving',$,$,.F.,$,#56,.CONSTRUCTION.);")), 'niet-gedragen');
await expectRefusal('onbekende JSON-sleutel', enc.encode(eigen.replace(
  `#259=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[0,0]}'),$);`,
  `#259=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[0,0],"vendorCoordinationId":7}'),$);`)), 'niet-gedragen');
await expectRefusal('twee sleutels voor dezelfde resource', enc.encode(withLines(
  replaceLine(eigen, '#154=', "#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(#152,#153,#9001));"),
  ["#9001=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#5',$,IFCTEXT('1|UNIFORM'),$);"])), 'niet-gedragen');
await expectRefusal('taak wissen met een wand eraan', enc.encode(r4), 'verwijderd', (d) => {
  d.tasks = []; d.assignments = []; d.sequences = [];
});
// Een vreemd stuk dat naar een R-stuk wijst (de eigen IfcRelNests #58, dat bij opslaan een nieuw id krijgt, §4.3).
// Naar een eigen pset wijzen is geen geval: die pset wordt dan C en blijft byte-gelijk staan.
await expectRefusal('een vreemd stuk wijst naar een eigen relatie', enc.encode(withLines(baseText, [
  "#907=IFCRELDEFINESBYPROPERTIES('0verwijzingNaarRel0000',#903,$,$,(#904,#58),#908);",
  "#908=IFCPROPERTYSET('0vreemdePset0000000000',#903,'Pset_Vreemd',$,(#909));",
  "#909=IFCPROPERTYSINGLEVALUE('Waarde',$,IFCLABEL('x'),$);",
])), 'verwijzing-naar-p');
{
  const src = withLines(baseText, ["#907=IFCRELDEFINESBYPROPERTIES('0verwijzingNaarPset000',#903,$,$,(#904),#65);"]);
  await roundTrip('een vreemde relatie naar een eigen pset (de pset wordt C)', enc.encode(src));
}
await expectRefusal('een taak uit het tweede schema verplaatsen', secondSchedule, 'verplaatst', (d) => {
  const first = d.tasks.find(t => t.name === 'Externe bronactiviteit')!;
  const second = d.tasks.find(t => t.name === 'Taak van het tweede schema')!;
  second.parentId = first.id;
  first.childIds = [second.id];
});
await expectRefusal('de gedeelde kalender wijzigen', await settle(read('tests/fixtures/ifc-foreign/council/r5sol-gedeelde-calendar-pset.ifc')), 'gemengde-relatie', (d) => {
  d.calendar.hoursPerDay = 7;
});
{
  // Een vreemd property-template in het eigen template `OPS_CustomFields` (een vreemd lid, §4.2). Zonder wijziging hangt
  // het weer aan het template; wist de planner alle eigen velden, dan schrijft de writer het template niet meer.
  const src = enc.encode(withLines(replaceLine(showcaseApp, '#1572=',
    "#1572=IFCPROPERTYSETTEMPLATE('21BEfWwU0ulhEEz0WA5oeQ',#6,'OPS_CustomFields',$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(#1569,#1570,#1571,#9001));"),
  ["#9001=IFCSIMPLEPROPERTYTEMPLATE('0vreemdVeld00000000000',#6,'VendorVeld',$,.P_SINGLEVALUE.,'IfcLabel',$,$,$,$,$,$);"]));
  const r = await roundTrip('vreemd lid in een eigen template', src);
  if (r) ok('vreemd lid in een eigen template: het eigen template noemt het lid', /IFCPROPERTYSETTEMPLATE\('21BEfWwU0ulhEEz0WA5oeQ'[^;]*#9001\)/.test(text(r.out)));
  await expectRefusal('vreemd lid in een template dat de writer niet meer schrijft', src, 'vreemd-lid', (d) => {
    d.customFieldDefs = [];
    for (const t of d.tasks) delete t.customFields;
  });
}
{
  // Een wand van het model wijst naar de resource 'Bricklayers' (#110, IfcLaborResource). Zonder wijziging blijft die
  // verwijzing staan; maakt de planner er materieel van, dan zou op #110 een ander entiteittype komen.
  const src = enc.encode(withLines(eigen, ["#9001=IFCRELASSIGNSTOPRODUCT('0vreemdNaarResource000',#331,$,$,(#110),$,#354);"]));
  await roundTrip('een wand wijst naar een resource', src);
  await expectRefusal('een resource met een verwijzing van buiten wordt materieel', src, 'entiteittype', (d) => {
    d.resources.find(r => r.name === 'Bricklayers')!.type = 'EQUIPMENT';
  });
}
{
  // Een veld met de naam van het vreemde lid ("Zone", §10): na opslaan zou de lezer het als eigen waarde lezen.
  const src = enc.encode(withLines(replaceLine(showcaseApp, '#1572=',
    "#1572=IFCPROPERTYSETTEMPLATE('21BEfWwU0ulhEEz0WA5oeQ',#6,'OPS_CustomFields',$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(#1569,#1570,#1571,#9001));"),
  ["#9001=IFCSIMPLEPROPERTYTEMPLATE('0vreemdVeld00000000000',#6,'VendorVeld',$,.P_SINGLEVALUE.,'IfcLabel',$,$,$,$,$,$);"]));
  await expectRefusal('de planner maakt een veld met de naam van een vreemd lid', src, 'vreemd-lid', (d) => {
    d.customFieldDefs = [...(d.customFieldDefs ?? []), { ...structuredClone(d.customFieldDefs![0]), id: 'veld-1b', name: 'VendorVeld' }];
  });
}
{
  // De laatste notitie van de taak met een vreemd lid in OPS_TaskNotes wissen: de writer schrijft die pset dan niet, en
  // de merge zet een pset met alleen het vreemde lid op dezelfde taak (met de GlobalId van de bron). De bron van de raad
  // heeft een lege lijst (`'[]'`), die de writer niet schrijft (sectie 1); hier staat er één notitie in.
  const bytes = await settle(enc.encode(new TextDecoder().decode(read('tests/fixtures/ifc-foreign/council/r7sol-vreemd-lid-bij-notitie.ifc'))
    .replace("IFCTEXT('[]')", `IFCTEXT('[{"id":"n1","text":"Bouwhek plaatsen","done":false}]')`)));
  const source = scanStep(bytes);
  const cls = classify(source);
  const member = cls.foreignMembers[0];
  const memberId = member === undefined ? '' : source.id(member);
  const r = await roundTrip('de laatste notitie wissen bij een vreemd lid', bytes, (d) => { for (const t of d.tasks) delete t.notes; });
  if (r) {
    const pset = new RegExp(`^#(\\d+)=IFCPROPERTYSET\\('[^']*',#\\d+,'OPS_TaskNotes',\\$,\\(#${memberId}\\)\\);`, 'm').exec(text(r.out));
    ok('de laatste notitie wissen: het vreemde lid staat in een eigen OPS_TaskNotes', memberId !== '' && pset !== null);
    const second = await roundTrip('de laatste notitie wissen, heropenen en opnieuw opslaan', r.out);
    if (second) ok('de laatste notitie wissen: na heropenen hangt het lid nog aan de taak', text(second.out).includes(`(#${memberId}));`));
  }
}
{
  // Alle taken wissen in een bestand met een Bonsai-baselineboom: de boom blijft (hij is niet P).
  const bytes = await settle(read('tests/fixtures/ifc-foreign/council/r5-eigen-plus-bonsai-baseline.ifc'));
  const r = await roundTrip('alle taken wissen naast een Bonsai-baseline', bytes, (d) => { d.tasks = []; d.sequences = []; d.assignments = []; });
  if (r) eq('alle taken wissen: de baselineboom staat er nog (invarianten)', mergeProblems(bytes, r.out), []);
}
{
  // Een kostenpost (5D) met een IfcRelAssignsToControl naar een taak: nooit gemengd, blijft A (§4.6). Taak wissen: §4.7.
  const src = enc.encode(withLines(baseText, [
    "#907=IFCCOSTITEM('0kostenpost00000000000',#903,'Kostenpost',$,$,$,.NOTDEFINED.,$,$);",
    "#908=IFCRELASSIGNSTOCONTROL('0kostenNaarTaak0000000',#903,$,$,(#57),$,#907);",
  ]));
  const r = await roundTrip('een kostenpost wijst naar een taak', src);
  if (r) ok('kostenpost: de taak blijft ook in het D-schema', relationsOf(r.out, 'IFCRELASSIGNSTOCONTROL', 6, 4).some(x => x.relating === '54' && x.related.includes('57')));
  await expectRefusal('kostenpost: de taak wissen', src, 'verwijderd', (d) => { d.tasks = []; d.assignments = []; d.sequences = []; });
}
{
  // Een gemengde IfcRelNests: de eigen taak #57 met als leden een eigen kind (#909) en een vreemde gebeurtenis (#910).
  const src = enc.encode(withLines(baseText.replace(/^(#59=IFCRELASSIGNSTOCONTROL\(.*)\(#57\),\$,#54\);/m, '$1(#57,#909),$$,#54);'), [
    "#908=IFCTASKTIME('Kind Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,$);",
    "#909=IFCTASK('3kindTaak0000000000000',#6,'Kind',$,$,'1.1',$,$,$,.F.,$,#908,.CONSTRUCTION.);",
    "#910=IFCEVENT('0vreemdEvent0000000000',#903,'Gebeurtenis',$,$,$,$,.NOTDEFINED.,.NOTDEFINED.,$,$);",
    "#911=IFCRELNESTS('0gemengdNest0000000000',#903,$,$,#57,(#909,#910));",
  ]));
  const r = await roundTrip('gemengde IfcRelNests', src);
  if (r) {
    eq('gemengde IfcRelNests: geen object met twee Nests', doubleMemberships(r.out), []);
    const kind = r.reread.tasks.find(t => t.name === 'Kind');
    ok('gemengde IfcRelNests: het kind houdt zijn ouder', !!kind?.parentId && r.reread.tasks.find(t => t.id === kind.parentId)?.name === 'Externe bronactiviteit');
  }
  const addChild = (before: boolean) => (d: Domain) => {
    const parent = d.tasks.find(t => t.name === 'Externe bronactiviteit')!;
    const kind = d.tasks.find(t => t.name === 'Kind')!;
    const task: Task = { ...structuredClone(kind), id: 'kind-1b', name: 'Nieuw kind', wbsCode: '1.2', resourceIds: [] };
    d.tasks.splice(d.tasks.indexOf(kind) + (before ? 0 : 1), 0, task);
    parent.childIds = before ? [task.id, ...parent.childIds] : [...parent.childIds, task.id];
  };
  const before = await roundTrip('gemengde IfcRelNests + kind vooraan', src, addChild(true));
  if (before) {
    eq('gemengde IfcRelNests + kind vooraan: geen object met twee Nests', doubleMemberships(before.out), []);
    const parent = before.reread.tasks.find(t => t.name === 'Externe bronactiviteit');
    eq('gemengde IfcRelNests + kind vooraan: de volgorde na herlezen', parent?.childIds.map(id => before.reread.tasks.find(t => t.id === id)?.name), ['Nieuw kind', 'Kind']);
  }
  await expectRefusal('gemengde IfcRelNests + kind achteraan', src, 'gemengde-relatie', addChild(false));
}
{
  // Een nieuwe wortel bovenaan in een bestand met model (§10, volgorde; Opus ronde 7).
  const bytes = enc.encode(eigen);
  await roundTrip('eigen-plus-model + nieuwe wortel bovenaan', bytes, (d) => {
    const base = d.tasks.find(t => t.childIds.length === 0)!;
    d.tasks.unshift({ ...structuredClone(base), id: 'wortel-1b', name: 'Nieuwe wortel', parentId: null, childIds: [], wbsCode: '0', resourceIds: [] });
  });
}
await expectRefusal('twee IfcProject', enc.encode(withLines(baseText, ["#907=IFCPROJECT('0tweedeProject00000000',#903,'Ander project',$,$,$,$,$,$);"])), 'meer-projecten');

// ── 5b. De verliesbewaking vergelijkt met de bron (fixronde 1 van #867, `lossCheck.ts`) ──
// BLOKKEERT 3: een dubbele GlobalId schakelt de bewaking niet uit; ze paart op het bron-#id.
const LONG_57 = "#57=IFCTASK('urgPb5NfMvjfZ9SFNfwJQl',#6,'Externe bronactiviteit',$,$,'1','Lange omschrijving',$,$,.F.,$,#56,.CONSTRUCTION.);";
await expectRefusal('LongDescription op een taak met een dubbele GlobalId', enc.encode(replaceLine(withDuplicateGuid(baseText), '#57=', LONG_57)),
  'niet-gedragen', undefined, /^IFCTASK #57, argument 6/);
// BLOKKEERT 4: een hulpentiteit via haar eigenaar (taak → IfcTaskTime, volgorde → IfcLagTime).
const TASKTIME_56 = "#56=IFCTASKTIME('Externe bronactiviteit Time',.USERDEFINED.,'Extern berekend',.WORKTIME.,'P0Y0M2D','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,$);";
await expectRefusal('IfcTaskTime #56 met de DataOrigin van een ander', enc.encode(replaceLine(baseText, '#56=', TASKTIME_56)),
  'niet-gedragen', undefined, /^IFCTASKTIME #56, argument 1/);
await expectRefusal('IfcTaskTime #56 met UserDefinedDataOrigin', enc.encode(replaceLine(baseText, '#56=', TASKTIME_56.replace('.USERDEFINED.', '.PREDICTED.'))),
  'niet-gedragen', undefined, /^IFCTASKTIME #56, argument 2/);
const withLag = (lag: string) => enc.encode(withLines(
  replaceLine(eigen, '#91=', "#91=IFCRELSEQUENCE('3PojQSwT308F3rahVEzxwR',#6,$,$,#47,#51,#9001,.FINISH_START.,$);"), [lag]));
await roundTrip('een eigen IfcLagTime', withLag("#9001=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('P1D'),.WORKTIME.);"));
await expectRefusal('IfcLagTime met de DataOrigin van een ander', withLag("#9001=IFCLAGTIME('Lag',.USERDEFINED.,'Extern berekend',IFCDURATION('P1D'),.WORKTIME.);"),
  'niet-gedragen', undefined, /^IFCLAGTIME #9001, argument 1/);
await expectRefusal('IfcLagTime met een andere naam', withLag("#9001=IFCLAGTIME('Vertraging leverancier',.PREDICTED.,$,IFCDURATION('P1D'),.WORKTIME.);"),
  'niet-gedragen', undefined, /^IFCLAGTIME #9001, argument 0/);
// BLOKKEERT 5: een property (en haar pset) die de writer weglaat. Een onbekende JSON-sleutel is verlies; een sleutel die
// de writer kent en weglaat omdat het standaardveld alles zegt (`dayMeasureIo.ts`), niet.
const analysis = (json: string) => enc.encode(withLines(baseText, [
  `#9001=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('${json}'),$);`,
  "#9002=IFCPROPERTYSET('0analyse00000000000000',#6,'OPS_Analysis',$,(#9001));",
  "#9003=IFCRELDEFINESBYPROPERTIES('0analyseRel00000000000',#6,$,$,(#57),#9002);",
]));
await expectRefusal('OPS_Analysis met een onbekende sleutel, die de writer weglaat', analysis('{"vendorCoordinationId":7}'),
  'niet-gedragen', undefined, /^IFCPROPERTYSINGLEVALUE #9001: ontbreekt in de uitvoer \('ExactFloat'\)/, /^IFC[A-Z]+ #900[123]\b/);
// Ook met alleen bekende sleutels: de writer laat de property weg omdat het standaardveld de hele dagen draagt, maar de
// property zelf komt niet terug (fixronde 2: geen vrijstelling meer voor bekende sleutels).
await expectRefusal('OPS_Analysis met alleen bekende sleutels, die de writer weglaat', analysis('{"TotalFloat":[2,null]}'),
  'niet-gedragen', undefined, /^IFCPROPERTYSINGLEVALUE #9001: ontbreekt in de uitvoer \('ExactFloat'\)/, /^IFC[A-Z]+ #900[123]\b/);
await expectRefusal('een weggelaten property met een Description', enc.encode(withLines(baseText, [
  `#9001=IFCPROPERTYSINGLEVALUE('ExactFloat','Uitleg van een ander',IFCTEXT('{"TotalFloat":[2,null]}'),$);`,
  "#9002=IFCPROPERTYSET('0analyse00000000000000',#6,'OPS_Analysis',$,(#9001));",
  "#9003=IFCRELDEFINESBYPROPERTIES('0analyseRel00000000000',#6,$,$,(#57),#9002);",
])), 'niet-gedragen', undefined, /^IFCPROPERTYSINGLEVALUE #9001: ontbreekt in de uitvoer \('ExactFloat'\)/, /^IFC[A-Z]+ #900[123]\b/);
// Het werkplan heet zoals het project; een andere naam schrijft de writer niet terug (zie 2c).
{
  const src = eigen.replace(/^(#\d+=IFCPROJECT\('[^']*',#\d+,)'[^']*'/m, "$1'Proj'").replace(/^(#\d+=IFCWORKPLAN\('[^']*',#\d+,)'[^']*'/m, "$1'Plan'");
  await expectRefusal("werkplan 'Plan' naast project 'Proj'", enc.encode(src), 'niet-gedragen', undefined, /^IFCWORKPLAN #\d+, argument 2: 'Plan' → 'Proj'/, /^IFCWORKPLAN #\d+\b/);
}
// BLOKKEERT 1, gevolg: het project is P en de eerste owner history is van de bron (C). De lezer leest auteur en bedrijf
// daar terug; een gewijzigde auteur komt dus niet terug. Zonder wijziging schrijft de merge gewoon (sectie 1).
await expectRefusal('auteur wijzigen bij een gedeelde owner history', enc.encode(baseText), 'projectgegevens', (d) => { d.project.author = 'Ethan'; });

// ── 5d. Eigen zoektocht (fixronde 1 van #867): per P-entiteittype dat de writer opnieuw schrijft een proef ──
// Elke proef zet in een eigen bestand met een vreemd deel één waarde die de writer niet terugschrijft. De merge moet
// weigeren met het juiste geval, en het geval moet het stuk en het argument noemen. De tabel staat in de PR-body.
const showcaseWithWall = (prefix: string, line: string) => enc.encode(replaceLine(showcaseApp, prefix, line));
const SEARCH: readonly { label: string; bytes: Uint8Array; kind: string; detail: RegExp; only?: RegExp }[] = [
  { label: 'IfcTask: ObjectType', kind: 'niet-gedragen', detail: /^IFCTASK #51, argument 4/,
    bytes: enc.encode(replaceLine(eigen, '#51=', "#51=IFCTASK('2bl5huCqaJNQoiPDoJLdX4',#6,'Set up site',$,'Type van Bonsai','2.1',$,$,$,.F.,$,#50,.LOGISTIC.);")) },
  { label: 'IfcRelSequence: Name', kind: 'niet-gedragen', detail: /^IFCRELSEQUENCE #91, argument 2/,
    bytes: enc.encode(replaceLine(eigen, '#91=', "#91=IFCRELSEQUENCE('3PojQSwT308F3rahVEzxwR',#6,'Relatie van Bonsai',$,#47,#51,$,.FINISH_START.,$);")) },
  { label: 'resource: LongDescription', kind: 'niet-gedragen', detail: /^IFCLABORRESOURCE #110, argument 6/,
    bytes: enc.encode(replaceLine(eigen, '#110=', "#110=IFCLABORRESOURCE('34SuBObt1dKPNSent0osWG',#6,'Bricklayers',$,$,$,'Lange omschrijving',$,$,$,.NOTDEFINED.);")) },
  { label: 'IfcWorkCalendar: ObjectType', kind: 'niet-gedragen', detail: /^IFCWORKCALENDAR #38, argument 4/,
    bytes: enc.encode(eigen.replace("#38=IFCWORKCALENDAR('2GA09wPbkE$RrSwEmUNTsf',#6,'Construction calendar NL','Standard construction calendar: Mon-Fri 07:00-16:00',$,",
      "#38=IFCWORKCALENDAR('2GA09wPbkE$RrSwEmUNTsf',#6,'Construction calendar NL','Standard construction calendar: Mon-Fri 07:00-16:00','Kalender van Bonsai',")) },
  { label: 'IfcWorkTime: label van de werkweek', kind: 'niet-gedragen', detail: /^IFCWORKTIME #19, argument 0/,
    bytes: enc.encode(replaceLine(eigen, '#19=', "#19=IFCWORKTIME('Werkweek van Bonsai',.PREDICTED.,$,#18,$,$);")) },
  { label: 'IfcRecurrencePattern: Interval', kind: 'niet-gedragen', detail: /^IFCRECURRENCEPATTERN #18, argument 5/,
    bytes: enc.encode(replaceLine(eigen, '#18=', '#18=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,2,$,(#17));')) },
  // De lezer sorteert de blokken (en leest de kalender dan met 8,5 uur als uurkalender: `HoursPerDay` komt ook niet terug).
  { label: 'IfcTimePeriod: de volgorde van de blokken', kind: 'niet-gedragen', detail: /^IFCRECURRENCEPATTERN #18, argument 7: \(#17,#9001\) → /,
    only: /^IFC(RECURRENCEPATTERN #18|PROPERTYSET #40|PROPERTYSINGLEVALUE #39)\b/,
    bytes: enc.encode(withLines(replaceLine(replaceLine(eigen, '#17=', "#17=IFCTIMEPERIOD('12:30:00','16:00:00');"),
      '#18=', '#18=IFCRECURRENCEPATTERN(.WEEKLY.,$,(1,2,3,4,5),$,$,$,$,(#17,#9001));'), ["#9001=IFCTIMEPERIOD('07:00:00','12:00:00');"])) },
  { label: 'live IfcWorkSchedule: Name', kind: 'niet-gedragen', detail: /^IFCWORKSCHEDULE #43, argument 2/,
    // `split`/`join`, geen `replace`: in een vervangtekst is `$'` een patroon (het GlobalId eindigt op `$`).
    bytes: enc.encode(eigen.split("#43=IFCWORKSCHEDULE('1xkfxg8DBe_v6M7NKbP40$',#6,'Construction schedule v1.0',").join("#43=IFCWORKSCHEDULE('1xkfxg8DBe_v6M7NKbP40$',#6,'Uitvoering',")) },
  { label: 'baseline (IfcWorkSchedule .BASELINE.): Purpose', kind: 'niet-gedragen', detail: /^IFCWORKSCHEDULE #44, argument 8/,
    bytes: enc.encode(eigen.replace("'Baseline plan',$,$,$,'2026-10-26T11:31:06.855Z',$,$,", "'Baseline plan',$,$,$,'2026-10-26T11:31:06.855Z',$,'Contract',")) },
  { label: 'IfcRelNests: Name', kind: 'niet-gedragen', detail: /^IFCRELNESTS #86, argument 2/,
    bytes: enc.encode(replaceLine(eigen, '#86=', "#86=IFCRELNESTS('019zaG0nTwHMAjntv3hgaB',#6,'Indeling van Bonsai',$,#49,(#51,#53));")) },
  { label: 'IfcRelAssignsToProcess: Description', kind: 'niet-gedragen', detail: /^IFCRELASSIGNSTOPROCESS #145, argument 3/,
    bytes: enc.encode(replaceLine(eigen, '#145=', "#145=IFCRELASSIGNSTOPROCESS('0qaSpDMFm3_b9f8mO9$CFm',#6,$,'Toewijzing van Bonsai',(#109,#110),$,#63,$);")) },
  { label: 'IfcRelAggregates: Name', kind: 'niet-gedragen', detail: /^IFCRELAGGREGATES #45, argument 2/,
    bytes: enc.encode(replaceLine(eigen, '#45=', "#45=IFCRELAGGREGATES('3r_tvuxgJO4K6Bs7LAtOAp',#6,'Indeling',$,#42,(#43,#44));")) },
  { label: 'IfcOwnerHistory: State', kind: 'niet-gedragen', detail: /^IFCOWNERHISTORY #6, argument 2/,
    bytes: enc.encode(replaceLine(r4, '#6=', '#6=IFCOWNERHISTORY(#3,#5,.READWRITE.,.NOCHANGE.,$,$,$,1787775670);')) },
  // In r4-k1 is de persoon C (ook een vreemde IfcPersonAndOrganization wijst ernaar); in de showcase is hij P.
  { label: 'IfcPerson: GivenName', kind: 'niet-gedragen', detail: /^IFCPERSON #1, argument 2/,
    bytes: showcaseWithWall('#1=', "#1=IFCPERSON($,'Project director','Jan',$,$,$,$,$);") },
  { label: 'IfcPersonAndOrganization: Roles', kind: 'niet-gedragen', detail: /^IFCPERSONANDORGANIZATION #3, argument 2/,
    bytes: enc.encode(withLines(replaceLine(showcaseApp, '#3=', '#3=IFCPERSONANDORGANIZATION(#1,#2,(#90007));'), ['#90007=IFCACTORROLE(.ARCHITECT.,$,$);'])) },
  { label: 'IfcApplication: ApplicationFullName', kind: 'niet-gedragen', detail: /^IFCAPPLICATION #5, argument 2/,
    bytes: enc.encode(replaceLine(r4, '#5=', "#5=IFCAPPLICATION(#4,'0.1','Open Planner Studio (bewerkt)','OPS');")) },
  { label: 'IfcProject (P): LongName', kind: 'niet-gedragen', detail: /^IFCPROJECT #13, argument 5/,
    bytes: enc.encode(replaceLine(r4, '#13=', "#13=IFCPROJECT('Q$fb4XQXzz2tLNCnyhvp85',#6,'Review bronproject',$,$,'Lange naam',$,(#12),#9);")) },
  { label: 'eenheden van een eigen project: een eenheid erbij', kind: 'niet-gedragen', detail: /^IFCSIUNIT #9001: ontbreekt in de uitvoer/,
    only: /^IFC(SIUNIT #9001|UNITASSIGNMENT #9)\b/,
    bytes: enc.encode(withLines(replaceLine(r4, '#9=', '#9=IFCUNITASSIGNMENT((#7,#8,#9001));'), ['#9001=IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.);'])) },
  { label: 'context van een eigen project: Precision', kind: 'niet-gedragen', detail: /^IFCGEOMETRICREPRESENTATIONCONTEXT #12, argument 3/,
    bytes: enc.encode(replaceLine(r4, '#12=', "#12=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-03,#11,$);")) },
  { label: 'IfcPropertySet: Description', kind: 'niet-gedragen', detail: /^IFCPROPERTYSET #260, argument 3/,
    bytes: enc.encode(replaceLine(eigen, '#260=', "#260=IFCPROPERTYSET('01AsvZxUljmG1vHQZTRE5x',#6,'OPS_Analysis','Uitleg van een ander',(#259));")) },
  { label: 'property: Unit', kind: 'niet-gedragen', detail: /^IFCPROPERTYSINGLEVALUE #259, argument 3/,
    bytes: enc.encode(replaceLine(eigen, '#259=', `#259=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[0,0]}'),#7);`)) },
  { label: 'IfcSimplePropertyTemplate: Description', kind: 'niet-gedragen', detail: /^IFCSIMPLEPROPERTYTEMPLATE #1569, argument 3/,
    bytes: showcaseWithWall('#1569=', "#1569=IFCSIMPLEPROPERTYTEMPLATE('0aOuJjC800sy1ONQtwIfSB',#6,'Cost estimate','Uitleg van een ander',.P_SINGLEVALUE.,'IfcMonetaryMeasure',$,$,$,$,$,$);") },
  { label: 'IfcPropertySetTemplate: ApplicableEntity', kind: 'niet-gedragen', detail: /^IFCPROPERTYSETTEMPLATE #1572, argument 5/,
    bytes: showcaseWithWall('#1572=', "#1572=IFCPROPERTYSETTEMPLATE('21BEfWwU0ulhEEz0WA5oeQ',#6,'OPS_CustomFields',$,.PSET_OCCURRENCEDRIVEN.,'IfcTask,IfcProcedure',(#1569,#1570,#1571));") },
  { label: 'IfcPropertyEnumeration: Unit', kind: 'niet-gedragen', detail: /^IFCPROPERTYENUMERATION #1573, argument 2/,
    bytes: showcaseWithWall('#1573=', "#1573=IFCPROPERTYENUMERATION('Tower',(IFCLABEL('A'),IFCLABEL('B'),IFCLABEL('C'),IFCLABEL('GEN')),#7);") },
  { label: 'IfcPropertyEnumeratedValue: Description', kind: 'niet-gedragen', detail: /^IFCPROPERTYENUMERATEDVALUE #1579, argument 1/,
    bytes: showcaseWithWall('#1579=', "#1579=IFCPROPERTYENUMERATEDVALUE('Tower',IFCTEXT('Uitleg van een ander'),(IFCLABEL('GEN')),$);") },
  { label: 'IfcRelDeclares: Name', kind: 'niet-gedragen', detail: /^IFCRELDECLARES #1578, argument 2/,
    bytes: showcaseWithWall('#1578=', "#1578=IFCRELDECLARES('0a64cPJBj3TA5$K6E0K85k',#6,'Templates',$,#13,(#1572,#1577));") },
  { label: 'IfcRelAssignsToControl: Name', kind: 'niet-gedragen', detail: /^IFCRELASSIGNSTOCONTROL #174, argument 2/,
    bytes: enc.encode(replaceLine(eigen, '#174=', "#174=IFCRELASSIGNSTOCONTROL('3zl3akoXTe88uDKhkyNOSy',#6,'Schema',$,(#47,#49,#51,#53,#55,#57,#59,#61,#63,#65,#67,#69,#71,#73,#75,#77,#79,#81,#83,#85),$,#43);")) },
  { label: 'IfcRelDefinesByProperties: Name', kind: 'niet-gedragen', detail: /^IFCRELDEFINESBYPROPERTIES #261, argument 2/,
    bytes: enc.encode(replaceLine(eigen, '#261=', "#261=IFCRELDEFINESBYPROPERTIES('3UIq0yU221UujFF9jqIDdV',#6,'Analyse',$,(#47),#260);")) },
  { label: 'IfcOrganization: Identification', kind: 'niet-gedragen', detail: /^IFCORGANIZATION #2, argument 0/,
    bytes: enc.encode(replaceLine(r4, '#2=', "#2=IFCORGANIZATION('KvK 123',$,$,$,$);")) },
  { label: 'IfcSIUnit: Prefix', kind: 'niet-gedragen', detail: /^IFCSIUNIT #7, argument 2/,
    bytes: enc.encode(replaceLine(r4, '#7=', '#7=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);')) },
  { label: 'IfcCartesianPoint van de context: Coordinates', kind: 'niet-gedragen', detail: /^IFCCARTESIANPOINT #10, argument 0/,
    bytes: enc.encode(replaceLine(r4, '#10=', '#10=IFCCARTESIANPOINT((1.,0.,0.));')) },
  { label: 'IfcAxis2Placement3D van de context: RefDirection', kind: 'niet-gedragen', detail: /^IFCAXIS2PLACEMENT3D #11, argument 2/,
    bytes: enc.encode(withLines(replaceLine(r4, '#11=', '#11=IFCAXIS2PLACEMENT3D(#10,$,#9002);'), ['#9002=IFCDIRECTION((1.,0.,0.));'])) },
];
// Zonder wijziging schrijft de merge elk van deze bestanden (de proef meet dus alleen de ene waarde).
await roundTrip('zoektocht: eigen-plus-model zonder wijziging', enc.encode(eigen));
await roundTrip('zoektocht: r4-k1 zonder wijziging', enc.encode(r4));
await roundTrip('zoektocht: showcase met een wand van Revit', enc.encode(showcaseApp));
{
  // Een gedeelde persoon (C) blijft byte-gelijk staan, maar de eigen owner history wijst daarna naar de persoon van de
  // writer, zonder GivenName (fixronde 2: een verwijzing naar een niet-P-doel telt mee, via de gekoppelde kopie).
  const k1Jan = enc.encode(replaceLine(r4, '#1=', "#1=IFCPERSON($,'','Jan',$,$,$,$,$);"));
  await expectRefusal('zoektocht: r4-k1 met een GivenName op de gedeelde persoon', k1Jan, 'niet-gedragen', undefined,
    /^IFCPERSON #1, argument 2: 'Jan' → \$/, /^IFCPERSON #1\b/);
}
for (const t of SEARCH) await expectRefusal(`zoektocht: ${t.label}`, t.bytes, t.kind, undefined, t.detail, t.only ?? pieceOf(t.detail));

// ── 5c. BLOKKEERT 1: de vier projectvelden alleen bij een project dat niet P is ──
// Een eigen bestand zonder model met `ProjectName` in OPS_ProjectSettings (de proef van de reviewers). Met de flag aan is
// het project P: de lezer leest de naam uit het IfcProject, zoals main, en Opslaan is de gewone writer. Met de flag uit
// bewaakt `check-ifc-foreign-pariteit.ts` hetzelfde tegen de uitvoer van main zelf.
for (const name of ['showcase-verbouwing-eengezinswoning.ifc', '03-kantoorgebouw-zuidas.ifc']) {
  const bytes = read(`tests/planning/fixtures/projectnaam-in-settings/${name}`);
  const label = `${name} met ProjectName`;
  const opened = await openForeign(bytes);
  const plain = readIFC(new TextDecoder().decode(bytes));
  ok(`${label}: geen vreemd deel (het project is P)`, opened.ifcSource?.foreign === false);
  eq(`${label}: de naam komt uit het IfcProject, zoals main`, opened.project.name, plain.project.name);
  ok(`${label}: niet de naam uit OPS_ProjectSettings`, opened.project.name !== 'Naam van een ander programma');
  reseed(0x1b01);
  const saved = concat(writeIfcMerge(cloneDomain(opened), opened.ifcSource!));
  reseed(0x1b01);
  const main = enc.encode(writeIFC(cloneDomain(plain as Opened)));
  ok(`${label}: Opslaan is de gewone writer, gelijk aan de lezer van main`, sameBytes(saved, main));
}
{
  // De merge schrijft de vier velden alleen als het project van de bron niet P is (`projectSourceId`). In r4-k1 is het
  // project P (de writer schrijft het opnieuw); in eigen-plus-model is het C (het model hangt eronder).
  for (const [label, src, want] of [['r4-k1 (project P)', r4, false], ['eigen-plus-model (project C)', eigen, true]] as const) {
    const opened = await openForeign(enc.encode(src));
    const outcome = tryMerge(cloneDomain(opened), opened.ifcSource!);
    if (!outcome.ok) { diffs.push(`${label}: de merge weigert (${outcome.error.cases.map(c => c.detail).slice(0, 2).join(' | ')})`); checks++; continue; }
    const saved = text(outcome.bytes);
    eq(`${label}: de merge schrijft ProjectName in OPS_ProjectSettings`, saved.includes("IFCPROPERTYSINGLEVALUE('ProjectName'"), want);
  }
}

// ── 5e. Fixronde 2 van #867: de negen tegenvoorbeelden van ronde 2 ──
// Elk op de concrete bronwaarde, zonder bewerking: de lezer draagt het veld niet, dus `niet-gedragen` op precies dat stuk.
// Rood op `2848638cc` (daar schreef de merge ze, en ging de waarde stil verloren). Met een domeinveld erbij ook de
// bewuste bewerking van hetzelfde veld: vanuit een bron die de lezer wel draagt, schrijft de merge de nieuwe waarde.
const replaceIn = (src: string, from: string, to: string) => {
  if (!src.includes(from)) throw new Error(`geen ${from.slice(0, 60)}`);
  return src.split(from).join(to); // `split`/`join`: geen vervangpatronen (`$'`) in de tekst
};
const TASK_51 = "#51=IFCTASK('2bl5huCqaJNQoiPDoJLdX4',#6,'Set up site',$,$,'2.1',$,$,$,.F.,$,#50,.LOGISTIC.);";
const TIME_50 = "#50=IFCTASKTIME('Set up site Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D',";
const COUNTER: readonly { label: string; bytes: Uint8Array; detail: RegExp; only: RegExp }[] = [
  { label: 'B1 (Terra): IfcTask.Status', detail: /^IFCTASK #51, argument 7: 'ON HOLD' → \$/, only: /^IFCTASK #51\b/,
    bytes: enc.encode(replaceIn(eigen, TASK_51, TASK_51.replace("'2.1',$,$,$,", "'2.1',$,'ON HOLD',$,"))) },
  { label: 'B1 (Terra): IfcTaskTime.DurationType', detail: /^IFCTASKTIME #50, argument 3: \.NOTDEFINED\. → \.WORKTIME\./, only: /^IFCTASKTIME #50\b/,
    bytes: enc.encode(replaceIn(eigen, TIME_50, TIME_50.replace('.WORKTIME.', '.NOTDEFINED.'))) },
  // Met uren in de duur leest de lezer de kalender als uurkalender: ook `HoursPerDay` (#39 in #40) komt niet terug.
  { label: 'B1 (Terra): IfcTaskTime.ScheduleDuration P2DT12H', detail: /^IFCTASKTIME #50, argument 4: 'P2DT12H' → /,
    only: /^IFC(TASKTIME #50|PROPERTYSET #40|PROPERTYSINGLEVALUE #39)\b/,
    bytes: enc.encode(replaceIn(eigen, TIME_50, TIME_50.replace("'P0Y0M2D'", "'P2DT12H'"))) },
  { label: 'B1 (Sol): IfcWorkSchedule #43.PredefinedType', detail: /^IFCWORKSCHEDULE #43, argument 13: \.ACTUAL\. → \.PLANNED\./, only: /^IFCWORKSCHEDULE #43\b/,
    bytes: enc.encode(replaceIn(eigen, "'2027-05-07T07:00:00','2027-07-07T07:00:00',.PLANNED.);\n#44=", "'2027-05-07T07:00:00','2027-07-07T07:00:00',.ACTUAL.);\n#44=")) },
  { label: "B1 (Sol): IfcPropertyEnumeration #1573 met IFCLABEL('VENDOR')", detail: /^IFCPROPERTYENUMERATION #1573, argument 1: \(IFCLABEL\('A'\),IFCLABEL\('B'\),IFCLABEL\('C'\),IFCLABEL\('GEN'\),I → \(IFCLABEL\('A'\),IFCLABEL\('B'\),IFCLABEL\('C'\),IFCLABEL\('GEN'\)\)$/,
    only: /^IFCPROPERTYENUMERATION #1573\b/,
    bytes: showcaseWithWall('#1573=', "#1573=IFCPROPERTYENUMERATION('Tower',(IFCLABEL('A'),IFCLABEL('B'),IFCLABEL('C'),IFCLABEL('GEN'),IFCLABEL('VENDOR')),$);") },
  { label: 'B2 (Sol): IfcPropertyEnumeratedValue #1579 met twee waarden',
    detail: /^IFCPROPERTYENUMERATEDVALUE #1579, argument 2: \(IFCLABEL\('GEN'\),IFCLABEL\('A'\)\) → \(IFCLABEL\('GEN'\)\)/, only: /^IFCPROPERTYENUMERATEDVALUE #1579\b/,
    bytes: showcaseWithWall('#1579=', "#1579=IFCPROPERTYENUMERATEDVALUE('Tower',$,(IFCLABEL('GEN'),IFCLABEL('A')),$);") },
  { label: 'B3 (Terra): ExactFloat [3,1440,"BEWAAR-DIT"]', detail: /^IFCPROPERTYSINGLEVALUE #259\b/, only: /^IFC[A-Z]+ #(259|260|261)\b/,
    bytes: enc.encode(replaceIn(eigen, `IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[0,0]}'),$);\n#260=`, `IFCTEXT('{"TotalFloat":[3,1440,"BEWAAR-DIT"],"FreeFloat":[0,0]}'),$);\n#260=`)) },
  { label: 'B3 (Sol): ExactFloat [2,null,867] op taak #51', detail: /^IFCPROPERTYSINGLEVALUE #265\b/, only: /^IFC[A-Z]+ #(265|266|267)\b/,
    bytes: enc.encode(replaceIn(eigen, `IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[3,1440]}'),$);\n#266=`, `IFCTEXT('{"TotalFloat":[2,null,867]}'),$);\n#266=`)) },
  { label: 'B3 (Sol): ExactFloat [867] op taak #51', detail: /^IFCPROPERTYSINGLEVALUE #265\b/, only: /^IFC[A-Z]+ #(265|266|267)\b/,
    bytes: enc.encode(replaceIn(eigen, `IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[3,1440]}'),$);\n#266=`, `IFCTEXT('{"TotalFloat":[867]}'),$);\n#266=`)) },
  // B4: de massa-eenheid is C (een vreemde property op de wand wijst ernaar); haar lidmaatschap van de projecteenheden
  // (P) ging verloren. Nu vergelijkt de toets ook verwijzingen naar niet-P-doelen.
  { label: 'B4 (Sol): een gedeelde eenheid in de projecteenheden', detail: /^IFCUNITASSIGNMENT #9, argument 0: \(#7,#8,#9001\) → /, only: /^IFCUNITASSIGNMENT #9\b/,
    bytes: enc.encode(withLines(replaceLine(r4, '#9=', '#9=IFCUNITASSIGNMENT((#7,#8,#9001));'), [
      '#9001=IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.);',
      "#9002=IFCPROPERTYSINGLEVALUE('VendorMass',$,IFCMASSMEASURE(12.5),#9001);",
      "#9003=IFCPROPERTYSET('0vendorMassPset0000000',#903,'Pset_Vendor',$,(#9002));",
      "#9004=IFCRELDEFINESBYPROPERTIES('0vendorMassRel00000000',#903,$,$,(#904),#9003);",
    ])) },
];
{
  const b4 = COUNTER[COUNTER.length - 1].bytes;
  const index = scanStep(b4);
  ok('B4: de massa-eenheid is C in de bron', classify(index).classes[index.chunkOf('9001')] === 2);
}
for (const t of COUNTER) await expectRefusal(`tegenvoorbeeld ${t.label}`, t.bytes, 'niet-gedragen', undefined, t.detail, t.only);

// De bewuste bewerking van hetzelfde veld, vanuit de bron die de lezer draagt (`eigen`, `showcaseApp`).
const taskNamed = (d: Domain, name: string) => d.tasks.find(t => t.name === name)!;
{
  const r = await roundTrip('bewerking: Status (een lopende taak op 100 %)', enc.encode(eigen), (d) => {
    const t = taskNamed(d, 'Set up site');
    t.status = 'STARTED';
    t.time.completion = 1;
    delete t.time.actualFinish;
  });
  if (r) ok("bewerking: Status: taak #51 krijgt 'STARTED'", lineOf(r.out, '51').includes("'2.1',$,'STARTED',"));
}
{
  const r = await roundTrip('bewerking: DurationType', enc.encode(eigen), (d) => { taskNamed(d, 'Set up site').time.durationType = 'ELAPSEDTIME'; });
  if (r) ok('bewerking: DurationType: de taaktijd van #51 is .ELAPSEDTIME.', /^#\d+=IFCTASKTIME\('Set up site Time',\.PREDICTED\.,\$,\.ELAPSEDTIME\./m.test(text(r.out)));
}
{
  const r = await roundTrip('bewerking: ScheduleDuration', enc.encode(eigen), (d) => {
    const time = taskNamed(d, 'Set up site').time;
    time.scheduleDuration += 1;
    if (time.durationMinutes !== undefined) time.durationMinutes += 480;
  });
  if (r) ok('bewerking: ScheduleDuration: de taaktijd van #51 krijgt de nieuwe duur', /^#\d+=IFCTASKTIME\('Set up site Time',[^;]*'P0Y0M3D'/m.test(text(r.out)));
}
// IfcWorkSchedule.PredefinedType en de projecteenheden (B4) hebben geen domeinveld: de planner kan ze niet bewerken.
{
  const r = await roundTrip('bewerking: een waarde erbij in de enumeratie Tower', enc.encode(showcaseApp), (d) => {
    const tower = d.activityCodeTypes!.find(t => t.name === 'Tower')!;
    tower.values.push({ ...structuredClone(tower.values[0]), id: 'acv-1b', code: 'D' });
  });
  if (r) ok("bewerking: enumeratie: Tower noemt IFCLABEL('D')", /IFCPROPERTYENUMERATION\('Tower',\([^;]*IFCLABEL\('D'\)\)/.test(text(r.out)));
}
{
  const r = await roundTrip('bewerking: de waarde van Tower op een taak', enc.encode(showcaseApp), (d) => {
    const tower = d.activityCodeTypes!.find(t => t.name === 'Tower')!;
    const gen = tower.values.find(v => v.code === 'GEN')!;
    const a = tower.values.find(v => v.code === 'A')!;
    const task = d.tasks.find(t => t.activityCodes?.[tower.id] === gen.id)!;
    task.activityCodes![tower.id] = a.id;
  });
  const count = (s: string, x: string) => s.split(x).length - 1;
  const a = "IFCPROPERTYENUMERATEDVALUE('Tower',$,(IFCLABEL('A')),$)";
  if (r) eq("bewerking: enumeratiewaarde: één taak meer met IFCLABEL('A')", count(text(r.out), a), count(showcaseApp, a) + 1);
}
{
  const r = await roundTrip('bewerking: de speling van een taak', enc.encode(eigen), (d) => {
    const time = taskNamed(d, 'Set up site').time;
    time.totalFloat = 4.5;
    time.totalFloatMinutes = 2160;
  });
  if (r) ok('bewerking: speling: ExactFloat van #51 is [4.5,2160]', text(r.out).includes(`"TotalFloat":[4.5,2160]`));
}

// ── 5f. De normalisaties (`lossCheck.ts`, kop): elk met de reden waarom de waarde gelijk blijft ──
// getal: elke STEP-lezer leest `8`, `8.` en `8.0E0` als hetzelfde getal; het type komt uit het schema of `IFCREAL(…)`.
eq('normalisatie getal', [sameNumber('8', '8.'), sameNumber('8.', '8.0'), sameNumber('1.E0', '1.'), sameNumber('0.1', '0.10'), sameNumber('8', '9'), sameNumber('8.', '$')],
  [true, true, true, true, false, false]);
ok("normalisatie getal: de bron heeft IFCREAL(8), de writer schrijft IFCREAL(8.), en de merge schrijft (sectie 2)", baseText.includes("'HoursPerDay',$,IFCREAL(8),$)"));
// duur: dezelfde onderdelen (jaren, maanden, weken, dagen, uren, minuten, seconden), een 0 telt als afwezig. Een dag is
// geen 24 uur (een werkdag) en wordt dus nooit gelijk aan uren.
eq('normalisatie duur', [sameDuration('PT12H', 'PT12H0M0S'), sameDuration('P0Y0M2D', 'P2D'), sameDuration('P2DT12H', 'PT12H0M0S'),
  sameDuration('P1D', 'PT24H'), sameDuration('P0.5D', 'P0,5D'), sameDuration('P2D', 'P3D')], [true, true, false, false, true, false]);
// tekst: dezelfde tekens na het decoderen; `\X2\00E9\X0\` en een rauw UTF-8-teken leest elk programma als 'é'.
{
  const cafe = enc.encode(replaceIn(replaceIn(eigen, "'Set up site',$,$,'2.1'", "'Bouwplaats café',$,$,'2.1'"), "'Set up site Time'", "'Bouwplaats café Time'"));
  const r = await roundTrip('normalisatie tekst: een rauw UTF-8-teken in een taaknaam', cafe);
  if (r) ok('normalisatie tekst: de writer schrijft \\X2\\00E9\\X0\\', lineOf(r.out, '51').includes('caf\\X2\\00E9\\X0\\'));
}
// id: een hulpstuk krijgt een nieuw `#id` (de taaktijd #50 van taak #51); een `#id` is geen waarde in het bestand.
{
  const r = await roundTrip('normalisatie id', enc.encode(eigen));
  if (r) ok('normalisatie id: de taaktijd van #51 heeft een ander #id', !lineOf(r.out, '50').startsWith('#50=IFCTASKTIME') && /#51=IFCTASK\([^;]*,#\d+,\.LOGISTIC\.\);/.test(text(r.out)));
}
// lay-out: een oud werkplan met 15 argumenten (de bron van sectie 2) staat in de uitvoer met 14; elke waarde op haar
// plek in het schema. Een IfcTask zonder WorkMethod (12 argumenten) idem.
ok('lay-out (geen normalisatie): het werkplan van de bron heeft 15 argumenten', (scanStep(enc.encode(baseText)).argTokens(scanStep(enc.encode(baseText)).chunkOf('53')) ?? []).length === 15);
await roundTrip('lay-out (geen normalisatie): een IfcTask met 12 argumenten', enc.encode(replaceIn(eigen, TASK_51, TASK_51.replace("'2.1',$,$,$,.F.", "'2.1',$,$,.F."))));
// Toevoeging: een eigen pset mag properties bijkrijgen (de vier projectvelden in eigen-plus-model, sectie 5c), maar de
// properties van de bron blijven in dezelfde volgorde.
await expectRefusal('toevoeging: een pset met de properties in een andere volgorde', enc.encode(replaceIn(r4,
  "'OPS_Calendar',$,(#47,#48,#49,#50));", "'OPS_Calendar',$,(#50,#47,#48,#49));")), 'niet-gedragen', undefined,
  /^IFCPROPERTYSET #51, argument 4: \(#50,#47,#48,#49\) → /, /^IFCPROPERTYSET #51\b/);
// Schrijfvelden (geen normalisatie): de tijd van opslaan in de eigen owner history.
{
  const src = replaceIn(replaceIn(r4, '$,.NOCHANGE.,$,$,$,1787775670);', '$,.NOCHANGE.,$,$,$,1700000000);'), "IFCAPPLICATION(#4,'0.1',", "IFCAPPLICATION(#4,'0.0.9',");
  const r = await roundTrip('schrijfvelden: CreationDate van de eigen owner history en de versie van de app', enc.encode(src));
  if (r) ok('schrijfvelden: de uitvoer heeft de tijd van opslaan en de versie van nu', !text(r.out).includes(',1700000000);') && !text(r.out).includes("'0.0.9'"));
}

// ── 5g. O1: na een bewerking mag de uitvoer alleen afwijken waar het domein veranderde ──
// De writer heeft geen pad waarlangs een bewerking een veld van een ander object laat vallen (eigen zoektocht, PR-body).
// Daarom hier `lossCheck` zelf, met een O1 waarin één veld anders is: op een taak die de planner niet bewerkte →
// `niet-gedragen` "na de bewerking"; op de taak die hij wel bewerkte, of op haar taaktijd → niets.
{
  const bytes = enc.encode(eigen);
  const opened = await openForeign(bytes);
  const source = opened.ifcSource!;
  const index = scanStep(bytes);
  const cls = classify(index);
  const ids = mergeIdPlan(index, cls, source.stepIds, opened.calendar.id);
  const out = concat(writeIfcMerge(cloneDomain(opened), source));
  const outIndex = scanStep(out);
  const o0: OutLine[] = [];
  for (let i = 0; i < outIndex.count; i++) {
    if (!outIndex.isEntity(i)) continue;
    const line = parseOutLine(text(out.subarray(outIndex.entityStart(i), outIndex.end(i))).trim());
    if (line) o0.push(line);
  }
  const lineFor = (pred: (l: OutLine) => boolean) => o0.find(pred)!;
  const task47 = lineFor(l => l.type === 'IFCTASK' && l.id === 47);
  const task51 = lineFor(l => l.type === 'IFCTASK' && l.id === 51);
  const time47 = lineFor(l => l.id === Number(task47.args[11].slice(1)));
  const time51 = lineFor(l => l.id === Number(task51.args[11].slice(1)));
  const withArg = (line: OutLine, k: number, v: string) => o0.map(l => (l === line ? { ...l, args: l.args.map((a, j) => (j === k ? v : a)) } : l));
  const run = (o1: OutLine[], edit: (d: Domain) => void) => {
    const domain = cloneDomain(opened);
    edit(domain);
    const found: string[] = [];
    lossCheck({
      index, cls, fixed: new Set([...ids.bySource.keys(), ...ids.baselineHeads.values()]), bySource: ids.bySource, o0, o1,
      pristine: pristineDomain(index, cls, source), domain, sourceOwnerHistory: ids.sourceOwnerHistory,
      projectWritten: ids.plan.projectSourceId === undefined,
    }, f => found.push(f.detail));
    return found;
  };
  const rename47 = (d: Domain) => { d.tasks.find(t => t.name === task47.args[2].slice(1, -1))!.name = 'Hernoemd'; };
  eq('O1: zonder verschil geen melding', run(o0, rename47), []);
  eq('O1: een andere taak verliest LongDescription', run(withArg(task51, 3, "'Weg'"), rename47),
    [`IFCTASK #51, argument 3 na de bewerking: $ → 'Weg'`]);
  eq('O1: de taaktijd van een andere taak', run(withArg(time51, 1, '.MEASURED.'), rename47),
    ['IFCTASKTIME #50, argument 1 na de bewerking: .PREDICTED. → .MEASURED.']);
  eq('O1: de bewerkte taak zelf', run(withArg(task47, 3, "'Weg'"), rename47), []);
  eq('O1: de taaktijd van de bewerkte taak', run(withArg(time47, 1, '.MEASURED.'), rename47), []);
  eq('O1: zonder bewerking toetst alleen O0', run(withArg(task51, 3, "'Weg'"), () => {}), []);
}
{
  // Wel een pad in de writer (gevonden met de telling op de bestanden zoals de writer ze schrijft): de writer kiest per
  // kalender ankerdatums of `LiteralTimes`, op grond van alle taken. Wist de planner de enige taak die `LiteralTimes`
  // nodig had ('1. Preparation'), dan schrijft de writer de eindtijden van de andere taken als 07:00 in plaats van 16:00.
  // Die taken veranderden niet; een ander programma leest een andere tijd. De merge weigert.
  const bytes = await settle(read('tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'));
  const opened = await openForeign(bytes);
  const edit = plannerEdits(opened, 40).find(e => e.label === 'task-mvp6ekzlhuk71306 wissen');
  ok('O1: de taak 1. Preparation bestaat', edit !== undefined && opened.tasks.some(t => t.id === 'task-mvp6ekzlhuk71306' && t.name === '1. Preparation'));
  if (edit) {
    await expectRefusal('O1: een taak wissen verandert de tijden van andere taken', bytes, 'niet-gedragen', edit.apply,
      /^IFCTASKTIME #\d+, argument \d+ na de bewerking: '\d{4}-\d\d-\d\dT16:00:00' → '\d{4}-\d\d-\d\dT07:00:00'/,
      /^IFC(TASKTIME #\d+, argument \d+ na de bewerking|PROPERTYSET #\d+ \(OPS_Calendar\)|PROPERTYSINGLEVALUE #\d+ \(LiteralTimes\))/);
  }
}

// ── 6. De invarianten zelf ──
{
  const good = await openForeign(secondSchedule);
  const outcome = tryMerge(cloneDomain(good), good.ifcSource!);
  if (!outcome.ok) diffs.push(`invariant: de bron schrijft niet (${outcome.error.cases.map(c => c.detail).slice(0, 3).join(' | ')})`);
  const out = outcome.ok ? outcome.bytes : secondSchedule;
  const s = text(out);
  const wall = lineOf(out, '904');
  const rel = lineOf(out, '905');
  const mutations: [string, string][] = [
    ['een vreemd stuk weglaten', s.replace(`${wall}\n`, '')],
    ['een vreemd stuk een ander #id geven', s.replace('#904=IFCWALL', '#9904=IFCWALL')],
    ['twee vreemde stukken verwisselen', s.replace(`${wall}\n${rel}`, `${rel}\n${wall}`)],
    ['een byte in een vreemd stuk wijzigen', s.replace("'Wand'", "'Wanf'")],
    ['een vreemd stuk verdubbelen', s.replace(`${wall}\n`, `${wall}\n${wall}\n`)],
  ];
  for (const [label, mutated] of mutations) {
    ok(`invariant: ${label} geeft een afwijking`, mutated !== s && mergeProblems(secondSchedule, latin1(mutated)).length > 0);
  }
  eq('invariant: de echte uitvoer is schoon', mergeProblems(secondSchedule, out), []);
}

if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-preserve: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-preserve: alle checks groen (${checks}; corpus: ${written} keer geschreven, ${refused} keer getypeerd `
  + `geweigerd, ${settledOwn} eigen bestanden zoals de writer ze schrijft rond; ${edited} bewerkingen van 1b met het vreemde deel byte-gelijk)`);
process.exit(0);
