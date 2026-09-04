/**
 * Ribbon-groep Baselines & Progress — layoutcontract.
 *
 * De drie baseline-/voortgangsregels vormen de linker RibbonButtonStack; balkkleuren en
 * resource-accent vormen de rechter. Elke stack rendert zijn kinderen onder elkaar. Zo blijven
 * beide kleurcontrols zichtbaar binnen de vaste linthoogte, zonder naast elkaar te staan.
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
eq('Baselines & Progress-groep bestaat', !!overlays, true);
eq('Baselines & Progress bestaat uit twee verticale stacks', overlays?.items.length, 2);
eq(
  'Baselines & Progress houdt de twee stacks in leesvolgorde',
  overlays?.items.map(item => item.id),
  ['overlaysStack', 'colorAccentStack'],
);

const overlayStack = overlays?.items[0];
const colorAccentStack = overlays?.items[1];
eq('Baselines & Progress eerste item is de overlay-stack', overlayStack?.kind, 'stack');
eq(
  'De overlay-stack houdt de drie bestaande regels in leesvolgorde',
  overlayStack?.kind === 'stack' ? overlayStack.items.map(item => item.id) : [],
  ['toggleBaselineOverlay', 'toggleProgressLine', 'toggleStatusDateLine'],
);
eq('Baselines & Progress tweede item is de kleurstack', colorAccentStack?.kind, 'stack');
eq(
  'Balkkleuren en resource-accent staan onder elkaar',
  colorAccentStack?.kind === 'stack' ? colorAccentStack.items.map(item => item.id) : [],
  ['screenColors', 'toggleResourceAccent'],
);

if (diffs.length === 0) {
  console.log(`OK  ribbon-overlays: alle checks groen (${checks})`);
  process.exit(0);
}

console.error(`XX ribbon-overlays: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.error(`   - ${diff}`);
process.exit(1);
