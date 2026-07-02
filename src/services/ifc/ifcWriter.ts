import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';

/** Generate a 22-character IFC GlobalId (simplified) */
function ifcGuid(seed: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  let result = '';
  for (let i = 0; i < 22; i++) {
    const idx = Math.abs((hash * (i + 1) * 31 + i * 17) % chars.length);
    result += chars[idx];
    hash = ((hash << 3) ^ (hash >> 2) + i) | 0;
  }
  return result;
}

function ifcStr(s: string): string {
  if (!s) return '$';
  return `'${s.replace(/'/g, "''")}'`;
}

function ifcDateTime(iso: string): string {
  if (!iso) return '$';
  // Ensure format: 'YYYY-MM-DDT07:00:00'
  if (iso.length === 10) return `'${iso}T07:00:00'`;
  return `'${iso}'`;
}

function ifcDuration(days: number): string {
  return `'P0Y0M${days}D'`;
}

function ifcBool(b: boolean): string {
  return b ? '.T.' : '.F.';
}

interface WriteContext {
  lines: string[];
  nextId: number;
  idMap: Map<string, number>; // our ID -> STEP #id
}

function ref(ctx: WriteContext, key: string): string {
  return `#${ctx.idMap.get(key) || 0}`;
}

function addLine(ctx: WriteContext, key: string, line: string): number {
  const id = ctx.nextId++;
  ctx.idMap.set(key, id);
  // STEP vereist dat elke entity met ';' eindigt — anders parst de reader (ifcReader regex `\)\s*;`) niets.
  ctx.lines.push(`#${id}=${line};`);
  return id;
}

