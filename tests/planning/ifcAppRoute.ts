// #886 (fixronde 1): de route van de app in de tests, zonder code die alleen op deze branch bestaat. Zo draait dezelfde
// route ook met de code van main (`scripts/proef/maak-main-toets-trias.mjs`, zoals `maak-main-pariteit.mjs`).
//
// - `openInStore`: een bestand openen zoals Bestand → Openen met de flag `ifcForeignContent`.
// - `storeWith`: een domein openen als document in een verse store (de omzetting en de herberekening bij openen).
// - `lengthen`: de bewerking "een dag langer" op de eerste taak zonder kinderen die geen mijlpaal is (de bewerking `duur`
//   van `ifcMergeKern.ts`).
// - De toets van Trias (besluit over knownbug 1102): `TRIAS_FILES`, `withoutModel` en `plainSaveAfterF5`, de gewone
//   opslag van het bestand zonder model na de duurwijziging en F5.
import type { AppState } from '@/state/appStoreFactory';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';

type StoreModules = {
  createAppStoreContext: typeof import('@/state/appStoreFactory').createAppStoreContext;
  buildWriteIFCInput: typeof import('@/state/ifcSaveInput').buildWriteIFCInput;
};
let storeModules: Promise<StoreModules> | undefined;
/** De store pas bij het eerste gebruik laden, na de kale browseromgeving (zoals `check-ifc-foreign-target.ts`). */
export function loadStore(): Promise<StoreModules> {
  storeModules ??= (async () => {
    if ((globalThis as { window?: unknown }).window === undefined) installBrowserStubs();
    const [{ createAppStoreContext }, { FEATURE_FLAGS }, { buildWriteIFCInput }] = await Promise.all([
      import('@/state/appStoreFactory'), import('@/utils/featureFlags'), import('@/state/ifcSaveInput'),
    ]);
    // Alleen in de tests: de flag bruikbaar maken, zoals in `check-ifc-foreign-open.ts` en `-target.ts`.
    FEATURE_FLAGS.find(f => f.id === 'ifcForeignContent')!.writesNewIfcData = false;
    return { createAppStoreContext, buildWriteIFCInput };
  })();
  return storeModules;
}

/**
 * Openen zoals Bestand → Openen met de flag (#886): een verse store, de flag aan, `openOpenedFile` met de bytes
 * (de bytes-route; zonder `Worker` in Node valt hij terug op de scan in dezelfde draad). Weigert de app het bestand, dan
 * gooit dit de fout die `openOpenedFile` meldde (die vangt hij zelf en meldt hem via het meldingenkanaal en
 * `console.error`). `snapshot` geeft wat Opslaan aan de writer geeft (`buildWriteIFCInput`), met `ifcSource` erbij.
 */
export async function openInStore(bytes: Uint8Array, name = 'bron.ifc') {
  const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  let failure: unknown;
  const realError = console.error;
  console.error = (...args: unknown[]) => { if (args[0] === 'Failed to open file:') failure = args[1]; else realError(...args); };
  try {
    await store.getState().openOpenedFile({ name, content: '', bytes, ref: null });
  } finally {
    console.error = realError;
  }
  if (failure !== undefined) throw failure;
  const snapshot = (s: typeof store) => {
    const st = s.getState();
    return { ...buildWriteIFCInput(st, 'merge'), ...(st.ifcSource ? { ifcSource: st.ifcSource } : {}) };
  };
  return { store, snapshot };
}

/** Een domein als document in een verse store, zoals de lezer het levert: de bibliotheek zonder de kopie van de
 *  projectkalender (de writer schrijft die niet), anders maakt `ensureUniqueImportIds` er een tweede kalender van. */
export async function storeWith(d: WriteIFCInput) {
  const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const parsed = {
    ...structuredClone(d), timeModel: MINUTE_MODEL_TIME_MODEL,
    resourceCalendars: (d.resourceCalendars ?? []).filter(c => c.id !== d.project.calendarId).map(c => structuredClone(c)),
  } as ImportResult;
  store.getState().openAsDocument(parsed, { name: 'getoond.ifc', ref: null });
  return { store, buildWriteIFCInput };
}

/** Eén plannerhandeling in een verse appcontext; nooit alleen de gewijzigde sleutels terugkopiëren.
 * Een fasevraag is hier beantwoord met verplaatsen, hetzelfde antwoord dat de planner kan kiezen.
 */
export async function storeEdit(d: WriteIFCInput, edit: (state: AppState) => void): Promise<WriteIFCInput> {
  const { store, buildWriteIFCInput } = await storeWith(d);
  edit(store.getState());
  return structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
}

/** Doorrekenen (F5) zoals de app: het domein in een eigen store, en daar `runCPM`. */
export async function recalculated<D extends WriteIFCInput>(d: D): Promise<D> {
  const { store, buildWriteIFCInput } = await storeWith(d);
  store.getState().runCPM();
  return buildWriteIFCInput(store.getState(), 'merge') as WriteIFCInput as D;
}

/** De taak van de bewerking "een dag langer". */
export const lengthenedTask = (d: WriteIFCInput) => d.tasks.find(t => t.childIds.length === 0 && !t.isMilestone) ?? d.tasks[0];
/** Een dag langer via dezelfde duurpatch en storeactie als TaskDurationField/TaskPropertiesPanel.
 * Dagenmaat: +1 werkdag; urenmaat: het bestaande invoergebaar +480 werkminuten, met de echte kalenderafleiding.
 * De werkregels laten rest en werk volgen. Geef de verse payload terug, ook als de actie een optioneel veld wist.
 */
