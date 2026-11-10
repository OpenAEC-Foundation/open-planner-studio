// Gedeelde kern van de pariteitsproef tegen main (#804 fase 1a, bijsturing 1 punt 2 van de orkestrator).
//
// Eis: met de flag `ifcForeignContent` uit gedraagt de app zich byte-gelijk aan main. Deze kern draait twee keer, met
// precies dezelfde code:
//  - `scripts/proef/maak-main-pariteit.mjs` bundelt hem tegen de src van main (`2a66df33c`) en schrijft de uitkomst als
//    fixture weg (`tests/planning/fixtures/main-pariteit.json`);
//  - `check-ifc-foreign-pariteit.ts` bundelt hem tegen de src van deze branch en vergelijkt.
// Daarom gebruikt hij alleen API's die op main al bestaan, en importeert hij niets uit deze branch buiten `@/`.
//
// Per bestand: een verse store, dezelfde open-route als Bestand → Openen (`openOpenedFile`), en dan wat Opslaan schrijft
// (`writeIFC(buildWriteIFCInput(state))`, zoals `writeActiveDocument`). Een geweigerd bestand geeft de melding van het
// meldingenkanaal. Daarna (fixronde 1, VERVOLG van Terra) de echte acties Opslaan en Opslaan als, met hun guards en de
// bestandslaag van de browser (`showSaveFilePicker` → `createWritable`), met een handle in het geheugen als naad: die API
// bestaat op main ook. Vaste klok, een vaste reeks "willekeurige" getallen en dezelfde volgorde van `generateId` maken de
// uitvoer deterministisch; de tijdzone zet de aanroeper (Europe/Amsterdam).
//
// Fixronde 2 (VERVOLG van Terra): ook Ctrl+S naar een BESTAAND doel, per route: een handle met de bytes van het bestand,
// een Tauri-pad (de echte plugin-JS met nep-IPC naar Node-fs, `nodeFileIpc.ts`) en een site-bestand (`window.openaecHost`
// in het geheugen). Per actie ook de aanroepen naar buiten, in volgorde: zo ziet de check dat de branch met de flag uit
// het doel niet extra leest.
//
// Fixronde 4 (VERVOLG 3 van Terra en Sol): ook een MCP-backup met het kenmerk van een bron met een vreemd deel (pset
// `OPS_RecoveryForeignSource`, `tests/planning/fixtures/backup-met-kenmerk.ifc`). Per bestand ook of het document na het
// openen een kenmerk heeft (`kenmerk`; op main bestaat dat veld niet). Dit bestand is de bewuste uitzondering op de
// pariteit (wrakko, 10 november 2026): de branch opent het zonder opslagdoel en met het kenmerk, main met een opslagdoel.
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { installNodeFileIpc } from './nodeFileIpc';

export interface ParityInput {
  name: string;
  text: string;
}

/** Een melding zoals de store hem bewaart, zonder `id` (die verschilt per run). */
export type ParityNotice = Record<string, unknown>;

export interface ParityOutput {
  name: string;
  /** Het opslagdoel na het openen; `null` als het openen mislukte. */
  filePath: string | null;
  /** Wat Opslaan schrijft; afwezig als het openen mislukte. */
  saved?: string;
  notices: ParityNotice[];
  /** De echte acties Opslaan en Opslaan als (alleen na een geslaagd openen). */
  actions?: ParityAction[];
  /** Fixronde 2: Ctrl+S naar een bestaand doel, per route (alleen na een geslaagd openen). */
  targetActions?: ParityTargetAction[];
  /** Fixronde 4: het document heeft na het openen een kenmerk van een bron met een vreemd deel (alleen op de branch). */
  mark?: true;
}

/** Uitkomst van Ctrl+S naar een bestaand doel. */
export interface ParityTargetAction {
  route: 'handle' | 'pad' | 'site';
  outcome: 'klaar' | 'hangt';
  /** Wat in het doel kwam, in volgorde (leeg: het doel bleef zoals het was). */
  writes: string[];
  filePath: string | null;
  isDirty: boolean;
  notices: ParityNotice[];
  /** De aanroepen naar buiten tijdens Ctrl+S, in volgorde, zonder paden (handle-methoden, IPC-commando's met opties,
   *  site-functies). */
  calls: string[];
}

