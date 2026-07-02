import { Task, TaskTime, TaskType, createDefaultTaskTime } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceType, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, createDefaultCalendar } from '@/types/calendar';
import { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';

interface StepEntity {
  id: string; // STEP entity ID (may include letters, e.g. "300T")
  type: string;
  args: string[];
  raw: string;
}

/** Parse an IFC STEP file into the internal model */
export function readIFC(content: string): {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
} {
  const entities = parseSTEP(content);
  const entityMap = new Map<string, StepEntity>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }

  // Extract project
  const project = extractProject(entities, entityMap);
  const calendar = extractCalendar(entities, entityMap);
  const { tasks, taskStepIdMap } = extractTasks(entities, entityMap);
  const sequences = extractSequences(entities, entityMap, taskStepIdMap);
  extractNesting(entities, entityMap, tasks, taskStepIdMap);
  const { resources, resourceStepIdMap } = extractResources(entities, entityMap);
  const assignments = extractAssignments(entities, entityMap, taskStepIdMap, resourceStepIdMap);
  const { activityCodeTypes, customFieldDefs } = extractStructure(
    entities, entityMap, project, tasks, taskStepIdMap,
  );

  return { project, calendar, tasks, sequences, resources, assignments, activityCodeTypes, customFieldDefs };
}

function parseSTEP(content: string): StepEntity[] {
  const entities: StepEntity[] = [];
  const dataSection = content.split('DATA;')[1]?.split('ENDSEC;')[0];
  if (!dataSection) return entities;

  // Strip comments (/* ... */) and normalize whitespace
  const clean = dataSection
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\r\n/g, '\n');

  // Match all entity definitions: #123=IFCTYPE(...); or #300T=IFCTASKTIME(...);
  const entityRegex = /#(\w+)\s*=\s*(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  let match;
  while ((match = entityRegex.exec(clean)) !== null) {
    entities.push({
      id: match[1],
      type: match[2].toUpperCase(),
      args: splitArgs(match[3]),
      raw: match[0],
    });
  }

  return entities;
}

