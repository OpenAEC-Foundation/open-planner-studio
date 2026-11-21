// De AI-koppeling en de invoerregels voor voortgang (besluit eigenaar, regel 4): de UI zet zonder
// statusdatum die op vandaag (Z1) en vraagt de werkelijke start van een taak die pas ná de statusdatum
// zou beginnen (Z1b). De AI-koppeling doet van beide NIETS automatisch:
//   - voortgang zonder statusdatum blijft geweigerd, en de reden zegt wat de AI moet doen
//     (`planner_update_project` → `statusDate`, daarna de update herhalen);
//   - voortgang op zo'n later geplande taak zonder meegegeven `actualStart` wordt geweigerd met de
//     uitleg dat de AI de werkelijke start moet meegeven — hetzelfde criterium als de vraag in de UI
//     (`actualStartQuestionFor`). Mét `actualStart` werkt het gewoon.
// Via de echte JSON-RPC-dispatcher (schema's, stale-guard, transactie).
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();
S().addTask({ name: 'warmup' });
S().undo();
registerAllTools();

let rpcId = 0;
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const parsed = JSON.parse(raw!);
  assert(parsed.result?.structuredContent, `geen structuredContent voor ${name}: ${raw}`);
  return parsed.result.structuredContent;
}

const timeOf = (id: string): TaskTime => S().tasks.find((t) => t.id === id)!.time;
const reasons = (res: any): string[] => (res.itemRejections ?? []).map((r: { reason: string }) => r.reason);

/** Taak V (5 wd) vanaf 1 juni en taak L (5 wd) vanaf 1 juli; een mijlpaal M op 1 juli. */
function setup(statusDate: string | undefined): { V: string; L: string; M: string } {
  S().newProject();
  S().setProject({ startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}) });
  const V = S().addTask({ name: 'Vroeg', time: createDefaultTaskTime('2026-06-01', 5) });
  const L = S().addTask({ name: 'Laat', time: createDefaultTaskTime('2026-07-01', 5) });
  const M = S().addTask({ name: 'Mijlpaal', isMilestone: true, time: createDefaultTaskTime('2026-07-01', 0) });
  S().updateTask(L, { constraint: { type: 'SNET', date: '2026-07-01' } });
  S().updateTask(M, { constraint: { type: 'SNET', date: '2026-07-01' } });
  S().runCPM();
  return { V, L, M };
}

test('zonder statusdatum: geweigerd, de reden zegt wat de AI moet doen, er verandert niets', async () => {
  const { V } = setup(undefined);
  const before = JSON.stringify(timeOf(V));
  const res = await rpc('planner_update_tasks', { updates: [{ id: V, progress: { completion: 40 } }] });
  const [reason] = reasons(res);
  assert(!!reason && /planner_update_project/.test(reason) && /statusDate/.test(reason) && /repeat/.test(reason),
    `de reden noemt de route (planner_update_project → statusDate) en dat de update herhaald moet worden: ${reason}`);
  assertEq(JSON.stringify(timeOf(V)), before, 'taak ongewijzigd');
  assertEq(S().project.statusDate ?? null, null, 'geen statusdatum gezet — niets automatisch');
});

test('later geplande taak zonder actualStart: geweigerd met de vraag om de werkelijke start', async () => {
  const { L } = setup('2026-06-10');
  assert(timeOf(L).earlyStart! > '2026-06-10', `voorwaarde: geplande start ${timeOf(L).earlyStart} ligt na de statusdatum`);
  const before = JSON.stringify(timeOf(L));
  const res = await rpc('planner_update_tasks', { updates: [{ id: L, progress: { completion: 40 } }] });
  const [reason] = reasons(res);
  assert(!!reason && /progress\.actualStart/.test(reason) && /at the latest 2026-06-10/.test(reason),
    `de reden vraagt om progress.actualStart, uiterlijk de statusdatum: ${reason}`);
  assertEq(JSON.stringify(timeOf(L)), before, 'taak ongewijzigd');
});

test('later geplande taak mét actualStart: toegepast, zoals opgegeven', async () => {
  const { L } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: L, progress: { completion: 40, actualStart: '2026-06-08' } }] });
  assertEq(reasons(res), [], 'geen weigering');
  // F2 (spec §3.6, invoer; §4.2 D1): de opgegeven datum wordt het begin van de werkdag. Fixronde 1 deel B, B1.
  assertEq({ as: timeOf(L).actualStart, c: timeOf(L).completion }, { as: '2026-06-08T07:00', c: 0.4 }, 'start en voortgang');
});

