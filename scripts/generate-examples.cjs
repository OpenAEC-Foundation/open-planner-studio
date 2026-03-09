// generate-examples.cjs - Generate 20 example IFC construction schedules
const fs = require('fs');
const path = require('path');

// ============================================================
// IFC STEP helper functions (replicated from ifcWriter.ts)
// ============================================================

function ifcGuid(seed) {
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

function ifcStr(s) {
  if (!s) return '$';
  return `'${s.replace(/'/g, "''")}'`;
}

function ifcDateTime(iso) {
  if (!iso) return '$';
  if (iso.length === 10) return `'${iso}T07:00:00'`;
  return `'${iso}'`;
}

function ifcDuration(days) {
  return `'P0Y0M${days}D'`;
}

function ifcBool(b) {
  return b ? '.T.' : '.F.';
}

// ============================================================
// IFC Writer (replicates ifcWriter.ts logic exactly)
// ============================================================

function writeIFC(project, calendar, tasks, sequences) {
  const lines = [];
  let nextId = 1;
  const idMap = new Map();

  function ref(key) { return `#${idMap.get(key) || 0}`; }
  function addLine(key, line) {
    const id = nextId++;
    idMap.set(key, id);
    lines.push(`#${id}=${line}`);
    return id;
  }

  const now = '2026-01-15T08:00:00';

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
  const personId = addLine('_person', `IFCPERSON($,${ifcStr(project.author)},$,$,$,$,$,$)`);
  const orgId = addLine('_org', `IFCORGANIZATION($,${ifcStr(project.company)},$,$,$)`);
  const personOrgId = addLine('_personorg', `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`);
  const appOrgId = addLine('_apporg', `IFCORGANIZATION($,'OpenAEC Foundation',$,$,$)`);
  const appId = addLine('_app', `IFCAPPLICATION(#${appOrgId},'0.1','Open Planner Studio','OPS')`);
  const ownerHistId = addLine('_owner', `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,1737000000)`);

  // Units
  const mId = addLine('_m', `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const sId = addLine('_s', `IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.)`);
  const unitAssId = addLine('_units', `IFCUNITASSIGNMENT((#${mId},#${sId}))`);

  // Context
  const ptId = addLine('_pt', `IFCCARTESIANPOINT((0.,0.,0.))`);
  const axId = addLine('_ax', `IFCAXIS2PLACEMENT3D(#${ptId},$,$)`);
  const ctxId = addLine('_ctx', `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Plan',3,1.0E-05,#${axId},$)`);

  // Project
  addLine('_project', `IFCPROJECT(${ifcStr(ifcGuid(project.id))},#${ownerHistId},${ifcStr(project.name)},$,$,$,$,(#${ctxId}),#${unitAssId})`);

  // Calendar
  const dayNums = calendar.workDays.join(',');
  const startTime = `${String(calendar.workStartHour).padStart(2,'0')}:00:00`;
  const endTime = `${String(calendar.workEndHour).padStart(2,'0')}:00:00`;
  const timePeriodId = addLine('_timeperiod', `IFCTIMEPERIOD('${startTime}','${endTime}')`);
  const recurrenceId = addLine('_recurrence', `IFCRECURRENCEPATTERN(.WEEKLY.,$,(${dayNums}),$,$,$,$,(#${timePeriodId}))`);
  const workTimeId = addLine('_worktime', `IFCWORKTIME('Standaard werkweek',.PREDICTED.,$,#${recurrenceId},$,$)`);

  const holidayRefs = [];
  for (const holiday of calendar.holidays) {
    const hId = addLine(`_holiday_${holiday.name}`, `IFCWORKTIME(${ifcStr(holiday.name)},.PREDICTED.,$,$,'${holiday.startDate}','${holiday.endDate}')`);
    holidayRefs.push(`#${hId}`);
  }
  const exceptStr = holidayRefs.length > 0 ? `(${holidayRefs.join(',')})` : '$';
  addLine('_calendar', `IFCWORKCALENDAR(${ifcStr(ifcGuid(calendar.id))},#${ownerHistId},${ifcStr(calendar.name)},${ifcStr(calendar.description)},$,(#${workTimeId}),${exceptStr},.FIRSTSHIFT.)`);

  // Work plan & schedule
  const startDates = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const endDates = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();
  const planStart = startDates[0] || project.startDate;
  const planEnd = endDates[endDates.length - 1] || project.endDate;

  const workPlanId = addLine('_workplan',
    `IFCWORKPLAN(${ifcStr(ifcGuid(project.id + '_wp'))},#${ownerHistId},${ifcStr(project.name)},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);
  const workSchedId = addLine('_worksched',
    `IFCWORKSCHEDULE(${ifcStr(ifcGuid(project.id + '_ws'))},#${ownerHistId},${ifcStr('Bouwplanning v1.0')},$,$,$,${ifcDateTime(now)},$,$,$,$,$,${ifcDateTime(planStart)},${ifcDateTime(planEnd)},.PLANNED.)`);
  addLine('_agg_plan_sched',
    `IFCRELAGGREGATES(${ifcStr(ifcGuid('agg_ps'))},#${ownerHistId},$,$,#${workPlanId},(#${workSchedId}))`);

  // Tasks
  for (const task of tasks) {
    const t = task.time;
    const taskTimeId = addLine(`tasktime_${task.id}`,
      `IFCTASKTIME(${ifcStr(task.name + ' Time')},.PREDICTED.,$,.${t.durationType}.,${ifcDuration(t.scheduleDuration)},${ifcDateTime(t.scheduleStart)},${ifcDateTime(t.scheduleFinish)},${ifcDateTime(t.earlyStart)},${ifcDateTime(t.earlyFinish)},${ifcDateTime(t.lateStart)},${ifcDateTime(t.lateFinish)},${ifcDuration(t.freeFloat)},${ifcDuration(t.totalFloat)},${ifcBool(t.isCritical)},$,$,$,$,$,${t.completion.toFixed(1)})`);
    addLine(`task_${task.id}`,
      `IFCTASK(${ifcStr(ifcGuid(task.id))},#${ownerHistId},${ifcStr(task.name)},${ifcStr(task.description)},$,${ifcStr(task.wbsCode)},$,$,${ifcBool(task.isMilestone)},$,#${taskTimeId},.${task.taskType}.)`);
  }

  // WBS nesting
  for (const task of tasks) {
    if (task.childIds.length === 0) continue;
    const childRefs = task.childIds.map(cid => ref(`task_${cid}`)).filter(r => r !== '#0').join(',');
    if (childRefs) {
      addLine(`nest_${task.id}`,
        `IFCRELNESTS(${ifcStr(ifcGuid('nest_' + task.id))},#${ownerHistId},${ifcStr('WBS ' + task.name)},$,${ref(`task_${task.id}`)},( ${childRefs}))`);
    }
  }

  // Root tasks -> schedule nesting
  const rootTasks = tasks.filter(t => !t.parentId);
  if (rootTasks.length > 0) {
    const rootRefs = rootTasks.map(t => ref(`task_${t.id}`)).join(',');
    addLine('_nest_sched',
      `IFCRELNESTS(${ifcStr(ifcGuid('nest_root'))},#${ownerHistId},'WBS Hoofd',$,#${workSchedId},(${rootRefs}))`);
  }

  // Sequences
  for (const seq of sequences) {
    let lagRef = '$';
    if (seq.lagDays !== 0) {
      const lagId = addLine(`lag_${seq.id}`,
        `IFCLAGTIME('Lag',.PREDICTED.,$,.WORKTIME.,${ifcDuration(Math.abs(seq.lagDays))})`);
      lagRef = `#${lagId}`;
    }
    addLine(`seq_${seq.id}`,
      `IFCRELSEQUENCE(${ifcStr(ifcGuid(seq.id))},#${ownerHistId},$,$,${ref(`task_${seq.predecessorId}`)},${ref(`task_${seq.successorId}`)},${lagRef},.${seq.type}.,$)`);
  }

  // Control assignment
  if (tasks.length > 0) {
    const allTaskRefs = tasks.map(t => ref(`task_${t.id}`)).join(',');
    addLine('_ctrl',
      `IFCRELASSIGNSTOCONTROL(${ifcStr(ifcGuid('ctrl'))},#${ownerHistId},$,$,(${allTaskRefs}),$,#${workSchedId})`);
  }

  const footer = '\nENDSEC;\nEND-ISO-10303-21;\n';
  return header + lines.join('\n') + footer;
}

// ============================================================
// Date math helpers
// ============================================================

function addWorkDays(startDate, days) {
  const d = new Date(startDate + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().substring(0, 10);
}

function fmt(d) { return d; } // dates already formatted

// ============================================================
// Task/Sequence builder helpers
// ============================================================

let globalTaskCounter = 0;
let globalSeqCounter = 0;

function makeTask(opts) {
  globalTaskCounter++;
  const id = opts.id || `t${globalTaskCounter}`;
  const dur = opts.duration || 0;
  const start = opts.start;
  const finish = dur > 0 ? addWorkDays(start, dur) : start;
  const isCrit = opts.isCritical || false;
  const totalFloat = opts.totalFloat || 0;

  return {
    id,
    name: opts.name,
    description: opts.description || '',
    wbsCode: opts.wbs || '',
    taskType: opts.taskType || 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: opts.milestone || false,
    priority: 0,
    parentId: opts.parentId || null,
    childIds: [],
    time: {
      durationType: 'WORKTIME',
      scheduleDuration: dur,
      scheduleStart: start,
      scheduleFinish: finish,
      earlyStart: start,
      earlyFinish: finish,
      lateStart: totalFloat > 0 ? addWorkDays(start, totalFloat) : start,
      lateFinish: totalFloat > 0 ? addWorkDays(finish, totalFloat) : finish,
      freeFloat: 0,
      totalFloat: totalFloat,
      isCritical: isCrit,
      completion: 0,
    },
    resourceIds: [],
  };
}

function makeSeq(predId, succId, type, lag) {
  globalSeqCounter++;
  return {
    id: `seq${globalSeqCounter}`,
    predecessorId: predId,
    successorId: succId,
    type: type || 'FINISH_START',
    lagDays: lag || 0,
  };
}

function defaultCalendar() {
  return {
    id: 'cal-default',
    name: 'Bouwkalender NL',
    description: 'Standaard bouwkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: [
      { name: 'Nieuwjaar', startDate: '2026-01-01', endDate: '2026-01-01' },
      { name: 'Goede Vrijdag', startDate: '2026-04-03', endDate: '2026-04-03' },
      { name: 'Pasen', startDate: '2026-04-05', endDate: '2026-04-06' },
      { name: 'Koningsdag', startDate: '2026-04-27', endDate: '2026-04-27' },
      { name: 'Bevrijdingsdag', startDate: '2026-05-05', endDate: '2026-05-05' },
      { name: 'Hemelvaart', startDate: '2026-05-14', endDate: '2026-05-15' },
      { name: 'Pinksteren', startDate: '2026-05-24', endDate: '2026-05-25' },
      { name: 'Bouwvak (regio Noord)', startDate: '2026-07-20', endDate: '2026-08-07' },
    ],
  };
}

// Build a hierarchical project. phases is an array of { name, wbs, taskType?, children: [{name, wbs, duration, taskType?, ...}] }
function buildProject(projDef) {
  globalTaskCounter = 0;
  globalSeqCounter = 0;

  const project = {
    id: projDef.id,
    name: projDef.name,
    description: projDef.description || '',
    startDate: projDef.startDate,
    endDate: projDef.endDate,
    calendarId: 'cal-default',
    createdAt: '2026-01-15T08:00:00',
    modifiedAt: '2026-01-15T08:00:00',
    author: projDef.author || 'Projectleider',
    company: projDef.company || 'Bouwbedrijf BV',
  };

  const tasks = [];
  const sequences = [];
  let currentDate = projDef.startDate;
  const phaseEndTaskIds = []; // for inter-phase dependencies

  for (const phase of projDef.phases) {
    const phaseId = `p_${phase.wbs}`;
    globalTaskCounter++;
    const phaseTask = makeTask({
      id: phaseId,
      name: phase.name,
      wbs: phase.wbs,
      start: currentDate,
      duration: 0,
      taskType: phase.taskType || 'CONSTRUCTION',
    });
    phaseTask.childIds = [];
    tasks.push(phaseTask);

    let phaseDate = currentDate;
    let prevChildId = null;
    const childTasks = [];

    for (const child of phase.children) {
      globalTaskCounter++;
      const childId = `${phaseId}_${globalTaskCounter}`;
      const dur = child.milestone ? 0 : (child.duration || 5);
      const childStart = child.start || phaseDate;

      const ct = makeTask({
        id: childId,
        name: child.name,
        wbs: child.wbs || `${phase.wbs}.${childTasks.length + 1}`,
        start: childStart,
        duration: dur,
        taskType: child.taskType || phase.taskType || 'CONSTRUCTION',
        milestone: child.milestone || false,
        parentId: phaseId,
        isCritical: child.isCritical || false,
        totalFloat: child.totalFloat || 0,
        description: child.description || '',
      });

      phaseTask.childIds.push(childId);
      tasks.push(ct);
      childTasks.push(ct);

      // Dependency
      if (child.depType === 'SS' && prevChildId) {
        sequences.push(makeSeq(prevChildId, childId, 'START_START', child.lag || 0));
      } else if (child.depType === 'FF' && prevChildId) {
        sequences.push(makeSeq(prevChildId, childId, 'FINISH_FINISH', child.lag || 0));
      } else if (prevChildId && child.depType !== 'NONE') {
        sequences.push(makeSeq(prevChildId, childId, 'FINISH_START', child.lag || 0));
      }

      // Update rolling date
      if (!child.milestone) {
        phaseDate = addWorkDays(childStart, dur);
      }
      prevChildId = childId;
    }

    // Update phase task span
    if (childTasks.length > 0) {
      phaseTask.time.scheduleStart = childTasks[0].time.scheduleStart;
      phaseTask.time.scheduleFinish = childTasks[childTasks.length - 1].time.scheduleFinish;
      phaseTask.time.earlyStart = phaseTask.time.scheduleStart;
      phaseTask.time.earlyFinish = phaseTask.time.scheduleFinish;
      phaseTask.time.lateStart = phaseTask.time.scheduleStart;
      phaseTask.time.lateFinish = phaseTask.time.scheduleFinish;
      phaseTask.time.scheduleDuration = 0; // summary task
    }

    // Inter-phase dependency
    if (phaseEndTaskIds.length > 0) {
      const lastPhaseEndId = phaseEndTaskIds[phaseEndTaskIds.length - 1];
      if (childTasks.length > 0) {
        sequences.push(makeSeq(lastPhaseEndId, childTasks[0].id, 'FINISH_START', phase.lagFromPrev || 0));
      }
    }
    if (childTasks.length > 0) {
      phaseEndTaskIds.push(childTasks[childTasks.length - 1].id);
    }

    currentDate = phaseDate;
  }

  return { project, tasks, sequences };
}

// ============================================================
// 20 PROJECT DEFINITIONS
// ============================================================

function project1() {
  return buildProject({
    id: 'proj-grachtenpand', name: 'Nieuwbouw Grachtenpand Amsterdam',
    description: 'Nieuwbouw 3-laags grachtenpand met kelder',
    startDate: '2026-03-02', endDate: '2027-05-01',
    author: 'Jan de Vries', company: 'Amsterdam Bouw BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Damwanden plaatsen', duration: 10, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Bemaling installeren', duration: 5, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Grondonderzoek uitvoeren', duration: 3 },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering & Kelder', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Ontgraven bouwput', duration: 10, isCritical: true },
        { name: 'Funderingspalen heien', duration: 15, isCritical: true },
        { name: 'Wapening kelder', duration: 8 },
        { name: 'Keldervloer storten', duration: 5, isCritical: true },
        { name: 'Kelderwanden storten', duration: 10, isCritical: true },
        { name: 'Waterdichting kelder', duration: 5 },
        { name: 'Terugvullen bouwput', duration: 5, taskType: 'LOGISTIC' },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond metselwerk', duration: 12, isCritical: true },
        { name: 'Vloer 1e verdieping', duration: 5, isCritical: true },
        { name: '1e verdieping metselwerk', duration: 10, isCritical: true },
        { name: 'Vloer 2e verdieping', duration: 5 },
        { name: '2e verdieping metselwerk', duration: 10 },
        { name: 'Vloer 3e verdieping', duration: 5 },
        { name: '3e verdieping metselwerk', duration: 8 },
        { name: 'Dakconstructie hout', duration: 10, isCritical: true },
        { name: 'Dakbedekking', duration: 8 },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Gevelisolatie', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Gevelbekleding natuursteen', duration: 15, taskType: 'CONSTRUCTION' },
        { name: 'Kozijnen plaatsen', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Beglazing', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra eerste fix', duration: 10 },
        { name: 'Loodgieter eerste fix', duration: 8 },
        { name: 'CV-installatie', duration: 10, depType: 'SS', lag: 3 },
        { name: 'Ventilatie systeem', duration: 8 },
        { name: 'Domotica bekabeling', duration: 5 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Binnenwanden', duration: 10 },
        { name: 'Stucwerk', duration: 12 },
        { name: 'Tegelwerk badkamers', duration: 8 },
        { name: 'Dekvloeren', duration: 5 },
        { name: 'Schilderwerk', duration: 10 },
        { name: 'Keuken plaatsen', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Sanitair afmonteren', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Vloerafwerking', duration: 8 },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Buitenruimte aanleggen', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Schoonmaak', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Eindcontrole installaties', duration: 3 },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project2() {
  return buildProject({
    id: 'proj-school-renovatie', name: 'Renovatie Basisschool De Regenboog',
    description: 'Energetische renovatie en uitbreiding basisschool',
    startDate: '2026-06-29', endDate: '2026-12-18',
    author: 'Petra Jansen', company: 'SchoolBouw Nederland',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Inventarisatie asbest', duration: 3 },
        { name: 'Tijdelijke huisvesting inrichten', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Bouwplaats inrichten', duration: 3, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Start renovatie', milestone: true, isCritical: true },
      ]},
      { name: '2. Sloop & Strippen', wbs: '2', taskType: 'DEMOLITION', children: [
        { name: 'Asbestsanering', duration: 5, isCritical: true },
        { name: 'Strippen interieur', duration: 8, isCritical: true },
        { name: 'Sloop binnenwanden', duration: 5 },
        { name: 'Dakbedekking verwijderen', duration: 5 },
        { name: 'Kozijnen verwijderen', duration: 3 },
      ]},
      { name: '3. Constructief', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Funderingsherstel', duration: 5 },
        { name: 'Staalconstructie versterking', duration: 8, isCritical: true },
        { name: 'Nieuwe dakconstructie', duration: 10, isCritical: true },
        { name: 'Uitbreiding metselwerk', duration: 10 },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Gevelisolatie buitenzijde', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Nieuwe kozijnen HR++', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Dakisolatie en dakbedekking', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Wind- en waterdicht', milestone: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra vernieuwen', duration: 8 },
        { name: 'Warmtepomp installeren', duration: 5 },
        { name: 'Vloerverwarming', duration: 8, depType: 'SS', lag: 2 },
        { name: 'Ventilatie WTW', duration: 5 },
        { name: 'Zonnepanelen', duration: 5 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Binnenwanden plaatsen', duration: 8 },
        { name: 'Plafonds', duration: 5 },
        { name: 'Vloerafwerking', duration: 5 },
        { name: 'Schilderwerk', duration: 8 },
        { name: 'Sanitair', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Inrichting lokalen', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Buitenterrein', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project3() {
  return buildProject({
    id: 'proj-kantoor-zuidas', name: 'Kantoorgebouw Zuidas',
    description: '8-laags kantoorgebouw met parkeerkelder BREEAM Excellent',
    startDate: '2026-02-02', endDate: '2027-08-01',
    author: 'Mark Bakker', company: 'Zuidas Ontwikkeling BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwplaats inrichten', duration: 8, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Omgevingsmanagement', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Verkeersmaatregelen', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Monitoring peilbuizen', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Grondwerk & Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Damwand profielen', duration: 15, isCritical: true },
        { name: 'Bronbemaling', duration: 5, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Ontgraven -2', duration: 12, isCritical: true },
        { name: 'Ontgraven -1', duration: 10, isCritical: true },
        { name: 'Funderingspalen boren', duration: 20, isCritical: true },
        { name: 'Funderingsbalken', duration: 10, isCritical: true },
        { name: 'Keldervloer P2', duration: 8 },
        { name: 'Keldervloer P1', duration: 8 },
        { name: 'Kelderwanden storten', duration: 12 },
        { name: 'Waterdichting kelder', duration: 8 },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond kolommen & vloer', duration: 10, isCritical: true },
        { name: 'Verdieping 1 ruwbouw', duration: 8, isCritical: true },
        { name: 'Verdieping 2 ruwbouw', duration: 8, isCritical: true },
        { name: 'Verdieping 3 ruwbouw', duration: 8 },
        { name: 'Verdieping 4 ruwbouw', duration: 8 },
        { name: 'Verdieping 5 ruwbouw', duration: 8 },
        { name: 'Verdieping 6 ruwbouw', duration: 8 },
        { name: 'Verdieping 7 ruwbouw', duration: 8 },
        { name: 'Verdieping 8 ruwbouw', duration: 8 },
        { name: 'Trappenhuis kern beton', duration: 20, depType: 'SS', lag: 5 },
        { name: 'Dakconstructie staal', duration: 10 },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel', wbs: '4', taskType: 'INSTALLATION', children: [
        { name: 'Vliesgevel montage fase 1', duration: 15, isCritical: true },
        { name: 'Vliesgevel montage fase 2', duration: 15 },
        { name: 'Vliesgevel montage fase 3', duration: 12 },
        { name: 'Dakafwerking en installaties', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Hoofdverdeelruimte elektra', duration: 10 },
        { name: 'Stijgleidingen elektra', duration: 12 },
        { name: 'Stijgleidingen W-installatie', duration: 12, depType: 'SS', lag: 3 },
        { name: 'Luchtbehandelingskasten', duration: 10 },
        { name: 'Kanaalwerk ventilatie', duration: 15 },
        { name: 'Sprinklerinstallatie', duration: 10 },
        { name: 'Liftinstallatie', duration: 20 },
        { name: 'BMS/gebouwbeheer', duration: 8 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Systeemwanden kantoren', duration: 15 },
        { name: 'Verlaagde plafonds', duration: 12 },
        { name: 'Verhoogde vloeren', duration: 10 },
        { name: 'Sanitaire ruimten', duration: 8 },
        { name: 'Keuken/pantry inbouw', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk & afwerking', duration: 10 },
      ]},
      { name: '7. Terrein & Oplevering', wbs: '7', children: [
        { name: 'Bestrating & groenvoorziening', duration: 10 },
        { name: 'Inrichting entree & lobby', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Testen & inregelen', duration: 10, taskType: 'ATTENDANCE' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project4() {
  return buildProject({
    id: 'proj-appartementen-ehv', name: 'Woningbouw 24 Appartementen Eindhoven',
    description: '24 appartementen in 4 bouwlagen met parkeerkelder',
    startDate: '2026-03-16', endDate: '2027-07-01',
    author: 'Sophie van Dijk', company: 'Wonen Zuid BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Heiwerk proefbelasting', duration: 3, isCritical: true },
        { name: 'Nutsvoorzieningen omleggen', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Heien funderingspalen', duration: 15, isCritical: true },
        { name: 'Grondwerk parkeerkelder', duration: 10, isCritical: true },
        { name: 'Funderingsbalken en poeren', duration: 8 },
        { name: 'Keldervloer storten', duration: 5, isCritical: true },
        { name: 'Kelderwanden', duration: 8 },
        { name: 'Waterdichting', duration: 5 },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond wanden en vloer', duration: 12, isCritical: true },
        { name: '1e verdieping beton', duration: 10, isCritical: true },
        { name: '2e verdieping beton', duration: 10 },
        { name: '3e verdieping beton', duration: 10 },
        { name: '4e verdieping beton', duration: 10 },
        { name: 'Trappenhuis beton', duration: 15, depType: 'SS', lag: 5 },
        { name: 'Dakopbouw', duration: 8 },
        { name: 'Balkonconstructies', duration: 10 },
        { name: 'Metselwerk gevels', duration: 20 },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Gevelisolatie', duration: 12, taskType: 'INSTALLATION' },
        { name: 'Kozijnen en beglazing', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Dakbedekking en isolatie', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Balkonhekwerk', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra stijgleidingen', duration: 10 },
        { name: 'Loodgieter stijgleidingen', duration: 10, depType: 'SS', lag: 3 },
        { name: 'CV-leidingwerk per woning', duration: 12 },
        { name: 'Ventilatie WTW units', duration: 8 },
        { name: 'Liftinstallatie', duration: 15 },
        { name: 'Intercom en toegang', duration: 5 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Binnenwanden stellen', duration: 10 },
        { name: 'Stucwerk', duration: 12 },
        { name: 'Tegelwerk', duration: 10 },
        { name: 'Dekvloeren', duration: 8 },
        { name: 'Binnendeuren', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Keukenopstelling', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk', duration: 10 },
        { name: 'Vloerafwerking', duration: 8 },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Terreinverharding', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Groenvoorziening', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Schoonmaak', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Vooroplevering woningen', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project5() {
  return buildProject({
    id: 'proj-brug-n279', name: 'Brugvervanging N279',
    description: 'Vervanging bestaande brug door nieuwe betonnen brug',
    startDate: '2026-04-01', endDate: '2027-04-01',
    author: 'Henk Mulder', company: 'Infra Nederland BV',
    phases: [
      { name: '1. Voorbereiding & Omleidingen', wbs: '1', taskType: 'LOGISTIC', children: [
        { name: 'Verkeersmaatregelen instellen', duration: 5, isCritical: true },
        { name: 'Tijdelijke omleidingsroute', duration: 8, isCritical: true },
        { name: 'Bouwplaats inrichten', duration: 5 },
        { name: 'Vaarbeperkingen instellen', duration: 3 },
        { name: 'Start werkzaamheden', milestone: true, isCritical: true },
      ]},
      { name: '2. Sloop oude brug', wbs: '2', taskType: 'DEMOLITION', children: [
        { name: 'Leidingen omleggen', duration: 8, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Asfalt verwijderen', duration: 3, isCritical: true },
        { name: 'Brugleuningen demonteren', duration: 3 },
        { name: 'Brugdek slopen', duration: 10, isCritical: true },
        { name: 'Landhoofden slopen', duration: 8, isCritical: true },
        { name: 'Puin afvoeren', duration: 5, taskType: 'LOGISTIC' },
      ]},
      { name: '3. Fundering nieuw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Damwanden slaan', duration: 10, isCritical: true },
        { name: 'Onderwaterbeton', duration: 8, isCritical: true },
        { name: 'Droogzetten bouwkuip', duration: 5 },
        { name: 'Paalfundering boren', duration: 12, isCritical: true },
        { name: 'Grondverbetering', duration: 5 },
      ]},
      { name: '4. Betonconstructie', wbs: '4', taskType: 'CONSTRUCTION', children: [
        { name: 'Landhoofd west wapenen en storten', duration: 15, isCritical: true },
        { name: 'Landhoofd oost wapenen en storten', duration: 15, depType: 'SS', lag: 5 },
        { name: 'Pijler midden storten', duration: 10, isCritical: true },
        { name: 'Prefab liggers plaatsen', duration: 8, isCritical: true },
        { name: 'Brugdek wapening', duration: 10 },
        { name: 'Brugdek storten', duration: 5, isCritical: true },
        { name: 'Uitharding beton', duration: 15 },
      ]},
      { name: '5. Afwerking', wbs: '5', children: [
        { name: 'Brugleuningen monteren', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Waterdichting brugdek', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Asfalt brugdek', duration: 3, taskType: 'CONSTRUCTION' },
        { name: 'Asfalt aansluitingen', duration: 5 },
        { name: 'Verlichting', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Geleiderail', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '6. Oplevering', wbs: '6', children: [
        { name: 'Proefbelasting', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Omleidingen opheffen', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Bouwplaats opruimen', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Openstelling brug', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project6() {
  return buildProject({
    id: 'proj-parkeergarage-utrecht', name: 'Parkeergarage Stationsplein Utrecht',
    description: 'Ondergrondse parkeergarage 3 lagen, 400 plaatsen',
    startDate: '2026-03-02', endDate: '2027-06-01',
    author: 'Robert Visser', company: 'Ondergronds Bouwen BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Kabels en leidingen verleggen', duration: 10, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Monitoring omgeving', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Verkeersmaatregelen', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Bouwkuip', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Diepwanden uitvoeren', duration: 20, isCritical: true },
        { name: 'Stempels niveau 1', duration: 8, isCritical: true },
        { name: 'Ontgraven laag 1', duration: 10, isCritical: true },
        { name: 'Stempels niveau 2', duration: 8 },
        { name: 'Ontgraven laag 2', duration: 10, isCritical: true },
        { name: 'Stempels niveau 3', duration: 8 },
        { name: 'Ontgraven laag 3', duration: 10 },
        { name: 'Onderwaterbeton vloer', duration: 8, isCritical: true },
        { name: 'Droogpompen', duration: 5 },
        { name: 'Bouwkuip droog', milestone: true, isCritical: true },
      ]},
      { name: '3. Betonconstructie', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Vloer niveau -3', duration: 10, isCritical: true },
        { name: 'Kolommen en wanden -3', duration: 8 },
        { name: 'Vloer niveau -2', duration: 10, isCritical: true },
        { name: 'Kolommen en wanden -2', duration: 8 },
        { name: 'Vloer niveau -1', duration: 10 },
        { name: 'Kolommen en wanden -1', duration: 8 },
        { name: 'Dek parkeergarage', duration: 12, isCritical: true },
        { name: 'Stempels verwijderen', duration: 8, taskType: 'DEMOLITION' },
        { name: 'Waterdichting', duration: 10 },
      ]},
      { name: '4. Installaties', wbs: '4', taskType: 'INSTALLATION', children: [
        { name: 'Elektra hoofdverdeling', duration: 8 },
        { name: 'Verlichting parkeerlagen', duration: 10 },
        { name: 'Ventilatie en CO-detectie', duration: 10 },
        { name: 'Sprinklerinstallatie', duration: 8 },
        { name: 'Parkeergeleiding systeem', duration: 5 },
        { name: 'Liftinstallatie', duration: 12 },
        { name: 'Brandmeldinstallatie', duration: 5 },
      ]},
      { name: '5. Afwerking', wbs: '5', taskType: 'CONSTRUCTION', children: [
        { name: 'Vloercoating aanbrengen', duration: 8 },
        { name: 'Belijning en bewegwijzering', duration: 5 },
        { name: 'Toegangscontrole slagbomen', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Nooduitgangen afwerken', duration: 5 },
      ]},
      { name: '6. Bovengronds herstel', wbs: '6', children: [
        { name: 'Plein opnieuw inrichten', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Bestrating en groen', duration: 8 },
        { name: 'Verkeersmaatregelen opheffen', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project7() {
  return buildProject({
    id: 'proj-industriehal-venlo', name: 'Industriehal Logistiek Venlo',
    description: 'Logistieke hal 10.000m2 met kantoorruimte',
    startDate: '2026-04-01', endDate: '2026-12-01',
    author: 'Kees van der Berg', company: 'Hallenbouw Limburg BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwterrein bouwrijp', duration: 5, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Riolering en nutsaansluitingen', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Grondverbetering', duration: 5, isCritical: true },
        { name: 'Funderingsstroken storten', duration: 10, isCritical: true },
        { name: 'Vloer op staal voorbereiden', duration: 8 },
      ]},
      { name: '3. Staalconstructie', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Staalkolommen plaatsen', duration: 8, isCritical: true },
        { name: 'Stalen spanten monteren', duration: 10, isCritical: true },
        { name: 'Gordingen en windverbanden', duration: 5 },
        { name: 'Kraanbaan installeren', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Dakplaten sandwichpanelen', duration: 10, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Gevelbeplating', duration: 12, taskType: 'INSTALLATION' },
        { name: 'Overheaddeuren', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Lichtstraten dak', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Vloer & Installaties', wbs: '5', children: [
        { name: 'Betonvloer hal storten', duration: 10, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Vloerafwerking coating', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Elektra-installatie hal', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Verlichting hal', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Brandmeldinstallatie', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '6. Kantoorgedeelte', wbs: '6', children: [
        { name: 'Kantoor binnenwanden', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Kantoor installaties', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Kantoor afwerking', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Sanitaire voorzieningen', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '7. Terrein & Oplevering', wbs: '7', children: [
        { name: 'Terreinverharding', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Terreinverlichting', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Hekwerk en poort', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project8() {
  return buildProject({
    id: 'proj-zorgcentrum', name: 'Zorgcentrum De Linde',
    description: 'Nieuwbouw zorgcentrum 60 kamers met behandelruimten',
    startDate: '2026-03-02', endDate: '2027-05-01',
    author: 'Linda de Groot', company: 'Zorgbouw Nederland BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Grondonderzoek aanvullend', duration: 3 },
        { name: 'Bomen kappen en verplanten', duration: 3, taskType: 'DEMOLITION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Heien funderingspalen', duration: 12, isCritical: true },
        { name: 'Funderingsbalken', duration: 8, isCritical: true },
        { name: 'Riolering en grondleidingen', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Begane grondvloer storten', duration: 8, isCritical: true },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond draagstructuur', duration: 12, isCritical: true },
        { name: 'Verdieping 1 beton', duration: 10, isCritical: true },
        { name: 'Verdieping 2 beton', duration: 10 },
        { name: 'Metselwerk gevels', duration: 15 },
        { name: 'Binnenwanden kalkzandsteen', duration: 10 },
        { name: 'Dakconstructie', duration: 10, isCritical: true },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Gevelisolatie en afwerking', duration: 12, taskType: 'INSTALLATION' },
        { name: 'Kozijnen en puien', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Dakisolatie en bedekking', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Dakranden en hemelwaterafvoer', duration: 5 },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra hoofdverdeling', duration: 8 },
        { name: 'Noodstroomvoorziening', duration: 5 },
        { name: 'Zuurstof en medische gassen', duration: 8 },
        { name: 'CV en koeling', duration: 10, depType: 'SS', lag: 3 },
        { name: 'Ventilatie met HEPA filters', duration: 10 },
        { name: 'Sprinkler en BMI', duration: 8 },
        { name: 'Liftinstallatie', duration: 15 },
        { name: 'Zuster-oproepsysteem', duration: 5 },
        { name: 'ICT bekabeling', duration: 8 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Scheidingswanden', duration: 8 },
        { name: 'Plafonds en wanden afwerken', duration: 10 },
        { name: 'Tegelwerk natte ruimten', duration: 8 },
        { name: 'Dekvloeren en vloerafwerking', duration: 8 },
        { name: 'Schilderwerk', duration: 10 },
        { name: 'Keukens en pantry', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Sanitair plaatsen', duration: 5, taskType: 'INSTALLATION' },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Buitenterrein aanleggen', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Inrichting kamers', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Testen installaties', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project9() {
  return buildProject({
    id: 'proj-riool-delft', name: 'Rioolvervanging Centrum Delft',
    description: 'Vervanging hoofdriool binnenstad inclusief herinrichting',
    startDate: '2026-05-04', endDate: '2026-10-01',
    author: 'Bas Hendriks', company: 'Delft Infra BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', taskType: 'LOGISTIC', children: [
        { name: 'Bewonersbrief en communicatie', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Verkeersmaatregelen', duration: 3, isCritical: true },
        { name: 'Kabels en leidingen lokaliseren', duration: 3 },
        { name: 'Start werkzaamheden', milestone: true, isCritical: true },
      ]},
      { name: '2. Fase 1 - Noordzijde', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Bestrating opbreken fase 1', duration: 5, taskType: 'DEMOLITION', isCritical: true },
        { name: 'Ontgraven sleuf fase 1', duration: 8, isCritical: true },
        { name: 'Rioolbuizen leggen fase 1', duration: 8, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Huisaansluitingen fase 1', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Aanvullen en verdichten fase 1', duration: 5 },
      ]},
      { name: '3. Fase 2 - Zuidzijde', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Bestrating opbreken fase 2', duration: 5, taskType: 'DEMOLITION', isCritical: true },
        { name: 'Ontgraven sleuf fase 2', duration: 8, isCritical: true },
        { name: 'Rioolbuizen leggen fase 2', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Huisaansluitingen fase 2', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Aanvullen en verdichten fase 2', duration: 5 },
      ]},
      { name: '4. Herinrichting', wbs: '4', taskType: 'CONSTRUCTION', children: [
        { name: 'Fundatie bestrating', duration: 5, isCritical: true },
        { name: 'Bestrating herleggen', duration: 8 },
        { name: 'Straatmeubilair plaatsen', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Groenvoorziening', duration: 3 },
      ]},
      { name: '5. Oplevering', wbs: '5', children: [
        { name: 'Inspectie riool camera', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Verkeersmaatregelen opheffen', duration: 2, taskType: 'LOGISTIC' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project10() {
  return buildProject({
    id: 'proj-villa-wassenaar', name: 'Villa Nieuwbouw Wassenaar',
    description: 'Vrijstaande luxe villa met zwembad en gastenverblijf',
    startDate: '2026-03-02', endDate: '2027-03-01',
    author: 'Thomas van Leeuwen', company: 'Exclusief Wonen BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwplaats inrichten', duration: 3, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Bomen beschermen', duration: 2, taskType: 'ATTENDANCE' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Grondwerk & Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Ontgraven zwembad', duration: 8 },
        { name: 'Funderingssleuven graven', duration: 5, isCritical: true },
        { name: 'Fundering storten', duration: 8, isCritical: true },
        { name: 'Riolering en drainage', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Kruipruimte opvullen', duration: 3 },
        { name: 'Begane grondvloer', duration: 5, isCritical: true },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond metselwerk', duration: 12, isCritical: true },
        { name: 'Verdiepingsvloer storten', duration: 5, isCritical: true },
        { name: 'Verdieping metselwerk', duration: 10, isCritical: true },
        { name: 'Dakconstructie hout', duration: 10, isCritical: true },
        { name: 'Dakpannen', duration: 5 },
        { name: 'Schoorstenen metsen', duration: 3 },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Gevelisolatie', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Kozijnen hardhouten', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Beglazing HR+++', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Zinken goten en HWA', duration: 5 },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra eerste fix', duration: 8 },
        { name: 'Loodgieter eerste fix', duration: 8, depType: 'SS', lag: 2 },
        { name: 'Vloerverwarming', duration: 8 },
        { name: 'Domotica systeem', duration: 5 },
        { name: 'Zwembadtechniek', duration: 10 },
        { name: 'Warmtepomp en bodem', duration: 8 },
        { name: 'Zonnepanelen', duration: 3 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Stucwerk wanden en plafonds', duration: 12 },
        { name: 'Tegelwerk badkamers luxe', duration: 10 },
        { name: 'Natuurstenen vloeren', duration: 8 },
        { name: 'Eiken trappen', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Maatwerk keuken', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk', duration: 10 },
        { name: 'Sanitair afmonteren', duration: 5, taskType: 'INSTALLATION' },
      ]},
      { name: '7. Buitenwerk & Oplevering', wbs: '7', children: [
        { name: 'Zwembad afbouwen', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Tuinaanleg', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Oprit en bestrating', duration: 5 },
        { name: 'Schoonmaak', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project11() {
  return buildProject({
    id: 'proj-sporthal-amstelveen', name: 'Sporthal Gemeente Amstelveen',
    description: 'Multifunctionele sporthal met 3 zalen en tribune',
    startDate: '2026-04-01', endDate: '2027-02-01',
    author: 'Erik Smit', company: 'Sportbouw Holland BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Grondwerk bouwrijp', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Heipalen slaan', duration: 10, isCritical: true },
        { name: 'Funderingsbalken', duration: 8, isCritical: true },
        { name: 'Vloer op palen begane grond', duration: 8 },
      ]},
      { name: '3. Constructie', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Staalconstructie spanten', duration: 15, isCritical: true },
        { name: 'Stalen kolommen', duration: 8, isCritical: true },
        { name: 'Tribuneconstructie beton', duration: 10 },
        { name: 'Dakliggers monteren', duration: 8, isCritical: true },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Dakplaten isolatie', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Dakbedekking bitumen', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Gevelpanelen', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Puien entree', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Sportvloer & Installaties', wbs: '5', children: [
        { name: 'Sportvloer onderbouw', duration: 10, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Sportvloer toplaag', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Sportverlichting', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Klimaatinstallatie', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Scoreborden en AV', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '6. Afbouw', wbs: '6', children: [
        { name: 'Kleedkamers afbouw', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Sanitair en douches', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Entreehal afwerking', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Belijning sportvelden', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Buitenterrein en parkeren', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Testen installaties', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project12() {
  return buildProject({
    id: 'proj-windturbine-offshore', name: 'Windturbine Fundatie Offshore',
    description: 'Monopile fundatie voor offshore windturbine 15MW',
    startDate: '2026-04-01', endDate: '2026-10-01',
    author: 'Freek de Wind', company: 'North Sea Energy BV',
    phases: [
      { name: '1. Fabricage & Voorbereiding', wbs: '1', children: [
        { name: 'Monopile fabricage controle', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Transition piece fabricage', duration: 10, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Mobilisatie installatievaartuig', duration: 8, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Zeebodemsurvey', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Transport monopile', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Start offshore', milestone: true, isCritical: true },
      ]},
      { name: '2. Zeebodem voorbereiding', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Zeebodem egaliseren', duration: 5, isCritical: true },
        { name: 'Scour protection laag 1', duration: 3, isCritical: true },
        { name: 'Weervenster bewaking', duration: 3, taskType: 'ATTENDANCE' },
      ]},
      { name: '3. Monopile installatie', wbs: '3', taskType: 'INSTALLATION', children: [
        { name: 'Monopile upenden', duration: 2, isCritical: true },
        { name: 'Monopile positioneren', duration: 2, isCritical: true },
        { name: 'Monopile heien', duration: 5, isCritical: true },
        { name: 'Vertikaliteit controle', duration: 1, taskType: 'ATTENDANCE' },
        { name: 'Transition piece plaatsen', duration: 3, isCritical: true },
        { name: 'Grouting', duration: 3, isCritical: true },
      ]},
      { name: '4. Afwerking', wbs: '4', children: [
        { name: 'Scour protection laag 2', duration: 3, taskType: 'CONSTRUCTION' },
        { name: 'J-tube installatie', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Platform en railing', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Kathodische bescherming', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Boatlanding monteren', duration: 3, taskType: 'INSTALLATION' },
      ]},
      { name: '5. Kabel & Oplevering', wbs: '5', children: [
        { name: 'Exportkabel pull-in', duration: 5, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Kabel aansluiting', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Inspectie en survey', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Demobilisatie', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Fundatie gereed', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project13() {
  return buildProject({
    id: 'proj-supermarkt-ah', name: 'Supermarkt Verbouwing Albert Heijn',
    description: 'Interne verbouwing en uitbreiding supermarkt',
    startDate: '2026-08-10', endDate: '2026-11-06',
    author: 'Anne Willems', company: 'Winkelbouw Express BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Winkel ontruimen', duration: 3, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Tijdelijke voorzieningen', duration: 2, taskType: 'INSTALLATION' },
        { name: 'Start verbouwing', milestone: true, isCritical: true },
      ]},
      { name: '2. Sloopwerk', wbs: '2', taskType: 'DEMOLITION', children: [
        { name: 'Bestaande inrichting slopen', duration: 5, isCritical: true },
        { name: 'Vloer uitbreken deels', duration: 3 },
        { name: 'Achtergevel openen uitbreiding', duration: 5, isCritical: true },
      ]},
      { name: '3. Uitbreiding', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Fundering uitbreiding', duration: 5, isCritical: true },
        { name: 'Staalconstructie uitbreiding', duration: 5, isCritical: true },
        { name: 'Dak en gevel uitbreiding', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Vloer uitbreiding', duration: 3 },
      ]},
      { name: '4. Installaties', wbs: '4', taskType: 'INSTALLATION', children: [
        { name: 'Koelinstallatie vernieuwen', duration: 8, isCritical: true },
        { name: 'Elektra uitbreiding', duration: 5 },
        { name: 'Ventilatie en airco', duration: 5 },
        { name: 'Brandmeldinstallatie', duration: 3 },
      ]},
      { name: '5. Afbouw & Inrichting', wbs: '5', children: [
        { name: 'Vloertegels leggen', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Plafonds en verlichting', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Stellingen en koelingen', duration: 5, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Kassa-eiland', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Vullen en inrichten', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Heropening', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project14() {
  return buildProject({
    id: 'proj-fietstunnel-arnhem', name: 'Fietstunnel Station Arnhem',
    description: 'Ondergrondse fietstunnel onder spooremplacement',
    startDate: '2026-03-02', endDate: '2026-12-01',
    author: 'Marian Bos', company: 'Tunnelbouw Oost BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Kabels en leidingen verleggen', duration: 8, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Treinvrije periodes plannen', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Damwanden plaatsen', duration: 10, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Bouwkuip', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Stempels plaatsen', duration: 5, isCritical: true },
        { name: 'Ontgraven fase 1', duration: 10, isCritical: true },
        { name: 'Ontgraven fase 2', duration: 8, isCritical: true },
        { name: 'Grondwater bemaling', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Onderwaterbeton', duration: 5, isCritical: true },
      ]},
      { name: '3. Tunnelconstructie', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Vloer tunnelbak', duration: 8, isCritical: true },
        { name: 'Wanden tunnelbak', duration: 10, isCritical: true },
        { name: 'Dak tunnelbak', duration: 8, isCritical: true },
        { name: 'Waterdichting', duration: 5 },
        { name: 'Terugvullen en verdichten', duration: 5, taskType: 'LOGISTIC' },
      ]},
      { name: '4. Toeritten', wbs: '4', taskType: 'CONSTRUCTION', children: [
        { name: 'Toerit noord betonwerk', duration: 8, isCritical: true },
        { name: 'Toerit zuid betonwerk', duration: 8, depType: 'SS', lag: 3 },
        { name: 'Hellingbaan fietspad', duration: 5 },
      ]},
      { name: '5. Installaties & Afwerking', wbs: '5', children: [
        { name: 'Verlichting tunnel', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Pompinstallatie', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Ventilatie', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Betegeling en wandafwerking', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Fietspad asfalt', duration: 3, taskType: 'CONSTRUCTION' },
        { name: 'Bewegwijzering', duration: 2, taskType: 'INSTALLATION' },
      ]},
      { name: '6. Oplevering', wbs: '6', children: [
        { name: 'Spoor herstellen', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Testen en keuren', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Openstelling tunnel', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project15() {
  return buildProject({
    id: 'proj-datacenter', name: 'Datacentrum Agriport A7',
    description: 'Datacenter 5000m2 met eigen energievoorziening',
    startDate: '2026-03-02', endDate: '2027-03-01',
    author: 'Vincent Kok', company: 'Digital Infrastructure BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Terrein bouwrijp maken', duration: 8, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Nutsaansluitingen 10kV', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Security hekwerk tijdelijk', duration: 3, taskType: 'INSTALLATION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Heien funderingspalen', duration: 10, isCritical: true },
        { name: 'Funderingsbalken', duration: 8, isCritical: true },
        { name: 'Vloer op palen storten', duration: 8 },
        { name: 'Kabelgoten in vloer', duration: 5, taskType: 'INSTALLATION' },
      ]},
      { name: '3. Constructie', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Prefab betonwanden', duration: 12, isCritical: true },
        { name: 'Staalconstructie dak', duration: 8, isCritical: true },
        { name: 'Dakpanelen sandwich', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Verhoogde computervloer', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Waterdicht', wbs: '4', children: [
        { name: 'Gevelisolatie en beplating', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Laadperrons en deuren', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Waterdichting dak', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Elektra & Koeling', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Transformatoren 10kV', duration: 8, isCritical: true },
        { name: 'UPS systemen', duration: 10, isCritical: true },
        { name: 'Noodstroomgeneratoren', duration: 8 },
        { name: 'Hoofdverdeling en PDU', duration: 10 },
        { name: 'Koelmachines', duration: 10, isCritical: true },
        { name: 'CRAH units datahallen', duration: 8 },
        { name: 'Koeltorens buiten', duration: 8 },
      ]},
      { name: '6. ICT & Beveiliging', wbs: '6', taskType: 'INSTALLATION', children: [
        { name: 'Glasvezel inkomend', duration: 5 },
        { name: 'Patchpanelen en bekabeling', duration: 8 },
        { name: 'Brandblussysteem gas', duration: 5 },
        { name: 'Toegangscontrole biometrisch', duration: 5 },
        { name: 'CCTV systeem', duration: 5 },
        { name: 'BMS monitoring', duration: 5 },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Testen failover scenario', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Terreinafwerking', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Certificering Tier III', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project16() {
  return buildProject({
    id: 'proj-dijk-markermeerdijk', name: 'Dijk Versterking Markermeerdijk',
    description: 'Dijkversterking 5km traject Hoorn-Amsterdam',
    startDate: '2026-03-02', endDate: '2027-09-01',
    author: 'Dirk Waterschap', company: 'Waterbouw Holland BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Ecologisch onderzoek', duration: 10, taskType: 'ATTENDANCE', isCritical: true },
        { name: 'Vergunningen waterbeheer', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Grondaankoop afronden', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Bouwwegen aanleggen', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Depots inrichten', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Start werkzaamheden', milestone: true, isCritical: true },
      ]},
      { name: '2. Voorbelasting', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Grond aanvoeren depot', duration: 15, taskType: 'LOGISTIC', isCritical: true },
        { name: 'Voorbelasting km 0-1', duration: 10, isCritical: true },
        { name: 'Voorbelasting km 1-2', duration: 10, depType: 'SS', lag: 5 },
        { name: 'Voorbelasting km 2-3', duration: 10 },
        { name: 'Zettingsperiode afwachten', duration: 20, isCritical: true },
        { name: 'Monitoring zettingen', duration: 20, taskType: 'ATTENDANCE', depType: 'SS' },
      ]},
      { name: '3. Grondlichaam', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Voorbelasting verwijderen', duration: 10, isCritical: true },
        { name: 'Geotextiel aanbrengen', duration: 8 },
        { name: 'Kleilaag kern opbouwen km 0-2', duration: 15, isCritical: true },
        { name: 'Kleilaag kern opbouwen km 2-5', duration: 15 },
        { name: 'Zandkern aanbrengen', duration: 12 },
        { name: 'Profielcontrole inmeten', duration: 5, taskType: 'ATTENDANCE' },
      ]},
      { name: '4. Bekleding & Erosiebescherming', wbs: '4', children: [
        { name: 'Steenzetting binnentalud', duration: 12, taskType: 'CONSTRUCTION' },
        { name: 'Grasmat buitentalud', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Teenconstructie waterzijde', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Kreukelberm storten', duration: 8, taskType: 'CONSTRUCTION' },
      ]},
      { name: '5. Kunstwerken', wbs: '5', taskType: 'CONSTRUCTION', children: [
        { name: 'Duiker renovatie', duration: 10 },
        { name: 'Gemaal aanpassen', duration: 8, taskType: 'RENOVATION' },
        { name: 'Keersluis onderhoud', duration: 5, taskType: 'MAINTENANCE' },
        { name: 'Trappen en overgangen', duration: 8 },
      ]},
      { name: '6. Afwerking & Herstel', wbs: '6', children: [
        { name: 'Dijkweg herstellen', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Fietspad aanleggen', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Ecologisch herstel', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Hekwerk en bebording', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Oplevering', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project17() {
  return buildProject({
    id: 'proj-hotel-scheveningen', name: 'Hotel 120 Kamers Scheveningen',
    description: 'Nieuwbouw 6-laags hotel aan boulevard met wellness',
    startDate: '2026-03-02', endDate: '2027-07-01',
    author: 'Chantal Zee', company: 'Kustbouw BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Sloop bestaand pand', duration: 10, taskType: 'DEMOLITION', isCritical: true },
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Funderingsonderzoek', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Start nieuwbouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Damwanden boulevard', duration: 10, isCritical: true },
        { name: 'Ontgraven kelder', duration: 8, isCritical: true },
        { name: 'Funderingspalen', duration: 12, isCritical: true },
        { name: 'Keldervloer wellness', duration: 8 },
        { name: 'Kelderwanden', duration: 8 },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond lobby', duration: 10, isCritical: true },
        { name: 'Verdieping 1 kamers', duration: 8, isCritical: true },
        { name: 'Verdieping 2 kamers', duration: 8 },
        { name: 'Verdieping 3 kamers', duration: 8 },
        { name: 'Verdieping 4 kamers', duration: 8 },
        { name: 'Verdieping 5 kamers', duration: 8 },
        { name: 'Penthouse verdieping', duration: 10 },
        { name: 'Dakterras constructie', duration: 8 },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel', wbs: '4', taskType: 'INSTALLATION', children: [
        { name: 'Vliesgevel zeezijde', duration: 12, isCritical: true },
        { name: 'Vliesgevel landzijde', duration: 10 },
        { name: 'Gevelbekleding natuursteen', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Kozijnen en beglazing', duration: 8 },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra hoofdverdeling', duration: 8 },
        { name: 'Stijgleidingen alle media', duration: 12 },
        { name: 'VRF klimaatsysteem', duration: 10, depType: 'SS', lag: 5 },
        { name: 'Ventilatie en luchtbehandeling', duration: 10 },
        { name: 'Liftinstallatie 2x', duration: 15 },
        { name: 'Sprinkler en BMI', duration: 8 },
        { name: 'Wellness installaties', duration: 10 },
        { name: 'Hotelautomatisering', duration: 5 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Kamerwanden prefab', duration: 12 },
        { name: 'Badkamer prefab units', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Dekvloeren en tapijt', duration: 8 },
        { name: 'Lobby afwerking luxe', duration: 10 },
        { name: 'Restaurant keuken', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk', duration: 10 },
        { name: 'Inrichting kamers', duration: 10, taskType: 'LOGISTIC' },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Dakterras afwerken', duration: 5, taskType: 'CONSTRUCTION' },
        { name: 'Buitenterrein boulevard', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Testen en inregelen', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Oplevering hotel', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project18() {
  return buildProject({
    id: 'proj-station-breda', name: 'Treinstation Uitbreiding Breda',
    description: 'Uitbreiding stationshal en extra perron met onderdoorgang',
    startDate: '2026-02-02', endDate: '2027-10-01',
    author: 'Willem Spoor', company: 'Stationsbouw BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Fasering treinverkeer', duration: 5, taskType: 'ATTENDANCE', isCritical: true },
        { name: 'Tijdelijke perronvoorziening', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Kabels en leidingen spoor', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Bouwplaats inrichten', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Start werkzaamheden', milestone: true, isCritical: true },
      ]},
      { name: '2. Onderdoorgang', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Damwanden tunnel', duration: 12, isCritical: true },
        { name: 'Buitendienststelling weekend 1', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Ontgraven tunnelbak', duration: 10, isCritical: true },
        { name: 'Tunnelvloer storten', duration: 8, isCritical: true },
        { name: 'Tunnelwanden storten', duration: 10, isCritical: true },
        { name: 'Tunneldak prefab leggen', duration: 5, isCritical: true },
        { name: 'Buitendienststelling weekend 2', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Waterdichting tunnel', duration: 8 },
        { name: 'Terugvullen boven tunnel', duration: 5, taskType: 'LOGISTIC' },
      ]},
      { name: '3. Perronconstructie', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Perronranden prefab', duration: 8, isCritical: true },
        { name: 'Perronopvulling', duration: 5 },
        { name: 'Perrontegels leggen', duration: 8 },
        { name: 'Overkapping staal', duration: 10, isCritical: true },
        { name: 'Overkapping glas', duration: 8 },
        { name: 'Trappen en liften plaatsen', duration: 10, taskType: 'INSTALLATION' },
      ]},
      { name: '4. Stationshal uitbreiding', wbs: '4', taskType: 'CONSTRUCTION', children: [
        { name: 'Staalconstructie hal', duration: 12, isCritical: true },
        { name: 'Gevel en dak glas', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Vloeren natuursteen', duration: 8 },
        { name: 'Winkelpuien', duration: 5, taskType: 'INSTALLATION' },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra en verlichting perron', duration: 8 },
        { name: 'Reizigersinformatie systemen', duration: 5 },
        { name: 'Roltrappen installeren', duration: 10 },
        { name: 'Geluidsinstallatie omroep', duration: 3 },
        { name: 'CCTV en veiligheid', duration: 5 },
        { name: 'Klimaatinstallatie hal', duration: 8 },
      ]},
      { name: '6. Spoor & Afwerking', wbs: '6', children: [
        { name: 'Spoor nieuw perron leggen', duration: 10, taskType: 'CONSTRUCTION' },
        { name: 'Bovenleidingportalen', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Bovenleiding rijden', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Seinen en beveiliging', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk en afwerking', duration: 8, taskType: 'CONSTRUCTION' },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Proefbedrijf perron', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Tijdelijke voorzieningen slopen', duration: 5, taskType: 'DEMOLITION' },
        { name: 'Ingebruikname station', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project19() {
  return buildProject({
    id: 'proj-ikc-school', name: 'Basisschool Nieuwbouw IKC',
    description: 'Integraal kindcentrum met school, BSO en kinderopvang',
    startDate: '2026-03-02', endDate: '2027-03-01',
    author: 'Femke Onderwijs', company: 'Scholenbouw West BV',
    phases: [
      { name: '1. Voorbereiding', wbs: '1', children: [
        { name: 'Bouwterrein klaarmaken', duration: 5, taskType: 'CONSTRUCTION', isCritical: true },
        { name: 'Bouwplaats inrichten', duration: 3, taskType: 'LOGISTIC' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Heien funderingspalen', duration: 10, isCritical: true },
        { name: 'Funderingsbalken en poeren', duration: 8, isCritical: true },
        { name: 'Riolering onder vloer', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Begane grondvloer storten', duration: 5, isCritical: true },
      ]},
      { name: '3. Ruwbouw', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Begane grond metselwerk', duration: 12, isCritical: true },
        { name: 'Verdiepingsvloer prefab', duration: 5, isCritical: true },
        { name: 'Verdieping metselwerk', duration: 10 },
        { name: 'CLT dakconstructie', duration: 8, isCritical: true },
        { name: 'Dakbedekking EPDM', duration: 5 },
        { name: 'Sedum dak aanleggen', duration: 3 },
        { name: 'Hoogste punt', milestone: true, isCritical: true },
      ]},
      { name: '4. Gevel & Dak', wbs: '4', children: [
        { name: 'Gevelisolatie ETICS', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Kozijnen aluminium', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Gevelafwerking baksteen strips', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Zonnepanelen dak', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Wind- en waterdicht', milestone: true, isCritical: true },
      ]},
      { name: '5. Installaties', wbs: '5', taskType: 'INSTALLATION', children: [
        { name: 'Elektra en data', duration: 8 },
        { name: 'Warmtepomp lucht-water', duration: 5 },
        { name: 'Vloerverwarming', duration: 8, depType: 'SS', lag: 2 },
        { name: 'Ventilatie CO2-gestuurd', duration: 8 },
        { name: 'Sanitair leidingwerk', duration: 5 },
        { name: 'Brandmeld en ontruiming', duration: 3 },
      ]},
      { name: '6. Afbouw', wbs: '6', taskType: 'CONSTRUCTION', children: [
        { name: 'Binnenwanden metal stud', duration: 8 },
        { name: 'Plafonds akoestisch', duration: 5 },
        { name: 'Dekvloeren', duration: 5 },
        { name: 'Tegelwerk sanitair', duration: 5 },
        { name: 'Schilderwerk', duration: 8 },
        { name: 'Vloerafwerking linoleum', duration: 5 },
        { name: 'Buitenspeelplaats', duration: 8, taskType: 'CONSTRUCTION' },
      ]},
      { name: '7. Oplevering', wbs: '7', children: [
        { name: 'Inrichting lokalen', duration: 5, taskType: 'LOGISTIC' },
        { name: 'Testen en inregelen', duration: 3, taskType: 'ATTENDANCE' },
        { name: 'Oplevering IKC', milestone: true, isCritical: true },
      ]},
    ]
  });
}

function project20() {
  return buildProject({
    id: 'proj-woonwijk-almere', name: 'Woonwijk 60 Woningen Almere',
    description: 'Nieuwbouw woonwijk met 40 rijwoningen en 20 twee-onder-een-kap',
    startDate: '2026-02-02', endDate: '2028-02-01',
    author: 'Gerrit Nieuwland', company: 'Woningbouw Flevoland BV',
    phases: [
      { name: '1. Bouwrijp maken', wbs: '1', children: [
        { name: 'Terrein ontruimen en egaliseren', duration: 8, taskType: 'DEMOLITION', isCritical: true },
        { name: 'Hoofdriolering aanleggen', duration: 12, taskType: 'INSTALLATION', isCritical: true },
        { name: 'Nutsvoorzieningen hoofdleiding', duration: 10, taskType: 'INSTALLATION' },
        { name: 'Bouwwegen aanleggen', duration: 8, taskType: 'CONSTRUCTION' },
        { name: 'Start bouw', milestone: true, isCritical: true },
      ]},
      { name: '2. Fundering Fase 1 (blok 1-3)', wbs: '2', taskType: 'CONSTRUCTION', children: [
        { name: 'Heien blok 1 (10 rijwoningen)', duration: 8, isCritical: true },
        { name: 'Heien blok 2 (10 rijwoningen)', duration: 8 },
        { name: 'Heien blok 3 (10 rijwoningen)', duration: 8, depType: 'SS', lag: 3 },
        { name: 'Funderingsbalken blok 1-3', duration: 10, isCritical: true },
        { name: 'Begane grondvloer blok 1-3', duration: 10 },
      ]},
      { name: '3. Fundering Fase 2 (blok 4-5)', wbs: '3', taskType: 'CONSTRUCTION', children: [
        { name: 'Heien blok 4 (10 rijwoningen)', duration: 8 },
        { name: 'Heien blok 5 (10 2-1-kap)', duration: 8, depType: 'SS', lag: 3 },
        { name: 'Funderingsbalken blok 4-5', duration: 8 },
        { name: 'Begane grondvloer blok 4-5', duration: 8 },
      ]},
      { name: '4. Ruwbouw Fase 1', wbs: '4', taskType: 'CONSTRUCTION', children: [
        { name: 'Metselwerk BG blok 1-3', duration: 15, isCritical: true },
        { name: 'Verdiepingsvloer blok 1-3', duration: 10, isCritical: true },
        { name: 'Metselwerk verdieping blok 1-3', duration: 15 },
        { name: 'Kapconstructie blok 1-3', duration: 12, isCritical: true },
        { name: 'Dakpannen blok 1-3', duration: 10 },
        { name: 'Hoogste punt fase 1', milestone: true, isCritical: true },
      ]},
      { name: '5. Ruwbouw Fase 2', wbs: '5', taskType: 'CONSTRUCTION', children: [
        { name: 'Metselwerk BG blok 4-5', duration: 15 },
        { name: 'Verdiepingsvloer blok 4-5', duration: 8 },
        { name: 'Metselwerk verdieping blok 4-5', duration: 12 },
        { name: 'Kapconstructie blok 4-5', duration: 10 },
        { name: 'Dakpannen blok 4-5', duration: 8 },
        { name: 'Hoogste punt fase 2', milestone: true },
      ]},
      { name: '6. Gevels & Daken', wbs: '6', taskType: 'INSTALLATION', children: [
        { name: 'Kozijnen blok 1-3', duration: 10, isCritical: true },
        { name: 'Kozijnen blok 4-5', duration: 8 },
        { name: 'Geveldichting en isolatie', duration: 12 },
        { name: 'Dakgoten en HWA', duration: 8 },
        { name: 'Wind- en waterdicht alle blokken', milestone: true, isCritical: true },
      ]},
      { name: '7. Installaties', wbs: '7', taskType: 'INSTALLATION', children: [
        { name: 'Elektra blok 1-3', duration: 12 },
        { name: 'Elektra blok 4-5', duration: 8, depType: 'SS', lag: 5 },
        { name: 'Loodgieter blok 1-3', duration: 10 },
        { name: 'Loodgieter blok 4-5', duration: 8 },
        { name: 'Warmtepompen alle woningen', duration: 15 },
        { name: 'Ventilatie WTW units', duration: 10 },
      ]},
      { name: '8. Afbouw Fase 1', wbs: '8', taskType: 'CONSTRUCTION', children: [
        { name: 'Stucwerk blok 1-3', duration: 15 },
        { name: 'Tegelwerk blok 1-3', duration: 10 },
        { name: 'Keukens blok 1-3', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk blok 1-3', duration: 10 },
        { name: 'Vloerafwerking blok 1-3', duration: 8 },
      ]},
      { name: '9. Afbouw Fase 2', wbs: '9', taskType: 'CONSTRUCTION', children: [
        { name: 'Stucwerk blok 4-5', duration: 12 },
        { name: 'Tegelwerk blok 4-5', duration: 8 },
        { name: 'Keukens blok 4-5', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Schilderwerk blok 4-5', duration: 8 },
        { name: 'Vloerafwerking blok 4-5', duration: 5 },
      ]},
      { name: '10. Woonrijp maken', wbs: '10', taskType: 'CONSTRUCTION', children: [
        { name: 'Definitieve riolering aansluiten', duration: 8, taskType: 'INSTALLATION' },
        { name: 'Straatwerk en trottoirs', duration: 15, isCritical: true },
        { name: 'Parkeerplaatsen aanleggen', duration: 8 },
        { name: 'Groenvoorziening en bomen', duration: 10 },
        { name: 'Speelvoorzieningen', duration: 5, taskType: 'INSTALLATION' },
        { name: 'Straatverlichting', duration: 5, taskType: 'INSTALLATION' },
      ]},
      { name: '11. Oplevering', wbs: '11', children: [
        { name: 'Vooroplevering fase 1', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Vooroplevering fase 2', duration: 5, taskType: 'ATTENDANCE' },
        { name: 'Oplevering woningen', duration: 10, taskType: 'ATTENDANCE' },
        { name: 'Woonwijk gereed', milestone: true, isCritical: true },
      ]},
    ]
  });
}

// ============================================================
// MAIN: Generate all 20 IFC files
// ============================================================

const outDir = path.join(__dirname, '..', 'examples');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const projects = [
  project1, project2, project3, project4, project5,
  project6, project7, project8, project9, project10,
  project11, project12, project13, project14, project15,
  project16, project17, project18, project19, project20,
];

const filenames = [
  '01-grachtenpand-amsterdam',
  '02-renovatie-basisschool',
  '03-kantoorgebouw-zuidas',
  '04-appartementen-eindhoven',
  '05-brugvervanging-n279',
  '06-parkeergarage-utrecht',
  '07-industriehal-venlo',
  '08-zorgcentrum-de-linde',
  '09-rioolvervanging-delft',
  '10-villa-wassenaar',
  '11-sporthal-amstelveen',
  '12-windturbine-offshore',
  '13-supermarkt-albert-heijn',
  '14-fietstunnel-arnhem',
  '15-datacentrum-agriport',
  '16-dijkversterking-markermeerdijk',
  '17-hotel-scheveningen',
  '18-station-uitbreiding-breda',
  '19-basisschool-ikc',
  '20-woonwijk-almere',
];

const calendar = defaultCalendar();

for (let i = 0; i < projects.length; i++) {
  const { project, tasks, sequences } = projects[i]();
  const ifcContent = writeIFC(project, calendar, tasks, sequences);
  const filename = `${filenames[i]}.ifc`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, ifcContent, 'utf-8');
  console.log(`Written: ${filename} (${tasks.length} tasks, ${sequences.length} sequences)`);
}

console.log(`\nDone! Generated ${projects.length} IFC files in examples/`);
