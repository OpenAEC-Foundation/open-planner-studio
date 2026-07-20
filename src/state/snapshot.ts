import type { WorkCalendar } from '@/types/calendar';
import type { AppState } from './appStore';
import type { DocumentPayload } from './documentContract';
import { DOCUMENT_FIELDS } from './documentContract';
import { syncProjectCalendar } from './syncProjectCalendar';
import { createDefaultProject } from './slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';

/**
 * De undo/redo-snapshot is een EXPLICIETE subset van het documentcontract (audit P10).
 *
 * De velden komen 1-op-1 uit `DocumentPayload` (`Pick<>`), zodat een typewijziging aan een
 * documentveld automatisch doorwerkt. Welke velden meedoen wordt gestuurd door de `snapshot`-rol in
 * `DOCUMENT_FIELDS` ('clone'/'ref' = wél, 'none' = niet). De per-veld-keuzes en hun onderbouwing:
 *
 *  IN (muteerbare projectdata, 'clone' — diep gekloond zodat undo niet aliast):
 *    project, calendar, tasks, sequences, resources, assignments, calendars, activityCodeTypes,
 *    customFieldDefs, baselines
 *  IN (afgeleid/scalar, 'ref' — per referentie; runCPM/recomputeResourceLoad vervangt ze als geheel,
 *      muteert nooit in-place, dus delen is veilig). Zonder cpmResult/resourceLoadResult zou undo van
 *      bv. applyLeveling de taken wél maar statusbalk/histogram NIET terugdraaien (A5):
 *    cpmResult, resourceLoadResult, scheduleStale, activeBaselineId
 *  UIT ('none' — undo mag deze bewust NIET aanraken):
 *    selectedTaskIds, view, collapsedTaskIds, undoStack, redoStack, filePath, fileHandle,
 *    isDirty (undo/redo zet isDirty altijd op true).
 *
 * PROJECT — de oude B3-uitzondering is VERVALLEN (pakket H). Historie: het hele `project`-object
 * stond hier NIET in, met één nauwe projectie (`wbsAutoNumber`). Reden was dat
 * `setProject`/`setStatusDate`/`setProgressMode`/`setProjectCalendar` het project BEWUST zonder
 * undo-snapshot muteerden; met heel `project` in de snapshot zou een undo van een ongerelateerde
 * taakbewerking een later-gezette statusdatum hebben teruggedraaid. `wbsAutoNumber` mocht er wél in
 * omdat zijn enige mutator (`setWbsAutoNumber`) zelf een snapshot pusht.
 *
 * Dat laatste is precies de INVARIANT van dit ontwerp: een projectveld mag in de snapshot staan dan
 * en slechts dan als élke mutator ervan een snapshot pusht. Pakket H herstelt die invariant door hem
 * te VERVULLEN in plaats van op te rekken — alle vijf de project-mutators in `projectSlice` roepen nu
 * `beginUndoable` aan (elk met een no-op-guard die `modifiedAt` buiten beschouwing laat, zodat een
 * "opslaan" met ongewijzigde waarden géén lege undo-stap pusht). Daarmee kan heel `project` mee en
 * worden projectdatums/statusdatum/voortgangsmodus normaal ongedaan te maken. Wie hier een nieuwe
 * project-mutator aan toevoegt zónder snapshot, breekt de invariant en brengt bug B3 terug.
 */
export type Snapshot = Pick<
  DocumentPayload,
  | 'project' | 'calendar' | 'tasks' | 'sequences' | 'resources' | 'assignments' | 'calendars'
  | 'activityCodeTypes' | 'customFieldDefs' | 'cpmResult' | 'resourceLoadResult'
  | 'scheduleStale' | 'baselines' | 'activeBaselineId'
>;

