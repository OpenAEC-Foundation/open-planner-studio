import type { RecoveryIfcSource } from '@/services/recovery/recoveryIfcSource';
import type { RecoverySnapshotIdentities } from '@/services/recovery/recoveryIdentity';
import type { RecoveryIfcxMark } from '@/state/documentContract';
export const recoveryBase = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}` : 'recovery';

export const recoveryTmpSuffix = '.tmp';

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface RecoveryNames {
  base: string;
  manifest: string;
  legacy: string;
  ifcName(docId: string): string;
  generationIfcName(docId: string, generation: string): string;
  snapshotDocId(name: string): string | null;
  stableSnapshotDocId(name: string): string | null;
  archiveName(sha256: string): string;
  archiveSha(name: string): string | null;
  isOwnFile(name: string): boolean;
}

export function recoveryNames(base: string): RecoveryNames {
  const snapshotRe = new RegExp(`^${escapeRe(base)}\\.([^.]+)\\.ifc$`);
  const generationSnapshotRe = new RegExp(`^${escapeRe(base)}\\.snapshot\\.([^.]+)\\.([^.]+)\\.ifc$`);
  const archiveRe = new RegExp(`^${escapeRe(base)}\\.xerarchive\\.([0-9a-f]{64})\\.bin$`);
  const manifest = `${base}.documents.json`;
  const legacy = `${base}.ifc`;

  const stableSnapshotDocId = (name: string): string | null => {
    const m = snapshotRe.exec(name);
    return m ? m[1] : null;
  };
  const snapshotDocId = (name: string): string | null => {
    const generation = generationSnapshotRe.exec(name);
    if (generation) return generation[1] ?? null;
    return stableSnapshotDocId(name);
  };

  return {
    base,
    manifest,
    legacy,
    ifcName: (docId: string) => `${base}.${docId}.ifc`,
    generationIfcName: (docId: string, generation: string) => `${base}.snapshot.${docId}.${generation}.ifc`,
    snapshotDocId,
    stableSnapshotDocId,
    archiveName: (sha256: string) => `${base}.xerarchive.${sha256}.bin`,
    archiveSha: (name: string) => archiveRe.exec(name)?.[1] ?? null,
    isOwnFile: (name: string) => {
      const bare = name.endsWith(recoveryTmpSuffix)
        ? name.slice(0, -recoveryTmpSuffix.length)
        : name;
      return bare === manifest || bare === legacy || snapshotDocId(bare) !== null || archiveRe.test(bare);
    },
  };
}

export const ownRecoveryNames = recoveryNames(recoveryBase);

export const recoveryManifestName = ownRecoveryNames.manifest;
export const legacyRecoveryFile = ownRecoveryNames.legacy;
export const recoveryIfcName = ownRecoveryNames.ifcName;

export interface RecoveryManifestDoc {
  id: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
  datesAsRecorded?: boolean;
  xerArchive?: string;
  siteFileId?: string | null;
  siteFileVersion?: string | null;
  foreignSource?: { filePath?: string | null; siteFileId?: string | null };
  ifcSource?: RecoveryIfcSource;
  snapshotIdentities?: RecoverySnapshotIdentities;
  ifcx?: RecoveryIfcxMark;
}

export interface RecoveryManifest {
  version: number;
  activeDocumentId: string | null;
  documents: RecoveryManifestDoc[];
  ownerId?: string;
  heartbeatAt?: number;
}
