import type { Task, ExternalLink } from '@/types/task';
import { externalSourceSide, isValidExternalLagValue, normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { isRecord } from '@/utils/guards';
import { computedStart, computedFinish } from '@/utils/taskDates';
import { isPinnedComplete } from '@/engine/scheduler/duration';

export { externalSourceSide };

/**
 * Externe (cross-project) dependencies — verversen van het bevroren anker.
 *
 * GEEN live multi-document-solve: een `ExternalLink` rekent altijd op zijn gecachte `anchorDate`
 * (P6 External Dates). Deze module levert de PURE herberekening van dat anker uit de ACTUELE datum
 * van de brontaak — de bron wordt door de aanroeper READ-ONLY geparsed (bestaande readers), nooit
 * als document geopend. `sourceMissing` volgt uit de vindbaarheid van de brontaak.
 */

/** Read-only geparsede bron (via de bestaande readers): projectidentiteit + taken-met-datums. */
export interface ExternalSourceDoc {
  /** `Project.id` — het primaire match-anker (persistente IFC-project-GlobalId-seed). */
  projectId: string;
  /** Bestandspad — secundair match-anker/label wanneer de projectId (nog) niet overeenkomt. */
  filePath?: string;
  projectName?: string;
  /** Brontaken; de anker-datum leest uit hun datums volgens {@link sourceAnchorDate}: de vroege voor
   *  een voorganger, de late voor een opvolger. */
  tasks: Task[];
  /** Per brontaak-id: welke late datums het BESTAND zelf droeg. Nodig omdat de bronlezer de bron
   *  doorrekent zoals openen (`readExternalSource`): daarna heeft elke taak late datums, ook als het
   *  bestand ze niet had. Ontbreekt dit veld (een bron die de aanroeper zelf opbouwde), dan tellen de
   *  late datums van `tasks`; ontbreekt alleen de taak, dan droeg het bestand voor haar niets. */
  lateDatesInFile?: Readonly<Record<string, LateDatesInFile>>;
}

/** Of het bronbestand voor een taak een late start en een late finish droeg. */
export interface LateDatesInFile {
  start: boolean;
  finish: boolean;
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

/** Normaal blijft de persistente project-id primair en is het pad alleen fallback. De bulkverversing
 * gebruikt `file-path` uitsluitend wanneer twee tegelijk gelezen bronnen dezelfde project-id
 * claimen; zo worden kopieën uit elkaar gehouden zonder een verplaatst enkel bronbestand te breken. */
export type ExternalSourceMatchScope = 'project-or-path' | 'file-path';

/** Is deze kant van de brontaak al gebeurd? Een gestarte kant heeft een werkelijke start (of de taak is
 *  voltooid), een gebeurde finish hoort bij een voltooide taak. Voor een bladtaak is dat precies
 *  `startIsActual`/`finishIsActual` (`taskDates.ts`). Een VERZAMELTAAK telt hier ook mee: die draagt na de
 *  berekening de werkelijke datums en de voortgang van haar bladen (`writeSummaryProgress`); de
 *  gedeelde helpers sluiten haar bewust uit, want het scherm leidt haar datums uit de kinderen af. */
function sourceSideHappened(task: Task, side: 'start' | 'finish'): boolean {
  const done = isPinnedComplete(task.time);
  return side === 'finish' ? done : done || !!task.time.actualStart;
}

/** De actuele anker-datum die `link` uit `srcTask` leest; leeg ⇒ geen bruikbare datum. BEWUST een
 *  REKENdatum, niet de getoonde: het anker voedt de berekening van een ander document, en de getoonde
 *  start van een gestarte brontaak is haar werkelijke start.
 *
 *  - Externe VOORGANGER: de vroege datum (`computedStart`/`computedFinish`). Hij duwt mijn taak.
 *  - Externe OPVOLGER: de laatst toelaatbare datum, de late start (FS, SS) of de late finish (FF, SF).
 *    Hij begrenst hoe laat mijn taak klaar mag zijn; zo rekent P6 als beide projecten open zijn
 *    (External Late Finish). Besluit van Ethan, 2026-11-02 (voorstel 1 uit #792). Wie aan de
 *    geplande datum vast wil houden, zet een datumbeperking.
 *    Terugval op de vroege datum:
 *    - als het bronbestand voor die kant geen late datum droeg (`source.lateDatesInFile`), of de
 *      brontaak er geen heeft;
 *    - als die kant van de brontaak al gebeurd is (gestart of klaar, ook bij een fase,
 *      {@link sourceSideHappened}). Een gestarte taak houdt in de berekening een late start ná haar
 *      werkelijke start; die speling bestaat niet meer. */
export function sourceAnchorDate(
  link: Pick<ExternalLink, 'direction' | 'relType'>,
  srcTask: Task,
  source?: Pick<ExternalSourceDoc, 'lateDatesInFile'>,
): string {
  const side = externalSourceSide(link.direction, link.relType);
  if (link.direction === 'successor') {
    const inFile = source?.lateDatesInFile ? source.lateDatesInFile[srcTask.id]?.[side] === true : true;
    const late = side === 'finish' ? srcTask.time.lateFinish : srcTask.time.lateStart;
    if (inFile && late && !sourceSideHappened(srcTask, side)) return late;
  }
  return side === 'finish'
    ? computedFinish(srcTask)
    : computedStart(srcTask);
}

/** Matcht een link met `source`: normaal primair op project-id en secundair op genormaliseerd pad.
 * `file-path` is de begrensde ambiguïteitsmodus voor meerdere bronnen met dezelfde project-id. */
export function linkMatchesSource(
  link: ExternalLink,
  source: ExternalSourceDoc,
  matchScope: ExternalSourceMatchScope = 'project-or-path',
): boolean {
  if (matchScope === 'project-or-path'
    && link.sourceRef.projectId
    && link.sourceRef.projectId === source.projectId) return true;
  if (!link.sourceRef.filePath || !source.filePath) return false;
  const linkPath = normalizeExternalSourcePath(link.sourceRef.filePath);
  const sourcePath = normalizeExternalSourcePath(source.filePath);
  return linkPath !== null && sourcePath !== null && linkPath === sourcePath;
}

/**
 * Ververst alle externe links die naar `source` verwijzen met de actuele brontaak-datums.
 * Puur: muteert niets in-place; ongewijzigde taken/links behouden hun referentie (goedkope re-render).
 * Links naar een ándere bron blijven onaangeroerd. Match: projectId (fallback filePath); brontaak-match
 * op `sourceRef.taskId`. Gevonden ⇒ anker bijgewerkt + `sourceMissing=false` + `sourceRef` gecanonicaliseerd;
 * niet gevonden (bron wél geladen, taak weg) ⇒ oud anker behouden + `sourceMissing=true`.
 */
export function refreshExternalAnchors(
  tasks: Task[],
  source: ExternalSourceDoc,
  matchScope: ExternalSourceMatchScope = 'project-or-path',
): RefreshResult {
  const srcById = new Map(source.tasks.map((t) => [t.id, t]));
  let refreshed = 0;
  let missing = 0;
  let anyChanged = false;

  const outTasks = tasks.map((task) => {
    if (!task.externalLinks || task.externalLinks.length === 0) return task;
    let taskChanged = false;
    const links = task.externalLinks.map((link): ExternalLink => {
      if (!linkMatchesSource(link, source, matchScope)) return link; // andere bron ⇒ ongemoeid

      const srcTask = srcById.get(link.sourceRef.taskId);
      if (!srcTask) {
        missing++;
        if (link.sourceMissing === true) return link;
        taskChanged = true;
        return { ...link, sourceMissing: true };
      }

      const anchorDate = sourceAnchorDate(link, srcTask, source);
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

const DIRECTIONS: readonly string[] = ['predecessor', 'successor'];
const RELATION_TYPES: readonly string[] = ['FS', 'SS', 'FF', 'SF'];
const OPTIONAL_SOURCE_FIELDS = ['projectName', 'taskName', 'filePath'] as const;

/**
 * De externe koppelingen uit een opgeslagen bestand (`OPS_ExternalLink`), in een vorm die de app
 * aankan. Een koppeling zonder geldige richting, type, anker (tekst) of bron (project-id als tekst,
 * taak-id niet leeg) valt weg: zulke data liet laden, rekenen en de relatiecel vastlopen. Een
 * ontbrekend of dubbel id krijgt een eigen id per taak, een ontbrekende bronstatus wordt "bron
 * ontbreekt", een ongeldige lag en een bronveld dat geen tekst is vervallen. Onbekende extra velden
 * blijven staan, zodat een nieuwere versie van de app bij opslaan niets verliest.
 * Geen geldige koppeling ⇒ `undefined` (de taak heeft er dan geen).
 */
export function storedExternalLinks(value: unknown): ExternalLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const used = new Set<string>();
  const uniqueId = (wanted: string): string => {
    let id = wanted;
    for (let n = 2; used.has(id); n++) id = `${wanted}-${n}`;
    used.add(id);
    return id;
  };
  const links: ExternalLink[] = [];
  value.forEach((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.sourceRef)) return;
    const { direction, relType, anchorDate, sourceRef } = raw;
    if (typeof direction !== 'string' || !DIRECTIONS.includes(direction)) return;
    if (typeof relType !== 'string' || !RELATION_TYPES.includes(relType)) return;
    if (typeof anchorDate !== 'string') return;
    if (typeof sourceRef.projectId !== 'string') return;
    if (typeof sourceRef.taskId !== 'string' || sourceRef.taskId === '') return;
    const ref: Record<string, unknown> = { ...sourceRef };
    for (const key of OPTIONAL_SOURCE_FIELDS) if (key in ref && typeof ref[key] !== 'string') delete ref[key];
    const link: Record<string, unknown> = {
      ...raw,
      id: uniqueId(typeof raw.id === 'string' && raw.id !== '' ? raw.id : `extlink-ifc-${index + 1}`),
      sourceRef: ref,
      sourceMissing: typeof raw.sourceMissing === 'boolean' ? raw.sourceMissing : true,
    };
    for (const key of ['lagDays', 'lagMinutes'] as const) {
      if (key in link && !isValidExternalLagValue(key, link[key])) delete link[key];
    }
    links.push(link as unknown as ExternalLink);
  });
  return links.length > 0 ? links : undefined;
}
