import { recoveryNames, type RecoveryManifest } from '@/services/recovery/recoveryPaths';
import {
  manifestOwnership, planRecoveryCleanup, planRecoveryClear, planRecoveryExitClear, parseRecoveryManifest,
  planTauriV3RecoverySave,
  RECOVERY_MANIFEST_VERSION,
} from '@/services/recovery/recoveryStore';

declare const process: { exit(code: number): never };

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const eqSet = (label: string, got: string[], want: string[]) => {
  eq(label, [...got].sort(), [...want].sort());
};

const PROD = recoveryNames('recovery');
const DEV = recoveryNames('recovery.wt-a');
const DEV2 = recoveryNames('recovery.wt-b');

const SELF = 'inst-A';
const OTHER = 'inst-B';

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

const GEMENGD = [
  'recovery.documents.json',
  'recovery.doc-1.ifc',
  'recovery.doc-2.ifc',
  'recovery.ifc',
  'recovery.wt-a.documents.json',
  'recovery.wt-a.doc-9.ifc',
  'recovery.wt-a.doc-9.ifc.tmp',
  'recovery.wt-b.doc-7.ifc',
  'recovery.wt-b.ifc',
  'settings.json',
  'ops-extensions.json',
];

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

const vreemdeBestanden = ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-5.ifc'];
const onbekend = plan({
  listing: vreemdeBestanden,
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eqSet('3a een snapshot buiten het eigen manifest blijft staan', onbekend.remove, []);

const eersteRonde = plan({
  listing: vreemdeBestanden,
  prev: null,
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('3b geen manifest ⇒ ownership none', eersteRonde.ownership, 'none');
eqSet('3c … en er wordt niets van een ander opgeruimd', eersteRonde.remove, []);

const geslotenEigen = plan({
  listing: ['recovery.doc-1.ifc', 'recovery.doc-2.ifc', 'recovery.doc-5.ifc'],
  prev: null,
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc', 'recovery.doc-2.ifc'],
  names: PROD,
});
eqSet('3d eigen gesloten document gaat weg, dat van de ander niet',
  geslotenEigen.remove, ['recovery.doc-2.ifc']);

const nietAanwezig = plan({
  listing: ['recovery.doc-1.ifc'],
  prev: manifest(SELF, [{ id: 'doc-2', ifc: 'recovery.doc-2.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eqSet('3e al verdwenen bestand wordt niet opgeruimd', nietAanwezig.remove, []);

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

const rondeDaarna = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-5.ifc'],
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }, { id: 'doc-5', ifc: 'recovery.doc-5.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  adopted: ['recovery.doc-5.ifc'],
  names: PROD,
});
eqSet('4i overgenomen snapshot blijft beschermd', rondeDaarna.remove, []);
eq('4i2 overgenomen regel blijft in ons manifest',
  rondeDaarna.carryOver.map((d) => d.ifc), ['recovery.doc-5.ifc']);

const vreemdWeg = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc'],
  prev: manifest(OTHER, [{ id: 'doc-5', ifc: 'recovery.doc-5.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('4j verdwenen vreemde snapshot wordt niet meegedragen', vreemdWeg.carryOver, []);

const oud = plan({
  listing: ['recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-2.ifc'],
  prev: manifest(null, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }, { id: 'doc-2', ifc: 'recovery.doc-2.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eq('4k v1-manifest telt als overneembaar', oud.ownership, 'legacy');
eqSet('4l … en zijn verweesde snapshot wordt opgeruimd', oud.remove, ['recovery.doc-2.ifc']);

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
    { id: 'doc-1', filePath: '/tmp/a.ifc', isDirty: true, datesAsRecorded: false },
    { id: 'doc-2', filePath: '/tmp/b.ifc', isDirty: false, datesAsRecorded: false },
  ],
  upserts: [
    { id: 'doc-2', ifc: 'nieuwe B-inhoud', filePath: '/tmp/b.ifc', isDirty: false, datesAsRecorded: false },
  ],
}, 'g-42', PROD);
eq('5k v3-plan behoudt een v2-snapshot zonder nieuwe inhoud', v3Plan.documents[0]?.ifc, 'recovery.doc-1.ifc');
eq('5l v3-plan maakt precies één immutable generatie voor de upsert', v3Plan.writes,
  [{ name: 'recovery.snapshot.doc-2.g-42.ifc', ifc: 'nieuwe B-inhoud' }]);
eq('5m v3-manifestregel wijst naar die generatie', v3Plan.documents[1]?.ifc, 'recovery.snapshot.doc-2.g-42.ifc');
eq('5n v5 is de actuele manifestversie (v4 + de archiefverwijzing per document)', RECOVERY_MANIFEST_VERSION, 5);

const V3_ZONDER_VLAG = parseRecoveryManifest(JSON.stringify({
  version: 3,
  activeDocumentId: 'doc-1',
  documents: [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc', filePath: '/tmp/p.ifc', isDirty: true }],
  ownerId: OTHER,
  heartbeatAt: Date.now(),
}));
eq('5o een v3-manifest zonder de modusvlag parst gewoon', V3_ZONDER_VLAG !== null, true);
eq('5p … en levert het veld als undefined (geen verzonnen true)',
  V3_ZONDER_VLAG?.documents[0]?.datesAsRecorded, undefined);
const carryZonderVlag = planRecoveryCleanup({
  listing: ['recovery.doc-1.ifc'],
  prev: V3_ZONDER_VLAG,
  self: SELF,
  keep: [],
  ownWritten: [],
  adopted: [],
  names: PROD,
});
eq('5q overname van een vreemd v3-manifest zet de modusvlag op false, niet undefined',
  carryZonderVlag.carryOver[0]?.datesAsRecorded, false);

const v4Plan = planTauriV3RecoverySave(null, {
  activeDocumentId: 'doc-9',
  documents: [{ id: 'doc-9', filePath: null, isDirty: true, datesAsRecorded: true }],
  upserts: [{ id: 'doc-9', ifc: 'inhoud', filePath: null, isDirty: true, datesAsRecorded: true }],
}, 'g-9', PROD);
eq('5r een nieuw manifest schrijft de modusvlag mee', v4Plan.documents[0]?.datesAsRecorded, true);

const tmpPlan = plan({
  listing: [
    'recovery.doc-1.ifc', 'recovery.doc-1.ifc.tmp',
    'recovery.documents.json', 'recovery.documents.json.tmp',
    'recovery.doc-5.ifc.tmp',
    'recovery.wt-a.doc-9.ifc.tmp',
  ],
  prev: manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  keep: ['recovery.doc-1.ifc'],
  ownWritten: ['recovery.doc-1.ifc'],
  names: PROD,
});
eqSet('6a alleen de eigen halffabricaten gaan weg',
  tmpPlan.remove, ['recovery.doc-1.ifc.tmp', 'recovery.documents.json.tmp']);

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

const clearProd = planRecoveryClear(
  GEMENGD,
  manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc' }]),
  PROD,
);
eqSet('7a productie wist alleen zijn eigen bestanden', clearProd, [
  'recovery.documents.json', 'recovery.doc-1.ifc', 'recovery.doc-2.ifc', 'recovery.ifc',
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

const clearZonderListing = planRecoveryClear(
  [],
  manifest(SELF, [
    { id: 'doc-1', ifc: 'recovery.doc-1.ifc' },
    { id: 'doc-9', ifc: 'recovery.wt-a.doc-9.ifc' },
  ]),
  PROD,
);
eqSet('7g manifestregels zonder listing', clearZonderListing, ['recovery.doc-1.ifc']);

{
  const plan = planRecoveryExitClear({
    listing: ['recovery.documents.json', 'recovery.doc-eigen.ifc', 'recovery.doc-gecrasht.ifc'],
    manifest: manifest(SELF, [{ id: 'doc-eigen', ifc: 'recovery.doc-eigen.ifc' }, { id: 'doc-gecrasht', ifc: 'recovery.doc-gecrasht.ifc' }]),
    self: SELF, ownWritten: ['recovery.doc-eigen.ifc'], adopted: ['recovery.doc-gecrasht.ifc'], names: PROD,
  });
  eqSet('8a uitgesteld: alleen de eigen snapshot weg', plan.remove, ['recovery.doc-eigen.ifc']);
  eq('8b uitgesteld: manifest houdt de uitgestelde regel', J(plan.manifest === 'keep' || plan.manifest === 'remove' ? plan.manifest : plan.manifest.map((d) => d.id)), J(['doc-gecrasht']));
}
{
  const plan = planRecoveryExitClear({
    listing: ['recovery.documents.json', 'recovery.doc-gecrasht.ifc'],
    manifest: manifest(OTHER, [{ id: 'doc-gecrasht', ifc: 'recovery.doc-gecrasht.ifc' }]),
    self: SELF, ownWritten: [], adopted: [], names: PROD,
  });
  eqSet('8c venster open: niets weg', plan.remove, []);
  eq('8d venster open: manifest van de vorige start blijft', plan.manifest, 'keep');
}
{
  const plan = planRecoveryExitClear({
    listing: ['recovery.documents.json', 'recovery.doc-eigen.ifc', 'recovery.doc-eigen.ifc.tmp', 'recovery.wt-a.doc-9.ifc'],
    manifest: manifest(SELF, [{ id: 'doc-eigen', ifc: 'recovery.doc-eigen.ifc' }]),
    self: SELF, ownWritten: ['recovery.doc-eigen.ifc'], adopted: [], names: PROD,
  });
  eqSet('8e alleen eigen werk: snapshot en halffabricaat weg', plan.remove, ['recovery.doc-eigen.ifc', 'recovery.doc-eigen.ifc.tmp']);
  eq('8f alleen eigen werk: manifest weg', plan.manifest, 'remove');
}

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const blobA = PROD.archiveName(SHA_A);
const blobB = PROD.archiveName(SHA_B);
eq('9a archiefblob-naam', blobA, `recovery.xerarchive.${SHA_A}.bin`);
eq('9b productie herkent zijn eigen blob', PROD.archiveSha(blobA), SHA_A);
eq('9c productie herkent een DEV-blob NIET', PROD.archiveSha(DEV.archiveName(SHA_A)), null);
eq('9d dev herkent een productieblob NIET', DEV.archiveSha(blobA), null);
eq('9e een blob is geen snapshot', PROD.snapshotDocId(blobA), null);
eq('9f isOwnFile: eigen blob en zijn halffabricaat', [PROD.isOwnFile(blobA), PROD.isOwnFile(`${blobA}.tmp`)], [true, true]);
eq('9g isOwnFile: blob van een andere base niet', PROD.isOwnFile(DEV.archiveName(SHA_A)), false);
eq('9h een ongeldige sha is geen blob', PROD.archiveSha('recovery.xerarchive.xyz.bin'), null);
{
  const withArchive = (owner: string, docs: { id: string; ifc: string; xerArchive?: string }[]): RecoveryManifest => ({
    ...manifest(owner, docs),
    documents: docs.map((d) => ({ id: d.id, ifc: d.ifc, filePath: null, isDirty: true, ...(d.xerArchive ? { xerArchive: d.xerArchive } : {}) })),
  });
  const own = plan({
    listing: ['recovery.documents.json', blobA, blobB, `${blobB}.tmp`],
    prev: withArchive(SELF, [{ id: 'doc-1', ifc: 'recovery.snapshot.doc-1.g1.ifc', xerArchive: SHA_A }]),
    keep: ['recovery.snapshot.doc-1.g2.ifc'], keepArchives: [SHA_B], ownWrittenArchives: [SHA_B],
  });
  eqSet('9i verwijzing weg ⇒ blob weg; verwezen blob blijft (alleen zijn crash-halffabricaat weg)', own.remove, [blobA, `${blobB}.tmp`]);
  const foreign = plan({
    listing: ['recovery.documents.json', 'recovery.snapshot.doc-9.g1.ifc', blobA],
    prev: withArchive(OTHER, [{ id: 'doc-9', ifc: 'recovery.snapshot.doc-9.g1.ifc', xerArchive: SHA_A }]),
    keep: [], keepArchives: [], ownWrittenArchives: [SHA_A],
  });
  eqSet('9j blob van een meegedragen vreemde regel blijft staan', foreign.remove, []);
  eq('9k de meegedragen regel houdt zijn verwijzing', foreign.carryOver.map((d) => d.xerArchive), [SHA_A]);
  const stranger = plan({ listing: [blobB], prev: withArchive(OTHER, []), ownWrittenArchives: [] });
  eqSet('9l een blob buiten de eigen boekhouding wordt niet geveegd', stranger.remove, []);
  const shared = plan({
    listing: [blobA], prev: withArchive(SELF, [
      { id: 'doc-1', ifc: 'recovery.snapshot.doc-1.g1.ifc', xerArchive: SHA_A },
      { id: 'doc-2', ifc: 'recovery.snapshot.doc-2.g1.ifc', xerArchive: SHA_A },
    ]),
    keep: ['recovery.snapshot.doc-2.g1.ifc'], keepArchives: [SHA_A], ownWrittenArchives: [SHA_A],
  });
  eqSet('9m gedeelde blob blijft zolang één document ernaar verwijst', shared.remove.filter((n) => n === blobA), []);
  eqSet('9n clear neemt de eigen blobs mee', planRecoveryClear([blobA, DEV.archiveName(SHA_B)], null, PROD), [blobA]);
  eqSet('9o clear zonder listing vindt de blob via het manifest',
    planRecoveryClear([], withArchive(SELF, [{ id: 'doc-1', ifc: 'recovery.doc-1.ifc', xerArchive: SHA_A }]), PROD),
    ['recovery.doc-1.ifc', blobA]);
  const exitKeep = planRecoveryExitClear({
    listing: ['recovery.documents.json', 'recovery.doc-eigen.ifc', 'recovery.doc-gecrasht.ifc', blobA, blobB],
    manifest: withArchive(SELF, [
      { id: 'doc-eigen', ifc: 'recovery.doc-eigen.ifc', xerArchive: SHA_B },
      { id: 'doc-gecrasht', ifc: 'recovery.doc-gecrasht.ifc', xerArchive: SHA_A },
    ]),
    self: SELF, ownWritten: ['recovery.doc-eigen.ifc'], adopted: ['recovery.doc-gecrasht.ifc'], names: PROD,
    ownWrittenArchives: [SHA_A, SHA_B],
  });
  eqSet('9p afsluiten: eigen blob weg, blob van de uitgestelde regel blijft', exitKeep.remove, ['recovery.doc-eigen.ifc', blobB]);
  const exitForeign = planRecoveryExitClear({
    listing: ['recovery.documents.json', blobA], manifest: withArchive(OTHER, [{ id: 'doc-x', ifc: 'recovery.doc-x.ifc', xerArchive: SHA_A }]),
    self: SELF, ownWritten: [], adopted: [], names: PROD, ownWrittenArchives: [SHA_A],
  });
  eqSet('9q afsluiten: een vreemd manifest dat de blob noemt, houdt hem', exitForeign.remove, []);

  {
    const old = 'recovery.snapshot.doc-1.oud.ifc';
    const fresh = 'recovery.snapshot.doc-1.nieuw.ifc';
    const broken = 'recovery.snapshot.doc-2.stuk.ifc';
    const blob = PROD.archiveName(SHA_A);
    const previous = withArchive(OTHER, [
      { id: 'doc-1', ifc: old, xerArchive: SHA_A },
      { id: 'doc-2', ifc: broken, xerArchive: SHA_A },
    ]);
    const shared = plan({
      listing: [old, fresh, broken, blob], prev: previous, keep: [fresh],
      adopted: [old, broken], replaced: [old],
    });
    eqSet('vervangen: alleen de gezonde oude snapshot weg', shared.remove, [old]);
    eq('vervangen: onleesbare buur met gedeeld archief blijft aangeboden',
      shared.carryOver.map(d => d.ifc), [broken]);
    const noOtherReference = withArchive(OTHER, [{ id: 'doc-1', ifc: old, xerArchive: SHA_A }]);
    eqSet('vervangen: ongebruikt oud archief mag mee weg', plan({
      listing: [old, fresh, blob], prev: noOtherReference, keep: [fresh],
      adopted: [old], replaced: [old],
    }).remove, [old, blob]);
    eqSet('vervangen: archief van de nieuwe generatie blijft', plan({
      listing: [old, fresh, blob], prev: noOtherReference, keep: [fresh], keepArchives: [SHA_A],
      adopted: [old], replaced: [old],
    }).remove, [old]);
  }

}
{
  const v5Plan = planTauriV3RecoverySave(
    manifest(SELF, [{ id: 'doc-1', ifc: 'recovery.snapshot.doc-1.g1.ifc' }]),
    {
      activeDocumentId: 'doc-1',
      documents: [
        { id: 'doc-1', filePath: null, isDirty: true, datesAsRecorded: false, xerArchive: SHA_A },
        { id: 'doc-2', filePath: null, isDirty: true, datesAsRecorded: false, xerArchive: SHA_A },
      ],
      upserts: [{ id: 'doc-2', ifc: 'nieuw', filePath: null, isDirty: true, datesAsRecorded: false, xerArchive: SHA_A }],
    },
    'g-2', PROD,
  );
  eq('9r v5-plan: beide regels dragen de verwijzing', v5Plan.documents.map((d) => d.xerArchive), [SHA_A, SHA_A]);
}


if (diffs.length === 0) {
  console.log(`OK  recovery-isolation-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-isolation-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
