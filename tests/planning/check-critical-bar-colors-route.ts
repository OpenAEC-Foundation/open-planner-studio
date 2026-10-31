import './domStub';
import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette, contrastRatio } from '@/engine/renderer/themePalette';
import { renderReport } from '@/services/print/printPreview';
import { loadBarColorSelection } from '@/utils/barColorSettings';
import { loadLayouts, saveLayouts } from '@/utils/settingsStore';
import { currentOverlays } from '@/state/layoutView';
import { legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';
const S=()=>useAppStore.getState();
interface Fill { x: number; y: number; w: number; h: number; style: string }
function makeCtx(): { ctx: CanvasRenderingContext2D; fills: Fill[] } {
  const fills: Fill[] = [];
  const noop = () => {};
  let last: { x: number; y: number; w: number; h: number } | null = null;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: () => { last = null; }, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { last = { x, y, w, h }; },
    fill: () => { if (last) fills.push({ ...last, style: String(ctx.fillStyle) }); },
    stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}


S().newProject();
S().setProject({startDate:'2026-06-01'});
const ids = [5,4,2,1].map((duration,i)=>S().addTask({name:['A1','A2','A3','END'][i],time:createDefaultTaskTime('2026-06-01',duration,'days')}));
for(const id of ids.slice(0,3)) S().addSequence({predecessorId:id,successorId:ids[3],type:'FINISH_START',lagDays:0});
const migrated=legacyOptionsToProfile({floatPaths:{enabled:true,method:'FREE_FLOAT',maxPaths:10}});
S().setProject({schedulingOptions:migrated.options});
S().runCPM();
S().setViewStartDate('2026-06-01');
const custom={mode:'critical',colors:{critical:'#661122',nearCritical:'#553311',normal:'#005500'}} as const;
S().setOverlays({barColors:custom});
let state=S();
console.log('SOLVED',JSON.stringify(state.tasks.map(t=>({name:t.name,critical:t.time.isCritical,near:t.time.isNearCritical,path:t.time.floatPath,float:t.time.totalFloat}))));
function screen(dark:boolean, selection:any=state.ui.barColorSelection, highContrast=false, compressed=false){
 const {ctx,fills}=makeCtx();
 new GanttRenderer(ctx,{rows:state.tasks.map(t=>({kind:'task',rowKey:t.id,task:t,depth:0,dimmed:false})),sequences:state.sequences,calendar:state.calendar,view:{...state.view,scrollX:0,scrollY:0},selectedTaskIds:[],canvasWidth:1200,canvasHeight:400,rowHeight:28,headerHeight:60,barColorSelection:selection,darkTheme:dark,highContrast,palette:highContrast?{...readGanttPalette(),bg:"#0a0a0a",gridWeekBand:"#141414",gridWeekend:"#1c1c1c",critical:"#FF6B6B",normal:"#60A5FA",milestone:"#D9A6FF"}:undefined,showFloatBand:false,compressNonWorkdays:compressed}).render();
 return state.tasks.map((t,i)=>({name:t.name,fills:fills.filter(f=>f.y>=60+i*28 && f.y+f.h<=60+(i+1)*28 && f.w>4).map(f=>f.style)}));
}
console.log('SCREEN_LIGHT',JSON.stringify(screen(false)));
console.log('SCREEN_DARK',JSON.stringify(screen(true)));
function print(selection:any){
 const {ctx,fills}=makeCtx();
 const dims=renderReport(()=>ctx as any,state.tasks,state.sequences,state.calendar,'Review',{paperSize:'A3',orientation:'landscape',showCritical:true,showFloat:false,showDeps:false,showWeekends:true,showLegend:true,showTaskNames:false,showCompletion:false,autoFit:false,customZoom:22,companyName:'',barColorSelection:selection});
 return {bars:fills.filter(f=>f.h>10 && f.h<16 && f.x>=dims.tableWidth).map(f=>({y:f.y,fill:f.style})),legend:fills.filter(f=>f.h===10).map(f=>({y:f.y,fill:f.style}))};
}
console.log('REPORT',JSON.stringify(print(state.ui.barColorSelection)));
const loaded = await loadBarColorSelection();
console.log('SETTING_RELOAD', JSON.stringify(loaded));
await saveLayouts([{id:'review701',name:'Eigen kleuren',overlays:currentOverlays(S().ui)}]);
const [layout]=await loadLayouts();
S().setOverlays({barColors:{mode:'auto'}});
S().applyLayout(layout);
const applied = S().ui.barColorSelection;
console.log('LAYOUT_APPLY', JSON.stringify(applied));
S().undo();
const undone = S().ui.barColorSelection;
console.log('LAYOUT_UNDO', JSON.stringify(undone));
S().redo();
const redone = S().ui.barColorSelection;
console.log('LAYOUT_REDO', JSON.stringify(redone));
const reloaded = await loadBarColorSelection();
console.log('LAYOUT_RELOAD_SETTING', JSON.stringify(reloaded));
console.log('DEFAULT_SCREEN_LIGHT',JSON.stringify(screen(false,{mode:'critical'})));
console.log('DEFAULT_SCREEN_DARK',JSON.stringify(screen(true,{mode:'critical'})));
console.log('ONLY_NORMAL_EDIT_LIGHT',JSON.stringify(screen(false,{mode:'critical',colors:{normal:'#005500'}})));
console.log('ONLY_NORMAL_EDIT_DARK',JSON.stringify(screen(true,{mode:'critical',colors:{normal:'#005500'}})));
console.log('DEFAULT_REPORT',JSON.stringify(print({mode:'critical'})));
console.log('ONLY_NORMAL_EDIT_REPORT',JSON.stringify(print({mode:'critical',colors:{normal:'#005500'}})));
console.log('HIGH_CONTRAST_BLACK',JSON.stringify(screen(false,{mode:'critical',colors:{critical:'#000000',nearCritical:'#000000',normal:'#000000'}},true)));

const nearOptions=legacyOptionsToProfile({nearCriticalThreshold:1,floatPaths:{enabled:false,method:'FREE_FLOAT',maxPaths:10}});
S().setProject({schedulingOptions:nearOptions.options});S().runCPM();state=S();
console.log('NEAR_SOLVED',JSON.stringify(state.tasks.map(t=>({name:t.name,critical:t.time.isCritical,near:t.time.isNearCritical,path:t.time.floatPath,float:t.time.totalFloat}))));
console.log('NEAR_DEFAULT_LIGHT',JSON.stringify(screen(false,{mode:'critical'})));
console.log('NEAR_NORMAL_EDIT_LIGHT',JSON.stringify(screen(false,{mode:'critical',colors:{normal:'#005500'}})));
console.log('NEAR_DEFAULT_DARK',JSON.stringify(screen(true,{mode:'critical'})));
console.log('NEAR_NORMAL_EDIT_DARK',JSON.stringify(screen(true,{mode:'critical',colors:{normal:'#005500'}})));
console.log('NEAR_DEFAULT_REPORT',JSON.stringify(print({mode:'critical'})));
console.log('NEAR_NORMAL_EDIT_REPORT',JSON.stringify(print({mode:'critical',colors:{normal:'#005500'}})));
console.log('HC_DEFAULT',JSON.stringify(screen(false,{mode:'critical'},true)));
console.log('HC_BLACK',JSON.stringify(screen(false,{mode:'critical',colors:{critical:'#000000',nearCritical:'#000000',normal:'#000000'}},true)));

const normalOnly = { mode: 'critical', colors: { normal: '#005500' } } as const;
const baseLight = screen(false, { mode: 'critical' });
const editedLight = screen(false, normalOnly);
const baseDark = screen(true, { mode: 'critical' });
const editedDark = screen(true, normalOnly);
const baseReport = print({ mode: 'critical' });
const editedReport = print(normalOnly);
const failures: string[] = [];
function check(ok: boolean, label: string): void { if (!ok) failures.push(label); }
check(JSON.stringify(loaded) === JSON.stringify(custom), 'keuze overleeft herladen');
check(JSON.stringify(applied) === JSON.stringify(custom), 'layout past kleuren toe');
check(JSON.stringify(undone) === JSON.stringify({ mode: 'auto' }), 'undo herstelt vorige keuze');
check(JSON.stringify(redone) === JSON.stringify(custom), 'redo herstelt kleuren');
check(JSON.stringify(reloaded) === JSON.stringify(custom), 'redo bewaart kleuren');
check(JSON.stringify(baseLight[0]?.fills) === JSON.stringify(editedLight[0]?.fills), 'kritieke standaard blijft in licht');
check(JSON.stringify(baseLight[1]?.fills) === JSON.stringify(editedLight[1]?.fills), 'bijna-kritieke standaard blijft in licht');
check(JSON.stringify(baseDark[0]?.fills) === JSON.stringify(editedDark[0]?.fills), 'kritieke standaard blijft in donker');
check(baseReport.bars[1]?.fill === editedReport.bars[1]?.fill, 'bijna-kritieke standaard blijft in rapport');
for (const color of ['#000000', '#333333', '#777777', '#aaaaaa', '#0000ff', '#ff0000', '#663399']) {
  const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  for (const [compressed, bg] of [[true, '#141414'], [false, '#1c1c1c']] as const) {
    const drawn = screen(false, { mode: 'critical', colors: { critical: color } }, true, compressed)[0]?.fills[0] ?? '#000000';
    for (const surface of ['#0a0a0a', bg]) check(contrastRatio(rgb(drawn), rgb(surface)) >= 7, `hoog contrast: ${color} als ${drawn} op ${surface} haalt 7:1`);
  }
}
const floatOptions = legacyOptionsToProfile({ floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 10 } });
S().setProject({ schedulingOptions: floatOptions.options }); S().runCPM(); state = S();
const floatScreen = screen(false, normalOnly);
check(floatScreen[1]?.fills.includes('#005500') === true, 'eigen kleur wint van float-pad 2');
check(floatScreen[2]?.fills.includes('#005500') === true, 'eigen kleur wint van float-pad 3');
if (failures.length) { console.error(failures); process.exit(1); }
console.log('eigen balkkleuren: alle controles geslaagd');
