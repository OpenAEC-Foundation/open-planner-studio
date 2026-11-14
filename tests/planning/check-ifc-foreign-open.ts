// #804 fase 1a: IFC met een gebouwmodel openen achter de flag `ifcForeignContent` (ontwerp "Gebouwmodel behouden in IFC
// en IFCX", §4.8, §4.9, §4.13 en §4.14). Headless tegen de echte store, met dezelfde open-route als Bestand → Openen
// (`openOpenedFile`). Bewaakt:
//   1. de flag: standaard uit, expliciet aan via de instellingen, en met de flag leest de bestandslaag IFC als bytes;
//   2. zonder flag blijft de modelweigering (knownbug 110);
//   3. met de flag openen `bonsai-4d`, `eigen-plus-model` en `council/fix3-twee-data` (een wand in de tweede DATA-sectie)
//      met dezelfde planning als de lezer op het eigen deel; zonder flag weigert ook dat laatste;
//   4. een eigen bestand zonder model: wat Opslaan schrijft is byte-gelijk met en zonder flag;
//   5. met de flag en een vreemd deel weigeren Opslaan, Opslaan als, de IFC-export en de pool-export, met de melding;
//   6. de bronbytes en het model zitten niet in de herstelsnapshot, de MCP-backup en de undo-snapshot; het
//      herstelmanifest krijgt geen opslagdoel; IFC-paneel (`applyProjectEdit`), kopie en undo houden de bron;
//   7. veilige terugval (fase 1c, §4.11): alleen bewezen eigen planning; ook de grens van
//      knownbug 1007 (`#2147483647` mag, `#2147483648` niet) en het schema (IFC2X3 met model blijft geweigerd);
//   8. de Worker en de terugval zonder Worker geven hetzelfde; een transportfout valt terug, een fout in de indeling niet.
// Exit 0 = alles groen.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { brokenNameFiles, dataKopBestanden, paramDataFile } from './ifcDoelBestanden';
import { oldHeaderTable, compareOldHeaderTable, type OldHeaderRow } from './ifcOudeKopVergelijking';
import { oudeKop, oudeKopVelden, oudeWand } from './ifcOudeKop';
import { indexOfStepDataSection } from '@/services/ifc/stepDataSection';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
installBrowserStubs();
const reseed = installDeterminism();
const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
// De open-route meldt een weigering ook op de console; dat is hier verwacht.
const realError = console.error;
console.error = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { FEATURE_FLAGS, ifcForeignContentEnabled } = await import('@/utils/featureFlags');
const { binaryExtensions, readsAsBytes } = await import('@/services/formatRegistry');
const { readIfcBytesDetailed, readIfcBytes } = await import('@/services/ifc/foreign/ifcBytesRoute');
const { scanForeign } = await import('@/services/ifc/foreign/foreignScan');
const { scanStep } = await import('@/services/ifc/foreign/stepScanner');
const { classify, classOf } = await import('@/services/ifc/foreign/classify');
const { readIFC } = await import('@/services/ifc/ifcReader');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { recoverySnapshotInput, serializeRecoverySnapshot } = await import('@/services/recovery/recoverySnapshotInput');
const { createAppBackupService } = await import('@/services/mcp/backupService');
const { createDefaultTaskTime } = await import('@/utils/taskDefaults');
const { ifcSaveBlocked, recoverySaveTarget } = await import('@/state/ifcForeignGuard');
const { capturePayload } = await import('@/state/documentContract');
const { createSnapshot } = await import('@/state/snapshot');
type Store = ReturnType<typeof createAppStoreContext>['store'];
const contexts = new WeakMap<Store, ReturnType<typeof createAppStoreContext>>();
type ForeignScanWorker = import('@/services/ifc/foreign/foreignScanRunner').ForeignScanWorker;

