import type { WorkCalendar } from '@/types/calendar';
import type { AppState } from './appStore';
import type { DocumentPayload } from './documentContract';
import { DOCUMENT_FIELDS } from './documentContract';
import { originalAppState } from './immerDraft';
import { syncProjectCalendar } from './syncProjectCalendar';
import { createDefaultProject } from './defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { markDocumentEdited, markDocumentUnsaved } from '@/state/documentEdited';
import { sameValue } from '@/utils/sameValue';

/**
 * De undo/redo-snapshot is een EXPLICIETE subset van het documentcontract.
 *
 * De velden komen 1-op-1 uit `DocumentPayload` (`Pick<>`), zodat een typewijziging aan een
 * documentveld automatisch doorwerkt. Welke velden meedoen, bepaalt de `snapshot`-rol in
 * `DOCUMENT_FIELDS` ('data'/'derived' = wél, 'none' = niet):
 *
 *  IN ('data', muteerbare projectdata):
 *    project, calendar, tasks, sequences, resources, assignments, calendars, activityCodeTypes,
 *    customFieldDefs, customTaskTypes, baselines, activeBaselineId (door de gebruiker gekozen en in
 *    het bestand bewaard, dus projectdata; `documentDataChanged` moet hem zien)
 *  IN ('derived'; runCPM vervangt ze als geheel en muteert nooit in-place, dus delen is veilig).
 *      Undo moet exact de handmatig berekende toestand kunnen herstellen; samen met `tasks` draait
 *      één undo de opgeslagen datums én de modus terug:
 *    cpmResult, scheduleStale, recordedDates, datesAsRecorded
 *  UIT ('none', undo raakt deze bewust NIET aan):
 *    selectedTaskIds, resourceLoadResult, view, collapsedTaskIds, filePath, fileHandle en isDirty
 *    (data-undo/redo zet isDirty altijd op true; `importPristine` wist alleen een undo/redo van een
 *    echte bewerking, niet van een `nonEdit`-event — zie `restoreSnapshot`). De sessiehistorie is
 *    app-globaal en hoort niet bij `DocumentPayload`. resourceLoadResult en viewRows worden door
 *    `materializeHistoryTarget` uit het herstelde target afgeleid.
 *
 * INVARIANT voor `project`: een projectveld mag in de snapshot staan dan en slechts dan als élke
 * mutator ervan een snapshot pusht. Alle project-mutators in `projectSlice` roepen daarom
 * `beginUndoable` aan (met een no-op-guard die `modifiedAt` negeert, zodat "opslaan" met ongewijzigde
 * waarden géén lege undo-stap pusht). Een project-mutator zónder snapshot zou een undo van een
 * ongerelateerde taakbewerking bv. een later gezette statusdatum laten terugdraaien.
 */
export type Snapshot = Pick<
  DocumentPayload,
  | 'project' | 'calendar' | 'tasks' | 'sequences' | 'resources' | 'assignments' | 'calendars'
  | 'activityCodeTypes' | 'customFieldDefs' | 'customTaskTypes' | 'cpmResult'
  | 'scheduleStale' | 'baselines' | 'activeBaselineId' | 'recordedDates' | 'datesAsRecorded'
>;

// Compile-time koppeling tussen de Pick hierboven en de `snapshot`-rollen in DOCUMENT_FIELDS
// (beide richtingen). Wijzig je een rol naar 'data'/'derived' zonder het veld in de Pick op te nemen
// (of andersom), dan faalt één van deze regels — en de object-literal in `migrateSnapshot` dwingt
// vervolgens ook daar een bewuste default af. Zo kan de snapshot-keten niet stil divergeren.
type SnapshotRoleKey = Extract<typeof DOCUMENT_FIELDS[number], { snapshot: 'data' | 'derived' }>['key'];
type SnapshotPickKey = keyof Snapshot;
type MissingInPick = Exclude<SnapshotRoleKey, SnapshotPickKey>;
type ExtraInPick = Exclude<SnapshotPickKey, SnapshotRoleKey>;
const _assertPickCoversRoles: MissingInPick extends never ? true : ['Snapshot-Pick mist rol-velden:', MissingInPick] = true;
const _assertPickHasNoExtras: ExtraInPick extends never ? true : ['Snapshot-Pick bevat niet-snapshot-velden:', ExtraInPick] = true;
void _assertPickCoversRoles;
void _assertPickHasNoExtras;