export function writeIFC(
  project: Project,
  calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  activityCodeTypes: ActivityCodeType[] = [],
  customFieldDefs: CustomFieldDef[] = [],
): string {
  const ctx: WriteContext = { lines: [], nextId: 1, idMap: new Map() };
  const now = new Date().toISOString().split('.')[0];

  // Header
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');",
    `FILE_NAME('${project.name}.ifc','${now}',('${project.author || 'Open Planner Studio'}'),('${project.company || 'OpenAEC Foundation'}'),'Open Planner Studio 0.1','Open Planner Studio','');`,
    "FILE_SCHEMA(('IFC4X3'));",
    'ENDSEC;',
    'DATA;',
    '',
  ].join('\n');

  // Owner history
  const personId = addLine(ctx, '_person', `IFCPERSON($,${ifcStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine(ctx, '_org', `IFCORGANIZATION($,${ifcStr(project.company)},$,$,$)`);
  const personOrgId = addLine(ctx, '_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine(ctx, '_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  const appId = addLine(ctx, '_app', `IFCAPPLICATION(#${appOrgId},'0.1','Open Planner Studio','OPS')`);
  const ownerHistId = addLine(ctx, '_owner', `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)})`);

  // Units
  const mId = addLine(ctx, '_m', `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const sId = addLine(ctx, '_s', `IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.)`);
  const unitAssId = addLine(ctx, '_units', `IFCUNITASSIGNMENT((#${mId},#${sId}))`);

  // Context
  const ptId = addLine(ctx, '_pt', `IFCCARTESIANPOINT((0.,0.,0.))`);
  const axId = addLine(ctx, '_ax', `IFCAXIS2PLACEMENT3D(#${ptId},$,$)`);
  const ctxId = addLine(ctx, '_ctx', `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-05,#${axId},$)`);

  // Project
  addLine(ctx, '_project', `IFCPROJECT(${ifcStr(ifcGuid(project.id))},#${ownerHistId},${ifcStr(project.name)},$,$,$,$,(#${ctxId}),#${unitAssId})`);

  // Calendar
  writeCalendar(ctx, calendar, ownerHistId);

  // Work plan & schedule
  const startDates = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const endDates = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();
  const planStart = startDates[0] || project.startDate;
  const planEnd = endDates[endDates.length - 1] || project.endDate;

  const workPlanId = addLine(ctx, '_workplan',
    `IFCWORKPLAN(${ifcStr(ifcGuid(project.id + '_wp'))},#${ownerHistId},${ifcStr(project.name)},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  const workSchedId = addLine(ctx, '_worksched',
    `IFCWORKSCHEDULE(${ifcStr(ifcGuid(project.id + '_ws'))},#${ownerHistId},${ifcStr('Bouwplanning v1.0')},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  addLine(ctx, '_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(ifcGuid('agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(#${workSchedId}))`);

  // Tasks
  for (const task of tasks) {
    writeTask(ctx, task, ownerHistId);
  }

  // WBS nesting
  writeWBSNesting(ctx, tasks, ownerHistId);

  // Root tasks -> schedule nesting
  const rootTasks = tasks.filter(t => !t.parentId);
  if (rootTasks.length > 0) {
    const rootRefs = rootTasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_nest_sched',
      `IFCRELNESTS(${ifcStr(ifcGuid('nest_root'))},#${ownerHistId},'WBS Hoofd',$,#${workSchedId},(${rootRefs}))`);
  }

  // Sequences
  for (const seq of sequences) {
    writeSequence(ctx, seq, ownerHistId);
  }

  // Resources
  for (const res of resources) {
    writeResource(ctx, res, ownerHistId);
  }

  // Resource assignments
  writeAssignments(ctx, assignments, ownerHistId);

  // Tasks -> WorkSchedule control
  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(ifcGuid('ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  // Structuurdefinities (activity codes / custom fields) + waarden per taak + projectsettings
  writeStructure(ctx, project, tasks, activityCodeTypes, customFieldDefs, ownerHistId);

  // Footer
  const footer = '\nENDSEC;\nEND-ISO-10303-21;\n';

  return header + ctx.lines.join('\n') + footer;
}

// IFC-measure-type per custom-field-type (IfcSimplePropertyTemplate.PrimaryMeasureType
// en het getypeerde NominalValue van IfcPropertySingleValue).
const FIELD_MEASURE: Record<CustomFieldType, string> = {
  text: 'IfcText',
  number: 'IfcReal',
  integer: 'IfcInteger',
  cost: 'IfcMonetaryMeasure',
  date: 'IfcDate',
  boolean: 'IfcBoolean',
};

function ifcTypedValue(type: CustomFieldType, value: CustomFieldValue): string {
  switch (type) {
    case 'text': return `IFCTEXT(${ifcStr(String(value))})`;
    case 'number': return `IFCREAL(${Number(value)})`;
    case 'integer': return `IFCINTEGER(${Math.round(Number(value))})`;
    case 'cost': return `IFCMONETARYMEASURE(${Number(value)})`;
    case 'date': return `IFCDATE(${ifcStr(String(value))})`;
    case 'boolean': return `IFCBOOLEAN(${value ? '.T.' : '.F.'})`;
  }
}

/**
 * Fase 2.2 — structuur naar IFC 4.3 (zie ontwerpdoc §2):
 *  - definities als IFCPROPERTYSETTEMPLATE + IFCSIMPLEPROPERTYTEMPLATE (P_SINGLEVALUE voor
 *    custom fields met PrimaryMeasureType; P_ENUMERATEDVALUE + IFCPROPERTYENUMERATION voor
 *    activity-code-types), gedeclareerd aan het project via IFCRELDECLARES — leesbaar voor
 *    conformante IFC-tools;
 *  - daarnaast één OPS_StructureMeta-pset met de volledige definitie-JSON (autoritair voor
 *    onze eigen reader: behoudt ids/kleuren/omschrijvingen verliesloos);
 *  - waarden per taak als eigen psets OPS_CustomFields (IFCPROPERTYSINGLEVALUE, getypeerd)
 *    en OPS_ActivityCodes (IFCPROPERTYENUMERATEDVALUE), via IFCRELDEFINESBYPROPERTIES;
 *  - OPS_ProjectSettings-pset op het project (wbsAutoNumber).
 * Identiteit in de psets is de NAAM (type-/veldnaam); de reader mapt namen terug naar ids
 * via de meta-JSON (of mint verse ids bij bestanden van derden).
 */
function writeStructure(
  ctx: WriteContext,
  project: Project,
  tasks: Task[],
  activityCodeTypes: ActivityCodeType[],
  customFieldDefs: CustomFieldDef[],
  ownerHistId: number,
): void {
  const projRef = ref(ctx, '_project');
  const relDefines = (key: string, objRef: string, setId: number) =>
    addLine(ctx, key,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid(key))},#${ownerHistId},$,$,(${objRef}),#${setId})`);

  // Projectsettings (wbsAutoNumber) — alleen schrijven wanneer de vlag bestaat.
  if (project.wbsAutoNumber !== undefined) {
    const propId = addLine(ctx, '_ps_wbsauto',
      `IFCPROPERTYSINGLEVALUE('wbsAutoNumber',$,IFCBOOLEAN(${project.wbsAutoNumber ? '.T.' : '.F.'}),$)`);
    const setId = addLine(ctx, '_pset_projset',
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_projset'))},#${ownerHistId},'OPS_ProjectSettings',$,(#${propId}))`);
    relDefines('_rel_projset', projRef, setId);
  }

  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) return;

  // Autoritaire meta-JSON (verliesloos: ids, kleuren, omschrijvingen).
  const metaJson = JSON.stringify({ activityCodeTypes, customFieldDefs });
  const metaPropId = addLine(ctx, '_ps_structmeta',
    `IFCPROPERTYSINGLEVALUE('structure',$,IFCTEXT(${ifcStr(metaJson)}),$)`);
  const metaSetId = addLine(ctx, '_pset_structmeta',
    `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_structmeta'))},#${ownerHistId},'OPS_StructureMeta',$,(#${metaPropId}))`);
  relDefines('_rel_structmeta', projRef, metaSetId);

  // Conformante templates + declaratie aan het project.
  const templateIds: number[] = [];
  if (customFieldDefs.length > 0) {
    const fieldTmplRefs = customFieldDefs.map(def => {
      const id = addLine(ctx, `_cft_${def.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(ifcGuid('cft_' + def.id))},#${ownerHistId},${ifcStr(def.name)},$,.P_SINGLEVALUE.,${ifcStr(FIELD_MEASURE[def.type])},$,$,$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_fields',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(ifcGuid('psett_fields'))},#${ownerHistId},'OPS_CustomFields',$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${fieldTmplRefs.join(',')}))`));
  }
  if (activityCodeTypes.length > 0) {
    const codeTmplRefs = activityCodeTypes.map(t => {
      const labels = t.values.map(v => `IFCLABEL(${ifcStr(v.code)})`).join(',');
      const enumId = addLine(ctx, `_acte_${t.id}`,
        `IFCPROPERTYENUMERATION(${ifcStr(t.name)},(${labels}),$)`);
      const id = addLine(ctx, `_actt_${t.id}`,
        `IFCSIMPLEPROPERTYTEMPLATE(${ifcStr(ifcGuid('actt_' + t.id))},#${ownerHistId},${ifcStr(t.name)},$,.P_ENUMERATEDVALUE.,$,$,#${enumId},$,$,$,$)`);
      return `#${id}`;
    });
    templateIds.push(addLine(ctx, '_psett_codes',
      `IFCPROPERTYSETTEMPLATE(${ifcStr(ifcGuid('psett_codes'))},#${ownerHistId},'OPS_ActivityCodes',$,.PSET_OCCURRENCEDRIVEN.,'IfcTask',(${codeTmplRefs.join(',')}))`));
  }
  if (templateIds.length > 0) {
    addLine(ctx, '_decl_templates',
      `IFCRELDECLARES(${ifcStr(ifcGuid('decl_templates'))},#${ownerHistId},$,$,${projRef},(${templateIds.map(i => `#${i}`).join(',')}))`);
  }

  // Waarden per taak.
  const typeById = new Map(activityCodeTypes.map(t => [t.id, t]));
  const defById = new Map(customFieldDefs.map(d => [d.id, d]));
  for (const task of tasks) {
    const fieldEntries = Object.entries(task.customFields ?? {}).filter(([defId]) => defById.has(defId));
    if (fieldEntries.length > 0) {
      const propRefs = fieldEntries.map(([defId, value]) => {
        const def = defById.get(defId)!;
        const id = addLine(ctx, `_cfv_${task.id}_${defId}`,
          `IFCPROPERTYSINGLEVALUE(${ifcStr(def.name)},$,${ifcTypedValue(def.type, value)},$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_cf_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_cf_' + task.id))},#${ownerHistId},'OPS_CustomFields',$,(${propRefs.join(',')}))`);
      relDefines(`_rel_cf_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }

    const codeEntries = Object.entries(task.activityCodes ?? {}).filter(([typeId, valueId]) => {
      const t = typeById.get(typeId);
      return !!t && t.values.some(v => v.id === valueId);
    });
    if (codeEntries.length > 0) {
      const propRefs = codeEntries.map(([typeId, valueId]) => {
        const t = typeById.get(typeId)!;
        const v = t.values.find(x => x.id === valueId)!;
        const id = addLine(ctx, `_acv_${task.id}_${typeId}`,
          `IFCPROPERTYENUMERATEDVALUE(${ifcStr(t.name)},$,(IFCLABEL(${ifcStr(v.code)})),$)`);
        return `#${id}`;
      });
      const setId = addLine(ctx, `_pset_ac_${task.id}`,
        `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_ac_' + task.id))},#${ownerHistId},'OPS_ActivityCodes',$,(${propRefs.join(',')}))`);
      relDefines(`_rel_ac_${task.id}`, ref(ctx, `task_${task.id}`), setId);
    }
  }
}

function writeCalendar(ctx: WriteContext, cal: WorkCalendar, ownerHistId: number): number {
  // Work time recurrence (weekdays)
  const dayNums = cal.workDays.join(',');
  const startTime = `${String(cal.workStartHour).padStart(2, '0')}:00:00`;
  const endTime = `${String(cal.workEndHour).padStart(2, '0')}:00:00`;

  const timePeriodId = addLine(ctx, '_timeperiod', `IFCTIMEPERIOD('${startTime}','${endTime}')`);
  const recurrenceId = addLine(ctx, '_recurrence', `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${dayNums}),$,$,$,$,(#${timePeriodId}))`);
  const workTimeId = addLine(ctx, '_worktime', `IFCWORKTIME('Standaard werkweek',.PREDICTED.,$,#${recurrenceId},$,$)`);

  // Holidays as exception times
  const holidayRefs: string[] = [];
  for (const holiday of cal.holidays) {
    const hId = addLine(ctx, `_holiday_${holiday.name}`,
      `IFCWORKTIME(${ifcStr(holiday.name)},.PREDICTED.,$,$,'${holiday.startDate}','${holiday.endDate}')`);
    holidayRefs.push(`#${hId}`);
  }

  const exceptStr = holidayRefs.length > 0 ? `(${holidayRefs.join(',')})` : '$';
  return addLine(ctx, '_calendar',
    `IFCWORKCALENDAR(${ifcStr(ifcGuid(cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},$,(#${workTimeId}),${exceptStr},.FIRSTSHIFT.)`);
}

function writeTask(ctx: WriteContext, task: Task, ownerHistId: number): void {
  const t = task.time;
  const taskTimeId = addLine(ctx, `tasktime_${task.id}`,
    `IFCTASKTIME(${ifcStr(task.name + ' Time')},.PREDICTED.,$,.${t.durationType}.,${ifcDuration(t.scheduleDuration)},${ifcDateTime(t.scheduleStart)},${ifcDateTime(t.scheduleFinish)},${ifcDateTime(t.earlyStart)},${ifcDateTime(t.earlyFinish)},${ifcDateTime(t.lateStart)},${ifcDateTime(t.lateFinish)},${ifcDuration(t.freeFloat)},${ifcDuration(t.totalFloat)},${ifcBool(t.isCritical)},$,$,$,$,$,${t.completion.toFixed(1)})`);

  const ifcTaskType = `.${task.taskType}.`;
  addLine(ctx, `task_${task.id}`,
    `IFCTASK(${ifcStr(ifcGuid(task.id))},#${ownerHistId},${ifcStr(task.name)},${ifcStr(task.description)},$,${ifcStr(task.wbsCode)},$,$,${ifcBool(task.isMilestone)},$,#${taskTimeId},${ifcTaskType})`);
}

function writeWBSNesting(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (task.childIds.length === 0) continue;
    const childRefs = task.childIds
      .map(cid => ref(ctx, `task_${cid}`))
      .filter(r => r !== '#0')
      .join(',');
    if (childRefs) {
      addLine(ctx, `nest_${task.id}`,
        `IFCRELNESTS(${ifcStr(ifcGuid('nest_' + task.id))},#${ownerHistId},${ifcStr('WBS ' + task.name)},$,${ref(ctx, `task_${task.id}`)},( ${childRefs}))`);
    }
  }
}

// IfcLagTime.LagValue is een IfcTimeOrRatioSelect: een getypte IFCDURATION voor vaste lag of
// IFCRATIOMEASURE voor procent-lag (IFC 4.3 zelf: ratio 0.5 = "start wanneer de voorganger 50%
// gereed is"). Een lead (negatieve lag) krijgt het ISO-8601-voorloopteken ('-P2D') — dat is de
// standaardnotatie; niet elke externe tool leest het teken, maar onze round-trip behoudt het.
function ifcLagValue(seq: Sequence): string {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `IFCRATIOMEASURE(${seq.lagPercent / 100})`;
  }
  const d = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  return d < 0 ? `IFCDURATION('-P${-d}D')` : `IFCDURATION('P${d}D')`;
}

function writeSequence(ctx: WriteContext, seq: Sequence, ownerHistId: number): void {
  let lagRef = '$';
  const hasPercent = typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent);
  if (seq.lagDays !== 0 || hasPercent) {
    // Conform IFC 4.3: IFCLAGTIME(Name, DataOrigin, UserDefinedDataOrigin, LagValue, DurationType)
    // — LagValue als getypte select in arg 4, DurationType (.WORKTIME./.ELAPSEDTIME.) in arg 5.
    // (Oudere app-versies hadden die twee omgewisseld; de reader kent beide lay-outs.)
    const durationType = seq.lagUnit === 'ELAPSEDTIME' ? 'ELAPSEDTIME' : 'WORKTIME';
    const lagId = addLine(ctx, `lag_${seq.id}`,
      `IFCLAGTIME('Lag',.PREDICTED.,$,${ifcLagValue(seq)},.${durationType}.)`);
    lagRef = `#${lagId}`;
  }

  addLine(ctx, `seq_${seq.id}`,
    `IFCRELSEQUENCE(${ifcStr(ifcGuid(seq.id))},#${ownerHistId},$,$,${ref(ctx, `task_${seq.predecessorId}`)},${ref(ctx, `task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
}

function writeResource(ctx: WriteContext, res: Resource, ownerHistId: number): void {
  let entity: string;
  switch (res.type) {
    case 'LABOR':
      entity = `IFCLABORRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    case 'EQUIPMENT':
      entity = `IFCCONSTRUCTIONEQUIPMENTRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    case 'SUBCONTRACTOR':
      entity = `IFCSUBCONTRACTRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    default:
      entity = `IFCCONSTRUCTIONMATERIALRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
  }
  addLine(ctx, `res_${res.id}`, entity);
}

function writeAssignments(ctx: WriteContext, assignments: ResourceAssignment[], ownerHistId: number): void {
  // Group assignments by task
  const byTask = new Map<string, string[]>();
  for (const a of assignments) {
    const resRef = ref(ctx, `res_${a.resourceId}`);
    if (resRef === '#0') continue;
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(resRef);
  }

  for (const [taskId, resRefs] of byTask) {
    const taskRef = ref(ctx, `task_${taskId}`);
    if (taskRef === '#0') continue;
    addLine(ctx, `assign_${taskId}`,
      `IFCRELASSIGNSTOPROCESS(${ifcStr(ifcGuid('assign_' + taskId))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,${taskRef},$)`);
  }
}