let checks = 0;
const diffs: string[] = [];
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 240)} ≠ ${w?.slice(0, 240)}`);
};
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const fileBytes = (pad: string) => new Uint8Array(readFileSync(join(ROOT, pad)));
const enc = new TextEncoder();
const dec = (b: Uint8Array) => new TextDecoder('utf-8').decode(b);
const FOREIGN = 'tests/fixtures/ifc-foreign';
const SAVE_BLOCKED_KEY = 'notifications.ifcForeignSaveBlocked';

// ── 1. De flag ──────────────────────────────────────────────────────────────────────────────────────────────────
const flag = FEATURE_FLAGS.find(f => f.id === 'ifcForeignContent');
ok('flag: geregistreerd', flag !== undefined);
ok('flag: technische markering behouden, standaard uit en met een bewaarde keuze aan',
  flag?.writesNewIfcData === true && !ifcForeignContentEnabled({}) && ifcForeignContentEnabled({ ifcForeignContent: true }));
eq('flag: zonder flag leest de bestandslaag IFC als tekst', [binaryExtensions().includes('ifc'), readsAsBytes('plan.ifc')], [false, false]);
eq('flag: met de flag als bytes (ook een onbekende extensie valt op IFC terug)',
  [binaryExtensions({ ifcBytes: true }).includes('ifc'), readsAsBytes('plan.ifc', { ifcBytes: true }), readsAsBytes('plan', { ifcBytes: true })],
  [true, true, true]);
ok('flag: met de testkeuze aan', ifcForeignContentEnabled({ ifcForeignContent: true }));

/** Open `bytes` als Bestand → Openen in een verse store (of `into`), met dezelfde leeskeuze als de bestandslaag. */
async function open(flagOn: boolean, name: string, bytes: Uint8Array, into?: Store): Promise<Store> {
  reseed(0x804);
  const context = into ? undefined : createAppStoreContext();
  const store = into ?? context!.store;
  if (context) contexts.set(store, context);
  store.setState(s => { s.ui.featureFlags = flagOn ? { ifcForeignContent: true } : {}; });
  const asBytes = readsAsBytes(name, { ifcBytes: flagOn });
  await store.getState().openOpenedFile({ name, content: asBytes ? '' : dec(bytes), ...(asBytes ? { bytes } : {}), ref: null });
  return store;
}
const saved = (store: Store) => writeIFC(buildWriteIFCInput(store.getState(), 'merge'));
const notices = (store: Store) => store.getState().ui.notifications.map(({ id: _id, ...rest }) => rest);
const opened = (store: Store, name: string) => store.getState().filePath === name;

/** De planning van een leesresultaat of een store, zonder sessie-id's: alles wat de writer schrijft. */
function planningOf(r: Parameters<typeof writeIFC>[0]): string {
  reseed(0x805);
  return writeIFC(r);
}

/** De tekst van de stukken die geen V zijn: het eigen deel plus gedeelde context en toewijzingen (§4.9 punt 4), en het
 *  enige `IfcProject` als context, ook als het V is (§4.2, Gevolgen). */
function ownPartText(bytes: Uint8Array): string {
  const scan = scanForeign(bytes);
  if (!scan.ok) throw new Error(`scanner weigert: ${scan.reason}`);
  const index = scanStep(bytes);
  const projects = Array.from({ length: index.count }, (_, i) => i).filter(i => index.isEntity(i) && index.type(i) === 'IFCPROJECT');
  const parts: Uint8Array[] = [];
  for (let i = 0; i < scan.classes.length; i++) {
    if (scan.classes[i] !== 4 || (projects.length === 1 && projects[0] === i)) parts.push(bytes.subarray(scan.chunkStarts[i], scan.chunkStarts[i + 1]));
  }
  return dec(Uint8Array.from(parts.flatMap(p => Array.from(p))));
}

/** De GlobalIds van het model (V) in een bestand: die mogen nergens in planning-uitvoer opduiken. Behalve die van het
 *  `IfcProject`: de lezer leest het altijd als context (§4.2, Gevolgen), dus de planning houdt zijn GlobalId. */
function modelGlobalIds(bytes: Uint8Array): string[] {
  const index = scanStep(bytes);
  const cls = classify(index);
  const out: string[] = [];
  for (let i = 0; i < index.count; i++) {
    const gid = index.isEntity(i) && index.type(i) !== 'IFCPROJECT' ? index.globalId(i) : undefined;
    if (gid && classOf(cls, i) === 'V') out.push(gid);
  }
  return out;
}

// #916 fixronde 1: de echte route Openen → Ctrl+S → volledig heropenen, met beide flagstanden.
{
  const original = dec(fileBytes('tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'));
  const body = original.slice(original.indexOf('\nDATA;\n') + 7);
  for (const fields of oudeKopVelden) for (const wall of [false, true]) for (const flagOn of [false, true]) {
    const [name, author, company] = fields;
    const ownBody = body.split("O''Hara Tower").join(name.replace(/'/g, "''"));
    const text = oudeKop(name, author, company) + ownBody.replace('\nENDSEC;\nEND-ISO', '\n' + (wall ? oudeWand : '') + 'ENDSEC;\nEND-ISO');
    let data = text;
    const writes: string[] = [];
    const handle = {
      kind: 'file' as const, name: 'oude-kop.ifc',
      isSameEntry: async (other: unknown) => other === handle,
      getFile: async () => new File([data], handle.name),
      queryPermission: async () => 'granted' as const, requestPermission: async () => 'granted' as const,
      createWritable: async () => {
        let next = '';
        return { write: async (chunk: unknown) => { next += typeof chunk === 'string' ? chunk : dec(chunk as Uint8Array); },
          close: async () => { data = next; writes.push(next); } };
      },
    };
    reseed(0x804);
    const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = flagOn ? { ifcForeignContent: true } : {}; });
    const label = `oude kop ${JSON.stringify(fields)} wand=${wall} flag=${flagOn}`;
    await store.getState().openOpenedFile({ name: handle.name, content: flagOn ? '' : text,
      ...(flagOn ? { bytes: enc.encode(text) } : {}), ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle } });
    const state = store.getState();
    if (wall && !flagOn) {
      eq(`${label}: weigert als gebouwmodel`, [state.fileHandle, state.ui.notifications.map(n => n.messageKey)],
        [null, ['notifications.openFailed']]);
      ok(`${label}: modelweigering`, String(state.ui.notifications[0]?.detail ?? '').includes('building model'));
      eq(`${label}: bron intact`, data, text);
      continue;
    }
    eq(`${label}: alle taken en juiste naam`, [state.tasks.length, state.project.name], [20, name]);
    if (flagOn) ok(`${label}: bytes-route zonder terugval`, !!state.ifcSource && state.ifcSource.foreign === wall);
    // Onafhankelijke controle: dezelfde DATA onder een correct gequote kop via de gewone app-route.
    const escaped = oudeKop(...fields.map(f => f.replace(/'/g, "''")) as [string, string, string]);
    const controlText = escaped + text.slice(oudeKop(...fields).length);
    const control = await open(flagOn, 'controle.ifc', enc.encode(controlText));
    const planning = saved(control);
    eq(`${label}: volledige planning gelijk aan correcte kop`, saved(store), planning);
    await state.saveFile();
    eq(`${label}: schrijven of blokkeren`, writes.length, wall ? 0 : 1);
    if (wall) {
      eq(`${label}: bestaand lokaal modeldoel krijgt de Opslaan-als-melding`, store.getState().ui.notifications.map(n => n.messageKey), ['notifications.ifcForeignReplaceBlocked']);
      eq(`${label}: volledige bron inclusief wand intact`, data, text);
    }
    // Ctrl+S bevestigt ook de bestaande minutenomzetting; vergelijk met de daardoor vastgelegde toestand.
    const writtenPlanning = saved(store);
    if (!wall) eq(`${label}: opslag schrijft volledige gewone planning`, writes[0], writtenPlanning);
    const reopened = await open(flagOn, 'heropend.ifc', enc.encode(data));
    const reference = await open(flagOn, 'controle-heropend.ifc', enc.encode(wall ? controlText : writtenPlanning));
    eq(`${label}: heropenen geeft volledige planning`, saved(reopened), saved(reference));
    eq(`${label}: heropenen behoudt taken`, reopened.getState().tasks.length, 20);
  }
}

// 1137: exact hetzelfde gemaakte bestand als de review van #916 (Sol, ronde 3), zonder grote fixture.
// Bron: review-916-sol/lange-auteur-wand-tweede-sectie-bron.ifc; de SHA-256 bindt deze reconstructie aan die bytes.
{
  const original = dec(fileBytes('tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'));
  const body = original.slice(original.indexOf('\nDATA;\n') + 7);
  const text = oudeKop('Eigen planning', "O'Hara " + 'x'.repeat(70 << 10))
    + body.replace('\nENDSEC;\nEND-ISO', '\nENDSEC;\nDATA;\n' + oudeWand + 'ENDSEC;\nEND-ISO');
  const bytes = enc.encode(text);
  eq('1137: dezelfde bytes als het reviewerbestand', sha(bytes), 'b824f45f24cd49caa2fb427036062d8da680c35f08434ae16357a303b9e8e482');
  for (const flagOn of [false, true]) {
    let data = text;
    const writes: string[] = [];
    const handle = {
      kind: 'file' as const, name: 'lange-auteur-tweede-sectie.ifc',
      isSameEntry: async (other: unknown) => other === handle,
      getFile: async () => new File([data], handle.name),
      queryPermission: async () => 'granted' as const, requestPermission: async () => 'granted' as const,
      createWritable: async () => {
        let next = '';
        return { write: async (chunk: unknown) => { next += typeof chunk === 'string' ? chunk : dec(chunk as Uint8Array); },
          close: async () => { data = next; writes.push(next); } };
      },
    };
    const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = flagOn ? { ifcForeignContent: true } : {}; });
    await store.getState().openOpenedFile({ name: handle.name, content: flagOn ? '' : text,
      ...(flagOn ? { bytes } : {}), ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle } });
    const state = store.getState();
    if (flagOn) {
      eq('1137 flag aan: geen document of taken', [state.fileHandle, state.filePath, state.tasks.length], [null, null, 0]);
      eq('1137 flag aan: melding in het ene kanaal', state.ui.notifications.map(n => n.messageKey), ['notifications.ifcForeignOpenUnsafe']);
      const error = await readIfcBytesDetailed(bytes).catch((e: unknown) => e) as { code?: string; fallback?: { kind: string; reason: string } };
      eq('1137 flag aan: getypeerde scannerweigering', [error.code, error.fallback?.kind, error.fallback?.reason],
        ['IFC_FOREIGN_OPEN_REFUSED', 'scanner', 'tekst-zonder-einde']);
      eq('1137 flag aan: nul writes en alle bronbytes intact', [writes.length, sha(data)], [0, sha(text)]);
    } else {
      ok('1137 flag uit: main opent twintig taken', state.fileHandle === handle && state.tasks.length === 20);
      await state.saveFile();
      eq('1137 flag uit: bestaande schuld 1061 onveranderd, één write zonder wand', [writes.length, data.includes('=IFCWALL(')], [1, false]);
    }
  }
}

// #916 fixronde 2: de hele gemaakte-koppentabel tegen vers gemeten productcode van main 1c95a8546 (na #917).
{
  const reference = JSON.parse(readFileSync(join(ROOT, 'tests/planning/fixtures/oude-kop-main.json'), 'utf8')) as { basis: string; rows: OldHeaderRow[] };
  eq('fix2 referentie: de gemeten main-commit', reference.basis, '1c95a8546fbe5fecb52e66a715402b08a256d0d5');
  const rows = await oldHeaderTable(ROOT);
  // E6 verandert bij precies deze al bestaande gemaakte gevallen de tekstterugval in een scannerweigering (1128).
  // Pin beide uitkomsten: flag uit blijft de volledige main-rij; flag aan moet weigeren met nul writes en bronbehoud.
  const scannerRefusals = new Set([
    'naam-10', 'naam-11', 'naam-12', 'naam-15', 'naam-17', 'naam-18', 'naam-19', 'naam-21',
    ...[6, 9, 10].flatMap(n => [0, 1, 2].map(field => `Sol-entiteit-${n}-veld-${field}`)),
    'Sol-lange-auteur-wand-tweede-sectie', 'Sol-lange-auteur-vreemde-property',
    ...[false, true].flatMap(unicode => ['wand-tweede-sectie', 'vreemde-property'].map(kind => `grens-${unicode}-1-${kind}`)),
  ]);
  eq('E6 oude koppentabel: ieder vastgelegd geval bestaat', [...scannerRefusals].filter(name => !rows.some(row => row.name === name)), []);
  for (const row of rows.filter(row => scannerRefusals.has(row.name))) {
    eq(`E6 ${row.name}: beide vaste instellingen`, row.routes.map(route => route.flag), [false, true]);
    const on = row.routes.find(route => route.flag)!;
    eq(`E6 ${row.name}: weigering vóór documentactivatie en beide opslagacties`,
      [on.opened, on.tasks, on.payload, on.writes, on.saveAsWrites, on.intact, on.saveAsSourceIntact, on.reopen],
      [false, 0, '', [], [], true, true, null]);
    const notices = on.notices as Array<{ severity: string; messageKey: string; detail?: string }>;
    eq(`E6 ${row.name}: exacte scannerweigering`, notices.map(n => [n.severity, n.messageKey, n.detail]),
      [['error', 'notifications.ifcForeignOpenUnsafe', 'IFC open refused: unsafe scanner fallback']]);
    const before = reference.rows.find(r => r.name === row.name)!.routes.find(route => route.flag)!;
    eq(`E6 ${row.name}: modelscan onveranderd`, on.target, before.target);
    eq(`PR 4 ${row.name}: onafhankelijke doelweigering, nul writes en bron intact`,
      [on.asTargetRefusal, on.targetWrites, on.targetIntact], [true, [], true]);
    console.log(`E6 SCANNERGEVAL ${row.name}: getypeerd geweigerd, nul writes, bron intact; flag uit tegen main getoetst`);
  }
  // Alleen de hierboven exact getoetste flag-aan-route heeft een nieuw beleid. Alle flag-uit-rijen blijven in de
  // bestaande byte-/payloadvergelijking, en alle andere flag-aan-rijen houden de oorspronkelijke drie strenge eisen.
  const comparable = (rows: OldHeaderRow[]) => rows.map(row => scannerRefusals.has(row.name)
    ? { ...row, routes: row.routes.filter(route => !route.flag) } : row);
  const table = compareOldHeaderTable(comparable(reference.rows), comparable(rows));

  eq('fix2 algemene vergelijking: nul anders', table.problems, []);
  eq('fix2 algemene vergelijking: ieder geval ingedeeld', table.same + table.repaired + table.safer + table.protectedTarget, table.cases);
  // E6 kan de vroegere (d)-opening al vóór activatie weigeren. Bewaak de (d)-vergelijking daarom apart
  // met dezelfde bestaande invoer: alleen de twee doelacties geblokkeerd, alle opening-/nieuwe-doelvelden uit main.
  // De echte onafhankelijke doelweigering van dit geval is hierboven al getoetst.
  const protectedRow = reference.rows.find(row => scannerRefusals.has(row.name)
    && row.routes.some(r => r.flag && r.writes.length > 0 && r.targetWrites.length > 0));
  eq('PR 4: bestaande tabel bevat een geval met aanvullende doelbescherming', protectedRow !== undefined, true);
  if (protectedRow) {
    const targetOnly = structuredClone(reference.rows);
    const route = targetOnly.find(row => row.name === protectedRow.name)!.routes.find(r => r.flag)!;
    Object.assign(route, { writes: [], intact: true, saveAsSourceIntact: true, foreignRetained: true,
      targetWrites: [], targetIntact: true, saveTargetRefusal: true, asTargetRefusal: true });
    eq('PR 4: alleen de aanvullende doelweigering valt onder (d)',
      compareOldHeaderTable(reference.rows, targetOnly).protectedTarget, 1);
    for (const field of ['payload', 'writes', 'saveAsWrites'] as const) {
      const changed = structuredClone(targetOnly);
      const changedRoute = changed.find(row => row.name === protectedRow.name)!.routes.find(r => r.flag)!;
      if (field === 'payload') changedRoute.payload = 'andere opening';
      else changedRoute[field].push('ongewenste write');
      eq(`PR 4: doelweigering verbergt geen wijziging in ${field}`,
        compareOldHeaderTable(reference.rows, changed).other > 0, true);
    }
  }
  for (const line of table.evidence) console.log('TABELGEVAL ' + line);
  console.log(`TABEL oude kop: ${table.cases} gevallen, (a) ${table.same} gelijk aan main, (b) ${table.repaired} lege-projectreparatie, (c) ${table.safer} veiliger met drie bewijzen, (d) ${table.protectedTarget} alleen doelbescherming, ${table.other} anders; ${scannerRefusals.size} flag-aan-routes apart exact als E6-scannerweigering getoetst`);

}

// ── 2 en 3. Modelbestanden zonder en met de flag ───────────────────────────────────────────────────────────────
const bonsai = fileBytes(`${FOREIGN}/bonsai-4d.ifc`);
const eigenPlus = fileBytes(`${FOREIGN}/eigen-plus-model.ifc`);
// Meer DATA-secties: de wand #99999 staat in de tweede sectie. Vóór de fix las `readIFC` maar tot de eerste `ENDSEC;`:
// zonder flag opende het bestand dan zonder melding, en opslaan wiste de wand.
const twoData = fileBytes(`${FOREIGN}/council/fix3-twee-data.ifc`);
// Sol en Terra (review van #870): dezelfde, met parameters bij beide sectiekoppen. Vóór de fix: `no-data-section`.
const twoDataParam = enc.encode(paramDataFile(dec(twoData)));
// De tabel van de kopvormen uit ISO 10303-21 (`DATA_KOP_VORMEN`), ook gemengd, en op een model in de enige sectie.
// Ronde 10 (besluit Trias): `readIFC` leest precies zoals main, dus alleen `DATA;` is een sectiekop. Een vorm waarin
// main een `DATA;` vindt aan het begin van de eerste sectie, gaat door de lus hieronder. De andere opent met de flag
// aan niet (hieronder apart): geen `DATA;`, of alleen het `DATA;` van de tweede sectie (de varianten `-eerste`; main leest
// dan alleen die sectie, met de wand, en weigert het model).
const kopVormen = [
  ['fix3-param.ifc', twoDataParam] as const,
  ...dataKopBestanden(dec(twoData), 'scanner').map(([name, text]) => [`fix3-${name}.ifc`, enc.encode(text)] as const),
  ...dataKopBestanden(dec(eigenPlus), 'scanner').map(([name, text]) => [`eigen-plus-${name}.ifc`, enc.encode(text)] as const),
];
const mainVindtData = (_name: string, bytes: Uint8Array) => {
  // Vóór het `DATA;` van main staat alleen de `ENDSEC` die de kop sluit: dan begint daar de eerste datasectie.
  const text = dec(bytes);
  const at = indexOfStepDataSection(text);
  return at >= 0 && (text.slice(0, at).match(/ENDSEC/gi) ?? []).length === 1;
};
for (const [name, bytes] of [
  ['bonsai-4d.ifc', bonsai], ['eigen-plus-model.ifc', eigenPlus], ['fix3-twee-data.ifc', twoData],
  ...kopVormen.filter(([name, bytes]) => mainVindtData(name, bytes)),
] as const) {
  const off = await open(false, name, bytes);
  ok(`${name} zonder flag: geweigerd`, !opened(off, name));
  ok(`${name} zonder flag: de modelweigering (knownbug 110)`, String(off.getState().ui.notifications[0]?.detail ?? '').includes('building model'));
  eq(`${name} zonder flag: geen bron`, off.getState().ifcSource, null);

  const on = await open(true, name, bytes);
  const s = on.getState();
  ok(`${name} met flag: geopend met het bestand als opslagdoel`, opened(on, name));
  // Een oud document krijgt de melding van het minutenmodel, zoals zonder model; geen fout en geen weigering.
  eq(`${name} met flag: geen fout na het openen`, notices(on).filter(n => n.severity === 'error'), []);
  ok(`${name} met flag: bron met vreemd deel`, s.ifcSource?.foreign === true && s.ifcSource.bytes === bytes);
  eq(`${name} met flag: bron-hash`, s.ifcSource?.sha256, sha(bytes));
  ok(`${name} met flag: opslaan geweigerd`, ifcSaveBlocked(s));
  // De lezer op het eigen deel (zonder V, met zijn eigen keuze van taken, via dezelfde open-route zonder flag) geeft
  // dezelfde planning.
  const reference = await open(false, name, enc.encode(ownPartText(bytes)));
  ok(`${name}: het eigen deel opent zonder flag`, opened(reference, name));
  eq(`${name} met flag: dezelfde planning als de lezer op het eigen deel`, sha(saved(on)), sha(saved(reference)));
}
// Ronde 10: een kopvorm zonder `DATA;` aan het begin van de eerste sectie voor main. Zonder flag weigert de modelweigering (de grammatica ziet de wand);
// met de flag leest de lezer van het eigen deel zoals main: geen datasectie, of alleen de tweede (met de wand). Het
// bestand opent dan niet, zonder bron: niets om op te slaan, dus niets kwijt (besluit Ethan: de flag moet veilig zijn).
for (const [name, bytes] of kopVormen.filter(([name, bytes]) => !mainVindtData(name, bytes))) {
  const off = await open(false, name, bytes);
  ok(`${name} zonder flag: geweigerd`, !opened(off, name));
  ok(`${name} zonder flag: de modelweigering (knownbug 110)`, String(off.getState().ui.notifications[0]?.detail ?? '').includes('building model'));
  const on = await open(true, name, bytes);
  ok(`${name} met flag: opent niet (zoals main)`, !opened(on, name));
  eq(`${name} met flag: geen bron`, on.getState().ifcSource, null);
  ok(`${name} met flag: een foutmelding`, notices(on).some(n => n.severity === 'error'));
}
// Ronde 3 (Sol en Terra): `DATA (` in een kapotte bestandsnaam is geen sectiekop; het model blijft herkend. De scanner
// van de flag weigert een tekst met één apostrof (`tekst-zonder-einde`) en valt terug op de gewone route: ook dan geweigerd.
// Ook de kopvormen die de scanner van de flag weigert (`scannerWeigert`): de gewone route weigert dan het model.
for (const [name, text] of [
  ...brokenNameFiles(dec(eigenPlus)).map(([n, t]) => [`eigen-plus-${n}`, t] as [string, string]),
  ...dataKopBestanden(dec(eigenPlus), 'scannerWeigert').map(([n, t]) => [`eigen-plus-${n}`, t] as [string, string]),
  ...dataKopBestanden(dec(twoData), 'scannerWeigert').map(([n, t]) => [`fix3-${n}`, t] as [string, string]),
]) {
  for (const flag of [false, true]) {
    const store = await open(flag, `${name}.ifc`, enc.encode(text));
    ok(`${name} ${flag ? 'met' : 'zonder'} flag: geweigerd`, !opened(store, `${name}.ifc`));
    ok(`${name} ${flag ? 'met' : 'zonder'} flag: de modelweigering`,
      String(store.getState().ui.notifications[0]?.detail ?? '').includes('building model'));
  }
}
// Knownbug 1151 (review van #870, ronde 12): een wand na `*⏎/` in de enige sectie. De scanner van de flag leest hem als
// commentaar (zoals `parseSTEP`), de grammatica als entiteit. Met de flag weigert openen dan ook, net als zonder flag:
// de lezer houdt de modelweigering op de tekst die hij krijgt. Zowel een eigen bestand als een bestand met een model.
{
  const hidden = (text: string) => text.replace(/^DATA;\r?\n/m,
    line => `${line}/* a *\n/ #999999=IFCWALL('3vB2YO$MX4xv5uCqZZG05x',$,$,$,$,$,$,$,$); /* b */\n`);
  const own = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  for (const [name, text] of [['showcase-1151', hidden(own)], ['eigen-plus-1151', hidden(dec(eigenPlus))]] as const) {
    ok(`${name}: de proef zit erin`, text.includes('#999999=IFCWALL('));
    for (const flagOn of [false, true]) {
      const store = await open(flagOn, `${name}.ifc`, enc.encode(text));
      ok(`${name} ${flagOn ? 'met' : 'zonder'} flag: geweigerd`, !opened(store, `${name}.ifc`));
      ok(`${name} ${flagOn ? 'met' : 'zonder'} flag: de modelweigering`,
        String(store.getState().ui.notifications[0]?.detail ?? '').includes('building model'));
      eq(`${name} ${flagOn ? 'met' : 'zonder'} flag: geen bron`, store.getState().ifcSource, null);
    }
  }
}
{
  // `eigen-plus-model` is `showcase-verbouwing-eengezinswoning.ifc` plus een model: dezelfde planning als de bron alleen.
  const on = await open(true, 'eigen-plus-model.ifc', eigenPlus);
  const showcase = await open(false, 'showcase.ifc', fileBytes('public/examples/showcase-verbouwing-eengezinswoning.ifc'));
  eq('eigen-plus-model met flag: dezelfde planning als het eigen bestand zonder model',
    sha(planningOf(buildWriteIFCInput(on.getState(), 'merge'))), sha(planningOf(buildWriteIFCInput(showcase.getState(), 'planOnly'))));
  eq('eigen-plus-model met flag: aantal objecten in het vreemde deel (C + A + V)', on.getState().ifcSource?.foreignObjectCount, 13 + 0 + 77);
  const b = await open(true, 'bonsai-4d.ifc', bonsai);
  eq('bonsai-4d met flag: aantal objecten in het vreemde deel (C + A + V)', b.getState().ifcSource?.foreignObjectCount, 15 + 13 + 127);
  const scan = scanForeign(bonsai);
  eq('bonsai-4d met flag: de taken van selectPlanning', b.getState().tasks.length, scan.ok ? scan.selection.tasks.length : -1);
}

{
  // De lezer volgt de taakkeuze van `selectPlanning` (`planningTaskStepIds`, §4.2 stap 1), ook waar hij zelf anders zou
  // kiezen. Op het corpus is een taak buiten de keuze altijd V, dus het weglaten van V geeft daar al dezelfde taken;
  // deze proef laat één taak buiten de keuze en eist dat de lezer hem niet leest.
  const text = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const stepIds: Record<string, string> = {};
  const all = readIFC(text, {}, { stepIdsOut: stepIds });
  const leaf = all.tasks.find(t => !all.tasks.some(c => c.parentId === t.id))!;
  const taskSteps = Object.entries(stepIds).filter(([k]) => k.startsWith('task:'));
  const leafStep = stepIds[`task:${leaf.id}`];
  const chosen = new Set(taskSteps.map(([, v]) => v).filter(v => v !== leafStep));
  const fewer = readIFC(text, {}, { planningTaskStepIds: chosen });
  eq('keuze: de lezer leest precies de gekozen taken', [fewer.tasks.length, fewer.tasks.some(t => t.name === leaf.name && t.id === leaf.id)],
    [all.tasks.length - 1, false]);
}

// Oude ruwe OPS-kop: de bytes-route krijgt nu een bron, zonder terugval, met dezelfde planning/opslag als main.
{
  const bytes = fileBytes('tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc');
  const detail = await readIfcBytesDetailed(bytes, {}, { createWorker: () => null });
  eq('oude kop: geen scannerterugval meer', detail.fallback, undefined);
  ok('oude kop: oorspronkelijke bytes in ifcSource', detail.result.ifcSource?.bytes === bytes);
  eq('oude kop: geen vreemd deel zonder toevoeging', detail.result.ifcSource?.foreign, false);
  const withWall = enc.encode(dec(bytes).replace('ENDSEC;\nEND-ISO-10303-21;',
    "#999999=IFCWALL('0abcdefghijkmnopqrstuv',$,'Wand',$,$,$,$,$,$);\nENDSEC;\nEND-ISO-10303-21;"));
  const wallOn = await open(true, 'oude-kop-wand.ifc', withWall);
  ok('1103 met flag: bron met wand opent', opened(wallOn, 'oude-kop-wand.ifc') && wallOn.getState().ifcSource?.foreign === true);
  ok('1103 met flag: opslagblokkade blijft dicht', ifcSaveBlocked(wallOn.getState()));
  eq('1103 met flag: oorspronkelijke modelbytes blijven de bron', wallOn.getState().ifcSource?.sha256, sha(withWall));
  const wallOff = await open(false, 'oude-kop-wand.ifc', withWall);
  ok('1103 zonder flag: modelweigering onveranderd', !opened(wallOff, 'oude-kop-wand.ifc'));
}

// ── 4. Eigen bestanden: met en zonder flag byte-gelijk ─────────────────────────────────────────────────────────
/** Eigen bestanden met bewust een vreemd deel (zie OWN_EXCEPTIONS in check-ifc-foreign-classify.ts). Met de flag openen
 *  ze met een vreemd deel en weigert opslaan; zonder flag `opensWithoutFlag`. */
const OWN_FOREIGN: Record<string, { opensWithoutFlag: boolean }> = {
  'tests/planning/fixtures/werkdag-einde-tussenwaarde.ifc': { opensWithoutFlag: true },
  'tests/planning/fixtures/ifc-arity-oude-writer-merged.ifc': { opensWithoutFlag: false },
  'tests/planning/fixtures/oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc': { opensWithoutFlag: true },
  'tests/planning/fixtures/oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc': { opensWithoutFlag: true },
};
const listIfc = (dir: string, recursive = false): string[] => readdirSync(join(ROOT, dir)).sort().flatMap((n) => {
  const pad = `${dir}/${n}`;
  if (statSync(join(ROOT, pad)).isDirectory()) return recursive ? listIfc(pad, true) : [];
  return n.endsWith('.ifc') ? [pad] : [];
});
const ownFiles = [...listIfc('public/examples'), ...listIfc('examples'), ...listIfc('tests/planning/fixtures', true)];
let ownEqual = 0;
let ownForeign = 0;
for (const pad of ownFiles) {
  const name = basename(pad);
  const bytes = fileBytes(pad);
  const off = await open(false, name, bytes);
  const on = await open(true, name, bytes);
  const foreign = OWN_FOREIGN[pad];
  const src = on.getState().ifcSource;
  if (foreign) {
    ownForeign++;
    ok(`${pad}: met flag geopend, met een vreemd deel en opslaan geweigerd`, opened(on, name) && src?.foreign === true && ifcSaveBlocked(on.getState()));
    eq(`${pad}: zonder flag zoals nu`, opened(off, name), foreign.opensWithoutFlag);
    if (foreign.opensWithoutFlag) {
      eq(`${pad}: dezelfde planning met en zonder flag`, sha(saved(on)), sha(saved(off)));
    }
    continue;
  }
  eq(`${pad}: opslagdoel met en zonder flag`, on.getState().filePath, off.getState().filePath);
  eq(`${pad}: meldingen met en zonder flag`, notices(on), notices(off));
  if (!opened(off, name)) continue;
  // Ook v2026.7.12 O'Hara krijgt nu een bron: de smalle kopherkenning verandert de planning/opslag niet.
  ok(`${pad}: met flag een bron zonder vreemd deel`, src !== null && src.foreign === false && src.foreignObjectCount === 0);
  ok(`${pad}: met flag opslaan toegestaan`, !ifcSaveBlocked(on.getState()));
  eq(`${pad}: zonder flag geen bron`, off.getState().ifcSource, null);
  const a = saved(on);
  const b = saved(off);
  eq(`${pad}: wat Opslaan schrijft is byte-gelijk met en zonder flag`, [sha(a), a.length], [sha(b), b.length]);
  if (a === b) ownEqual++;
}
eq('eigen bestanden: elke uitzondering bestaat nog', Object.keys(OWN_FOREIGN).filter(p => !ownFiles.includes(p)), []);

// ── 5. Ongedragen merge en de overige IFC-routes blijven geweigerd ──────────────────────────────────────────────────
let pickerCalls = 0;
win.showOpenFilePicker = () => { throw new Error('niet in deze test'); };
win.showSaveFilePicker = async () => { pickerCalls++; throw new DOMException('geannuleerd', 'AbortError'); };
{
  const store = await open(true, 'bonsai-4d.ifc', bonsai);
  const S = () => store.getState();
  S().addTask({ name: 'Nieuwe taak' });
  const dirty = S().isDirty;
  const blockedNotices = () => S().ui.notifications.filter(n => n.messageKey === SAVE_BLOCKED_KEY);
  const mergeNotices = () => S().ui.notifications.filter(n => n.messageKey === 'notifications.ifcForeignMergeRefused');
  await S().saveFile();
  eq('opslaan: ongedragen documentmerge geweigerd met de melding', mergeNotices().length, 1);
  eq('opslaan: de melding is een weigering (rood) en vouwt samen', mergeNotices().map(n => [n.severity, n.refusal, n.dedupeKey]),
    [['error', true, 'ifc-foreign-merge-refused']]);
  await S().saveFileAs();
  const ifcExport = await S().exportAs('ifc');
  eq('opslaan: IFC-export telt als geannuleerd', ifcExport, { ok: true, warnings: [], cancelled: true });
  const pool = await S().exportProjectWithPool();
  eq('opslaan: pool-export telt als geannuleerd', pool, { ok: true, warnings: [], cancelled: true });
  eq('opslaan: twee documentweigeringen en twee exportweigeringen', [mergeNotices()[0]?.count, blockedNotices()[0]?.count], [2, 2]);
  eq('opslaan: geen opslagdialoog geopend', pickerCalls, 0);
  eq('opslaan: het document blijft gewijzigd en houdt zijn doel', [S().isDirty, S().filePath], [dirty, 'bonsai-4d.ifc']);
  // Andere formaten dragen alleen planning en blijven mogelijk: de CSV-export komt tot de opslagdialoog.
  await S().exportAs('csv');
  eq('opslaan: CSV-export komt tot de opslagdialoog, zonder nieuwe melding', [pickerCalls, blockedNotices().length], [1, 1]);
  pickerCalls = 0;
  // Zonder vreemd deel wordt niets geweigerd: Opslaan als komt tot de dialoog.
  const own = await open(true, 'showcase.ifc', fileBytes('public/examples/showcase-verbouwing-eengezinswoning.ifc'));
  await own.getState().saveFileAs();
  eq('opslaan: een eigen bestand met flag komt tot de opslagdialoog, zonder melding',
    [pickerCalls, own.getState().ui.notifications.filter(n => n.messageKey === SAVE_BLOCKED_KEY).length], [1, 0]);
}

// ── 6. Bronbytes buiten herstel, MCP-backup en undo ────────────────────────────────────────────────────────────
{
  const store = await open(true, 'bonsai-4d.ifc', bonsai);
  const S = () => store.getState();
  const source = S().ifcSource;
  const modelIds = modelGlobalIds(bonsai);
  ok('bron: het model heeft GlobalIds om op te zoeken', modelIds.length > 10);
  const leaks = (text: string) => modelIds.filter(g => text.includes(g));
  const snapshot = recoverySnapshotInput(S());
  ok('herstel: de snapshotinvoer heeft geen bron', !('ifcSource' in snapshot.input) && !JSON.stringify(snapshot).includes('"bytes"'));
  const recoveryText = serializeRecoverySnapshot(S());
  eq('herstel: geen GlobalId van het model in de herstelsnapshot', leaks(recoveryText), []);
  eq('herstel: het manifest krijgt geen opslagdoel bij een vreemd deel', recoverySaveTarget({ ...S(), siteFileId: 'site-1', siteFileVersion: 'v1' }),
    { filePath: null, siteFileId: null, siteFileVersion: null });
  eq('herstel: zonder vreemd deel het doel zoals vóór #804',
    recoverySaveTarget({ ifcSource: null, foreignSourceMark: null, filePath: 'a.ifc', siteFileId: 'site-1', siteFileVersion: 'v1' }),
    { filePath: 'a.ifc', siteFileId: 'site-1', siteFileVersion: 'v1' });
  eq('herstel: zonder site geen siteversie (zoals vóór #804)',
    recoverySaveTarget({ ifcSource: null, foreignSourceMark: null, filePath: 'a.ifc', siteFileId: null, siteFileVersion: 'v1' }),
    { filePath: 'a.ifc', siteFileId: null, siteFileVersion: null });

  // MCP-backup: de echte `getDoc` van de app (writer op de documentpayload), met een geheugen-fs.
  const written = new Map<string, string>();
  const backup = createAppBackupService({ store } as unknown as Parameters<typeof createAppBackupService>[0], {
    getFs: async () => ({
      appDataDir: async () => '/data',
      join: async (...parts: string[]) => parts.join('/'),
      mkdir: async () => {},
      readDir: async () => [],
      writeTextFile: async (p: string, c: string) => { written.set(p, c); },
      remove: async () => {},
    }),
    autoBackupEnabled: async () => true,
    now: () => 1,
  });
  let backupError = '';
  try { await backup.makeManualBackup(); } catch (e) { backupError = (e as Error).message; }
  eq('MCP-backup: gemaakt', [backupError, written.size], ['', 1]);
  const backupText = [...written.values()].join('');
  eq('MCP-backup: geen GlobalId van het model', leaks(backupText), []);

  // Undo: buiten de snapshot, en een bewerking plus undo laat de bron staan.
  ok('undo: de snapshot heeft geen bron', !('ifcSource' in createSnapshot(S())));
  S().addTask({ name: 'Bewerking' });
  S().undo();
  ok('undo: de bron blijft na bewerking en undo', S().ifcSource === source && ifcSaveBlocked(S()));
  // IFC-paneel: de tekst van het eigen deel toepassen op hetzelfde doel houdt de bron (anders schreef Ctrl+S het model weg).
  const edited = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly')));
  S().applyProjectEdit(edited);
  ok('IFC-paneel: een bewerking houdt de bron', S().ifcSource === source && ifcSaveBlocked(S()));
  // Kopie: dezelfde bron, zonder opslagdoel; opslaan blijft geweigerd.
  S().duplicateDocument();
  ok('kopie: dezelfde bron, geen opslagdoel, opslaan geweigerd', S().ifcSource === source && S().filePath === null && ifcSaveBlocked(S()));
  // Documentwissel: de bron hoort bij zijn document.
  const copyId = S().activeDocumentId;
  S().newDocument();
  eq('nieuw document: geen bron', S().ifcSource, null);
  S().switchDocument(copyId);
  ok('documentwissel: de bron komt terug', S().ifcSource === source);
  ok('documentpayload: de bron reist per referentie', capturePayload(S()).ifcSource === source);
  // Een ander bestand openen op een eigen doel vervangt de bron.
  await open(true, 'showcase.ifc', fileBytes('public/examples/showcase-verbouwing-eengezinswoning.ifc'), store);
  ok('openen: een ander bestand krijgt zijn eigen bron', S().ifcSource !== source && S().ifcSource?.foreign === false);
}

// ── 7a. Fase 1c: een onbekende kop mag vreemde gegevens niet onbeveiligd openen ────────────────────────────
{
  const plain = dec(fileBytes('public/examples/showcase-verbouwing-eengezinswoning.ifc'));
  const withPset = (text: string) => text.replace(/ENDSEC;\s*END-ISO-10303-21;/,
    "#999997=IFCPROPERTYSINGLEVALUE('ExternKenmerk',$,IFCLABEL('moet blijven'),$);\n"
    + "#999998=IFCPROPERTYSET('0123456789012345678901',$,'ExternPakket',$,(#999997));\nENDSEC;\nEND-ISO-10303-21;");
  for (const schema of ['IFC_ONBEKEND', '']) {
    const base = plain.replace(/FILE_SCHEMA\(.*?\);/, schema ? `FILE_SCHEMA(('${schema}'));` : '');
    for (const foreign of [false, true]) {
      const bytes = enc.encode(foreign ? withPset(base) : base);
      const name = `kop-${schema || 'ontbreekt'}-${foreign}.ifc`;
      const off = await open(false, name, bytes);
      ok(`${name}: zonder flag opent zoals main`, opened(off, name));
      if (foreign) ok(`${name}: main laat de externe pset bij schrijven weg`, !saved(off).includes('ExternPakket'));
      const on = await open(true, name, bytes);
      if (foreign) {
        ok(`${name}: met flag ontstaat geen document`, !opened(on, name) && on.getState().tasks.length === 0);
        eq(`${name}: getypeerde openingsmelding`, on.getState().ui.notifications[0]?.messageKey, 'notifications.ifcForeignOpenSchema');
        const error = await readIfcBytes(bytes).catch((e: unknown) => e) as { code?: string; fallback?: { kind: string } };
        eq(`${name}: getypeerde reden`, [error.code, error.fallback?.kind], ['IFC_FOREIGN_OPEN_REFUSED', 'schema']);
      } else {
        ok(`${name}: zonder vreemd deel opent met flag`, opened(on, name));
        eq(`${name}: gewone opslag blijft bytegelijk`, saved(on), saved(off));
        ok(`${name}: gewone opslag niet geblokkeerd`, !ifcSaveBlocked(on.getState()));
      }
    }
  }
  // Verlaag alleen via de bestaande leesopties: geen bestand van 300 MiB nodig. Het integratiebewijs
  // onder /tmp verlaagt daarnaast tijdelijk de constante en opent dezelfde gevallen via openOpenedFile.
  for (const foreign of [false, true]) {
    const bytes = enc.encode(foreign ? withPset(plain) : plain);
    const value = await readIfcBytesDetailed(bytes, {}, { maxBytes: 1 }).catch((e: unknown) => e);
    if (foreign) {
      const e = value as { code?: string; fallback?: { kind: string } };
      eq('te groot vreemd: getypeerd geweigerd', [e.code, e.fallback?.kind], ['IFC_FOREIGN_OPEN_REFUSED', 'te-groot']);
    } else {
      const r = value as Awaited<ReturnType<typeof readIfcBytesDetailed>>;
      eq('te groot eigen: bewezen gewone route', [r.fallback?.kind, r.result?.ifcSource], ['te-groot', undefined]);
      const store = createAppStoreContext().store;
      store.getState().openAsDocument(r.result, { name: 'groot-eigen.ifc', ref: null });
      ok('te groot eigen: IFC-opslag toegestaan', !ifcSaveBlocked(store.getState()));
      eq('te groot eigen: zelfde opslag als main', saved(store), saved(await open(false, 'groot-eigen.ifc', bytes)));
    }
  }
  // Dezelfde hele DATA-staart met een kapotte oude kop: zonder vreemd deel bruikbaar, met vreemd deel geweigerd.
  for (const foreign of [false, true]) {
    const oldHeader = dec(fileBytes('tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'));
    const malformed = foreign ? withPset(oldHeader) : oldHeader;
    const bytes = enc.encode(malformed);
    const off = await open(false, 'scanner-uit.ifc', bytes);
    const on = await open(true, 'scanner-aan.ifc', bytes);
    ok(`scanner ${foreign}: main opent`, opened(off, 'scanner-uit.ifc'));
    if (foreign) {
      // Nu veilig geweigerd; na de oude-kop-PR mag dit ook met een bewaarde bron en de bestaande opslagblokkade openen.
      ok('oude kop met externe pset: geen verliesgevend document', !opened(on, 'scanner-aan.ifc')
        || (on.getState().ifcSource?.foreign === true && ifcSaveBlocked(on.getState())));
      ok('oude kop met externe pset: zonder flag laat gewone opslag de pset weg', !saved(off).includes('ExternPakket'));
    } else {
      ok('oude kop zonder vreemd deel: eindverwachting opent zoals main (1103)', opened(on, 'scanner-aan.ifc'));
    }
    const scan = scanForeign(bytes);
    console.log(`GEMETEN oude kop: foreign=${foreign}, scan=${scan.ok ? 'ok' : scan.reason}, flag-uit=${opened(off, 'scanner-uit.ifc')}, flag-aan=${opened(on, 'scanner-aan.ifc')}, blocked=${ifcSaveBlocked(on.getState())}`);
    if (!foreign) {
      ok('scanner eigen: opslag blijft vrij', !ifcSaveBlocked(on.getState()));
      eq('scanner eigen: gewone opslag bytegelijk', saved(on), saved(off));
    }
    // IFC2X3 blijft de expliciete uitzondering: planning met melding, de modelweigering is hieronder beproefd.
    const legacy = enc.encode((foreign ? withPset(plain) : plain).replace(/FILE_SCHEMA\(.*?\);/, "FILE_SCHEMA(('IFC2X3'));"));
    const legacyOn = await open(true, 'legacy.ifc', legacy);
    const legacyOff = await open(false, 'legacy.ifc', legacy);
    ok(`IFC2X3 ${foreign}: met en zonder flag geopend`, opened(legacyOn, 'legacy.ifc') && opened(legacyOff, 'legacy.ifc'));
    ok(`IFC2X3 ${foreign}: expliciete verliesmelding`, notices(legacyOn).some(n => n.messageKey === 'notifications.ifc2x3PlanningOnly' && n.sticky));
    eq(`IFC2X3 ${foreign}: opslag zoals main`, saved(legacyOn), saved(legacyOff));
  }
  // Bestaande Worker-naad: alleen de selectie af laten wijken. De bytes, de lezer en de app-route blijven echt.
  const originalWorker = globalThis.Worker;
  try {
    for (const foreign of [false, true]) {
      class DifferentSelectionWorker {
        onmessage: ((event: { data: unknown }) => void) | null = null;
        onerror = null;
        onmessageerror = null;
        terminate() {}
        postMessage(msg: { id: number; bytes: Uint8Array }) {
          const outcome = scanForeign(msg.bytes);
          if (!outcome.ok) throw new Error(outcome.message);
          const data = { id: msg.id, outcome: { ...outcome, selection: { ...outcome.selection, resources: Int32Array.of(-1) } } };
          queueMicrotask(() => this.onmessage?.({ data }));
        }
      }
      globalThis.Worker = DifferentSelectionWorker as unknown as typeof Worker;
      const bytes = enc.encode(foreign ? withPset(plain) : plain);
      const on = await open(true, 'selectie-aan.ifc', bytes);
      const off = await open(false, 'selectie-uit.ifc', bytes);
      ok(`selectie ${foreign}: main opent`, opened(off, 'selectie-uit.ifc'));
      eq(`selectie ${foreign}: veilige uitkomst met flag`, opened(on, 'selectie-aan.ifc'), !foreign);
      if (foreign) eq('selectie vreemd: getypeerde melding', on.getState().ui.notifications[0]?.messageKey, 'notifications.ifcForeignOpenUnsafe');
      else eq('selectie eigen: bytegelijk', saved(on), saved(off));
    }
  } finally { globalThis.Worker = originalWorker; }
  const { ifcSchemaQuestionFor, ifcSchemaBlocksSilentWrite } = await import('@/services/ifc/ifcSchemaQuestion');
  for (const schema of ['IFC4', 'IFC4X3', 'IFC4X3_ADD1', 'IFC4X3_ADD2', 'IFC4X3_TC1']) {
    const bytes = enc.encode(withPset(plain.replace(/FILE_SCHEMA\(.*?\);/, `FILE_SCHEMA(('${schema}'));`)));
    const store = await open(true, `schema-${schema}.ifc`, bytes);
    const S = () => store.getState();
    const before = S().project.ifcSchema;
    const source = S().ifcSource;
    eq(`${schema}: letterlijke kop in bron`, source?.schemaName, schema);
    eq(`${schema}: geen schemavraag`, ifcSchemaQuestionFor({ ifcSchemaUnconfirmed: schema === 'IFC4X3_ADD2' ? 'IFC4' : schema }, source), null);
    ok(`${schema}: stille schemacontrole leest bron`, !ifcSchemaBlocksSilentWrite({ ifcSchemaUnconfirmed: 'IFC2X3' }, source));
    ok(`${schema}: directe schemakeuze geweigerd`, !S().setIfcSchema(before === 'IFC4' ? 'IFC4X3' : 'IFC4'));
    S().setProject({ ifcSchema: before === 'IFC4' ? 'IFC4X3' : 'IFC4', name: 'Andere naam' });
    eq(`${schema}: projectpatch behoudt schema`, S().project.ifcSchema, before);
    S().applyProjectInfo({ ifcSchema: before === 'IFC4' ? 'IFC4X3' : 'IFC4' }, undefined);
    const { createMcpTransactions } = await import('@/state/runtime/createMcpTransactions');
    const transactions = createMcpTransactions(contexts.get(store)!);
    const mcp = transactions.run(() => {
      transactions.draft.setProject({ ifcSchema: before === 'IFC4' ? 'IFC4X3' : 'IFC4', name: 'Via MCP' });
    });
    ok(`${schema}: MCP-draft voert metadata uit`, mcp.ok && S().project.name === 'Via MCP');
    eq(`${schema}: MCP-draft bewaart schema`, S().project.ifcSchema, before);
    const { makeMcpContext } = await import('../mcp/harness');
    const { handleMcpMessage } = await import('@/services/mcp/dispatcher');
    const response = JSON.parse(await handleMcpMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'planner_update_project', arguments: { ifcSchema: 'IFC4', name: 'Ongeoorloofd' } },
    }), makeMcpContext(contexts.get(store)!)));
    ok(`${schema}: MCP-tool weigert een schemaparameter`, response.error !== undefined || response.result?.isError === true);
    eq(`${schema}: MCP-tool wijzigt geen schema`, S().project.ifcSchema, before);
    S().undo(); S().redo();
    eq(`${schema}: undo en redo behouden schema en bron`, [S().project.ifcSchema, S().ifcSource === source], [before, true]);
    ok(`${schema}: opslagblokkade blijft dicht`, ifcSaveBlocked(S()));
    const off = await open(false, `schema-uit-${schema}.ifc`, bytes);
    ok(`${schema}: zonder flag blijft keuze mogelijk`, off.getState().setIfcSchema(before === 'IFC4' ? 'IFC4X3' : 'IFC4'));
  }
}

const component = readFileSync(join(ROOT, 'src/components/settings/ProjectInfoPanelContent.tsx'), 'utf8');
ok('Projectinstellingen: keuze gebonden aan vreemd deel, met reden en letterlijke kop',
  component.includes('schemaLocked = !isNew && hasForeignContent(ifcSource)')
  && component.includes('disabled={schemaLocked}') && component.includes('schemaLocked ? ifcSource!.schemaName')
  && component.includes("tMenu('projectInfo.ifcSchema.foreignLocked')"));

// ── 7. Grenzen van de scanner: geen onbeveiligde terugval ───────────────────────────────────────────────────
{
  const showcase = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  /** Een losse persoon vlak vóór `ENDSEC;` van de DATA-sectie. */
  const withPerson = (text: string, id: string) => {
    const at = text.lastIndexOf('ENDSEC;');
    return `${text.slice(0, at)}#${id}=IFCPERSON($,'Grens',$,$,$,$,$,$);\n${text.slice(at)}`;
  };
  // Grens van knownbug 1007: `#2147483647` scant, `#2147483648` niet.
  const atLimit = enc.encode(withPerson(showcase, '2147483647'));
  const r1 = await readIfcBytesDetailed(atLimit);
  ok('grens: #2147483647 gaat door de bytes-route', r1.fallback === undefined && r1.result.ifcSource !== undefined);
  ok('grens: de losse persoon is een vreemd deel', r1.result.ifcSource?.foreign === true);
  const overLimit = enc.encode(withPerson(showcase, '2147483648'));
  const r2 = await readIfcBytesDetailed(overLimit).catch((e: Error) => e);
  ok('fase 1c: #2147483648 weigert de onzekere terugval', r2 instanceof Error);
  const store = await open(true, 'grens.ifc', overLimit);
  ok('fase 1c: de store maakt geen onbeveiligd document', !opened(store, 'grens.ifc'));
  eq('fase 1c: getypeerde scannerweigering in het meldingenkanaal', store.getState().ui.notifications[0]?.messageKey,
    'notifications.ifcForeignOpenUnsafe');
  const dup = enc.encode(withPerson(withPerson(showcase, '999998'), '999998'));
  const r3 = await readIfcBytesDetailed(dup).catch((e: Error) => e);
  ok('fase 1c: dubbele ids geven geen onbeveiligde terugval', r3 instanceof Error);
  // Een modelbestand dat de scanner weigert: de huidige route, dus de modelweigering.
  const bonsaiOver = enc.encode(withPerson(dec(bonsai), '2147483648'));
  let refusal = '';
  try { await readIfcBytes(bonsaiOver); } catch (e) { refusal = (e as Error).message; }
  ok('afwijking 7: een model dat de scanner weigert, blijft geweigerd', refusal.includes('building model'));
  const bonsaiStore = await open(true, 'bonsai-over.ifc', bonsaiOver);
  ok('afwijking 7: de store weigert het, met de modelweigering', !opened(bonsaiStore, 'bonsai-over.ifc')
    && String(bonsaiStore.getState().ui.notifications[0]?.detail ?? '').includes('building model'));
  // Schema (§4.11): IFC2X3 met model blijft geweigerd.
  const ifc2x3 = fileBytes(`${FOREIGN}/model-ifc2x3.ifc`);
  const r4 = await readIfcBytesDetailed(ifc2x3).catch((e: Error) => e);
  ok('schema: IFC2X3 met model blijft geweigerd', r4 instanceof Error && r4.message.includes('building model'));
  const r5 = await readIfcBytesDetailed(fileBytes(`${FOREIGN}/model-ifc4.ifc`));
  ok('schema: IFC4 met model opent met een vreemd deel', r5.fallback === undefined && r5.result.ifcSource?.foreign === true);
}

