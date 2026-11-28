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

async function rpcCall(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 200)}`);
  return msg.result;
}

async function expectSchemaReject(name: string, args: unknown): Promise<string> {
  const res = await rpcCall(name, args);
  assert(res.isError === true, `${name}: verwachtte isError=true, kreeg ${JSON.stringify(res.structuredContent)}`);
  const sc = res.structuredContent;
  assertEq(sc.ok, false, `${name}: structuredContent.ok moet false zijn`);
  assertEq(sc.code, 'VALIDATION', `${name}: foutcode moet VALIDATION zijn`);
  assert(typeof sc.error === 'string' && sc.error.includes(name), `${name}: de fout noemt de tool`);
  return sc.error as string;
}

test('elke enum in elk toolschema heeft unieke waarden', () => {
  registerAllTools();
  const dubbel: string[] = [];
  const walk = (s: unknown, path: string): void => {
    if (Array.isArray(s)) { s.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (s === null || typeof s !== 'object') return;
    const o = s as Record<string, unknown>;
    if (Array.isArray(o.enum) && new Set(o.enum.map((v) => JSON.stringify(v))).size !== o.enum.length) dubbel.push(path);
    for (const [k, v] of Object.entries(o)) if (k !== 'enum') walk(v, `${path}.${k}`);
  };
  for (const t of getTools()) walk(t.inputSchema, t.name);
  assertEq(dubbel, [], 'enums met een dubbele waarde');
});

test('validator: type-mismatch noemt pad én verwachting', () => {
  const schema = { type: 'object', properties: { duration: { type: 'number' } } };
  const err = validateToolArgs(schema, { duration: '10' });
  assert(err !== null, 'een string waar een number hoort moet falen');
  assert(err!.includes('duration'), `het pad staat in de boodschap: ${err}`);
  assert(err!.includes('expected number'), `de verwachting staat in de boodschap: ${err}`);
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
  assertEq(validateToolArgs(NESTED_SCHEMA, { updates: [{ fields: { duration: '10' } }] }), null,
    'de inhoud van een array-item is aan de tool, niet aan de poort');
});

test('DIEPTE-REGEL: de BUITENKANT van een array blijft wél strikt (array-zijn, minItems, elementtype)', () => {
  assert(validateToolArgs(NESTED_SCHEMA, { updates: 'geen array' })!.includes('expected array'), 'array-type');
  assert(validateToolArgs(NESTED_SCHEMA, { updates: [] })!.includes('at least 1'), 'minItems');
  const err = validateToolArgs(NESTED_SCHEMA, { updates: ['een string'] });
  assert(err !== null && err.startsWith('updates[0]:') && err.includes('expected object'), `elementtype: ${err}`);
});

test('validator: type als ARRAY-vorm (["string","null"]) blijft werken', () => {
  const schema = { type: 'object', properties: { newParentId: { type: ['string', 'null'] } } };
  assertEq(validateToolArgs(schema, { newParentId: null }), null, 'null is toegestaan');
  assertEq(validateToolArgs(schema, { newParentId: 't1' }), null, 'string is toegestaan');
  assert(validateToolArgs(schema, { newParentId: 7 }) !== null, 'een getal niet');
});

test('validator: object-trefwoorden slaan NIET op null (constraint: ["object","null"] + required)', () => {
  const schema = {
    type: 'object',
    properties: { constraint: { type: ['object', 'null'], required: ['type'], properties: { type: { type: 'string' } }, additionalProperties: false } },
  };
  assertEq(validateToolArgs(schema, { constraint: null }), null, 'null wist de constraint en is geldig');
  assert(validateToolArgs(schema, { constraint: {} }) !== null, 'een object zonder `type` is wél fout');
});

test('validator: enum, required, additionalProperties, minItems/maxItems, minimum/maximum/exclusiveMinimum, pattern, integer', () => {
  assert(validateToolArgs({ type: 'object', properties: { s: { type: 'string', enum: ['a', 'b'] } } }, { s: 'c' })!.includes('must be one of'), 'enum');
  assert(validateToolArgs({ type: 'object', required: ['ids'], properties: { ids: { type: 'array' } } }, {})!.includes('`ids`'), 'required');
  assert(validateToolArgs({ type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false }, { b: 1 })!.includes('unknown field'), 'additionalProperties');
  assert(validateToolArgs({ type: 'object', properties: { xs: { type: 'array', minItems: 1 } } }, { xs: [] })!.includes('at least 1'), 'minItems');
  assert(validateToolArgs({ type: 'object', properties: { xs: { type: 'array', maxItems: 1 } } }, { xs: [1, 2] })!.includes('at most 1'), 'maxItems');
  assert(validateToolArgs({ type: 'object', properties: { n: { type: 'number', minimum: 0 } } }, { n: -1 })!.includes('≥ 0'), 'minimum');
  assert(validateToolArgs({ type: 'object', properties: { n: { type: 'number', maximum: 100 } } }, { n: 101 })!.includes('≤ 100'), 'maximum');
  assert(validateToolArgs({ type: 'object', properties: { n: { type: 'number', exclusiveMinimum: 0 } } }, { n: 0 })!.includes('> 0'), 'exclusiveMinimum');
  assert(validateToolArgs({ type: 'object', properties: { t: { type: 'string', pattern: '^tmp[-_]' } } }, { t: 'A' })!.includes('pattern'), 'pattern');
  assert(validateToolArgs({ type: 'object', properties: { i: { type: 'integer' } } }, { i: 1.5 })!.includes('expected integer'), 'integer vs number');
  assertEq(validateToolArgs({ type: 'object', properties: { n: { type: 'number' } } }, { n: 2 }), null, 'een geheel getal is ook een number');
  const perSleutel = { type: 'object', properties: { vast: { type: 'string' } }, additionalProperties: { type: 'array' } };
  assertEq(validateToolArgs(perSleutel, { vast: 'x', '1': [], '7': [] }), null, 'sleutels volgen het additionalProperties-schema');
  const fout = validateToolArgs(perSleutel, { '3': 5 });
  assert(fout !== null && fout.startsWith('3:') && fout.includes('expected array'), `pad en verwachting: ${fout}`);
  assert(validateToolArgs(perSleutel, { vast: [] })!.includes('expected string'), 'een genoemde sleutel volgt zijn eigen schema');
  assertEq(unsupportedKeywords({ type: 'object', additionalProperties: { type: 'array', minLength: 1 } }), ['minLength'],
    'de trefwoordcontrole kijkt ook in een additionalProperties-schema');
});

test('validator: ontbrekende argumenten tellen als {} ⇒ nette required-melding, geen "kreeg undefined"', () => {
  const schema = { type: 'object', required: ['ids'], properties: { ids: { type: 'array' } } };
  const err = validateToolArgs(schema, undefined);
  assert(err !== null && err.includes('required field `ids` is missing'), `verwachtte required-melding, kreeg: ${err}`);
  assertEq(validateToolArgs({ type: 'object', properties: {} }, undefined), null, 'geen required ⇒ geen argumenten is prima');
});

test('validator: meerdere schendingen komen in ÉÉN boodschap terug', () => {
  const schema = { type: 'object', properties: { a: { type: 'number' }, b: { type: 'string' } }, additionalProperties: false };
  const err = validateToolArgs(schema, { a: 'x', b: 1, c: true });
  assert(err !== null && err.split(';').length >= 3, `drie schendingen verwacht, kreeg: ${err}`);
});

test('dispatcher: de poort zit VÓÓR de handler — een pattern-schending muteert niets meer', async () => {
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
  assert(err.includes('expected number'), `verwachting in de fout: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'geen taak aangemaakt');
});