/** Uitkomst van één echte opslagactie. */
export interface ParityAction {
  action: 'saveFile' | 'saveFileAs';
  /** `klaar`, of `hangt` als de actie na de wachttijd nog wacht (bijv. op een vraag). */
  outcome: 'klaar' | 'hangt';
  /** Hoe vaak de opslagdialoog kwam. */
  pickerCalls: number;
  /** Wat de bestandslaag schreef, in volgorde. */
  writes: string[];
  /** Opslagdoel en `isDirty` na de actie. */
  filePath: string | null;
  isDirty: boolean;
  /** Meldingen die de actie gaf. */
  notices: ParityNotice[];
}

export interface ParityRun {
  /** `binaryExtensions()` van de open-routes (de keuze tekst of bytes in de bestandslaag). */
  binaryExtensions: string[];
  results: ParityOutput[];
}

const FIXED_NOW = Date.UTC(2026, 10, 9, 12, 0, 0);

/** Een FSA-handle in het geheugen: wat `createWritable` krijgt, komt in `writes`. `calls` (fixronde 2) telt de methoden. */
function memoryHandle(name: string, writes: string[], initial = '', calls: string[] = []): unknown {
  let data = initial;
  const handle = {
    kind: 'file', name,
    isSameEntry: async (other: unknown) => { calls.push('isSameEntry'); return other === handle; },
    getFile: async () => { calls.push('getFile'); return new File([data], name); },
    createWritable: async () => {
      calls.push('createWritable');
      let buffer = '';
      return {
        write: async (chunk: unknown) => { buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk as Uint8Array); },
        close: async () => { data = buffer; writes.push(buffer); },
      };
    },
    queryPermission: async () => { calls.push('queryPermission'); return 'granted'; },
    requestPermission: async () => { calls.push('requestPermission'); return 'granted'; },
  };
  return handle;
}

type ParityStore = { getState(): { saveFile(): Promise<void>; filePath: string | null; isDirty: boolean;
  ui: { notifications: { id: string }[] };
  openOpenedFile(file: { name: string; content: string; ref: unknown }): Promise<unknown> } };

/** Wacht op `run`, hoogstens 10 s. */
async function within(run: Promise<unknown>): Promise<'klaar' | 'hangt'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    run.then(() => 'klaar' as const),
    new Promise<'hangt'>((resolve) => { timer = setTimeout(() => resolve('hangt'), 10_000); }),
  ]);
  clearTimeout(timer);
  return outcome;
}

