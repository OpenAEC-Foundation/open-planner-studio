// #804, knownbug 1131 stap 5: Ctrl+S op het eigen bestand van een document met een gebouwmodel op de desktop, als één
// functie (ontwerp §4.10 stappen 0 tot en met 6), plus de meldingen bij het afhandelen van restbestanden. Deel b sluit
// Ctrl+S en *Opslaan* in de sluitvraag erop aan (`replaceOwnPath` in `fileSlice.ts`), binnen de ene `runProjectFileWrite`
// van die opslag. Het afhandelen na een crash loopt los daarvan (`settlePendingReplaces`, bij de start en vóór het lezen
// van een lokaal pad). Keuze 4 (knownbug 1131 stap 8): *Opslaan als* over een andere bestaande naam gebruikt dezelfde
// functie (`replaceExistingPath` in `fileSlice.ts`), met als verwachte inhoud wat de bestandskiezer op dat doel vond
// (`pickSaveTarget`).
import { replaceWithRecoveryPending } from '@/services/recovery/recoveryPendingSource';
import {
  linkedOwnFile, replaceHelpersGone, replaceOwnFileBytes, tauriOwnFileReplaceFs,
  type OwnFileReplaceFs, type OwnFileReplaceOutcome, type RemnantEvent,
} from '@/services/fileAccess/ownFileReplace';
import { tauriReplaceRecords, whileReplaceRuns, type ReplaceRecordStore } from '@/services/fileAccess/replaceRecords';
import { userFileHelperId } from '@/services/fileAccess/atomicWrite';
import type { RefuseBeforePlace } from '@/services/fileAccess';
import { replaceCopyLabel } from '@/i18n/replaceCopyName';
import {
  IFC_FOREIGN_PLACE_UNKNOWN_NOTICE, IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE, IFC_FOREIGN_TARGET_CHANGED_NOTICE,
  IFC_FOREIGN_TARGET_GONE_NOTICE,
} from './ifcForeignGuard';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

export type OwnPathReplaceResult = OwnFileReplaceOutcome | { code: 'not-recorded' }
  /** `stopBeforeWrite` stopte de vervanging na de eerste herstelronde; niets in de projectmap aangeraakt. */
  | { code: 'stopped' };

export interface OwnPathReplaceInput {
  documentId: string;
  /** Het doel: het eigen bestand van het document (`saveTargetRef` van de soort `path`), of bij Opslaan als over een
   *  bestaande naam het gekozen bestand. */
  path: string;
  /** De voorbereide merge: één buffer en haar sha256 (`PreparedIfcWrite`). */
  prepared: { bytes: Uint8Array; sha256: string };
  /** Wat op het doel hoort te staan (`vorigeSha256` in het herstelrecord): bij Ctrl+S de bron in het geheugen
   *  (`ifcSource`), bij Opslaan als over een bestaande naam wat de bestandskiezer op dat doel vond. */
  source: { bytes: Uint8Array; sha256: string };
  /** Na een geslaagde vervanging: de geschreven versie wordt de bron (`commitSavedDocument` met `prepared`). */
  commit: () => void;
  /** Verplicht: na de eerste herstelronde en vóór de eerste schrijfactie in de projectmap opnieuw de doelbewaking
   *  (dezelfde als vóór de merge): `true` = stoppen (het document, zijn opslagdoel of zijn bron veranderde, of een
   *  ander open document heeft het bestand intussen als bron). Meldt zelf; de uitkomst is dan `stopped`. */
  stopBeforeWrite: () => Promise<boolean>;
  /** Verplicht (knownbug 1896): de laatste controle, vlak vóór het opzijzetten van het doel (na de tweede doellezing,
   *  `replaceOwnFileBytes`): hoort de opslag nog bij de inhoud van het document (`refuseChangedDocumentWrite`)? `true` =
   *  stoppen; het tijdelijke bestand en het record gaan langs het gewone opruimpad weg. Meldt zelf. */
  refuseBeforePlace: RefuseBeforePlace;
  fs?: OwnFileReplaceFs;
  records?: ReplaceRecordStore;
  now?: Date;
}

