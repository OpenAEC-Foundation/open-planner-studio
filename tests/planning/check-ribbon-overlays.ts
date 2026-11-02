/**
 * Ribbon-groep Baselines & Progress — layoutcontract.
 *
 * Elke stack rendert zijn kinderen onder elkaar (maximaal drie per stack binnen de vaste
 * linthoogte), zonder naast elkaar te staan. De baseline-/voortgangsregels delen één stack, en
 * balkkleuren en resource-accent staan onder elkaar. Welke stack precies welke overige knop draagt
 * (spelingsband #130, relatielijnen #144) ligt bewust NIET vast: dat is indeling, geen contract.
 */
// De ribbon-config laadt i18n, dat bij module-initialisatie de documentrichting zet. De test leest
// alleen declaratieve config en heeft dus geen DOM nodig, behalve deze minimale Node-shim.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };

const { RIBBON_TABS } = await import('@/components/layout/Ribbon/ribbonConfig');

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const overlays = RIBBON_TABS.beeld.find(group => group.id === 'overlays');
const bars = RIBBON_TABS.beeld.find(group => group.id === 'bars');
eq('Baselines & Progress-groep bestaat', !!overlays, true);
// Issue #391: de balkweergave staat in een eigen groep "Balken".
eq('Balken-groep bestaat, direct na Baselines & Progress',
  RIBBON_TABS.beeld.findIndex(group => group.id === 'bars'),
  RIBBON_TABS.beeld.findIndex(group => group.id === 'overlays') + 1);

// Invarianten i.p.v. een vastgepinde indeling: een nieuwe knop in een stack met ruimte, of een
// extra stack, mag deze test niet breken (voorheen moest elke toevoeging hier handmatig mee, zie
// #130). Wat wél vast ligt: stacks hebben hooguit drie knoppen binnen de linthoogte, de bestaande
// knoppen blijven bestaan, en de paren die bij elkaar horen staan onder elkaar in één stack.
// Enige uitzondering op "alles in stacks": de grote gesplitste knop Baseline-overlay (eigen kolom).
const items = [...(overlays?.items ?? []), ...(bars?.items ?? [])];
const stackOf = (id: string) =>
  items.find(item => item.kind === 'stack' && item.items.some(child => child.id === id));
const idsIn = (id: string) => {
  const stack = stackOf(id);
  return stack?.kind === 'stack' ? stack.items.map(child => child.id) : [];
};

for (const item of items) {
  if (item.id === 'toggleBaselineOverlay') {
    eq('Baseline-overlay is een eigen (grote) kolom', item.kind, 'component');
    continue;
  }
  eq(`Item ${item.id} is een verticale stack (niets naast elkaar)`, item.kind, 'stack');
  eq(`Stack ${item.id} past binnen de vaste linthoogte (max drie)`, item.kind === 'stack' && item.items.length <= 3, true);
}

const idsOf = (group: typeof overlays) =>
  (group?.items ?? []).flatMap(item => (item.kind === 'stack' ? item.items.map(child => child.id) : [item.id]));
const allIds = [...idsOf(overlays), ...idsOf(bars)];
eq('Geen knop staat twee keer in de groepen', new Set(allIds).size, allIds.length);
for (const id of ['toggleBaselineOverlay', 'toggleProgressLine', 'toggleStatusDateLine']) {
  eq(`Knop ${id} staat in Baselines & Progress`, idsOf(overlays).includes(id), true);
}
for (const id of ['screenColors', 'toggleResourceAccent', 'toggleFloatBand', 'toggleRelations']) {
  eq(`Knop ${id} staat in Balken`, idsOf(bars).includes(id), true);
}

eq(
  'Voortgangs- en statusdatumlijn staan in één stack, in leesvolgorde',
  idsIn('toggleProgressLine').filter(id => ['toggleProgressLine', 'toggleStatusDateLine'].includes(id)),
  ['toggleProgressLine', 'toggleStatusDateLine'],
);
eq(
  'Balkkleuren en resource-accent staan onder elkaar in dezelfde stack',
  idsIn('screenColors').includes('toggleResourceAccent'),
  true,
);

if (diffs.length === 0) {
  console.log(`OK  ribbon-overlays: alle checks groen (${checks})`);
  process.exit(0);
}

console.error(`XX ribbon-overlays: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.error(`   - ${diff}`);
process.exit(1);
