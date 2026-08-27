// T7-review H1 (2026-08-15): `planner_update_project`'s beschrijving beloofde de projectstart-
// bewerkbescherming (T7b, plan-§9/O2-vervolg) — maar `mcpTransaction.ts`'s `draft.setProject` deed
// tot nu toe alleen `Object.assign`: headless bewezen geen klem, geen melding. Orkestratorbesluit:
// de klem hoort óók in het AI-bewerkmoment, met exact dezelfde voorwaarden als de UI-variant
// (`projectSlice.setProject`) — beide roepen sinds deze fixronde dezelfde gedeelde
// `clampProjectStartAnchors` (`engine/scheduler/projectStartAnchorClamp.ts`) aan. Deze batterij
// bewaakt dat vanaf de MCP-kant: de klem zelf, het gerapporteerde aantal, en de twee L-bevindingen
// (ASAP-dateless-constraint blokkeert niet, L1; een hammock-wortel telt niet mee, L2).
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

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

/** Vers project, anker 2026-06-01, ma-vr-kalender zonder feestdagen. */
function versProject(): void {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
}

test('LATERE startDate klemt een wortel-taak zonder voorganger/constraint, en de respons meldt het aantal', async () => {
  versProject();
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
  S().runCPM();

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === a)!.time.scheduleStart, '2026-08-17',
    'het taakanker is naar de nieuwe startdatum geklemd');
  assertEq(data.anchorsClamped, 1, 'de respons meldt precies 1 geklemd anker');
  assertEq(S().scheduleStale, false, 'H3c: de transactie herrekent al — geen stale planning ná de call');
});

test('scheduleFinish schuift consistent mee (H3b) — duurbehoudend, klokbehoudend', async () => {
  versProject();
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
  const finishVoor = S().tasks.find((t) => t.id === a)!.time.scheduleFinish;

  await callOk('planner_update_project', { startDate: '2026-08-17' });

  const t = S().tasks.find((x) => x.id === a)!;
  assert(t.time.scheduleFinish > t.time.scheduleStart, 'scheduleFinish ligt nog steeds NÁ scheduleStart (geen finish<start)');
  assert(t.time.scheduleFinish !== finishVoor, 'scheduleFinish is daadwerkelijk meegeschoven, niet blijven staan');
});

test('een taak MET voorganger blijft ongemoeid, ook met een even vroeg eigen anker', async () => {
  versProject();
  const c = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-05-01', 2) });
  const b = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-05-01', 2) });
  S().addSequence({ predecessorId: c, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === b)!.time.scheduleStart, '2026-05-01', 'B (heeft een voorganger) blijft op zijn eigen anker');
  assertEq(data.anchorsClamped, 1, 'alleen C (de wortel) telt mee, niet B');
});

test('een taak MET een expliciete SNET-constraint blijft ongemoeid', async () => {
  versProject();
  const d = S().addTask({
    name: 'D', time: createDefaultTaskTime('2026-05-01', 2),
    constraint: { type: 'SNET', date: '2026-05-10' },
  });

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === d)!.time.scheduleStart, '2026-05-01', 'D blijft op zijn eigen anker — de constraint wint');
  assertEq(data.anchorsClamped, undefined, 'niets geklemd ⇒ geen `anchorsClamped` in de respons (geen ruis)');
});

test('L1 — een dateless ASAP-constraint blokkeert de klem NIET', async () => {
  versProject();
  const e = S().addTask({
    name: 'E', time: createDefaultTaskTime('2026-05-01', 2),
    constraint: { type: 'ASAP' },
  });

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === e)!.time.scheduleStart, '2026-08-17',
    'ASAP heeft geen forward-effect in de solver — de klem behandelt hem als geen constraint');
  assertEq(data.anchorsClamped, 1, 'E telt gewoon mee');
});

test('L2 — een hammock-wortel telt niet mee (de solver negeert zijn anker toch)', async () => {
  versProject();
  const hamm = S().addTask({ name: 'Hammock', time: createDefaultTaskTime('2026-05-01', 2), isHammock: true });
  const f = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-05-01', 2) }); // gewone wortel, telt WEL mee

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === hamm)!.time.scheduleStart, '2026-05-01',
    'de hammock-taak zijn eigen scheduleStart blijft ongemoeid — de klem-lus slaat hem over');
  assertEq(S().tasks.find((t) => t.id === f)!.time.scheduleStart, '2026-08-17', 'de gewone wortel-taak klemt gewoon');
  assertEq(data.anchorsClamped, 1, 'alleen F telt mee, de hammock blaast het aantal niet op');
});

test('EERDERE startDate klemt niets — geen anchorsClamped in de respons', async () => {
  versProject();
  S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });

  const data = await callOk('planner_update_project', { startDate: '2026-01-01' });

  assertEq(data.anchorsClamped, undefined, 'een eerdere startDate klemt niets');
});

test('M4 — een uurtaak later diezelfde kalenderdag (ná de eerste werkband) wordt NIET meegeklemd', async () => {
  // Bewijst dat de klem op GEPARSEERDE instants vergelijkt (`own.getTime() >= floor.getTime()`),
  // niet op rauwe strings — geverifieerd via mutatietest (zie het commitbericht): de eindcode bevat
  // NERGENS meer een rauwe-string-datumvergelijking in het beslispad (alleen nog `Date`-objecten
  // via `.getTime()`). Deze specifieke case (own-tijdstip 09:00 ná de bandstart 08:00 op de nieuwe
  // startdatum zelf) discrimineert zelf niet tussen rauw en geparseerd — voor geldig ISO-8601-
  // geformatteerde strings sorteren beide gelijk — maar bewaakt wél de kern-invariant: een anker
  // dat al op/ná de nieuwe startdatum ligt (ook binnen dezelfde kalenderdag) klemt niet mee.
  versProject();
  S().setCalendar({
    ...S().calendar,
    workTime: { byWeekday: {
      1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
      4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
    } },
  } as WorkCalendar);
  const g = S().addTask({ name: 'G', time: createDefaultTaskTime('2026-08-17T09:00', 2) });

  await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === g)!.time.scheduleStart, '2026-08-17T09:00',
    'anker ná de eerste werkband van de nieuwe startdatum zelf — niets te klemmen');
});

test('batch-pad: de klem werkt óók door `planner_batch`, en het aantal komt mee in de stap-data', async () => {
  versProject();
  S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });

  const data = await callOk('planner_batch', {
    steps: [{ tool: 'planner_update_project', args: { startDate: '2026-08-17' } }],
  });
  const blob = JSON.stringify(data);
  assert(/"anchorsClamped":1/.test(blob), `de batch-stap verzwijgt het geklemde aantal: ${blob}`);
});

test('undo herstelt de klem samen met de startDate', async () => {
  versProject();
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
  await callOk('planner_update_project', { startDate: '2026-08-17' });
  assertEq(S().tasks.find((t) => t.id === a)!.time.scheduleStart, '2026-08-17', 'voorwaarde: geklemd');

  await callOk('planner_undo', {});

  assertEq(S().project.startDate, '2026-06-01', 'undo herstelt project.startDate');
  assertEq(S().tasks.find((t) => t.id === a)!.time.scheduleStart, '2026-05-01', 'undo herstelt het taakanker');
});

test('beschrijving: update_project verzwijgt de bewerkbescherming niet meer', () => {
  const up = def('planner_update_project').description;
  assert(/anchorsClamped|bewerkbescherming|vóór de nieuwe/.test(up), 'update_project noemt de klem-uitzondering niet meer');
});

await run();
