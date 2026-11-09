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
  /** De versie van de bron bij het lezen: het versienummer op de site of de wijzigingstijd van het
   *  bestand (ISO, UTC). Afwezig ⇒ onbekend; de verversing schrijft dan geen versie. */
  version?: string;
  /** Wanneer de bron gelezen werd (ISO, UTC). Afwezig ⇒ de verversing schrijft geen leestijd. */
  readAt?: string;
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
export type ExternalSourceMatchScope = 'project-or-path' | 'file-path' | 'project-without-path';

/**
 * Waar de app een bron leest (stap 1.8). Een koppeling met een bruikbaar pad (`normalizeExternalSourcePath`)
 * leest haar bron via dat pad (desktop). Een koppeling zonder pad (gekozen in de browser) herkent haar bron
 * op project-id; de browser leest die via een onthouden bestandshandvat. Stap 1.9 voegt hier een bron op de
 * site toe (`siteFileId`). Een koppeling met een relatief pad heeft geen bron die de app kan lezen (`null`).
 */
export type ExternalSourceLocator =
  | { kind: 'path'; filePath: string }
  | { kind: 'project'; projectId: string };

export function externalSourceLocatorOf(ref: Pick<ExternalLink['sourceRef'], 'projectId' | 'filePath'>): ExternalSourceLocator | null {
  if (ref.filePath) return normalizeExternalSourcePath(ref.filePath) === null ? null : { kind: 'path', filePath: ref.filePath };
  const projectId = ref.projectId.trim();
  return projectId ? { kind: 'project', projectId } : null;
}

/** Het voorvoegsel van een bronsleutel zonder pad. Een genormaliseerd pad begint met `/` of met een
 *  stationsletter en dubbele punt (`c:/`); `project:` en later `site:` botsen daar nooit mee. */
const PROJECT_KEY_PREFIX = 'project:';

/**
 * De sleutel van een bron in de balk (`ExternalSourceUpdate.key`) en in alles wat daarop sleutelt: het
 * genormaliseerde pad voor een bron met pad, `project:<id>` voor een bron zonder pad. Zo blijft de sleutel
 * van een bron met pad gelijk aan die van stap 1.5.
 */
export function externalSourceKey(locator: ExternalSourceLocator): string | null {
  return locator.kind === 'path'
    ? normalizeExternalSourcePath(locator.filePath)
    : `${PROJECT_KEY_PREFIX}${locator.projectId}`;
}

/** De sleutel van een gelezen bron: met pad het pad, zonder pad het project-id. */
export function externalSourceKeyOfDoc(source: Pick<ExternalSourceDoc, 'projectId' | 'filePath'>): string | null {
  const locator = externalSourceLocatorOf(source);
  return locator ? externalSourceKey(locator) : null;
}

/** Welke koppelingen één gelezen bron mag verversen bij de balk (*Bekijken*, *Accepteren*): met pad alleen
 *  de koppelingen naar dat pad; zonder pad alleen de koppelingen zonder pad met hetzelfde project-id. */
export function externalSourceScope(source: Pick<ExternalSourceDoc, 'filePath'>): ExternalSourceMatchScope {
  return source.filePath ? 'file-path' : 'project-without-path';
}

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
  // Een bron zonder pad (de browser, stap 1.8): alleen koppelingen zonder pad, op project-id. Een koppeling
  // met een pad wijst naar een bepaald bestand; een ander bestand met hetzelfde project-id mag haar niet raken.
  if (matchScope === 'project-without-path') {
    return !link.sourceRef.filePath && !!link.sourceRef.projectId && link.sourceRef.projectId === source.projectId;
  }
  if (matchScope === 'project-or-path'
    && link.sourceRef.projectId
    && link.sourceRef.projectId === source.projectId) return true;
  if (!link.sourceRef.filePath || !source.filePath) return false;
  const linkPath = normalizeExternalSourcePath(link.sourceRef.filePath);
  const sourcePath = normalizeExternalSourcePath(source.filePath);
  return linkPath !== null && sourcePath !== null && linkPath === sourcePath;
}

/**
 * De herkomst van het anker (keuze 4) van een bestaande koppeling, op een nieuwe vorm van diezelfde
 * koppeling. Routes die een koppeling opnieuw opbouwen uit een vorm zonder herkomst (de relatiecel: het
 * klembordformaat v1 draagt `sourceVersion`, `anchorReadAt` en `siteFileId` niet) zetten haar zo terug.
 * Dezelfde brontaak (project-id, taak-id en bestandspad) ⇒ de site-id blijft. Ook hetzelfde anker ⇒ versie
 * en leestijd blijven: het anker komt dan nog steeds uit die versie van de bron. Een ander anker komt niet
 * meer uit de bron, en dan valt de herkomst weg. Wat de nieuwe vorm zelf al draagt, wint.
 */
