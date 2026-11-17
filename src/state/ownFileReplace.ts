// #804, knownbug 1131 stap 5 (deel a): Ctrl+S op het eigen bestand van een document met een gebouwmodel op de desktop,
// als één functie (ontwerp §4.10 stappen 0 tot en met 6), plus wat herstel met de restbestanden doet. In deze stap
// roept nog geen opslagroute de vervanging aan: Ctrl+S op een pad weigert nog vóór de merge (`ifcForeignReplaceBlocked`).
// Het aansluiten is deel b, na "sluiten wacht op een lopende opslag" (#987). Het opruimen na een crash werkt al wel.
import { replaceWithRecoveryPending } from '@/services/recovery/recoveryPendingSource';
import {
  linkedOwnFile, replaceOwnFileBytes, settleReplaceRemnants, tauriOwnFileReplaceFs, tauriReplaceRemnantsFs,
  type OwnFileReplaceFs, type OwnFileReplaceOutcome, type PendingReplaceRecord, type RemnantEvent, type ReplaceRemnantsFs,
} from '@/services/fileAccess/ownFileReplace';
import { userFileHelperId } from '@/services/fileAccess/atomicWrite';
import type { LoadedRecoveryDoc } from '@/services/recovery/recoveryStore';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { replaceCopyLabel } from '@/i18n/replaceCopyName';
import { isTauri } from '@/utils/platform';
import {
  IFC_FOREIGN_PLACE_UNKNOWN_NOTICE, IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE, IFC_FOREIGN_TARGET_CHANGED_NOTICE,
  IFC_FOREIGN_TARGET_GONE_NOTICE,
} from './ifcForeignGuard';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

export type OwnPathReplaceResult = OwnFileReplaceOutcome | { code: 'not-recorded' };

export interface OwnPathReplaceInput {
  documentId: string;
  /** Het eigen bestand van het document (`saveTargetRef` van de soort `path`). */
  path: string;
  /** De voorbereide merge: één buffer en haar sha256 (`PreparedIfcWrite`). */
  prepared: { bytes: Uint8Array; sha256: string };
  /** De bron in het geheugen (`ifcSource`): wat op het doel hoort te staan. */
  source: { bytes: Uint8Array; sha256: string };
  /** Na een geslaagde vervanging: de geschreven versie wordt de bron (`commitSavedDocument` met `prepared`). */
  commit: () => void;
  fs?: OwnFileReplaceFs;
  now?: Date;
}

/**
 * Het eigen bestand vervangen, binnen `runProjectFileWrite`. Een gelinkt doel weigert vóór alles. Dan stap 0 (het
 * manifest krijgt `pendingReplace` en `pendingSha256`; lukt dat niet, dan `not-recorded` en gebeurt er niets), stap 1
 * tot en met 5 (`replaceOwnFileBytes`), en stap 6: na `replaced` eerst `commit`, dan wist het herstel de twee velden.
 */
export async function replaceOwnPathWithRecovery(input: OwnPathReplaceInput): Promise<OwnPathReplaceResult> {
  const fs = input.fs ?? await tauriOwnFileReplaceFs();
  const target = await linkedOwnFile(fs, input.path);
  if (target.linked) return { code: 'save-as-only', why: 'linked target' };
  const id = userFileHelperId();
  let outcome: OwnFileReplaceOutcome | undefined;
  const recorded = await replaceWithRecoveryPending(input.documentId, input.prepared.sha256, {
    replace: async () => {
      outcome = await replaceOwnFileBytes(fs, {
        path: input.path, id, bytes: input.prepared.bytes, source: input.source.bytes,
        ...(target.mode === undefined ? {} : { mode: target.mode }), label: replaceCopyLabel(input.now),
      });
      return outcome.code === 'replaced';
    },
    commit: input.commit,
  }, { id, vorigeSha256: input.source.sha256 });
  return recorded === 'not-recorded' ? { code: 'not-recorded' } : outcome!;
}

/** De meldingen bij een uitkomst; leeg bij een gewone geslaagde vervanging. */
export function ownPathReplaceNotices(result: OwnPathReplaceResult, path: string): NotifyInput[] {
  switch (result.code) {
    case 'replaced': return [
      ...(result.otherVersion ? [otherVersionNotice(path, result.otherVersion)] : []),
      ...(result.leftOver ? [leftOverNotice(path, result.leftOver)] : []),
    ];
    case 'not-recorded': return [IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE];
    case 'target-changed': return [result.content === 'changed' ? IFC_FOREIGN_TARGET_CHANGED_NOTICE : IFC_FOREIGN_TARGET_GONE_NOTICE];
    case 'save-as-only': return [refusalNotice({
      messageKey: 'notifications.ifcForeignReplaceSaveAsOnly', detail: result.why, dedupeKey: 'ifc-foreign-replace-save-as-only',
    })];
    case 'failed': return [{
      severity: 'error', messageKey: 'notifications.ifcForeignReplaceFailed', detail: result.detail,
      dedupeKey: 'ifc-foreign-replace-failed', replaceOnDedupe: true,
    }];
    case 'unknown': return [IFC_FOREIGN_PLACE_UNKNOWN_NOTICE];
    case 'target-taken': return [{
      severity: 'error', messageKey: 'notifications.ifcForeignReplaceTargetTaken',
      params: { target: result.target, temp: result.temp, previous: result.previous },
    }];
    case 'previous-stranded': return [{
      severity: 'error', messageKey: 'notifications.ifcForeignReplacePreviousStranded',
      params: { previous: result.previous }, detail: result.detail,
    }];
  }
}

