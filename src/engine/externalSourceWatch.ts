// De map van elk bronbestand bewaken (keuze 6, Ethan 2026-11-03; stap 1.6 en 7.2 in
// `docs/relaties-tussen-projecten.md`). Puur: welke mappen de desktop-app bewaakt en of een melding van het
// besturingssysteem een bronbestand raakt. De bewaking zelf staat in `useExternalSourceWatch`.
//
// De app bewaakt de MAP en niet het bestand: veel programma's slaan op via een tijdelijk bestand en een
// hernoeming, en dan verdwijnt het bewaakte bestand onder de bewaking uit.
import type { Task } from '@/types/task';
import { normalizeExternalSourcePath } from './taskGrid/relationFormat';

export interface ExternalSourceWatchTargets {
  /** De mappen om te bewaken, met het pad zoals het in de koppelingen staat. */
  dirs: string[];
  /** De bronbestanden, genormaliseerd (`normalizeExternalSourcePath`). */
  files: Set<string>;
  /** Een vaste sleutel van de bestanden: verandert hij, dan bewaakt de app opnieuw. */
  key: string;
}

/** De map van een absoluut pad, met het scheidingsteken van dat pad. `C:\x.ifc` geeft `C:\`, `/x.ifc` geeft `/`. */
export function parentDir(filePath: string): string {
  const cut = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (cut < 0) return filePath;
  const dir = filePath.slice(0, cut);
  if (dir === '') return filePath[0];
  if (/^[A-Za-z]:$/.test(dir)) return `${dir}${filePath[cut]}`;
  return dir;
}

/** De bronnen van de externe koppelingen: elk bestand één keer, met zijn map. Een pad dat de app niet kan
 *  lezen (geen pad, of een relatief pad) telt niet mee, net als bij `checkExternalSources`. */
export function externalSourceWatchTargets(tasks: readonly Task[]): ExternalSourceWatchTargets {
  const files = new Map<string, string>();
  for (const task of tasks) {
    for (const link of task.externalLinks ?? []) {
      const filePath = link.sourceRef.filePath;
      if (!filePath) continue;
      const path = normalizeExternalSourcePath(filePath);
      if (path !== null && !files.has(path)) files.set(path, filePath);
    }
  }
  const dirs = new Map<string, string>();
  for (const filePath of files.values()) {
    const dir = parentDir(filePath);
    const key = normalizeExternalSourcePath(dir) ?? dir;
    if (!dirs.has(key)) dirs.set(key, dir);
  }
  const keys = [...files.keys()].sort();
  return { dirs: [...dirs.values()], files: new Set(keys), key: keys.join('\n') };
}

/** Een melding van het besturingssysteem in vereenvoudigde vorm: het soort en de paden. */
export interface SourceWatchEvent {
  type: unknown;
  paths: readonly string[];
}

/** Raakt deze melding een bronbestand? Alleen lezen (`access`) telt niet: de app leest de bron zelf. */
export function watchEventTouchesSource(event: SourceWatchEvent, files: ReadonlySet<string>): boolean {
  if (typeof event.type === 'object' && event.type !== null && 'access' in event.type) return false;
  return event.paths.some(path => {
    const normalized = normalizeExternalSourcePath(path);
    return normalized !== null && files.has(normalized);
  });
}
