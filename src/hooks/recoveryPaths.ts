// Recovery-bestanden leven in de gedeelde appDataDir (app-id org.openaec.planner),
// dus concurrent dev-builds van verschillende worktrees zouden elkaar overschrijven.
// In een dev-build isoleert de worktree-slug (gezet door scripts/tauri-dev.mjs) ze;
// een plain/productie-build houdt de canonieke naam.
//
// Multi-document: er is één manifest (<base>.documents.json) dat alle open documenten
// opsomt, elk met een eigen IFC-snapshot (<base>.<docId>.ifc). De oude losse
// <base>.ifc wordt bij het opstarten nog herkend (terugval) en daarna opgeruimd.
export const recoveryBase = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}` : 'recovery';
export const recoveryManifestName = `${recoveryBase}.documents.json`;
export const legacyRecoveryFile = `${recoveryBase}.ifc`;
export const recoveryIfcName = (docId: string) => `${recoveryBase}.${docId}.ifc`;

export interface RecoveryManifest {
  version: number;
  activeDocumentId: string | null;
  documents: { id: string; ifc: string; filePath: string | null; isDirty: boolean }[];
}
