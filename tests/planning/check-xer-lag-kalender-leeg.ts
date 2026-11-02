// Lege lagkalender (eigenaar, 2026-10-29, wiki "XER fase 2", punt A). Staat in een SCHEDOPTIONS-rij niet welke
// kalender een lag gebruikt, dan telt de lag op de kalender van de opvolger, zoals de documentatie van P6
// zegt. Een bekend token blijft gewoon gelden, een bestand zonder SCHEDOPTIONS-rij houdt de profielstandaard.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { writeXER } from '@/services/xer/xerWriter';
import { isMultiDocumentImport } from '@/services/importTypes';
import { createDefaultProject } from '@/state/defaults';
import { payloadFromImport } from '@/state/documentContract';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';

declare const process: { exit(code: number): never };

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

const calendar = (id: string, workDays: number[]): WorkCalendar => ({
  id, name: id, description: '', workDays, workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
});
const predCal = calendar('Voorganger', [1, 2, 3, 4, 5]);
const succCal = calendar('Opvolger', [1, 2, 3, 4, 5, 6]);
const task = (name: string, calendarId: string): Task => ({
  id: name, name, description: '', wbsCode: name, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
  priority: 500, parentId: null, childIds: [], resourceIds: [], calendarId, time: createDefaultTaskTime('2026-06-05', 1),
});
const sequence: Sequence = { id: 'R', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: 1, lagMinutes: 480 };
const project = { ...createDefaultProject(), startDate: '2026-06-05', statusDate: '2026-06-05' };
const written = writeXER({
  project, calendar: predCal, calendars: [predCal, succCal], tasks: [task('A', 'Voorganger'), task('B', 'Opvolger')],
  sequences: [sequence], resources: [], assignments: [], exportDate: '2026-10-20',
});

const FIELD = 'sched_calendar_on_relationship_lag';
/** De XER-tekst met een andere waarde in het lagveld; `null` haalt de hele SCHEDOPTIONS-tabel weg. */
function withField(value: string | null): Uint8Array {
  const out: string[] = [];
  let fields: string[] = [];
  let table = '';
  for (const line of written.text.split('\r\n')) {
    if (line.startsWith('%T\t')) table = line.slice(3);
    if (table === 'SCHEDOPTIONS' && value === null) continue;
    if (table === 'SCHEDOPTIONS' && line.startsWith('%F\t')) fields = line.split('\t');
    if (table === 'SCHEDOPTIONS' && line.startsWith('%R\t')) {
      const cells = line.split('\t');
      cells[fields.indexOf(FIELD)] = value!;
      out.push(cells.join('\t'));
    } else out.push(line);
  }
  return new TextEncoder().encode(out.join('\r\n'));
}
function open(bytes: Uint8Array): XerReadResult {
  const parsed = readXER(bytes);
  if (isMultiDocumentImport(parsed)) throw new Error('meerdere projecten');
  return parsed;
}
function startOfB(read: XerReadResult): string | undefined {
  const doc = payloadFromImport(read, null);
  const solved = solveProject(solveInputFor(doc.project, doc.tasks, doc.sequences, doc.calendar, doc.calendars));
  return solved.tasks.get(doc.tasks.find(t => t.name === 'B')!.id)?.earlyStart;
}

const empty = open(withField(''));
const unknown = open(withField('RCAL_ONBEKEND'));
const predecessor = open(withField('RCAL_PREDECESSOR'));
const successor = open(withField('RCAL_SUCCESSOR'));
const noRow = open(withField(null));
eq('leeg veld: de opvolger', empty.project.schedulingOptions?.lagCalendar, 'successor');
eq('onbekend token: de opvolger', unknown.project.schedulingOptions?.lagCalendar, 'successor');
eq('onbekend token: gemeld met de echte terugval', unknown.xer.scheduleOptions.fallbacks
  .filter(f => f.field === FIELD).map(f => [f.token, f.fallback]), [['RCAL_ONBEKEND', 'successor']]);
eq('leeg veld: geen terugvalmelding, zoals de andere velden', empty.xer.scheduleOptions.fallbacks.filter(f => f.field === FIELD), []);
eq('bekend token: voorganger blijft', predecessor.project.schedulingOptions?.lagCalendar, 'predecessor');
eq('bekend token: opvolger blijft', successor.project.schedulingOptions?.lagCalendar, 'successor');
eq('geen SCHEDOPTIONS-rij: de profielstandaard', noRow.project.schedulingOptions?.lagCalendar, 'predecessor');
// A eindigt vrijdag 16:00. Een dag lag telt op de opvolgerkalender de zaterdag mee, op de voorgangerkalender niet.
eq('de rekening: voorganger slaat het weekend over', startOfB(predecessor), '2026-06-09T08:00');
eq('de rekening: opvolger telt de zaterdag', startOfB(successor), '2026-06-08T08:00');
eq('de rekening: leeg veld rekent als opvolger', startOfB(empty), startOfB(successor));

if (diffs.length === 0) {
  console.log(`OK  xer-lag-kalender-leeg: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  xer-lag-kalender-leeg: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
