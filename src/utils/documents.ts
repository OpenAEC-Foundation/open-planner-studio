import type { Task } from '@/types/task';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';

/**
 * Afgeleide identiteit + statistieken per geopend document, voor de
 * multi-document-chrome (tabstrip / projectbalk / wisselaar + overzicht).
 * Puur — geen store-afhankelijkheid; de hook `useDocumentCards` voedt deze
 * met de juiste payload per document.
 *
 * Kleuren zijn bewust afgeleid van een stabiele seed (de project-id) i.p.v.
 * letterlijk uit het prototype overgenomen — zie docs handoff-README.
 */

// Onderling goed onderscheidbare identiteitskleuren (amber/blauw/groen/paars/…).
// Geëxporteerd zodat weergaven die zelf een unieke (in plaats van hash-gebaseerde) toewijzing
// nodig hebben — zie `ResourceOccupancyView` — hetzelfde palet hergebruiken i.p.v. een tweede
// definitie te introduceren.
export const DOC_PALETTE = [
  '#D97706', '#2563EB', '#16A34A', '#7C3AED',
  '#DB2777', '#0891B2', '#CA8A04', '#0D9488',
];

/** Stabiele identiteitskleur uit een seed (project-id). */
export function documentColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DOC_PALETTE[h % DOC_PALETTE.length];
}

/** 2-letter-code uit de titel (eerste letters van de eerste twee woorden). */
export function documentCode(title: string): string {
  const words = title.trim().split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return '–';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Afgeleide titel: bestandsnaam zonder extensie, anders de projectnaam. */
export function documentTitle(filePath: string | null, projectName: string): string {
  if (filePath) {
    const base = filePath.split(/[\\/]/).pop() || filePath;
    return base.replace(/\.[^.]+$/, '');
  }
  return projectName || '';
}

/**
 * Neutrale, TAALONAFHANKELIJKE basis voor bestandsnamen van een naamloos project.
 *
 * Bewust géén vertaalde terugval (`common:project.untitled`): een bestandsnaam is technische
 * metadata die op een schijf belandt en door andere systemen gelezen wordt. `新しい計画.ifc` of
 * `طرح جدید.ifc` is geen verbetering — het maakt het bestand juist lastiger uitwisselbaar, terwijl
 * de gebruiker in de opslaan-dialoog toch zelf een naam kiest. Eén helper zodat opslaan (fileSlice),
 * rapport-export (ReportPanel), de STEP-header en de uitwisselingsformaten dezelfde terugval
 * gebruiken — die liepen uit elkaar (`'project'` versus de vertaalde weergavenaam).
 *
 * Trimt bewust: een naam van alleen spaties leverde anders `   .ifc`.
 */
export const DEFAULT_PROJECT_FILE_BASE = 'project';
export function projectFileBase(projectName: string): string {
  return (projectName ?? '').trim() || DEFAULT_PROJECT_FILE_BASE;
}

/**
 * Volgnummers om NAAMLOZE documenten onderling te onderscheiden.
 *
 * Invoer: de rauwe titels (`documentTitle(...)`) van álle open documenten, in tabvolgorde. Uitvoer:
 * per document `undefined` (het heeft een echte titel, óf het is het énige naamloze document) of een
 * 1-gebaseerd volgnummer onder de naamloze documenten — waarbij de eerste bewust `undefined` blijft,
 * zodat de nummering pas zichtbaar wordt zodra er iets te onderscheiden valt: `Nieuwe planning`,
 * `Nieuwe planning (2)`, `Nieuwe planning (3)`, …
 *
 * Waarom hier en niet in de projectnaam: dupliceren van een naamloos project mocht géén taalgebonden
 * string (`' (variant 2)'`) in de projectdata — en dus in het IFC — stempelen. Het onderscheid is
 * puur weergave, dus hoort het in de weergave-afleiding. Het nummer zelf is taalonafhankelijk; alleen
 * het label eromheen wordt vertaald door de aanroeper.
 */
export function untitledOrdinals(rawTitles: string[]): (number | undefined)[] {
  const untitledCount = rawTitles.filter((t) => !t).length;
  let seen = 0;
  return rawTitles.map((t) => {
    if (t) return undefined;
    seen++;
    return untitledCount > 1 && seen > 1 ? seen : undefined;
  });
}

/** `raw` indien niet-leeg; anders het (al vertaalde) label, met het volgnummer uit
 *  `untitledOrdinals` erachter. De aanroeper levert het label — deze module kent geen i18n. */
export function displayDocumentTitle(
  raw: string,
  ordinal: number | undefined,
  untitledLabel: string,
): string {
  if (raw) return raw;
  return ordinal === undefined ? untitledLabel : `${untitledLabel} (${ordinal})`;
}

export interface DocStats {
  taskCount: number;
  milestoneCount: number;
  criticalCount: number;
  endDate: string | null;
}

export function buildStats(tasks: Task[], cpm: CPMResult | null, projectEnd: string): DocStats {
  const leaves = tasks.filter(isLeafTask);
  const milestoneCount = tasks.filter((t) => t.isMilestone).length;
  const criticalCount = cpm
    ? cpm.criticalPath.length
    : tasks.filter((t) => t.time.isCritical).length;
  const endDate = (cpm?.projectEnd || projectEnd) || null;
  return { taskCount: leaves.length, milestoneCount, criticalCount, endDate };
}

export interface ThumbBar {
  topPct: number;
  leftPct: number;
  widthPct: number;
  color: string;
}

/**
 * Low-fidelity mini-Gantt: balkjes binnen het tijdvenster van het document.
 * Leesbaar zonder dat CPM gedraaid hoeft te zijn (valt terug op scheduleStart).
 */
export function buildThumbnail(tasks: Task[], identityColor: string, maxBars = 9): ThumbBar[] {
  const points: { start: number; end: number; ms: boolean; crit: boolean }[] = [];
  for (const t of tasks) {
    if (isSummaryTask(t)) continue; // alleen bladtaken/mijlpalen
    const startStr = t.time.earlyStart || t.time.scheduleStart;
    if (!startStr) continue;
    const start = Date.parse(startStr);
    if (Number.isNaN(start)) continue;
    const finStr = t.time.earlyFinish || t.time.scheduleFinish;
    const endRaw = finStr ? Date.parse(finStr) : start;
    const end = Number.isNaN(endRaw) ? start : Math.max(endRaw, start);
    points.push({ start, end, ms: t.isMilestone, crit: t.time.isCritical });
  }
  if (points.length === 0) return [];

  const min = Math.min(...points.map((p) => p.start));
  const max = Math.max(...points.map((p) => p.end));
  const span = Math.max(1, max - min);

  points.sort((a, b) => a.start - b.start);
  const shown = points.slice(0, maxBars);
  return shown.map((p, i) => ({
    topPct: shown.length === 1 ? 46 : (i / (shown.length - 1)) * 84 + 8,
    leftPct: ((p.start - min) / span) * 100,
    widthPct: Math.max(3, ((p.end - p.start) / span) * 100),
    color: p.crit ? 'var(--theme-critical-text)' : p.ms ? 'var(--color-task-milestone)' : identityColor,
  }));
}
