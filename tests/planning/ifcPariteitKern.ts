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
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

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

/** Een FSA-handle in het geheugen: wat `createWritable` krijgt, komt in `writes`. */
function memoryHandle(name: string, writes: string[]): unknown {
  let data = '';
  const handle = {
    kind: 'file', name,
    isSameEntry: async (other: unknown) => other === handle,
    getFile: async () => new File([data], name),
    createWritable: async () => {
      let buffer = '';
      return {
        write: async (chunk: unknown) => { buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk as Uint8Array); },
        close: async () => { data = buffer; writes.push(buffer); },
      };
    },
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
  };
  return handle;
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
      ...(opened ? { saved: writeIFC(buildWriteIFCInput(state)) } : {}),
      notices: state.ui.notifications.map(({ id: _id, ...rest }) => JSON.parse(JSON.stringify(rest)) as ParityNotice),
    };
    if (opened) {
      result.actions = [
        await runAction(store, 'saveFile', input.name),
        await runAction(store, 'saveFileAs', `kopie-${input.name}`),
      ];
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
      ...(r.actions ? { acties: r.actions.map(a => ({
        actie: a.action, uitkomst: a.outcome, dialogen: a.pickerCalls,
        writes: a.writes.map(w => ({ sha256: sha256(w), lengte: w.length })),
        filePath: a.filePath, isDirty: a.isDirty, meldingen: a.notices,
      })) } : {}),
    };
    r.actions?.forEach((a, i) => a.writes.forEach((w, j) => saved.set(`${pad}.${a.action}-${i}-${j}.ifc`, w)));
  });
  return { fixture: { basis, binaryExtensions: run.binaryExtensions, bestanden }, saved };
}
