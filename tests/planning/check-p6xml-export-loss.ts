// P6 XML-export en -opening, fase 2 van #690 (eigenaar, 2026-10-29). De verliesmelding na export heeft dezelfde vorm
// als bij XER, met de regels van dit formaat. Elke verliescategorie van de detector voor P6 XML geeft een regel.
// Ook: een mijlpaal mét duur blijft een activiteit, *Projectstandaard* blijft staan, en openen meldt het OPS-profiel.
//
// Draait via run.sh. Exit 0 = alles groen.
import { installDOMParser } from './xmldom-shim';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { detectXerExportLoss } from '@/services/xerExportLoss';
import { exportP6XmlLossNotice, type P6XmlLossInput } from '@/state/p6XmlExportNotice';
import { withP6XmlProfileNotice } from '@/state/schedulingProfileNotice';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createDefaultProject } from '@/state/defaults';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { activeImportResult, type ImportResult, type OpenedImport } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import type { Resource } from '@/types/resource';

declare const process: { exit(code: number): never };

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
installDOMParser();

const X = 'notifications.exportXerLossItem.';
const P = 'notifications.exportP6XmlLossItem.';
const p6 = builtInProfile('p6');
const calendar: WorkCalendar = {
  id: 'cal', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const task = (name: string, extra: Partial<Task> = {}, time: Partial<Task['time']> = {}): Task => ({
  id: name, name, description: '', wbsCode: name, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
  priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime('2026-06-01', 3), ...time }, ...extra,
});
const input = (extra: Partial<P6XmlLossInput> = {}): P6XmlLossInput => ({
  project: { schedulingProfile: p6 }, calendars: [calendar], tasks: [task('Gewoon')], sequences: [], resources: [], assignments: [],
  baselineCount: 0, ...extra,
});
/** De regels van één invoer, als `sleutel:aantal`. */
const lines = (value: P6XmlLossInput, categories: Parameters<typeof exportP6XmlLossNotice>[1] = []) =>
  exportP6XmlLossNotice(value, categories)?.detailLines?.map(l => `${l.messageKey}${l.params ? `:${l.params.count}` : ''}`) ?? [];
const one = (label: string, value: Partial<P6XmlLossInput>, want: string[]) => eq(label, lines(input(value)), want);

eq('niets verloren: geen melding', exportP6XmlLossNotice(input()), null);
const head = exportP6XmlLossNotice(input({ baselineCount: 1 }));
eq('kop, duur en soort', [head?.messageKey, head?.severity, head?.durationMs], ['notifications.exportP6XmlLoss', 'info', 15000]);
one('baseline', { baselineCount: 2 }, [`${P}baselines:2`]);
eq('OPS-profiel: het advies, geen tweede regel', lines(input({ project: {} }), ['schedule-options-and-provenance']), [`${X}schedulingRules`]);
eq('P6-profiel: de rekeninstellingen gaan niet mee', lines(input(), ['schedule-options-and-provenance']), [`${P}schedulingOptions`]);

const summary = task('Fase', { isSummary: true, childIds: ['Kind'], description: 'Tekst', constraint: { type: 'SNET', date: '2026-06-02' }, constraint2: { type: 'FNLT', date: '2026-06-09' } } as Partial<Task>);
const kind = task('Kind', { parentId: 'Fase', description: 'Gaat mee' });
const seq = (id: string, extra: Partial<Sequence>): Sequence => ({ id, predecessorId: 'Gewoon', successorId: 'Kind', type: 'FINISH_START', lagDays: 0, ...extra });
one('samenvattingstaak', { tasks: [summary, kind, task('Gewoon')], sequences: [seq('s', { predecessorId: 'Fase' })],
  assignments: [{ id: 'a', taskId: 'Fase', resourceId: 'r' }] as unknown as P6XmlLossInput['assignments'] },
[`${P}summaryRelations:1`, `${X}summaryAssignments:1`, `${X}summaryConstraints:2`, `${X}taskDescriptions:1`]);
one('lags', { sequences: [seq('p', { lagPercent: 50 }), seq('e', { lagUnit: 'ELAPSEDTIME' })] }, [`${X}percentLags:1`, `${X}elapsedLags:1`]);
one('taken', { tasks: [
  task('Klok', {}, { durationType: 'ELAPSEDTIME' }),
  task('Hand', { manuallyScheduled: true }),
  task('Hangmat', { isHammock: true }),
  task('Vlag', { isMilestone: true }),
  task('Plicht', { isMilestone: true, mandatory: true }, { scheduleDuration: 0 }),
  task('Niveau', { levelingDelay: 2 }),
  task('Stop', {}, { stop: '2026-06-02' }),
  task('Tijd', { deadline: '2026-06-09' } as Partial<Task>),
  task('Extern', { externalLinks: [{}] } as unknown as Partial<Task>),
  task('Code', { activityCodes: { d: 'x' } }),
  task('Veld', { customFields: { w: 'x' } }),
  task('Ontwerp', { taskType: 'DESIGN' as Task['taskType'] }),
  task('Hoog', { priority: 700 }),
  task('Notitie', { notes: [{ id: 'n', text: 'x', done: false }] } as unknown as Partial<Task>),
] }, [`${X}elapsedDurations:1`, `${X}manualTasks:1`, `${P}hammocks:1`, `${X}durationMilestones:1`, `${X}mandatoryMilestones:1`,
  `${X}levelingDelays:1`, `${P}suspendResume:1`, `${X}deadlines:1`, `${X}externalLinks:1`, `${X}activityCodes:1`, `${X}customFields:1`,
  `${X}taskCategories:1`, `${P}priorities:1`, `${P}notes:1`]);