// ── 8. Worker en terugval ──────────────────────────────────────────────────────────────────────────────────────
{
  const { foreignScanTransferables } = await import('@/services/ifc/foreign/foreignScan');
  /** Een nep-Worker zoals de echte: kopie van de bytes via `structuredClone`, antwoord async met `transfer`, de indeling in
   *  de "Worker". */
  let terminated = 0;
  const fakeWorker = (mode: 'ok' | 'transport' | 'indeling' | 'stil'): ForeignScanWorker => {
    const w: ForeignScanWorker = {
      onmessage: null, onerror: null, onmessageerror: null,
      terminate: () => { terminated++; },
      postMessage: (msg: { id: number; bytes: Uint8Array }) => {
        const copy = structuredClone(msg);
        setTimeout(() => {
          if (mode === 'stil') return;
          if (mode === 'transport') {
            (w.onerror as unknown as (e: { message: string; preventDefault: () => void }) => void)?.({ message: 'start mislukt', preventDefault: () => {} });
            return;
          }
          const deliver = (data: unknown, transfer: ArrayBuffer[] = []) =>
            (w.onmessage as unknown as (e: { data: unknown }) => void)?.({ data: structuredClone(data, { transfer }) });
          if (mode === 'indeling') { deliver({ id: copy.id, error: 'indeling faalt' }); return; }
          // Zoals `foreignScan.worker.ts`: de typed arrays gaan over met `transfer`, niet als kopie.
          const outcome = scanForeign(copy.bytes);
          deliver({ id: copy.id, outcome }, foreignScanTransferables(outcome));
        }, 0);
      },
    } as unknown as ForeignScanWorker;
    return w;
  };
  const sourceOf = async (opts: Parameters<typeof readIfcBytesDetailed>[2]) => {
    reseed(0x804);
    const r = await readIfcBytesDetailed(bonsai, {}, opts);
    const { bytes, ...rest } = r.result.ifcSource!;
    return JSON.stringify({ planning: planningOf(r.result), bytes: sha(bytes), rest: { ...rest,
      chunkStarts: Array.from(rest.chunkStarts), chunkIds: Array.from(rest.chunkIds), classes: Array.from(rest.classes) } });
  };
  const without = await sourceOf({ createWorker: () => null });
  eq('Worker: met Worker hetzelfde als zonder', sha(await sourceOf({ createWorker: () => fakeWorker('ok') })), sha(without));
  eq('Worker: een transportfout valt terug, met dezelfde uitkomst', sha(await sourceOf({ createWorker: () => fakeWorker('transport') })), sha(without));
  eq('Worker: geen antwoord op tijd valt terug', sha(await sourceOf({ createWorker: () => fakeWorker('stil'), timeoutMs: 20 })), sha(without));
  eq('Worker: een fout bij het maken valt terug', sha(await sourceOf({ createWorker: () => { throw new Error('CSP'); } })), sha(without));
  let failure = '';
  try { await readIfcBytesDetailed(bonsai, {}, { createWorker: () => fakeWorker('indeling') }); } catch (e) { failure = (e as Error).message; }
  eq('Worker: een fout in de indeling zelf valt niet terug', failure, 'indeling faalt');
  eq('Worker: elke Worker is gestopt', terminated, 4);
}

