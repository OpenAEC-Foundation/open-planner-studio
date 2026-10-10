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
  /** v5: content-adressed XER-archiefblob (ruwe bronbytes), gedeeld door alle snapshots. */
  archiveName(sha256: string): string;
  /** SHA-256 als `name` EXACT een archiefblob van deze base is, anders `null`. */
  archiveSha(name: string): string | null;
  /** Hoort deze bestandsnaam bij deze base? (snapshot, archiefblob, manifest, legacy of hun `.tmp`) */
  isOwnFile(name: string): boolean;
}

/**
 * Bouw de bestandsnamen én de HERKENNING voor één base.
 *
 * Waarom dit een exacte match moet zijn en geen `startsWith(base + '.')`. De productie-base is
 * kaal `recovery`, de dev-base is `recovery.<slug>` — dus elke dev-bestandsnaam begint met de
 * productie-prefix. Met een prefix-vergelijking ruimt één start van de productiebuild alle
 * herstel-snapshots van álle dev-worktrees op, ONVOORWAARDELIJK. De match is daarom: precies één segment (geen punt) tussen de base
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
 * `<slug>`. Dat bestand wordt nergens meer geschreven, dus het bestaat alleen nog als restant op een machine die ooit een oude dev-build draaide.
 */
export function recoveryNames(base: string): RecoveryNames {
  const snapshotRe = new RegExp(`^${escapeRe(base)}\\.([^.]+)\\.ifc$`);
  const generationSnapshotRe = new RegExp(`^${escapeRe(base)}\\.snapshot\\.([^.]+)\\.([^.]+)\\.ifc$`);
  // Een sha256 is 64 hexadecimale tekens; een dev-base (`recovery.<slug>`) valt er dus nooit onder
  // bij de productie-base, en omgekeerd.
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
  /**
   * v4: stond dit document bij het schrijven van de snapshot in "datums zoals opgeslagen"?
   * Crashherstel is het HERVATTEN van een sessie, geen heropening, dus
   * die weergavestand hoort terug te komen zoals hij was — en dat is een FEIT dat je opschrijft,
   * geen heuristiek die je achteraf uit de datums probeert af te leiden.
   *
   * OPTIONEEL getypeerd, met dezelfde regel als `ownerId`/`heartbeatAt`: een v1–v3-manifest staat
   * op de schijf van iedereen die een oudere versie draaide en MOET leesbaar blijven. Ontbreekt het
   * veld, dan geldt `false` — alleen het aanbod, niet de modus.
   */
  datesAsRecorded?: boolean;
  /**
   * v5: SHA-256 van het XER-bronarchief waar de snapshot naar VERWIJST (schema-3-pset
   * `recovery-reference-v1`). De bytes staan één keer als blob naast de snapshots (Tauri:
   * `archiveName`, web: object-store `xer-archives`). Afwezig = geen archief, of een oude snapshot
   * (v1–v4) die het archief nog ingebed draagt. Een blob blijft bestaan zolang een manifestregel
   * hem noemt.
   */
  xerArchive?: string;
}

export interface RecoveryManifest {
  /**
   * 1 = zonder eigenaarschapsvelden (t/m de multi-document-release), 2 = met `ownerId`/
   * `heartbeatAt`, 3 = immutable generatie-snapshots met het manifest als commitpoint, 4 = per
   * document de modusvlag `datesAsRecorded` als manifestmetadata (een oud manifest zonder vlag
   * leest als `false` = alleen aanbieden), 5 = per document de archiefverwijzing `xerArchive`
   * (een oud manifest zonder verwijzing heeft ingebedde archieven in zijn snapshots).
   * Een v1/v2-manifest MOET leesbaar blijven: het staat op de schijf van iedereen die een oudere
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