// Geen weigering maar een feit over bestanden op schijf: rood, en het blijft staan tot het kruisje (ook na een
// documentwissel), want het noemt een pad dat de planner moet kunnen terugvinden.
const otherVersionNotice = (file: string, copy: string): NotifyInput => ({
  severity: 'error', messageKey: 'notifications.ifcForeignReplaceOtherVersion', params: { file, copy },
});
const leftOverNotice = (file: string, path: string): NotifyInput => ({
  severity: 'error', messageKey: 'notifications.ifcForeignReplaceLeftOver', params: { file, path },
  // Herstel en daarna het openen kunnen hetzelfde restbestand noemen: één regel.
  dedupeKey: `ifc-foreign-replace-left-over:${path}`, replaceOnDedupe: true,
});

/** De meldingen bij het opruimen van restbestanden. Het terugzetten van de vorige versie meldt niets: dan staat het
 *  bestand weer zoals vóór de opslag, en de melding over de niet opgeslagen planning noemt het pad. */
export function remnantNotices(events: readonly RemnantEvent[]): NotifyInput[] {
  return events.flatMap((event): NotifyInput[] => {
    switch (event.kind) {
      case 'previous-back': return [];
      case 'other-version': return [otherVersionNotice(event.target, event.copy)];
      case 'unsaved-schedule': return [{
        severity: 'error', messageKey: 'notifications.ifcForeignReplaceUnsavedCopy', params: { file: event.target, copy: event.copy },
      }];
      case 'left-over': return [leftOverNotice(event.target, event.path)];
    }
  });
}

// ── Restbestanden na een crash: bij herstel en bij het openen van het bestand ────────────────────────────────────

/** De onderbroken vervanging uit een manifestregel, als het document een desktoppad als doel had. */
export function pendingReplaceOf(doc: Pick<LoadedRecoveryDoc, 'ifcSource' | 'foreignSource'>): PendingReplaceRecord | null {
  const replace = doc.ifcSource?.pendingReplace, path = doc.foreignSource?.filePath;
  if (!replace || !path || doc.foreignSource?.siteFileId) return null;
  return { path, id: replace.id, vorigeSha256: replace.vorigeSha256, pendingSha256: replace.pendingSha256,
    sha256: doc.ifcSource!.sha256 };
}

/** Wat bij herstel niet helemaal thuisgebracht is (een restbestand bleef staan, of een fout), per doelpad: opnieuw bij
 *  het openen van dat bestand. Alleen in het geheugen van deze sessie. */
const unsettled = new Map<string, PendingReplaceRecord>();

async function settle(record: PendingReplaceRecord, fs: ReplaceRemnantsFs | undefined, now: Date | undefined): Promise<NotifyInput[]> {
  try {
    const events = await settleReplaceRemnants(fs ?? await tauriReplaceRemnantsFs(), record, replaceCopyLabel(now), precomputeSha256);
    // Bleef er iets staan, dan probeert het openen van het bestand het nog eens.
    if (events.some(event => event.kind === 'left-over')) unsettled.set(record.path, record);
    else unsettled.delete(record.path);
    return remnantNotices(events);
  } catch (error) {
    console.error('Restbestanden van een onderbroken opslag niet opgeruimd:', record.path, error);
    unsettled.set(record.path, record);
    return [];
  }
}

/**
 * Bij herstel, vóór de bron gelezen wordt: de restbestanden van elke onderbroken vervanging in het manifest. Alleen op
 * de desktop (de browser vervangt via de handle, zonder restbestanden). Los van de flag: de restbestanden zijn van een
 * eerdere sessie en blijven anders onvindbaar zodra het manifest zonder `pendingReplace` opnieuw geschreven is.
 */
export async function settleRecoveredReplaces(
  docs: readonly Pick<LoadedRecoveryDoc, 'ifcSource' | 'foreignSource'>[], options: { fs?: ReplaceRemnantsFs; now?: Date } = {},
): Promise<NotifyInput[]> {
  if (!options.fs && !isTauri()) return [];
  const notices: NotifyInput[] = [];
  for (const doc of docs) {
    const record = pendingReplaceOf(doc);
    if (record) notices.push(...await settle(record, options.fs, options.now));
  }
  return notices;
}

/** Bij het openen van een pad: had het manifest voor dit bestand een vervanging die bij herstel niet thuiskwam? */
export async function settleReplaceOnOpen(path: string, options: { fs?: ReplaceRemnantsFs; now?: Date } = {}): Promise<NotifyInput[]> {
  const record = unsettled.get(path);
  return record ? settle(record, options.fs, options.now) : [];
}
