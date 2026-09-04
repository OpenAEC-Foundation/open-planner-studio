// Statusdatum-semantiek + voltooid-werk-in-onwerkbare-tijd — de twee bevindingen uit het eerste
// praktijkgebruik van de bridge door een echte AI-agent.
//
// Bevinding 1: `update_project({statusDate})` op een planning ZONDER enige voortgang verschoof de hele
//   planning drie weken vooruit terwijl de respons alleen `updated:["statusDate"]` meldde. Het gedrag
//   is correct (data-date-semantiek uit P6/MSP: niet-gestart werk mag niet vóór de peildatum liggen),
//   de VERZWIJGING was de bug. Deze batterij pint vast dat het gevolg nu voor/ná wordt gerapporteerd
//   en dat de beschrijvingen het mechanisme benoemen.
//
// Bevinding 2: een voltooide taak met een `actualFinish` in het bouwvak toonde een `earlyFinish` die
//   drie werkdagen eerder lag dan de eigen actual, zonder één woord uitleg. De terugsnap zelf is het
//   gevolg van de werkdag-invariant van de solver; het stilzwijgen was de bug. `get_task` meldt het
//   verschil nu expliciet.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const S = () => useAppStore.getState();

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: S().activeDocumentId,
  });
}

function def(name: string) {
  const t = getTool(name);
  assert(!!t, `tool ${name} niet geregistreerd`);
  return t!;
}

async function callOk(name: string, args: unknown = {}): Promise<any> {
  const res = (await def(name).handler(args, makeCtx())) as McpToolResult;
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}