export function withKeptAnchorProvenance<T extends Omit<ExternalLink, 'id'>>(next: T, old: ExternalLink | undefined): T {
  if (!old) return next;
  const a = old.sourceRef;
  const b = next.sourceRef;
  if (a.projectId !== b.projectId || a.taskId !== b.taskId || (a.filePath ?? '') !== (b.filePath ?? '')) return next;
  const out: T = { ...next };
  if (a.siteFileId !== undefined && b.siteFileId === undefined) out.sourceRef = { ...b, siteFileId: a.siteFileId };
  if (next.anchorDate === old.anchorDate) {
    if (next.sourceVersion === undefined && old.sourceVersion !== undefined) out.sourceVersion = old.sourceVersion;
    if (next.anchorReadAt === undefined && old.anchorReadAt !== undefined) out.anchorReadAt = old.anchorReadAt;
  }
  return out;
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
  /** Koppelingen die deze verversing niet mag raken (`refreshFromSources`: een bronpad dat niet gelezen is). */
  skip?: (link: ExternalLink) => boolean,
): RefreshResult {
  const srcById = new Map(source.tasks.map((t) => [t.id, t]));
  let refreshed = 0;
  let missing = 0;
  let anyChanged = false;

  const outTasks = tasks.map((task) => {
    if (!task.externalLinks || task.externalLinks.length === 0) return task;
    let taskChanged = false;
    const links = task.externalLinks.map((link): ExternalLink => {
      if (skip?.(link) || !linkMatchesSource(link, source, matchScope)) return link; // andere bron ⇒ ongemoeid

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
      const nextAnchor = anchorDate || link.anchorDate;
      // Herkomst (keuze 4): het anker komt nu uit deze versie van de bron. Dezelfde versie en hetzelfde
      // anker ⇒ niets nieuws; dan blijft ook de oude leestijd staan, zodat verversen zonder wijziging het
      // document niet verandert. Heeft de koppeling nog geen leestijd, dan neemt ze een nieuwe één keer
      // over, ook als de versie onbekend is (beide `undefined`).
      const sameProvenance = (source.version ?? undefined) === link.sourceVersion && nextAnchor === link.anchorDate
        && (link.anchorReadAt !== undefined || source.readAt === undefined);
      // Geen daadwerkelijke wijziging ⇒ referentie behouden (byte-/render-stabiel).
      if (
        link.anchorDate === anchorDate &&
        link.sourceMissing === false &&
        sameProvenance &&
        link.sourceRef.projectId === nextRef.projectId &&
        link.sourceRef.projectName === nextRef.projectName &&
        link.sourceRef.taskName === nextRef.taskName &&
        link.sourceRef.filePath === nextRef.filePath
      ) {
        return link;
      }
      taskChanged = true;
      const next: ExternalLink = { ...link, anchorDate: nextAnchor, sourceMissing: false, sourceRef: nextRef };
      if (!sameProvenance) {
        delete next.sourceVersion;
        delete next.anchorReadAt;
        if (source.version !== undefined) next.sourceVersion = source.version;
        if (source.readAt !== undefined) next.anchorReadAt = source.readAt;
      }
      return next;
    });
    if (!taskChanged) return task;
    anyChanged = true;
    return { ...task, externalLinks: links };
  });

  return { tasks: anyChanged ? outTasks : tasks, refreshed, missing, changed: anyChanged };
}

/**
 * Ververst de koppelingen uit meerdere bronnen in één keer: *Alle externe relaties vernieuwen*
 * (`refreshAllExternalAnchors`) en de MCP-tool `planner_refresh_external_links`. Puur, net als
 * `refreshExternalAnchors`; elke bron ververst zijn eigen koppelingen op het vorige resultaat.
 *
 * Een IFC-kopie bewaart terecht zijn persistente project-id. Staan twee verschillende bronpaden met zo'n
 * gedeelde id in dezelfde actie, dan is project-id alleen niet langer onderscheidend: de eerste bron zou
 * anders beide koppelingen verversen en de tweede beide opnieuw. Alleen in die aantoonbaar ambigue groep
 * eist de functie daarom het genormaliseerde bronpad. Een gewone verversing blijft project-id-primair,
 * zodat een verplaatst bestand werkt.
 * Een bron zonder pad (stap 1.8, gekozen in de browser) raakt alleen koppelingen zonder pad met haar
 * project-id (`project-without-path`).
 *
 * `readPaths` (genormaliseerd, `normalizeExternalSourcePath`): de bronpaden die deze actie gelezen heeft. Een
 * koppeling met een bruikbaar bronpad dat daar niet in staat, houdt haar anker en pad: anders zou de terugval
 * op project-id haar het anker en het pad van een andere bron met hetzelfde project-id geven (review #813). Ze
 * telt dan niet als ververst en niet als ontbrekend. Dat geldt voor een bron buiten de toegestane map of een
 * onleesbare bron, en ook voor een koppeling die de planner tijdens het lezen naar een ander bronbestand
 * zette: de set gaat over de gelezen bestanden, niet over de koppelingen van vóór het lezen. Zonder
 * `readPaths` mag elke koppeling ververst worden.
 */
