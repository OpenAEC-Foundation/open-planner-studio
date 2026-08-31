/**
 * Contract-check voor de "Je bent net geüpdatet"-vergelijklogica (releaseInfo.ts).
 * Pure functies → headless, geen store/DOM nodig. Exit 1 bij een afwijking.
 */
import {
  detectJustUpdated,
  pickInstallerAsset,
  daysBetween,
  findCurrentAndPrevious,
  computeComparison,
  type GhRelease,
} from '@/services/updater/releaseInfo';
import {
  RELEASE_HIGHLIGHT_CATALOG,
  defineReleaseHighlightCatalog,
  getReleaseHighlights,
  getReleaseHighlightsFromCatalog,
  hasLocalizedReleaseContent,
  isSafeHighlightIcon,
  isStableReleaseTag,
  validateReleaseHighlightCatalog,
  validateReleaseHighlightStats,
  type ReleaseHighlightCatalog,
  type VersionedReleaseHighlights,
} from '@/services/updater/releaseHighlights';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.error(`XX ${name}`);
  } else {
    console.log(`ok ${name}`);
  }
}

// ── detectJustUpdated ──────────────────────────────────────────────
check('detect: verse install → from null, to huidig', JSON.stringify(detectJustUpdated(undefined, '2026.7.13')) === JSON.stringify({ from: null, to: '2026.7.13' }));
check('detect: verse install is NIET null', detectJustUpdated(undefined, '2026.7.13') !== null);
check('detect: lege opgeslagen versie → from null', JSON.stringify(detectJustUpdated('', '2026.7.13')) === JSON.stringify({ from: null, to: '2026.7.13' }));
check('detect: gelijk → null', detectJustUpdated('2026.7.13', '2026.7.13') === null);
check('detect: sprong → van/naar', JSON.stringify(detectJustUpdated('2026.7.12', '2026.7.13')) === JSON.stringify({ from: '2026.7.12', to: '2026.7.13' }));
check('detect: downgrade telt ook', detectJustUpdated('2026.7.11', '2026.7.10') !== null);

// ── daysBetween ────────────────────────────────────────────────────
check('days: 12 dagen', daysBetween('2026-07-01T00:00:00Z', '2026-07-13T00:00:00Z') === 12);
check('days: zelfde dag = 0', daysBetween('2026-07-13T09:00:00Z', '2026-07-13T20:00:00Z') === 0);
check('days: ongeldige datum → null', daysBetween('niet-een-datum', '2026-07-13T00:00:00Z') === null);

// ── pickInstallerAsset ─────────────────────────────────────────────
const assets = [
  { name: 'ops_2026.7.11_amd64.AppImage', size: 90_000_000 },
  { name: 'ops_2026.7.11_amd64.AppImage.sig', size: 200 },
  { name: 'ops_2026.7.11_amd64.deb', size: 45_000_000 },
  { name: 'ops_2026.7.11_x64-setup.exe', size: 12_000_000 },
  { name: 'ops_2026.7.11_universal.dmg', size: 30_000_000 },
];
check('asset: appimage', pickInstallerAsset(assets, 'appimage', 'linux')?.size === 90_000_000);
check('asset: deb', pickInstallerAsset(assets, 'deb', 'linux')?.size === 45_000_000);
check('asset: native windows → -setup.exe', pickInstallerAsset(assets, 'native', 'windows')?.size === 12_000_000);
check('asset: native macos → dmg', pickInstallerAsset(assets, 'native', 'macos')?.size === 30_000_000);
check('asset: snap → null', pickInstallerAsset(assets, 'snap', 'linux') === null);
check('asset: negeert .sig', pickInstallerAsset(assets, 'appimage', 'linux')?.name.endsWith('.sig') === false);
check('asset: ontbrekend → null', pickInstallerAsset([], 'appimage', 'linux') === null);

// ── findCurrentAndPrevious + computeComparison ─────────────────────
const releases: GhRelease[] = [
  { tag_name: 'v2026.7.11', published_at: '2026-07-13T00:00:00Z', body: 'Nieuw in .11', prerelease: false, draft: false, assets: [{ name: 'ops_x64-setup.exe', size: 12_000_000 }] },
  { tag_name: 'v2026.7.10-beta', published_at: '2026-07-05T00:00:00Z', body: 'beta', prerelease: true, draft: false, assets: [] },
  { tag_name: 'v2026.7.10', published_at: '2026-07-01T00:00:00Z', body: 'oud', prerelease: false, draft: false, assets: [{ name: 'ops_x64-setup.exe', size: 15_000_000 }] },
];
const found = findCurrentAndPrevious(releases, '2026.7.11');
check('find: huidige op tag (met v-prefix tolerantie)', found.current?.tag_name === 'v2026.7.11');
check('find: vorige slaat prerelease over', found.previous?.tag_name === 'v2026.7.10');

const cmp = computeComparison(found.current!, found.previous, 'native', 'windows');
check('compare: 12 dagen', cmp.daysBetween === 12);
check('compare: 3 MB kleiner (negatief)', cmp.sizeDeltaBytes === -3_000_000);
check('compare: huidige grootte', cmp.currentSizeBytes === 12_000_000);

// Geen vorige release → size/tijd null.
const soloCmp = computeComparison(found.current!, null, 'native', 'windows');
check('compare: zonder vorige → daysBetween null', soloCmp.daysBetween === null);
check('compare: zonder vorige → sizeDelta null', soloCmp.sizeDeltaBytes === null);

