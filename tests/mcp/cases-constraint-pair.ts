// MCP "constraint wissen" en de SECUNDAIRE constraint (audit taakmutaties §5).
//
// Paneel en raster canonicaliseren het constraint-paar al: ASAP (of leeg) wist beide, ALAP wist de
// secundaire, en een datumtype moet met de bestaande secundaire een geldig paar vormen
// (`validateConstraintPair`). Via `planner_update_tasks` bleef `constraint2` na `constraint: null`
// of `{ type: 'ASAP' }` stil staan: de agent kreeg `ok`, de taak bleef aan de secundaire grens
// vastzitten en het paneel verborg de oorzaak. Deze cases lopen via de ECHTE dispatcher (inclusief
// schemavalidatie), precies zoals een agent de tool aanroept.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';

const store = useAppStore;
registerAllTools();

// Warm-up (zelfde reden als de andere case-bestanden): promoot de projectkalender-cache vooraf.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

const S = () => store.getState();

/** Taak met een geldig P6-paar: primair FNLT (bovengrens) + secundair SNET (ondergrens). */
function seedPair(): string {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const id = S().addTask({ name: 'T' });
  S().updateTask(id, {
    constraint: { type: 'FNLT', date: '2026-06-30' },
    constraint2: { type: 'SNET', date: '2026-04-06' },
  });
  S().runCPM();
  return id;
}

async function updateFields(id: string, fields: Record<string, unknown>): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'planner_update_tasks', arguments: { updates: [{ id, fields }] } },
    }),
    makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 300)}`);
  return msg.result;
}
const task = (id: string) => S().tasks.find(t => t.id === id)!;

test('constraint: null wist ook de secundaire constraint (was: SNET bleef staan, ES bleef 07-04)', async () => {
  const id = seedPair();
  assertEq(task(id).time.earlyStart, '2026-04-07', 'vooraf begrenst de secundaire SNET de start');
  const res = await updateFields(id, { constraint: null });
  assertEq(res.isError ?? false, false, 'de call slaagt');
  assertEq(res.structuredContent.itemRejections, undefined, 'geen weigering');
  assertEq(task(id).constraint, undefined, 'primair gewist');
  assertEq(task(id).constraint2, undefined, 'secundair óók gewist — zoals paneel en raster');
  assertEq(task(id).time.earlyStart, '2026-03-02', 'de taak valt terug op de projectstart');
});

test('constraint: { type: ASAP } wist beide (canonieke ASAP = geen constraint)', async () => {
  const id = seedPair();
  await updateFields(id, { constraint: { type: 'ASAP' } });
  assertEq(task(id).constraint, undefined, 'ASAP wordt als "geen constraint" opgeslagen, net als paneel/raster');
  assertEq(task(id).constraint2, undefined, 'secundair gewist');
  assertEq(task(id).time.earlyStart, '2026-03-02', 'geen grens meer');
});

test('constraint: { type: ALAP } wist de secundaire en bewaart ALAP zonder datum', async () => {
  const id = seedPair();
  await updateFields(id, { constraint: { type: 'ALAP', date: '2026-05-01' } });
  assertEq(task(id).constraint, { type: 'ALAP' }, 'ALAP draagt geen datum');
  assertEq(task(id).constraint2, undefined, 'secundair gewist');
});

test('een geldig nieuw primair laat de secundaire staan', async () => {
  const id = seedPair();
  const res = await updateFields(id, { constraint: { type: 'SNLT', date: '2026-06-01' } });
  assertEq(res.structuredContent.itemRejections, undefined, 'SNLT (boven) + SNET (onder) is een geldig paar');
  assertEq(task(id).constraint, { type: 'SNLT', date: '2026-06-01' }, 'primair gezet');
  assertEq(task(id).constraint2, { type: 'SNET', date: '2026-04-06' }, 'secundair blijft');
});

test('een ongeldig paar wordt per item geweigerd met reden; de taak blijft ongewijzigd', async () => {
  for (const [constraint, fragment] of [
    [{ type: 'MSO', date: '2026-03-09' }, 'MSO/MFO'],
    [{ type: 'FNET', date: '2026-05-01' }, 'ondergrens'],
  ] as const) {
    const id = seedPair();
    const res = await updateFields(id, { constraint });
    assertEq(res.isError ?? false, false, 'zachte weigering, geen toolfout');
    const rejections = res.structuredContent.itemRejections as { id: string; reason: string }[];
    assertEq(rejections?.length, 1, `${constraint.type} naast SNET wordt geweigerd`);
    assert(rejections[0].reason.includes('secundaire constraint') && rejections[0].reason.includes(fragment),
      `de reden noemt de secundaire constraint en waarom (${fragment}): ${rejections[0].reason}`);
    assertEq(task(id).constraint, { type: 'FNLT', date: '2026-06-30' }, 'primair ongewijzigd');
    assertEq(task(id).constraint2, { type: 'SNET', date: '2026-04-06' }, 'secundair ongewijzigd');
  }
});

test('zonder secundaire verandert er niets aan het bestaande gedrag', async () => {
  S().newProject();
  const id = S().addTask({ name: 'Los' });
  await updateFields(id, { constraint: { type: 'MSO', date: '2026-03-09', hard: true } });
  assertEq(task(id).constraint, { type: 'MSO', date: '2026-03-09', hard: true }, 'MSO met harde pin landt');
  assert(!('constraint2' in task(id)) || task(id).constraint2 === undefined, 'geen secundaire verzonnen');
});

await run();