/** Fixronde 2: open `input` met een bestaand doel van `route`, en druk Ctrl+S. */
async function runExistingTarget(store: ParityStore, route: ParityTargetAction['route'], input: ParityInput): Promise<ParityTargetAction> {
  const g = globalThis as unknown as { window: Record<string, unknown> };
  const browserWindow = g.window;
  const calls: string[] = [];
  const writes: string[] = [];
  let finish: () => void = () => {};
  let ref: unknown;
  let ipc: ReturnType<typeof installNodeFileIpc> | null = null;
  let mark = 0;
  /** De tijdelijke map van de Tauri-route: in de uitkomst `<map>`, zodat die gelijk is tussen runs. */
  let dirOf = '';
  if (route === 'handle') {
    browserWindow.showOpenFilePicker = () => { throw new Error('niet in de pariteitsproef'); };
    browserWindow.showSaveFilePicker = async () => { calls.push('showSaveFilePicker'); throw new DOMException('geannuleerd', 'AbortError'); };
    ref = { kind: 'handle', handle: memoryHandle(input.name, writes, input.text, calls) };
    finish = () => { delete browserWindow.showSaveFilePicker; delete browserWindow.showOpenFilePicker; };
  } else if (route === 'pad') {
    const dir = mkdtempSync(join(tmpdir(), 'ops-pariteit-pad-'));
    dirOf = dir;
    const path = join(dir, input.name);
    writeFileSync(path, input.text);
    const fileIpc = installNodeFileIpc();
    ipc = fileIpc;
    g.window.parent = g.window;
    const internals = g.window.__TAURI_INTERNALS__ as { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> };
    const inner = internals.invoke;
    internals.invoke = async (command, args, options) => {
      if (command === 'plugin:dialog|save') { calls.push(command); return null; }
      if (!command.startsWith('plugin:fs|') && !command.startsWith('plugin:resources|')) { calls.push(command); return null; }
      return inner(command, args, options);
    };
    ref = { kind: 'path', path };
    finish = () => {
      // De bestandsmodus volgt de umask van de machine: in de uitkomst alleen of hij er is.
      for (const c of fileIpc.calls.slice(mark)) {
        calls.push(c.options ? `${c.command} ${JSON.stringify(c.options).replace(/"mode":\d+/, '"mode":"<umask>"')}` : c.command);
      }
      const after = readFileSync(path, 'utf8');
      if (after !== input.text) writes.push(after);
      fileIpc.dispose();
      g.window = browserWindow;
      rmSync(dir, { recursive: true, force: true });
    };
  } else {
    browserWindow.openaecHost = { storage: {
      list: async () => { calls.push('list'); return []; },
      open: async (id: string) => { calls.push(`open ${id}`); return { file: { id, name: input.name, version: 'v1' }, data: input.text }; },
      save: async (request: { id?: string; name: string; data: Blob }) => {
        calls.push(`save ${request.id ?? '-'}`);
        writes.push(await request.data.text());
        return { id: request.id ?? 'nieuw', name: request.name, version: 'v2' };
      },
      versions: async (id: string) => { calls.push(`versions ${id}`); return [{ version: 'v1' }]; },
    } };
    ref = { kind: 'site', id: 'S1' };
    finish = () => { delete browserWindow.openaecHost; };
  }
  try {
    await store.getState().openOpenedFile({ name: input.name, content: input.text, ref });
    // Alleen de aanroepen van Ctrl+S tellen, niet die van het openen.
    calls.length = 0;
    mark = ipc?.calls.length ?? 0;
    const before = new Set(store.getState().ui.notifications.map(n => n.id));
    const outcome = await within(store.getState().saveFile());
    const state = store.getState();
    const neutral = (text: string) => (dirOf ? text.split(dirOf).join('<map>') : text);
    return {
      route, outcome, writes, filePath: state.filePath === null ? null : neutral(state.filePath), isDirty: state.isDirty, calls,
      notices: state.ui.notifications.filter(n => !before.has(n.id))
        .map(({ id: _id, ...rest }) => JSON.parse(neutral(JSON.stringify(rest))) as ParityNotice),
    };
  } finally {
    finish();
  }
}

/** De echte opslagactie op `store`, met een handle in het geheugen als gekozen bestand. */
async function runAction(
  store: { getState(): { saveFile(): Promise<void>; saveFileAs(): Promise<void>; filePath: string | null; isDirty: boolean;
    ui: { notifications: { id: string }[] } } },
  action: ParityAction['action'], name: string,
): Promise<ParityAction> {
  const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
  const writes: string[] = [];
  let pickerCalls = 0;
  // De bestandslaag kiest de FSA-route als `showOpenFilePicker` bestaat (`hasFSA`); openen gebeurt hier niet.
  win.showOpenFilePicker = () => { throw new Error('niet in de pariteitsproef'); };
  win.showSaveFilePicker = async () => { pickerCalls++; return memoryHandle(name, writes); };
  const before = new Set(store.getState().ui.notifications.map(n => n.id));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    store.getState()[action]().then(() => 'klaar' as const),
    new Promise<'hangt'>((resolve) => { timer = setTimeout(() => resolve('hangt'), 10_000); }),
  ]);
  clearTimeout(timer);
  delete win.showSaveFilePicker;
  delete win.showOpenFilePicker;
  const state = store.getState();
  return {
    action, outcome, pickerCalls, writes, filePath: state.filePath, isDirty: state.isDirty,
    notices: state.ui.notifications.filter(n => !before.has(n.id))
      .map(({ id: _id, ...rest }) => JSON.parse(JSON.stringify(rest)) as ParityNotice),
  };
}

