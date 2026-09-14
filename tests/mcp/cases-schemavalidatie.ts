// Audit-bevinding S — RUNTIME-schemavalidatie in de dispatcher.
//
// Vóór deze laag riep `dispatcher.ts` de handler aan ZONDER de `inputSchema` ooit te raadplegen: elke
// `type`, `enum`, `required`, `minimum`, `pattern` en `additionalProperties` in de schema's ging
// wél mee in `tools/list` (waar de AI zich erop verlaat) maar werd nergens afgedwongen. Alles wat een
// tool niet zélf hercontroleerde, gleed erdoor.
//
// Deze suite draait via `handleMcpMessage` — de ECHTE dispatch-weg, niet `def.handler(...)` — want de
// poort zit daar. Getest wordt (a) de validator zelf op elk ondersteund trefwoord, (b) dat de poort in
// de dispatcher zit en een VALIDATION-tool-fout oplevert vóór enige mutatie, en (c) dat geen enkel
// van de schema's een trefwoord gebruikt dat de validator niet kent (anders belooft `tools/list`
// opnieuw iets dat runtime niet waargemaakt wordt).
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { validateToolArgs, unsupportedKeywords } from '@/services/mcp/schemaValidate';
import { getTools, registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext } from '@/services/mcp/contracts';

const store = useAppStore;

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: store.getState().activeDocumentId,
  });
}

