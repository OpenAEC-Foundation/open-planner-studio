import type { XerImportMetadata } from '@/services/importTypes';

/**
 * Documentnaam na een XER-import: de projectnaam met
 * het P6 Project-ID (`PROJECT.proj_short_name`) erachter tussen haakjes wanneer dat afwijkt, bv.
 * "HarbourPointe Assisted Living (4408)". Geen naam ⇒ het ID; naam gelijk aan het ID ⇒ één keer.
 * `project.name` zelf blijft de kale projectnaam — dit is uitsluitend de weergavenaam.
 * Bladmodule: puur, alleen type-imports.
 */
export function xerDocumentName(name: string | null | undefined, id: string | null | undefined): string {
  const n = (name ?? '').trim();
  const code = (id ?? '').trim();
  if (!n) return code;
  if (!code || n === code) return n;
  return `${n} (${code})`;
}

/**
 * Het P6 Project-ID van een XER-document, afgeleid uit de PROJECT-bronrij die de XER-broncache
 * (`scheduleOptions.sourceRows`) al per document draagt en die het IFC-bronarchief round-tript.
 * Daardoor is er geen nieuw metadataveld of archiefschema nodig. Geen XER ⇒ `undefined`.
 */
export function xerProjectCode(meta: XerImportMetadata | null | undefined): string | undefined {
  if (!meta?.sourceProjectId) return undefined;
  const row = meta.scheduleOptions?.sourceRows?.find(r =>
    r.table === 'PROJECT' && r.cells.proj_id === meta.sourceProjectId);
  const code = row?.cells.proj_short_name?.trim();
  return code || undefined;
}
