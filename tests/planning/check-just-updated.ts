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
check('detect: verse install → null', detectJustUpdated(undefined, '2026.7.11') === null);
check('detect: gelijk → null', detectJustUpdated('2026.7.11', '2026.7.11') === null);
check('detect: sprong → van/naar', JSON.stringify(detectJustUpdated('2026.7.10', '2026.7.11')) === JSON.stringify({ from: '2026.7.10', to: '2026.7.11' }));
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
check('compare: body van huidige', cmp.currentBody === 'Nieuw in .11');
check('compare: 12 dagen', cmp.daysBetween === 12);
check('compare: 3 MB kleiner (negatief)', cmp.sizeDeltaBytes === -3_000_000);
check('compare: huidige grootte', cmp.currentSizeBytes === 12_000_000);

// Geen vorige release → size/tijd null, body blijft.
const soloCmp = computeComparison(found.current!, null, 'native', 'windows');
check('compare: zonder vorige → daysBetween null', soloCmp.daysBetween === null);
check('compare: zonder vorige → sizeDelta null', soloCmp.sizeDeltaBytes === null);
check('compare: zonder vorige → body wel', soloCmp.currentBody === 'Nieuw in .11');

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
