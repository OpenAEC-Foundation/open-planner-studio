// U2 — balklabels met een echte ellips in plaats van een harde clip-snede.
//
// De taaknaam op een balk werd getekend binnen een `clip()`-rechthoek. Paste hij niet, dan viel hij
// midden in een letter weg ("Sheet pil") zonder enig teken dat er meer stond — en `fillText`'s
// maxWidth is geen alternatief, want die KNIJPT de glyphs samen. `GanttRenderer.ellipsize` zoekt nu
// binair met `measureText` de langste prefix die mét "…" past.
//
// Sinds oktober 2026 staat een naam die niet in de balk past RECHTS achter de balk, voorbij de knik
// van de eigen uitgaande relatie, volledig tot OUTSIDE_MAX px en pas daarna met een ellips
// (GanttRenderer `drawOutsideBarName`).
//
// Een samenvattingstaak (fase) draagt zijn naam ALTIJD rechts achter de balk, ook als hij erin zou
// passen, en nooit op de balk zelf (issue #729).
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
/** Gelijk aan ARROW_STUB + OUTSIDE_LABEL_GAP en OUTSIDE_LABEL_MAX in GanttRenderer: de naam begint
 *  voorbij de knik van de eigen uitgaande relatie. */
const OUTSIDE_GAP = 8 + 6;
const OUTSIDE_MAX = 260;

interface TextCall { text: string; x: number; y: number }
const rijY = (r: { top: number; bottom: number }) => (t: TextCall) => t.y > r.top && t.y < r.bottom;
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

// Samenvattingen met dezelfde datums: een korte naam die IN de balk zou passen, en een lange.
const sumKort: Task = { ...kort, id: 'sum-kort', isSummary: true } as Task;
const sumLang: Task = { ...lang, id: 'sum-lang', isSummary: true } as Task;

const rows: ViewRow[] = [
  { kind: 'task', rowKey: kort.id, task: kort, depth: 0, dimmed: false },
  { kind: 'task', rowKey: lang.id, task: lang, depth: 0, dimmed: false },
  { kind: 'task', rowKey: sumKort.id, task: sumKort, depth: 0, dimmed: false },
  { kind: 'task', rowKey: sumLang.id, task: sumLang, depth: 0, dimmed: false },
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

  // De samenvattingen dragen dezelfde namen en x-posities. Alleen de eigen rij bewijst dat
  // de gewone taak haar label heeft; de fase twee rijen lager mag dat niet overnemen (#473).
  const kortTeksten = texts.filter(rijY(rectKort));
  const langTeksten = texts.filter(rijY(rectLang));
  const labelKort = kortTeksten.find((t) => Math.abs(t.x - (rectKort.left + 6)) < 0.001 && t.text.startsWith('Fund'));
  const labelLang = langTeksten.find((t) => Math.abs(t.x - (rectLang.right + OUTSIDE_GAP)) < 0.001 && t.text.startsWith('Sheet'));

  ok('korte naam: label in de balk getekend', labelKort !== undefined);
  ok(`lange naam: label rechts naast de balk getekend (teksten op eigen rij: ${JSON.stringify(langTeksten.map(t => [t.text.slice(0, 12), t.x]))})`, labelLang !== undefined);
  ok('lange naam: GEEN afgekapt label meer in de balk', !langTeksten.some((t) => Math.abs(t.x - (rectLang.left + 6)) < 0.001 && t.text.startsWith('Sheet')));

  if (labelKort) {
    ok('korte naam blijft ONGEWIJZIGD (geen ellips)', labelKort.text === KORT);
  }
  if (labelLang) {
    // De naam is langer dan OUTSIDE_MAX: pas dáár komt een ellips, niet op de balkbreedte.
    ok('opzet: de lange naam is breder dan de maximale labelbreedte', LANG.length * CHAR_W > OUTSIDE_MAX);
    ok('lange naam eindigt op een ellips', labelLang.text.endsWith('…'));
    ok(
      `lange naam past binnen ${OUTSIDE_MAX} px (${labelLang.text.length * CHAR_W})`,
      labelLang.text.length * CHAR_W <= OUTSIDE_MAX,
    );
    ok(`lange naam is veel langer dan wat in de balk paste (${labelLang.text.length * CHAR_W} > ${maxW})`, labelLang.text.length * CHAR_W > maxW);
    // Maximaal benut: één teken erbij zou niet meer passen.
    const eenMeer = labelLang.text.slice(0, -1) + LANG.charAt(labelLang.text.length - 1) + '…';
    ok('ellips benut de beschikbare breedte maximaal', eenMeer.length * CHAR_W > OUTSIDE_MAX);
    // En het BEGIN van de naam blijft staan — dat was juist het leesprobleem.
    ok('het begin van de naam blijft leesbaar', LANG.startsWith(labelLang.text.slice(0, -1)));
  }
}