one('resources en kalender', {
  resources: [{ id: 'c', type: 'CREW' }, { id: 'o', type: 'SUBCONTRACTOR' }, { id: 'l', type: 'LABOR', libraryOrigin: {} }] as unknown as Resource[],
  calendars: [{ ...calendar, holidays: [{ name: 'Kerst', startDate: '2026-12-25' }] } as unknown as WorkCalendar],
  project: { schedulingProfile: p6, author: 'A' },
}, [`${P}resourceTypes:2`, `${X}libraryLinks:1`, `${X}holidayNames:1`, `${X}projectDetails`]);

// Elke categorie die de detector voor P6 XML kan geven, levert minstens één regel.
const notes = [{ id: 'n', text: 'x', done: false }];
const detected = (extra: Record<string, unknown>) => detectXerExportLoss('p6', {
  sourceArchive: null, importMetadata: null, project: { schedulingProfile: p6 }, tasks: [], sequences: [], assignments: [],
  activityCodeTypes: [], customFieldDefs: [], baselines: [], activeBaselineId: null, ...extra,
} as Parameters<typeof detectXerExportLoss>[1]).flatMap(w => w.categories);
eq('definities zonder taakwaarden', lines(input(), detected({
  activityCodeTypes: [{ id: 'd' }], customFieldDefs: [{ id: 'w' }],
})).filter(l => l.includes('Definitions')), [`${X}activityCodeDefinitions`, `${X}customFieldDefinitions`]);
eq('gemengd: de definities blijven genoemd', lines(input({ tasks: [task('Code', { activityCodes: { d: 'x' } })] }), ['activity-codes']),
  [`${X}activityCodes:1`, `${X}activityCodeDefinitions`]);
eq('notitie: detector en melding zijn het eens', [
  detected({ tasks: [task('N', { notes } as unknown as Partial<Task>)] }).includes('notes'),
  lines(input({ tasks: [task('N', { notes } as unknown as Partial<Task>)] })),
], [true, [`${P}notes:1`]]);
eq('broninformatie: één regel', lines(input(), ['exact-source-bytes', 'typed-diagnostics']), [`${X}sourceDetails`]);

// De schrijver: een mijlpaal mét duur blijft een activiteit (knownbug 570), *Projectstandaard* blijft staan (467).
const project = { ...createDefaultProject(), startDate: '2026-06-01', statusDate: '2026-06-01' };
const xml = writeP6XML(project, calendar, [
  task('Met duur', { isMilestone: true }, { durationMinutes: 2400, scheduleDuration: 5, remainingTime: 2 }),
  task('Nul', { isMilestone: true, milestoneKind: 'FINISH' }, { durationMinutes: 0, scheduleDuration: 0 }),
  task('Standaard', { p6DurationType: 'DT_FixedQty' } as Partial<Task>),
  task('Eigen', { workRule: 'FIXED_WORK' } as Partial<Task>),
], [], [], []);
const activity = (name: string) => xml.split('<Activity>').find(part => part.includes(`<Name>${name}</Name>`)) ?? '';
const tag = (name: string, field: string) => new RegExp(`<${field}>([^<]*)</${field}>`).exec(activity(name))?.[1];
eq('mijlpaal met duur: gewone activiteit met duur en rest',
  [tag('Met duur', 'Type'), Number(tag('Met duur', 'PlannedDuration')), Number(tag('Met duur', 'RemainingDuration'))], ['Task Dependent', 40, 16]);
eq('nulduur-mijlpaal blijft mijlpaal', tag('Nul', 'Type'), 'Finish Milestone');
eq('Projectstandaard schrijft geen oud duurtype', tag('Standaard', 'DurationType'), undefined);
ok('eigen werkregel gaat mee', tag('Eigen', 'DurationType'));
function ok(label: string, value: unknown): void { eq(label, Boolean(value), true); }

// Openen: de melding over het OPS-profiel.
const opened = await parseOpenedFile({ name: 'p.xml', text: xml }) as OpenedImport;
const results: ImportResult[] = [activeImportResult(opened)];
const own = withP6XmlProfileNotice(results, undefined, 'doc');
eq('P6 XML openen: eigen melding met het OPS-profiel', [own?.messageKey, own?.params, own?.severity],
  ['notifications.p6XmlOpensAsOps', { profile: 'Open Planner Studio' }, 'info']);
const merged = withP6XmlProfileNotice(results, { severity: 'info', messageKey: 'notifications.p6xmlImportReport', detailLines: [] } as never, 'doc');
eq('met een importverslag: een regel, geen tweede melding', [merged?.messageKey, merged?.detailLines?.map(l => l.messageKey)],
  ['notifications.p6xmlImportReport', ['notifications.p6XmlOpensAsOps']]);
eq('ander formaat: geen melding', withP6XmlProfileNotice([{ ...results[0], p6xmlReport: undefined }], undefined, 'doc'), undefined);

if (diffs.length === 0) {
  console.log(`OK  p6xml-export-loss: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  p6xml-export-loss: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
