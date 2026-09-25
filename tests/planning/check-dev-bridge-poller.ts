// X9 reviewfix 2: toets de WERKELIJK JSON-geserialiseerde Tauri-pollerrespons, niet alleen runOp.
// De store initialiseert de documenttaal bij import; dit is de kleinste DOM-vorm die dat headless
// nodig heeft en bevat bewust geen Tauri- of poller-stub.
(globalThis as unknown as { document: { documentElement: { dir: string; lang: string } } }).document = {
  documentElement: { dir: 'ltr', lang: 'en' },
};

const { serializeOpsTestResponse } = await import('@/utils/devBridge');

const response = JSON.parse(await serializeOpsTestResponse({ id: 'x9-roundtrip', op: 'roundTrip' })) as {
  id?: unknown;
  ok?: unknown;
  result?: unknown;
};
const result = response.result as Partial<{
  bytes: unknown;
  lossless: unknown;
  before: { tasks?: unknown };
  after: { tasks?: unknown };
}> | undefined;
const passed = response.id === 'x9-roundtrip'
  && response.ok === true
  && typeof result?.bytes === 'number'
  && result.bytes > 0
  && result.lossless === true
  && typeof result.before?.tasks === 'number'
  && typeof result.after?.tasks === 'number';

if (passed) {
  console.log('OK  dev-bridge-poller: roundTrip is volledig JSON-geserialiseerd');
  process.exit(0);
}
console.log(`XX  dev-bridge-poller: roundTrip-result is geen concrete JSON-payload: ${JSON.stringify(response)}`);
process.exit(1);
