import type { FileRef } from '@/services/fileAccess';
import { compareFilePaths, type FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import type { IFCSaveSource } from './ifcSaveInput';

const written = new WeakMap<object, readonly string[]>();

export function rememberLiteralCalendarsWritten(source: IFCSaveSource, ids: readonly string[]): void {
  written.set(source, ids);
}

export function literalCalendarIdsWritten(source: IFCSaveSource): readonly string[] {
  return written.get(source) ?? [];
}

export async function exportHitsOwnFile(
  own: FileRef | null, target: FileRef | null | undefined, identity?: FileIdentityFs,
): Promise<boolean> {
  if (!own || !target) return false;
  if (own.kind === 'site') return target.kind === 'site' && target.id === own.id;
  if (own.kind === 'handle') {
    if (target.kind !== 'handle') return false;
    try { return await target.handle.isSameEntry(own.handle); } catch { return true; }
  }
  if (target.kind !== 'path') return false;
  if (!identity) return target.path === own.path;
  return (await compareFilePaths(identity, target.path, own.path)) !== 'different';
}

export function mergeLiteralCalendarIds(current: string[] | null, add: readonly string[] | null | undefined): string[] | null {
  const extra = [...new Set(add ?? [])].filter(id => !(current ?? []).includes(id));
  return extra.length === 0 ? current : [...(current ?? []), ...extra];
}