/** Vaste klok en een vaste reeks voor `Math.random` (mulberry32). Geeft een functie die de reeks opnieuw start. Ook
 *  gebruikt door `check-ifc-foreign-open.ts`. */
export function installDeterminism(): (seed: number) => void {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(FIXED_NOW); else super(...(a as [number]));
    }
    static now(): number { return FIXED_NOW; }
  }
  globalThis.Date = FixedDate as unknown as DateConstructor;
  let state = 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (seed) => { state = seed | 0; };
}

/** Een kale browseromgeving zoals `check-recent-open.ts`: geen Tauri, geen site, geheugenopslag. */
export function installBrowserStubs(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  const win: Record<string, unknown> = {};
  win.parent = win;
  g.window = win;
  const mem = new Map<string, string>();
  const storage = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => { mem.set(key, value); },
    removeItem: (key: string) => { mem.delete(key); },
    clear: () => { mem.clear(); },
  };
  g.localStorage = storage;
  g.sessionStorage = storage;
}

export async function runParity(inputs: readonly ParityInput[]): Promise<ParityRun> {
  const reseed = installDeterminism();
  installBrowserStubs();
  const { createAppStoreContext } = await import('@/state/appStoreFactory');
  const { writeIFC } = await import('@/services/ifc/ifcWriter');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { binaryExtensions } = await import('@/services/formatRegistry');
  const results: ParityOutput[] = [];
  for (const input of inputs) {
    reseed(0x804);
    const { store } = createAppStoreContext();
    const S = () => store.getState();
    await S().openOpenedFile({ name: input.name, content: input.text, ref: null });
    const state = S();
    const opened = state.filePath === input.name;
    const result: ParityOutput = {
      name: input.name,
      filePath: opened ? state.filePath : null,
      ...((state as { foreignSourceMark?: unknown }).foreignSourceMark ? { mark: true as const } : {}),
      ...(opened ? { saved: writeIFC(buildWriteIFCInput(state)) } : {}),
      notices: state.ui.notifications.map(({ id: _id, ...rest }) => JSON.parse(JSON.stringify(rest)) as ParityNotice),
    };
    if (opened) {
      result.actions = [
        await runAction(store, 'saveFile', input.name),
        await runAction(store, 'saveFileAs', `kopie-${input.name}`),
      ];
      // Fixronde 2: Ctrl+S naar een bestaand doel, elke route in een verse store.
      result.targetActions = [];
      for (const route of ['handle', 'pad', 'site'] as const) {
        reseed(0x804);
        result.targetActions.push(await runExistingTarget(createAppStoreContext().store as unknown as ParityStore, route, input));
      }
    }
    results.push(result);
  }
  return { binaryExtensions: binaryExtensions(), results };
}

/** De invoer: de eigen voorbeelden en de bestanden met een gebouwmodel uit het corpus. Paden vanaf de repo-root; een map
 *  telt met al haar `.ifc`-bestanden (niet recursief). */
export const PARITY_FILES: readonly string[] = [
  'public/examples',
  'examples',
  'tests/fixtures/ifc-foreign/bonsai-4d.ifc',
  'tests/fixtures/ifc-foreign/eigen-plus-model.ifc',
  'tests/fixtures/ifc-foreign/oud-eigen-0.1-plus-model.ifc',
  'tests/fixtures/ifc-foreign/model-ifc4.ifc',
  'tests/fixtures/ifc-foreign/model-ifc2x3.ifc',
  'tests/planning/fixtures/ifc-arity-oude-writer-merged.ifc',
  'tests/planning/fixtures/backup-met-kenmerk.ifc',
  // Fixronde 1 van #867, BLOKKEERT 1: een eigen voorbeeld met `ProjectName` in OPS_ProjectSettings. Met de flag uit leest
  // en schrijft de branch het zoals main (de lezer leest die property alleen bij een project dat niet P is).
  'tests/planning/fixtures/projectnaam-in-settings',
];

