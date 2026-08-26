// Zoomstap-regressie (K-item 34, voorbereidend).
//
// GEVONDEN BIJ HET METEN VOOR HET COMMANDS-REGISTER. De in-/uitzoomstap stond op DRIE plekken los:
// `ribbonConfig.tsx`, `ribbonWidgets.tsx` en `shortcutRegistry.ts`. De twee lintdefinities zoomden
// in met +10 maar uit met −5, de sneltoets deed beide 10. Gevolg: één keer in- en weer uitzoomen
// met de knoppen bracht je 5 hoger uit dan waar je begon, en herhaald klikken liet de zoom
// weglopen. Er stond geen enkele toelichting bij de −5.
//
// Dat is precies de faalmodus waar item 34 over gaat: dezelfde actie op meerdere plekken los
// gedefinieerd, zonder iets dat ze bij elkaar houdt. De waarden staan nu als `ZOOM_STEP` en
// `DEFAULT_ZOOM` in `ganttViewport.ts`; deze batterij bewaakt twee dingen die `tsc` niet ziet:
//
//  1) GEDRAG — in- en weer uitzoomen komt exact terug op het startpunt (dat is wat de gebruiker
//     merkte), en zoom herstellen landt op de gedeelde default.
//  2) BRON — nergens in `src/` staat nog een kale zoomstap of een kale resetwaarde naast een
//     `setZoom`. Zonder die tweede check kan iemand er morgen weer een literal bijzetten en is de
//     consolidatie stil ongedaan gemaakt.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { ZOOM_STEP, DEFAULT_ZOOM, computeTimelineZoom } from '@/utils/ganttViewport';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── 1) Gedrag: in- en uitzoomen is elkaars omgekeerde. ───────────────────────
//
// EERLIJK OVER WAT DIT MEET. Een eerdere versie beweerde hier "dit is de check die de gevonden
// fout zou hebben gevangen". Dat was onwaar en een review wees het aan: deze checks gebruiken
// DEZELFDE constante beide kanten op, dus asymmetrie is per constructie onmogelijk. De
// historische bug terugzetten liet uitsluitend de BRON-checks hieronder omvallen, niet deze.
// Wat 01–03 wél toetsen: dat `setZoom` lineair is en niet stilletjes klemt of afrondt — als dat
// ooit verandert, klopt de aanname onder de knoppen niet meer. De bewaking op de asymmetrie zelf
// zit in deel 2.
S().setZoom(DEFAULT_ZOOM);
const begin = S().view.zoom;
S().setZoom(S().view.zoom + ZOOM_STEP);
eq('01 inzoomen verhoogt met precies één stap', S().view.zoom, begin + ZOOM_STEP);
S().setZoom(S().view.zoom - ZOOM_STEP);
eq('02 uitzoomen brengt je exact terug op het startpunt', S().view.zoom, begin);

// Tien keer heen en weer: een asymmetrie van 1 zou hier al 10 verschil geven.
for (let i = 0; i < 10; i++) {
  S().setZoom(S().view.zoom + ZOOM_STEP);
  S().setZoom(S().view.zoom - ZOOM_STEP);
}
eq('03 tien keer in/uit laat de zoom niet weglopen', S().view.zoom, begin);

// Cursorgeankerde paneelzoom: beide uiterste geldige pixels en een hoge scrollpositie. Deze
// pure helper wordt door zowel het primaire als secundaire pane gebruikt.
eq('03c zoom op de lokale linkerrand behoudt de datum onder de cursor',
  computeTimelineZoom(30, 60, 900, 0, 400), { zoom: 60, scrollX: 1800 });
eq('03d zoom op de lokale rechterrand behoudt de datum onder de cursor',
  computeTimelineZoom(30, 60, 900, 639, 400), { zoom: 60, scrollX: 2439 });

// ── 2) Bron: geen kale zoomwaarden meer naast setZoom. ───────────────────────
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

    // FALEN-DICHT. De scans hieronder verwachten een LEGE lijst, en `|| true` slikt elke
    // grep-fout — ontbreekt `grep`, of gaat er iets anders mis, dan zijn ze stil groen. Een
    // review mat dat. Daarom eerst een positieve controle: de scan MOET de canonieke declaratie
    // in ganttViewport.ts vinden. Vindt hij die niet, dan werkt het gereedschap niet en zeggen de
    // drie checks eronder niets.
    eq('03b de scan werkt (vindt de canonieke ZOOM_STEP-declaratie)',
      scan(String.raw`export const ZOOM_STEP`), ['src/utils/ganttViewport.ts:22:export const ZOOM_STEP = 10;']);

    // Een getal waar de constante hoort. `[ ]?` omdat dit project bewust geen stijlregels in
    // ESLint heeft: niets dwingt de spaties rond de operator af, dus `zoom-5` moet ook vallen.
    eq('04 geen kale zoomstap meer in src/', scan(String.raw`zoom ?[+-] ?[0-9]`), []);
    // `setZoom(30)` — de resetwaarde als kaal getal.
    eq('05 geen kale zoomresetwaarde meer in src/', scan(String.raw`setZoom\( ?[0-9]`), []);
    // En geen tweede declaratie van de default naast die in ganttViewport.ts. `(export )?` is
    // nodig: de canonieke declaratie IS geëxporteerd, dus zonder dat matchte de regex alleen een
    // niet-geëxporteerde kopie en was het filter eronder dode code (gemeten in een review).
    eq('06 DEFAULT_ZOOM wordt nergens opnieuw gedeclareerd',
      scan(String.raw`^\s*(export )?(const|let) DEFAULT_ZOOM`).filter(l => !l.startsWith('src/utils/ganttViewport.ts')), []);
    eq('07 ZOOM_STEP wordt nergens opnieuw gedeclareerd',
      scan(String.raw`^\s*(export )?(const|let) ZOOM_STEP`).filter(l => !l.startsWith('src/utils/ganttViewport.ts')), []);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  zoom-steps: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  zoom-steps: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