/** Roep een tool aan via de ECHTE JSON-RPC-weg en geef het uitgepakte tool-resultaat terug. */
async function rpcCall(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 200)}`);
  return msg.result;
}

/** Verwacht dat de call door de schemapoort is TEGENGEHOUDEN; geeft de foutboodschap terug. */
async function expectSchemaReject(name: string, args: unknown): Promise<string> {
  const res = await rpcCall(name, args);
  assert(res.isError === true, `${name}: verwachtte isError=true, kreeg ${JSON.stringify(res.structuredContent)}`);
  const sc = res.structuredContent;
  assertEq(sc.ok, false, `${name}: structuredContent.ok moet false zijn`);
  assertEq(sc.code, 'VALIDATION', `${name}: foutcode moet VALIDATION zijn`);
  assert(typeof sc.error === 'string' && sc.error.includes(name), `${name}: de fout noemt de tool`);
  return sc.error as string;
}

// =================================================================================================
// 1) De validator zelf — per ondersteund trefwoord
// =================================================================================================
test('validator: type-mismatch noemt pad én verwachting', () => {
  const schema = { type: 'object', properties: { duration: { type: 'number' } } };
  const err = validateToolArgs(schema, { duration: '10' });
  assert(err !== null, 'een string waar een number hoort moet falen');
  assert(err!.includes('duration'), `het pad staat in de boodschap: ${err}`);
  assert(err!.includes('verwacht number'), `de verwachting staat in de boodschap: ${err}`);
  assert(err!.includes('"10"'), `de ONTVANGEN waarde staat in de boodschap: ${err}`);
});

const NESTED_SCHEMA = {
  type: 'object',
  properties: {
    updates: { type: 'array', minItems: 1, items: { type: 'object', properties: { fields: { type: 'object', properties: { duration: { type: 'number' } } } } } },
  },
};

test('validator: geneste paden krijgen array-index en puntnotatie (deepArrayItems)', () => {
  const err = validateToolArgs(NESTED_SCHEMA, { updates: [{ fields: { duration: '10' } }] }, { deepArrayItems: true });
  assert(err !== null, 'moet falen');
  assert(err!.startsWith('updates[0].fields.duration:'), `exact pad verwacht, kreeg: ${err}`);
});

test('DIEPTE-REGEL: standaard blijft de BINNENKANT van array-items ongemoeid (bulk-conventie)', () => {
  // Zonder deze regel zou één rot item een hele bulk-call omgooien — precies wat spec §batch verbiedt.
  assertEq(validateToolArgs(NESTED_SCHEMA, { updates: [{ fields: { duration: '10' } }] }), null,
    'de inhoud van een array-item is aan de tool, niet aan de poort');
});

test('DIEPTE-REGEL: de BUITENKANT van een array blijft wél strikt (array-zijn, minItems, elementtype)', () => {
  assert(validateToolArgs(NESTED_SCHEMA, { updates: 'geen array' })!.includes('verwacht array'), 'array-type');
  assert(validateToolArgs(NESTED_SCHEMA, { updates: [] })!.includes('minstens 1'), 'minItems');
  const err = validateToolArgs(NESTED_SCHEMA, { updates: ['een string'] });
  assert(err !== null && err.startsWith('updates[0]:') && err.includes('verwacht object'), `elementtype: ${err}`);
});

test('validator: type als ARRAY-vorm (["string","null"]) blijft werken', () => {
  const schema = { type: 'object', properties: { newParentId: { type: ['string', 'null'] } } };
  assertEq(validateToolArgs(schema, { newParentId: null }), null, 'null is toegestaan');
  assertEq(validateToolArgs(schema, { newParentId: 't1' }), null, 'string is toegestaan');
  assert(validateToolArgs(schema, { newParentId: 7 }) !== null, 'een getal niet');
});

test('validator: object-trefwoorden slaan NIET op null (constraint: ["object","null"] + required)', () => {
  // Zou `required` ook op null slaan, dan werd `constraint: null` (wissen) ineens een fout.
  const schema = {
    type: 'object',
    properties: { constraint: { type: ['object', 'null'], required: ['type'], properties: { type: { type: 'string' } }, additionalProperties: false } },
  };
  assertEq(validateToolArgs(schema, { constraint: null }), null, 'null wist de constraint en is geldig');
  assert(validateToolArgs(schema, { constraint: {} }) !== null, 'een object zonder `type` is wél fout');
});

test('validator: enum, required, additionalProperties, minItems/maxItems, minimum/maximum/exclusiveMinimum, pattern, integer', () => {
  assert(validateToolArgs({ type: 'object', properties: { s: { type: 'string', enum: ['a', 'b'] } } }, { s: 'c' })!.includes('moet één van'), 'enum');
  assert(validateToolArgs({ type: 'object', required: ['ids'], properties: { ids: { type: 'array' } } }, {})!.includes('`ids`'), 'required');
  assert(validateToolArgs({ type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false }, { b: 1 })!.includes('onbekend veld'), 'additionalProperties');
  assert(validateToolArgs({ type: 'object', properties: { xs: { type: 'array', minItems: 1 } } }, { xs: [] })!.includes('minstens 1'), 'minItems');
  assert(validateToolArgs({ type: 'object', properties: { xs: { type: 'array', maxItems: 1 } } }, { xs: [1, 2] })!.includes('hoogstens 1'), 'maxItems');
  assert(validateToolArgs({ type: 'object', properties: { n: { type: 'number', minimum: 0 } } }, { n: -1 })!.includes('≥ 0'), 'minimum');
  assert(validateToolArgs({ type: 'object', properties: { n: { type: 'number', maximum: 100 } } }, { n: 101 })!.includes('≤ 100'), 'maximum');
  assert(validateToolArgs({ type: 'object', properties: { n: { type: 'number', exclusiveMinimum: 0 } } }, { n: 0 })!.includes('> 0'), 'exclusiveMinimum');
  assert(validateToolArgs({ type: 'object', properties: { t: { type: 'string', pattern: '^tmp[-_]' } } }, { t: 'A' })!.includes('patroon'), 'pattern');
  assert(validateToolArgs({ type: 'object', properties: { i: { type: 'integer' } } }, { i: 1.5 })!.includes('verwacht integer'), 'integer vs number');
  assertEq(validateToolArgs({ type: 'object', properties: { n: { type: 'number' } } }, { n: 2 }), null, 'een geheel getal is ook een number');
});

test('validator: ontbrekende argumenten tellen als {} ⇒ nette required-melding, geen "kreeg undefined"', () => {
  const schema = { type: 'object', required: ['ids'], properties: { ids: { type: 'array' } } };
  const err = validateToolArgs(schema, undefined);
  assert(err !== null && err.includes('verplicht veld `ids` ontbreekt'), `verwachtte required-melding, kreeg: ${err}`);
  assertEq(validateToolArgs({ type: 'object', properties: {} }, undefined), null, 'geen required ⇒ geen argumenten is prima');
});

test('validator: meerdere schendingen komen in ÉÉN boodschap terug', () => {
  const schema = { type: 'object', properties: { a: { type: 'number' }, b: { type: 'string' } }, additionalProperties: false };
  const err = validateToolArgs(schema, { a: 'x', b: 1, c: true });
  assert(err !== null && err.split(';').length >= 3, `drie schendingen verwacht, kreeg: ${err}`);
});

// =================================================================================================
// 2) De poort zit in de DISPATCHER (en vóór de handler)
// =================================================================================================
test('dispatcher: de poort zit VÓÓR de handler — een pattern-schending muteert niets meer', async () => {
  // Bewust een schending die ALLEEN het schema kent: `pattern: ^tmp[-_]` op tempId. De handler
  // controleert die niet, dus zónder de poort werd de taak gewoon aangemaakt en antwoordde de tool ok.
  registerAllTools();
  store.getState().newProject();
  const err = await expectSchemaReject('planner_add_tasks', { tasks: [{ tempId: 'A', name: 'Zonder prefix' }] });
  assert(err.includes('tasks[0].tempId'), `pad in de fout: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'de handler is NIET bereikt: geen enkele taak aangemaakt');
});

