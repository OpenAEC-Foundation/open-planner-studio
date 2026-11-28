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
import { withFileIfcSchema } from './ifcSchemaChoice';

export type Snapshot = Pick<
  DocumentPayload,
  | 'project' | 'calendar' | 'tasks' | 'sequences' | 'resources' | 'assignments' | 'calendars'
  | 'activityCodeTypes' | 'customFieldDefs' | 'customTaskTypes' | 'cpmResult'
  | 'scheduleStale' | 'baselines' | 'activeBaselineId' | 'comparedBaselineIds' | 'recordedDates' | 'datesAsRecorded'
  | 'minuteModelPending' | 'ifcGlobalIds' | 'ifcxReferences'
>;

type SnapshotRoleKey = Extract<typeof DOCUMENT_FIELDS[number], { snapshot: 'data' | 'derived' }>['key'];
type SnapshotPickKey = keyof Snapshot;
type MissingInPick = Exclude<SnapshotRoleKey, SnapshotPickKey>;
type ExtraInPick = Exclude<SnapshotPickKey, SnapshotRoleKey>;
const _assertPickCoversRoles: MissingInPick extends never ? true : ['Snapshot-Pick mist rol-velden:', MissingInPick] = true;
const _assertPickHasNoExtras: ExtraInPick extends never ? true : ['Snapshot-Pick bevat niet-snapshot-velden:', ExtraInPick] = true;
void _assertPickCoversRoles;
void _assertPickHasNoExtras;

export function createSnapshot(s: AppState): Snapshot {
  const base = originalAppState(s) ?? s;
  const snap = {} as Snapshot;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (snap as unknown as Record<string, unknown>)[f.key] = f.get(base);
  }
  return snap;
}

export function snapshotOfPayload(p: DocumentPayload): Snapshot {
  const flat = p as unknown as Record<string, unknown>;
  const snap = {} as Snapshot;
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    (snap as unknown as Record<string, unknown>)[f.key] = flat[f.key];
  }
  return snap;
}

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
    ifcGlobalIds: raw.ifcGlobalIds ?? null,
    ifcxReferences: raw.ifcxReferences ?? null,
    cpmResult: raw.cpmResult ?? null,
    scheduleStale: raw.scheduleStale ?? false,
    baselines: raw.baselines ?? [],
    activeBaselineId: raw.activeBaselineId !== undefined ? raw.activeBaselineId : null,
    comparedBaselineIds: raw.comparedBaselineIds ?? [null, null],
    recordedDates: raw.recordedDates !== undefined ? raw.recordedDates : null,
    datesAsRecorded: raw.datesAsRecorded ?? false,
    minuteModelPending: raw.minuteModelPending ?? false,
    project: raw.project?.id ? raw.project : { ...createDefaultProject(), ...raw.project },
    calendar: raw.calendar ?? createDefaultCalendar(),
  };
}

export function documentDataChanged(before: Snapshot, after: Snapshot): boolean {
  const b = before as unknown as Record<string, unknown>;
  const a = after as unknown as Record<string, unknown>;
  return DOCUMENT_FIELDS.some((f) => {
    if (f.snapshot !== 'data' || b[f.key] === a[f.key]) return false;
    if (f.key === 'project') {
      return !sameValue({ ...before.project, modifiedAt: undefined }, { ...after.project, modifiedAt: undefined });
    }
    if (f.key === 'ifcxReferences') {
      const left = before.ifcxReferences, right = after.ifcxReferences;
      if (!sameValue(left?.modelSource, right?.modelSource)) return true;
      if (!sameValue(left?.sourcePaths, right?.sourcePaths)) return true;
      if (!sameValue(left?.baselineStarts, right?.baselineStarts)) return true;
      const links = left?.elementLinks, other = right?.elementLinks;
      if (links === other) return false;
      if (links?.size !== other?.size) return true;
      return [...links ?? []].some(([id, targets]) => !sameValue(targets, other?.get(id)));
    }
    return !sameValue(b[f.key], a[f.key]);
  });
}

export function restoreSnapshot(
  s: AppState,
  raw: Snapshot,
  opts?: {
    markDirty?: boolean;
    clearImportPristine?: boolean;
  },
): void {
  const snap = migrateSnapshot(raw);
  const flat = snap as unknown as Record<string, unknown>;
  const fileSchema = { ifcSchema: s.project.ifcSchema, ifcSchemaUnconfirmed: s.project.ifcSchemaUnconfirmed };
  for (const f of DOCUMENT_FIELDS) {
    if (f.snapshot === 'none') continue;
    const value = f.key === 'project' ? withFileIfcSchema(snap.project, fileSchema) : flat[f.key];
    (f.set as (s: AppState, v: unknown) => void)(s, value);
  }
  syncProjectCalendar(s);
  const clearPristine = opts?.clearImportPristine !== false;
  if (opts?.markDirty !== false && clearPristine) markDocumentEdited(s);
  else if (opts?.markDirty !== false) markDocumentUnsaved(s);
  else if (clearPristine) s.importPristine = false;
}
