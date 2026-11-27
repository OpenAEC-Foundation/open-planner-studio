import type { Task } from '@/types/task';
import { normalizeExternalSourcePath } from './taskGrid/relationFormat';

export interface ExternalSourceWatchTargets {
  dirs: string[];
  files: Set<string>;
  key: string;
}

export function parentDir(filePath: string): string {
  const cut = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (cut < 0) return filePath;
  const dir = filePath.slice(0, cut);
  if (dir === '') return filePath[0];
  if (/^[A-Za-z]:$/.test(dir)) return `${dir}${filePath[cut]}`;
  return dir;
}

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

export interface SourceWatchEvent {
  type: unknown;
  paths: readonly string[];
}

export function watchEventTouchesSource(event: SourceWatchEvent, files: ReadonlySet<string>): boolean {
  if (typeof event.type === 'object' && event.type !== null && 'access' in event.type) return false;
  return event.paths.some(path => {
    const normalized = normalizeExternalSourcePath(path);
    return normalized !== null && files.has(normalized);
  });
}