/**
 * Maak een snapshot van de huidige state: elk niet-'none'-veld PER REFERENTIE, key-gedreven over
 * `DOCUMENT_FIELDS`.
 *
 * WAAROM GEEN DIEPE KLOON. Een JSON-kloon van alle 'data'-velden bij élke mutatie was veruit de
 * duurste stap van de app (kloon plus het diepvriezen van de kopie door Immer) en kostte per
 * undo-stap een volledige projectkopie. Met delen kost een stap ongeveer de objecten die die ene
 * bewerking aanraakte.
 *
 * WAAROM DELEN VEILIG IS. Een kloon beschermt tegen aliasing: muteert iets de live state in-place,
 * dan verandert een gedeelde snapshot mee. Dat kan hier niet:
 *
 *  1. Immer MUTEERT NOOIT de basis. Elke mutatie loopt via een `set()`-producer (copy-on-write): een
 *     gewijzigde taak levert een NIEUW taakobject en een nieuwe `tasks`-array op. De snapshot wijst
 *     naar precies de versie van vóór de mutatie.
 *  2. Immer's auto-freeze bevriest de state diep. Een in-place mutatie buiten een producer om is
 *     daarmee een `TypeError`, geen stille corruptie. `check-mutation-cost.ts` toetst die
 *     bevriezing na elke soort mutatie, plus een broncheck dat niemand `setAutoFreeze` uitzet.
 *
 * DRAFT-NORMALISATIE. Delen mag alleen met PLAIN waarden: een Immer-draft wordt na zijn producer
 * ingetrokken, dus een gedeelde draft gooit bij uitlezen. Krijgt deze functie een draft, dan leest
 * hij via `originalAppState()` (Immers `original()`, de basisstaat van die producer; zie
 * `immerDraft.ts` voor waarom die grens een eigen module heeft).
 *
 * Alleen `beginUndoable` (`runtime/storeRuntime.ts`) geeft een draft door: het legt middenin een
 * `set()`-producer de voor-staat vast. Daar geldt de conventie *guards; snapshot; mutatie* — hij
 * snapshot vóór hij muteert, dus de basisstaat ís de bedoelde voor-staat. Alle andere aanroepers
 * geven al plain state door (`store.getState()`, `currentAppState()`, een `produce()`-resultaat of
 * een ondiepe kopie).
 *
 * Wie een aanroeper toevoegt die BINNEN een producer snapshot NÁ het muteren, breekt de conventie
 * stil: de snapshot legt de na-staat vast en undo herstelt te weinig. `check-mutation-cost.ts`
 * toetst het gedrag (25a/25b) en pint de bron (27a–27c).
 */
export function createSnapshot(s: AppState): Snapshot {
  const base = originalAppState(s) ?? s;
  const snap = {} as Snapshot;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (snap as unknown as Record<string, unknown>)[f.key] = f.get(base);
  }
  return snap;
}

/**
 * Dezelfde snapshot, maar uit een SLAPENDE `DocumentPayload` in plaats van uit de live top-level
 * state. Een history-event draagt per document een `before`/`after`-`Snapshot`; voor een slapend
 * document staat die data al in zijn payload, dus hydrateren-om-te-snapshotten is overbodig. Een
 * payload is al plain (ooit met `capturePayload` gevangen); er valt niets te normaliseren.
 *
 * ZELFDE ROLREGEL als `createSnapshot`: key-gedreven over `DOCUMENT_FIELDS`, elk niet-'none'-veld
 * PER REFERENTIE, zodat de compile-time-koppeling met de `Snapshot`-Pick ook voor deze bron geldt.
 */
export function snapshotOfPayload(p: DocumentPayload): Snapshot {
  const flat = p as unknown as Record<string, unknown>;
  const snap = {} as Snapshot;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (snap as unknown as Record<string, unknown>)[f.key] = flat[f.key];
  }
  return snap;
}

/**
 * Normaliseer een (mogelijk oude) snapshot naar de huidige vorm: legacy-alias `resourceCalendars`
 * → `calendars`, en veilige defaults voor ontbrekende velden. Snapshots leven
 * alleen in-memory (nooit geserialiseerd), dus dit is defensief — maar houdt het herstelpad robuust
 * en op één plek i.p.v. verspreide `?? …`-guards in undo/redo.
 */
export function migrateSnapshot(raw: Snapshot): Snapshot {
  const legacy = raw as Snapshot & { resourceCalendars?: WorkCalendar[] };
  return {
    tasks: raw.tasks ?? [],
    sequences: raw.sequences ?? [],
    resources: raw.resources ?? [],
    assignments: raw.assignments ?? [],
    calendars: raw.calendars ?? legacy.resourceCalendars ?? [],
    activityCodeTypes: raw.activityCodeTypes ?? [],
    customFieldDefs: raw.customFieldDefs ?? [],
    customTaskTypes: raw.customTaskTypes ?? [],
    cpmResult: raw.cpmResult ?? null,
    scheduleStale: raw.scheduleStale ?? false,
    baselines: raw.baselines ?? [],
    // `null` ("geen actieve baseline") is een legitieme waarde die een undo moet kunnen terugzetten;
    // alleen een ontbrekend veld (undefined) valt terug op null.
    activeBaselineId: raw.activeBaselineId !== undefined ? raw.activeBaselineId : null,
    // Zelfde `null`/`undefined`-onderscheid als activeBaselineId: `null` ("geen vastlegging (meer)")
    // is legitiem, alleen een ontbrekend veld valt terug.
    recordedDates: raw.recordedDates !== undefined ? raw.recordedDates : null,
    datesAsRecorded: raw.datesAsRecorded ?? false,
    // Een project zonder `id` is een halve projectie (bv. alleen `{ wbsAutoNumber }`): vul die AAN
    // met een verse default; de aanwezige velden blijven leidend, inclusief een legitiem `undefined`
    // ("vrije tekst"). Puur defensief.
    project: raw.project?.id ? raw.project : { ...createDefaultProject(), ...raw.project },
    // De gedenormaliseerde projectkalender-cache; `restoreSnapshot` synct hem hierna alsnog uit
    // `calendars`, dus deze default is alleen het vangnet voor de orphan-fallback.
    calendar: raw.calendar ?? createDefaultCalendar(),
  };
}

