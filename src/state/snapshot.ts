import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { AppState } from './appStore';
import type { DocumentPayload } from './documentContract';
import { DOCUMENT_FIELDS } from './documentContract';
import { syncProjectCalendar } from './syncProjectCalendar';

/**
 * De undo/redo-snapshot is een EXPLICIETE subset van het documentcontract (audit P10).
 *
 * De velden komen 1-op-1 uit `DocumentPayload` (`Pick<>`), zodat een typewijziging aan een
 * documentveld automatisch doorwerkt. Welke velden meedoen wordt gestuurd door de `snapshot`-rol in
 * `DOCUMENT_FIELDS` ('clone'/'ref' = wél, 'none' = niet). De per-veld-keuzes en hun onderbouwing:
 *
 *  IN (muteerbare projectdata, 'clone' — diep gekloond zodat undo niet aliast):
 *    tasks, sequences, resources, assignments, calendars, activityCodeTypes, customFieldDefs, baselines
 *  IN (afgeleid/scalar, 'ref' — per referentie; runCPM/recomputeResourceLoad vervangt ze als geheel,
 *      muteert nooit in-place, dus delen is veilig). Zonder cpmResult/resourceLoadResult zou undo van
 *      bv. applyLeveling de taken wél maar statusbalk/histogram NIET terugdraaien (A5):
 *    cpmResult, resourceLoadResult, scheduleStale, activeBaselineId
 *  UIT ('none' — undo mag deze bewust NIET aanraken):
 *    project (zie hieronder — B3-uitzondering), calendar (afgeleide cache, wordt door
 *    syncProjectCalendar hersteld), selectedTaskIds, view, collapsedTaskIds, undoStack, redoStack,
 *    filePath, isDirty (undo/redo zet isDirty altijd op true).
 *
 * PROJECT — bewuste, NAUWE uitzondering (B3-fix). Het hele `project`-object staat NIET in de
 * snapshot, want `setStatusDate`/`setProgressMode`/`setProjectCalendar`/`setProject` muteren project
 * BEWUST zonder undo-snapshot (gedocumenteerde asymmetrie in projectSlice). Zou de snapshot heel
 * `project` bevatten, dan zou een undo van een ongerelateerde taakbewerking die later-gezette
 * statusdatum/voortgangsmodus/projectkalender terugdraaien — ongewenst. Daarom bewaren we ALLEEN
 * `wbsAutoNumber`: dat veld wordt uitsluitend door `setWbsAutoNumber` gemuteerd (dat wél een snapshot
 * pusht), dus opnemen is veilig én noodzakelijk. Zonder deze fix herstelde undo van `setWbsAutoNumber`
 * de nummering wel maar liet de vlag omgeklapt (bug B3).
 */
export interface Snapshot extends Pick<
  DocumentPayload,
  | 'tasks' | 'sequences' | 'resources' | 'assignments' | 'calendars'
  | 'activityCodeTypes' | 'customFieldDefs' | 'cpmResult' | 'resourceLoadResult'
  | 'scheduleStale' | 'baselines' | 'activeBaselineId'
> {
  /** B3-fix: alléén wbsAutoNumber uit `project` (zie kop). */
  project: Pick<Project, 'wbsAutoNumber'>;
}

// Compile-time koppeling tussen de Pick hierboven en de `snapshot`-rollen in DOCUMENT_FIELDS
// (beide richtingen). Wijzig je een rol naar 'clone'/'ref' zonder het veld in de Pick op te nemen
// (of andersom), dan faalt één van deze regels — en de object-literal in `migrateSnapshot` dwingt
// vervolgens ook daar een bewuste default af. Zo kan de snapshot-keten niet stil divergeren.
type SnapshotRoleKey = Extract<typeof DOCUMENT_FIELDS[number], { snapshot: 'clone' | 'ref' }>['key'];
type SnapshotPickKey = keyof Omit<Snapshot, 'project'>;
type MissingInPick = Exclude<SnapshotRoleKey, SnapshotPickKey>;
type ExtraInPick = Exclude<SnapshotPickKey, SnapshotRoleKey>;
const _assertPickCoversRoles: MissingInPick extends never ? true : ['Snapshot-Pick mist rol-velden:', MissingInPick] = true;
const _assertPickHasNoExtras: ExtraInPick extends never ? true : ['Snapshot-Pick bevat niet-snapshot-velden:', ExtraInPick] = true;
void _assertPickCoversRoles;
void _assertPickHasNoExtras;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Maak een snapshot van de huidige state: de 'clone'-velden diep gekloond, de 'ref'-velden per
 *  referentie, plus de nauwe project-projectie (B3). Key-gedreven over `DOCUMENT_FIELDS`. */
export function createSnapshot(s: AppState): Snapshot {
  const snap = { project: { wbsAutoNumber: s.project.wbsAutoNumber } } as Snapshot;
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
    // Passthrough: `restoreSnapshot` zet de vlag alleen terug als de projectie aanwezig is —
    // een legitiem `undefined` (legacy "vrije tekst") moet herstelbaar blijven, dus hier geen
    // `?? default` die dat onderscheid zou wissen.
    project: raw.project,
  };
}

/** Herstel een snapshot in de live state (gedeeld door undo én redo). Zet de snapshot-velden terug
 *  (key-gedreven), herstelt de nauwe project-projectie (B3), zet de kalender-cache gelijk en markeert
 *  het document als gewijzigd. */
export function restoreSnapshot(s: AppState, raw: Snapshot): void {
  const snap = migrateSnapshot(raw);
  const flat = snap as unknown as Record<string, unknown>;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (f.set as (s: AppState, v: unknown) => void)(s, flat[f.key]);
  }
  // B3: wbsAutoNumber-vlag mee terugzetten (de enige project-projectie in de snapshot). De guard
  // dekt het theoretische geval van een projectie-loze snapshot af zónder een legitiem
  // `undefined` ("vrije tekst", projectie wél aanwezig) onherstelbaar te maken.
  if (snap.project) s.project.wbsAutoNumber = snap.project.wbsAutoNumber;
  syncProjectCalendar(s); // §9.1: cache gelijkzetten ná restore.
  s.isDirty = true;
}
