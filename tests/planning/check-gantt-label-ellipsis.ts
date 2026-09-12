// U2 — balklabels met een echte ellips in plaats van een harde clip-snede.
//
// De taaknaam op een balk werd getekend binnen een `clip()`-rechthoek. Paste hij niet, dan viel hij
// midden in een letter weg ("Sheet pil") zonder enig teken dat er meer stond — en `fillText`'s
// maxWidth is geen alternatief, want die KNIJPT de glyphs samen. `GanttRenderer.ellipsize` zoekt nu
// binair met `measureText` de langste prefix die mét "…" past.
//
// Deze check draait de ECHTE renderer met een opnemende ctx-stub (measureText = 6 px per teken, het
// bestaande stubpatroon) en controleert per balk welke string er daadwerkelijk de `fillText` in ging.
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const CHAR_W = 6; // zelfde measureText-stub als de andere renderer-checks

interface TextCall { text: string; x: number; y: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; texts: TextCall[] } {
  const texts: TextCall[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number, y: number) => { texts.push({ text: String(text), x, y }); },
    strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * CHAR_W }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

// ── Scène: twee balken van dezelfde breedte, één korte en één veel te lange naam ──
const FIXED_START = '2026-01-05'; // maandag
const FIXED_FINISH = '2026-01-09';
const KORT = 'Fundering';
const LANG = 'Sheet piling installation along the northern excavation boundary';

S().newProject();
S().addTask({ name: KORT });
S().runCPM();
const time = {
  ...S().tasks[0].time,
  scheduleStart: FIXED_START, scheduleFinish: FIXED_FINISH,
  earlyStart: FIXED_START, earlyFinish: FIXED_FINISH,
  lateStart: FIXED_START, lateFinish: FIXED_FINISH,
  totalFloat: 0, isCritical: false,
};
const kort: Task = { ...S().tasks[0], id: 'kort', name: KORT, time } as Task;
const lang: Task = { ...S().tasks[0], id: 'lang', name: LANG, time } as Task;

const rows: ViewRow[] = [
  { kind: 'task', rowKey: kort.id, task: kort, depth: 0, dimmed: false },
  { kind: 'task', rowKey: lang.id, task: lang, depth: 0, dimmed: false },
];

const W = 1200, H = 400, ROWH = 28, HDRH = 60, ZOOM = 24;
const { ctx, texts } = makeCtx();
const st = S();
const renderer = new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: st.calendar,
  view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: FIXED_START },
  selectedTaskIds: [],
  showStatusDateLine: false,
  showProgressLine: false,
  canvasWidth: W,
  canvasHeight: H,
  rowHeight: ROWH,
  headerHeight: HDRH,
});
renderer.render();

const rectKort = renderer.getTaskBarRect('kort');
const rectLang = renderer.getTaskBarRect('lang');
ok('opzet: beide balken hebben een geometrie', rectKort !== null && rectLang !== null);

if (rectKort && rectLang) {
  // De balken zijn even breed (zelfde datums/zoom); `drawTaskBar` tekent zijn label op x1 + 6.
  const breedte = rectLang.right - rectLang.left;
  ok(`opzet: balk breed genoeg (>40 px) — is ${breedte}`, breedte > 40);
  // De beschikbare labelruimte is precies `width - 10` (tussen tekststart x1+6 en cliprand x1+width-4).
  const maxW = breedte - 10;
  // Het lange label past van geen kant: dat is de hele opzet van deze check.
  ok('opzet: de lange naam past niet in de balk', LANG.length * CHAR_W > maxW);

  const labelKort = texts.find((t) => Math.abs(t.x - (rectKort.left + 6)) < 0.001 && t.text.startsWith('Fund'));
  const labelLang = texts.find((t) => Math.abs(t.x - (rectLang.left + 6)) < 0.001 && t.text.startsWith('Sheet'));

  ok('korte naam: label getekend', labelKort !== undefined);
  ok('lange naam: label getekend', labelLang !== undefined);

  if (labelKort) {
    ok('korte naam blijft ONGEWIJZIGD (geen ellips)', labelKort.text === KORT);
  }
  if (labelLang) {
    ok('lange naam eindigt op een ellips', labelLang.text.endsWith('…'));
    ok('lange naam is echt ingekort', labelLang.text.length < LANG.length);
    ok(
      `lange naam past binnen de balkbreedte (${labelLang.text.length * CHAR_W} <= ${maxW})`,
      labelLang.text.length * CHAR_W <= maxW,
    );
    // Maximaal benut: één teken erbij zou niet meer passen.
    const eenMeer = labelLang.text.slice(0, -1) + LANG.charAt(labelLang.text.length - 1) + '…';
    ok('ellips benut de beschikbare breedte maximaal', eenMeer.length * CHAR_W > maxW);
    // En het BEGIN van de naam blijft staan — dat was juist het leesprobleem.
    ok('het begin van de naam blijft leesbaar', LANG.startsWith(labelLang.text.slice(0, -1)));
  }
}

// ── Uitslag ─────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  gantt-label-ellipsis: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-label-ellipsis: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