/**
 * Het eigen bestand vervangen, binnen `runProjectFileWrite`. Een gelinkt doel weigert vóór alles (`linkedOwnFile`, de
 * enige voorcontrole). Dan stap 0: het herstelrecord (`replaceRecords.ts`: id, doel, `vorigeSha256`, `pendingSha256`)
 * en in het manifest `pendingSha256`; lukt een van de twee niet, dan `not-recorded` en staat er niets op schijf. Na die
 * eerste herstelronde nog de doelbewaking `stopBeforeWrite` (`stopped`: niets in de projectmap aangeraakt). Dan
 * stap 1 tot en met 5 (`replaceOwnFileBytes`, met vlak vóór stap 3 de laatste controle `refuseBeforePlace`) en stap 6:
 * na `replaced` eerst `commit`, dan wist het herstel `pendingSha256`. Het record verdwijnt alleen als er geen
 * hulpbestand van de operatie meer staat: meteen als stap 1 aantoonbaar niets schreef (`not-recorded`, `stopped` door
 * `stopBeforeWrite`, en `save-as-only` met `nothingWritten`: de aanmaak buiten de scope geweigerd, knownbug 1902),
 * anders na `replaceHelpersGone`; na `unknown` (`source-changed`) blijft het altijd. Een record dat blijft, handelt de
 * volgende start of het openen van het bestand af.
 */
export async function replaceOwnPathWithRecovery(input: OwnPathReplaceInput): Promise<OwnPathReplaceResult> {
  const fs = input.fs ?? await tauriOwnFileReplaceFs();
  const target = await linkedOwnFile(fs, input.path);
  if (target.linked) return { code: 'save-as-only', why: 'linked target' };
  const records = input.records ?? await tauriReplaceRecords();
  const id = userFileHelperId();
  return whileReplaceRuns(id, async () => {
    try {
      await records.write({ id, path: input.path, vorigeSha256: input.source.sha256, pendingSha256: input.prepared.sha256 });
    } catch (error) {
      console.error('Herstelrecord van de vervanging niet vastgelegd:', input.path, error);
      return { code: 'not-recorded' };
    }
    let outcome: OwnFileReplaceOutcome | undefined;
    /** Stap 1 schreef aantoonbaar niets: ze begon nooit, of de aanmaak van het tijdelijke bestand werd geweigerd. */
    let nothingWritten = false;
    const recorded = await replaceWithRecoveryPending(input.documentId, input.prepared.sha256, {
      replace: async () => {
        if (await input.stopBeforeWrite()) {
          outcome = { code: 'stopped' };
          nothingWritten = true;
          return false;
        }
        outcome = await replaceOwnFileBytes(fs, {
          path: input.path, id, bytes: input.prepared.bytes, source: input.source.bytes,
          ...(target.mode === undefined ? {} : { mode: target.mode }), label: replaceCopyLabel(input.now),
          refuseBeforePlace: input.refuseBeforePlace,
        });
        nothingWritten = outcome.code === 'save-as-only' && outcome.nothingWritten === true;
        return outcome.code === 'replaced';
      },
      commit: input.commit,
    });
    if (recorded === 'not-recorded' || nothingWritten
      || (outcome!.code !== 'unknown' && await replaceHelpersGone(fs, input.path, id))) {
      // Niets meer op schijf van deze operatie. Bij `not-recorded`, `stopped` vóór stap 1 en een geweigerde aanmaak
      // (buiten de scope, waar ook `lstat` op de hulpnamen geweigerd wordt) staat er aantoonbaar niets. Een mislukt
      // wissen is geen fout: de volgende start vindt dan geen hulpbestand en wist het record alsnog.
      await records.remove(id).catch(error => console.error('Herstelrecord van de vervanging niet gewist:', error));
    }
    return recorded === 'not-recorded' ? { code: 'not-recorded' } : outcome!;
  });
}

/** De meldingen bij een uitkomst; leeg bij een gewone geslaagde vervanging. */
export function ownPathReplaceNotices(result: OwnPathReplaceResult, path: string): NotifyInput[] {
  switch (result.code) {
    case 'replaced': return [
      ...(result.otherVersion ? [otherVersionNotice(path, result.otherVersion)] : []),
      ...(result.leftOver ? [leftOverNotice(path, result.leftOver)] : []),
    ];
    case 'not-recorded': return [IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE];
    case 'stopped': return []; // `stopBeforeWrite` meldde zelf
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

/** De meldingen bij het afhandelen van restbestanden (`settlePendingReplaces`). */
export function remnantNotices(events: readonly RemnantEvent[]): NotifyInput[] {
  return events.map((event): NotifyInput => event.kind === 'unsaved-schedule'
    ? { severity: 'error', messageKey: 'notifications.ifcForeignReplaceUnsavedCopy', params: { file: event.target, copy: event.copy } }
    : leftOverNotice(event.target, event.path));
}
