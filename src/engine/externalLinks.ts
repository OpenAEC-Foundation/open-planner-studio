import type { Task, ExternalLink } from '@/types/task';

/**
 * Externe (cross-project) dependencies — verversen van het bevroren anker (fase 2.9, §4.5/§5.5).
 *
 * GEEN live multi-document-solve: een `ExternalLink` rekent altijd op zijn gecachte `anchorDate`
 * (P6 External Dates). Deze module levert de PURE herberekening van dat anker uit de ACTUELE datum
 * van de brontaak — de bron wordt door de aanroeper READ-ONLY geparsed (bestaande readers), nooit
 * als document geopend. `sourceMissing` volgt uit de vindbaarheid van de brontaak.
 */

/** Read-only geparsede bron (via de bestaande readers): projectidentiteit + taken-met-datums. */
export interface ExternalSourceDoc {
  /** `Project.id` — het primaire match-anker (persistente IFC-project-GlobalId-seed, §3.3). */
  projectId: string;
  /** Bestandspad — secundair match-anker/label wanneer de projectId (nog) niet overeenkomt. */
  filePath?: string;
  projectName?: string;
  /** Brontaken; de anker-datum leest uit `time.earlyFinish`/`time.earlyStart` (val terug op de
   *  schedule-datums als de vroege datums leeg zijn — een vers-geparsed bestand zonder herrekening). */
  tasks: Task[];
}

export interface RefreshResult {
  /** De (mogelijk vervangen) takenlijst; ongewijzigde taken behouden hun referentie. */
  tasks: Task[];
  /** Aantal links waarvan het anker uit een gevonden brontaak is bijgewerkt. */
  refreshed: number;
  /** Aantal links waarvan de brontaak (in deze bron) niet gevonden werd ⇒ `sourceMissing=true`. */
  missing: number;
  /** true zodra minstens één link daadwerkelijk veranderde (anker of sourceMissing). */
  changed: boolean;
}

/**
 * Welke zijde (start/finish) van de BRONTAAK het anker voedt, per richting + relType (§4.5-mapping).
 * De relType-conventie is voorganger→opvolger (eerste teken = voorganger-zijde, tweede = opvolger-zijde).
 * - `direction:'predecessor'` — de BRON is mijn voorganger ⇒ de bron-zijde is het EERSTE teken:
 *   FS/FF ⇒ `finish`, SS/SF ⇒ `start`.
 * - `direction:'successor'` — de BRON is mijn opvolger ⇒ de bron-zijde is het TWEEDE teken:
 *   FS/SS ⇒ `start`, FF/SF ⇒ `finish`.
 */
export function externalSourceSide(
  direction: ExternalLink['direction'],
  relType: ExternalLink['relType'],
): 'start' | 'finish' {
  const letter = direction === 'predecessor' ? relType[0] : relType[1];
  return letter === 'F' ? 'finish' : 'start';
}

/** De actuele anker-datum die `link` uit `srcTask` leest (§4.5-mapping); leeg ⇒ geen bruikbare datum. */
export function sourceAnchorDate(link: ExternalLink, srcTask: Task): string {
  const side = externalSourceSide(link.direction, link.relType);
  return side === 'finish'
    ? srcTask.time.earlyFinish || srcTask.time.scheduleFinish
    : srcTask.time.earlyStart || srcTask.time.scheduleStart;
}

/** Matcht een link met `source`: primair op `sourceRef.projectId`, secundair (fallback) op `filePath`. */
function linkMatchesSource(link: ExternalLink, source: ExternalSourceDoc): boolean {
  if (link.sourceRef.projectId && link.sourceRef.projectId === source.projectId) return true;
  return !!link.sourceRef.filePath && !!source.filePath && link.sourceRef.filePath === source.filePath;
}

/**
 * Ververst alle externe links die naar `source` verwijzen met de actuele brontaak-datums (§4.5).
 * Puur: muteert niets in-place; ongewijzigde taken/links behouden hun referentie (goedkope re-render).
 * Links naar een ándere bron blijven onaangeroerd. Match: projectId (fallback filePath); brontaak-match
 * op `sourceRef.taskId`. Gevonden ⇒ anker bijgewerkt + `sourceMissing=false` + `sourceRef` gecanonicaliseerd;
 * niet gevonden (bron wél geladen, taak weg) ⇒ oud anker behouden + `sourceMissing=true`.
 */
export function refreshExternalAnchors(tasks: Task[], source: ExternalSourceDoc): RefreshResult {
  const srcById = new Map(source.tasks.map((t) => [t.id, t]));
  let refreshed = 0;
  let missing = 0;
  let anyChanged = false;

  const outTasks = tasks.map((task) => {
    if (!task.externalLinks || task.externalLinks.length === 0) return task;
    let taskChanged = false;
    const links = task.externalLinks.map((link): ExternalLink => {
      if (!linkMatchesSource(link, source)) return link; // andere bron ⇒ ongemoeid

      const srcTask = srcById.get(link.sourceRef.taskId);
      if (!srcTask) {
        missing++;
        if (link.sourceMissing === true) return link;
        taskChanged = true;
        return { ...link, sourceMissing: true };
      }

      const anchorDate = sourceAnchorDate(link, srcTask);
      refreshed++;
      const nextRef = {
        ...link.sourceRef,
        projectId: source.projectId,
        projectName: source.projectName ?? link.sourceRef.projectName,
        taskName: srcTask.name,
        filePath: source.filePath ?? link.sourceRef.filePath,
      };
      // Geen daadwerkelijke wijziging ⇒ referentie behouden (byte-/render-stabiel).
      if (
        link.anchorDate === anchorDate &&
        link.sourceMissing === false &&
        link.sourceRef.projectId === nextRef.projectId &&
        link.sourceRef.projectName === nextRef.projectName &&
        link.sourceRef.taskName === nextRef.taskName &&
        link.sourceRef.filePath === nextRef.filePath
      ) {
        return link;
      }
      taskChanged = true;
      return { ...link, anchorDate: anchorDate || link.anchorDate, sourceMissing: false, sourceRef: nextRef };
    });
    if (!taskChanged) return task;
    anyChanged = true;
    return { ...task, externalLinks: links };
  });

  return { tasks: anyChanged ? outTasks : tasks, refreshed, missing, changed: anyChanged };
}
