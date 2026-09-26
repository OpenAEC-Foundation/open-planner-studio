// De renderer-caches (rij-index, pijllijst, resource-accentrijen) zijn pure prestatie: een render op
// de bevroren store-lijsten (gecachet pad) moet EXACT dezelfde tekenaanroepen doen als op verse,
// niet-bevroren kopieën (ongecachet pad) — ook na mutaties die rijen of relaties veranderen, zodat
// een verouderde cache hier opvalt.
//
// Draait via run.sh. Exit 0 = alles groen.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';

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
        log.push(`${prop}(${args.map((a) => (typeof a === 'number' ? a.toFixed(3) : typeof a === 'object' ? '' : String(a))).join(',')})`);
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

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-render-caches: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-render-caches: ${checks}/${checks} groen`);
