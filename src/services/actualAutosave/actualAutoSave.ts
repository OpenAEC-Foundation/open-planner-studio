import type { FileRef } from '@/services/fileAccess';
import type { IFCSaveSource } from '@/state/ifcSaveInput';

/** Hetzelfde venster als crashherstel: regelmatig tijdens lang werk, nooit per toetsaanslag. */
export const ACTUAL_AUTOSAVE_INTERVAL_MS = 10_000;

/** Pure throttle-hulp, los getest zodat recovery en echte bestandsopslag niet aan elkaar vastzitten. */
export function actualAutoSaveDelay(lastRunAt: number, now: number): number {
  return Math.max(0, ACTUAL_AUTOSAVE_INTERVAL_MS - (now - lastRunAt));
}

export interface ActualAutoSaveCandidate {
  id: string;
  enabled: boolean;
  dirty: boolean;
  ref: FileRef | null;
  source: IFCSaveSource;
}

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
 * ronde opgehaald; een mutatie tijdens een write ziet daardoor altijd een verse tweede ronde.
 */
export function createActualAutoSaveController(deps: {
  listCandidates: () => ActualAutoSaveCandidate[];
  serialize: (candidate: ActualAutoSaveCandidate) => string;
  /** Zonder permissieprompt nagaan of een bestaand doel nog schrijfbaar is. */
  canWrite: (ref: FileRef) => Promise<boolean>;
  /** Stil naar het bestaande doel schrijven; false betekent geen beschikbaar schrijfdoel. */
  write: (candidate: ActualAutoSaveCandidate, content: string) => Promise<boolean>;
  /** Wist dirty uitsluitend wanneer exact deze bronversie nog actueel is. */
  markSavedIfUnchanged: (candidate: ActualAutoSaveCandidate) => void;
  onFailure: (candidate: ActualAutoSaveCandidate, error: unknown) => void;
}): ActualAutoSaveController {
  let saving = false;
  let pending = false;
  let current: Promise<void> | null = null;

  const run = async () => {
    do {
      pending = false;
      for (const candidate of deps.listCandidates()) {
        if (!candidate.enabled || !candidate.dirty || !candidate.ref) continue;
        try {
          if (!await deps.canWrite(candidate.ref)) continue;
          const content = deps.serialize(candidate);
          if (await deps.write(candidate, content)) {
            deps.markSavedIfUnchanged(candidate);
          } else {
            // Geen stille "opgeslagen"-indruk bij een verdwenen/vergrendeld doel. De UI-laag
            // dedupliceert deze fout, zodat een aanhoudend probleem geen notificatiestorm wordt.
            deps.onFailure(candidate, new Error('Het bestaande projectbestand is niet schrijfbaar.'));
          }
        } catch (error) {
          deps.onFailure(candidate, error);
        }
      }
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