export async function lengthen(d: WriteIFCInput, id: string): Promise<WriteIFCInput> {
  const { store, buildWriteIFCInput } = await storeWith(d);
  const task = store.getState().tasks.find(t => t.id === id)!;
  const time = { ...task.time };
  if (time.durationUnit === 'hours') {
    time.durationMinutes = (time.durationMinutes ?? 0) + 480;
    const state = store.getState();
    time.scheduleDuration = hourTaskScheduleDuration(time.durationMinutes, resolveCalendar(task.calendarId, state.calendars, state.calendar));
  } else {
    time.durationUnit = 'days';
    time.scheduleDuration += 1;
    time.durationMinutes = undefined;
  }
  const parts = Object.keys(time).filter(k => time[k as keyof typeof time] !== task.time[k as keyof typeof time]).map(k => `time.${k}`);
  store.getState().updateTask(id, { time }, { coalesceKey: `taskfield:${id}:${parts.sort().join(',')}` });
  // Volgende proefbewerkingen mogen deze payload muteren; store-objecten blijven bevroren.
  return structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
}

/** De tien oude eigen bestanden van de toets van Trias, met model (een wand erbij, of hun eigen model). */
export const TRIAS_MODEL_FILE = 'tests/fixtures/ifc-foreign/oud-eigen-0.1-plus-model.ifc';
export const TRIAS_FILES: readonly string[] = [
  'tests/planning/fixtures/oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc',
  'tests/planning/fixtures/oude-tags/v2026.7.2-woongebouw-nieuwbouw.ifc',
  'tests/planning/fixtures/oude-tags/v2026.7.7-urentaak-10-villa-wassenaar.ifc',
  'tests/planning/fixtures/oude-tags/v2026.9.0-10-villa-wassenaar.ifc',
  'tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc',
  'tests/planning/fixtures/oude-tags/v2026.43.0-10-villa-wassenaar.ifc',
  'tests/planning/fixtures/oude-tags/v2026.43.0-halve-dag-10-villa-wassenaar.ifc',
  'tests/planning/fixtures/oude-tags/v2026.43.0-urentaak-10-villa-wassenaar.ifc',
  'tests/planning/fixtures/h7-tijden-oude-writer.ifc',
  TRIAS_MODEL_FILE,
];
/** Het bestand zonder model: bij `TRIAS_MODEL_FILE` het blok van de modelleur (vanaf `#460`, de eigen owner history ervan)
 *  eruit; de andere hebben geen model (de toets zet er een wand bij). */
export function withoutModel(rel: string, src: string): string {
  if (rel !== TRIAS_MODEL_FILE) return src;
  const from = src.indexOf('\n#460=');
  return src.slice(0, from + 1) + src.slice(src.lastIndexOf('ENDSEC;'));
}
/** De gewone opslag van het bestand zonder model: openen via de app, een dag langer, F5, `writeIFC`. */
export async function plainSaveAfterF5(bare: Uint8Array): Promise<string> {
  const { store, snapshot } = await openInStore(bare);
  const { ifcSource: _source, ...d } = snapshot(store);
  const input = await lengthen(structuredClone(d) as WriteIFCInput, lengthenedTask(d).id);
  return writeIFC(await recalculated(input));
}

export interface TriasEntry { readonly pad: string; readonly invoerSha256: string; readonly uitvoerSha256: string; readonly lengte: number }
const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
/** Het bestand zonder model, als bytes zoals de toets het leest (latin1). */
export const bareBytes = (root: string, rel: string): Uint8Array =>
  Uint8Array.from(withoutModel(rel, readFileSync(join(root, rel), 'latin1')), c => c.charCodeAt(0));
/** De gewone opslag na F5 van elk bestand zonder model, met een vaste klok en reeks (de fixture van main en de toets). */
export async function trias(root: string): Promise<TriasEntry[]> {
  const reseed = installDeterminism();
  const out: TriasEntry[] = [];
  for (const pad of TRIAS_FILES) {
    const bare = bareBytes(root, pad);
    reseed(0x804);
    const text = await plainSaveAfterF5(bare);
    out.push({ pad, invoerSha256: sha256(bare), uitvoerSha256: sha256(text), lengte: text.length });
  }
  return out;
}

/** De echte open-stappen op de lezing van de merge, zonder schrijver of geforceerd TimeModel ertussen (1107). */
export async function openReadPlanning(parsed: WriteIFCInput, side: 'uitvoer' | 'domein'): Promise<WriteIFCInput> {
  if (side === 'domein') {
    const { store, buildWriteIFCInput } = await storeWith(parsed);
    return buildWriteIFCInput(store.getState(), 'merge');
  }
  const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  store.getState().openAsDocument(structuredClone(parsed), { name: 'bron.ifc', ref: null });
  return buildWriteIFCInput(store.getState(), 'merge');
}

/** Voortgang in een proef langs dezelfde setters als de app; ook status, rest en bewerkingsherkomst gaan mee. */
export async function applyTaskProgress(input: WriteIFCInput, taskId: string,
  edits: readonly import('@/engine/progressEntry').ProgressEdit[]): Promise<void> {
  const { store, buildWriteIFCInput } = await storeWith(input);
  for (const edit of edits) {
    const state = store.getState();
    const accepted = edit.field === 'completion' ? state.setTaskProgress(taskId, edit.value)
      : edit.field === 'actualStart' ? state.setActualStart(taskId, edit.value) : state.setActualFinish(taskId, edit.value);
    if (!accepted) throw new Error(`voortgangsinvoer geweigerd: ${taskId}.${edit.field}`);
  }
  Object.assign(input, buildWriteIFCInput(store.getState(), 'merge'));
}