// Compile-time koppeling tussen de Pick hierboven en de `snapshot`-rollen in DOCUMENT_FIELDS
// (beide richtingen). Wijzig je een rol naar 'clone'/'ref' zonder het veld in de Pick op te nemen
// (of andersom), dan faalt één van deze regels — en de object-literal in `migrateSnapshot` dwingt
// vervolgens ook daar een bewuste default af. Zo kan de snapshot-keten niet stil divergeren.
type SnapshotRoleKey = Extract<typeof DOCUMENT_FIELDS[number], { snapshot: 'clone' | 'ref' }>['key'];
type SnapshotPickKey = keyof Snapshot;
type MissingInPick = Exclude<SnapshotRoleKey, SnapshotPickKey>;
type ExtraInPick = Exclude<SnapshotPickKey, SnapshotRoleKey>;
const _assertPickCoversRoles: MissingInPick extends never ? true : ['Snapshot-Pick mist rol-velden:', MissingInPick] = true;
const _assertPickHasNoExtras: ExtraInPick extends never ? true : ['Snapshot-Pick bevat niet-snapshot-velden:', ExtraInPick] = true;
void _assertPickCoversRoles;
void _assertPickHasNoExtras;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Maak een snapshot van de huidige state: de 'clone'-velden diep gekloond (inclusief het VOLLEDIGE
 *  `project`, pakket H), de 'ref'-velden per referentie. Key-gedreven over `DOCUMENT_FIELDS`. */
export function createSnapshot(s: AppState): Snapshot {
  const snap = {} as Snapshot;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    const v = f.get(s);
    (snap as unknown as Record<string, unknown>)[f.key] = f.snapshot === 'clone' ? deepClone(v) : v;
  }
  return snap;
}

/**
 * Normaliseer een (mogelijk oude) snapshot naar de huidige vorm: legacy-alias `resourceCalendars`
 * → `calendars`, en veilige defaults voor velden die pre-2.x-snapshots misten. Snapshots leven
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
    cpmResult: raw.cpmResult ?? null,
    resourceLoadResult: raw.resourceLoadResult ?? null,
    scheduleStale: raw.scheduleStale ?? false,
    baselines: raw.baselines ?? [],
    // `null` ("geen actieve baseline") is een legitieme waarde die een undo moet kunnen terugzetten;
    // alleen een ontbrekend veld (undefined) valt terug op null.
    activeBaselineId: raw.activeBaselineId !== undefined ? raw.activeBaselineId : null,
    // Bewuste default voor snapshots zonder VOLLEDIG project (pakket H). Pre-H-snapshots droegen
    // alleen de nauwe B3-projectie `{ wbsAutoNumber }`; die herken je aan het ontbreken van `id`.
    // We vervangen zo'n halve projectie niet door een leeg project maar vullen hem AAN met een verse
    // default — de aanwezige projectie (bv. de wbsAutoNumber-vlag) blijft daarbij leidend, inclusief
    // een legitiem `undefined` ("vrije tekst"). Snapshots leven alleen in-memory, dus dit pad is
    // puur defensief.
    project: raw.project?.id ? raw.project : { ...createDefaultProject(), ...raw.project },
    // De gedenormaliseerde projectkalender-cache; `restoreSnapshot` synct hem hierna alsnog uit
    // `calendars` (§9.1), dus deze default is alleen het vangnet voor de orphan-fallback.
    calendar: raw.calendar ?? createDefaultCalendar(),
  };
}

/** Herstel een snapshot in de live state (gedeeld door undo én redo). Zet de snapshot-velden terug
 *  (key-gedreven — inclusief het volledige `project`, pakket H), zet de kalender-cache gelijk en
 *  markeert het document als gewijzigd. */
export function restoreSnapshot(s: AppState, raw: Snapshot): void {
  const snap = migrateSnapshot(raw);
  const flat = snap as unknown as Record<string, unknown>;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (f.set as (s: AppState, v: unknown) => void)(s, flat[f.key]);
  }
  // §9.1: cache gelijkzetten ná restore. `project.calendarId` én `calendars` komen allebei uit
  // DEZELFDE snapshot, dus de cache wordt consistent met het herstelde id afgeleid; de
  // orphan-fallback promoveert de meegeherstelde `calendar`-waarde (niet de nieuwere).
  syncProjectCalendar(s);
  s.isDirty = true;
}