// ── lokaal visueel manifest ────────────────────────────────────────
const highlights = getReleaseHighlights('v2026.8.1');
check('highlights: huidige release heeft primaire highlight', highlights?.primary !== undefined);
check('highlights: exact vier secundaire highlights', highlights?.secondary.length === 4);
check('highlights: alleen whitelisted iconen', !!highlights && [highlights.primary, ...highlights.secondary].every(item => isSafeHighlightIcon(item.icon)));
check('highlights: stats zijn lokaal beschikbaar', highlights?.stats.commitsSincePrevious === 360 && highlights.stats.addedCodeLines === 45066);
check('highlights: onbekende versie valt veilig terug', getReleaseHighlights('1900.1.1') === null);
check('highlights: alle 14 locales hebben release-inhoud', hasLocalizedReleaseContent('2026.8.1'));
check('highlights: ook zichtbare rubrieklabels zijn vertaald', getReleaseHighlights('2026.8.1', 'nl')?.secondary[0]?.category === 'RESOURCEBIBLIOTHEKEN' && getReleaseHighlights('2026.8.1', 'ar')?.secondary[0]?.category === 'الموارد');
check('highlights: alleen primary kan een gids hebben', !!highlights?.primary.docsId && highlights.secondary.every(item => !('docsId' in item)));

// Een volgende release krijgt een volledig nieuw blok. De oude, uitgebrachte copy blijft intact.
const currentBlock = RELEASE_HIGHLIGHT_CATALOG['2026.8.1']!;
const nextBlock: VersionedReleaseHighlights = {
  ...currentBlock,
  copy: {
    ...currentBlock.copy,
    nl: [
      { ...currentBlock.copy.nl[0], title: 'Denkbeeldige volgende release' },
      currentBlock.copy.nl[1],
      currentBlock.copy.nl[2],
      currentBlock.copy.nl[3],
      currentBlock.copy.nl[4],
    ],
  },
};
const twoVersionCatalog = defineReleaseHighlightCatalog({
  ...RELEASE_HIGHLIGHT_CATALOG,
  '2099.1.1': nextBlock,
});
check('highlights: volgende versie overschrijft 2026.8.1-copy niet', getReleaseHighlightsFromCatalog(twoVersionCatalog, '2026.8.1', 'nl')?.primary.title === 'Importeer met de datums uit je planning' && getReleaseHighlightsFromCatalog(twoVersionCatalog, '2099.1.1', 'nl')?.primary.title === 'Denkbeeldige volgende release');

type MutableCatalog = Record<string, {
  [key: string]: unknown;
  primary: Record<string, unknown>;
  secondary: Array<Record<string, unknown>>;
  stats: Record<string, unknown>;
  copy: Record<string, unknown>;
}>;
const cloneCatalog = (): MutableCatalog => JSON.parse(JSON.stringify(RELEASE_HIGHLIGHT_CATALOG)) as MutableCatalog;

const secondaryGuide = cloneCatalog();
secondaryGuide['2026.8.1']!.secondary[0]!.docsId = 'niet-toegestaan';
check('highlights: verifier weigert secondary gids', validateReleaseHighlightCatalog(secondaryGuide as unknown as ReleaseHighlightCatalog, '2026.8.1').some(error => error.includes('secondary 1 heeft verboden velden')));

const missingLocale = cloneCatalog();
delete missingLocale['2026.8.1']!.copy.ar;
check('highlights: verifier weigert ontbrekende locale', validateReleaseHighlightCatalog(missingLocale as unknown as ReleaseHighlightCatalog, '2026.8.1').some(error => error.includes('ontbrekende locales: ar')));

const threeSecondary = cloneCatalog();
threeSecondary['2026.8.1']!.secondary.pop();
check('highlights: verifier weigert geen exact vier secondaries', validateReleaseHighlightCatalog(threeSecondary as unknown as ReleaseHighlightCatalog, '2026.8.1').some(error => error.includes('verwacht exact 4 secondary')));

const unsafeIcon = cloneCatalog();
unsafeIcon['2026.8.1']!.primary.icon = 'screenshot';
check('highlights: verifier weigert onveilig pictogram', validateReleaseHighlightCatalog(unsafeIcon as unknown as ReleaseHighlightCatalog, '2026.8.1').some(error => error.includes('geen veilig pictogram')));

const forbiddenVisualField = cloneCatalog();
forbiddenVisualField['2026.8.1']!.screenshot = 'niet toegestaan';
check('highlights: verifier weigert screenshot/layout-achtige data', validateReleaseHighlightCatalog(forbiddenVisualField as unknown as ReleaseHighlightCatalog, '2026.8.1').some(error => error.includes('verboden releasevelden: screenshot')));

check('highlights: verifier weigert stats die afwijken van Git-meting', validateReleaseHighlightStats(RELEASE_HIGHLIGHT_CATALOG, '2026.8.1', { ...currentBlock.stats, addedCodeLines: currentBlock.stats.addedCodeLines + 1 }).some(error => error.includes('addedCodeLines')));
check('highlights: statistiekverifier gebruikt alleen stabiele CalVer-tags', isStableReleaseTag('v2026.8.1') && !isStableReleaseTag('v2026.8.1-beta') && !isStableReleaseTag('v2026.8'));

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
