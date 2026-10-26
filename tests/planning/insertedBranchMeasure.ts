// Meet de echte storehandelingen; de meetrunner wisselt alleen insertedBranch.ts uit.
import './domStub';
import { createHash } from 'node:crypto';
import { createAppStoreContext, type AppState } from '@/state/appStoreFactory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WbsTemplate } from '@/utils/wbsTemplates';

export type InsertRoute = 'paste' | 'cross-document' | 'template';

function serialize(state: AppState): string {
  // Alle serialiseerbare storevelden, inclusief klembord, slapende documenten, meldingen,
  // selectie, viewRows en volledige undo-snapshots. Alleen functies zijn geen toestand.
  return JSON.stringify(state, (_, value: unknown) =>
    value instanceof Map || value instanceof Set ? [...value] : value);
}

export function createFixture(size: number, count: number, route: InsertRoute, auto: boolean, corrupt = false) {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  const makeTasks = (prefix: string): Task[] => Array.from({ length: size }, (_, i) => ({
    id: `${prefix}${i}`, name: `Taak ${i}`, description: '', wbsCode: `eigen-${i}`,
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: i > size - count ? `${prefix}${size - count}` : null,
    childIds: i === size - count ? Array.from({ length: count - 1 }, (_, j) => `${prefix}${i + j + 1}`) : [],
    resourceIds: i > size - count ? ['r', 'weg'] : [],
    calendarId: 'bronkalender', customTaskTypeId: 'brontype',
    activityCodes: { locatie: 'hier', wees: 'weg' }, customFields: { volume: 42, wees: 'weg' },
    time: createDefaultTaskTime('2026-03-02', 2, 'days'),
  }));
  const tasks = makeTasks('bron-');
  const sequences: Sequence[] = Array.from({ length: Math.max(0, count - 2) }, (_, j) => ({
    id: `seq-${j}`, predecessorId: tasks[size - count + j + 1].id, successorId: tasks[size - count + j + 2].id,
    type: 'FINISH_START', lagDays: 0, lagMinutes: j % 2 ? -30 : 60, lagUnit: 'ELAPSEDTIME',
  }));
  if (corrupt) {
    const root = tasks[size - count];
    const a = tasks[size - count + 1];
    const b = tasks[size - count + 2];
    sequences.push(
      { ...sequences[0], id: 'dubbel' },
      { ...sequences[0], id: 'zelf', predecessorId: a.id, successorId: a.id },
      { ...sequences[0], id: 'voorouder', predecessorId: a.id, successorId: root.id },
      { ...sequences[0], id: 'kring', predecessorId: b.id, successorId: a.id },
    );
    // Dubbele bron-id, lege id en ontbrekende ouder: geen extra productregels introduceren.
    tasks.push({ ...a, name: 'Tweede dubbele id', calendarId: 'andere-wees' });
    tasks.push({ ...b, id: '', name: 'Lege id', parentId: 'onbekend', childIds: [] });
  }
  store.setState(s => {
    s.project.startDate = '2026-03-02'; s.project.wbsAutoNumber = auto;
    s.tasks = tasks; s.sequences = sequences;
    s.calendars = [{ ...s.calendar, id: 'bronkalender' }];
    s.customTaskTypes = [{ id: 'brontype', name: 'Eigen type' }];
    s.activityCodeTypes = [{ id: 'locatie', name: 'Locatie', values: [{ id: 'hier', code: 'H' }] }];
    s.customFieldDefs = [{ id: 'volume', name: 'Volume', type: 'number' }];
    s.resources = [{ id: 'r', name: 'Bekend', type: 'LABOR', description: '', maxUnits: 1 }];
    s.assignments = tasks.slice(size - count + 1).flatMap((t, i) => ['r', 'weg'].map(resourceId => ({
      id: `a-${i}-${resourceId}`, taskId: t.id, resourceId, unitsPerDay: 0.5,
      curve: 'BELL' as const, plannedWorkMinutes: 960, actualWorkMinutes: 120, remainingWorkMinutes: 360,
    })));
  });
  S().copyTasks(corrupt ? [tasks[size - count].id, ''] : [tasks[size - count].id]);
  if (corrupt) store.setState(s => {
    s.taskClipboard!.sequences.push({ ...sequences[0], id: 'ontbreekt', successorId: 'onbekend' });
  });
  const clip = S().taskClipboard!;
  const template: WbsTemplate = {
    id: 'sjabloon', name: 'Tak', createdAt: '2026-10-26',
    tasks: clip.tasks.map(t => ({ id: t.id, name: t.name, description: t.description,
      parentId: t.parentId, taskType: t.taskType, isMilestone: t.isMilestone, durationDays: t.time.scheduleDuration })),
    sequences: clip.sequences,
  };
  const sourceDocumentId = S().activeDocumentId;
  if (route === 'cross-document') {
    S().newDocument();
    store.setState(s => {
      s.project.startDate = '2026-03-02'; s.project.wbsAutoNumber = auto;
      s.tasks = makeTasks('doel-'); s.sequences = [];
      s.resources = [{ id: 'r', name: 'Bekend', type: 'LABOR', description: '', maxUnits: 1 }];
    });
  }
  store.setState(s => { s.selectedTaskIds = []; s.activeTaskId = null; });
  const before = serialize(S());
  return {
    run(withHistory: boolean) {
      const start = performance.now();
      const returned = route === 'template' ? S().insertWbsTemplate(template, null) : S().pasteTasks();
      const ms = performance.now() - start;
      const after = serialize(S());
      const phases: Record<string, string> = { before, after };
      if (withHistory) {
        S().undo(); phases.undo = serialize(S());
        S().redo(); phases.redo = serialize(S());
        if (route === 'cross-document') {
          const target = S().activeDocumentId;
          S().switchDocument(sourceDocumentId); phases.source = serialize(S());
          S().switchDocument(target); phases.target = serialize(S());
        }
      }
      const hashes = Object.fromEntries(Object.entries(phases).map(([phase, data]) =>
        [phase, createHash('sha256').update(data).digest('hex')]));
      return { ms, hashes, returned, phases };
    },
  };
}