test('dispatcher: `duration: "10"` (de klassieke LLM-vorm) wordt met pad en verwachting geweigerd', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectSchemaReject('planner_add_tasks', { tasks: [{ tempId: 'tmp-a', name: 'A', duration: '10' }] });
  assert(err.includes('tasks[0].duration'), `pad in de fout: ${err}`);
  assert(err.includes('verwacht number'), `verwachting in de fout: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'geen taak aangemaakt');
});

test('dispatcher: onbekende sleutel op een MUTATIETOOL wordt nu geweigerd (additionalProperties)', async () => {
  registerAllTools();
  const err = await expectSchemaReject('planner_delete_tasks', { ids: ['x'], cascade: true });
  assert(err.includes('cascade'), `de onbekende sleutel wordt bij naam genoemd: ${err}`);
});

test('dispatcher: lege verplichte array (minItems) en ontbrekend verplicht veld worden geweigerd', async () => {
  registerAllTools();
  assert((await expectSchemaReject('planner_delete_tasks', { ids: [] })).includes('minstens 1'), 'minItems');
  assert((await expectSchemaReject('planner_update_tasks', {})).includes('`updates`'), 'required');
});

test('dispatcher: een rot ITEM in een bulk-call gooit de bulk NIET om (spec §batch blijft leidend)', async () => {
  registerAllTools();
  store.getState().newProject();
  const goed = store.getState().addTask({ name: 'goed' });
  const ook = store.getState().addTask({ name: 'ook-goed' });
  // `progress.percent` is een schemaschending BINNEN een array-item van een bulk-tool: de poort laat
  // hem door, de handler weigert hem per item — en het goede item landt gewoon.
  const res = await rpcCall('planner_update_tasks', {
    updates: [
      { id: goed, fields: { name: 'hernoemd' } },
      { id: ook, progress: { percent: 50 } },
    ],
  });
  assertEq(res.isError, false, `de bulk-call mag NIET hard falen: ${JSON.stringify(res.structuredContent)}`);
  const sc = res.structuredContent;
  assertEq(sc.data.updated, [goed], 'het goede item is verwerkt');
  assertEq(sc.itemRejections.length, 1, 'het rotte item komt als per-item-weigering terug');
  assert(sc.itemRejections[0].reason.includes('percent'), `de weigering noemt de sleutel: ${sc.itemRejections[0].reason}`);
  assertEq(store.getState().tasks.find((t) => t.id === goed)!.name, 'hernoemd', 'de mutatie is echt geland');
});

test('dispatcher: planner_add_tasks is de ATOMAIRE uitzondering — daar is een item-fout wél hard', async () => {
  registerAllTools();
  store.getState().newProject();
  // add_tasks kent geen per-item-weigering (het contract is de VOLLEDIGE tempId→realId-map), dus een
  // schending binnen een item hoort de hele call te laten falen zonder ook maar één taak aan te maken.
  await expectSchemaReject('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-goed', name: 'Goed' }, { tempId: 'tmp-fout', name: 'Fout', duration: '10' }],
  });
  assertEq(store.getState().tasks.length, 0, 'geen enkele taak aangemaakt');
});

test('dispatcher: L3 — `position: "abc"` op move_task wordt door de schemapoort gestopt', async () => {
  registerAllTools();
  const err = await expectSchemaReject('planner_move_task', { id: 't1', newParentId: null, position: 'abc' });
  assert(err.includes('position') && err.includes('integer'), `verwachtte een integer-melding, kreeg: ${err}`);
});

test('dispatcher: een GELDIGE call passeert de poort ongehinderd', async () => {
  registerAllTools();
  store.getState().newProject();
  const res = await rpcCall('planner_add_tasks', { tasks: [{ tempId: 'tmp-ok', name: 'Geldig', duration: 3 }] });
  assertEq(res.isError, false, `geldige call moet slagen: ${JSON.stringify(res.structuredContent)}`);
  assertEq(store.getState().tasks.length, 1, 'de taak is echt aangemaakt');
});

// =================================================================================================
// 3) Schema-dekking over ALLE 40 tools
// =================================================================================================
test('alle 40 inputSchema\'s gebruiken uitsluitend trefwoorden die de validator afdwingt', () => {
  registerAllTools();
  const tools = getTools();
  assert(tools.length === 40, `verwachtte 40 tools, kreeg ${tools.length}`);
  const offenders: string[] = [];
  for (const t of tools) {
    const unknown = unsupportedKeywords(t.inputSchema);
    if (unknown.length > 0) offenders.push(`${t.name}: ${unknown.join(', ')}`);
  }
  assertEq(offenders, [], `deze schema's beloven iets dat runtime NIET wordt afgedwongen:\n  ${offenders.join('\n  ')}`);
});

