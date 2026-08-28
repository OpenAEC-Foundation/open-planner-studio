// Recovery-isolatie tussen instanties (bevinding K5) — pure logica, headless.
//
// Waarom deze batterij bestaat. De recovery-bestanden liggen in één gedeelde appDataDir en de
// opruimlogica werkte op een PREFIX (`recovery.`). Dat gaf twee fouten in dezelfde klasse:
//
//  1. Twee tegelijk draaiende vensters: elke auto-save-ronde van A overschreef het manifest van B
//     en verwijderde ALLE snapshots van B (en omgekeerd), omdat "alles met de prefix dat niet in
//     mijn keep-set staat" per definitie ook de bestanden van de ander opsomt.
//  2. Onvoorwaardelijk, ook met één venster: de productie-base is kaal `recovery` en de dev-base
//     is `recovery.<slug>`, dus de productie-prefix matcht ELK dev-bestand. Eén start van de
//     productiebuild wiste de herstel-snapshots van alle dev-worktrees. Eenzijdig — andersom ging
//     het goed, want de dev-base is specifieker.
//
// Wat hier NIET getest kan worden: er is geen Tauri-runtime in Node, dus `saveTauri`/`clearTauri`
// zelf (plugin-fs, appDataDir, de echte `remove`-aanroepen) en het `tauri-plugin-single-instance`
// draaien hier niet. Daarom is de beslissingslaag eruit getrokken als pure functies — de
// naamherkenning (`recoveryNames`) en de twee opruimplanners — en dat is wat deze batterij
// afvuurt tegen een gemengde directorylisting.
//
// Draaien: bundel met esbuild zoals run.sh dat doet en start met node. Exit 0 = alles groen.
//
// Let op: run.sh bundelt met `--define:__OPS_DEV_INSTANCE__='"test"'`, dus de MODULE-brede
// `ownRecoveryNames` is hier de dev-variant. Deze batterij gebruikt daarom overal expliciete
// bases via `recoveryNames(...)` — anders zou de belangrijkste casus (productiebuild) niet
// getest kunnen worden.
import { recoveryNames, type RecoveryManifest } from '@/hooks/recoveryPaths';
import {
  manifestOwnership, planRecoveryCleanup, planRecoveryClear, parseRecoveryManifest,
  planTauriV3RecoverySave,
  RECOVERY_MANIFEST_VERSION,
} from '@/services/recovery/recoveryStore';

// Minimale, botsingvrije `process`-declaratie (zelfde truc als de andere check-scripts), zodat dit
// bestand óók typecheckt onder een config zonder Node-typen.
declare const process: { exit(code: number): never };

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
/** Vergelijk als verzameling: de volgorde van de opruimlijst is een implementatiedetail. */
const eqSet = (label: string, got: string[], want: string[]) => {
  eq(label, [...got].sort(), [...want].sort());
};

const PROD = recoveryNames('recovery');          // productiebuild
const DEV = recoveryNames('recovery.wt-a');      // dev-worktree "wt-a"
const DEV2 = recoveryNames('recovery.wt-b');     // dev-worktree "wt-b"

const SELF = 'inst-A';
const OTHER = 'inst-B';

/** Manifest-fabriek. `owner === null` ⇒ oud v1-manifest zonder eigenaarschapsvelden. */
const manifest = (
  owner: string | null,
  docs: { id: string; ifc: string }[],
  extra: Partial<RecoveryManifest> = {},
): RecoveryManifest => ({
  version: owner === null ? 1 : RECOVERY_MANIFEST_VERSION,
  activeDocumentId: docs[0]?.id ?? null,
  documents: docs.map((d) => ({ id: d.id, ifc: d.ifc, filePath: null, isDirty: true })),
  ...(owner === null ? {} : { ownerId: owner, heartbeatAt: 1_700_000_000_000 }),
  ...extra,
});

const plan = (over: Partial<Parameters<typeof planRecoveryCleanup>[0]> = {}) =>
  planRecoveryCleanup({
    listing: [], prev: null, self: SELF, keep: [], ownWritten: [], adopted: [], names: PROD,
    ...over,
  });