// #885 / review Sol (#889): twee waarden met dezelfde codetekst in één type. De writer zet dan het waarde-id naast de
// enumeratie in `OPS_ActivityCodes`; de bytesroute moet dat als eigen herkennen (geen vreemd deel, geen verlies) en de
// taak na herordenen op dezelfde waarde laten wijzen.
{
  const dup = createAppStoreContext().store;
  const D = () => dup.getState();
  D().newProject();
  const type = D().addActivityCodeType('Status');
  const first = D().addActivityCodeValue(type, { code: 'Q', description: 'Offerte ontvangen' });
  const second = D().addActivityCodeValue(type, { code: 'Q', description: 'Offerte goedgekeurd' });
  const task = D().addTask({ name: 'Dubbel', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  D().setTaskActivityCode(task, type, first);
  D().moveActivityCodeValue(type, second, -1);
  const bytes = enc.encode(writeIFC(buildWriteIFCInput(D(), 'planOnly')));
  const on = await open(true, 'dubbele-codes.ifc', bytes);
  const st = on.getState();
  const ty = st.activityCodeTypes.find(t => t.name === 'Status');
  eq('dubbele codetekst via bytes: de taak houdt haar waarde',
    ty?.values.find(v => v.id === st.tasks.find(t => t.name === 'Dubbel')?.activityCodes?.[ty.id])?.description, 'Offerte ontvangen');
  eq('dubbele codetekst via bytes: geen vreemd deel', st.ifcSource?.foreignObjectCount ?? 0, 0);
  ok('dubbele codetekst via bytes: opslaan is niet geblokkeerd', !ifcSaveBlocked(st));
}

console.error = realError;
if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-open: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-open: alle checks groen (${checks}; ${ownEqual} eigen bestanden byte-gelijk met en zonder flag, `
  + `${ownForeign} eigen bestanden met een bewust vreemd deel)`);
process.exit(0);