export interface ParityFixtureEntry {
  /** Pad vanaf de repo-root. */
  pad: string;
  invoerSha256: string;
  /** Het opslagdoel na het openen; `null` = geweigerd. */
  filePath: string | null;
  /** SHA-256 en lengte van wat Opslaan schrijft (byte-gelijk ⇔ dezelfde hash). */
  opslaanSha256?: string;
  opslaanLengte?: number;
  meldingen: ParityNotice[];
  /** De echte acties Opslaan en Opslaan als (fixronde 1): per actie de uitkomst, met SHA-256 en lengte per write. */
  acties?: {
    actie: ParityAction['action'];
    uitkomst: ParityAction['outcome'];
    dialogen: number;
    writes: { sha256: string; lengte: number }[];
    filePath: string | null;
    isDirty: boolean;
    meldingen: ParityNotice[];
  }[];
  /** Fixronde 4: het document heeft na het openen een kenmerk (alleen op de branch; zie de kop van dit bestand). */
  kenmerk?: true;
  /** Fixronde 2: Ctrl+S naar een bestaand doel, per route, met de aanroepen naar buiten. */
  doelacties?: {
    route: ParityTargetAction['route'];
    uitkomst: ParityTargetAction['outcome'];
    writes: { sha256: string; lengte: number }[];
    filePath: string | null;
    isDirty: boolean;
    meldingen: ParityNotice[];
    aanroepen: string[];
  }[];
}

export interface ParityFixture {
  /** De commit van main waarvan de code de verwachting maakte. */
  basis: string;
  binaryExtensions: string[];
  bestanden: ParityFixtureEntry[];
}

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

/** Alle invoerbestanden, gesorteerd, met hun tekst (UTF-8, zoals `File.text()`). */
export function parityInputs(root: string): { pad: string; input: ParityInput; sha256: string }[] {
  const paths: string[] = [];
  for (const entry of PARITY_FILES) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      for (const name of readdirSync(full).filter(n => n.endsWith('.ifc')).sort()) paths.push(`${entry}/${name}`);
    } else paths.push(entry);
  }
  return paths.map((pad) => {
    const bytes = readFileSync(join(root, pad));
    return { pad, input: { name: basename(pad), text: new TextDecoder('utf-8').decode(bytes) }, sha256: sha256(bytes) };
  });
}

/** Draai de kern op de invoer en vat de uitkomst samen als fixture. `saved` geeft de volledige uitvoer per pad. */
export async function parityFixture(root: string, basis: string): Promise<{ fixture: ParityFixture; saved: Map<string, string> }> {
  const inputs = parityInputs(root);
  const run = await runParity(inputs.map(i => i.input));
  const saved = new Map<string, string>();
  const bestanden = run.results.map((r, k): ParityFixtureEntry => {
    const pad = inputs[k].pad;
    if (r.saved !== undefined) saved.set(pad, r.saved);
    return {
      pad,
      invoerSha256: inputs[k].sha256,
      filePath: r.filePath,
      ...(r.saved !== undefined ? { opslaanSha256: sha256(r.saved), opslaanLengte: r.saved.length } : {}),
      meldingen: r.notices,
      ...(r.mark ? { kenmerk: true as const } : {}),
      ...(r.actions ? { acties: r.actions.map(a => ({
        actie: a.action, uitkomst: a.outcome, dialogen: a.pickerCalls,
        writes: a.writes.map(w => ({ sha256: sha256(w), lengte: w.length })),
        filePath: a.filePath, isDirty: a.isDirty, meldingen: a.notices,
      })) } : {}),
      ...(r.targetActions ? { doelacties: r.targetActions.map(a => ({
        route: a.route, uitkomst: a.outcome, writes: a.writes.map(w => ({ sha256: sha256(w), lengte: w.length })),
        filePath: a.filePath, isDirty: a.isDirty, meldingen: a.notices, aanroepen: a.calls,
      })) } : {}),
    };
    r.actions?.forEach((a, i) => a.writes.forEach((w, j) => saved.set(`${pad}.${a.action}-${i}-${j}.ifc`, w)));
  });
  return { fixture: { basis, binaryExtensions: run.binaryExtensions, bestanden }, saved };
}
