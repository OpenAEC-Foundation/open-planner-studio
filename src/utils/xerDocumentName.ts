import type { XerImportMetadata } from '@/services/importTypes';

export function xerProjectCode(meta: XerImportMetadata | null | undefined): string | undefined {
  if (!meta?.sourceProjectId) return undefined;
  const row = meta.scheduleOptions?.sourceRows?.find(r =>
    r.table === 'PROJECT' && r.cells.proj_id === meta.sourceProjectId);
  const code = row?.cells.proj_short_name?.trim();
  return code || undefined;
}
