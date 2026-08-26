// "Spring naar taak"-geometrie (issue #65, WBS-sprongknop bij afhankelijkheden): de pure functies
// die het zoomniveau en de scroll bepalen wanneer je vanuit een afhankelijkheidsregel naar de
// gekoppelde taak springt, plus de gedeelde scrolgrenzen-formule (`computeGanttScrollBounds`,
// toegevoegd na een hyperkritische review — zie deel 3 hieronder).
//
// EERLIJK OVER WAT DIT MEET. Checks 01/02/06 herhalen de formule uit de implementatie zelf — die
// zijn per constructie groen, net als bij `check-zoom-steps.ts`. Wat ze wél vangen: een refactor
// die de formule stilletjes verandert zonder deze suite bij te werken. De checks die de
// klemgrenzen op een vast getal pinnen (03, 04, 05, 07) zijn de echte regressiebewaking. De
// BEDRADING (GanttCanvas geeft de juiste argumenten door aan deze pure functies) is geen headless
// test — dat is een browser-pass, zie docs/self-test-harness.md, net als bij
// `check-gantt-render-options.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.
import {
  computeFocusTaskHorizontal, computeFocusTaskScrollY, computeGanttScrollBounds,
  setGanttScrollBounds, clampGanttScroll,
  FOCUS_TASK_MIN_ZOOM, FOCUS_TASK_MAX_ZOOM,
} from '@/utils/ganttViewport';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const close = (label: string, got: number, want: number, eps = 0.001) => {
  checks++;
  if (Math.abs(got - want) > eps) {
    diffs.push(`${label}: verwacht ≈${want}, kreeg ${got}`);
  }
};

// ── 1) Horizontaal: een taak van "normale" duur landt tussen de grenzen. ─────
{
  const { zoom, scrollX } = computeFocusTaskHorizontal(10, 100, 1000);
  close('01 zoom = (bruikbareBreedte × 20%) / duur', zoom, (1000 * 0.2) / 10);
  close('02 scrollX centreert het midden van de taak', scrollX, 100 * zoom - 1000 / 2);
}

// ── 2) Horizontaal: ondergrens (lange taak) en bovengrens (milestone). ──────
{
  const long = computeFocusTaskHorizontal(730, 400, 1000);
  eq('03 een taak van jaren klemt op de ondergrens', long.zoom, FOCUS_TASK_MIN_ZOOM);

  // 0 dagen is een DEFENSIEVE invoer, geen realistische: de enige aanroeper (GanttCanvas.tsx) telt
  // bij een niet-uur-taak altijd +1 dag op bij de balkgeometrie (zelfde conventie als
  // `revealTaskIfOffscreen`), dus een milestone levert in de praktijk durationDays=1 op, nooit 0
  // (hyperkritische review issue #65 wees erop dat dit onderscheid hier ontbrak). Beide gevallen
  // moeten hetzelfde uitkomen — max(1, 0) === max(1, 1) — dus toets ze allebei.
  const milestoneDefensief = computeFocusTaskHorizontal(0, 50, 1000);
  eq('04 duration=0 (defensief) klemt op de bovengrens', milestoneDefensief.zoom, FOCUS_TASK_MAX_ZOOM);
  const milestoneEcht = computeFocusTaskHorizontal(1, 50, 1000);
  eq('04b duration=1 (wat een milestone in de praktijk doorgeeft) geeft hetzelfde resultaat',
    milestoneEcht.zoom, milestoneDefensief.zoom);
}

// ── 3) Horizontaal: scrollX gaat nooit negatief. ────────────────────────────
{
  const { scrollX } = computeFocusTaskHorizontal(5, 1, 100);
  eq('05 scrollX klemt op 0', scrollX, 0);
}

// De invoer is de GEMETEN timelinebreedte. Een oude tweede aftrek van 300px zou hier zoom 13.9
// geven; de correcte 995px (1000 minus uitsluitend de 5px splitter) levert 19.9.
{
  const splitPane = computeFocusTaskHorizontal(10, 100, 995);
  close('05b focus gebruikt de volledige gemeten timelinebreedte', splitPane.zoom, 19.9);
}