// ── Samenvatting: naam altijd achter de balk, nooit erop (issue #729) ──────────
// `getTaskBarRect` geeft bewust niets voor een samenvatting (niet sleepbaar). Die tekent met dezelfde
// `barGeometry` als een taakbalk; met dezelfde datums ligt hij dus recht onder 'kort', 2 en 3 rijen lager.
ok('opzet: geen sleeprechthoek voor een samenvatting', renderer.getTaskBarRect('sum-kort') === null);
const rijOnder = (r: { left: number; right: number; top: number; bottom: number }, n: number) =>
  ({ ...r, top: r.top + n * ROWH, bottom: r.bottom + n * ROWH });
if (rectKort && rectLang) {
  ok(`opzet: rijhoogte ${ROWH} px (${rectLang.top - rectKort.top})`, rectLang.top - rectKort.top === ROWH);
  const rectSumKort = rijOnder(rectKort, 2);
  const rectSumLang = rijOnder(rectKort, 3);
  const teksten = (r: { top: number; bottom: number }) => texts.filter(rijY(r));
  const fmt = (r: { top: number; bottom: number }) => JSON.stringify(teksten(r).map(t => [t.text.slice(0, 12), t.x]));
  // Zelfde datums als de gewone taak 'kort', waar de korte naam wél in de balk staat.
  ok('opzet: de korte naam zou in de samenvattingsbalk passen', KORT.length * CHAR_W <= (rectSumKort.right - rectSumKort.left) - 10);

  const kortTeksten = teksten(rectSumKort);
  ok(`samenvatting kort: precies één naam getekend (${fmt(rectSumKort)})`, kortTeksten.length === 1);
  ok(
    `samenvatting kort: naam rechts achter de balk, volledig (${fmt(rectSumKort)})`,
    kortTeksten.some(t => t.text === KORT && Math.abs(t.x - (rectSumKort.right + OUTSIDE_GAP)) < 0.001),
  );
  ok('samenvatting kort: geen naam op de balk', !kortTeksten.some(t => t.x < rectSumKort.right));

  const langTeksten = teksten(rectSumLang);
  ok(`samenvatting lang: precies één naam getekend (${fmt(rectSumLang)})`, langTeksten.length === 1);
  const sumLabel = langTeksten.find(t => Math.abs(t.x - (rectSumLang.right + OUTSIDE_GAP)) < 0.001);
  ok(`samenvatting lang: naam rechts achter de balk (${fmt(rectSumLang)})`, sumLabel !== undefined && LANG.startsWith(sumLabel.text.slice(0, -1)));
  ok('samenvatting lang: ellips pas na de maximale labelbreedte', sumLabel !== undefined && sumLabel.text.endsWith('…') && sumLabel.text.length * CHAR_W <= OUTSIDE_MAX);
  ok('samenvatting lang: geen naam op de balk', !langTeksten.some(t => t.x < rectSumLang.right));
}

