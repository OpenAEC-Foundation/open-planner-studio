import { renderReport, PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import { PRINT_PALETTE } from '@/engine/renderer/themePalette';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { applyCpmResult } from '@/engine/scheduler/applyCpmResult';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

import nl from '@/i18n/locales/nl/report.json';
import { legacyCpmOptions } from './legacySolveOptions';

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (msg: string) => console.log(`   ${msg}`);
const okSince = (mark: number, msg: string) => { if (failures === mark) ok(msg); };

const calendar: WorkCalendar = {
  id: 'cal', name: 'std', description: '',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

const iso = (o: number) => {
  const d = new Date(Date.UTC(2026, 5, 1) + o * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const mk = (id: string, name: string, startOff: number, dur: number): Task => ({
  id, name, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  childIds: [], predecessorIds: [], successorIds: [], resourceIds: [], progress: 0,
  time: {
    durationType: 'WORKTIME', scheduleDuration: dur,
    scheduleStart: iso(startOff), scheduleFinish: iso(startOff + dur),
    earlyStart: iso(startOff), earlyFinish: iso(startOff + dur),
    lateStart: iso(startOff), lateFinish: iso(startOff + dur),
    freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
} as unknown as Task);

const seqOf = (id: string, p: string, s: string, type: Sequence['type']): Sequence =>
  ({ id, predecessorId: p, successorId: s, type, lagDays: 0 });

function buildFixture() {
  const tasks: Task[] = [
    mk('t1', 'Voorbereiding', 0, 5),
    mk('t2', 'Fundering storten', 5, 10),
    mk('t3', 'Wanden metselen', 15, 8),
    mk('t4', 'Dak plaatsen', 23, 6),
    mk('t5', 'Bouwplaats inrichten', 0, 4),
    mk('t6', 'Nutsaansluitingen', 18, 3),
  ];
  const sequences: Sequence[] = [
    seqOf('s1', 't1', 't2', 'FINISH_START'),
    seqOf('s2', 't2', 't3', 'FINISH_START'),
    seqOf('s3', 't3', 't4', 'FINISH_START'),
    seqOf('s4', 't1', 't5', 'START_START'),
    seqOf('s5', 't5', 't4', 'FINISH_START'),
    seqOf('s6', 't3', 't6', 'FINISH_FINISH'),
    seqOf('s7', 't1', 't4', 'FINISH_START'),
  ];
  const cpm = new CPMSolver(tasks, sequences, calendar, [], legacyCpmOptions()).solve();
  if (cpm.error) throw new Error('fixture: CPM-fout ' + cpm.error);
  applyCpmResult(tasks, cpm, { projectCalendar: calendar, calendars: [] });
  return { tasks, sequences, cpm };
}

interface StrokeEv { pts: [number, number][]; color: string; dash: number[]; lw: number; seq: number }
interface RectEv { x: number; y: number; w: number; h: number; seq: number }
interface TextEv { text: string; seq: number }

function record(options: PrintOptions) {
  const { tasks, sequences, cpm } = buildFixture();
  const strokes: StrokeEv[] = [];
  const bars: RectEv[] = [];
  const texts: TextEv[] = [];
  let seq = 0;
  let cur: [number, number][] = [];
  const st = {
    font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0,
    textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline, dash: [] as number[],
  };
  const measure = (t: string) => t.length * 4.5;
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash(s) { st.dash = s.slice(); },
    fillRect() {}, strokeRect() {},
    beginPath() { cur = []; },
    moveTo(x, y) { cur.push([x, y]); },
    lineTo(x, y) { cur.push([x, y]); },
    closePath() {},
    fill() {},
    stroke() { strokes.push({ pts: cur.slice(), color: st.strokeStyle, dash: st.dash.slice(), lw: st.lineWidth, seq: seq++ }); },
    roundRect(x, y, w, h) { bars.push({ x, y, w, h, seq: seq++ }); cur = []; },
    fillText(text) { texts.push({ text, seq: seq++ }); },
    measureText(t) { return { width: measure(t) }; },
  };
  const dims = renderReport(() => d2d, tasks, sequences, calendar, 'P', options);
  const deps = strokes.filter(s => s.pts.length >= 3);
  return { strokes, deps, bars, texts, dims, cpm, tasks, sequences };
}

function labelsOf(over: Partial<Record<string, string>> = {}): NonNullable<PrintOptions['labels']> {
  const j = nl as any;
  return {
    noTasks: j.noTasks, printed: j.printed,
    legend: { ...j.legend, ...over },
    tableHeaders: j.tableHeaders,
    today: j.today, statusDate: j.statusDateLabel ?? 'Statusdatum',
    projectStart: j.projectStart, projectEnd: j.projectEnd, projectDuration: j.projectDuration, daySuffix: 'd',
  };
}

function optionsFor(over: Partial<PrintOptions> = {}): PrintOptions {
  return {
    showCritical: true, showFloat: false, showDeps: true, showWeekends: true,
    showLegend: true, showTaskNames: true, showCompletion: false,
    autoFit: true, customZoom: 22, paperSize: 'A4', orientation: 'landscape',
    companyName: '', labels: labelsOf(), locale: 'nl', reportFontScale: 100,
    ...over,
  } as PrintOptions;
}

console.log('-- relatielijnen: kleur en lijnstijl volgen bepalend/kritiek --');
{
  const base = buildFixture();
  const driving = base.cpm.drivingSequenceIds;
  for (const [id, want] of [['s1', true], ['s3', true], ['s5', false], ['s7', false]] as const) {
    if (driving.includes(id) !== want) fail(`fixture-aanname: ${id} driving=${driving.includes(id)}, verwacht ${want}`);
  }
  const crit = new Set(base.tasks.filter(t => t.time.isCritical).map(t => t.id));
  for (const id of ['t1', 't2', 't3', 't4']) if (!crit.has(id)) fail(`fixture-aanname: ${id} hoort kritiek te zijn`);

  const { deps, sequences } = record(optionsFor({ drivingSequenceIds: driving } as any));
  if (deps.length !== sequences.length) {
    fail(`aantal relatielijnen ${deps.length}, verwacht ${sequences.length}`);
  } else {
    const verwacht: Record<string, { color: string; gestreept: boolean }> = {
      s1: { color: PRINT_PALETTE.critical, gestreept: false },
      s2: { color: PRINT_PALETTE.critical, gestreept: false },
      s3: { color: PRINT_PALETTE.critical, gestreept: false },
      s4: { color: PRINT_PALETTE.dependency, gestreept: false },
      s5: { color: PRINT_PALETTE.dependency, gestreept: true },
      s6: { color: PRINT_PALETTE.dependency, gestreept: false },
      s7: { color: PRINT_PALETTE.dependency, gestreept: true },
    };
    const mark = failures;
    for (let i = 0; i < sequences.length; i++) {
      const id = sequences[i].id;
      const w = verwacht[id];
      const got = deps[i];
      if (got.color !== w.color) fail(`${id}: kleur ${got.color}, verwacht ${w.color}`);
      if ((got.dash.length > 0) !== w.gestreept) {
        fail(`${id}: dash=[${got.dash.join(',')}] ⇒ gestreept=${got.dash.length > 0}, verwacht ${w.gestreept}`);
      }
    }
    okSince(mark, '7 relaties: 3 rood-doorgetrokken, 2 grijs-gestreept, 2 grijs-doorgetrokken');
    okSince(mark, 's7 verbindt twee KRITIEKE taken maar is niet-bepalend ⇒ grijs gestreept (niet rood)');
  }
}

console.log('-- relatielijnen: volgen de "kritiek pad tonen"-schakelaar --');
{
  const { cpm } = buildFixture();
  const { deps } = record(optionsFor({ showCritical: false, drivingSequenceIds: cpm.drivingSequenceIds } as any));
  const rood = deps.filter(d => d.color === PRINT_PALETTE.critical);
  if (rood.length > 0) fail(`showCritical=false levert nog ${rood.length} rode relatielijn(en)`);
  else ok('showCritical=false ⇒ alle relatielijnen neutraal (geen rood tussen blauwe balken)');
  if (!deps.some(d => d.dash.length > 0)) fail('showCritical=false wist ook de streepjes — die horen te blijven');
}

console.log('-- relatielijnen: terugval zonder drivingSequenceIds --');
{
  const { deps, texts } = record(optionsFor());
  const afwijkend = deps.filter(d => d.color !== PRINT_PALETTE.dependency || d.dash.length > 0);
  if (afwijkend.length > 0) fail(`zonder drivingSequenceIds zijn ${afwijkend.length} lijn(en) niet neutraal-doorgetrokken`);
  else ok('geen bindend-informatie ⇒ alles grijs doorgetrokken (gedrag van vóór de fix)');
  if (texts.some(t => t.text === (nl as any).legend.relationStyle)) {
    fail('de lijnstijl-legenda staat er terwijl er geen bindend-informatie is (belooft iets wat er niet is)');
  }
}

console.log('-- relatielijnen: ankerpunt en uitloop per relatietype --');
{
  const { cpm } = buildFixture();
  const { deps, bars, sequences } = record(optionsFor({ drivingSequenceIds: cpm.drivingSequenceIds } as any));
  const barT1 = bars[0];
  const idx = (id: string) => sequences.findIndex(s => s.id === id);

  const ss = deps[idx('s4')];
  const fs = deps[idx('s7')];
  if (!ss || !fs || !barT1) {
    fail('geometriecheck: relatielijnen of balk niet gevonden');
  } else {
    if (!(Math.abs(ss.pts[0][0] - barT1.x) <= 0.01)) {
      fail(`SS vertrekt op x=${ss.pts[0][0].toFixed(2)}, verwacht de LINKERrand van de voorgangerbalk (${barT1.x.toFixed(2)})`);
    } else ok('SS ankert op de linkerrand (start) van de voorgangerbalk');
    if (!(Math.abs(fs.pts[0][0] - (barT1.x + barT1.w)) <= 0.01)) {
      fail(`FS vertrekt op x=${fs.pts[0][0].toFixed(2)}, verwacht de RECHTERrand van de voorgangerbalk (${(barT1.x + barT1.w).toFixed(2)})`);
    } else ok('FS ankert op de rechterrand (finish) van de voorgangerbalk');
    if (!(ss.pts[1][0] < ss.pts[0][0])) fail('SS: de stub loopt niet naar links weg van de balk (loopt de balk ín)');
    if (!(fs.pts[1][0] > fs.pts[0][0])) fail('FS: de stub loopt niet naar rechts weg van de balk');
    const ff = deps[idx('s6')];
    if (!ff || ff.pts.length < 4) {
      fail('FF-geometriecheck (#59): relatielijn s6 niet gevonden of te kort');
    } else {
      const m = ff.pts.length;
      const [lx0, lx1] = [ff.pts[m - 2][0], ff.pts[m - 1][0]];
      if (!(lx1 < lx0)) fail(`FF (#59): laatste segment loopt naar rechts (x ${lx0.toFixed(1)}→${lx1.toFixed(1)}), verwacht naar links — landt op opvolger-START i.p.v. FINISH`);
      else ok('FF (#59): laatste segment loopt naar links ⇒ pijl landt op de opvolger-FINISH (rechterrand)');
    }
  }
}

console.log('-- relatielijnen: streepjespatroon schaalt met de rapport-lettergrootte --');
{
  const { cpm } = buildFixture();
  const mark = failures;
  for (const pct of [90, 100, 110, 125]) {
    const k = pct / 100;
    const { deps } = record(optionsFor({ reportFontScale: pct, drivingSequenceIds: cpm.drivingSequenceIds } as any));
    const gestreept = deps.find(d => d.dash.length > 0);
    if (!gestreept) { fail(`${pct}%: geen enkele gestreepte relatielijn`); continue; }
    const [a, b] = gestreept.dash;
    if (!(Math.abs(a - 4 * k) <= 1e-9) || !(Math.abs(b - 3 * k) <= 1e-9)) {
      fail(`${pct}%: dash=[${a},${b}], verwacht [${4 * k},${3 * k}]`);
    }
  }
  okSince(mark, '90/100/110/125%: dash = [4k, 3k] — dezelfde verhouding tot de letter op elke schaal');
}

console.log('-- relatielijnen: dash-patroon lekt niet naar kopstrook/tabel --');
{
  const { cpm } = buildFixture();
  const { strokes, deps, dims } = record(optionsFor({ drivingSequenceIds: cpm.drivingSequenceIds } as any));
  const laatste = deps[deps.length - 1];
  if (!laatste || laatste.dash.length === 0) {
    fail('opzet: de laatste relatielijn hoort gestreept te zijn — zonder dat toetst deze sectie niets');
  } else {
    const footerTop = dims.height - 50 * 1;
    const lekken = strokes.filter(s =>
      s.seq > laatste.seq && s.dash.length > 0 && s.pts.every(p => p[1] < footerTop));
    if (lekken.length > 0) {
      fail(`${lekken.length} lijn(en) ná de relaties zijn gestreept (dash-patroon niet gereset) — bv. seq ${lekken[0].seq}`);
    } else ok('kopstrook- en tabellijnen ná de relaties zijn ongestreept');
  }
}

console.log('-- legenda: één regel verklaart doorgetrokken vs. gestreept --');
{
  const { cpm } = buildFixture();
  const SENT = 'ZZ-LIJNSTIJL-SENTINEL';
  const withDeps = record(optionsFor({
    drivingSequenceIds: cpm.drivingSequenceIds,
    labels: labelsOf({ relationStyle: SENT }),
    paperSize: 'A1',
  } as any));
  if (!withDeps.texts.some(t => t.text === SENT)) {
    fail('de legenda-regel gebruikt de meegegeven vertaling niet (hardgecodeerde tekst?)');
  } else ok('de legenda-regel komt uit options.labels.legend.relationStyle');

  const zonderDeps = record(optionsFor({
    showDeps: false,
    drivingSequenceIds: cpm.drivingSequenceIds,
    labels: labelsOf({ relationStyle: SENT }),
    paperSize: 'A1',
  } as any));
  if (zonderDeps.texts.some(t => t.text === SENT)) {
    fail('de legenda-regel staat er terwijl relaties helemaal niet getekend worden');
  } else ok('relaties uit ⇒ geen lijnstijl-regel in de legenda');
}

console.log('-- legenda: sleutel aanwezig in de bronvertaling --');
{
  const val = (nl as any).legend?.relationStyle;
  if (typeof val !== 'string' || val.length === 0) fail('nl/report.json mist legend.relationStyle');
  else ok(`nl: "${val}"`);
}

console.log('');
if (failures > 0) {
  console.log(`RELATIELIJN-STIJL: ${failures} afwijking(en)`);
  process.exit(1);
}
console.log('RELATIELIJN-STIJL: alles groen');