test('later geplande taak: alleen actualFinish zonder actualStart is ook geweigerd', async () => {
  const { L } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: L, progress: { actualFinish: '2026-06-09' } }] });
  const [reason] = reasons(res);
  assert(!!reason && /progress\.actualStart/.test(reason) && /at the latest 2026-06-09/.test(reason),
    `de reden vraagt om een start, uiterlijk het opgegeven einde: ${reason}`);
});

test('later geplande mijlpaal met een werkelijke datum: gewoon toegepast (start = einde)', async () => {
  const { M } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: M, progress: { actualFinish: '2026-06-09' } }] });
  assertEq(reasons(res), [], 'geen weigering');
  // Een mijlpaal heeft één moment. Afgemeld met alleen een datum houdt hij de klokketijd uit de planning:
  // deze losse mijlpaal zonder soort staat in OPS om 16:00 (B6). Besluit Ethan 2026-10-29 (vloot-wiki,
  // `besluiten/2026-10-29 afgemelde mijlpaal houdt de geplande tijd.md`); het vervangt D7 (07:00) voor
  // afmelden. Net als in het paneel (`check-progress-entry.ts`, "3d mijlpaal").
  assertEq(timeOf(M).earlyStart?.slice(11), '16:00', 'geplande tijd');
  assertEq({ as: timeOf(M).actualStart, af: timeOf(M).actualFinish }, { as: '2026-06-09T16:00', af: '2026-06-09T16:00' }, 'mijlpaal afgemeld');
});

test('#998: voltooien na F5 gebruikt het geplande begin en einde van vóór de statusdatumverschuiving', async () => {
  const { V } = setup(undefined);
  const { earlyStart: originalStart, earlyFinish: originalFinish } = timeOf(V);
  await rpc('planner_update_project', { statusDate: '2026-06-10' });
  S().runCPM();
  assert(timeOf(V).earlyStart > originalStart, 'voorwaarde: de statusdatum schoof open werk op');
  const res = await rpc('planner_update_tasks', { updates: [{ id: V, progress: { completion: 100 } }] });
  assertEq(reasons(res), [], 'geen weigering');
  assertEq(timeOf(V).actualStart, originalStart, 'afgeleide start = geplande start vóór verschuiven');
  assertEq(timeOf(V).actualFinish, originalFinish, 'afgeleid einde = geplande einde vóór verschuiven');
});

test('binnen planner_batch: dezelfde weigering, de taak blijft ongewijzigd', async () => {
  const { L } = setup('2026-06-10');
  const before = JSON.stringify(timeOf(L));
  const res = await rpc('planner_batch', {
    steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id: L, progress: { completion: 40 } }] } }],
  });
  assert(res.ok === true, `batch gaf een fout: ${JSON.stringify(res)}`);
  assertEq(JSON.stringify(timeOf(L)), before, 'taak ongewijzigd (batch)');
});

test('#998: nieuwe startbeperking en percentage in één item vragen om actualStart', async () => {
  const { V } = setup('2026-06-10');
  const result = await rpc('planner_update_tasks', { updates: [{ id: V,
    fields: { constraint: { type: 'SNET', date: '2026-06-22' } }, progress: { completion: 50 },
  }] });
  assert(reasons(result).some(reason => /progress\.actualStart/.test(reason) && /2026-06-22/.test(reason)),
    `weigering noemt de nieuwe geplande start en vraagt om actualStart: ${reasons(result)}`);
  assertEq(timeOf(V).completion, 0, 'percentage geweigerd');
  assertEq(S().tasks.find(t => t.id === V)?.constraint?.date?.slice(0, 10), '2026-06-22', 'beperking toegepast');
  const earlier = await rpc('planner_update_tasks', { updates: [{ id: V,
    fields: { constraint: { type: 'SNET', date: '2026-06-04' } }, progress: { completion: 50 },
  }] });
  assertEq(reasons(earlier), [], 'de nieuwe beperking ligt nu vóór de statusdatum');
  assertEq(timeOf(V).actualStart, '2026-06-04T07:00', 'het percentage gebruikt de nieuw geplande start');
});

for (const batch of [false, true]) {
  test(`#998: een eerder gewijzigd voorgangeritem telt mee (batch: ${batch})`, async () => {
    const { V } = setup('2026-06-10');
    const next = S().addTask({ name: 'Opvolger', time: createDefaultTaskTime('2026-06-01', 2) });
    S().addSequence({ predecessorId: V, successorId: next, type: 'FINISH_START', lagDays: 0 });
    S().runCPM();
    const args = { updates: [
      { id: V, fields: { constraint: { type: 'SNET', date: '2026-06-22' } } },
      { id: next, progress: { completion: 50 } },
    ] };
    if (batch) {
      await rpc('planner_batch', { steps: [{ tool: 'planner_update_tasks', args }] });
    } else {
      const res = await rpc('planner_update_tasks', args);
      assert(reasons(res).some(reason => /progress\.actualStart/.test(reason) && /2026-06-29/.test(reason)),
        `weigering noemt de herberekende begindatum: ${reasons(res)}`);
    }
    assertEq(timeOf(next).completion, 0, 'percentage van opvolger geweigerd');
    assertEq(S().tasks.find(t => t.id === V)?.constraint?.date?.slice(0, 10), '2026-06-22', 'beperking toegepast');
  });
}

