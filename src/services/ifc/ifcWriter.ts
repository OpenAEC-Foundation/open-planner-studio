import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource } from '@/types/resource';
import { ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { Baseline } from '@/types/baseline';

/** Fase 2.5-default: `Task.priority` (0-1000, default 500) en `Task.levelingDelay` (undefined/0
 *  = geen nivellering) — golden-rule-guards hieronder schrijven alleen bij afwijking. */
const DEFAULT_PRIORITY = 500;

/** Generate a 22-character IFC GlobalId (simplified). Geëxporteerd zodat de reader (fase 2.6,
 *  `extractBaselines`) baseline-taskId's — die als interne id in de OPS_Baselines-JSON staan —
 *  deterministisch kan terugmappen op de her-gegenereerde taak-id's via de IFCTASK-GlobalId. */
export function ifcGuid(seed: string): string {
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
  resourceCalendars: WorkCalendar[] = [],
  baselines: Baseline[] = [],
  activeBaselineId: string | null = null,
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

  // Calendar (projectkalender — altijd de EERSTE IFCWORKCALENDAR in het bestand; vaste conventie
  // die de reader aanhoudt om 'm van de bibliotheek-kalenders hieronder te onderscheiden, §8.2).
  const projectCalStepId = writeCalendar(ctx, calendar, ownerHistId);
  writeCalendarGenerationMeta(ctx, projectCalStepId, calendar, ownerHistId);

  // Work plan & schedule
  const startDates = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const endDates = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();
  const planStart = startDates[0] || project.startDate;
  const planEnd = endDates[endDates.length - 1] || project.endDate;

  const workPlanId = addLine(ctx, '_workplan',
    `IFCWORKPLAN(${ifcStr(ifcGuid(project.id + '_wp'))},#${ownerHistId},${ifcStr(project.name)},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  const workSchedId = addLine(ctx, '_worksched',
    `IFCWORKSCHEDULE(${ifcStr(ifcGuid(project.id + '_ws'))},#${ownerHistId},${ifcStr('Bouwplanning v1.0')},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);

  // Baselines (fase 2.6, §8.3) — per baseline één `.BASELINE.`-IfcWorkSchedule-header (Name +
  // CreationDate, ZONDER taak-duplicatie: de datums leven verliesloos in het OPS_Baselines-JSON
  // hieronder). Puur een interop-signaal "deze baselines bestaan" voor externe IFC-tools.
  // Golden rule: geen baselines ⇒ geen extra IfcWorkSchedule (de lus doet niets).
  const baselineSchedRefs: string[] = [];
  for (const b of baselines) {
    const bId = addLine(ctx, `_baseline_ws_${b.id}`,
      `IFCWORKSCHEDULE(${ifcStr(ifcGuid('baseline_ws_' + b.id))},#${ownerHistId},${ifcStr(b.name)},$,$,$,${ifcDateTime(b.createdAt)},$,$,$,$,$,$,${ifcDateTime(b.projectEnd)},.BASELINE.)`);
    baselineSchedRefs.push(`#${bId}`);
  }

  const schedRefs = [`#${workSchedId}`, ...baselineSchedRefs].join(',');
  addLine(ctx, '_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(ifcGuid('agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(${schedRefs}))`);

  // Tasks
  for (const task of tasks) {
    writeTask(ctx, task, ownerHistId, project.statusDate);
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
  writeResourceMeta(ctx, resources, ownerHistId);
  writeCrewNesting(ctx, resources, ownerHistId);
  // Kalender-bibliotheek (fase 2.8a, §8.2): de projectkalender-entry (id === project.calendarId)
  // is hierboven al als eerste IFCWORKCALENDAR geschreven — uitsluiten voorkomt een duplicaat nu
  // `resourceCalendars` de VOLLEDIGE bibliotheek is (incl. de §4.3-gemigreerde projectentry).
  writeCalendarLibrary(
    ctx, resources, tasks,
    resourceCalendars.filter(c => c.id !== project.calendarId),
    ownerHistId,
  );

  // Resource assignments
  writeAssignments(ctx, assignments, ownerHistId);
  writeAssignmentMeta(ctx, tasks, assignments, ownerHistId);

  // Tasks -> WorkSchedule control
  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(ctx, `task_${t.id}`)).join(',');
    addLine(ctx, '_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(ifcGuid('ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  // Structuurdefinities (activity codes / custom fields) + waarden per taak + projectsettings
  writeStructure(ctx, project, tasks, activityCodeTypes, customFieldDefs, ownerHistId);

  // Datum-constraints + deadlines (fase 2.3) als OPS_Constraints-pset per taak
  writeConstraints(ctx, tasks, ownerHistId);
  writeMilestoneMeta(ctx, tasks, ownerHistId);
  // Nivellering (fase 2.5): levelingDelay als OPS_Leveling-pset per taak
  writeLevelingMeta(ctx, tasks, ownerHistId);
  // Baselines (fase 2.6): OPS_Baselines-pset (JSON autoritair) op de IfcWorkSchedule
  writeBaselineMeta(ctx, workSchedId, baselines, activeBaselineId, ownerHistId);

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

  // Projectsettings — wbsAutoNumber (fase 2.2) + statusDate/progressMode (fase 2.6, §8.2).
  // Golden rule: elk veld alleen wanneer gezet; geen enkel veld ⇒ geen OPS_ProjectSettings-pset.
  const projSettingProps: number[] = [];
  if (project.wbsAutoNumber !== undefined) {
    projSettingProps.push(addLine(ctx, '_ps_wbsauto',
      `IFCPROPERTYSINGLEVALUE('wbsAutoNumber',$,IFCBOOLEAN(${project.wbsAutoNumber ? '.T.' : '.F.'}),$)`));
  }
  if (project.statusDate) {
    projSettingProps.push(addLine(ctx, '_ps_statusdate',
      `IFCPROPERTYSINGLEVALUE('StatusDate',$,IFCDATE(${ifcStr(project.statusDate)}),$)`));
  }
  // ProgressMode alleen als afwijkend van de default RETAINED_LOGIC (golden rule §8.2).
  if (project.progressMode && project.progressMode !== 'RETAINED_LOGIC') {
    projSettingProps.push(addLine(ctx, '_ps_progressmode',
      `IFCPROPERTYSINGLEVALUE('ProgressMode',$,IFCLABEL(${ifcStr(project.progressMode)}),$)`));
  }
  if (projSettingProps.length > 0) {
    const setId = addLine(ctx, '_pset_projset',
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_projset'))},#${ownerHistId},'OPS_ProjectSettings',$,(${projSettingProps.map(i => `#${i}`).join(',')}))`);
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

/**
 * Fase 2.3 — datum-constraint + deadline per taak als eigen OPS_Constraints-pset
 * (IfcTaskTime heeft geen constraint-/deadline-slots; de standaardconforme
 * IfcRelAssociatesConstraint/IfcMetric-graf is gedocumenteerd alternatief voor later).
 * ASAP (default) wordt niet geschreven.
 */
function writeConstraints(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    const props: string[] = [];
    const c = task.constraint;
    if (c && c.type !== 'ASAP') {
      const typeId = addLine(ctx, `_cstt_${task.id}`,
        `IFCPROPERTYSINGLEVALUE('ConstraintType',$,IFCLABEL(${ifcStr(c.type)}),$)`);
      props.push(`#${typeId}`);
      if (c.date) {
        const dateId = addLine(ctx, `_cstd_${task.id}`,
          `IFCPROPERTYSINGLEVALUE('ConstraintDate',$,IFCDATE(${ifcStr(c.date)}),$)`);
        props.push(`#${dateId}`);
      }
    }
    if (task.deadline) {
      const dlId = addLine(ctx, `_dl_${task.id}`,
        `IFCPROPERTYSINGLEVALUE('Deadline',$,IFCDATE(${ifcStr(task.deadline)}),$)`);
      props.push(`#${dlId}`);
    }
    if (props.length === 0) continue;
    const setId = addLine(ctx, `_pset_cst_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_cst_' + task.id))},#${ownerHistId},'OPS_Constraints',$,(${props.join(',')}))`);
    addLine(ctx, `_rel_cst_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_cst_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * Fase 2.4 — mijlpaal-metadata als OPS_Milestone-pset per taak. IfcTask.IsMilestone
 * bestaat als attribuut, maar IfcTaskTypeEnum kent geen start/finish-onderscheid en
 * geen verplicht-vlag. Automatisch (kind undefined) en niet-verplicht schrijven niets,
 * zodat oude bestanden bit-gelijk round-trippen.
 */
function writeMilestoneMeta(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (!task.isMilestone) continue;
    const props: string[] = [];
    if (task.milestoneKind === 'START' || task.milestoneKind === 'FINISH') {
      const kindId = addLine(ctx, `_msk_${task.id}`,
        `IFCPROPERTYSINGLEVALUE('MilestoneKind',$,IFCLABEL(${ifcStr(task.milestoneKind)}),$)`);
      props.push(`#${kindId}`);
    }
    if (task.mandatory) {
      const mId = addLine(ctx, `_msm_${task.id}`,
        `IFCPROPERTYSINGLEVALUE('Mandatory',$,IFCBOOLEAN(.T.),$)`);
      props.push(`#${mId}`);
    }
    if (props.length === 0) continue;
    const setId = addLine(ctx, `_pset_ms_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_ms_' + task.id))},#${ownerHistId},'OPS_Milestone',$,(${props.join(',')}))`);
    addLine(ctx, `_rel_ms_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_ms_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * Fase 2.5 — nivelleer-vertraging als OPS_Leveling-pset per taak (spiegel van
 * writeConstraints/writeMilestoneMeta). `IfcTask` heeft geen native slot voor een
 * per-taak levelingdelay (§7.6) — alleen geschreven wanneer de nivelleerder een
 * niet-nul delay heeft gezet (golden rule §7.7: undefined/0 schrijft niets).
 */
function writeLevelingMeta(ctx: WriteContext, tasks: Task[], ownerHistId: number): void {
  for (const task of tasks) {
    if (!task.levelingDelay) continue;
    const delayId = addLine(ctx, `_lvld_${task.id}`,
      `IFCPROPERTYSINGLEVALUE('LevelingDelay',$,IFCINTEGER(${Math.round(task.levelingDelay)}),$)`);
    const setId = addLine(ctx, `_pset_lvl_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_lvl_' + task.id))},#${ownerHistId},'OPS_Leveling',$,(#${delayId}))`);
    addLine(ctx, `_rel_lvl_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_lvl_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}

/**
 * Fase 2.6 — baselines als `OPS_Baselines`-pset op de `IfcWorkSchedule` (§8.3, spiegel van het
 * `OPS_StructureMeta`-dubbelspoor + `writeLevelingMeta`-patroon). Eén `IFCPROPERTYSINGLEVALUE`
 * met de volledige `JSON.stringify(baselines)` (autoritair en verliesloos — dit is de bron die
 * de reader gebruikt) + een `ActiveBaselineId`-property. Golden rule: geen baselines ⇒ geen pset.
 * De per-baseline `.BASELINE.`-IfcWorkSchedule-headers (interop-signaal) staan al bij het
 * werkplan/-schema hierboven; deze pset draagt de datums.
 */
function writeBaselineMeta(
  ctx: WriteContext,
  workSchedId: number,
  baselines: Baseline[],
  activeBaselineId: string | null,
  ownerHistId: number,
): void {
  if (baselines.length === 0) return;
  const json = JSON.stringify(baselines);
  const props: number[] = [];
  props.push(addLine(ctx, '_ps_baselines_json',
    `IFCPROPERTYSINGLEVALUE('Baselines',$,IFCTEXT(${ifcStr(json)}),$)`));
  if (activeBaselineId) {
    props.push(addLine(ctx, '_ps_baselines_active',
      `IFCPROPERTYSINGLEVALUE('ActiveBaselineId',$,IFCTEXT(${ifcStr(activeBaselineId)}),$)`));
  }
  const setId = addLine(ctx, '_pset_baselines',
    `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_baselines'))},#${ownerHistId},'OPS_Baselines',$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, '_rel_baselines',
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_baselines'))},#${ownerHistId},$,$,(#${workSchedId}),#${setId})`);
}

function writeCalendar(ctx: WriteContext, cal: WorkCalendar, ownerHistId: number, key: string = '_calendar'): number {
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
  return addLine(ctx, key,
    `IFCWORKCALENDAR(${ifcStr(ifcGuid(cal.id))},#${ownerHistId},${ifcStr(cal.name)},${ifcStr(cal.description)},$,(#${workTimeId}),${exceptStr},.FIRSTSHIFT.)`);
}

/**
 * Fase 2.8a (§8.2) — regelset-herkomst van een gegenereerde kalender (`calendar.generation`) als
 * `OPS_Calendar`-pset op de bijbehorende `IFCWORKCALENDAR` (patroon `OPS_ProjectSettings`/
 * `OPS_StructureMeta`: `IFCPROPERTYSINGLEVALUE`s + `IFCRELDEFINESBYPROPERTIES`). Golden rule:
 * alleen geschreven wanneer `generation` bestaat — een letterlijke/legacy kalender (geen
 * `generation`) schrijft niets extra, dus bestaande bestanden blijven byte-identiek.
 */
function writeCalendarGenerationMeta(
  ctx: WriteContext,
  calStepId: number,
  cal: WorkCalendar,
  ownerHistId: number,
): void {
  const gen = cal.generation;
  if (!gen) return;
  const props: number[] = [];
  props.push(addLine(ctx, `_opscal_ruleset_${cal.id}`,
    `IFCPROPERTYSINGLEVALUE('RuleSetId',$,IFCLABEL(${ifcStr(gen.ruleSetId)}),$)`));
  if (gen.region) {
    props.push(addLine(ctx, `_opscal_region_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('Region',$,IFCLABEL(${ifcStr(gen.region)}),$)`));
  }
  if (gen.breakChoice) {
    props.push(addLine(ctx, `_opscal_break_${cal.id}`,
      `IFCPROPERTYSINGLEVALUE('BreakChoice',$,IFCLABEL(${ifcStr(gen.breakChoice)}),$)`));
  }
  props.push(addLine(ctx, `_opscal_from_${cal.id}`,
    `IFCPROPERTYSINGLEVALUE('GeneratedFromYear',$,IFCINTEGER(${gen.generatedFromYear}),$)`));
  props.push(addLine(ctx, `_opscal_to_${cal.id}`,
    `IFCPROPERTYSINGLEVALUE('GeneratedToYear',$,IFCINTEGER(${gen.generatedToYear}),$)`));
  const setId = addLine(ctx, `_pset_opscal_${cal.id}`,
    `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_opscal_' + cal.id))},#${ownerHistId},'OPS_Calendar',$,(${props.map(i => `#${i}`).join(',')}))`);
  addLine(ctx, `_rel_opscal_${cal.id}`,
    `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_opscal_' + cal.id))},#${ownerHistId},$,$,(#${calStepId}),#${setId})`);
}

/**
 * Fase 2.8a (§8.2) — kalender-bibliotheek (generalisatie van de oude "resource-kalenders"-route,
 * fase 2.5, §7.5): elke bibliotheek-entry (de projectkalender-entry is al als eerste
 * IFCWORKCALENDAR geschreven door de aanroeper en zit hier dus NIET meer in) krijgt een eigen
 * IFCWORKCALENDAR (dezelfde `writeCalendar`, parametrische key) + eventuele
 * `OPS_Calendar`-generatiemeta + IFCRELASSIGNSTOCONTROL-relaties naar wie ernaar verwijst: één
 * naar de resources (`resource.calendarId === cal.id`, bestaand) en apart één naar de taken
 * (`task.calendarId === cal.id`, nieuw, §8.2) — twee losse rel-entiteiten omdat de reader
 * taken/resources via `taskStepIdMap`/`resourceStepIdMap` uit elkaar houdt. Golden rule: een
 * kalender zonder gebruikers schrijft alleen de IFCWORKCALENDAR zelf, geen rel; taken zonder
 * eigen kalender krijgen nooit een rel.
 */
function writeCalendarLibrary(
  ctx: WriteContext,
  resources: Resource[],
  tasks: Task[],
  calendars: WorkCalendar[],
  ownerHistId: number,
): void {
  for (const cal of calendars) {
    const calStepId = writeCalendar(ctx, cal, ownerHistId, `calendar_${cal.id}`);
    writeCalendarGenerationMeta(ctx, calStepId, cal, ownerHistId);

    const resRefs = resources
      .filter(r => r.calendarId === cal.id)
      .map(r => ref(ctx, `res_${r.id}`))
      .filter(r => r !== '#0');
    if (resRefs.length > 0) {
      addLine(ctx, `resctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(ifcGuid('resctrl_' + cal.id))},#${ownerHistId},$,$,(${resRefs.join(',')}),$,#${calStepId})`);
    }

    const taskRefs = tasks
      .filter(t => t.calendarId === cal.id)
      .map(t => ref(ctx, `task_${t.id}`))
      .filter(r => r !== '#0');
    if (taskRefs.length > 0) {
      addLine(ctx, `taskctrl_${cal.id}`,
        `IFCRELASSIGNSTOCONTROL(${ifcStr(ifcGuid('taskctrl_' + cal.id))},#${ownerHistId},$,$,(${taskRefs.join(',')}),$,#${calStepId})`);
    }
  }
}

function writeTask(ctx: WriteContext, task: Task, ownerHistId: number, statusDate?: string): void {
  const t = task.time;
  // Voortgang (fase 2.6, §8.1) — spec-conforme IfcTaskTime-slots (0-based arg-index in de lijst
  // hieronder): 14 StatusTime, 15 ActualDuration, 16 ActualStart, 17 ActualFinish, 18 RemainingTime,
  // 19 Completion. Golden rule: een taak zonder actuals houdt 14-18 op `$` ⇒ byte-identieke
  // round-trip van bestaande bestanden. StatusTime = de projectbrede statusdatum (peildatum),
  // alleen op taken die daadwerkelijk actuals dragen.
  const hasActuals = !!(t.actualStart || t.actualFinish);
  const statusTimeArg = hasActuals && statusDate ? ifcDateTime(statusDate) : '$';
  const actualDurationArg = t.actualDuration != null ? ifcDuration(t.actualDuration) : '$';
  const actualStartArg = t.actualStart ? ifcDateTime(t.actualStart) : '$';
  const actualFinishArg = t.actualFinish ? ifcDateTime(t.actualFinish) : '$';
  const remainingArg = t.remainingTime != null ? ifcDuration(t.remainingTime) : '$';
  const taskTimeId = addLine(ctx, `tasktime_${task.id}`,
    `IFCTASKTIME(${ifcStr(task.name + ' Time')},.PREDICTED.,$,.${t.durationType}.,${ifcDuration(t.scheduleDuration)},${ifcDateTime(t.scheduleStart)},${ifcDateTime(t.scheduleFinish)},${ifcDateTime(t.earlyStart)},${ifcDateTime(t.earlyFinish)},${ifcDateTime(t.lateStart)},${ifcDateTime(t.lateFinish)},${ifcDuration(t.freeFloat)},${ifcDuration(t.totalFloat)},${ifcBool(t.isCritical)},${statusTimeArg},${actualDurationArg},${actualStartArg},${actualFinishArg},${remainingArg},${t.completion.toFixed(1)})`);

  const ifcTaskType = `.${task.taskType}.`;
  // Spec-conforme 13-args-IFCTASK (L1-fix). IFC 4.3-attribuutvolgorde (0-based STEP-index,
  // geverifieerd tegen ifc43-docs.standards.buildingsmart.org, IfcTask-attribuuttabel):
  //   0 GlobalId, 1 OwnerHistory, 2 Name, 3 Description, 4 ObjectType, 5 Identification,
  //   6 LongDescription, 7 Status, 8 WorkMethod, 9 IsMilestone, 10 Priority, 11 TaskTime,
  //   12 PredefinedType.
  // Oudere OPS-versies schreven 12 args (WorkMethod op index 8 ontbrak, waardoor
  // IsMilestone/Priority/TaskTime/PredefinedType één positie te vroeg zaten) — de reader
  // (extractTasks) detecteert de arg-count en leest beide varianten. Deze schrijver blijft
  // een pragmatische subset: ObjectType/LongDescription/Status/WorkMethod blijven `$`;
  // Priority (IFCINTEGER, native attribuut) alleen bij afwijking van de default 500
  // (golden rule §7.7, anders `$`).
  const priorityArg = task.priority !== DEFAULT_PRIORITY ? String(Math.round(task.priority)) : '$';
  addLine(ctx, `task_${task.id}`,
    `IFCTASK(${ifcStr(ifcGuid(task.id))},#${ownerHistId},${ifcStr(task.name)},${ifcStr(task.description)},$,${ifcStr(task.wbsCode)},$,$,$,${ifcBool(task.isMilestone)},${priorityArg},#${taskTimeId},${ifcTaskType})`);
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
    case 'CREW':
      entity = `IFCCREWRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
      break;
    default:
      entity = `IFCCONSTRUCTIONMATERIALRESOURCE(${ifcStr(ifcGuid(res.id))},#${ownerHistId},${ifcStr(res.name)},${ifcStr(res.description)},$,$,$,$,.USERDEFINED.)`;
  }
  addLine(ctx, `res_${res.id}`, entity);
}

/**
 * Fase 2.5 — `OPS_Resource`-pset (§7.2): capaciteit/tarief/eenheid/tijd-gefaseerde-capaciteit
 * + de `ParentGuid`-vangnetproperty (§7.3) voor ploeg-lidmaatschap. Exact het
 * OPS_Constraints/OPS_Milestone-patroon: alleen schrijven wanneer minstens één veld van de
 * default afwijkt (golden rule §7.7).
 */
function writeResourceMeta(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  for (const res of resources) {
    const props: string[] = [];
    if (res.maxUnits !== 1) {
      const id = addLine(ctx, `_resmu_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('MaxUnits',$,IFCREAL(${res.maxUnits}),$)`);
      props.push(`#${id}`);
    }
    if (res.costPerHour !== undefined) {
      const id = addLine(ctx, `_resch_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('CostPerHour',$,IFCMONETARYMEASURE(${res.costPerHour}),$)`);
      props.push(`#${id}`);
    }
    if (res.unitOfMeasure) {
      const id = addLine(ctx, `_resuom_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('UnitOfMeasure',$,IFCLABEL(${ifcStr(res.unitOfMeasure)}),$)`);
      props.push(`#${id}`);
    }
    if (res.availabilitySteps && res.availabilitySteps.length > 0) {
      // Compacte encoding "from:maxUnits;from:maxUnits", chronologisch (B8).
      const encoded = [...res.availabilitySteps]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(s => `${s.from}:${s.maxUnits}`)
        .join(';');
      const id = addLine(ctx, `_resas_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('AvailabilitySteps',$,IFCTEXT(${ifcStr(encoded)}),$)`);
      props.push(`#${id}`);
    }
    if (res.parentId) {
      // Vangnet naast IFCRELNESTS (writeCrewNesting): de eigen reader hoeft nooit
      // afhankelijk te zijn van relatie-richting-interpretatie door andere IFC-tools.
      const id = addLine(ctx, `_respg_${res.id}`,
        `IFCPROPERTYSINGLEVALUE('ParentGuid',$,IFCTEXT(${ifcStr(ifcGuid(res.parentId))}),$)`);
      props.push(`#${id}`);
    }
    if (props.length === 0) continue;
    const setId = addLine(ctx, `_pset_res_${res.id}`,
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_res_' + res.id))},#${ownerHistId},'OPS_Resource',$,(${props.join(',')}))`);
    addLine(ctx, `_rel_res_${res.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_res_' + res.id))},#${ownerHistId},$,$,(${ref(ctx, `res_${res.id}`)}),#${setId})`);
  }
}

/**
 * Fase 2.5 — ploeg-hiërarchie (§7.3, B8): `IFCRELNESTS` (niet `IFCRELAGGREGATES`), consistent
 * met hoe OPS al WBS-taakhiërarchie modelleert (`writeWBSNesting`) — RelatingObject = de
 * CREW-resource, RelatedObjects = de leden. Alleen geschreven wanneer de ploeg leden heeft.
 */
function writeCrewNesting(ctx: WriteContext, resources: Resource[], ownerHistId: number): void {
  const crews = resources.filter(r => r.type === 'CREW');
  for (const crew of crews) {
    const memberRefs = resources
      .filter(r => r.parentId === crew.id)
      .map(r => ref(ctx, `res_${r.id}`))
      .filter(r => r !== '#0');
    if (memberRefs.length === 0) continue;
    addLine(ctx, `nest_res_${crew.id}`,
      `IFCRELNESTS(${ifcStr(ifcGuid('nest_res_' + crew.id))},#${ownerHistId},${ifcStr('Ploeg ' + crew.name)},$,${ref(ctx, `res_${crew.id}`)},(${memberRefs.join(',')}))`);
  }
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

/**
 * Fase 2.5 — `OPS_Assignments`-pset op de `IFCTASK` (§7.4, B8): `IFCRELASSIGNSTOPROCESS` kan
 * geen eigen pset dragen (het is een `IfcRelationship`, geen `IfcObjectDefinition` —
 * `IfcRelDefinesByProperties.RelatedObjects` accepteert dat type niet). Per-assignment
 * `unitsPerDay`+`curve` gaat daarom in een pset op de taak zelf: één
 * `IFCPROPERTYSINGLEVALUE` per assignment, waarde = `"unitsPerDay|curve"`.
 *
 * Property-naam = `"<resource-GUID>#<volgnummer>"` (M3-fix): de kale resource-GUID als
 * propertynaam corrumpeerde meerdere assignments van DEZELFDE resource op één taak (bv.
 * R×1(UNIFORM) + R×0.5(BELL)) — de reader dedupte op propertynaam → last-wins. Het
 * `#<volgnummer>`-achtervoegsel (0-based positie binnen de assignmentlijst van de taak) maakt
 * elke property uniek. `ifcGuid(...)` produceert nooit een `#`, dus het scheidingsteken is
 * eenduidig. De reader leest ZOWEL dit nieuwe formaat (`GUID#N`) als het oude kale-GUID-formaat
 * (legacy bestanden, §7.4). Alleen geschreven wanneer de taak minstens één assignment heeft
 * (golden rule §7.7).
 */
function writeAssignmentMeta(
  ctx: WriteContext,
  tasks: Task[],
  assignments: ResourceAssignment[],
  ownerHistId: number,
): void {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(a);
  }
  for (const task of tasks) {
    const list = byTask.get(task.id);
    if (!list || list.length === 0) continue;
    const props = list.map((a, index) => {
      const resGuid = ifcGuid(a.resourceId); // zelfde GUID als writeResource gebruikte
      const propName = `${resGuid}#${index}`; // uniek per assignment (M3)
      const val = `${a.unitsPerDay}|${a.curve ?? 'UNIFORM'}`;
      const propId = addLine(ctx, `_asgn_${task.id}_${a.id}`,
        `IFCPROPERTYSINGLEVALUE(${ifcStr(propName)},$,IFCTEXT(${ifcStr(val)}),$)`);
      return `#${propId}`;
    });
    const setId = addLine(ctx, `_pset_asgn_${task.id}`,
      `IFCPROPERTYSET(${ifcStr(ifcGuid('pset_asgn_' + task.id))},#${ownerHistId},'OPS_Assignments',$,(${props.join(',')}))`);
    addLine(ctx, `_rel_asgn_${task.id}`,
      `IFCRELDEFINESBYPROPERTIES(${ifcStr(ifcGuid('rel_asgn_' + task.id))},#${ownerHistId},$,$,(${ref(ctx, `task_${task.id}`)}),#${setId})`);
  }
}
