/**
 * Het "vandaag"-label in de printkopstrook — regressiebatterij.
 *
 * ACHTERGROND (waarom deze check bestaat). Het label werd getekend op `chartTop - m.s(2)`, vóór
 * `drawTimelineHeader`. Dat leverde twee tegengestelde defecten op, precies omdat de twee Draw2D-
 * backends een verschillende z-orde hebben:
 *
 *   - RASTER (canvas-preview): `drawTimelineHeader` schildert als eerste zijn hele kopstrook-band
 *     over. Het label lag binnen die band en werd dus onzichtbaar weggepoetst. Met het Engelse
 *     'Today' viel dat niemand op — dat woord heeft geen enkele staartletter, dus er bleef ook geen
 *     stukje over dat onder de band uitstak.
 *   - VECTOR (PDF-export, het echte exportpad): daar gaan alle vormen in één Form-XObject en wordt
 *     ALLE tekst daarná geëmit (`PdfVectorDraw2D.operators` vs `.texts`). Het label overleefde er
 *     dus wél — en landde pal op het dagcijfer van vandaag. Empirisch: "Vand29ag", "To29y".
 *
 * De fix zet het label in `drawTimelineHeader` zelf, op exact de baseline van de dagcijfers, en laat
 * de dagcijfers die eronder vallen weg. Dat is een GEOMETRISCHE oplossing, en dus de enige die in
 * beide backends identiek landt: wegdekken met een vlakje kan in de PDF principieel niet, want een
 * rechthoek belandt daar altijd onder de tekst.
 *
 * Deze check draait `renderReport` met een opnemende Draw2D en bewaakt de drie eigenschappen die
 * samen de bug uitsluiten, over een raster van talen × papierformaten × lettergroottes:
 *   1. het label wordt getekend NA de kopstrook-overschildering (anders: onzichtbaar in raster);
 *   2. het label overlapt geen enkel dagcijfer (anders: botsing in de PDF);
 *   3. het label blijft binnen het chartgebied (niet over de bevroren tabelkolom, niet van de pagina).
 */
import { renderReport, PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

import nl from '@/i18n/locales/nl/report.json';
import en from '@/i18n/locales/en/report.json';
import fr from '@/i18n/locales/fr/report.json';
import ar from '@/i18n/locales/ar/report.json';
import ja from '@/i18n/locales/ja/report.json';
import pl from '@/i18n/locales/pl/report.json';

const LOCALES: Record<string, Record<string, any>> = { nl, en, fr, ar, ja, pl };

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };

// ── Opnemende Draw2D ────────────────────────────────────────────────────────────────────────────
interface TextEv { text: string; x: number; y: number; align: TextAlign; baseline: TextBaseline; font: string; w: number; seq: number; }
interface RectEv { x: number; y: number; w: number; h: number; seq: number; }

/** Benadert de tekstbreedte deterministisch (geen canvas in Node). Beide backends meten de echte
 *  glyph-advances; voor een overlaptest is een monotone benadering voldoende én stabieler. */
function fontSizeOf(font: string): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m ? parseFloat(m[1]) : 10;
}

function record(tasks: Task[], calendar: WorkCalendar, options: PrintOptions) {
  const texts: TextEv[] = [];
  const rects: RectEv[] = [];
  let seq = 0;
  const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const measure = (t: string) => t.length * fontSizeOf(st.font) * 0.6;
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, seq: seq++ }); },
    strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, roundRect() {},
    fillText(text, x, y) { texts.push({ text, x, y, align: st.textAlign, baseline: st.textBaseline, font: st.font, w: measure(text), seq: seq++ }); },
    measureText(t) { return { width: measure(t) }; },
  };
  const dims = renderReport(() => d2d, tasks, [], calendar, 'P', options);
  return { texts, rects, dims };
}

