/**
 * Gedeelde IFC-fixture voor "datums zoals opgeslagen" (issue #63).
 *
 * Gedeeld tussen `tests/planning/check-recorded-dates.ts` en `tests/mcp/cases-recorded-dates.ts`:
 * beide suites moeten een document in de modus kunnen zetten, en dat lukt alleen met een bestand
 * waarvan de opgeslagen datums NIET uit de logica volgen. Eén bron, zodat de twee batterijen niet
 * uit elkaar lopen over wat "het geval van issue #63" precies is.
 *
 * De STEP-argumentreeksen komen uit de gedeelde slot-registry (`ifcTaskSlots.ts`) — niet met de hand
 * geteld. `new Array(IFC_TASKTIME_SLOTS.length)` legt de arraylengte vast aan dezelfde bron als de
 * reader/writer, en de posities komen uit `TASKTIME_SLOT`/`TASK_SLOT` (naam→index-maps, afgeleid van
 * diezelfde registry) — zo kan een verschoven index (zoals eerder de taskTime-ref op index 8 i.p.v.
 * 11) hier niet onopgemerkt insluipen. De assertie op `recordedFields` in sectie (7) van
 * check-recorded-dates.ts bewijst dat de posities ook echt kloppen.
 */
import { IFC_TASKTIME_SLOTS, IFC_TASK_SLOTS, TASKTIME_SLOT, TASK_SLOT } from '@/services/ifc/ifcTaskSlots';

/** IFCTASKTIME-argumenten met zowel het early- als het schedule-paar gevuld. */
export const ttArgs = (o: { scheduleStart: string; scheduleFinish: string; earlyStart: string; earlyFinish: string; duration: string }): string => {
  const a: string[] = new Array(IFC_TASKTIME_SLOTS.length).fill('$');
  a[TASKTIME_SLOT.name] = "'T'";
  a[TASKTIME_SLOT.dataOrigin] = '.PREDICTED.';
  a[TASKTIME_SLOT.durationType] = '.WORKTIME.';
  a[TASKTIME_SLOT.scheduleDuration] = `'${o.duration}'`;
  a[TASKTIME_SLOT.scheduleStart] = `'${o.scheduleStart}'`;
  a[TASKTIME_SLOT.scheduleFinish] = `'${o.scheduleFinish}'`;
  a[TASKTIME_SLOT.earlyStart] = `'${o.earlyStart}'`;
  a[TASKTIME_SLOT.earlyFinish] = `'${o.earlyFinish}'`;
  return a.join(',');
};

/** IFCTASK-argumenten. */
export const taskArgs = (o: { guid: string; name: string; wbs: string; taskTimeRef: string }): string => {
  const a: string[] = new Array(IFC_TASK_SLOTS.length).fill('$');
  a[TASK_SLOT.globalId] = `'${o.guid}'`;
  a[TASK_SLOT.name] = `'${o.name}'`;
  a[TASK_SLOT.identification] = `'${o.wbs}'`;
  a[TASK_SLOT.isMilestone] = '.F.';
  a[TASK_SLOT.taskTime] = o.taskTimeRef;
  a[TASK_SLOT.predefinedType] = '.CONSTRUCTION.';
  return a.join(',');
};

/**
 * Dé fixture van issue #63: taak a (2026-03-02 t/m -06, P5D, WBS 1.1) met FS-opvolger b (WBS 1.2)
 * die in het bestand vaststaat op 2026-03-16 — ver ná zijn werkelijke opvolgdatum (2026-03-09, de
 * eerstvolgende werkdag na a's finish op vrijdag 2026-03-06). Herberekenen verschuift b dus
 * gegarandeerd, en precies dat verschil is wat de modus aanbiedt. `tag` houdt projectnaam en GUID's
 * per gebruik uniek, zodat opeenvolgende ladingen niet op elkaars identiteiten lijken te steunen.
 */
export const externIfc = (tag: string): string => [
  'ISO-10303-21;', 'HEADER;',
  "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
  'ENDSEC;', 'DATA;',
  `#1=IFCPROJECT('g1${tag}',$,'Extern${tag}',$,$,$,$,$,$);`,
  `#9=IFCTASKTIME(${ttArgs({
    scheduleStart: '2026-03-02', scheduleFinish: '2026-03-06',
    earlyStart: '2026-03-02', earlyFinish: '2026-03-06', duration: 'P5D',
  })});`,
  `#2=IFCTASK(${taskArgs({ guid: `gTaskA${tag}`, name: 'A', wbs: '1.1', taskTimeRef: '#9' })});`,
  `#10=IFCTASKTIME(${ttArgs({
    scheduleStart: '2026-03-16', scheduleFinish: '2026-03-20',
    earlyStart: '2026-03-16', earlyFinish: '2026-03-20', duration: 'P5D',
  })});`,
  `#3=IFCTASK(${taskArgs({ guid: `gTaskB${tag}`, name: 'B', wbs: '1.2', taskTimeRef: '#10' })});`,
  `#4=IFCRELSEQUENCE('gSeq${tag}',$,$,$,#2,#3,$,.FINISH_START.,$);`,
  'ENDSEC;', 'END-ISO-10303-21;',
].join('\n');