test('elk schema is een object-schema met properties (zodat additionalProperties betekenis heeft)', () => {
  registerAllTools();
  for (const t of getTools()) {
    const s = t.inputSchema as any;
    assertEq(s.type, 'object', `${t.name}: wortelschema moet type object zijn`);
    assert(s.properties && typeof s.properties === 'object', `${t.name}: wortelschema mist properties`);
  }
});

// =================================================================================================
// 4) DEZELFDE POORT BINNEN `planner_batch` — het batchStep-gat
//
// `planner_batch` dispatcht zijn stappen NIET via `handleMcpMessage`, maar via `batchStep` (muterende
// tools) of rechtstreeks via `def.handler` (leestools). De schemapoort in de dispatcher zag die
// stappen dus nooit: een agent kon élk `type`/`enum`/`required`/`minItems`/`additionalProperties` van
// elke tool omzeilen door zijn call in een batch te wikkelen. Sinds de fix draait `validateToolArgs`
// óók per batch-stap, met dezelfde diepte-instelling als de dispatcher.
//
// WAAROM DE ASSERTS OP DE FOUTVORM MATCHEN, niet alleen op "geweigerd": verschillende tools kijken hun
// args zélf ook nog eens na. Zouden we alleen op `ok === false` toetsen, dan zou de test óók groen
// blijven op code ZONDER de poort. Daarom eist `expectBatchSchemaReject` de exacte vorm die alleen de
// poort produceert: `stap N: ongeldige argumenten voor <tool> — <pad>: …`.
// =================================================================================================

/** Draai een draaiboek via de ECHTE JSON-RPC-weg. */
async function rpcBatch(steps: unknown[]): Promise<any> {
  return rpcCall('planner_batch', { steps });
}

/** Verwacht dat DE SCHEMAPOORT stap `stepNr` heeft tegengehouden; geeft de foutboodschap terug. */
async function expectBatchSchemaReject(
  steps: unknown[], stepNr: number, tool: string, pathToken: string,
): Promise<string> {
  const res = await rpcBatch(steps);
  assert(res.isError === true, `de batch had moeten falen, kreeg: ${JSON.stringify(res.structuredContent).slice(0, 400)}`);
  const sc = res.structuredContent;
  assertEq(sc.code, 'VALIDATION', `de batch-fout moet VALIDATION zijn: ${JSON.stringify(sc).slice(0, 300)}`);
  const err = String(sc.error);
  assert(
    err.includes(`stap ${stepNr}: ongeldige argumenten voor ${tool} —`),
    `de fout moet stapnummer én tool noemen in de poort-vorm, kreeg: ${err}`,
  );
  assert(err.includes(pathToken), `de fout moet het pad '${pathToken}' noemen, kreeg: ${err}`);
  return err;
}

