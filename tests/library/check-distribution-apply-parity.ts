// Review ronde 1: een voorstel moet dezelfde bezetting tonen als het echte schrijfpad oplevert.
import assert from 'node:assert/strict';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStoreFactory';
import { capturePayload, type DocumentPayload } from '@/state/documentContract';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';
import { computeDistribution, scopeTaskIdsFor, type DistributionDocInput, type DistributionProposal } from '@/services/library/distribute';
import { planDistributionWrites } from '@/services/library/applyDistribution';
import { computeLibraryOccupancy, occupancySolveInputFor } from '@/services/library/occupancy';
import type { BuiltInProfileId } from '@/types/project';
import type { CompanyPool } from '@/types/library';
import type { Task } from '@/types/task';

const pool: CompanyPool = {
  companyId: 'c1', companyName: 'Bibliotheek', poolVersion: 1,
  modifiedAt: '2026-06-01T00:00:00Z', calendars: [],
  resources: [{ id: 'kraan', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 }],
};

function payload(context: AppStoreContext, docId: string): DocumentPayload {
  const state = context.store.getState();
  if (state.activeDocumentId === docId) return capturePayload(state);
  const stored = state.documents.find(d => d.id === docId)?.payload;
  assert(stored, `document ${docId} bestaat`);
  return stored;
}

function inputs(context: AppStoreContext): DistributionDocInput[] {
  return context.store.getState().documents.map((document, index) => {
    const p = payload(context, document.id);
    const solveInput = occupancySolveInputFor(p);
    return {
      docId: document.id, title: p.project.name, companyId: p.project.companyId ?? null,
      tasks: p.tasks, sequences: p.sequences, resources: p.resources, assignments: p.assignments,
      calendar: p.calendar, calendars: p.calendars, scheduleStale: p.scheduleStale,
      loadOptions: solveInput.options.schedulingOptions, solveInput, levelInput: solveInput,
      rank: index + 1, pinned: false, datesAsRecorded: p.datesAsRecorded, ceilingWorkdays: null,
    };
  });
}

function scope(docs: DistributionDocInput[]): Record<string, string[]> {
  return Object.fromEntries(docs.map(doc => [doc.docId, scopeTaskIdsFor(doc, 'c1', 'kraan')]));
}