// ── 1. Naamherkenning is EXACT, niet op prefix ────────────────────────────────────────────────
// Dit is de kern van fout 2: `'recovery.wt-a.doc-1.ifc'.startsWith('recovery.')` is waar.
eq('1a productie herkent zijn eigen snapshot', PROD.snapshotDocId('recovery.doc-1.ifc'), 'doc-1');
eq('1b productie herkent een DEV-snapshot NIET', PROD.snapshotDocId('recovery.wt-a.doc-1.ifc'), null);
eq('1c dev herkent zijn eigen snapshot', DEV.snapshotDocId('recovery.wt-a.doc-1.ifc'), 'doc-1');
eq('1d dev herkent een PRODUCTIE-snapshot NIET', DEV.snapshotDocId('recovery.doc-1.ifc'), null);
eq('1e dev herkent de snapshot van een ANDERE worktree NIET',
  DEV.snapshotDocId('recovery.wt-b.doc-1.ifc'), null);
eq('1f manifest is geen snapshot', PROD.snapshotDocId('recovery.documents.json'), null);
eq('1g legacy-bestand is geen snapshot', PROD.snapshotDocId('recovery.ifc'), null);
eq('1h halffabricaat is geen snapshot', PROD.snapshotDocId('recovery.doc-1.ifc.tmp'), null);
eq('1i vreemd bestand', PROD.snapshotDocId('settings.json'), null);
eq('1j bijna-treffer zonder doc-id-segment', PROD.snapshotDocId('recovery..ifc'), null);
eq('1k naam die alleen maar begint met de base', PROD.snapshotDocId('recoveryX.doc-1.ifc'), null);

eq('1l isOwnFile: eigen snapshot', PROD.isOwnFile('recovery.doc-1.ifc'), true);
eq('1m isOwnFile: eigen manifest', PROD.isOwnFile('recovery.documents.json'), true);
eq('1n isOwnFile: eigen legacy', PROD.isOwnFile('recovery.ifc'), true);
eq('1o isOwnFile: eigen halffabricaat', PROD.isOwnFile('recovery.doc-1.ifc.tmp'), true);
eq('1p isOwnFile: manifest-halffabricaat', PROD.isOwnFile('recovery.documents.json.tmp'), true);
eq('1q isOwnFile: DEV-bestand hoort NIET bij productie', PROD.isOwnFile('recovery.wt-a.doc-1.ifc'), false);
eq('1r isOwnFile: DEV-manifest hoort NIET bij productie',
  PROD.isOwnFile('recovery.wt-a.documents.json'), false);
eq('1s isOwnFile: productiebestand hoort NIET bij dev', DEV.isOwnFile('recovery.doc-1.ifc'), false);
eq('1t isOwnFile: vreemd bestand', PROD.isOwnFile('ops-extensions.json'), false);
eq('1u ifcName rondt met snapshotDocId', DEV.snapshotDocId(DEV.ifcName('doc-xyz')), 'doc-xyz');
const generationName = PROD.generationIfcName('doc-xyz', 'g-test');
eq('1v v3-generatie rondt met algemene snapshotDocId', PROD.snapshotDocId(generationName), 'doc-xyz');
eq('1w v3-generatie telt NIET als manifestloze v1/v2-terugval', PROD.stableSnapshotDocId(generationName), null);
eq('1x v3-generatie is wel een eigen recoverybestand', PROD.isOwnFile(generationName), true);

// ── 2. Een productiebuild ruimt NOOIT dev-bestanden op ────────────────────────────────────────
// De gemengde listing die deze batterij bestaat om te dekken: productie + twee worktrees + rommel.
const GEMENGD = [
  'recovery.documents.json',
  'recovery.doc-1.ifc',
  'recovery.doc-2.ifc',        // productie, niet meer open
  'recovery.ifc',              // oud legacy-bestand van de productiebuild
  'recovery.wt-a.documents.json',
  'recovery.wt-a.doc-9.ifc',
  'recovery.wt-a.doc-9.ifc.tmp',
  'recovery.wt-b.doc-7.ifc',
  'recovery.wt-b.ifc',         // legacy-bestand van een oude dev-build
  'settings.json',
  'ops-extensions.json',
];

// Productie-instantie: doc-1 staat nog open, doc-2 is gesloten. Beide staan in ONS vorige manifest.
const prodPlan = plan({
  listing: GEMENGD,
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }, { id: 'doc-2', ifc: 'recovery.doc-2.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc', 'recovery.doc-2.ifc'],
  names: PROD,
});
eq('2a eigen manifest wordt als eigen herkend', prodPlan.ownership, 'own');
eqSet('2b alleen de eigen gesloten snapshot gaat weg', prodPlan.remove, ['recovery.doc-2.ifc']);
eq('2c geen enkel dev-bestand in de opruimlijst',
  prodPlan.remove.filter((n) => n.includes('wt-')), []);
