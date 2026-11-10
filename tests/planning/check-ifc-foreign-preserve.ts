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
//   5. elk geval van `merge-needs-phase2` met een kleine proef: de fout heeft de vaste code en de gevallen;
//   6. de invarianten zelf: een uitvoer met een weggelaten, verschoven, verwisseld of gewijzigd vreemd stuk is rood.
// Exit 0 = alles groen.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import {
  basicEdits, canon, cloneDomain, concat, doubleMemberships, firstDiff, mergeProblems, openForeign, sameBytes, tryMerge,
  type Domain, type Opened,
} from './ifcMergeKern';
import { MergeNeedsPhase2Error, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
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

/** Bestanden waarvan de merge zonder wijziging weigert, met de verwachte gevallen (fase 2). De rest moet schrijven. */
const REFUSED: Readonly<Record<string, readonly string[]>> = {
  // Een planning van Bonsai: werkplan, werkschema's en taken hebben de owner history van Bonsai (§4.5), en `Creators`
  // staat in een slot dat de writer leeg schrijft. Behouden kan pas met `sourceSlots` en herkomstmerken.
  'bonsai-4d.ifc': ['constant-slot', 'vreemde-herkomst'],
  'crlf-commentaar.ifc': ['constant-slot', 'vreemde-herkomst'],
  'dubbele-globalids.ifc': ['constant-slot', 'vreemde-herkomst'],
  'latin1.ifc': ['constant-slot', 'vreemde-herkomst'],
  'twee-werkplannen.ifc': ['constant-slot', 'vreemde-herkomst'],
  'council/proef-bonsai-achtig.ifc': ['constant-slot', 'vreemde-herkomst'],
  'council/r5sol-parallelle-relaties.ifc': ['constant-slot', 'vreemde-herkomst'],
  'council/r6opus-twee-werkplannen.ifc': ['constant-slot', 'vreemde-herkomst'],
  'council/r6opus-twee-werkplannen.na.ifc': ['constant-slot', 'vreemde-herkomst'],
  'council/r6sol-herkomst-na-eerste-opslag.ifc': ['constant-slot', 'vreemde-herkomst'],
  'council/r7fable-eigen-oh-planning.ifc': ['constant-slot', 'vreemde-herkomst'],
  // Kalender en psets van een ander programma (VendorOps).
  'council/fix2-vendor-ops.ifc': ['vreemde-herkomst'],
  // Plus een gemengde IfcRelAssignsToProcess die de writer anders zou schrijven.
  'council/r6sol-losse-bonsai-toewijzing.ifc': ['constant-slot', 'gemengde-relatie', 'vreemde-herkomst'],
  // Fixronde 1 van #867: het D-werkplan heet 'Tweede werkplan', niet zoals het project. De writer schrijft de projectnaam
  // in het werkplan; de naam van de bron kwam niet terug (`lossCheck.ts`, het werkplan heeft geen domeinnaam).
  'council/r6sol-twee-werkplannen-na-volgorderegel.ifc': ['constant-slot'],
};

const corpus = [
  ...readdirSync(FOREIGN).filter(f => f.endsWith('.ifc')),
  ...readdirSync(join(FOREIGN, 'council')).filter(f => f.endsWith('.ifc')).map(f => `council/${f}`),
].sort();
let written = 0;
let refused = 0;
const seenRefused = new Set<string>();
for (const file of corpus) {
  const bytes = new Uint8Array(readFileSync(join(FOREIGN, file)));
  let opened: Opened;
  try { opened = await openForeign(bytes); } catch { continue; } // het IFC2X3-model blijft geweigerd bij openen
  if (!opened.ifcSource?.foreign) continue;
  const want = REFUSED[file];
  if (want) {
    seenRefused.add(file);
    const outcome = tryMerge(cloneDomain(opened), opened.ifcSource);
    if (outcome.ok) { diffs.push(`${file}: de merge schrijft, maar weigeren werd verwacht`); checks++; continue; }
    eq(`${file}: de gevallen van de weigering`, outcome.kinds, want);
    eq(`${file}: de vaste code`, outcome.error.code, 'merge-needs-phase2');
    ok(`${file}: elk geval heeft een id en een uitleg`, outcome.error.cases.every(c => c.detail.length > 0));
    refused++;
    continue;
  }
  if (await roundTrip(file, bytes)) written++;
}
eq('corpus: elke verwachte weigering kwam voor', Object.keys(REFUSED).filter(f => !seenRefused.has(f)), []);

// ── 2. Varianten met een eigen planning ──

const BASE = 'tests/fixtures/ifc-foreign/council/r6sol-twee-werkplannen.ifc';
const baseText = new TextDecoder().decode(read(BASE));
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

// 2a. Een tweede live-schema van Revit (#907) met een eigen taak (#909) in zijn eigen IfcRelNests en
// IfcRelAssignsToControl, onder het tweede werkplan (#906). Zoals het tweede schema in `bonsai-4d.ifc`.
const SECOND_SCHEDULE = [
  "#907=IFCWORKSCHEDULE('3tweedeSchema000000000',#903,'Schema van Revit',$,$,$,'2026-08-26T20:21:10',$,$,$,$,$,'2026-09-01T07:00:00','2026-09-02T07:00:00',.PLANNED.);",
  "#908=IFCTASKTIME('Taak van het tweede schema Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M1D','2026-09-01T07:00:00','2026-09-01T16:00:00','2026-09-01T07:00:00','2026-09-01T16:00:00','2026-09-01T07:00:00','2026-09-01T16:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,0.00);",
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
  let src = new TextDecoder().decode(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  src = src.replace(/^(#\d+=IFCPROJECT\('[^']*',#\d+,)'[^']*'/m, "$1'Proj'").replace(/^(#\d+=IFCWORKPLAN\('[^']*',#\d+,)'[^']*'/m, "$1'Proj'");
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
const oldText = text(read(OLD_OWN));
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
  const bytes = read(OLD_OWN);
  const opened = await openForeign(bytes);
  for (const edit of basicEdits(opened)) await roundTrip(`v2026.7.2 · ${edit.label}`, bytes, edit.apply);
}

/** Een tweede taak (#908, met #907) met de GlobalId van taak #57, in dezelfde nest en control. */
function withDuplicateGuid(src: string): string {
  return withLines(
    replaceLine(replaceLine(src, '#58=', "#58=IFCRELNESTS('tjjP5r1vgdnD4TBHzDgTrv',#6,'WBS Hoofd',$,#54,(#57,#908));"),
      '#59=', "#59=IFCRELASSIGNSTOCONTROL('rDVhNjbXHjyDCF$VkTSruD',#6,$,$,(#57,#908),$,#54);"),
    ["#907=IFCTASKTIME('Tweede taak met dezelfde GlobalId Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M1D','2026-09-01T07:00:00','2026-09-01T16:00:00','2026-09-01T07:00:00','2026-09-01T16:00:00','2026-09-01T07:00:00','2026-09-01T16:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,0.00);",
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

  const d = await roundTrip('twee taken met dezelfde GlobalId', enc.encode(withDuplicateGuid(baseText)));
  if (d) {
    eq('dubbele GlobalId: twee taken na openen', d.opened.tasks.length, 2);
    const g57 = scanStep(d.out), find = (id: string) => { for (let i = 0; i < g57.count; i++) if (g57.isEntity(i) && g57.id(i) === id) return i; return -1; };
    ok('dubbele GlobalId: beide taken houden hun #id', g57.type(find('57')) === 'IFCTASK' && g57.type(find('908')) === 'IFCTASK');
    ok('dubbele GlobalId: de tweede krijgt een eigen GlobalId', g57.globalId(find('57')) !== g57.globalId(find('908')));
  }
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
const EDIT_FILES = [
  'tests/fixtures/ifc-foreign/eigen-plus-model.ifc',
  'tests/fixtures/ifc-foreign/oud-eigen-0.1-plus-model.ifc',
  'tests/fixtures/ifc-foreign/council/r5sol-gedeelde-calendar-pset.ifc',
  'tests/fixtures/ifc-foreign/council/fix1-leeg-live-bl.ifc',
];
let edited = 0;
for (const rel of [...EDIT_FILES, 'tweede live-schema']) {
  const bytes = rel === 'tweede live-schema' ? secondSchedule : read(rel);
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
async function expectRefusal(label: string, bytes: Uint8Array, kind: string, edit?: (d: Domain) => void, detail?: RegExp) {
  const opened = await openForeign(bytes);
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
    if (detail) ok(`${label}: het geval noemt ${detail}`, error.cases.some(c => c.kind === kind && detail.test(c.detail)));
  }
}
const eigen = new TextDecoder().decode(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
await expectRefusal('vreemde herkomst (bonsai-4d)', read('tests/fixtures/ifc-foreign/bonsai-4d.ifc'), 'vreemde-herkomst');
await expectRefusal('LongDescription op een eigen taak', enc.encode(replaceLine(baseText, '#57=',
  "#57=IFCTASK('urgPb5NfMvjfZ9SFNfwJQl',#6,'Externe bronactiviteit',$,$,'1','Lange omschrijving',$,$,.F.,$,#56,.CONSTRUCTION.);")), 'constant-slot');
await expectRefusal('onbekende JSON-sleutel', enc.encode(eigen.replace(
  `#259=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[0,0]}'),$);`,
  `#259=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('{"TotalFloat":[3,1440],"FreeFloat":[0,0],"vendorCoordinationId":7}'),$);`)), 'json-sleutel');
await expectRefusal('twee sleutels voor dezelfde resource', enc.encode(withLines(
  replaceLine(eigen, '#154=', "#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(#152,#153,#9001));"),
  ["#9001=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#5',$,IFCTEXT('1|UNIFORM'),$);"])), 'ongebruikte-sleutel');
await expectRefusal('taak wissen met een wand eraan', read('tests/fixtures/ifc-foreign/council/r4-k1.ifc'), 'verwijderd', (d) => {
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
await expectRefusal('de gedeelde kalender wijzigen', read('tests/fixtures/ifc-foreign/council/r5sol-gedeelde-calendar-pset.ifc'), 'gemengde-relatie', (d) => {
  d.calendar.hoursPerDay = 7;
});
{
  // Een vreemd property-template in het eigen template `OPS_CustomFields` (een vreemd lid, §4.2). Zonder wijziging hangt
  // het weer aan het template; wist de planner alle eigen velden, dan schrijft de writer het template niet meer.
  const showcase = new TextDecoder().decode(read('public/examples/showcase-appartementencomplex.ifc'));
  const src = enc.encode(withLines(replaceLine(showcase, '#1572=',
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
  const showcase = new TextDecoder().decode(read('public/examples/showcase-appartementencomplex.ifc'));
  const src = enc.encode(withLines(replaceLine(showcase, '#1572=',
    "#1572=IFCPROPERTYSETTEMPLATE('21BEfWwU0ulhEEz0WA5oeQ',#6,'OPS_CustomFields',$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(#1569,#1570,#1571,#9001));"),
  ["#9001=IFCSIMPLEPROPERTYTEMPLATE('0vreemdVeld00000000000',#6,'VendorVeld',$,.P_SINGLEVALUE.,'IfcLabel',$,$,$,$,$,$);"]));
  await expectRefusal('de planner maakt een veld met de naam van een vreemd lid', src, 'vreemd-lid', (d) => {
    d.customFieldDefs = [...(d.customFieldDefs ?? []), { ...structuredClone(d.customFieldDefs![0]), id: 'veld-1b', name: 'VendorVeld' }];
  });
}
{
  // De laatste notitie van de taak met een vreemd lid in OPS_TaskNotes wissen: de writer schrijft die pset dan niet, en
  // de merge zet een pset met alleen het vreemde lid op dezelfde taak (met de GlobalId van de bron).
  const bytes = read('tests/fixtures/ifc-foreign/council/r7sol-vreemd-lid-bij-notitie.ifc');
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
  const bytes = read('tests/fixtures/ifc-foreign/council/r5-eigen-plus-bonsai-baseline.ifc');
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
  const src = enc.encode(withLines(replaceLine(baseText, '#59=', "#59=IFCRELASSIGNSTOCONTROL('rDVhNjbXHjyDCF$VkTSruD',#6,$,$,(#57,#909),$,#54);"), [
    "#908=IFCTASKTIME('Kind Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M1D','2026-09-01T07:00:00','2026-09-01T16:00:00','2026-09-01T07:00:00','2026-09-01T16:00:00','2026-09-01T07:00:00','2026-09-01T16:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,0.00);",
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
  const bytes = read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
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
  'constant-slot', undefined, /^IFCTASK #57, argument 6/);
// BLOKKEERT 4: een hulpentiteit via haar eigenaar (taak → IfcTaskTime, volgorde → IfcLagTime).
const TASKTIME_56 = "#56=IFCTASKTIME('Externe bronactiviteit Time',.USERDEFINED.,'Extern berekend',.WORKTIME.,'P0Y0M2D','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,0.00);";
await expectRefusal('IfcTaskTime #56 met de DataOrigin van een ander', enc.encode(replaceLine(baseText, '#56=', TASKTIME_56)),
  'constant-slot', undefined, /^IFCTASKTIME #56, argument 1/);
await expectRefusal('IfcTaskTime #56 met UserDefinedDataOrigin', enc.encode(replaceLine(baseText, '#56=', TASKTIME_56.replace('.USERDEFINED.', '.PREDICTED.'))),
  'constant-slot', undefined, /^IFCTASKTIME #56, argument 2/);
const withLag = (lag: string) => enc.encode(withLines(
  replaceLine(eigen, '#91=', "#91=IFCRELSEQUENCE('3PojQSwT308F3rahVEzxwR',#6,$,$,#47,#51,#9001,.FINISH_START.,$);"), [lag]));
await roundTrip('een eigen IfcLagTime', withLag("#9001=IFCLAGTIME('Lag',.PREDICTED.,$,IFCDURATION('P1D'),.WORKTIME.);"));
await expectRefusal('IfcLagTime met de DataOrigin van een ander', withLag("#9001=IFCLAGTIME('Lag',.USERDEFINED.,'Extern berekend',IFCDURATION('P1D'),.WORKTIME.);"),
  'constant-slot', undefined, /^IFCLAGTIME #9001, argument 1/);
await expectRefusal('IfcLagTime met een andere naam', withLag("#9001=IFCLAGTIME('Vertraging leverancier',.PREDICTED.,$,IFCDURATION('P1D'),.WORKTIME.);"),
  'constant-slot', undefined, /^IFCLAGTIME #9001, argument 0/);
// BLOKKEERT 5: een property (en haar pset) die de writer weglaat. Een onbekende JSON-sleutel is verlies; een sleutel die
// de writer kent en weglaat omdat het standaardveld alles zegt (`dayMeasureIo.ts`), niet.
const analysis = (json: string) => enc.encode(withLines(baseText, [
  `#9001=IFCPROPERTYSINGLEVALUE('ExactFloat',$,IFCTEXT('${json}'),$);`,
  "#9002=IFCPROPERTYSET('0analyse00000000000000',#6,'OPS_Analysis',$,(#9001));",
  "#9003=IFCRELDEFINESBYPROPERTIES('0analyseRel00000000000',#6,$,$,(#57),#9002);",
]));
await expectRefusal('OPS_Analysis met een onbekende sleutel, die de writer weglaat', analysis('{"vendorCoordinationId":7}'),
  'json-sleutel', undefined, /vendorCoordinationId/);
await roundTrip('OPS_Analysis met alleen bekende sleutels, die de writer weglaat', analysis('{"TotalFloat":[2,null]}'));
await expectRefusal('een weggelaten property met een Description', enc.encode(withLines(baseText, [
  `#9001=IFCPROPERTYSINGLEVALUE('ExactFloat','Uitleg van een ander',IFCTEXT('{"TotalFloat":[2,null]}'),$);`,
  "#9002=IFCPROPERTYSET('0analyse00000000000000',#6,'OPS_Analysis',$,(#9001));",
  "#9003=IFCRELDEFINESBYPROPERTIES('0analyseRel00000000000',#6,$,$,(#57),#9002);",
])), 'constant-slot', undefined, /ExactFloat\), argument 1, ontbreekt/);
// Het werkplan heet zoals het project; een andere naam schrijft de writer niet terug (zie 2c).
{
  let src = new TextDecoder().decode(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  src = src.replace(/^(#\d+=IFCPROJECT\('[^']*',#\d+,)'[^']*'/m, "$1'Proj'").replace(/^(#\d+=IFCWORKPLAN\('[^']*',#\d+,)'[^']*'/m, "$1'Plan'");
  await expectRefusal("werkplan 'Plan' naast project 'Proj'", enc.encode(src), 'constant-slot', undefined, /^IFCWORKPLAN #\d+, argument 2: 'Plan'/);
}
// BLOKKEERT 1, gevolg: het project is P en de eerste owner history is van de bron (C). De lezer leest auteur en bedrijf
// daar terug; een gewijzigde auteur komt dus niet terug. Zonder wijziging schrijft de merge gewoon (sectie 1).
await expectRefusal('auteur wijzigen bij een gedeelde owner history', read(BASE), 'projectgegevens', (d) => { d.project.author = 'Ethan'; });

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

// ── 6. De invarianten zelf ──
{
  const good = await openForeign(secondSchedule);
  const out = concat(writeIfcMerge(cloneDomain(good), good.ifcSource!));
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
  + `geweigerd; ${edited} bewerkingen van 1b met het vreemde deel byte-gelijk)`);
process.exit(0);
