import { Task, TaskTime, TaskType, createDefaultTaskTime } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceType, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, createDefaultCalendar } from '@/types/calendar';
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

  return { project, calendar, tasks, sequences, resources, assignments };
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