/** Split IFC arguments respecting nested parentheses and quotes */
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      if (i + 1 < argsStr.length && argsStr[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (inString) {
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function stripQuotes(s: string): string {
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function parseRef(s: string): string | null {
  const m = s.trim().match(/^#(\w+)$/);
  return m ? m[1] : null;
}

function parseRefs(s: string): string[] {
  const refs: string[] = [];
  const matches = s.matchAll(/#(\w+)/g);
  for (const m of matches) {
    refs.push(m[1]);
  }
  return refs;
}

function parseDateFromIFC(s: string): string {
  if (!s || s === '$') return formatDate(new Date());
  const clean = stripQuotes(s);
  // Extract just the date part
  return clean.substring(0, 10);
}

function parseDurationDays(s: string): number {
  if (!s || s === '$') return 0;
  const clean = stripQuotes(s);
  // Parse ISO 8601 duration: P0Y0M5D of P5D of PT8H. Negatief kan op twee manieren voorkomen:
  // standaardconform met voorloopteken vóór de P ('-P2D', zo schrijven wij een lead) of als
  // app-interne legacy-notatie met het teken bij het getal ('P0Y0M-2D'). Beide lezen.
  const leadingNeg = clean.startsWith('-');
  const applySign = (n: number) => (leadingNeg && n > 0 ? -n : n);
  const dayMatch = clean.match(/(-?\d+)D/);
  if (dayMatch) return applySign(parseInt(dayMatch[1]));
  const hourMatch = clean.match(/(-?\d+)H/);
  if (hourMatch) {
    const h = parseInt(hourMatch[1]);
    return applySign(h < 0 ? -Math.ceil(-h / 8) : Math.ceil(h / 8));
  }
  return 0;
}

function parseTaskType(s: string): TaskType {
  const clean = s.replace(/\./g, '').trim();
  const valid: TaskType[] = ['CONSTRUCTION', 'INSTALLATION', 'DEMOLITION', 'LOGISTIC', 'ATTENDANCE', 'MOVE', 'RENOVATION', 'MAINTENANCE', 'USERDEFINED'];
  return valid.includes(clean as TaskType) ? (clean as TaskType) : 'CONSTRUCTION';
}

function parseSequenceType(s: string): SequenceType {
  const clean = s.replace(/\./g, '').trim();
  const map: Record<string, SequenceType> = {
    'FINISH_START': 'FINISH_START',
    'START_START': 'START_START',
    'FINISH_FINISH': 'FINISH_FINISH',
    'START_FINISH': 'START_FINISH',
  };
  return map[clean] || 'FINISH_START';
}

function extractProject(entities: StepEntity[], _entityMap: Map<string, StepEntity>): Project {
  const proj = entities.find(e => e.type === 'IFCPROJECT');
  const wp = entities.find(e => e.type === 'IFCWORKPLAN');

  return {
    id: generateId('proj'),
    name: proj ? stripQuotes(proj.args[2] || '') : 'Geïmporteerd Project',
    description: wp ? stripQuotes(wp.args[3] || '') : '',
    startDate: wp ? parseDateFromIFC(wp.args[12] || '') : formatDate(new Date()),
    endDate: wp ? parseDateFromIFC(wp.args[13] || '') : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };
}

function extractCalendar(entities: StepEntity[], entityMap: Map<string, StepEntity>): WorkCalendar {
  const cal = entities.find(e => e.type === 'IFCWORKCALENDAR');
  if (!cal) return createDefaultCalendar();

  const calendar = createDefaultCalendar();
  calendar.name = stripQuotes(cal.args[2] || '') || calendar.name;
  calendar.description = stripQuotes(cal.args[3] || '') || calendar.description;

  // Parse exception times (holidays)
  const exceptionRefs = parseRefs(cal.args[6] || '');
  const holidays: Holiday[] = [];
  for (const ref of exceptionRefs) {
    const wt = entityMap.get(ref);
    if (wt && wt.type === 'IFCWORKTIME') {
      holidays.push({
        name: stripQuotes(wt.args[0] || '') || 'Feestdag',
        startDate: parseDateFromIFC(wt.args[4] || ''),
        endDate: parseDateFromIFC(wt.args[5] || ''),
      });
    }
  }
  if (holidays.length > 0) calendar.holidays = holidays;

  return calendar;
}

function extractTasks(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
): { tasks: Task[]; taskStepIdMap: Map<string, string> } {
  const taskEntities = entities.filter(e => e.type === 'IFCTASK');
  const tasks: Task[] = [];
  const taskStepIdMap = new Map<string, string>(); // STEP #id -> our task id

  for (const te of taskEntities) {
    const id = generateId('task');
    taskStepIdMap.set(te.id, id);

    // Parse IfcTaskTime reference
    const taskTimeRef = parseRef(te.args[10] || '');
    let time: TaskTime;
    if (taskTimeRef) {
      const ttEntity = entityMap.get(taskTimeRef);
      time = ttEntity ? parseTaskTime(ttEntity) : createDefaultTaskTime(formatDate(new Date()), 5);
    } else {
      time = createDefaultTaskTime(formatDate(new Date()), 5);
    }

    const isMilestone = te.args[8]?.includes('T') || false;
    if (isMilestone) time.scheduleDuration = 0;

    tasks.push({
      id,
      name: stripQuotes(te.args[2] || '') || 'Naamloze taak',
      description: stripQuotes(te.args[3] || '') || '',
      wbsCode: stripQuotes(te.args[5] || '') || '',
      taskType: te.args[11] ? parseTaskType(te.args[11]) : 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone,
      priority: 0,
      parentId: null,
      childIds: [],
      time,
      resourceIds: [],
    });
  }

  return { tasks, taskStepIdMap };
}

function parseTaskTime(e: StepEntity): TaskTime {
  return {
    durationType: e.args[3]?.includes('ELAPSED') ? 'ELAPSEDTIME' : 'WORKTIME',
    scheduleDuration: parseDurationDays(e.args[4] || ''),
    scheduleStart: parseDateFromIFC(e.args[5] || ''),
    scheduleFinish: parseDateFromIFC(e.args[6] || ''),
    earlyStart: parseDateFromIFC(e.args[7] || ''),
    earlyFinish: parseDateFromIFC(e.args[8] || ''),
    lateStart: parseDateFromIFC(e.args[9] || ''),
    lateFinish: parseDateFromIFC(e.args[10] || ''),
    freeFloat: parseDurationDays(e.args[11] || ''),
    totalFloat: parseDurationDays(e.args[12] || ''),
    isCritical: e.args[13]?.includes('T') || false,
    completion: parseFloat(e.args[19] || '0') || 0,
  };
}

function extractSequences(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
): Sequence[] {
  const seqEntities = entities.filter(e => e.type === 'IFCRELSEQUENCE');
  const sequences: Sequence[] = [];

  for (const se of seqEntities) {
    const predRef = parseRef(se.args[4] || '');
    const succRef = parseRef(se.args[5] || '');
    if (!predRef || !succRef) continue;

    const predId = taskStepIdMap.get(predRef);
    const succId = taskStepIdMap.get(succRef);
    if (!predId || !succId) continue;

    // Lag. Twee lay-outs van IFCLAGTIME ondersteunen:
    //  - conform IFC 4.3 (huidige writer): arg 4 = LagValue als getypte select
    //    (IFCDURATION('P2D') / IFCRATIOMEASURE(0.5)), arg 5 = DurationType (.WORKTIME./.ELAPSEDTIME.);
    //  - legacy (oudere app-versies, omgewisseld): arg 4 = .WORKTIME., arg 5 = 'P0Y0M2D'.
    let lagDays = 0;
    let lagUnit: Sequence['lagUnit'];
    let lagPercent: number | undefined;
    const lagRef = parseRef(se.args[6] || '');
    if (lagRef) {
      const lagEntity = entityMap.get(lagRef);
      if (lagEntity && lagEntity.type === 'IFCLAGTIME') {
        const lagValue = (lagEntity.args[3] || '').trim();
        const durType = (lagEntity.args[4] || '').trim();
        const ratioMatch = lagValue.match(/^IFCRATIOMEASURE\s*\(\s*(-?[\d.]+)\s*\)$/i);
        const durMatch = lagValue.match(/^IFCDURATION\s*\(\s*(.+?)\s*\)$/i);
        if (ratioMatch) {
          // Ratio → procent; afronden tegen floating-point-ruis (0.33*100 = 33.000000000000004).
          lagPercent = Math.round(parseFloat(ratioMatch[1]) * 100 * 1e6) / 1e6;
        } else if (durMatch) {
          lagDays = parseDurationDays(durMatch[1]);
        } else if (lagValue.startsWith("'")) {
          // Ongetypte duur-string (soepel lezen van andermans bestanden).
          lagDays = parseDurationDays(lagValue);
        } else {
          // Legacy-lay-out: de duur staat in arg 5.
          lagDays = parseDurationDays(lagEntity.args[4] || '');
        }
        if (/ELAPSEDTIME/i.test(durType)) lagUnit = 'ELAPSEDTIME';
      }
    }

    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: parseSequenceType(se.args[7] || ''),
      lagDays,
    };
    if (lagUnit) seq.lagUnit = lagUnit;
    if (lagPercent !== undefined) seq.lagPercent = lagPercent;
    sequences.push(seq);
  }

  return sequences;
}

/** Parse een getypeerd NominalValue zoals IFCTEXT('x'), IFCREAL(1.5), IFCBOOLEAN(.T.),
 *  IFCDATE('2026-01-01'), IFCINTEGER(2), IFCMONETARYMEASURE(3.5). */
function parseTypedValue(s: string): CustomFieldValue | undefined {
  const m = (s || '').trim().match(/^IFC\w+\s*\(([\s\S]*)\)$/i);
  if (!m) return undefined;
  const inner = m[1].trim();
  if (inner === '.T.') return true;
  if (inner === '.F.') return false;
  if (inner.startsWith("'")) return stripQuotes(inner);
  const n = parseFloat(inner);
  return Number.isFinite(n) ? n : undefined;
}

const MEASURE_TO_FIELD: Record<string, CustomFieldType> = {
  ifctext: 'text', ifclabel: 'text', ifcreal: 'number', ifcinteger: 'integer',
  ifcmonetarymeasure: 'cost', ifcdate: 'date', ifcboolean: 'boolean',
};

/**
 * Fase 2.2 — structuurdefinities en taakwaarden teruglezen (spiegel van writeStructure):
 * de OPS_StructureMeta-JSON is autoritair (verliesloos, behoudt ids/kleuren); ontbreekt die
 * (bestand van een andere tool), dan reconstrueren we de definities uit de conformante
 * IFCPROPERTYSETTEMPLATE-declaraties met verse ids. Taakwaarden (OPS_CustomFields /
 * OPS_ActivityCodes-psets) worden per NAAM teruggemapt naar de definities; het
 * OPS_ProjectSettings-pset zet project.wbsAutoNumber.
 */
function extractStructure(
  entities: StepEntity[],
  entityMap: Map<string, StepEntity>,
  project: Project,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): { activityCodeTypes: ActivityCodeType[]; customFieldDefs: CustomFieldDef[] } {
  let activityCodeTypes: ActivityCodeType[] = [];
  let customFieldDefs: CustomFieldDef[] = [];

  // 1. Autoritaire meta-JSON.
  for (const e of entities) {
    if (e.type !== 'IFCPROPERTYSET' || stripQuotes(e.args[2] || '') !== 'OPS_StructureMeta') continue;
    for (const propRef of parseRefs(e.args[4] || '')) {
      const prop = entityMap.get(propRef);
      if (!prop || prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
      const raw = parseTypedValue(prop.args[2] || '');
      if (typeof raw !== 'string') continue;
      try {
        const meta = JSON.parse(raw);
        if (Array.isArray(meta.activityCodeTypes)) activityCodeTypes = meta.activityCodeTypes;
        if (Array.isArray(meta.customFieldDefs)) customFieldDefs = meta.customFieldDefs;
      } catch { /* corrupte meta — val terug op templates */ }
    }
  }

  // 2. Terugval: reconstrueer definities uit de conformante templates (verse ids).
  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) {
    for (const e of entities) {
      if (e.type !== 'IFCPROPERTYSETTEMPLATE') continue;
      const setName = stripQuotes(e.args[2] || '');
      for (const tmplRef of parseRefs(e.args[6] || '')) {
        const tmpl = entityMap.get(tmplRef);
        if (!tmpl || tmpl.type !== 'IFCSIMPLEPROPERTYTEMPLATE') continue;
        const name = stripQuotes(tmpl.args[2] || '');
        const templateType = (tmpl.args[4] || '').replace(/\./g, '').trim();
        if (setName === 'OPS_CustomFields' && templateType === 'P_SINGLEVALUE') {
          const measure = stripQuotes(tmpl.args[5] || '').toLowerCase();
          customFieldDefs.push({ id: generateId('cfd'), name, type: MEASURE_TO_FIELD[measure] ?? 'text' });
        } else if (setName === 'OPS_ActivityCodes' && templateType === 'P_ENUMERATEDVALUE') {
          const enumEntity = entityMap.get(parseRef(tmpl.args[7] || '') || '');
          const values = enumEntity && enumEntity.type === 'IFCPROPERTYENUMERATION'
            ? splitArgs((enumEntity.args[1] || '').replace(/^\(|\)$/g, ''))
                .map(v => parseTypedValue(v))
                .filter((v): v is string => typeof v === 'string')
                .map(code => ({ id: generateId('acv'), code }))
            : [];
          activityCodeTypes.push({ id: generateId('act'), name, values });
        }
      }
    }
  }

  const typeByName = new Map(activityCodeTypes.map(t => [t.name, t]));
  const defByName = new Map(customFieldDefs.map(d => [d.name, d]));
  const taskById = new Map(tasks.map(t => [t.id, t]));

  // 3. Waarden per object via IFCRELDEFINESBYPROPERTIES.
  for (const rel of entities) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = entityMap.get(parseRef(rel.args[5] || '') || '');
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    const psetName = stripQuotes(pset.args[2] || '');
    const objectRefs = parseRefs(rel.args[4] || '');
    const props = parseRefs(pset.args[4] || '')
      .map(r => entityMap.get(r))
      .filter((p): p is StepEntity => !!p);

    if (psetName === 'OPS_ProjectSettings') {
      for (const prop of props) {
        if (prop.type !== 'IFCPROPERTYSINGLEVALUE') continue;
        if (stripQuotes(prop.args[0] || '') === 'wbsAutoNumber') {
          const v = parseTypedValue(prop.args[2] || '');
          if (typeof v === 'boolean') project.wbsAutoNumber = v;
        }
      }
      continue;
    }

    if (psetName !== 'OPS_CustomFields' && psetName !== 'OPS_ActivityCodes') continue;
    for (const objRef of objectRefs) {
      const taskId = taskStepIdMap.get(objRef);
      const task = taskId ? taskById.get(taskId) : undefined;
      if (!task) continue;
      for (const prop of props) {
        const name = stripQuotes(prop.args[0] || '');
        if (psetName === 'OPS_CustomFields' && prop.type === 'IFCPROPERTYSINGLEVALUE') {
          const def = defByName.get(name);
          const value = parseTypedValue(prop.args[2] || '');
          if (def && value !== undefined) {
            task.customFields = { ...(task.customFields ?? {}), [def.id]: value };
          }
        } else if (psetName === 'OPS_ActivityCodes' && prop.type === 'IFCPROPERTYENUMERATEDVALUE') {
          const type = typeByName.get(name);
          const codes = splitArgs((prop.args[2] || '').replace(/^\(|\)$/g, ''))
            .map(v => parseTypedValue(v))
            .filter((v): v is string => typeof v === 'string');
          const value = type?.values.find(v => v.code === codes[0]);
          if (type && value) {
            task.activityCodes = { ...(task.activityCodes ?? {}), [type.id]: value.id };
          }
        }
      }
    }
  }

  return { activityCodeTypes, customFieldDefs };
}

function extractNesting(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  tasks: Task[],
  taskStepIdMap: Map<string, string>,
): void {
  const nestEntities = entities.filter(e => e.type === 'IFCRELNESTS');
  // Index tasks by id once. Voorheen werd elke parent/child via tasks.find()
  // in de lus opgezocht, waardoor nesting O(nestings × children × tasks) was.
  const taskById = new Map<string, Task>(tasks.map(t => [t.id, t]));

  for (const ne of nestEntities) {
    const parentRef = parseRef(ne.args[4] || '');
    if (!parentRef) continue;
    const parentId = taskStepIdMap.get(parentRef);
    if (!parentId) continue; // Could be WorkSchedule, skip
    const parent = taskById.get(parentId);
    if (!parent) continue;

    const childRefs = parseRefs(ne.args[5] || '');
    for (const childRef of childRefs) {
      const childId = taskStepIdMap.get(childRef);
      if (!childId) continue;
      const child = taskById.get(childId);
      if (!child) continue;
      child.parentId = parentId;
      if (!parent.childIds.includes(childId)) {
        parent.childIds.push(childId);
      }
    }
  }
}

function extractResources(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
): { resources: Resource[]; resourceStepIdMap: Map<string, string> } {
  const resTypes: Record<string, ResourceType> = {
    IFCLABORRESOURCE: 'LABOR',
    IFCCONSTRUCTIONEQUIPMENTRESOURCE: 'EQUIPMENT',
    IFCCONSTRUCTIONMATERIALRESOURCE: 'MATERIAL',
    IFCSUBCONTRACTRESOURCE: 'SUBCONTRACTOR',
  };

  const resources: Resource[] = [];
  const resourceStepIdMap = new Map<string, string>();

  for (const e of entities) {
    const resType = resTypes[e.type];
    if (!resType) continue;

    const id = generateId('res');
    resourceStepIdMap.set(e.id, id);

    resources.push({
      id,
      name: stripQuotes(e.args[2] || '') || 'Resource',
      type: resType,
      description: stripQuotes(e.args[3] || '') || '',
      availability: 1,
    });
  }

  return { resources, resourceStepIdMap };
}

function extractAssignments(
  entities: StepEntity[],
  _entityMap: Map<string, StepEntity>,
  taskStepIdMap: Map<string, string>,
  resourceStepIdMap: Map<string, string>,
): ResourceAssignment[] {
  const assignEntities = entities.filter(e => e.type === 'IFCRELASSIGNSTOPROCESS');
  const assignments: ResourceAssignment[] = [];

  for (const ae of assignEntities) {
    const taskRef = parseRef(ae.args[6] || '');
    if (!taskRef) continue;
    const taskId = taskStepIdMap.get(taskRef);
    if (!taskId) continue;

    const resRefs = parseRefs(ae.args[4] || '');
    for (const resRef of resRefs) {
      const resId = resourceStepIdMap.get(resRef);
      if (resId) {
        assignments.push({
          id: generateId('asgn'),
          taskId,
          resourceId: resId,
          units: 1,
        });
      }
    }
  }

  return assignments;
}