/**
 * Verschilt de PROJECTDATA (de `'data'`-rol van `DOCUMENT_FIELDS`) PER SALDO tussen twee snapshots?
 * De afgeleide velden (`cpmResult`, `scheduleStale`, …) tellen bewust niet mee — een herberekening
 * alléén maakt een document niet gewijzigd (de `runCPM`-invariant). De MCP-transactie leidt hier op
 * haar ene commit-plek (`createMcpTransactions` → `run`) zowel `isDirty` als de undo-stap uit af.
 *
 * Per WAARDE (`sameValue`; een gelijke referentie is het snelpad, dus ongewijzigde velden kosten
 * niets), niet alleen per referentie — dezelfde "per saldo"-regel als de no-op-guards van de
 * UI-routes. Een nieuwe referentie is niet altijd een wijziging: een draftprimitief levert bij
 * dezelfde duur of constraint toch een nieuw taakobject op, en een batch kan een naam wijzigen en weer
 * terugzetten. `project.modifiedAt` telt niet mee: elke projectmutator ververst dat veld, ook zonder
 * wijziging — dezelfde uitzondering als `projectChanges` in `projectSlice`.
 */
export function documentDataChanged(before: Snapshot, after: Snapshot): boolean {
  const b = before as unknown as Record<string, unknown>;
  const a = after as unknown as Record<string, unknown>;
  return DOCUMENT_FIELDS.some((f) => {
    if (f.snapshot !== 'data' || b[f.key] === a[f.key]) return false;
    if (f.key === 'project') {
      return !sameValue({ ...before.project, modifiedAt: undefined }, { ...after.project, modifiedAt: undefined });
    }
    return !sameValue(b[f.key], a[f.key]);
  });
}

/** Herstel een snapshot in de live state (gedeeld door undo én redo). Zet de snapshot-velden terug
 *  (key-gedreven, inclusief het volledige `project`), zet de kalender-cache gelijk en
 *  markeert het document als gewijzigd.
 *
 *  De herstelde waarden zijn dezelfde objecten als in de snapshot (zie `createSnapshot`): de live
 *  state en de snapshot aliassen dus na een undo. Dat is veilig om exact dezelfde reden — de
 *  eerstvolgende mutatie is een producer en die kopieert. */
export function restoreSnapshot(
  s: AppState,
  raw: Snapshot,
  opts?: {
    /** Default `true`: het geheugen wijkt na herstel af van de schijf. `false` alleen voor een
     *  aanroeper die `isDirty` zelf terugzet (de MCP-rollback). */
    markDirty?: boolean;
    /** Default `true`: wis "ongewijzigd sinds import". `false` voor een `nonEdit`-event en de
     *  MCP-rollback. */
    clearImportPristine?: boolean;
  },
): void {
  const snap = migrateSnapshot(raw);
  const flat = snap as unknown as Record<string, unknown>;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (f.set as (s: AppState, v: unknown) => void)(s, flat[f.key]);
  }
  // Cache gelijkzetten ná restore. `project.calendarId` én `calendars` komen allebei uit
  // DEZELFDE snapshot, dus de cache wordt consistent met het herstelde id afgeleid; de
  // orphan-fallback promoveert de meegeherstelde `calendar`-waarde (niet de nieuwere).
  syncProjectCalendar(s);
  // Twee aparte vragen. (1) Wijkt het geheugen af van de schijf? Na elke undo/redo wel — ook van F5:
  // na laden → F5 → opslaan → Ctrl+Z staat er iets anders in het geheugen dan in het bestand.
  // (2) Is het document sinds de import BEWERKT? Alleen als het event een bewerking was; undo/redo
  // van een `nonEdit`-event (F5 of "toon opgeslagen datums" in de modus) laat de importvlag staan.
  const clearPristine = opts?.clearImportPristine !== false;
  if (opts?.markDirty !== false && clearPristine) markDocumentEdited(s);
  else if (opts?.markDirty !== false) markDocumentUnsaved(s);
  else if (clearPristine) s.importPristine = false;
}