// ── Hammock: naam altijd achter de dunne balk, ook bij een smalle balk en bij de canvasrand ──
// Een hammock tekende zijn naam vroeger OP de dunne balk en alleen bij een balk breder dan 40 px.
// Nu staat hij rechts achter de balk (`drawOutsideBarName`). Is daar te weinig ruimte, dan schuift de
// naam tegen de rechterrand van het canvas, over het eind van de balk; hij verdwijnt niet en springt
// niet naar links. Ook klik, dubbelklik en tooltip herkennen de naam (`getTaskNameAt`), zonder dat de
// sleep- of relatiegreep groter wordt.
{
  const tijd = (start: string, finish: string) => ({
    ...time,
    scheduleStart: start, scheduleFinish: finish,
    earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
  });
  const NAAM = 'Bouwkeet';
  const hamSmal: Task = { ...kort, id: 'ham-smal', name: NAAM, isHammock: true, time: tijd('2026-01-05', '2026-01-05') } as Task;
  const hamRand: Task = { ...kort, id: 'ham-rand', name: NAAM, isHammock: true, time: tijd('2026-01-26', '2026-01-28') } as Task;
  const hamVoorbij: Task = { ...kort, id: 'ham-voorbij', name: NAAM, isHammock: true, time: tijd('2026-01-20', '2026-03-02') } as Task;
  const sumRand: Task = { ...kort, id: 'sum-rand', name: NAAM, isSummary: true, time: tijd('2026-01-26', '2026-01-28') } as Task;
  const smalRows: ViewRow[] = [hamSmal, hamRand, hamVoorbij, sumRand]
    .map(t => ({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: false }));
  const SMAL_W = 600;
  const { ctx: ctx2, texts: texts2 } = makeCtx();
  const r2 = new GanttRenderer(ctx2, {
    rows: smalRows,
    sequences: [],
    calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: FIXED_START },
    selectedTaskIds: [],
    showStatusDateLine: false,
    showProgressLine: false,
    canvasWidth: SMAL_W,
    canvasHeight: H,
    rowHeight: ROWH,
    headerHeight: HDRH,
  });
  r2.render();
  const rSmal = r2.getTaskBarRect('ham-smal');
  const rRand = r2.getTaskBarRect('ham-rand');
  const rVoorbij = r2.getTaskBarRect('ham-voorbij');
  ok('hammock: alle drie de balken hebben een geometrie', rSmal !== null && rRand !== null && rVoorbij !== null);
  if (rSmal && rRand && rVoorbij) {
    const rSum = rijOnder(rRand, 2);
    const naamW = NAAM.length * CHAR_W;
    const opRij = (r: { top: number; bottom: number }) => texts2.filter(rijY(r));
    const fmt2 = (r: { top: number; bottom: number }) => JSON.stringify(opRij(r).map(t => [t.text, t.x]));
    const midY = (r: { top: number; bottom: number }) => (r.top + r.bottom) / 2;

    // Smal: vroeger geen naam (balk ≤ 40 px), nu volledig achter de balk.
    ok(`hammock smal: opzet balk ≤ 40 px (${rSmal.right - rSmal.left})`, rSmal.right - rSmal.left <= 40);
    const smalTeksten = opRij(rSmal);
    ok(`hammock smal: precies één naam, rechts achter de balk (${fmt2(rSmal)})`,
      smalTeksten.length === 1 && smalTeksten[0].text === NAAM && Math.abs(smalTeksten[0].x - (rSmal.right + OUTSIDE_GAP)) < 0.001);

    // Bij de rand: rechts te weinig ruimte, dus tegen de canvasrand, volledig, niet links van de balk.
    const randGevallen: [string, { left: number; right: number; top: number; bottom: number }][] = [
      ['hammock bij de rand', rRand], ['hammock voorbij de rand', rVoorbij], ['samenvatting bij de rand', { ...rSum, right: rRand.right }],
    ];
    ok(`opzet: rechts van de randbalk is te weinig ruimte (${rRand.right + OUTSIDE_GAP + naamW} > ${SMAL_W - 4})`,
      rRand.right + OUTSIDE_GAP + naamW > SMAL_W - 4 && rRand.right < SMAL_W);
    ok(`opzet: de lange hammock loopt voorbij de canvasrand (${rVoorbij.right})`, rVoorbij.right > SMAL_W);
    for (const [label, r] of randGevallen) {
      const t = opRij(r);
      ok(`${label}: precies één naam, volledig (${fmt2(r)})`, t.length === 1 && t[0].text === NAAM);
      ok(`${label}: naam eindigt tegen de canvasrand (${fmt2(r)})`, t.length === 1 && Math.abs(t[0].x + naamW - (SMAL_W - 4)) < 0.001);
      ok(`${label}: naam begint niet links van de balk (${fmt2(r)})`, t.length === 1 && (r === rVoorbij || t[0].x + naamW > r.right));
    }

    // Interactie: de naam hoort bij de taak voor selectie, openen en tooltip …
    const naamX = rSmal.right + OUTSIDE_GAP + naamW / 2;
    ok('naam-hittest: midden van de naam geeft de hammock', r2.getTaskNameAt(naamX, midY(rSmal))?.id === 'ham-smal');
    ok('naam-hittest: voorbij de naam geeft niets', r2.getTaskNameAt(rSmal.right + OUTSIDE_GAP + naamW + 5, midY(rSmal)) === null);
    ok('naam-hittest: de naam op de randbalk telt ook', r2.getTaskNameAt(SMAL_W - 10, midY(rRand))?.id === 'ham-rand');
    ok('naam-hittest: de naam van de samenvatting telt ook', r2.getTaskNameAt(SMAL_W - 10, midY(rSum))?.id === 'sum-rand');
    // … maar wordt geen sleep- of relatiegreep.
    ok('naam is geen sleepgreep', r2.getTaskBarBounds(naamX, midY(rSmal)) === null);
    ok('naam is geen relatiegreep', r2.getRelationSourceAt(naamX, midY(rSmal)) === null);
    // Alleen het tekstvlak telt (body 11 px: een halve lettergrootte + 1 px boven en onder het
    // midden), niet de hele rij. Boven en onder de naam is de randbalk weer gewoon een greep.
    for (const dy of [-10, 10]) {
      const kant = dy < 0 ? 'boven' : 'onder';
      ok(`naam-hittest: ${kant} de tekst geeft niets`, r2.getTaskNameAt(SMAL_W - 10, midY(rRand) + dy) === null);
      ok(`naam-hittest: ${kant} de tekst is de randbalk een sleepgreep`, r2.getTaskBarBounds(rRand.right - 3, midY(rRand) + dy)?.task.id === 'ham-rand');
      ok(`naam-hittest: ${kant} de tekst is de randbalk een relatiegreep`, r2.getRelationSourceAt(rRand.right - 3, midY(rRand) + dy)?.id === 'ham-rand');
    }
    ok('naam-hittest: net binnen het tekstvlak telt wel', r2.getTaskNameAt(SMAL_W - 10, midY(rRand) + 6)?.id === 'ham-rand');
  }
  // ── Groeperen op resource: dezelfde taak staat in twee rijen, elk met een eigen naam. Beide
  // namen moeten werken, niet alleen de laatst getekende (review #842, ronde 4). Twee rijen per
  // taak: een randbalk (naam over de balk) en een smalle balk (naam naast de balk).
  {
    const dubbelRows: ViewRow[] = [
      { kind: 'task', rowKey: 'res-a/ham-rand', task: hamRand, depth: 1, dimmed: false },
      { kind: 'task', rowKey: 'res-a/ham-smal', task: hamSmal, depth: 1, dimmed: false },
      { kind: 'task', rowKey: 'res-b/ham-rand', task: hamRand, depth: 1, dimmed: false },
      { kind: 'task', rowKey: 'res-b/ham-smal', task: hamSmal, depth: 1, dimmed: false },
    ];
    const { ctx: ctx3 } = makeCtx();
    const r3 = new GanttRenderer(ctx3, {
      rows: dubbelRows,
      sequences: [],
      calendar: st.calendar,
      view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: FIXED_START },
      selectedTaskIds: [],
      showStatusDateLine: false,
      showProgressLine: false,
      canvasWidth: SMAL_W,
      canvasHeight: H,
      rowHeight: ROWH,
      headerHeight: HDRH,
    });
    r3.render();
    // `getTaskBarRect` geeft het EERSTE voorkomen (rij 0 en 1); het tweede ligt twee rijen lager.
    const randA = r3.getTaskBarRect('ham-rand');
    const smalA = r3.getTaskBarRect('ham-smal');
    ok('resourcegroepen: opzet, beide balken hebben een geometrie', randA !== null && smalA !== null);
    if (randA && smalA) {
      const mid = (r: { top: number; bottom: number }) => (r.top + r.bottom) / 2;
      const naamW3 = NAAM.length * CHAR_W;
      for (const [label, dy] of [['eerste groep', 0], ['tweede groep', 2 * ROWH]] as const) {
        ok(`resourcegroepen, ${label}: naam over de randbalk herkend`, r3.getTaskNameAt(SMAL_W - 10, mid(randA) + dy)?.id === 'ham-rand');
        ok(`resourcegroepen, ${label}: naam naast de smalle balk herkend`,
          r3.getTaskNameAt(smalA.right + OUTSIDE_GAP + naamW3 / 2, mid(smalA) + dy)?.id === 'ham-smal');
      }
    }
  }

  // ── Balk links buiten beeld, met spelingsband nog in beeld: de balk blijft in de tekenronde, maar
  // de naam gaat mee naar links. Hij blijft niet los aan de linkerrand staan (review #842, ronde 4).
  {
    const links: Task = {
      ...lang, id: 'links',
      time: { ...tijd('2025-12-29', '2025-12-31'), lateFinish: '2026-01-09', totalFloat: 5, isCritical: false },
    } as Task;
    const { ctx: ctx4, texts: texts4 } = makeCtx();
    const r4 = new GanttRenderer(ctx4, {
      rows: [{ kind: 'task', rowKey: links.id, task: links, depth: 0, dimmed: false }],
      sequences: [],
      calendar: st.calendar,
      view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: FIXED_START },
      selectedTaskIds: [],
      showStatusDateLine: false,
      showProgressLine: false,
      canvasWidth: SMAL_W,
      canvasHeight: H,
      rowHeight: ROWH,
      headerHeight: HDRH,
    });
    r4.render();
    const rLinks = r4.getTaskBarRect('links');
    ok(`links buiten beeld: opzet, de balk eindigt links van het beeld (${rLinks?.right})`, rLinks !== null && rLinks.right + OUTSIDE_GAP < 0);
    if (rLinks) {
      const t = texts4.filter(rijY(rLinks));
      ok(`links buiten beeld: de naam staat op zijn eigen plek achter de balk (${JSON.stringify(t.map(x => [x.text.slice(0, 8), x.x]))})`,
        t.length === 1 && Math.abs(t[0].x - (rLinks.right + OUTSIDE_GAP)) < 0.001);
      ok('links buiten beeld: geen naam los aan de linkerrand', !t.some(x => x.x >= 0 && x.x <= 4.001));
    }
  }

  // De eerste scène tekende geen naam ver weg: daar herkent de hittest ook niets.
  ok('naam-hittest: lege rij geeft niets', renderer.getTaskNameAt(5, HDRH + ROWH * 10) === null);
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