function addDocumentTask(
  context: AppStoreContext, profile: BuiltInProfileId, name: string, start: string, duration: number,
  priority = 500, time?: Partial<Task['time']>, extra: Partial<Task> = {}, unit: 'days' | 'hours' = 'days',
): { docId: string; taskId: string } {
  const state = () => context.store.getState();
  state().setProject({ name, companyId: 'c1', startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  state().setCalendar({
    ...state().calendar, workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16,
    hoursPerDay: 8, holidays: [], workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
  });
  const taskId = state().addTask({ name, priority, time: createDefaultTaskTime(start, duration, unit, state().calendar) });
  const resourceId = state().addResource({
    name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1,
    libraryOrigin: { companyId: 'c1', libraryItemId: 'kraan', poolVersion: 1 },
  });
  state().assignResource(taskId, resourceId, 1);
  const task = state().tasks.find(t => t.id === taskId)!;
  state().updateTask(taskId, { ...extra, time: { ...task.time, ...time } });
  state().runCPM();
  assert.equal(state().cpmResult?.error, undefined, 'de uitgangsplanning rekent geldig door');
  return { docId: state().activeDocumentId, taskId };
}

function occupancy(context: AppStoreContext) {
  const docs = inputs(context);
  assert(docs.every(doc => !doc.scheduleStale), 'de werkelijke documenten zijn doorgerekend');
  const row = computeLibraryOccupancy('c1', pool, docs).rows.find(row => row.libraryItemId === 'kraan');
  assert(row, 'de kraan heeft werkelijk geboekte belasting');
  assert(row.docs.every(doc => doc.counted && !doc.ephemeralComputed), 'de controle gebruikt opgeslagen uitkomsten');
  return row;
}

function assertAppliedLoad(context: AppStoreContext, proposal: DistributionProposal): void {
  const actual = occupancy(context);
  for (const doc of actual.docs) {
    assert.deepEqual(doc.dailyLoad, proposal.afterLoadByDay[doc.docId] ?? {},
      `toegepaste bezetting van ${doc.docId} is gelijk aan het voorstel`);
  }
}

function recalculateAll(context: AppStoreContext): void {
  for (const document of [...context.store.getState().documents]) {
    context.store.getState().switchDocument(document.id);
    context.store.getState().runCPM();
    assert.equal(context.store.getState().cpmResult?.error, undefined);
  }
}

let failures = 0;
let cases = 0;
function check(name: string, fn: () => void): void {
  cases++;
  try { fn(); console.log(`OK ${name}`); }
  catch (error) { failures++; console.error(`XX ${name}: ${String(error)}`); }
}

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const variant of ['dagen', 'minuten', 'kalendertijd', 'gaten'] as const) {
    for (const fixedActive of [false, true]) {
      check(`R1-1 ${profile}/${variant}/vast-actief=${fixedActive}: voorstel → schrijfplan → toepassen → bezetting`, () => {
        const context = createAppStoreContext();
        const state = () => context.store.getState();
        const gap = variant === 'gaten';
        const extra: Partial<Task> = gap
          ? { splitGaps: [{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' }] }
          : { levelingDelay: 1, ...(variant !== 'dagen' ? { levelingDelayMinutes: variant === 'kalendertijd' ? 1440 : 480 } : {}),
              ...(variant === 'kalendertijd' ? { levelingDelayElapsed: true } : {}) };
        const fixed = addDocumentTask(context, profile, 'A', '2026-06-01T08:00', gap ? 2 : 1, 1000, undefined, extra);
        const fixedTasks = JSON.stringify(payload(context, fixed.docId).tasks);
        assert.equal(payload(context, fixed.docId).tasks[0].time.earlyFinish.slice(0, 10), gap ? '2026-06-03' : '2026-06-02');
        state().newDocument();
        const moving = addDocumentTask(context, profile, 'B', gap ? '2026-06-03T08:00' : '2026-06-02T08:00', 1);
        if (fixedActive) state().switchDocument(fixed.docId);
        const docs = inputs(context);
        const proposal = computeDistribution('c1', pool, 'kraan', docs, { allowSplits: true });
        assert.equal(proposal.blocked, null);
        assert.equal(proposal.hasShortfall, false, 'B kan voor de bestaande vaste last wijken');
        const writeScope = scope(docs);
        const plan = planDistributionWrites(proposal, writeScope);
        assert(plan.ok);
        assert.deepEqual(plan.writes.map(write => write.docId), [moving.docId], 'alleen B wordt geschreven');
        const applied = state().applyDistribution(proposal, writeScope);
        assert(applied.ok, 'het echte schrijfpad accepteert het voorstel');
        assert.equal(JSON.stringify(payload(context, fixed.docId).tasks), fixedTasks, 'A blijft volledig ongewijzigd');
        assertAppliedLoad(context, proposal);
        const fixedResult = proposal.docs.find(doc => doc.docId === fixed.docId)!;
        assert(fixedResult.cannotMove);
        assert.equal(fixedResult.projectEndAfter, fixedResult.projectEndBefore, 'het overgeslagen document voorspelt geen verplaatsing');
        assert.deepEqual(fixedResult.delays, {});
        assert.deepEqual(fixedResult.gaps, {});
        assert.deepEqual(occupancy(context).conflictDays, [], 'het toegepaste resultaat past in capaciteit één');
        recalculateAll(context);
        assertAppliedLoad(context, proposal);
        assert.deepEqual(occupancy(context).conflictDays, [], 'opnieuw herberekenen blijft conflictvrij');
      });
    }
  }

  for (const progressMode of ['RETAINED_LOGIC', 'PROGRESS_OVERRIDE'] as const) {
    for (const progress of ['gestart', 'voltooid'] as const) {
      for (const priority of [500, 1000]) {
        for (const fixedActive of [false, true]) {
          check(`R1-2 ${profile}/${progressMode}/${progress}/prioriteit=${priority}/vast-actief=${fixedActive}: vaste poollast meldt tekort`, () => {
            const context = createAppStoreContext();
            const state = () => context.store.getState();
            addDocumentTask(context, profile, 'C', '2026-06-01T08:00', 1);
            state().newDocument();
            const complete = progress === 'voltooid';
            state().setProject({ statusDate: complete ? '2026-06-01T16:00' : '2026-06-01T08:00', progressMode });
            const fixed = addDocumentTask(context, profile, 'D', '2026-06-01T08:00', 8, priority, {
              completion: complete ? 1 : 0.5, actualStart: '2026-06-01T08:00',
              ...(complete ? { actualFinish: '2026-06-01T16:00' } : {}), remainingMinutes: complete ? 0 : 240,
            }, { status: complete ? 'COMPLETED' : 'STARTED' }, 'hours');
            if (!fixedActive) state().switchDocument(state().documents[0].id);
            const beforeTasks = inputs(context).map(doc => JSON.stringify(doc.tasks));
            const before = occupancy(context);
            const total = before.docs.reduce((sum, doc) => sum + (doc.dailyLoad['2026-06-01'] ?? 0), 0);
            // MS Project bewaart bij retained logic ook het reeds afgewerkte venster. Met
            // progress override is de resterende halve dag onder alle drie profielen gelijk.
            const expectedLoad = complete || (profile === 'msproject' && progressMode === 'RETAINED_LOGIC') ? 2 : 1.5;
            assert.equal(total, expectedLoad, `de uitgangslast is werkelijk 2 of 1,5 op capaciteit één: ${JSON.stringify({
              time: payload(context, fixed.docId).tasks[0].time, assignments: payload(context, fixed.docId).assignments,
            })}`);
            const docs = inputs(context);
            const proposal = computeDistribution('c1', pool, 'kraan', docs, { allowSplits: true });
            assertAppliedLoad(context, proposal);
            const writeScope = scope(docs);
            const plan = planDistributionWrites(proposal, writeScope);
            const applied = state().applyDistribution(proposal, writeScope);
            assert.equal(proposal.hasShortfall, true, 'de vaste last blijft een tekort');
            assert(proposal.docs.find(doc => doc.docId === fixed.docId)!.shortfalls
              .some(shortfall => shortfall.taskId === fixed.taskId && shortfall.days.includes('2026-06-01')),
            'het tekort benoemt de vaste taak en de echte conflictdag');
            assert.deepEqual(plan, { ok: false, reason: 'shortfall' });
            assert(!applied.ok && applied.reason === 'shortfall', 'het echte schrijfpad weigert het tekort');
            assert.deepEqual(inputs(context).map(doc => JSON.stringify(doc.tasks)), beforeTasks, 'de weigering verandert geen taken');
            if (priority === 1000 && !fixedActive) {
              const fixedInput = docs.find(doc => doc.docId === fixed.docId)!;
              const cpm = payload(context, fixed.docId).cpmResult;
              assert(cpm);
              const outsideScope = levelResources(fixedInput.tasks, [], fixedInput.resources, fixedInput.assignments,
                fixedInput.calendar, fixedInput.calendars, cpm, {
                  constrainToFloat: false, scopeTaskIds: [],
                  poolLedger: { poolItemOf: () => 'kraan', residualOn: () => 0, book: () => {}, horizonIso: null },
                }, fixedInput.levelInput.options);
              assert.deepEqual(outsideScope.unresolved, {}, 'vaste taken buiten de scope krijgen geen nieuw tekort toegewezen');
            }
            recalculateAll(context);
            assertAppliedLoad(context, proposal);
          });
        }
      }
    }
  }
}

console.log(`${cases} ketens, ${failures} afwijkingen`);
process.exitCode = failures ? 1 : 0;
