import type { FileRef } from '@/services/fileAccess';
import type { IFCSaveSource } from '@/state/ifcSaveInput';

/** Herkenbare weigering; de UI vertaalt de melding pas bij het tonen. */
export class AutoSaveTargetUnavailableError extends Error {
  constructor() {
    super('The existing project file is not writable.');
    this.name = 'AutoSaveTargetUnavailableError';
  }
}

/** Hetzelfde venster als crashherstel: regelmatig tijdens lang werk, nooit per toetsaanslag. */
export const ACTUAL_AUTOSAVE_INTERVAL_MS = 10_000;

/** Pure throttle-hulp, los getest zodat recovery en echte bestandsopslag niet aan elkaar vastzitten. */
export function actualAutoSaveDelay(lastRunAt: number, now: number): number {
  return Math.max(0, ACTUAL_AUTOSAVE_INTERVAL_MS - (now - lastRunAt));
}

export interface ActualAutoSaveCandidate {
  id: string;
  /** De identiteit van de inhoud bij het kiezen (fixronde 1 van #1020, `documentSaveState.ts`): de commit legt alleen
   *  vast als het document die inhoud nog heeft. */
  content: number;
  enabled: boolean;
  dirty: boolean;
  ref: FileRef | null;
  source: IFCSaveSource;
}

/** De uitkomst van één ronde voor één kandidaat (zie `write` hieronder). */
export type ActualAutoSaveWrite = boolean | 'stale' | 'refused' | 'yielded';

export interface ActualAutoSaveController {
  /** Start één run, of markeert tijdens een write dat de nieuwste staat nog moet volgen. */
  flush: () => Promise<void>;
  isSaving: () => boolean;
}

/**
 * De echte bestands-autosave is bewust een kleine, injecteerbare controller. Recovery gebruikt
 * een totaal andere backend en blijft dus zowel semantisch als technisch onafhankelijk.
 *
 * Eén controller verwerkt kandidaten serieel. Kandidaten worden pas aan het begin van iedere
 * doorgang opgehaald; een mutatie tijdens een write ziet daardoor altijd een verse tweede doorgang.
 * #804 stap 6: voorbereiden, schrijven en vastleggen horen bij één schrijfbeurt (`write`), zoals bij Ctrl+S.
 */
export function createActualAutoSaveController(deps: {
  /** Knownbug 1939: elke doorgang (één lijst plus haar writes, ook een herhaalronde) loopt via de schrijfcoördinatie
   *  (`runAutoSaveRound`). Die beslist of de doorgang loopt en wanneer ze haar lijst maakt. */
  round: (pass: () => Promise<void>) => Promise<void>;
  listCandidates: () => ActualAutoSaveCandidate[];
  /** Zonder permissieprompt nagaan of een bestaand doel nog schrijfbaar is. */
  canWrite: (ref: FileRef) => Promise<boolean>;
  /** De hele ronde voor één kandidaat: voorbereiden, stil naar het bestaande doel schrijven en de geschreven versie
   *  vastleggen (dirty alleen wissen als precies die versie nog actueel is). `true`: geschreven en vastgelegd; `false`
   *  betekent geen beschikbaar schrijfdoel, `'stale'` dat de inhoud intussen gewijzigd is (niets geschreven, geen fout —
   *  een nieuwe ronde pakt de actuele inhoud op), `'refused'` dat de doelcontrole het doel weigerde (#804 fixronde 2:
   *  niets geschreven, het document blijft gewijzigd; de aanroeper heeft het al gemeld) of dat de laatste fase van
   *  afsluiten of van de updater al begonnen was (#804 stap 3: niets geschreven, niets te melden). `'yielded'` (#804 stap 8):
   *  de ronde van een document met een gebouwmodel week voor een handmatige actie; niets geschreven, geen melding, het
   *  ritme probeert het na de volgende rustperiode opnieuw. */
  write: (candidate: ActualAutoSaveCandidate) => Promise<ActualAutoSaveWrite>;
  onFailure: (candidate: ActualAutoSaveCandidate, error: unknown) => void;
}): ActualAutoSaveController {
  let saving = false;
  let pending = false;
  let current: Promise<void> | null = null;

  const run = async () => {
    // Begrensd: blijft een bron "stale" (bv. doordat elke lezing een nieuw object oplevert), dan
    // mag dat nooit een eindeloze schrijflus worden — de volgende throttle-ronde probeert opnieuw.
    let staleRounds = 0;
    do {
      pending = false;
      await deps.round(async () => {
        for (const candidate of deps.listCandidates()) {
          if (!candidate.enabled || !candidate.dirty || !candidate.ref) continue;
          try {
            if (!await deps.canWrite(candidate.ref)) continue;
            const written = await deps.write(candidate);
            if (written === 'refused' || written === 'yielded') {
              // Geweigerd doel of geweken voor een handmatige actie: geen write, geen "opgeslagen", geen tweede melding.
              continue;
            }
            if (written === 'stale') {
              // De bron veranderde terwijl we op een eerdere write of `canWrite` wachtten: dat is
              // geen onschrijfbaar bestand (audit 2026-09-26 — het gaf een valse foutmelding), maar
              // een reden voor nog een ronde met de actuele inhoud.
              if (staleRounds++ < 3) pending = true;
            } else if (!written) {
              // Geen stille "opgeslagen"-indruk bij een verdwenen/vergrendeld doel. De UI-laag
              // dedupliceert deze fout, zodat een aanhoudend probleem geen notificatiestorm wordt.
              deps.onFailure(candidate, new AutoSaveTargetUnavailableError());
            }
          } catch (error) {
            deps.onFailure(candidate, error);
          }
        }
      });
    } while (pending);
  };

  return {
    flush: async () => {
      if (current) {
        pending = true;
        await current;
        return;
      }
      saving = true;
      current = run();
      try {
        await current;
      } finally {
        current = null;
        saving = false;
      }
    },
    isSaving: () => saving,
  };
}