test('#998: een opgegeven werkelijk einde van een voorganger telt mee in hetzelfde verzoek', async () => {
  const { V } = setup('2026-06-10');
  const next = S().addTask({ name: 'Opvolger', time: createDefaultTaskTime('2026-06-01', 2) });
  S().addSequence({ predecessorId: V, successorId: next, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const res = await rpc('planner_update_tasks', { updates: [
    { id: V, progress: { actualStart: '2026-06-01', actualFinish: '2026-06-10' } },
    { id: next, progress: { completion: 50 } },
  ] });
  assert(reasons(res).some(reason => /progress\.actualStart/.test(reason) && /2026-06-11/.test(reason)),
    `de opgegeven werkelijke einddatum verplaatst de start van de opvolger: ${reasons(res)}`);
  assertEq(timeOf(V).actualFinish, '2026-06-10T16:00', 'opgegeven einde toegepast');
  assertEq(timeOf(next).completion, 0, 'percentage van opvolger geweigerd');
});

for (const batch of [false, true]) {
  for (const change of ['actualFinish', 'milestoneKind'] as const) {
    test(`#998: ${change} van voorganger telt mee (batch: ${batch})`, async () => {
      S().newProject();
      S().setProject({ startDate: '2026-06-08', statusDate: '2026-06-10' });
      const milestone = change === 'milestoneKind';
      const A = S().addTask({ name: 'A', isMilestone: milestone, ...(milestone ? { milestoneKind: 'START' } : {}),
        time: createDefaultTaskTime(milestone ? '2026-06-10' : '2026-06-08', milestone ? 0 : 1) });
      const B = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-06-08', 2) });
      S().addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 0 });
      S().runCPM();
      const args = { updates: [
        milestone ? { id: A, fields: { milestoneKind: 'FINISH' } } : { id: A, progress: { actualStart: '2026-06-08', actualFinish: '2026-06-10' } },
        { id: B, progress: { completion: 50 } },
      ] };
      if (batch) await rpc('planner_batch', { steps: [{ tool: 'planner_update_tasks', args }] });
      else {
        const res = await rpc('planner_update_tasks', args);
        assert(reasons(res).some(reason => /progress\.actualStart/.test(reason) && /2026-06-11/.test(reason)),
          `weigering noemt de nieuwe begindatum: ${reasons(res)}`);
      }
      assertEq(timeOf(B).completion, 0, 'percentage van opvolger geweigerd');
      if (milestone) assertEq(S().tasks.find(task => task.id === A)?.milestoneKind, 'FINISH', 'mijlpaalsoort gewijzigd');
      else assertEq(timeOf(A).actualFinish, '2026-06-10T16:00', 'voorganger afgemeld');
    });
  }
}

// F1: dezelfde drie statusgevallen via de echte dispatcher en de mutatietransactie.
for (const [statusDate, actualFinish, want] of [
  ['2026-06-03', '2026-06-03', '2026-06-03T16:00'],
  ['2026-06-03T12:00', '2026-06-03', '2026-06-03T12:00'],
  ['2026-06-03T12:00', '2026-06-03T14:00', null],
] as const) {
  test('F1 statusregel via MCP: ' + statusDate + ' / ' + actualFinish, async () => {
    const { V } = setup(statusDate);
    const bands = [{ start: 480, end: 960 }];
    S().setCalendar({ ...S().calendar, workTime: { byWeekday: {
      1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [],
    } } });
    S().updateTask(V, { time: { ...timeOf(V), durationUnit: 'hours', durationMinutes: 2400 } });
    S().runCPM();
    const before = JSON.stringify(timeOf(V));
    const res = await rpc('planner_update_tasks', {
      updates: [{ id: V, progress: { actualStart: '2026-06-01T08:00', actualFinish } }],
    });
    assertEq(reasons(res).length, want === null ? 1 : 0, 'weigering volgens statusregel');
    assertEq(timeOf(V).actualFinish ?? null, want, 'het juiste eindmoment opgeslagen');
    if (want === null) assertEq(JSON.stringify(timeOf(V)), before, 'weigering verandert niets');
    else assertEq(timeOf(V).earlyFinish, want, 'de solver behoudt D6');
  });
}

await run();
