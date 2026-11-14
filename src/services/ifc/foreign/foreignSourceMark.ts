// Het kenmerk "kwam uit een bestand met een vreemd deel" (#804 fase 1a, fixronde 1). Een document dat uit een IFC-bestand
// met een gebouwmodel komt, draagt het vanaf het openen tot het sluiten, ook na crashherstel, ook als de bronbytes weg zijn
// (herstel bewaart ze niet). Zo herkent de app het bronbestand als doel van Opslaan als of een export, en weigert die:
// anders schreef hij alleen de planning over het modelbestand. Geen bronbytes: alleen de vingerafdruk en het doel.
import type { IfcSource } from './ifcSource';

/** De vingerafdruk van de bron: wat de herstel-IFC bewaart (pset `OPS_RecoveryForeignSource`). */
export interface ForeignSourceFingerprint {
  /** SHA-256 van de bronbytes, hex. */
  readonly sha256: string;
  readonly byteLength: number;
}

/** Het doel van de bron: wat het herstelmanifest bewaart (`RecoveryManifestDoc.foreignSource`). */
export interface ForeignSourceTarget {
  /** Pad (Tauri) of naam (browser) van de bron bij het openen; `null` als onbekend. */
  readonly filePath: string | null;
  /** Het site-bestand van de bron; `null` als het geen site-bestand is. */
  readonly siteFileId: string | null;
}

/**
 * De pset `OPS_RecoveryForeignSource` zoals de lezer hem teruggeeft. Een herstelsnapshot schrijft alleen de vingerafdruk
 * (het doel staat in het manifest). Een MCP-backup (`backupService.ts`, fixronde 3) heeft geen manifest en schrijft ook
 * het doel (`SourcePath`, `SourceSiteFileId`): zo houdt een geopende backup het kenmerk van de bron.
 */
export interface ForeignSourceRecord extends ForeignSourceFingerprint {
  readonly target?: ForeignSourceTarget;
}

export interface ForeignSourceMark extends ForeignSourceFingerprint, ForeignSourceTarget {
  /** De handle van de bron (browser). Herstel bewaart hem optioneel in manifest v5; nooit in snapshot of Worker. */
  readonly handle: FileSystemFileHandle | null;
  /** #886 fixronde 2 (§4.14, "bron ontbreekt"): het kenmerk komt uit crashherstel, de bronbytes met het vreemde deel
   *  zijn weg. Dan weigert elke IFC-uitvoer, zoals vóór de crash (`ifcSaveBlocked`). Een geopende MCP-backup heeft dit
   *  niet: dat is een eigen bestand. */
  readonly sourceMissing?: true;
}

/** Het kenmerk voor een net geopend document: alleen als de bron een vreemd deel heeft. */
export function foreignSourceMarkFor(
  source: IfcSource | null | undefined,
  target: { filePath: string | null; siteFileId: string | null; fileHandle: FileSystemFileHandle | null },
): ForeignSourceMark | null {
  if (!source?.foreign) return null;
  return {
    sha256: source.sha256,
    byteLength: source.bytes.length,
    filePath: target.filePath,
    siteFileId: target.siteFileId,
    handle: target.fileHandle,
  };
}

/** Een geldige vingerafdruk uit een bestand of manifest (soepel gelezen), anders `null`. */
export function parseForeignSourceFingerprint(sha256: unknown, byteLength: unknown): ForeignSourceFingerprint | null {
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength < 0) return null;
  return { sha256, byteLength };
}

/** Een geldig doel uit een manifest (soepel gelezen), anders `null`. */
export function parseForeignSourceTarget(raw: unknown): ForeignSourceTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const { filePath, siteFileId } = raw as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
  return { filePath: text(filePath), siteFileId: text(siteFileId) };
}

/** Het doel van een kenmerk voor het herstelmanifest: zonder vingerafdruk en zonder handle. */
export function foreignSourceTargetOf(mark: ForeignSourceMark | null | undefined): ForeignSourceTarget | null {
  return mark ? { filePath: mark.filePath, siteFileId: mark.siteFileId } : null;
}

/** Zelfde doel in het manifest? (`null` en afwezig zijn gelijk.) */
export function sameForeignSourceTarget(a: ForeignSourceTarget | null | undefined, b: ForeignSourceTarget | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.filePath === b.filePath && a.siteFileId === b.siteFileId;
}

/**
 * Het kenmerk na crashherstel: de vingerafdruk uit de herstel-IFC, het doel uit het manifest. Zonder vingerafdruk geen
 * kenmerk (een oude snapshot, of een document zonder vreemd deel). Zonder doel in het manifest blijft de vingerafdruk
 * werken voor een browserbestand (zelfde inhoud). De handle is na herstel altijd weg.
 */
export function foreignSourceMarkFromRecovery(
  fingerprint: ForeignSourceFingerprint | null | undefined,
  target: ForeignSourceTarget | null | undefined,
): ForeignSourceMark | null {
  if (!fingerprint) return null;
  return {
    sha256: fingerprint.sha256,
    byteLength: fingerprint.byteLength,
    filePath: target?.filePath ?? null,
    siteFileId: target?.siteFileId ?? null,
    handle: null,
  };
}

/** De pset-invoer voor een MCP-backup: vingerafdruk en doel, nooit de handle of de bronbytes (fixronde 3). */
export function foreignSourceBackupRecord(mark: ForeignSourceMark | null | undefined): ForeignSourceRecord | undefined {
  if (!mark) return undefined;
  return { sha256: mark.sha256, byteLength: mark.byteLength, target: { filePath: mark.filePath, siteFileId: mark.siteFileId } };
}

/**
 * Het kenmerk van een geopend bestand met de pset (een MCP-backup, of een herstelsnapshot die de planner zelf opent):
 * de vingerafdruk en het doel uit de pset. Zonder pset geen kenmerk.
 */
export function foreignSourceMarkFromRecord(record: ForeignSourceRecord | null | undefined): ForeignSourceMark | null {
  return record ? foreignSourceMarkFromRecovery(record, record.target ?? null) : null;
}
