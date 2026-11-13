import { matchesRefusal, refusalSignature, tallyGroup, TALLY_GROUPS, type ExpectedRefusal } from './ifcMergeTellingKern';
import { readbackDifference } from './ifcReadbackEquality';
// #804 fase 1b, bijsturing 1 punt 2: hoe vaak ziet de planner `merge-needs-phase2`?
//
// Per corpusbestand met een vreemd deel (`tests/fixtures/ifc-foreign/`, ook `council/`, en de oude eigen bestanden in
// `tests/planning/fixtures/oude-tags/`) de gewone bewerkingen van
// `plannerEdits` (`ifcMergeKern.ts`): niets; een taak onder een andere ouder, een niveau hoger, de volgorde van kinderen;
// een relatie erbij; een taak wissen. Per taak of per paar; boven `MAX_PER_SOORT` een vaste steekproef.
//
// Per poging: niet van toepassing, onverwacht door de app geweigerd (rood), of na een echte wijziging:
//   - gelukt: de merge schrijft, de invarianten kloppen (`mergeProblems`), geen object krijgt een tweede `Decomposes`,
//     `Nests` of `HasContext`, en de herlezing geeft dezelfde planning als dezelfde bewerking zonder vreemd deel (`canon`);
//   - merge-needs-phase2: de getypeerde weigering, met de gevallen;
//   - anders: een andere fout, een gebroken invariant of een andere planning na herlezen.
// App-weigeringen en niet-toepasselijke pogingen gaan niet naar de merge en tellen afzonderlijk.
// De check is rood bij onverwachte app-weigeringen en elke "anders": een geldige setter mag geen no-op worden. Ook rood:
// een fout bij openen, behalve de verwachte weigering in `REFUSED_AT_OPEN` (met haar reden).
// Daarna (fixronde 2 van #867, bijsturing punt 2): hoeveel eigen bestanden (zonder vreemde herkomst) al zonder bewerking
// `niet-gedragen` krijgen, het totaal van die meldingen, en de velden (entiteit + slot, bij een pset of property de naam)
// die het vaakst de oorzaak zijn. Sinds fixronde 3 (de bronwaarden van (b)) schrijft bijna elk eigen bestand zonder
// bewerking; de telling splitst de bewerkingen daarom in drie groepen: eigen bestanden die zonder bewerking schrijven,
// eigen bestanden die al zonder bewerking weigeren, en planningen van een ander programma (`vreemde-herkomst`), met de
// velden achter `niet-gedragen` na een bewerking.
// Fixronde 7 van #867 (bevinding 5 van review ronde 6): elk bestand uit `oude-tags/` en de oude writer van H7
// (`h7-tijden-oude-writer.ifc`) doet mee, met een wand van Revit erbij als het zelf geen vreemd deel heeft. Daarbij de
// varianten met een halve dag, dagen met 17 cijfers, een urentaak en `7.5:00:00` (in h7). Besluit van Trias: een eigen
// OPS-bestand weigert nooit zonder bewerking. De check is rood als een eigen bestand zonder bewerking weigert, behalve de
// bestanden in `OWN_MAY_REFUSE`, met hun reden. Per eigen bestand drukt hij de uitkomst af.
// Vervolg-PR van #867 (#886): elk bestand opent via de route van de app (`openForeign`: de store met de flag,
// `openOpenedFile`, dan `buildWriteIFCInput` plus `ifcSource`), en ook de vergelijking zonder vreemd deel gaat via die
// route. Per eigen bestand staat de uitkomst zonder bewerking naast die van de oude testroute (de lezer direct,
// `openForeignRaw`). Met `OPS_TELLING_OUDE_ROUTE=1` draait de telling elke bewerking ook op de oude route en drukt per
// bestand beide af (alleen voor een meting; de CI draait alleen "niets" op de oude route).
// Ook de voorbeelden (`public/examples/`) en de andere bestanden in `tests/planning/fixtures/`, met een wand, en per bestand
// ook de gewone bewerkingen van `ordinaryEdits` (taak erbij, hernoemen, duur, toewijzing, voortgang, doorrekenen met F5);
// bij de voorbeelden en fixtures een kleinere steekproef per soort (`MAX_PER_SOORT_EXTRA`). De herlezing via de app moet de
// planning geven die de planner zag (`shownAfterOpen`), of wat een gewone opslag en heropenen geeft (`reopenPlain`).
// Exit 0 = geen "anders" en elk eigen bestand schrijft zonder bewerking.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import {
  applyEdit, EditNotAppliedError, canon, cloneDomain, doubleMemberships, mergeProblems, openForeign, openForeignRaw, ordinaryEdits, plannerEdits, reopenPlain,
  shownAfterOpen, tryMerge, type Domain, type EditKind, type Opened,
} from './ifcMergeKern';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { IfcParseError, type IfcParseErrorReason } from '@/services/ifc/ifcErrors';
import { scanStep, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import type { MergePhase2Case } from '@/services/ifc/foreign/mergeWriter';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const FOREIGN = join(ROOT, 'tests/fixtures/ifc-foreign');
const MAX_PER_SOORT = 40;
const MAX_PER_SOORT_EXTRA = 5;

// Ook de oude eigen bestanden (fixronde 1 van #867): een bestand van v2026.7.2 heeft een los project (V) en gaat sinds
// het vervallen van de kortsluiting door de gewone merge. Paden vanaf `FOREIGN`.
const PLANNING_FIXTURES = '../../planning/fixtures';
const OLD_OWN = `${PLANNING_FIXTURES}/oude-tags`;
const H7 = `${PLANNING_FIXTURES}/h7-tijden-oude-writer.ifc`;
const EXAMPLES = '../../../public/examples';
const files = [
  ...readdirSync(FOREIGN).filter(f => f.endsWith('.ifc')),
  ...readdirSync(join(FOREIGN, 'council')).filter(f => f.endsWith('.ifc')).map(f => `council/${f}`),
  ...readdirSync(join(FOREIGN, OLD_OWN)).filter(f => f.endsWith('.ifc')).map(f => `${OLD_OWN}/${f}`),
  ...readdirSync(join(FOREIGN, PLANNING_FIXTURES)).filter(f => f.endsWith('.ifc')).map(f => `${PLANNING_FIXTURES}/${f}`),
  ...readdirSync(join(FOREIGN, EXAMPLES)).filter(f => f.endsWith('.ifc')).map(f => `${EXAMPLES}/${f}`),
].sort();
/** Een eigen bestand buiten het corpus: zonder vreemd deel krijgt het een wand. */
const ownPath = (file: string) => file.startsWith(`${PLANNING_FIXTURES}/`) || file.startsWith(`${EXAMPLES}/`);
/** De naam in de tabellen. */
const shownName = (file: string) => file.startsWith(`${OLD_OWN}/`) ? `oude-tags${file.slice(OLD_OWN.length)}`
  : file === H7 ? 'h7-tijden-oude-writer.ifc'
    : file.startsWith(`${PLANNING_FIXTURES}/`) ? `fixtures${file.slice(PLANNING_FIXTURES.length)}`
      : file.startsWith(`${EXAMPLES}/`) ? `voorbeelden${file.slice(EXAMPLES.length)}` : file;
/** Per getoonde naam: de bytes zoals gemerged (met de wand als die erbij kwam). */
const bytesOf = new Map<string, Uint8Array>();
/** Een wand van Revit met een eigen owner history: het vreemde deel bij een oud eigen bestand zonder model. */
const REVIT_WALL = [
  "#90001=IFCORGANIZATION($,'Arch',$,$,$);", "#90002=IFCAPPLICATION(#90001,'1','Revit','RVT');",
  "#90003=IFCPERSON($,'Ontwerper',$,$,$,$,$,$);", '#90004=IFCPERSONANDORGANIZATION(#90003,#90001,$);',
  '#90005=IFCOWNERHISTORY(#90004,#90002,$,.ADDED.,$,$,$,1);', "#90006=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOX',#90005,'Wand',$,$,$,$,$,$);",
];
const withWall = (bytes: Uint8Array): Uint8Array => {
  let src = '';
  for (let i = 0; i < bytes.length; i += 8192) src += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const at = src.lastIndexOf('ENDSEC;');
  return Uint8Array.from(`${src.slice(0, at)}${REVIT_WALL.map(l => `${l}\n`).join('')}${src.slice(at)}`, c => c.charCodeAt(0));
};
/** Eigen bestanden die zonder bewerking mogen weigeren, met de reden. Elk ander eigen bestand moet zonder bewerking
 *  schrijven (fixronde 7). Beide zijn proeven met een lege notitielijst `'[]'`, met de hand gemaakt in review ronde 7
 *  van #867: OPS schreef die nooit (sinds `1eb58ab9d` "afwezig/leeg ⇒ niets geschreven"), en de writer laat hem weg
 *  (knownbug 1101). */
const OWN_MAY_REFUSE: Readonly<Record<string, ExpectedRefusal>> = {
  'fixtures/periode-oude-minuutfractie.ifc + wand': { reason: 'oude minuutfractie buiten de conservatieve foreign-lijst (knownbug 1157)', cases: [
    "tijd-deels-gelezen | 17 | IFCTIMEPERIOD #17: de tijd '07:30.5:00' heeft geen vorm die de lezer kent; hij leest haar anders (knownbug 1031)",
  ] },
  'fixtures/periode-oude-minuutfractie-v2026.8.1.ifc + wand': { reason: 'oude minuutfractie buiten de conservatieve foreign-lijst (knownbug 1157)', cases: [
    "tijd-deels-gelezen | 14 | IFCTIMEPERIOD #14: de tijd '07:30.5:00' heeft geen vorm die de lezer kent; hij leest haar anders (knownbug 1031)",
  ] },
  'council/r7sol-vreemd-lid-bij-notitie.ifc': { reason: "een lege notitielijst '[]' (knownbug 1101)", cases: [
    "niet-gedragen | 9111 | IFCPROPERTYSET #9111 (OPS_TaskNotes), argument 4 | 4 |  |  | 4 | false",
    "niet-gedragen | 9110 | IFCPROPERTYSINGLEVALUE #9110 (Notes) | -1 | ontbreekt |  |  | false",
  ] },
  'council/r7sol-vreemd-lid-bij-toewijzing.ifc': { reason: "een lege notitielijst '[]' (knownbug 1101)", cases: [
    "niet-gedragen | 9110 | IFCPROPERTYSINGLEVALUE #9110 (Notes) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 9111 | IFCPROPERTYSET #9111 (OPS_TaskNotes) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 9112 | IFCRELDEFINESBYPROPERTIES #9112 | -1 | ontbreekt |  |  | false",
  ] },
  // Geen ongewijzigde OPS-uitvoer: de bestaande regressieproeven documenteren de externe herschrijving (1108).
  'fixtures/ifc-arity-oude-writer-merged.ifc': { reason: 'door IfcOpenShell MergeProjects 0.9.0 herschreven; oude slotwaarden en WorkingExceptionIds al veranderd (check-ifc-legacy-arity.ts)', cases: [
    "niet-gedragen | 358 | IFCWORKTIME #358, argument 3 | 3 |  |  | 3 | false",
    "niet-gedragen | 284 | IFCWORKTIME #284, argument 3 | 3 |  |  | 3 | false",
    "niet-gedragen | 205 | IFCRELASSIGNSTOCONTROL #205, argument 4 | 4 |  |  | 4 | false",
    "niet-gedragen | 256 | IFCRELNESTS #256, argument 5 | 5 |  |  | 5 | false",
    "niet-gedragen | 288 | IFCPROPERTYSET #288 (OPS_Calendar), argument 4 | 4 |  |  | 4 | false",
    "niet-eenduidig | 291 | IFCWORKSCHEDULE #291 (Baseline plan), argument 12 | 12 |  |  | 11 | true",
    "niet-eenduidig | 291 | IFCWORKSCHEDULE #291 (Baseline plan), argument 13 van de uitvoer (geen slot in de bron) | 13 |  | uitvoer | 13 | true",
    "niet-eenduidig | 292 | IFCWORKSCHEDULE #292 (Herplanning), argument 12 | 12 |  |  | 11 | true",
    "niet-eenduidig | 292 | IFCWORKSCHEDULE #292 (Herplanning), argument 13 van de uitvoer (geen slot in de bron) | 13 |  | uitvoer | 13 | true",
    "niet-gedragen | 363 | IFCPROPERTYSET #363 (OPS_Calendar), argument 4 | 4 |  |  | 4 | false",
    "niet-gedragen | 282 | IFCTIMEPERIOD #282 | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 283 | IFCRECURRENCEPATTERN #283 | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 287 | IFCPROPERTYSINGLEVALUE #287 (WorkingExceptionIds) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 356 | IFCTIMEPERIOD #356 | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 357 | IFCRECURRENCEPATTERN #357 | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 362 | IFCPROPERTYSINGLEVALUE #362 (WorkingExceptionIds) | -1 | ontbreekt |  |  | false",
  ] },
  'fixtures/xer-archief-herschreven.ifc + wand': { reason: 'met opzet beschadigde fixture: XER-bronchunks ontbreken, manifest bleef staan; geen gewone uitvoer van OPS (check-xer-archive-fallback.ts, knownbug 1108)', cases: [
    "niet-gedragen | 14 | IFCPROPERTYSINGLEVALUE #14 (SchemaVersion) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 15 | IFCPROPERTYSINGLEVALUE #15 (Format) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 16 | IFCPROPERTYSINGLEVALUE #16 (StorageFormat) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 17 | IFCPROPERTYSINGLEVALUE #17 (ByteLength) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 18 | IFCPROPERTYSINGLEVALUE #18 (Sha256) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 19 | IFCPROPERTYSINGLEVALUE #19 (ByteChunkSize) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 20 | IFCPROPERTYSINGLEVALUE #20 (ByteChunkCount) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 22 | IFCPROPERTYSET #22 (OPS_XerSourceArchive) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 23 | IFCRELDEFINESBYPROPERTIES #23 | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 24 | IFCPROPERTYSINGLEVALUE #24 (ArchiveSha256) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 25 | IFCPROPERTYSINGLEVALUE #25 (SourceProjectId) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 26 | IFCPROPERTYSET #26 (OPS_XerDocument) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 27 | IFCRELDEFINESBYPROPERTIES #27 | -1 | ontbreekt |  |  | false",
  ] },
  'fixtures/werkdag-einde-tussenwaarde.ifc': { reason: "een speling 'PT72H' met een tijddeel: de lezer leest hem exact, de merge houdt de voorzichtige lijst (knownbug 1152)", cases: [
    "duur-deels-gelezen | 55 | IFCTASKTIME #55: de speling 'PT72H' staat niet op de lijst van vormen die de lezer exact leest.",
    "duur-deels-gelezen | 55 | IFCTASKTIME #55: de speling 'PT16H' staat niet op de lijst van vormen die de lezer exact leest.",
  ] },
  // Een back-up met het kenmerk van een vreemde bron (`OPS_RecoveryForeignSource`): de store haalt het kenmerk bij openen
  // uit het document, en de merge zou het dan laten vallen. Een back-up bevat zelf nooit een vreemd deel (de writer
  // schrijft haar zonder); de wand is hier alleen voor de proef. Op de oude testroute schreef de merge het kenmerk mee.
  'fixtures/backup-met-kenmerk.ifc + wand': { reason: 'het herstelkenmerk van een back-up; een back-up heeft zelf geen vreemd deel', cases: [
    "niet-gedragen | 17 | IFCPROPERTYSINGLEVALUE #17 (Sha256) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 18 | IFCPROPERTYSINGLEVALUE #18 (ByteLength) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 19 | IFCPROPERTYSINGLEVALUE #19 (SourcePath) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 20 | IFCPROPERTYSET #20 (OPS_RecoveryForeignSource) | -1 | ontbreekt |  |  | false",
    "niet-gedragen | 21 | IFCRELDEFINESBYPROPERTIES #21 | -1 | ontbreekt |  |  | false",
  ] },
};
/** Zonder bewerking, per eigen bestand: de uitkomst (`schrijft` of `weigert (gevallen)`). */
const ownOutcome = new Map<string, string>();
const ownCases = new Map<string, readonly MergePhase2Case[]>();
/** Zonder bewerking, per bestand: de uitkomst op de oude testroute (de lezer direct). */
const rawOutcome = new Map<string, string>();
const FULL_RAW = process.env.OPS_TELLING_OUDE_ROUTE === '1';
/** Met `OPS_TELLING_OUDE_ROUTE=1`: per bestand de telling op de oude route. */
const rawTally = new Map<string, Map<EditKind, Tally>>();
const rawOthers: string[] = [];
/** Een route: hoe het bestand opent, en of de herlezing de planning van de bewerking geeft. */
interface Route { open(bytes: Uint8Array): Promise<Opened>; same(reread: Opened, d: Domain): Promise<boolean> }
const APP: Route = {
  open: (b) => openForeign(b),
  same: async (reread, d) => {
    const got = canon(reread, reseed);
    return got === canon(await shownAfterOpen(d), reseed) || got === canon(await reopenPlain(d), reseed);
  },
};
const RAW: Route = { open: (b) => openForeignRaw(b), same: async (reread, d) => canon(reread, reseed) === canon(readIFC(writeIFC(d)), reseed) };

interface Tally { n: number; ok: number; appRejected: number; notApplicable: number; refused: Map<string, number>; other: Map<string, number> }
const emptyTally = (): Tally => ({ n: 0, ok: 0, appRejected: 0, notApplicable: 0, refused: new Map(), other: new Map() });
const tally = new Map<string, Map<EditKind, Tally>>();
const others: string[] = [];
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
// `installDeterminism` zet de klok vast; de looptijd komt daarom uit `performance.now`.
const started = performance.now();
let merges = 0;

/** Bestanden die al bij openen geweigerd worden, met de reden (VERVOLG van Terra, fixronde 1 van #867): IFC2X3 valt
 *  buiten de bytes-route, en de huidige route weigert een model (knownbug 110). Elke andere fout bij openen is rood. */
const REFUSED_AT_OPEN: Readonly<Record<string, IfcParseErrorReason>> = {
  'model-ifc2x3.ifc': 'building-model',
  // De kop van v2026.7.12 breekt de grammatica (een rauwe apostrof in FILE_NAME); met de wand erbij weigert de oude route
  // het model. Zonder wand opent het (knownbug 1103).
  [`${OLD_OWN}/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc`]: 'building-model',
};
const refusedAtOpen: string[] = [];

/** Zonder bewerking, per eigen bestand: de meldingen `niet-gedragen`. */
const notCarried = new Map<string, readonly MergePhase2Case[]>();
/** Per bestand: de velden achter `niet-gedragen` na een bewerking (niet bij "niets"). */
const editFields = new Map<string, Map<string, number>>();
let ownFiles = 0;
/** Het veld van een melding: type, de naam van de pset of property, en het slot. */
function fieldOf(index: StepIndex, c: MergePhase2Case): string {
  const i = index.chunkOf(String(c.sourceId));
  const type = index.type(i);
  const named = type === 'IFCRELDEFINESBYPROPERTIES' ? index.refAt(i, 5) : type.startsWith('IFCPROPERTY') ? i : -1;
  const name = named >= 0 ? index.name(named) : undefined;
  const slot = c.field?.whole ?? (c.field?.slotless ? `argument ${c.field.arg} (geen slot in de ${c.field.slotless})` : `argument ${c.field?.arg}`);
  return `${type}${name ? ` (${type === 'IFCRELDEFINESBYPROPERTIES' ? 'van ' : ''}${name})` : ''} ${slot}`;
}

for (const file of files) {
  let bytes: Uint8Array = new Uint8Array(readFileSync(join(FOREIGN, file)));
  let shown = shownName(file);
  let opened;
  try {
    opened = await openForeign(bytes);
    if (ownPath(file) && !opened.ifcSource?.foreign) {
      bytes = withWall(bytes);
      shown = `${shown} + wand`;
      opened = await openForeign(bytes);
    }
  } catch (e) {
    const want = REFUSED_AT_OPEN[file];
    if (want !== undefined && e instanceof IfcParseError && e.reason === want) { refusedAtOpen.push(shown); continue; }
    others.push(`${shown} · openen: ${e instanceof IfcParseError ? `IfcParseError ${e.reason}` : (e as Error).message.slice(0, 160)}`);
    continue;
  }
  if (REFUSED_AT_OPEN[file] !== undefined) { others.push(`${shown} · openen: verwacht geweigerd (${REFUSED_AT_OPEN[file]}), maar opent`); continue; }
  if (!opened.ifcSource?.foreign) continue;
  bytesOf.set(shown, bytes);
  const max = ownPath(file) && !file.startsWith(`${OLD_OWN}/`) && file !== H7 ? MAX_PER_SOORT_EXTRA : MAX_PER_SOORT;
  const perKind = await runEdits(shown, bytes, opened, APP, others, true, max);
  tally.set(shown, perKind);
  // De oude testroute: alleen zonder bewerking, of met `OPS_TELLING_OUDE_ROUTE=1` alles.
  try {
    const raw = await RAW.open(bytes);
    if (FULL_RAW) rawTally.set(shown, await runEdits(shown, bytes, raw, RAW, rawOthers, false, max));
    else {
      const r = await tryMerge(cloneDomain(raw), raw.ifcSource!);
      rawOutcome.set(shown, r.ok ? 'schrijft' : `weigert (${r.kinds.join(', ')})`);
    }
  } catch (e) {
    rawOutcome.set(shown, `fout bij openen: ${(e as Error).message.slice(0, 80)}`);
  }
}

/** De gewone bewerkingen op één bestand, met per bewerking één van de drie uitkomsten. `record`: de uitkomst zonder
 *  bewerking telt mee in de tabellen per eigen bestand (de route van de app); anders alleen in `rawOutcome`. */
async function runEdits(shown: string, bytes: Uint8Array, opened: Opened, route: Route, others: string[], record: boolean,
  max: number): Promise<Map<EditKind, Tally>> {
  const source = opened.ifcSource!;
  const perKind = new Map<EditKind, Tally>();
  const sourceDoubles = doubleMemberships(bytes);
  const index = scanStep(bytes);
  const fields = new Map<string, number>();
  if (record) editFields.set(shown, fields);
  const where = shown;
  for (const edit of [...plannerEdits(opened, max), ...ordinaryEdits(opened)]) {
    const t = perKind.get(edit.kind) ?? emptyTally();
    perKind.set(edit.kind, t);
    t.n++;
    const fail = (reason: string) => { bump(t.other, reason); others.push(`${where} · ${edit.label}: ${reason}`); };
    try {
      const d = await applyEdit(edit, cloneDomain(opened));
      if (record) merges++;
      const outcome = await tryMerge(d, source);
      if (record) console.log('UITKOMST GEVAL ' + JSON.stringify({ bestand: where, soort: edit.kind, bewerking: edit.label,
        uitkomst: outcome.ok ? 'schrijft' : 'weigert', domeinVerschil: edit.kind === 'niets' ? null : readbackDifference(cloneDomain(opened), d) ?? null }));
      if (edit.kind === 'niets' && !record) rawOutcome.set(shown, outcome.ok ? 'schrijft' : `weigert (${outcome.kinds.join(', ')})`);
      if (record && edit.kind === 'niets' && (outcome.ok || !outcome.kinds.includes('vreemde-herkomst'))) {
        ownFiles++;
        notCarried.set(shown, outcome.ok ? [] : outcome.error.cases.filter(c => c.kind === 'niet-gedragen'));
        ownOutcome.set(shown, outcome.ok ? 'schrijft' : `weigert (${outcome.kinds.join(', ')})`);
        ownCases.set(shown, outcome.ok ? [] : outcome.error.cases);
      }
      if (!outcome.ok) {
        console.log('WEIGERING GEVAL ' + JSON.stringify({ bestand: where, soort: edit.kind, bewerking: edit.label, gevallen: outcome.error.cases }));
        for (const k of outcome.kinds) bump(t.refused, k);
        if (edit.kind !== 'niets') {
          for (const key of new Set(outcome.error.cases.filter(c => c.kind === 'niet-gedragen' && c.sourceId !== undefined).map(c => fieldOf(index, c)))) bump(fields, key);
        }
        continue;
      }
      const viaBytes = await openForeign(outcome.bytes);
      const difference = readbackDifference(outcome.shown, viaBytes);
      if (difference) {
        console.log('LEESWEG VERSCHIL ' + JSON.stringify({ bestand: where, bewerking: edit.label, difference }));
        fail('naad en volledige bytes-route: ' + difference); continue;
      }
      const problems = mergeProblems(source.bytes, outcome.bytes);
      if (problems.length > 0) { fail(`invariant: ${problems[0]}`); continue; }
      const doubles = doubleMemberships(outcome.bytes).filter(k => !sourceDoubles.includes(k));
      if (doubles.length > 0) { fail(`dubbel lidmaatschap: ${doubles[0]}`); continue; }
      if (!await route.same(await route.open(outcome.bytes), d)) { fail('andere planning na herlezen'); continue; }
      t.ok++;
    } catch (e) {
      if (e instanceof EditNotAppliedError) {
        if (e.outcome === 'niet-van-toepassing') t.notApplicable++;
        else {
          t.appRejected++;
          // Een vooraf geldige kandidaat die stil niets doet is een kapotte proef, nooit een groene skip.
          others.push(`${where} · ${edit.label}: ${e.message}`);
        }
        if (record) console.log('UITKOMST GEVAL ' + JSON.stringify({ bestand: where, soort: edit.kind,
          bewerking: edit.label, uitkomst: e.outcome, reden: e.message, domeinVerschil: null }));
      } else fail(`fout: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return perKind;
}

// ── De tabellen ──
const KINDS: EditKind[] = [
  'niets', 'andere-ouder', 'niveau-hoger', 'volgorde-kinderen', 'relatie-erbij', 'taak-wissen', 'taak-erbij', 'hernoemen', 'duur',
  'toewijzing-erbij', 'voortgang', 'doorrekenen',
];
const fmt = (m: Map<string, number>) => [...m].sort().map(([k, v]) => `${k} ${v}`).join(', ') || '–';
/** Per bestand en per bewerking, dan de totalen per bewerking. Geeft het totaal terug. */
function printTally(byFile: ReadonlyMap<string, ReadonlyMap<EditKind, Tally>>): { n: number; ok: number; appRejected: number; notApplicable: number; other: number } {
  console.log('| bestand | bewerking | pogingen | gelukt | merge-needs-phase2 (geval: aantal) | door app geweigerd | niet van toepassing | anders |');
  console.log('|---|---|---|---|---|---|---|---|');
  const total = new Map<EditKind, Tally>();
  for (const [file, perKind] of byFile) {
    for (const kind of KINDS) {
      const t = perKind.get(kind);
      if (!t) continue;
      const refusedN = t.n - t.ok - t.appRejected - t.notApplicable - [...t.other.values()].reduce((a, b) => a + b, 0);
      console.log(`| ${file} | ${kind} | ${t.n} | ${t.ok} | ${refusedN}${refusedN ? ` (${fmt(t.refused)})` : ''} | ${t.appRejected} | ${t.notApplicable} | ${fmt(t.other)} |`);
      const all = total.get(kind) ?? emptyTally();
      all.n += t.n; all.ok += t.ok; all.appRejected += t.appRejected; all.notApplicable += t.notApplicable;
      for (const [k, v] of t.refused) all.refused.set(k, (all.refused.get(k) ?? 0) + v);
      for (const [k, v] of t.other) all.other.set(k, (all.other.get(k) ?? 0) + v);
      total.set(kind, all);
    }
  }
  console.log('');
  console.log('| bewerking | pogingen | gelukt | merge-needs-phase2 | door app geweigerd | niet van toepassing | anders |');
  console.log('|---|---|---|---|---|---|---|');
  for (const kind of KINDS) {
    const t = total.get(kind);
    if (!t) continue;
    const otherN = [...t.other.values()].reduce((a, b) => a + b, 0);
    console.log(`| ${kind} | ${t.n} | ${t.ok} | ${t.n - t.ok - t.appRejected - t.notApplicable - otherN} (${fmt(t.refused)}) | ${t.appRejected} | ${t.notApplicable} | ${otherN} |`);
  }
  return {
    n: [...total.values()].reduce((a, t) => a + t.n, 0),
    ok: [...total.values()].reduce((a, t) => a + t.ok, 0),
    appRejected: [...total.values()].reduce((a, t) => a + t.appRejected, 0),
    notApplicable: [...total.values()].reduce((a, t) => a + t.notApplicable, 0),
    other: [...total.values()].reduce((a, t) => a + [...t.other.values()].reduce((x, y) => x + y, 0), 0),
  };
}
const asRead = printTally(tally);
console.log('');
console.log(`Totaal: ${asRead.n} pogingen, ${asRead.ok} gelukt, ${asRead.n - asRead.ok - asRead.appRejected - asRead.notApplicable - asRead.other} merge-needs-phase2, ${asRead.appRejected} door app geweigerd, ${asRead.notApplicable} niet van toepassing, ${asRead.other} anders; `
  + `${tally.size} bestanden met een vreemd deel; geweigerd bij openen: ${refusedAtOpen.join(', ') || '–'}.`);
if (merges !== asRead.n - asRead.appRejected - asRead.notApplicable) others.push(`aantal merges sluit niet: ${merges} tegenover ${JSON.stringify(asRead)}`);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

// ── Per groep: eigen bestanden die zonder bewerking schrijven, die al weigeren, en andere programma's ──
{
  const GROUPS = TALLY_GROUPS;
  const groupOf = (file: string) => tallyGroup(ownOutcome.get(file));
  const groupTotals = { files: 0, n: 0, ok: 0, refused: 0, appRejected: 0, notApplicable: 0, other: 0 };
  console.log('');
  console.log('Per groep (alle bewerkingen behalve "niets"):');
  console.log('');
  console.log('| groep | bestanden | pogingen | gelukt | merge-needs-phase2 (geval: aantal) | door app geweigerd | niet van toepassing | anders |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const group of GROUPS) {
    const files = [...tally.keys()].filter(f => groupOf(f) === group);
    let n = 0; let okN = 0; let appN = 0; let naN = 0; let otherN = 0;
    const refusedKinds = new Map<string, number>();
    const fields = new Map<string, number>();
    for (const f of files) {
      for (const [kind, t] of tally.get(f)!) {
        if (kind === 'niets') continue;
        n += t.n; okN += t.ok; appN += t.appRejected; naN += t.notApplicable; otherN += [...t.other.values()].reduce((a, b) => a + b, 0);
        for (const [k, v] of t.refused) refusedKinds.set(k, (refusedKinds.get(k) ?? 0) + v);
      }
      for (const [k, v] of editFields.get(f) ?? []) fields.set(k, (fields.get(k) ?? 0) + v);
    }
    groupTotals.files += files.length; groupTotals.n += n; groupTotals.ok += okN;
    groupTotals.appRejected += appN; groupTotals.notApplicable += naN;
    groupTotals.other += otherN; groupTotals.refused += n - okN - appN - naN - otherN;
    console.log(`| ${group} | ${files.length} | ${n} | ${okN} | ${n - okN - appN - naN - otherN} (${fmt(refusedKinds)}) | ${appN} | ${naN} | ${otherN} |`);
    const top = [...fields].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
    if (top.length > 0) console.log(`|  | velden achter niet-gedragen: ${top.map(([k, v]) => `${v} × ${k}`).join('; ')} | | | | |`);
  }
  const detail = { files: tally.size, n: 0, ok: 0, refused: 0, appRejected: 0, notApplicable: 0, other: 0 };
  for (const perKind of tally.values()) for (const [kind, t] of perKind) {
    if (kind === 'niets') continue;
    const other = [...t.other.values()].reduce((a, b) => a + b, 0);
    detail.n += t.n; detail.ok += t.ok; detail.other += other;
    detail.appRejected += t.appRejected; detail.notApplicable += t.notApplicable;
    detail.refused += t.n - t.ok - t.appRejected - t.notApplicable - other;
  }
  if (JSON.stringify(groupTotals) !== JSON.stringify(detail)) others.push(`groepstabel wijkt af: ${JSON.stringify(groupTotals)} tegenover detail ${JSON.stringify(detail)}`);

}

// ── Zonder bewerking: eigen bestanden met `niet-gedragen` ──
{
  const fields = new Map<string, { n: number; files: Set<string> }>();
  let total = 0;
  for (const [file, cases] of notCarried) {
    const index = scanStep(bytesOf.get(file)!);
    for (const c of cases) {
      total++;
      const key = fieldOf(index, c);
      const g = fields.get(key) ?? { n: 0, files: new Set<string>() };
      g.n++; g.files.add(file); fields.set(key, g);
    }
  }
  const withCases = [...notCarried.values()].filter(c => c.length > 0).length;
  console.log('');
  console.log(`Zonder bewerking: ${withCases} van de ${ownFiles} eigen bestanden met een vreemd deel krijgen niet-gedragen, samen ${total} meldingen.`);
  console.log('De velden die het vaakst de oorzaak zijn:');
  for (const [k, g] of [...fields].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 10)) console.log(`  ${g.n} × ${k} (${g.files.size} bestanden)`);
}

// ── Zonder bewerking, per eigen bestand: de uitkomst (fixronde 7) ──
const ownRefused: string[] = [];
{
  console.log('');
  console.log('Zonder bewerking, per eigen bestand:');
  console.log('');
  console.log('| eigen bestand | zonder bewerking (route van de app) | oude testroute (de lezer direct) |');
  console.log('|---|---|---|');
  for (const [file, outcome] of [...ownOutcome].sort((a, b) => a[0].localeCompare(b[0]))) {
    const allowed = OWN_MAY_REFUSE[file];
    console.log(`| ${file} | ${outcome}${allowed ? `; mag: ${allowed.reason}` : ''} | ${rawOutcome.get(file) ?? '–'} |`);
    if (outcome !== 'schrijft' && (!allowed || !matchesRefusal(ownCases.get(file) ?? [], allowed))) {
      ownRefused.push(`${file}: ${outcome}; onverwachte soort/velden: ${JSON.stringify((ownCases.get(file) ?? []).map(refusalSignature))}`);
    }
    if (outcome === 'schrijft' && allowed) ownRefused.push(`${file}: schrijft nu; haal het uit OWN_MAY_REFUSE`);
  }
  for (const file of Object.keys(OWN_MAY_REFUSE)) if (!ownOutcome.has(file)) ownRefused.push(`${file}: niet als eigen bestand gezien`);
}

// ── Met `OPS_TELLING_OUDE_ROUTE=1`: per bestand de route van de app naast de oude testroute ──
if (FULL_RAW) {
  const sum = (m: ReadonlyMap<EditKind, Tally> | undefined) => {
    let n = 0; let okN = 0; let appN = 0; let naN = 0; let otherN = 0;
    for (const t of m?.values() ?? []) { n += t.n; okN += t.ok; appN += t.appRejected; naN += t.notApplicable; otherN += [...t.other.values()].reduce((a, b) => a + b, 0); }
    return m ? `${okN}/${n} gelukt, ${n - okN - appN - naN - otherN} merge-geweigerd, ${appN} app-geweigerd, ${naN} niet toepasbaar, ${otherN} anders` : '–';
  };
  console.log('');
  console.log('Per bestand, alle bewerkingen: route van de app tegenover de oude testroute:');
  console.log('');
  console.log('| bestand | route van de app | oude testroute |');
  console.log('|---|---|---|');
  for (const file of [...tally.keys()].sort()) console.log(`| ${file} | ${sum(tally.get(file))} | ${sum(rawTally.get(file))} |`);
  if (rawOthers.length > 0) {
    console.log(`(oude testroute: ${rawOthers.length} keer anders)`);
    for (const o of rawOthers.slice(0, 20)) console.log(`   - ${o}`);
  }
}

if (ownRefused.length > 0) {
  console.log(`XX  ifc-foreign-merge-telling: ${ownRefused.length} eigen bestand(en) die zonder bewerking niet doen wat de lijst zegt`);
  for (const o of ownRefused) console.log(`   - ${o}`);
}
if (others.length > 0) {
  console.log(`XX  ifc-foreign-merge-telling: ${others.length} bewerking(en) met een andere uitkomst dan gelukt of merge-needs-phase2`);
  for (const o of others.slice(0, 40)) console.log(`   - ${o}`);
}
if (others.length > 0 || ownRefused.length > 0) process.exit(1);
console.log(`OK  ifc-foreign-merge-telling: ${asRead.n} pogingen over ${tally.size} bestanden; ${merges} merges: ${asRead.ok} geschreven, ${asRead.n - asRead.ok - asRead.appRejected - asRead.notApplicable - asRead.other} getypeerd geweigerd; ${asRead.appRejected} door app geweigerd, ${asRead.notApplicable} niet van toepassing, ${asRead.other} anders (${seconds} s)`);
process.exit(0);
