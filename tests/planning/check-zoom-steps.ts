import { useAppStore } from '@/state/appStore';
import { ZOOM_STEP, DEFAULT_ZOOM, computeAnchoredZoom, computeTimelineZoom } from '@/utils/ganttViewport';
import { maxGanttZoom } from '@/engine/renderer/timelineTiers';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

S().setZoom(DEFAULT_ZOOM);
const begin = S().view.zoom;
S().setZoom(S().view.zoom + ZOOM_STEP);
eq('01 inzoomen verhoogt met precies één stap', S().view.zoom, begin + ZOOM_STEP);
S().setZoom(S().view.zoom - ZOOM_STEP);
eq('02 uitzoomen brengt je exact terug op het startpunt', S().view.zoom, begin);

for (let i = 0; i < 10; i++) {
  S().setZoom(S().view.zoom + ZOOM_STEP);
  S().setZoom(S().view.zoom - ZOOM_STEP);
}
eq('03 tien keer in/uit laat de zoom niet weglopen', S().view.zoom, begin);

eq('03c zoom op de lokale linkerrand behoudt de datum onder de cursor',
  computeTimelineZoom(30, 60, 900, 0, 400), { zoom: 60, scrollX: 1800 });
eq('03d zoom op de lokale rechterrand behoudt de datum onder de cursor',
  computeTimelineZoom(30, 60, 900, 639, 400), { zoom: 60, scrollX: 2439 });

eq('03c geankerde zoom houdt dezelfde dag onder de cursor', computeAnchoredZoom({
  currentZoom: 20,
  currentScrollX: 80,
  requestedZoom: 40,
  anchorX: 300,
  chartOriginX: 100,
  maxZoom: 400,
}), { zoom: 40, scrollX: 360 });
eq('03d geankerde zoom klemt secondary zonder taaktabel op dezelfde route', computeAnchoredZoom({
  currentZoom: 50,
  currentScrollX: 150,
  requestedZoom: 2000,
  anchorX: 250,
  chartOriginX: 0,
  maxZoom: 1000,
}), { zoom: 1000, scrollX: 7750 });
eq('03e ongewijzigde geankerde zoom is een expliciete no-op', computeAnchoredZoom({
  currentZoom: 30,
  currentScrollX: 90,
  requestedZoom: 30,
  anchorX: 200,
  chartOriginX: 0,
  maxZoom: 400,
}), null);

eq('03f zonder kwartierzoom geldt altijd de uurgrens', maxGanttZoom(false), 1000);
eq('03g urenmodus bereikt 1000 px/dag', maxGanttZoom(false), 1000);
eq('03h kwartiermodus bereikt 4000 px/dag', maxGanttZoom(true), 4000);
S().setUI({ enableQuarterHourZoom: false });
S().setZoom(1000);
eq('03i setZoom kapt urenmodus niet voortijdig af', S().view.zoom, 1000);
S().setUI({ enableQuarterHourZoom: true });
S().setTimeScale('hour');
eq('03j tijdschaal uur blijft bereikbaar met kwartiermodus aan', S().view.zoom, 1000);
S().setZoom(4000);
eq('03k setZoom bereikt de kwartiergrens', S().view.zoom, 4000);

{
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname, relative } = await import('node:path');
  const { execSync } = await import('node:child_process');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  const srcDir = join(root, 'src');

  checks++;
  if (!existsSync(srcDir)) {
    diffs.push(`04 bron-assert overgeslagen: src/ niet gevonden vanaf ${dirname(fileURLToPath(import.meta.url))}`);
  } else {
    const scan = (pattern: string): string[] => execSync(
      `grep -rnE ${JSON.stringify(pattern)} ${JSON.stringify(srcDir)} --include=*.ts --include=*.tsx || true`,
      { encoding: 'utf8' },
    ).split('\n').filter(Boolean).map(l => relative(root, l));

    eq('03b de scan werkt (vindt de canonieke ZOOM_STEP-declaratie)',
      scan(String.raw`export const ZOOM_STEP`).map(l => l.replace(/^([^:]+):\d+:/, '$1:')),
      ['src/utils/ganttViewport.ts:export const ZOOM_STEP = 10;']);

    eq('04 geen kale zoomstap meer in src/', scan(String.raw`zoom ?[+-] ?[0-9]`), []);
    eq('05 geen kale zoomresetwaarde meer in src/', scan(String.raw`setZoom\( ?[0-9]`), []);
    eq('06 DEFAULT_ZOOM wordt nergens opnieuw gedeclareerd',
      scan(String.raw`^\s*(export )?(const|let) DEFAULT_ZOOM`).filter(l => !l.startsWith('src/utils/ganttViewport.ts')), []);
    eq('07 ZOOM_STEP wordt nergens opnieuw gedeclareerd',
      scan(String.raw`^\s*(export )?(const|let) ZOOM_STEP`).filter(l => !l.startsWith('src/utils/ganttViewport.ts')), []);
  }
}

if (diffs.length === 0) {
  console.log(`OK  zoom-steps: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  zoom-steps: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
