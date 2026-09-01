import type { WorkCalendar } from '@/types/calendar';
import type { AppState } from './appStore';
import type { DocumentPayload } from './documentContract';
import { DOCUMENT_FIELDS } from './documentContract';
import { originalAppState } from './immerDraft';
import { syncProjectCalendar } from './syncProjectCalendar';
import { createDefaultProject } from './defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';

/**
 * De undo/redo-snapshot is een EXPLICIETE subset van het documentcontract (audit P10).
 *
 * De velden komen 1-op-1 uit `DocumentPayload` (`Pick<>`), zodat een typewijziging aan een
 * documentveld automatisch doorwerkt. Welke velden meedoen wordt gestuurd door de `snapshot`-rol in
 * `DOCUMENT_FIELDS` ('clone'/'ref' = wél, 'none' = niet). De per-veld-keuzes en hun onderbouwing:
 *
 *  IN (muteerbare projectdata, 'data'):
 *    project, calendar, tasks, sequences, resources, assignments, calendars, activityCodeTypes,
 *    customFieldDefs, baselines
 *  IN (afgeleid/scalar, 'derived'; runCPM vervangt ze als geheel, muteert nooit in-place, dus delen
 *      is veilig). cpmResult en scheduleStale moeten exact de handmatig berekende toestand kunnen
 *      herstellen. recordedDates/datesAsRecorded (issue #63) horen om dezelfde reden hier: samen
 *      met `tasks` ('data') draait één undo de datums én de modus terug:
 *    cpmResult, scheduleStale, activeBaselineId, recordedDates, datesAsRecorded
 *  UIT ('none' — undo mag deze bewust NIET aanraken):
 *    selectedTaskIds, resourceLoadResult, view, collapsedTaskIds, filePath, fileHandle en isDirty
 *    (data-undo/redo zet isDirty altijd op true). De sessiehistorie is app-globaal en hoort niet bij
 *    `DocumentPayload`. resourceLoadResult en viewRows worden door `materializeHistoryTarget` uit
 *    het herstelde target afgeleid.
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
  | 'activityCodeTypes' | 'customFieldDefs' | 'customTaskTypes' | 'cpmResult'
  | 'scheduleStale' | 'baselines' | 'activeBaselineId' | 'recordedDates' | 'datesAsRecorded'
>;

// Compile-time koppeling tussen de Pick hierboven en de `snapshot`-rollen in DOCUMENT_FIELDS
// (beide richtingen). Wijzig je een rol naar 'clone'/'ref' zonder het veld in de Pick op te nemen
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
 * WAAROM GEEN DIEPE KLOON MEER (2026-08-17, prestatiedoel "5000 taken"). Hier stond
 * `JSON.parse(JSON.stringify(v))` over álle 'data'-velden, bij élke mutatie. Dat was veruit de
 * duurste stap van de hele app. Gemeten op een project van 5.000 taken, één `addTask`: 132 ms zoals
 * het was, 59 ms met alleen deze wijziging, 18 ms samen met de goedkopere WBS-nummering
 * (`utils/wbs.ts`). Voor `updateTask` is het aandeel nog groter: 97 ms → 11 ms. In het CPU-profiel
 * ging ~26% op aan de kloon zelf en ~45% aan het DIEPVRIEZEN van de zojuist gekloonde objecten door
 * Immer — die tweede helft is makkelijk over het hoofd te zien maar hoort er even goed bij.
 *
 * Het kostte bovendien geheugen in dezelfde orde: 100 undo-stappen × een volledige projectkopie,
 * per geopend document. Met delen kost een stap nog ongeveer de objecten die die ene bewerking
 * aanraakte.
 *
 * WAAROM DAT VEILIG IS. De kloon beschermde tegen aliasing: als iets de live state in-place zou
 * muteren, zou een gedeelde snapshot mee veranderen en zou undo niets herstellen. Die aanval bestaat
 * hier niet, om twee elkaar overlappende redenen:
 *
 *  1. Immer MUTEERT NOOIT de basis. Elke mutatie loopt via een `set()`-producer, en die werkt
 *     copy-on-write: een gewijzigde taak levert een NIEUW taakobject en een nieuwe `tasks`-array op.
 *     De arrays/objecten waar de snapshot naar wijst, zijn precies de versie van vóór de mutatie —
 *     dat is exact wat undo moet herstellen.
 *  2. Immer's auto-freeze maakt de state diep BEVROREN. Een in-place mutatie buiten een producer om
 *     is daarmee geen stille corruptie maar een `TypeError`. `check-undo-sharing.ts` toetst die
 *     bevriezing expliciet na elke soort mutatie, plus een broncheck dat niemand `setAutoFreeze`
 *     uitzet.
 *
 * DRAFT-NORMALISATIE. Delen mag alleen als de waarden PLAIN zijn: een Immer-draft wordt na afloop
 * van zijn producer ingetrokken, dus een gedeelde draft zou een snapshot opleveren die bij het
 * uitlezen gooit. Krijgt deze functie een draft, dan leest hij daarom via `originalAppState()` —
 * Immers `original()`, dus de basisstaat van die producer (zie `immerDraft.ts` voor waarom die
 * grens een eigen module heeft). Dat klopt precies zolang de aanroeper de vaste conventie aanhoudt:
 * *guards; snapshot; mutatie*. Alle vier de aanroepers doen dat (`beginUndoable`, `withTransaction`,
 * `undo`, `redo`); `runInMcpTransaction` geeft sowieso plain state door.
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
    customTaskTypes: raw.customTaskTypes ?? [],
    cpmResult: raw.cpmResult ?? null,
    scheduleStale: raw.scheduleStale ?? false,
    baselines: raw.baselines ?? [],
    // `null` ("geen actieve baseline") is een legitieme waarde die een undo moet kunnen terugzetten;
    // alleen een ontbrekend veld (undefined) valt terug op null.
    activeBaselineId: raw.activeBaselineId !== undefined ? raw.activeBaselineId : null,
    // Issue #63 — zelfde `null`/`undefined`-onderscheid als activeBaselineId: `null` ("geen
    // vastlegging (meer)") is legitiem, alleen een ontbrekend veld (pre-#63-snapshot) valt terug.
    recordedDates: raw.recordedDates !== undefined ? raw.recordedDates : null,
    datesAsRecorded: raw.datesAsRecorded ?? false,
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
 *  markeert het document als gewijzigd.
 *
 *  De herstelde waarden zijn dezelfde objecten als in de snapshot (zie `createSnapshot`): de live
 *  state en de snapshot aliassen dus na een undo. Dat is veilig om exact dezelfde reden — de
 *  eerstvolgende mutatie is een producer en die kopieert. */
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
