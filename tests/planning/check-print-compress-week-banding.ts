/**
 * Rapport met gecomprimeerde werkdagen-as (issue #21 punt 2).
 *
 * Het scherm-Gantt en het rapport hebben ieder een renderer, maar de rapport-preview en de
 * vector-PDF delen wél `renderReport`. Deze test zet die echte tekenroutine achter een opnemende
 * Draw2D en bewaakt de twee zichtbare gevolgen van "alleen werkdagen tonen":
 *
 * - vrijdag → maandag beslaat twee getoonde werkdagkolommen, niet vier kalenderdagkolommen;
 * - de getoonde kolommen van oneven weken krijgen de rapport-weekbandkleur.
 *
 * Verwijder `compressNonWorkdays` uit de rapport-as, of teken de weekband niet: beide assertions
 * falen op echte getekende geometrie. Daardoor dekt de test tegelijk de raster-preview en de
 * vector-PDF, die dezelfde renderer gebruiken.
 */
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import { PRINT_PALETTE } from '@/engine/renderer/themePalette';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

interface RectEvent { x: number; y: number; w: number; h: number; color: string; }
interface RoundRectEvent { x: number; y: number; w: number; h: number; color: string; }

const failures: string[] = [];
const expect = (label: string, condition: boolean, detail = '') => {
  if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
};

function renderCompressedReport() {
  const rects: RectEvent[] = [];
  const bars: RoundRectEvent[] = [];
  const state = {
    font: '10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1,
    textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline,
  };
  const d2d: Draw2D = {
    get font() { return state.font; }, set font(value) { state.font = value; },
    get fillStyle() { return state.fillStyle; }, set fillStyle(value) { state.fillStyle = value; },
    get strokeStyle() { return state.strokeStyle; }, set strokeStyle(value) { state.strokeStyle = value; },
    get lineWidth() { return state.lineWidth; }, set lineWidth(value) { state.lineWidth = value; },
    get textAlign() { return state.textAlign; }, set textAlign(value) { state.textAlign = value; },
    get textBaseline() { return state.textBaseline; }, set textBaseline(value) { state.textBaseline = value; },
    setLineDash() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: state.fillStyle }); },
    strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
    roundRect(x, y, w, h) { bars.push({ x, y, w, h, color: state.fillStyle }); },
    fillText() {}, measureText(text) { return { width: text.length * 6 }; },
  };

  const task: Task = {
    id: 'fri-to-mon', name: 'Vrijdag tot maandag', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    childIds: [], predecessorIds: [], successorIds: [], resourceIds: [], progress: 0,
    time: {
      durationType: 'WORKTIME', scheduleDuration: 2,
      scheduleStart: '2026-06-05', scheduleFinish: '2026-06-08',
      earlyStart: '2026-06-05', earlyFinish: '2026-06-08',
      lateStart: '2026-06-05', lateFinish: '2026-06-08',
      freeFloat: 0, totalFloat: 0, isCritical: false,
    },
  } as unknown as Task;
  const calendar: WorkCalendar = {
    id: 'ma-vr', name: 'Maandag tot vrijdag', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const options: PrintOptions = {
    showCritical: false, showFloat: false, showDeps: false, showWeekends: true,
    showLegend: false, showTaskNames: false, showCompletion: false,
    autoFit: false, customZoom: 20, paperSize: 'A4', orientation: 'landscape', companyName: '',
    compressNonWorkdays: true,
  };

  const dims = renderReport(() => d2d, [task], [], calendar, 'Weekband-test', options);
  return { rects, bars, dims };
}

const { rects, bars, dims } = renderCompressedReport();
const weekBand = (PRINT_PALETTE as typeof PRINT_PALETTE & { gridWeekBand?: string }).gridWeekBand;

// De zichtbare activiteitbalk is bij vaste 20 px/kolom twee werkdagkolommen breed: vr + ma.
const taskBar = bars.find(bar => bar.color === PRINT_PALETTE.normal && bar.h > 10);
expect('vrijdag tot maandag is twee werkdagkolommen breed', taskBar?.w === 40, `kreeg ${taskBar?.w}px`);

// Een rapportband dekt de hele Gantt-chart (niet slechts één alternatieve taakrij) en komt voor
// bij de opgevulde datumrange rond de fixture, die meerdere oneven weken bevat.
const chartHeight = dims.height - dims.headerHeight - 50;
const bands = rects.filter(rect =>
  rect.color === weekBand
  && rect.x >= dims.tableWidth
  && rect.y === dims.headerHeight
  && rect.h === chartHeight,
);
expect('oneven weken krijgen een volledige rapport-weekband', bands.length > 0, `kreeg ${bands.length}`);

if (failures.length > 0) {
  console.log(`XX print-compress-week-banding: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK print-compress-week-banding: werkdagen-as en weekbanden groen');