/** Ketting van drie taken vanaf ma 27 juli 2026 op een ma-vr-kalender, ZONDER enige voortgang. */
function planningZonderVoortgang(holidays: WorkCalendar['holidays'] = []): string[] {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays } as WorkCalendar);
  S().setProject({ startDate: '2026-07-27' });
  const ids = [
    S().addTask({ name: 'Kickoff', isMilestone: true, parentId: null, time: createDefaultTaskTime('2026-07-27', 0) }),
    S().addTask({ name: 'Sloop', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-07-27', 10) }),
    S().addTask({ name: 'Installaties', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-07-27', 15) }),
  ];
  S().addSequence({ predecessorId: ids[0], successorId: ids[1], type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: ids[1], successorId: ids[2], type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return ids;
}

// =================================================================================================
// Bevinding 1 — de statusdatum verschuift niet-gestart werk, en dat wordt nu GEMELD
// =================================================================================================

test('statusdatum op nul voortgang: de planning schuift ECHT op en de respons meldt voor/ná', async () => {
  const ids = planningZonderVoortgang();
  const eindVoor = S().cpmResult!.projectEnd;
  const eersteVoor = S().tasks.find((t) => t.id === ids[0])!.time.earlyStart;
  assertEq(eindVoor, '2026-08-28', 'voorwaarde: projecteinde zonder statusdatum');
  assertEq(eersteVoor, '2026-07-27', 'voorwaarde: de mijlpaal staat op de projectstart');

  const data = await callOk('planner_update_project', { statusDate: '2026-08-17' });

  // Het gedrag zelf (data-date-vloer): zelfs de mijlpaal met completion 0 schuift naar de peildatum.
  assertEq(S().tasks.find((t) => t.id === ids[0])!.time.earlyStart, '2026-08-17',
    'de niet-gestarte mijlpaal is naar de statusdatum geschoven');
  assertEq(S().project.startDate, '2026-07-27', 'project.startDate blijft ongemoeid');
  assertEq(S().cpmResult!.projectEnd, '2026-09-18', 'het projecteinde is drie weken opgeschoven');

  // En dát is precies wat de respons nu meldt — het echte voor/ná-verschil, niet alleen `updated`.
  assert(data.statusDateEffect, 'de respons mist `statusDateEffect`');
  assertEq(data.statusDateEffect.projectEndBefore, eindVoor, 'projectEndBefore = de stand vóór de call');
  assertEq(data.statusDateEffect.projectEndAfter, '2026-09-18', 'projectEndAfter = de nieuwe stand');
  assertEq(data.statusDateEffect.shifted, true, '`shifted` staat aan want het einde verschoof');
  assertEq(data.statusDateEffect.staleBefore, false, 'de voor-meting was niet verouderd');
  assert(/DATA DATE/.test(data.statusDateEffect.note), 'de toelichting benoemt de data-date-semantiek');
});

test('statusdatum wissen: het effect wordt óók gemeld, en de planning valt exact terug', async () => {
  const ids = planningZonderVoortgang();
  await callOk('planner_update_project', { statusDate: '2026-08-17' });
  assertEq(S().cpmResult!.projectEnd, '2026-09-18', 'voorwaarde: opgeschoven');

  const data = await callOk('planner_update_project', { statusDate: null });
  assertEq(S().tasks.find((t) => t.id === ids[0])!.time.earlyStart, '2026-07-27', 'de mijlpaal staat terug');
  assertEq(S().cpmResult!.projectEnd, '2026-08-28', 'het projecteinde staat exact terug');
  assertEq(data.statusDateEffect.projectEndBefore, '2026-09-18', 'voor-meting');
  assertEq(data.statusDateEffect.projectEndAfter, '2026-08-28', 'ná-meting');
  assertEq(data.statusDateEffect.shifted, true, 'ook het terugvallen is een verschuiving');
  assertEq(data.statusDateEffect.statusDate, null, 'de gewiste statusdatum staat als null in het effect');
});

test('een call ZONDER statusDate krijgt géén statusDateEffect (geen ruis)', async () => {
  planningZonderVoortgang();
  const data = await callOk('planner_update_project', { name: 'Renovatie school' });
  assertEq(data.statusDateEffect, undefined, 'geen effect-blok wanneer de statusdatum niet is geraakt');
});

test('batch-pad: de stap meldt het mechanisme (daar is geen enrichOk en dus geen voor/ná-getal)', async () => {
  planningZonderVoortgang();
  const data = await callOk('planner_batch', {
    steps: [{ tool: 'planner_update_project', args: { statusDate: '2026-08-17' } }],
  });
  const blob = JSON.stringify(data);
  assert(/DATA DATE/.test(blob), `de batch-stap verzwijgt het mechanisme: ${blob}`);
  assertEq(S().cpmResult!.projectEnd, '2026-09-18', 'de batch heeft de verschuiving ook echt doorgevoerd');
});

test('beschrijvingen: update_project én get_project_info benoemen de data-date-werking', () => {
  const up = def('planner_update_project').description;
  assert(/DATA DATE/.test(up), 'update_project noemt de data-date niet');
  assert(/completion 0/.test(up), 'update_project legt de vloer op niet-gestart werk niet uit');
  assert(/statusDateEffect/.test(up), 'update_project verwijst niet naar het gerapporteerde effect');
  const sd = (def('planner_update_project').inputSchema as any).properties.statusDate.description as string;
  assert(/DATA DATE/.test(sd), 'het statusDate-schemaveld zegt nog steeds alleen "ISO-datum of null"');

  const gi = def('planner_get_project_info').description;
  assert(/DATA DATE/.test(gi), 'get_project_info noemt de data-date niet');
});

// =================================================================================================
// Bevinding 2 — voltooid werk waarvan de actualFinish in onwerkbare tijd valt
// =================================================================================================

const BOUWVAK = [{ name: 'Bouwvak', startDate: '2026-08-03', endDate: '2026-08-21' }];

/** Voltooide taak (actuals 29 juli → 4 augustus) met een opvolger, bouwvak 3–21 augustus. */
function voltooidInBouwvak(actualStart: string, actualFinish: string): { asbest: string; nieuwbouw: string } {
  S().newProject();
  S().setCalendar({ ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: BOUWVAK } as WorkCalendar);
  S().setProject({ startDate: '2026-07-27' });
  const asbest = S().addTask({
    name: 'Asbestverwijdering', isMilestone: false, parentId: null,
    time: createDefaultTaskTime(actualStart, 5),
  });
  const nieuwbouw = S().addTask({
    name: 'Nieuwbouw', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-07-27', 3),
  });
  S().addSequence({ predecessorId: asbest, successorId: nieuwbouw, type: 'FINISH_START', lagDays: 0 });
  S().setStatusDate('2026-08-24');
  S().setActualStart(asbest, actualStart);
  S().setActualFinish(asbest, actualFinish);
  S().setTaskProgress(asbest, 1);
  S().runCPM();
  return { asbest, nieuwbouw };
}

test('get_task meldt het verschil tussen de gerekende finish en de actualFinish', async () => {
  const { asbest } = voltooidInBouwvak('2026-07-29', '2026-08-04');
  const data = await callOk('planner_get_task', { taskId: asbest });

  // Het gedrag zelf (ongewijzigd): de finish is de laatste werkdag op-of-vóór het feit.
  assertEq(data.schedule.earlyFinish, '2026-07-31', 'de gerekende finish snapt terug naar vr 31 juli');
  assertEq(data.progress.actualFinish, '2026-08-04', 'de actual zelf blijft ongewijzigd bewaard');

  // Nieuw: het verschil wordt niet meer verzwegen.
  const adj = data.progress.actualFinishAdjusted;
  assert(adj, 'get_task verzwijgt nog steeds dat earlyFinish ≠ actualFinish');
  assertEq(adj.actualFinish, '2026-08-04', 'het effect noemt het feit');
  assertEq(adj.earlyFinish, '2026-07-31', 'het effect noemt de gerekende finish');
  assert(/buiten de werktijd/.test(adj.reason), `de reden legt de kalender-oorzaak uit: ${adj.reason}`);
  assert(/planner_update_calendar/.test(adj.reason), 'de reden noemt de uitweg (kalender werkbaar maken)');
});

test('valt de actualFinish gewoon op een werkdag, dan is er niets te melden', async () => {
  // Zelfde opzet, maar de actualFinish (vr 31 juli) ligt vóór het bouwvak ⇒ geen snap, geen ruis.
  const { asbest } = voltooidInBouwvak('2026-07-29', '2026-07-31');
  const data = await callOk('planner_get_task', { taskId: asbest });
  assertEq(data.schedule.earlyFinish, '2026-07-31', 'gerekende finish = de actual');
  assertEq(data.progress.actualFinishAdjusted, undefined, 'geen effect-blok wanneer er niets afwijkt');
});

test('een voltooide taak landt NOOIT ná zijn actualFinish, ook niet als het hele venster onwerkbaar is', async () => {
  // Het inversie-randgeval: afgemeld 5–10 augustus, midden in het bouwvak. Er is geen werkdag binnen
  // het feit; vroeger tilde de solver het paar dan naar ma 24 augustus — een week ná de statusdatum,
  // dus afgerond werk in de TOEKOMST, plus een dag vertraging voor de opvolger.
  const { asbest, nieuwbouw } = voltooidInBouwvak('2026-08-05', '2026-08-10');
  const t = S().tasks.find((x) => x.id === asbest)!;
  assertEq(t.time.earlyStart, '2026-07-31', 'de start is meegetrokken naar de laatste werkdag vóór het feit');
  assertEq(t.time.earlyFinish, '2026-07-31', 'de finish ligt op-of-vóór de actualFinish, niet erna');
  assert(t.time.earlyFinish <= S().project.statusDate!, 'afgerond werk ligt nooit ná de statusdatum');
  assertEq(S().tasks.find((x) => x.id === nieuwbouw)!.time.earlyStart, '2026-08-24',
    'de opvolger start op de eerste werkdag ná het bouwvak, niet een dag later');

  const data = await callOk('planner_get_task', { taskId: asbest });
  assert(data.progress.actualFinishAdjusted, 'ook dit randgeval wordt gemeld');
});

test('get_task-beschrijving verklaart de twee datums die er fout uitzien', () => {
  const d = def('planner_get_task').description;
  assert(/actualFinishAdjusted/.test(d), 'de beschrijving noemt het nieuwe meldveld niet');
  assert(/NEGATIEVE `totalFloat`/.test(d), 'de beschrijving verklaart late-vóór-vroege datums niet');
});

await run();