test('batch: verkeerd TYPE in een stap wordt door de poort geweigerd en rolt de HELE batch terug', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject([
    { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-a', name: 'Wordt teruggedraaid', duration: 5 }] } },
    { tool: 'planner_update_tasks', args: { updates: 'geen array' } },
  ], 2, 'planner_update_tasks', 'updates');
  assert(err.includes('verwacht array'), `de verwachting staat erin: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'de geslaagde eerste stap is teruggedraaid');
});

test('batch: onbekende TOP-LEVEL sleutel in een stap wordt geweigerd (additionalProperties)', async () => {
  registerAllTools();
  store.getState().newProject();
  const id = store.getState().addTask({ name: 'blijft bestaan' });
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_delete_tasks', args: { ids: [id], cascade: true } }],
    1, 'planner_delete_tasks', 'cascade',
  );
  assert(err.includes('onbekend veld'), `de sleutel wordt bij naam genoemd: ${err}`);
  assert(store.getState().tasks.some((t) => t.id === id), 'de tool is NIET bereikt: de taak staat er nog');
});

test('batch: ontbrekend REQUIRED veld en lege verplichte array (minItems) worden geweigerd', async () => {
  registerAllTools();
  store.getState().newProject();
  assert(
    (await expectBatchSchemaReject([{ tool: 'planner_update_tasks', args: {} }], 1, 'planner_update_tasks', 'updates'))
      .includes('verplicht veld'),
    'required',
  );
  assert(
    (await expectBatchSchemaReject([{ tool: 'planner_delete_tasks', args: { ids: [] } }], 1, 'planner_delete_tasks', 'ids'))
      .includes('minstens 1'),
    'minItems',
  );
});

test('batch: een foute ENUM-waarde in een stap wordt geweigerd', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_get_resource_histogram', args: { bucket: 'maand' } }],
    1, 'planner_get_resource_histogram', 'bucket',
  );
  assert(err.includes('moet één van'), `de toegestane waarden staan erin: ${err}`);
});

test('batch: het GEMETEN geval — een verschreven leesfilter wordt geweigerd, niet stil uitgevoerd', async () => {
  // `planner_list_tasks {kritisch: true}` (i.p.v. `kritiek`) werd LOS netjes geweigerd, maar als
  // batch-stap uitgevoerd met het filter stil genegeerd — waarna de VOLLEDIGE takenlijst terugkwam
  // alsof het de kritieke verzameling was. Geen enkele state-verandering verraadt dat achteraf; de
  // agent bouwt door op een plausibel-maar-onjuist antwoord. Leestools hebben geen `batchStep`, dus
  // ze lopen via `def.handler` — precies de tak die de poort óók moet dekken.
  registerAllTools();
  store.getState().newProject();
  store.getState().addTask({ name: 'niet-kritiek' });
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_list_tasks', args: { kritisch: true } }],
    1, 'planner_list_tasks', 'kritisch',
  );
  assert(err.includes('onbekend veld'), `de verschreven sleutel wordt bij naam genoemd: ${err}`);
});

test('batch: de fout noemt het STAPNUMMER van de juiste regel uit het draaiboek', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject([
    { tool: 'planner_update_project', args: { name: 'Stap 1' } },
    { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-a', name: 'Stap 2' }] } },
    { tool: 'planner_get_task', args: { taskId: 't1', diepte: 3 } },
  ], 3, 'planner_get_task', 'diepte');
  // Het rapport per stap blijft intact: twee uitgevoerd (en teruggedraaid), de derde gefaald.
  assert(err.includes('1. planner_update_project — uitgevoerd (teruggedraaid)'), `rapport stap 1: ${err}`);
  assert(err.includes('3. planner_get_task — gefaald'), `rapport stap 3: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'alles is teruggedraaid');
});

test('batch: een GELDIG draaiboek blijft ongehinderd werken (poort mag niets breken)', async () => {
  registerAllTools();
  store.getState().newProject();
  const res = await rpcBatch([
    { tool: 'planner_update_project', args: { name: 'Bestek', startDate: '2026-03-02' } },
    {
      tool: 'planner_add_tasks',
      args: { tasks: [{ tempId: 'tmp-f', name: 'Fundering', duration: 10 }, { tempId: 'tmp-r', name: 'Ruwbouw', duration: 20 }] },
    },
    {
      tool: 'planner_add_dependencies',
      args: { dependencies: [{ predecessorId: 'tmp-f', successorId: 'tmp-r', type: 'FINISH_START' }] },
    },
    { tool: 'planner_list_tasks', args: { kritiek: true, limit: 10 } },
  ]);
  assertEq(res.isError, false, `de geldige batch moet slagen: ${JSON.stringify(res.structuredContent).slice(0, 600)}`);
  const data = res.structuredContent.data;
  assertEq(data.steps.map((s: any) => s.status), ['uitgevoerd', 'uitgevoerd', 'uitgevoerd', 'uitgevoerd'], 'alle stappen uitgevoerd');
  assertEq(store.getState().tasks.length, 2, 'de taken zijn echt aangemaakt');
  assertEq(store.getState().sequences.length, 1, 'de relatie is echt aangemaakt');
  // De tempId-vervanging blijft werken: de poort keurt de args ná `resolveTempIds`.
  const f = store.getState().tasks.find((t) => t.name === 'Fundering')!;
  assertEq(store.getState().sequences[0].predecessorId, f.id, 'de tempId is opgelost tot het echte id');
});

