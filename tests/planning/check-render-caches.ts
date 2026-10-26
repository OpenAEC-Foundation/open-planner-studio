// De renderer-caches (rij-index, pijllijst, resource-accentrijen) zijn pure prestatie: een render op
// de bevroren store-lijsten (gecachet pad) moet EXACT dezelfde tekenaanroepen doen als op verse,
// niet-bevroren kopieën (ongecachet pad) — ook na mutaties die rijen of relaties veranderen, zodat
// een verouderde cache hier opvalt.
//
// Draait via run.sh. Exit 0 = alles groen.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });
// De vandaaglijn staat op de huidige tijd binnen de dag (`localNowOnDayAxis`) en schuift dus tussen twee
// renders een fractie op; op de derde decimaal verschilde dat soms (CI faalde er zo op). De caches hebben
// niets met de klok te maken: bevries hem voor deze check.
const RealDate = Date;
const FROZEN_NOW = Date.UTC(2026, 9, 26, 12);
g.Date = class extends RealDate {
  constructor(...args: unknown[]) { super(...((args.length ? args : [FROZEN_NOW]) as [number])); }
  static now() { return FROZEN_NOW; }
};

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Sequence, SequenceType } from '@/types/sequence';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const ok = (label: string, cond: boolean, detail = '') => { checks++; if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`); };

function recordingCtx(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const target: Record<string, unknown> = { measureText: (t: string) => ({ width: String(t).length * 6 }), getLineDash: () => [] };
  const ctx = new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      return (...args: unknown[]) => {
        log.push(JSON.stringify([prop, ...args]));
        if (prop === 'createLinearGradient') return { addColorStop: () => {} };
        return undefined;
      };
    },
    set(obj, prop: string, value) { log.push(`${prop}=${String(value)}`); obj[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

function render(fresh: boolean): string[] {
  const { ctx, log } = recordingCtx();
  const st = S();
  const copy = <T,>(a: T[]) => (fresh ? [...a] : a);
  new GanttRenderer(ctx, {
    rows: copy(st.viewRows), sequences: copy(st.sequences), calendar: st.calendar,
    view: { ...st.view, zoom: 18, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [], canvasWidth: 1400, canvasHeight: 700, rowHeight: 24, headerHeight: 50,
    palette: readGanttPalette(), resources: copy(st.resources), assignments: copy(st.assignments), showResourceAccent: true,
  }).render();
  return log;
}

function compare(label: string): void {
  const cached = render(false);
  const again = render(false); // tweede keer: nu echt uit de cache
  const fresh = render(true);
  ok(`${label}: gecachet = vers`, JSON.stringify(again) === JSON.stringify(fresh) && JSON.stringify(cached) === JSON.stringify(fresh),
    `${again.length} vs ${fresh.length} aanroepen`);
  ok(`${label}: de lijsten uit de store zijn bevroren (anders test dit het cachepad niet)`, Object.isFrozen(S().viewRows) && Object.isFrozen(S().sequences));
}

S().newProject();
const ids: string[] = [];
const phase = S().addTask({ name: 'Fase' });
for (let i = 0; i < 12; i++) ids.push(S().addTask({ name: `T${i}`, parentId: i < 6 ? phase : null }));
for (let i = 0; i + 1 < ids.length; i++) S().addSequence({ predecessorId: ids[i], successorId: ids[i + 1], type: 'FINISH_START', lagDays: i % 3 });
const r1 = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
const r2 = S().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
S().assignResource(ids[1], r1, 1);
S().assignResource(ids[1], r2, 0.5);
S().assignResource(ids[7], r2, 1);
S().runCPM();
compare('begin');
S().toggleCollapse(phase);
compare('na inklappen');
S().addSequence({ predecessorId: ids[0], successorId: ids[11], type: 'START_START', lagDays: 0 });
compare('na een extra relatie');
S().assignResource(ids[3], r1, 2);
compare('na een extra toewijzing');
S().deleteTask(ids[5]);
S().runCPM();
compare('na verwijderen');

// De volledige rijscan is de referentie van vóór de optimalisatie. Alleen het kandidaatbereik van
// de drie tekenlagen wordt verruimd; de bestaande pijlrouting/obstakelindex blijft ongewijzigd.
// Zo vergelijkt deze check de volledige tekenuitvoer, inclusief subpixelcoördinaten en volgorde.
function rendererFor(opts: GanttRenderOptions, fullScan = false, countWork = false) {
  const { ctx, log } = recordingCtx();
  const renderer = new GanttRenderer(ctx, opts);
  if (fullScan) Object.assign(renderer, {
    visibleRowRange: (count = opts.rows.length) => ({ first: 0, last: count - 1 }),
  });
  let rowVisits = 0;
  if (countWork) {
    const original = renderer.rowToY.bind(renderer);
    renderer.rowToY = (index: number) => { rowVisits++; return original(index); };
  }
  renderer.render();
  return { renderer, log, rowVisits };
}

function scene(count: number, rowHeight = 28, scrollY = 0, compressed = false, hours = false): GanttRenderOptions {
  const template = S().tasks[0];
  const rows: ViewRow[] = Array.from({ length: count }, (_, i) => {
    if (count > 1 && i % 13 === 0) return {
      kind: 'group', rowKey: `g${i}`, key: `g${i}`, label: `Band ${i}`, count: 12,
      depth: 0, levelIndex: 0, collapsed: false,
    };
    const task = {
      ...template, id: `t${i}`, name: `Taak ${i}`, parentId: null, childIds: [],
      isMilestone: i % 11 === 0, isSummary: i % 17 === 0,
      splitGaps: i % 7 === 0 ? [{ afterMinutes: 480, gapMinutes: 480, source: 'user' as const }] : undefined,
      time: {
        ...template.time, scheduleDuration: i % 11 === 0 ? 0 : 5,
        durationUnit: hours ? 'hours' as const : 'days' as const,
        scheduleStart: hours ? '2026-10-19T08:00' : '2026-10-19',
        scheduleFinish: hours ? '2026-10-23T16:00' : '2026-10-23',
        earlyStart: undefined, earlyFinish: undefined, lateStart: undefined, lateFinish: undefined,
        completion: (i % 5) / 4, totalFloat: 2,
      },
    };
    return { kind: 'task', rowKey: task.id, task, depth: 0, dimmed: i % 3 === 0 };
  });
  // Alle vier relatietypen, ook routes die het venster doorkruisen met beide eindpunten buiten beeld.
  const types: SequenceType[] = ['FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'];
  const sequences: Sequence[] = count > 10 ? types.map((type, i) => ({
    id: `s${i}`, predecessorId: `t${1 + i}`, successorId: `t${count - 2 - i}`, type, lagDays: 0,
  })) : [];
  const calendar = {
    ...S().calendar, id: 'render-scale-calendar', holidays: [],
    workTime: hours ? { byWeekday: {
      1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
      4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
    } } : undefined,
  };
  return {
    rows: Object.freeze(rows) as ViewRow[], sequences: Object.freeze(sequences) as Sequence[], calendar,
    view: { ...S().view, viewStartDate: '2026-10-12', zoom: hours ? 100 : 20, scrollX: hours ? 500 : 0, scrollY },
    selectedTaskIds: rows.flatMap(r => r.kind === 'task' && Number(r.task.id.slice(1)) % 7 === 0 ? [r.task.id] : []),
    canvasWidth: 900, canvasHeight: 355.5, rowHeight, headerHeight: 50,
    palette: readGanttPalette(), statusDate: '2026-10-21', showProgressLine: true,
    barSplitMode: 'selection', compressNonWorkdays: compressed, drivingSequenceIds: ['s0', 's2'],
  };
}

function hitSnapshot(renderer: GanttRenderer, opts: GanttRenderOptions): string {
  const hits: unknown[] = [];
  // Rand, midden en vlak naast elk zichtbaar balkstuk/gat: dezelfde hit-test als een muisklik.
  const first = Math.max(0, Math.floor(opts.view.scrollY / opts.rowHeight) - 1);
  const last = Math.min(opts.rows.length - 1, first + Math.ceil(opts.canvasHeight / opts.rowHeight) + 2);
  for (let i = first; i <= last; i++) {
    const row = opts.rows[i];
    const y = renderer.rowToY(i) + opts.rowHeight / 2;
    hits.push([renderer.getRowAtY(y)?.rowKey, renderer.getTaskAtY(y)?.id]);
    if (row.kind !== 'task') continue;
    const rect = renderer.getTaskBarRect(row.task.id);
    if (!rect) continue;
    for (const x of [rect.left - 1, rect.left, rect.left + 1, (rect.left + rect.right) / 2, rect.right - 1, rect.right, rect.right + 1]) {
      const hit = renderer.getTaskBarBounds(x, y);
      const gap = renderer.getSplitGapAt(x, y);
      hits.push([x, y, hit && [hit.task.id, hit.edge, hit.segmentIndex, hit.segmentCount], gap && [gap.task.id, gap.gapIndex, gap.segmentCount]]);
    }
  }
  return JSON.stringify(hits);
}

for (const rowHeight of [21, 28, 35.5]) {
  for (const scrollY of [0, rowHeight, rowHeight - 1e-9, rowHeight + 1e-9, 47 * rowHeight + 0.25, 120 * rowHeight, 130 * rowHeight]) {
    for (const compressed of [false, true]) {
      const opts = scene(120, rowHeight, scrollY, compressed, compressed);
      const actual = rendererFor(opts);
      const reference = rendererFor(opts, true);
      const label = `rijbereik h=${rowHeight} y=${scrollY} werkdagen=${compressed}`;
      ok(`${label}: exacte tekenaanroepen`, JSON.stringify(actual.log) === JSON.stringify(reference.log));
      ok(`${label}: klik- en splitsgrenzen`, hitSnapshot(actual.renderer, opts) === hitSnapshot(reference.renderer, opts));
    }
  }
}
for (const count of [0, 1]) {
  const opts = scene(count);
  ok(`rijbereik ${count} rijen: exacte tekenaanroepen`,
    JSON.stringify(rendererFor(opts).log) === JSON.stringify(rendererFor(opts, true).log));
}

// Deterministisch werkbudget, geen tijdsdrempel: buitenbeeldrijen mogen niet alsnog per frame
// bezocht worden. De losse CI-meting voert dezelfde fixture ook met de echte oude broncode uit.
const measurements: unknown[] = [];
for (const count of [1_000, 10_000]) {
  const opts = scene(count, 28, Math.floor(count / 2) * 28 + 0.25);
  const actual = rendererFor(opts, false, true);
  const reference = rendererFor(opts, true, true);
  ok(`${count} rijen: exacte tekenaanroepen`, JSON.stringify(actual.log) === JSON.stringify(reference.log));
  ok(`${count} rijen: exacte hitdetectie`, hitSnapshot(actual.renderer, opts) === hitSnapshot(reference.renderer, opts));
  if (!process.env.OPS_RENDER_BENCHMARK_OUT) {
    ok(`${count} rijen: minder dan 200 rijpositie-berekeningen`, actual.rowVisits < 200, String(actual.rowVisits));
    ok(`${count} rijen: referentie bezoekt alle rijen`, reference.rowVisits > 3 * count, String(reference.rowVisits));
  }
  if (process.env.OPS_RENDER_BENCHMARK_OUT) {
    // Warm de bevroren rij-/relatiecaches op; meet constructie plus render met de opnemende
    // context, zonder tellende rowToY-wrapper. Dit meet CPU-werk, geen echte browserframetijd.
    for (let i = 0; i < 5; i++) rendererFor(opts);
    const samples: number[] = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      rendererFor(opts);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    measurements.push({ count, rowVisits: actual.rowVisits, referenceRowVisits: reference.rowVisits,
      inputHash: hash(opts), drawHash: hash(actual.log), hitHash: hash(hitSnapshot(actual.renderer, opts)),
      medianMs: samples[7], samplesMs: samples,
    });
  }
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-render-caches: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-render-caches: ${checks}/${checks} groen`);
if (process.env.OPS_RENDER_BENCHMARK_OUT) writeFileSync(process.env.OPS_RENDER_BENCHMARK_OUT,
  JSON.stringify({ revision: process.env.OPS_RENDER_REVISION, measurements }, null, 2) + '\n');