test('dispatcher: onbekende sleutel op een MUTATIETOOL wordt nu geweigerd (additionalProperties)', async () => {
  registerAllTools();
  const err = await expectSchemaReject('planner_delete_tasks', { ids: ['x'], cascade: true });
  assert(err.includes('cascade'), `de onbekende sleutel wordt bij naam genoemd: ${err}`);
});

test('dispatcher: lege verplichte array (minItems) en ontbrekend verplicht veld worden geweigerd', async () => {
  registerAllTools();
  assert((await expectSchemaReject('planner_delete_tasks', { ids: [] })).includes('at least 1'), 'minItems');
  assert((await expectSchemaReject('planner_update_tasks', {})).includes('`updates`'), 'required');
});

test('dispatcher: een rot ITEM in een bulk-call gooit de bulk NIET om (spec §batch blijft leidend)', async () => {
  registerAllTools();
  store.getState().newProject();
  const goed = store.getState().addTask({ name: 'goed' });
  const ook = store.getState().addTask({ name: 'ook-goed' });
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

test('alle inputSchema\'s gebruiken uitsluitend trefwoorden die de validator afdwingt', () => {
  registerAllTools();
  const tools = getTools();
  assert(tools.length > 0, 'geen enkele tool geregistreerd — de schemacontrole zou niets keuren');
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

async function rpcBatch(steps: unknown[]): Promise<any> {
  return rpcCall('planner_batch', { steps });
}

async function expectBatchSchemaReject(
  steps: unknown[], stepNr: number, tool: string, pathToken: string,
): Promise<string> {
  const res = await rpcBatch(steps);
  assert(res.isError === true, `de batch had moeten falen, kreeg: ${JSON.stringify(res.structuredContent).slice(0, 400)}`);
  const sc = res.structuredContent;
  assertEq(sc.code, 'VALIDATION', `de batch-fout moet VALIDATION zijn: ${JSON.stringify(sc).slice(0, 300)}`);
  const err = String(sc.error);
  assert(
    err.includes(`step ${stepNr}: invalid arguments for ${tool} —`),
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
  assert(err.includes('expected array'), `de verwachting staat erin: ${err}`);
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
  assert(err.includes('unknown field'), `de sleutel wordt bij naam genoemd: ${err}`);
  assert(store.getState().tasks.some((t) => t.id === id), 'de tool is NIET bereikt: de taak staat er nog');
});

test('batch: ontbrekend REQUIRED veld en lege verplichte array (minItems) worden geweigerd', async () => {
  registerAllTools();
  store.getState().newProject();
  assert(
    (await expectBatchSchemaReject([{ tool: 'planner_update_tasks', args: {} }], 1, 'planner_update_tasks', 'updates'))
      .includes('required field'),
    'required',
  );
  assert(
    (await expectBatchSchemaReject([{ tool: 'planner_delete_tasks', args: { ids: [] } }], 1, 'planner_delete_tasks', 'ids'))
      .includes('at least 1'),
    'minItems',
  );
});

test('batch: een foute ENUM-waarde in een stap wordt geweigerd', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_get_resource_histogram', args: { bucket: 'jaar' } }],
    1, 'planner_get_resource_histogram', 'bucket',
  );
  assert(err.includes('must be one of'), `de toegestane waarden staan erin: ${err}`);
});

test('batch: het GEMETEN geval — een verschreven leesfilter wordt geweigerd, niet stil uitgevoerd', async () => {
  registerAllTools();
  store.getState().newProject();
  store.getState().addTask({ name: 'niet-kritiek' });
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_list_tasks', args: { kritisch: true } }],
    1, 'planner_list_tasks', 'kritisch',
  );
  assert(err.includes('unknown field'), `de verschreven sleutel wordt bij naam genoemd: ${err}`);
});

test('batch: de fout noemt het STAPNUMMER van de juiste regel uit het draaiboek', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject([
    { tool: 'planner_update_project', args: { name: 'Stap 1' } },
    { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-a', name: 'Stap 2' }] } },
    { tool: 'planner_get_task', args: { taskId: 't1', diepte: 3 } },
  ], 3, 'planner_get_task', 'diepte');
  assert(err.includes('1. planner_update_project — executed (rolled back)'), `rapport stap 1: ${err}`);
  assert(err.includes('3. planner_get_task — failed'), `rapport stap 3: ${err}`);
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
  const f = store.getState().tasks.find((t) => t.name === 'Fundering')!;
  assertEq(store.getState().sequences[0].predecessorId, f.id, 'de tempId is opgelost tot het echte id');
});

test('batch: DIEPTE-REGEL — een per-item-weigering in een bulk-stap blijft ZACHT', async () => {
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
  assert(sc.data.rejections[0].reason.includes('step 1'), `de weigering draagt zijn stapherkomst: ${sc.data.rejections[0].reason}`);
  assertEq(store.getState().tasks.find((t) => t.id === goed)!.name, 'hernoemd', 'het goede item is echt geland');
});

test('batch: DIEPTE-REGEL — bij de ATOMAIRE uitzondering (add_tasks) is een item-fout wél hard', async () => {
  registerAllTools();
  store.getState().newProject();
  const err = await expectBatchSchemaReject(
    [{ tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-goed', name: 'Goed' }, { tempId: 'tmp-fout', name: 'Fout', duration: '10' }] } }],
    1, 'planner_add_tasks', 'tasks[1].duration',
  );
  assert(err.includes('expected number'), `de verwachting staat erin: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'geen enkele taak aangemaakt');
});

test('leestools hebben geen object-array-items ⇒ dispatcher-pariteit dekt ze VOLLEDIG', () => {
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