/** Horizontale [links, rechts] van een tekst-event, rekening houdend met de uitlijning. */
function span(e: TextEv): [number, number] {
  if (e.align === 'center') return [e.x - e.w / 2, e.x + e.w / 2];
  if (e.align === 'right') return [e.x - e.w, e.x];
  return [e.x, e.x + e.w];
}

// ── Fixture ─────────────────────────────────────────────────────────────────────────────────────
const calendar: WorkCalendar = {
  id: 'cal', name: 'std', description: '',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

const now = new Date();
const iso = (o: number) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + o * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const task = (id: string, from: number, to: number): Task => ({
  id, name: 'Taak ' + id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  childIds: [], predecessorIds: [], successorIds: [], resourceIds: [], progress: 0,
  time: {
    durationType: 'WORKTIME', scheduleDuration: to - from,
    scheduleStart: iso(from), scheduleFinish: iso(to),
    earlyStart: iso(from), earlyFinish: iso(to),
    lateStart: iso(from), lateFinish: iso(to),
    freeFloat: 0, totalFloat: 0, isCritical: true,
  },
} as unknown as Task);

function labelsOf(loc: string): NonNullable<PrintOptions['labels']> {
  const j = LOCALES[loc];
  return {
    noTasks: j.noTasks, printed: j.printed,
    legend: j.legend,
    tableHeaders: { rowNum: '#', ...j.tableHeaders },
    page: j.page, of: j.of, today: j.today, statusDate: j.statusDateLabel ?? 'Statusdatum',
  };
}

function optionsFor(loc: string, paper: 'A4' | 'A3' | 'A2' | 'A1', scale: number): PrintOptions {
  return {
    showCritical: true, showFloat: false, showDeps: false, showWeekends: true,
    showLegend: true, showTaskNames: true, showCompletion: false,
    autoFit: true, customZoom: 1, paperSize: paper, orientation: 'landscape',
    companyName: '', labels: labelsOf(loc), locale: loc, reportFontScale: scale,
  } as PrintOptions;
}

// ── 1. Het label overleeft de kopstrook-overschildering, botst niet, en blijft binnen beeld ─────
console.log('-- vandaag-label: zichtbaarheid, botsing en begrenzing --');

for (const loc of Object.keys(LOCALES)) {
  for (const paper of ['A4', 'A3', 'A2', 'A1'] as const) {
    for (const scale of [90, 100, 125]) {
      // Korte spanne ⇒ hoge zoom ⇒ de dagcijfers wórden getekend; dat is het botsingsgeval.
      const { texts, rects, dims } = record([task('t1', -3, 3)], calendar, optionsFor(loc, paper, scale));
      const tag = `${loc}/${paper}/${scale}%`;
      const expect = LOCALES[loc].today as string;

      const label = texts.find(t => t.text === expect);
      if (!label) { fail(`${tag}: vandaag-label "${expect}" wordt helemaal niet getekend`); continue; }

      const [l0, l1] = span(label);

      // (1) geen enkel gevuld vlak dat ná het label komt mag het label overdekken — anders poetst
      //     de raster-backend hem weg (de vector-backend niet, en dán lopen preview en export uit
      //     elkaar). Vlakken die het label horizontaal missen (zoals de overschildering van de
      //     bevroren tabelkolom) tellen niet mee: die raken hem simpelweg niet.
      const eraser = rects.find(r =>
        r.seq > label.seq
        && r.y < label.y && label.y < r.y + r.h
        && r.x < l1 && r.x + r.w > l0);
      if (eraser) {
        fail(`${tag}: label (seq ${label.seq}) wordt overschilderd door een vlak op seq ${eraser.seq} `
           + `(x ${eraser.x.toFixed(1)}..${(eraser.x + eraser.w).toFixed(1)}, y ${eraser.y.toFixed(1)}..${(eraser.y + eraser.h).toFixed(1)}) `
           + `en is in de raster-preview dus onzichtbaar`);
      }

      // (2) geen enkel dagcijfer op dezelfde baseline mag horizontaal overlappen.
      const dayNums = texts.filter(t => t !== label && /^\d{1,2}$/.test(t.text) && Math.abs(t.y - label.y) < 1);
      for (const dn of dayNums) {
        const [d0, d1] = span(dn);
        if (d1 > l0 && d0 < l1) {
          fail(`${tag}: dagcijfer "${dn.text}" [${d0.toFixed(1)},${d1.toFixed(1)}] overlapt het label [${l0.toFixed(1)},${l1.toFixed(1)}]`);
          break;
        }
      }

      // (3) binnen het chartgebied: niet over de bevroren tabelkolom, niet van de pagina af.
      if (l0 < dims.tableWidth - 0.5) fail(`${tag}: label steekt links van de tabelkolom uit (${l0.toFixed(1)} < ${dims.tableWidth.toFixed(1)})`);
      if (l1 > dims.width + 0.5) fail(`${tag}: label steekt rechts van de pagina uit (${l1.toFixed(1)} > ${dims.width.toFixed(1)})`);
    }
  }
}
console.log(`   ${Object.keys(LOCALES).length} talen × 4 papierformaten × 3 lettergroottes gecontroleerd`);

// ── 2. Klemmen aan de randen: vandaag ver links resp. ver rechts van het venster ────────────────
console.log('-- vandaag-label: klemmen aan de chartranden --');
for (const [naam, t] of [['verleden (vandaag rechts)', task('t1', -60, -1)], ['toekomst (vandaag links)', task('t1', 1, 60)]] as const) {
  const { texts, dims } = record([t], calendar, optionsFor('fr', 'A4', 100));
  const label = texts.find(e => e.text === LOCALES.fr.today);
  if (!label) { fail(`${naam}: label ontbreekt`); continue; }
  const [l0, l1] = span(label);
  if (l0 < dims.tableWidth - 0.5) fail(`${naam}: label steekt links van de tabelkolom uit (${l0.toFixed(1)} < ${dims.tableWidth.toFixed(1)})`);
  if (l1 > dims.width + 0.5) fail(`${naam}: label steekt rechts van de pagina uit (${l1.toFixed(1)} > ${dims.width.toFixed(1)})`);
}
console.log('   beide randgevallen binnen het chartgebied');

// ── 3. Geen vandaag-lijn in beeld ⇒ ook geen label ─────────────────────────────────────────────
console.log('-- vandaag-label: buiten het venster ⇒ niet tekenen --');
{
  // Project ver in het verleden: vandaag valt buiten de tijdas, dus er hoort geen label te staan.
  const { texts } = record([task('t1', -4000, -3900)], calendar, optionsFor('nl', 'A4', 100));
  if (texts.some(e => e.text === LOCALES.nl.today)) fail('label wordt getekend terwijl vandaag buiten het venster valt');
  else console.log('   correct weggelaten');
}

// ── 4. Het label loopt door de vertaallaag (geen hardgecodeerde string) ────────────────────────
console.log('-- vandaag-label: vertaald, niet hardgecodeerd --');
{
  const gezien = new Set<string>();
  for (const loc of Object.keys(LOCALES)) {
    const { texts } = record([task('t1', -3, 3)], calendar, optionsFor(loc, 'A4', 100));
    const expect = LOCALES[loc].today as string;
    if (!texts.some(e => e.text === expect)) fail(`${loc}: verwachtte "${expect}" in de getekende tekst`);
    gezien.add(expect);
    if (loc !== 'en' && texts.some(e => e.text === 'Today')) fail(`${loc}: hardgecodeerde Engelse tekst "Today" getekend`);
  }
  if (gezien.size < Object.keys(LOCALES).length) fail(`labels niet onderscheidend per taal: ${JSON.stringify([...gezien])}`);
  else console.log(`   ${gezien.size} talen, ${gezien.size} verschillende labels`);
}

if (failures > 0) {
  console.log(`\nXX vandaag-label: ${failures} probleem(en)`);
  process.exit(1);
}
console.log('\nOK  vandaag-label: alles groen');
