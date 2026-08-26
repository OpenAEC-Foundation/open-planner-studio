import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * X7-dossierorakel: leest uitsluitend de ruwe XER-%T/%F/%R-grammatica. Er is
 * bewust geen import uit src/: dit telt en controleert P6-bronfeiten, niet de
 * productiereader of diens mapping.
 */
type RawTask = Record<string, string>;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? files(full) : entry.name.toLowerCase().endsWith('.xer') ? [full] : [];
  });
}

function rawTasks(file: string): RawTask[] {
  let table = '';
  let fields: string[] = [];
  const tasks: RawTask[] = [];
  for (const line of readFileSync(file, 'latin1').split(/\r?\n/)) {
    const cells = line.split('\t');
    if (cells[0] === '%T') { table = cells[1] ?? ''; fields = []; }
    else if (table === 'TASK' && cells[0] === '%F') fields = cells.slice(1);
    else if (table === 'TASK' && cells[0] === '%R') {
      tasks.push(Object.fromEntries(fields.map((field, index) => [field, cells[index + 1] ?? ''])));
    }
  }
  return tasks;
}

function equal(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  XER-X7-dossier: corpus niet aanwezig; onafhankelijk orakel structureel gecontroleerd');
} else if (!existsSync(root)) {
  throw new Error('OPS_XER_CORPUS bestaat niet');
} else {
  const tasks = files(root).flatMap(rawTasks);
  const counts = {
    suspend: 0, resume: 0, expectedFinish: 0,
    suspendWithClock: 0, resumeWithClock: 0, expectedFinishWithClock: 0,
    validPairs: 0, stopOnly: 0, reversed: 0,
    CP_Drtn: 0, CP_Phys: 0, CP_Units: 0,
  };
  const hasClock = (value: string): boolean => /(?:\s|T)\d{1,2}:\d{2}/.test(value);
  for (const task of tasks) {
    const stop = task.suspend_date;
    const resume = task.resume_date;
    const expectedFinish = task.expect_end_date;
    if (stop) { counts.suspend++; if (hasClock(stop)) counts.suspendWithClock++; }
    if (resume) { counts.resume++; if (hasClock(resume)) counts.resumeWithClock++; }
    if (expectedFinish) {
      counts.expectedFinish++;
      if (hasClock(expectedFinish)) counts.expectedFinishWithClock++;
    }
    if (stop && resume) {
      if (stop <= resume) counts.validPairs++;
      else counts.reversed++;
    } else if (stop) counts.stopOnly++;
    if (task.complete_pct_type === 'CP_Drtn') counts.CP_Drtn++;
    if (task.complete_pct_type === 'CP_Phys') counts.CP_Phys++;
    if (task.complete_pct_type === 'CP_Units') counts.CP_Units++;
  }
  // De publieke 93 files bevatten exact 22 suspendvelden: twintig geldige
  // paren en twee stop-only records. Deze telling komt uit de ruwe TASK-rijen,
  // dus niet uit een door de reader afgeleide projectselectie.
  equal('onafhankelijk P6-X7-telling', counts, {
    suspend: 22, resume: 20, expectedFinish: 246,
    suspendWithClock: 20, resumeWithClock: 19, expectedFinishWithClock: 246,
    validPairs: 20, stopOnly: 2, reversed: 0,
    CP_Drtn: 16813, CP_Phys: 1492, CP_Units: 8,
  });

  const torture = files(root).find(file => file.endsWith('/p6_torture_test_v1.xer'));
  if (!torture) throw new Error('P6-torture-dossier ontbreekt');
  const byId = new Map(rawTasks(torture).map(task => [task.task_id, task]));
  equal('P6 CP_Phys bewaart resterende duur als bronfeit', byId.get('A4200') && {
    type: byId.get('A4200')?.complete_pct_type, percent: byId.get('A4200')?.phys_complete_pct, remaining: byId.get('A4200')?.remain_drtn_hr_cnt,
  }, { type: 'CP_Phys', percent: '35', remaining: '120' });
  equal('P6 suspend zonder resume blijft bronfeit maar geen paar', byId.get('A4210') && {
    stop: byId.get('A4210')?.suspend_date, resume: byId.get('A4210')?.resume_date,
  }, { stop: '2026-02-27', resume: '' });
  equal('P6 out-of-sequence-dossier bevat chronologisch suspend/resume-paar', byId.get('A4230') && {
    stop: byId.get('A4230')?.suspend_date, resume: byId.get('A4230')?.resume_date, type: byId.get('A4230')?.complete_pct_type,
  }, { stop: '2026-02-19', resume: '2026-03-09', type: 'CP_Drtn' });
  console.log('OK  XER-X7-dossier: onafhankelijke %T/%F/%R-telling en P6-torture-bronfeiten groen');
}