// ── 4) Verticaal: rij wordt gecentreerd in de zichtbare hoogte. ─────────────
{
  const scrollY = computeFocusTaskScrollY(10, 28, 40, 600);
  close('06 verticaal centreren', scrollY, 10 * 28 + 28 / 2 - (600 - 40) / 2);
}

// ── 5) Verticaal: rij 0 in een ruime viewport klemt op 0, niet negatief. ────
{
  const scrollY = computeFocusTaskScrollY(0, 28, 40, 600);
  eq('07 rij 0 in een ruime viewport klemt op 0', scrollY, 0);
}

// ── 6) computeGanttScrollBounds: de gedeelde formule achter `drawPrimary` én "spring naar
//      taak" (deel 3 hieronder). ──────────────────────────────────────────────
{
  const b1 = computeGanttScrollBounds(/* contentWidth */ 5000, /* rows */ 20, /* rowHeight */ 28,
    /* headerHeight */ 40, /* canvasWidth */ 900, /* canvasHeight */ 600);
  eq('08 maxScrollX = contentWidth - canvasWidth', b1.maxScrollX, 5000 - 900);
  eq('09 maxScrollY = rijen·rowHeight - (canvasHeight - headerHeight)', b1.maxScrollY, 20 * 28 - (600 - 40));

  // Content/rijen die ruim in de viewport passen: beide grenzen klemmen op 0, niet negatief.
  const b2 = computeGanttScrollBounds(400, 2, 28, 40, 900, 600);
  eq('10 maxScrollX klemt op 0 als de content past', b2.maxScrollX, 0);
  eq('11 maxScrollY klemt op 0 als alle rijen passen', b2.maxScrollY, 0);
}

// ── 7) Regressie: springen naar een taak na een zoomwijziging mag niet klemmen tegen de
//      grenzen van VÓÓR die wijziging (hyperkritische review issue #65 — dit is de bug die de
//      eerdere versie van dit knopje in de praktijk onbruikbaar maakte: je zoomde wél in, maar
//      bleef aan het begin van het project hangen omdat `setScroll` de scrolbare grenzen van de
//      oude, kleinere zoom nog niet had bijgewerkt). ───────────────────────────
{
  // Stap 1: een render bij lage zoom (bv. net na een fit-to-project) registreert KRAPPE grenzen.
  setGanttScrollBounds(computeGanttScrollBounds(700, 1, 28, 40, 900, 600));
  const { x: staleX } = clampGanttScroll(14950, 0);
  eq('12 karakterisering: ZONDER verse grenzen klemt de sprong fout (het gat dat de bug was)',
    staleX < 14950, true);

  // Stap 2: de fix — vóór `setScroll` de grenzen VOORUIT herberekenen met de NIEUWE zoom/
  // rijtelling (zoals GanttCanvas.tsx's "spring naar taak"-effect nu doet), niet de oude lezen.
  // contentWidth/rijen ruim genoeg gekozen dat de gewenste (14950, 1414) er nu wél binnen valt.
  setGanttScrollBounds(computeGanttScrollBounds(16000, 71, 28, 40, 900, 600));
  const { x: freshX, y: freshY } = clampGanttScroll(14950, 1414);
  eq('13 MET verse grenzen landt de sprong wél op de bedoelde positie (horizontaal)', freshX, 14950);
  eq('14 MET verse grenzen landt de sprong wél op de bedoelde positie (verticaal)', freshY, 1414);

  // Opruimen: geen enkele andere check in deze of een latere batterij mag deze module-globals
  // geërfd krijgen (headless run.sh bundelt elk script apart, maar binnen dít bestand wel).
  setGanttScrollBounds({ maxScrollX: 0, maxScrollY: 0 });
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  focus-task: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  focus-task: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