export function refreshFromSources(
  tasks: Task[],
  sources: readonly ExternalSourceDoc[],
  readPaths?: ReadonlySet<string>,
): RefreshResult {
  const pathsByProjectId = new Map<string, Set<string>>();
  for (const source of sources) {
    const projectId = source.projectId.trim();
    const sourcePath = normalizeExternalSourcePath(source.filePath ?? '');
    if (!projectId || sourcePath === null) continue;
    const sourcePaths = pathsByProjectId.get(projectId) ?? new Set<string>();
    sourcePaths.add(sourcePath);
    pathsByProjectId.set(projectId, sourcePaths);
  }
  const ambiguousProjectIds = new Set(
    [...pathsByProjectId].filter(([, sourcePaths]) => sourcePaths.size > 1).map(([projectId]) => projectId),
  );

  const skip = readPaths === undefined ? undefined : (link: ExternalLink) => {
    const path = normalizeExternalSourcePath(link.sourceRef.filePath ?? '');
    return path !== null && !readPaths.has(path);
  };

  let out = tasks;
  let refreshed = 0;
  let missing = 0;
  let changed = false;
  for (const source of sources) {
    const result = refreshExternalAnchors(
      out,
      source,
      // Een bron zonder pad (de browser, stap 1.8) raakt alleen koppelingen zonder pad: een koppeling met een
      // pad wijst naar een bepaald bestand en houdt haar anker als dat bestand niet gelezen is.
      !source.filePath ? 'project-without-path'
        : ambiguousProjectIds.has(source.projectId.trim()) ? 'file-path' : 'project-or-path',
      skip,
    );
    out = result.tasks;
    refreshed += result.refreshed;
    missing += result.missing;
    if (result.changed) changed = true;
  }
  return { tasks: out, refreshed, missing, changed };
}

/** De herkomst van een anker (keuze 4) in een vorm die de tooltip toont. `site`: een versienummer op de
 *  site (`sourceRef.siteFileId` gezet); `file`: de wijzigingstijd van het bronbestand; `read`: alleen de
 *  leestijd is bekend; `none`: niets bekend (een oudere koppeling of een anker dat de planner invulde). */
export type ExternalAnchorProvenance =
  | { kind: 'site'; version: string; readAt?: Date }
  | { kind: 'file'; modified: Date; readAt?: Date }
  | { kind: 'read'; readAt: Date }
  | { kind: 'none' };

export function externalAnchorProvenance(
  link: Pick<ExternalLink, 'sourceVersion' | 'anchorReadAt' | 'sourceRef'>,
): ExternalAnchorProvenance {
  const time = (iso: string | undefined): Date | undefined => {
    if (!iso) return undefined;
    const date = new Date(iso);
    return isNaN(date.getTime()) ? undefined : date;
  };
  const readAt = time(link.anchorReadAt);
  const withRead = readAt ? { readAt } : {};
  if (link.sourceVersion) {
    if (link.sourceRef.siteFileId) return { kind: 'site', version: link.sourceVersion, ...withRead };
    const modified = time(link.sourceVersion);
    if (modified) return { kind: 'file', modified, ...withRead };
  }
  return readAt ? { kind: 'read', readAt } : { kind: 'none' };
}

const DIRECTIONS: readonly string[] = ['predecessor', 'successor'];
const RELATION_TYPES: readonly string[] = ['FS', 'SS', 'FF', 'SF'];
const OPTIONAL_SOURCE_FIELDS = ['projectName', 'taskName', 'filePath', 'siteFileId'] as const;
const OPTIONAL_PROVENANCE_FIELDS = ['sourceVersion', 'anchorReadAt'] as const;

/**
 * De externe koppelingen uit een opgeslagen bestand (`OPS_ExternalLink`), in een vorm die de app
 * aankan. Een koppeling zonder geldige richting, type, anker (tekst) of bron (project-id als tekst,
 * taak-id niet leeg) valt weg: zulke data liet laden, rekenen en de relatiecel vastlopen. Een
 * ontbrekend of dubbel id krijgt een eigen id per taak, een ontbrekende bronstatus wordt "bron
 * ontbreekt", een ongeldige lag en een bron- of herkomstveld dat geen tekst is vervallen. Onbekende extra velden
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
    for (const key of OPTIONAL_PROVENANCE_FIELDS) if (key in link && typeof link[key] !== 'string') delete link[key];
    links.push(link as unknown as ExternalLink);
  });
  return links.length > 0 ? links : undefined;
}
