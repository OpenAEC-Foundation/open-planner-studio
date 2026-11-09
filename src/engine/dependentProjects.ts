import type { ExternalLink, Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';
import { sourceAnchorDate } from '@/engine/externalLinks';

/**
 * Stap 1.11 van "relaties tussen projecten" (keuze 7 en keuze 3 zonder cloud,
 * `docs/relaties-tussen-projecten.md` §7.3 en §7.4): wie hangt van dit project af?
 *
 * De omgekeerde kant van een externe koppeling. Een `ExternalLink` staat op een taak in het
 * AFHANKELIJKE project en wijst met `sourceRef.projectId` naar een taak in het BRONproject. Deze
 * module zoekt, vanuit de bron, in andere projecten de koppelingen naar dit project. Puur: de
 * aanroeper leest de bestanden (alleen-lezen) en geeft de geopende documenten mee.
 *
 * Het resultaat is afgeleide data per document (sessie), geen projectdata: het staat niet in
 * `DOCUMENT_FIELDS` en niet in het IFC-bestand.
 */

/** Eén project waarin gezocht wordt: een gelezen bestand of een geopend document. */
export interface DependentCandidate {
  projectId: string;
  projectName: string;
  /** Bestandsnaam voor de tekst ("Aannemer.ifc"); afwezig bij een geopend document zonder bestand. */
  fileName?: string;
  /** `true` ⇒ een geopend document (ook met niet-opgeslagen wijzigingen). Wint van een bestand van
   *  hetzelfde project: het geheugen is nieuwer dan de schijf. */
  opened: boolean;
  tasks: readonly Pick<Task, 'id' | 'name' | 'externalLinks'>[];
}

/** Eén koppeling in een ander project naar een taak van dit project. */
export interface DependentLink {
  /** Het afhankelijke project. */
  projectId: string;
  projectName: string;
  fileName?: string;
  /** De taak in het afhankelijke project die de koppeling draagt. */
  taskId: string;
  taskName: string;
  /** De taak in DIT project waar de koppeling naar wijst (`sourceRef.taskId`). */
  ownTaskId: string;
  linkId: string;
  /** Zoals in het afhankelijke project: `predecessor` ⇒ onze taak is hun voorganger,
   *  `successor` ⇒ onze taak is hun opvolger. */
  direction: ExternalLink['direction'];
  relType: ExternalLink['relType'];
  lagDays?: number;
  lagMinutes?: number;
  /** Het anker waarop het afhankelijke project rekent. */
  anchorDate: string;
}

/** Het zoekresultaat van één document. */
export interface DependentSearchSummary {
  /** Aantal verschillende afhankelijke projecten met minstens één koppeling. */
  projects: number;
  links: number;
}

/**
 * De koppelingen naar `ownProjectId` in `candidates`. Regels:
 *  - match op `sourceRef.projectId === ownProjectId` (het project-id, niet het pad);
 *  - het eigen project telt niet mee (een kandidaat met hetzelfde project-id, ook een kopie);
 *  - één project telt één keer: een geopend document wint van een bestand met hetzelfde project-id,
 *    anders telt het eerste bestand.
 * Volgorde: zoals de kandidaten, en per project zoals de taken.
 */
export function findDependentLinks(
  candidates: readonly DependentCandidate[],
  ownProjectId: string,
): DependentLink[] {
  const own = ownProjectId.trim();
  if (!own) return [];
  const chosen = new Map<string, DependentCandidate>();
  for (const c of candidates) {
    const id = c.projectId.trim();
    if (!id || id === own) continue;
    const prev = chosen.get(id);
    if (!prev || (c.opened && !prev.opened)) chosen.set(id, c);
  }
  const out: DependentLink[] = [];
  for (const c of chosen.values()) {
    for (const task of c.tasks) {
      for (const link of task.externalLinks ?? []) {
        if (link.sourceRef.projectId.trim() !== own) continue;
        out.push({
          projectId: c.projectId,
          projectName: c.projectName,
          ...(c.fileName ? { fileName: c.fileName } : {}),
          taskId: task.id,
          taskName: task.name,
          ownTaskId: link.sourceRef.taskId,
          linkId: link.id,
          direction: link.direction,
          relType: link.relType,
          ...(link.lagDays !== undefined ? { lagDays: link.lagDays } : {}),
          ...(link.lagMinutes !== undefined ? { lagMinutes: link.lagMinutes } : {}),
          anchorDate: link.anchorDate,
        });
      }
    }
  }
  return out;
}

export function summarizeDependentLinks(links: readonly DependentLink[]): DependentSearchSummary {
  return { projects: new Set(links.map(l => l.projectId)).size, links: links.length };
}

/**
 * Wordt het anker te krap voor het afhankelijke project? Dezelfde richting als de berekening daar
 * (`CPMSolver.externalForwardBound` en `detectExternalSuccessorViolations`):
 *  - `predecessor` (onze taak is hun voorganger): het anker is een ondergrens voor hun taak. Een
 *    LATER anker duwt hun taak later ⇒ te krap.
 *  - `successor` (onze taak is hun opvolger): het anker is een bovengrens voor hun taak. Een
 *    VROEGER anker laat hun taak eerder klaar moeten zijn ⇒ te krap.
 * Meer ruimte, een gelijk anker of een datum die niet te lezen is ⇒ `false`.
 */
export function isAnchorTighter(direction: ExternalLink['direction'], oldAnchor: string, newAnchor: string): boolean {
  if (!oldAnchor || !newAnchor) return false;
  const a = parseInstant(oldAnchor).getTime();
  const b = parseInstant(newAnchor).getTime();
  if (isNaN(a) || isNaN(b)) return false;
  return direction === 'predecessor' ? b > a : b < a;
}

/** Een gevonden koppeling waarvan het anker na deze wijziging te krap wordt. */
export interface TightAnchor extends DependentLink {
  ownTaskName: string;
  newAnchorDate: string;
}

/**
 * De koppelingen uit `links` waarvan het anker, opnieuw berekend uit de huidige taken van dit project
 * (`sourceAnchorDate`, dezelfde regel als *Vernieuwen* in het afhankelijke project), te krap wordt
 * ({@link isAnchorTighter}). Een eigen taak die niet meer bestaat geeft geen regel: er is geen nieuw
 * anker, en het afhankelijke project ziet bij vernieuwen "bron ontbreekt".
 */
export function tightDependentAnchors(links: readonly DependentLink[], tasks: readonly Task[]): TightAnchor[] {
  const byId = new Map(tasks.map(t => [t.id, t] as const));
  const out: TightAnchor[] = [];
  for (const link of links) {
    const task = byId.get(link.ownTaskId);
    if (!task) continue;
    const next = sourceAnchorDate(link, task);
    if (!isAnchorTighter(link.direction, link.anchorDate, next)) continue;
    out.push({ ...link, ownTaskName: task.name, newAnchorDate: next });
  }
  return out;
}
