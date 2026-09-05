// Recovery-bestanden leven in de gedeelde appDataDir (app-id org.openaec.planner),
// dus concurrent dev-builds van verschillende worktrees zouden elkaar overschrijven.
// In een dev-build isoleert de worktree-slug (gezet door scripts/tauri-dev.mjs) ze;
// een plain/productie-build houdt de canonieke naam.
//
// Multi-document: er is één manifest (<base>.documents.json) dat alle open documenten
// opsomt. Versie 1/2 verwees naar overschreven IFC-snapshots
// (<base>.<docId>.ifc); versie 3 verwijst naar IMMUTABLE generaties
// (<base>.snapshot.<docId>.<generation>.ifc). De oude losse <base>.ifc wordt bij
// het opstarten nog herkend (terugval) en daarna opgeruimd.
export const recoveryBase = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}` : 'recovery';

/** Achtervoegsel van het halffabricaat van een atomaire schrijfactie (zie `saveTauri`). */
export const recoveryTmpSuffix = '.tmp';

/** Regex-metatekens in een base ontsnappen (de dev-base bevat punten). */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Namen + herkenning voor één recovery-base. Zie `recoveryNames`. */
export interface RecoveryNames {
  /** `recovery` (productie) of `recovery.<slug>` (dev-instantie). */
  base: string;
  /** Manifestbestand met alle open documenten. */
  manifest: string;
  /** Oude losse enkel-document-snapshot; wordt alleen nog gelezen. */
  legacy: string;
  /** v1/v2-bestandsnaam van de overschreven snapshot van één document. */
  ifcName(docId: string): string;
  /** v3-bestandsnaam van één immutable documentgeneratie. */
  generationIfcName(docId: string, generation: string): string;
  /** Doc-id als `name` EXACT een snapshot van deze base is, anders `null`. */
  snapshotDocId(name: string): string | null;
  /** Doc-id alleen voor een v1/v2-stabiele snapshot (voor manifestloze terugval). */
  stableSnapshotDocId(name: string): string | null;
  /** Hoort deze bestandsnaam bij deze base? (snapshot, manifest, legacy of hun `.tmp`) */
  isOwnFile(name: string): boolean;
}

/**
 * Bouw de bestandsnamen én de HERKENNING voor één base (bevinding K5).
 *
 * Waarom dit een exacte match moet zijn en geen `startsWith(base + '.')`. De productie-base is
 * kaal `recovery`, de dev-base is `recovery.<slug>` — dus elke dev-bestandsnaam begint met de
 * productie-prefix. Met een prefix-vergelijking ruimde één start van de productiebuild alle
 * herstel-snapshots van álle dev-worktrees op, en dat gebeurde ONVOORWAARDELIJK, niet alleen bij
 * twee gelijktijdige instanties. De match is nu: precies één segment (geen punt) tussen de base
 * en `.ifc`. Andersom ging het al goed, want de dev-base is de specifiekere van de twee.
 *
 * Dat één segment mag, kan en moet: doc-id's komen uit `generateId('doc')` — `doc-` gevolgd door
 * base36-tekens en een teller — en de enige andere waarde die ooit als doc-id wordt weggeschreven
 * is de terugval-id `legacy`. Geen van beide bevat een punt. Zou dat ooit veranderen, dan is deze
 * regex de plek die het meteen afvangt (de snapshot wordt dan niet meer herkend en blijft staan —
 * lekken, niet wissen).
 *
 * Bekende, bewust geaccepteerde rest: `recovery.<slug>.ifc` — het LEGACY-bestand van een oude
 * dev-build — is voor een productiebuild niet te onderscheiden van een snapshot met doc-id
 * `<slug>`. Dat bestand wordt sinds de multi-document-overgang nergens meer geschreven, dus het
 * bestaat alleen nog als restant op een machine die ooit een oude dev-build draaide.
 */
export function recoveryNames(base: string): RecoveryNames {
  const snapshotRe = new RegExp(`^${escapeRe(base)}\\.([^.]+)\\.ifc$`);
  const generationSnapshotRe = new RegExp(`^${escapeRe(base)}\\.snapshot\\.([^.]+)\\.([^.]+)\\.ifc$`);
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
    isOwnFile: (name: string) => {
      const bare = name.endsWith(recoveryTmpSuffix)
        ? name.slice(0, -recoveryTmpSuffix.length)
        : name;
      return bare === manifest || bare === legacy || snapshotDocId(bare) !== null;
    },
  };
}

/** De namen van DEZE build (dev-slug of productie). */
export const ownRecoveryNames = recoveryNames(recoveryBase);

export const recoveryManifestName = ownRecoveryNames.manifest;
export const legacyRecoveryFile = ownRecoveryNames.legacy;
export const recoveryIfcName = ownRecoveryNames.ifcName;

/** Eén documentregel in het manifest. */
export interface RecoveryManifestDoc {
  id: string;
  ifc: string;
  filePath: string | null;
  isDirty: boolean;
}

export interface RecoveryManifest {
  /**
   * 1 = zonder eigenaarschapsvelden (t/m de multi-document-release), 2 = met `ownerId`/
   * `heartbeatAt`, 3 = immutable generatie-snapshots met het manifest als commitpoint.
   * Een v1/v2-manifest MOET leesbaar blijven: het staat op de schijf van iedereen die de vorige
   * versie draaide, en dat weigeren betekent dataverlies bij de eerste start na de update.
   * Beide eigenaarschapsvelden zijn daarom optioneel getypeerd en het versienummer wordt nergens
   * als leespoort gebruikt — alleen als informatie.
   */
  version: number;
  activeDocumentId: string | null;
  documents: RecoveryManifestDoc[];
  /** v2+: welke app-instantie dit manifest het laatst schreef. */
  ownerId?: string;
  /** v2+: `Date.now()` van die schrijfactie. */
  heartbeatAt?: number;
}