test('batch: DIEPTE-REGEL — een per-item-weigering in een bulk-stap blijft ZACHT', async () => {
  // De poort mag de bulk-conventie niet omdraaien: `progress.percent` is een schemaschending BINNEN
  // een array-item, dus de tool maakt er een per-item-weigering van en de batch loopt gewoon door.
  registerAllTools();
  store.getState().newProject();
  const goed = store.getState().addTask({ name: 'goed' });
  const rot = store.getState().addTask({ name: 'rot' });
  const res = await rpcBatch([
    {
      tool: 'planner_update_tasks',
      args: { updates: [{ id: goed, fields: { name: 'hernoemd' } }, { id: rot, progress: { percent: 50 } }] },
    },
  ]);
  assertEq(res.isError, false, `de batch mag NIET hard falen: ${JSON.stringify(res.structuredContent).slice(0, 500)}`);
  const sc = res.structuredContent;
  assertEq(sc.data.steps[0].status, 'uitgevoerd', 'de bulk-stap telt als geslaagd');
  assertEq(sc.data.rejections.length, 1, 'de weigering staat prominent bovenaan de batch-respons');
  assert(sc.data.rejections[0].reason.includes('stap 1'), `de weigering draagt zijn stapherkomst: ${sc.data.rejections[0].reason}`);
  assertEq(store.getState().tasks.find((t) => t.id === goed)!.name, 'hernoemd', 'het goede item is echt geland');
});

test('batch: DIEPTE-REGEL — bij de ATOMAIRE uitzondering (add_tasks) is een item-fout wél hard', async () => {
  // Exact het gedrag van dezelfde call LOS (zie sectie 2): `ATOMIC_ITEM_TOOLS` geldt in de batch met
  // dezelfde instelling, anders zouden er twee waarheden ontstaan.
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-goed', name: 'Goed' }, { tempId: 'tmp-fout', name: 'Fout', duration: '10' }] } }],
    1, 'planner_add_tasks', 'tasks[1].duration',
  );
  assert(err.includes('verwacht number'), `de verwachting staat erin: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'geen enkele taak aangemaakt');
});

test('leestools hebben geen object-array-items ⇒ dispatcher-pariteit dekt ze VOLLEDIG', () => {
  // De diepte-regel slaat de BINNENKANT van array-items over, behalve bij `ATOMIC_ITEM_TOOLS`. Voor
  // leestools maakt dat vandaag niets uit: geen enkel leesschema kent een array van objecten (alleen
  // `resourceIds: array of string`, en dáárvan controleert de poort het elementtype al). Daardoor is
  // "exact dezelfde instelling als de dispatcher" voor leestools óók volledige dekking — geen tweede
  // waarheid nodig. Zodra iemand een leestool een object-array geeft, valt deze test om en moet de
  // afweging opnieuw gemaakt worden (deep aanzetten of de tool per-item laten weigeren).
  registerAllTools();
  const offenders: string[] = [];
  const visit = (s: any, path: string, tool: string): void => {
    if (!s || typeof s !== 'object') return;
    if (s.items && typeof s.items === 'object') {
      const it = s.items.type;
      if (it === 'object' || it === 'array' || it === undefined) offenders.push(`${tool}: ${path}.items (type ${String(it)})`);
      visit(s.items, `${path}.items`, tool);
    }
    if (s.properties && typeof s.properties === 'object') {
      for (const [k, v] of Object.entries(s.properties)) visit(v, path ? `${path}.${k}` : k, tool);
    }
  };
  for (const t of getTools()) {
    if (t.kind !== 'read') continue;
    visit(t.inputSchema, '', t.name);
  }
  assertEq(offenders, [], `deze leestools kennen wél een array van objecten:\n  ${offenders.join('\n  ')}`);
});

await run();