eq('2d het legacy-bestand blijft (eigen `exists`-route)', prodPlan.remove.includes('recovery.ifc'), false);
eq('2e vreemde bestanden blijven',
  prodPlan.remove.some((n) => n === 'settings.json' || n === 'ops-extensions.json'), false);

// Dezelfde listing vanuit dev-worktree wt-a: die mag de productie- en wt-b-bestanden ook niet aanraken.
const devPlan = plan({
  listing: GEMENGD,
  prev: manifest(SELF, [{ id: 'doc-9', ifc: 'recovery.wt-a.doc-9.ifc' }]),
  keep: [],
  ownWritten: ['recovery.wt-a.doc-9.ifc'],
  names: DEV,
});
eqSet('2f dev ruimt alleen zijn eigen snapshot + halffabricaat op',
  devPlan.remove, ['recovery.wt-a.doc-9.ifc', 'recovery.wt-a.doc-9.ifc.tmp']);
eq('2g dev raakt de productiebestanden niet',
  devPlan.remove.some((n) => PROD.snapshotDocId(n) !== null), false);
eq('2h dev raakt wt-b niet', devPlan.remove.some((n) => n.includes('wt-b')), false);

// ── 3. Nooit iets opruimen dat niet in de EIGEN boekhouding staat ─────────────────────────────
// Twee instanties met dezelfde base (single-instance uit, of ooit weer aan). doc-5 is van de ander:
// hij staat in de map, maar niet in ons manifest en wij hebben hem nooit geschreven.
const vreemdeBestanden = ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-5.ifc'];
const onbekend = plan({
  listing: vreemdeBestanden,
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eqSet('3a een snapshot buiten het eigen manifest blijft staan', onbekend.remove, []);

// Zonder manifest (eerste ronde na een clear): alleen wat we zelf schreven telt mee.
const eersteRonde = plan({
  listing: vreemdeBestanden,
  prev: null,
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('3b geen manifest ⇒ ownership none', eersteRonde.ownership, 'none');
eqSet('3c … en er wordt niets van een ander opgeruimd', eersteRonde.remove, []);

// Een document dat wij eerder schreven en nu sluiten, gaat wél weg.
const geslotenEigen = plan({
  listing: ['recovery.doc-1.ifc', 'recovery.doc-2.ifc', 'recovery.doc-5.ifc'],
  prev: null,
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc', 'recovery.doc-2.ifc'],
  names: PROD,
});
eqSet('3d eigen gesloten document gaat weg, dat van de ander niet',
  geslotenEigen.remove, ['recovery.doc-2.ifc']);

// Een kandidaat die niet (meer) in de map staat levert geen `remove`-opdracht op.
const nietAanwezig = plan({
  listing: ['recovery.doc-1.ifc'],
  prev: manifest(SELF, [{ id: 'doc-2', ifc: 'recovery.doc-2.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eqSet('3e al verdwenen bestand wordt niet opgeruimd', nietAanwezig.remove, []);

// ── 4. Een manifest van een ANDERE eigenaar wordt herkend ─────────────────────────────────────
eq('4a geen manifest', manifestOwnership(null, SELF), 'none');
eq('4b eigen manifest', manifestOwnership(manifest(SELF, []), SELF), 'own');
eq('4c vreemd manifest', manifestOwnership(manifest(OTHER, []), SELF), 'foreign');
eq('4d v1-manifest zonder ownerId', manifestOwnership(manifest(null, []), SELF), 'legacy');
eq('4e lege ownerId telt als v1', manifestOwnership(manifest(SELF, [], { ownerId: '' }), SELF), 'legacy');

const vreemd = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-5.ifc'],
  prev: manifest(OTHER, [{ id: 'doc-5', ifc: 'recovery.doc-5.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('4f vreemd manifest herkend', vreemd.ownership, 'foreign');
eqSet('4g … en er wordt NIETS van die instantie gewist', vreemd.remove, []);
eq('4h … zijn documenten worden meegenomen in ons manifest',
  vreemd.carryOver.map((d) => d.ifc), ['recovery.doc-5.ifc']);

// Een overgenomen snapshot blijft ook in de VOLGENDE ronde beschermd, wanneer hij inmiddels in
// ons eigen manifest staat en dus gewoon "van ons" lijkt.
const rondeDaarna = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-5.ifc'],
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }, { id: 'doc-5', ifc: 'recovery.doc-5.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  adopted: ['recovery.doc-5.ifc'],
  names: PROD,
});
eqSet('4i overgenomen snapshot blijft beschermd', rondeDaarna.remove, []);

// Een vreemd manifest waarvan de snapshot niet meer bestaat, dragen we niet mee (dode regel).
const vreemdWeg = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc'],
  prev: manifest(OTHER, [{ id: 'doc-5', ifc: 'recovery.doc-5.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('4j verdwenen vreemde snapshot wordt niet meegedragen', vreemdWeg.carryOver, []);

// Een v1-manifest wordt WEL overgenomen: dat komt van een build zonder eigenaarschapsvelden, dus
// van een vorige start — niet van een gelijktijdige instantie. Anders zou de eerste start na de
// update nooit meer opruimen.
const oud = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-2.ifc'],
  prev: manifest(null, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }, { id: 'doc-2', ifc: 'recovery.doc-2.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('4k v1-manifest telt als overneembaar', oud.ownership, 'legacy');
eqSet('4l … en zijn verweesde snapshot wordt opgeruimd', oud.remove, ['recovery.doc-2.ifc']);

// ── 5. Migratie: een OUD manifest blijft leesbaar ─────────────────────────────────────────────
// Deze bestanden staan op de schijf van iedereen die de vorige versie draaide. Ze weigeren zou
// betekenen: dataverlies bij de eerste start na de update.
const V1_RAW = JSON.stringify({
  version: 1,
  activeDocumentId: 'doc-1',
  documents: [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc', filePath: '/tmp/p.ifc', isDirty: true }],
});
const v1 = parseRecoveryManifest(V1_RAW);
eq('5a v1-manifest parst', v1 !== null, true);
eq('5b … met zijn documenten', v1?.documents.length, 1);
eq('5c … inclusief filePath', v1?.documents[0].filePath, '/tmp/p.ifc');
eq('5d … en activeDocumentId', v1?.activeDocumentId, 'doc-1');
eq('5e … zonder ownerId', v1?.ownerId, undefined);
eq('5f … zonder heartbeatAt', v1?.heartbeatAt, undefined);

const V2_RAW = JSON.stringify({
  ...manifest(OTHER, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  version: 2,
});
const v2 = parseRecoveryManifest(V2_RAW);
eq('5g v2-manifest parst na v3-upgrade', v2?.version, 2);
eq('5h … mét ownerId', v2?.ownerId, OTHER);
eq('5i … mét heartbeatAt', typeof v2?.heartbeatAt, 'number');
eq('5j v2-versienummer is opgehoogd t.o.v. v1', RECOVERY_MANIFEST_VERSION > 1, true);

const v3Plan = planTauriV3RecoverySave(v2, {
  activeDocumentId: 'doc-2',
  documents: [
    { id: 'doc-1', filePath: '/tmp/a.ifc', isDirty: true },
    { id: 'doc-2', filePath: '/tmp/b.ifc', isDirty: false },
  ],
  upserts: [
    { id: 'doc-2', ifc: 'nieuwe B-inhoud', filePath: '/tmp/b.ifc', isDirty: false },
  ],
}, 'g-42', PROD);
eq('5k v3-plan behoudt een v2-snapshot zonder nieuwe inhoud', v3Plan.documents[0]?.ifc, 'recovery.doc-1.ifc');
eq('5l v3-plan maakt precies één immutable generatie voor de upsert', v3Plan.writes,
  [{ name: 'recovery.snapshot.doc-2.g-42.ifc', ifc: 'nieuwe B-inhoud' }]);
eq('5m v3-manifestregel wijst naar die generatie', v3Plan.documents[1]?.ifc, 'recovery.snapshot.doc-2.g-42.ifc');
eq('5n v3 blijft na v1/v2 de actuele manifestversie', RECOVERY_MANIFEST_VERSION, 3);

// ── 6. Halffabricaten (.tmp) op exacte naam, niet met een sweep ───────────────────────────────
const tmpPlan = plan({
  listing: [
    'recovery.doc-1.ifc', 'recovery.doc-1.ifc.tmp',       // eigen, in-flight/crashrestant
    'recovery.documents.json', 'recovery.documents.json.tmp',
    'recovery.doc-5.ifc.tmp',                              // van een andere instantie
    'recovery.wt-a.doc-9.ifc.tmp',                         // van een dev-worktree
  ],
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eqSet('6a alleen de eigen halffabricaten gaan weg',
  tmpPlan.remove, ['recovery.doc-1.ifc.tmp', 'recovery.documents.json.tmp']);

// Halffabricaat van een eigen document dat we nu sluiten: bestand én .tmp gaan weg.
const tmpGesloten = plan({
  listing: ['recovery.doc-2.ifc', 'recovery.doc-2.ifc.tmp'],
  prev: manifest(SELF, [{ id: 'doc-2', ifc: 'recovery.doc-2.ifc' }]),
  keep: [],
  ownWritten: ['recovery.doc-2.ifc'],
  names: PROD,
});
eqSet('6b gesloten eigen document: bestand + halffabricaat',
  tmpGesloten.remove, ['recovery.doc-2.ifc', 'recovery.doc-2.ifc.tmp']);

const oudeGeneratie = PROD.generationIfcName('doc-1', 'g-oud');
const nieuweGeneratie = PROD.generationIfcName('doc-1', 'g-nieuw');
const generatieCleanup = plan({
  listing: [oudeGeneratie, nieuweGeneratie, PROD.manifest],
  prev: manifest(SELF, [{ id: 'doc-1', ifc: oudeGeneratie }]),
  keep: [nieuweGeneratie],
  ownWritten: [oudeGeneratie, nieuweGeneratie],
  names: PROD,
});
eqSet('6c oude generatie verdwijnt pas ná een manifestcommit naar de nieuwe generatie',
  generatieCleanup.remove, [oudeGeneratie]);

// ── 7. clearRecovery: wissen betekent wissen — maar alleen binnen de eigen base ────────────────
// K4 eist dat óók een snapshot die het manifest niet noemt weggaat (anders duikt hij bij de
// volgende start weer op als herstelkandidaat). K5 eist dat dat de eigen base niet verlaat.
const clearProd = planRecoveryClear(
  GEMENGD,
  manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  PROD,
);
eqSet('7a productie wist alleen zijn eigen bestanden', clearProd, [
  'recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-2.ifc', 'recovery.ifc',
  // BEKENDE, GEDOCUMENTEERDE REST (zie `recoveryNames`): `recovery.wt-b.ifc` is het LEGACY-bestand
  // van een oude dev-build en is voor de productiebuild niet te onderscheiden van een snapshot met
  // doc-id `wt-b` — beide zijn letterlijk `recovery.<segment>.ifc`. Dat bestand wordt sinds de
  // multi-document-overgang nergens meer geschreven en de opruimlus in `saveTauri` raakt het nooit
  // (het staat niet in de eigen boekhouding); alleen `clear` en de directory-scan zien het.
  'recovery.wt-b.ifc',
]);
eq('7b … geen enkele dev-SNAPSHOT of dev-manifest',
  clearProd.filter((n) => DEV.snapshotDocId(n) !== null || DEV2.snapshotDocId(n) !== null
    || n === DEV.manifest || n === DEV2.manifest), []);
eq('7c … en geen vreemde bestanden',
  clearProd.some((n) => n === 'settings.json' || n === 'ops-extensions.json'), false);

const clearDev = planRecoveryClear(GEMENGD, null, DEV);
eqSet('7d dev wist alleen zijn eigen bestanden (incl. halffabricaat)', clearDev, [
  'recovery.wt-a.documents.json', 'recovery.wt-a.doc-9.ifc', 'recovery.wt-a.doc-9.ifc.tmp',
]);
eq('7e … en niets van de productiebuild',
  clearDev.some((n) => PROD.snapshotDocId(n) !== null || n === PROD.manifest || n === PROD.legacy), false);
eqSet('7f wt-b wist alleen zijn eigen bestanden', planRecoveryClear(GEMENGD, null, DEV2),
  ['recovery.wt-b.doc-7.ifc', 'recovery.wt-b.ifc']);

// Manifestregels tellen mee ook als de directorylisting leeg is (`readDir` faalde), maar alleen
// als ze de eigen naamvorm hebben.
const clearZonderListing = planRecoveryClear(
  [],
  manifest(SELF, [
    { id: 'doc-1', ifc: 'recovery.doc-1.ifc' },
    { id: 'doc-9', ifc: 'recovery.wt-a.doc-9.ifc' }, // vreemde vorm in ons manifest: niet aanraken
  ]),
  PROD,
);
eqSet('7g manifestregels zonder listing', clearZonderListing, ['recovery.doc-1.ifc']);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  recovery-isolation-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-isolation-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
