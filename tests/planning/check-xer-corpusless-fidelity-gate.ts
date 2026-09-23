/**
 * Corpusloze XER-fidelity-eindpoort (X12, plan §1/§2/§3/§4.1).
 *
 * Dit is nadrukkelijk GEEN tweede XER-lezer. De check leest uitsluitend gereviewde, statische
 * contractdata en bewaakt drie verschillende beweringen die CI zonder corpus nog kan doen:
 *
 *  A. 93 publieke bronoccurrences met hun volledige SHA-256, rol en inclusiebesluit;
 *  B. de onafhankelijke, na byte- en schema-dedup geselecteerde 9 orakelentries (populatie: alleen
 *     aantoonbaar door P6 doorgerekende bestanden, eigenaarsbesluit 2026-09-23);
 *  D. de openbare task-replay-pin die A en B kruist zonder een replay uit te voeren.
 *
 * Laag C is een compacte maar volledig uitgepakte v2-karakteriseringssnapshot: hij bewaakt de
 * 9 entries en 21 projecten, maar verklaart zijn strict-nulpoort expliciet rood en ongeaccepteerd.
 * Daardoor kan corpusloze CI niet veinzen dat productfidelity nul is. `readXER`, scanner,
 * dedupbuilder, solveProject en de product-/replayadapter zijn hier daarom verboden imports.
 */
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { PRODUCT_AXES, canonicalProductJson, createProductEnvelope, decodeProductEnvelopeUnchecked, deriveStrictEntryGate, productProjectionDigest, productSha256, sealProductBaseline, selectProductReportMode, validateProductBaselineV2, type ProductBaselineV2, type ProductCountsV2, type ProductEnvelopeV2, type ProductValidationPins } from './xerProductBaselineV2';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const AXES = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'] as const;
const ROLES = [
  'oracle', 'engine-input', 'parser-fixture', 'pseudo-xer', 'reference-only', 'synthetic-fixture',
  'reader-only',
] as const;

type Axis = (typeof AXES)[number];
type Role = (typeof ROLES)[number];
type AxisCounts = { deviations: number; measurable: number };
type ManifestEntry = {
  sha256: string;
  source: string;
  role: Role;
  included: boolean;
  exclusionReason?: string;
  /** Vrije toelichting bij een entry (bv. een twijfel over het orakel); stuurt niets. */
  note?: string;
};
type Manifest = { version: number; policy: string; files: Record<string, ManifestEntry> };
type OracleEntry = {
  label: string;
  tasks: number;
  projects: number;
  counters: Record<Axis, AxisCounts>;
  schemaFingerprint?: string;
  reason?: string;
};
type OracleBaseline = { files: Record<string, OracleEntry> };
type ReplayAggregate = Record<Axis | 'overall', { improved: number; regressed: number; unchanged: number }>;
type ReplayPin = {
  version: number;
  manifestEntries: number;
  selectedEntries: number;
  projects: number;
  tasks: number;
  candidates: Record<string, { aggregate: ReplayAggregate; rejected: boolean; exitCode: number }>;
};
type ProductCounts = ProductCountsV2;
type ProductV2 = ProductBaselineV2;
type ProductEnvelope = ProductEnvelopeV2;

const EXPECTED = {
  // Manifestpinnen 2026-09-23h (fix manifest-review, handmatige reviewstap): alleen de teksten
  // veranderden — `exclusionReason` per entry naar wat gemeten is, de policy als eenmalig besluit, en een
  // `note` bij ashspace. Rollen, `included` en de selectie zijn ongewijzigd (selectiedigests gelijk).
  manifestRawSha256: '19f16d1fd71240890b3edd089e3d84947458df141afa06caa485da3f2b878f6c',
  baselineRawSha256: 'c945d59ac0cc7ec723ff16738a0ca54e3b194bda02f919d6885c2b2bc8a1aba0',
  manifestProjectionSha256: '3dafe5e195ec383eeb9d5b80528dd9d6d0a80d34d882b6deda2efd469c4f9b11',
  byteMultisetSha256: 'b48a8facd1f056a6b0f8219afb4aea46a01fda7be4df060af7cdc429bbf2fb19',
  oracleByteUniqueSha256: '7fee48a5ef51dd3c7b9940f631a1140a57b51ee2d65e22c048e48d12d67d7d47',
  selectedFullSha256: 'dd29b9e103709e8827f9ea159ed68bcfe7a70b141e9269bbc618ad786fa604d8',
  selectedSchemaSha256: '357eda2c6f02bb927e405bb51d8c51b3cfe55c279a86dd9f0446531fee0f97ef',
  selectedContractSha256: 'd710b69e540479162bd86c5702dbc4f37c2e25df0deda9b4943c570067ee5400',
  occurrences: 93,
  included: 13,
  excluded: 80,
  byteUnique: 84,
  oracleByteUnique: 10,
  selected: 9,
  schemaDuplicates: 1,
  projects: 21,
  tasks: 5_983,
  tasksWithAnyMeasuredAxis: 5_961,
  measurable: { es: 5_961, ef: 5_961, ls: 5_961, lf: 5_961, tf: 5_772, ff: 5_772 },
  // HERPIN 2026-09-23k (X12 naar nul, brok 6 — A19 late kant: lopende taak met rest 0 is voor SS/SF
  // achterwaarts een nulduur; regel A: measure:profiles VERBETERD, nieuw=0 verslechterd=0 groter=0
  // verbeterd=5 kleiner=0 schuld=0). X12 298 → 293 (ls −2, lf −2, tf −1), alles Roads (OCEC11731 en
  // het CP_Phys-punt OCEC11721). Overige cellen byte-identiek.
  // HERPIN 2026-09-23j (X12 naar nul, brok 6 — B2 `p6BackwardLagFinishBoundary` bij FF-lag 0, regel A:
  // measure:profiles VERBETERD, nieuw=0 verslechterd=0 groter=0 verbeterd=10 kleiner=0 schuld=0). Een
  // FF0-grens op een exact bandeinde blijft de finishgrens (niet de volgende bandstart). X12 308 → 298
  // (lf 46 → 36): Hotel 5, ashspace sample 4, Sample_Construction 1. Overige cellen byte-identiek.
  // HERPIN 2026-09-23i (X12 naar nul, brok 6 — conventie C9 `p6LateFinishOnOwnCalendar`, motorwijziging,
  // regel A: measure:profiles VERBETERD, nieuw=0 verslechterd=0 groter=0 verbeterd=42 kleiner=0 schuld=0).
  // Een late finish buiten de werktijd van de taak (grens van een opvolger op een andere kalender) wordt
  // het einde van de vorige werkperiode op de eigen kalender. X12 350 → 308 (ls 61 → 49, lf 76 → 46),
  // alles in Hotel_Construction_TEC (64 → 22). Overige bestanden byte-identiek. Geen schuldcellen.
  // HERPIN 2026-09-23h (X12 naar nul, brok 6 — de late kant van C5 en C6, motorwijziging, regel A:
  // measure:profiles VERBETERD, nieuw=0 verslechterd=0 groter=0 verbeterd=78 kleiner=5 schuld=0). Een
  // voltooide CP_Phys-opvolger met statusdatumpunt legt backward-druk op een open voorganger, en de
  // SS-rest-lag uit een lopende voorganger telt ook achterwaarts. X12 428 → 350 (ls 90 → 61, lf 105 → 76,
  // tf 92 → 72), alles in Roads (89 → 11: 1/3/2/2/1/2); ratchet-schuld 14 → 0. Ontschuld (alle 14 nu
  // exact, Roads_Project_TEC project 1346): A15112 (85462) ls/lf, B2921 (86905) ls/lf, B2922 (86912)
  // ls/lf; tf van OCEC10851 (86945), OCEC11701 (86962), OCEC20101 (87055), OCEC11741/11751/11762/11771/
  // 12121 (87145–87149). Overige bestanden byte-identiek.
  // HERPIN 2026-09-23g (merge van de manifest-etappe in de etappebranch; motor = brok 2 + 3 + 4, C1–C8):
  // dezelfde populatiewijziging als 23f-populatie hieronder, nu op de gemergde motor. Corpus-herpin
  // (V2_WRITE=corpus, CELLS_WRITE=corpus; GATE_PINS=write omdat de manifestpins hier al van de
  // manifest-etappe komen). X12 10.676 → 428 zesassig (es 45, ef 54, ls 90, lf 105, tf 92, ff 42;
  // sameday es 2, ef 2, ls 1, lf 13); drivingPath 176. De cellen van de 9 behouden entries zijn
  // byte-identiek aan die van 23f-merge-brok-4; uitgevallen: 10.245 niet-P6-doorgerekend + 3 onbekend.
  // Per bestand (zesassig): HarbourPointe 124 (18/21/23/19/32/11), DCP-03 Baseline 92 (20/22/4/4/22/20),
  // Roads 89 (1/3/31/31/21/2), Hotel 64 (0/2/22/36/1/3), OZB-Start 42 (4/4/9/9/13/3),
  // Sample_Construction 13 (2/2/1/2/3/3), ashspace 4 (lf 4), TERMINAL 0, xernative 0. Het verschil met
  // 1.274 (23f-populatie, motor zonder C5/C6) is precies de C5/C6-winst in de P6-bestanden.
  // HERPIN 2026-09-23f (POPULATIEWIJZIGING, geen motorwijziging — eigenaarsbesluit 2026-09-23 "alleen
  // die P6-bestanden", overdracht §1a): het orakel is voortaan uitsluitend een bestand met minstens één
  // aantoonbaar door P6 doorgerekend project (SCHEDOPTIONS + rem_late_start_date op alle open taken +
  // driving_path_flag ergens Y; `scripts/xer-p6-computed.ts`). 32 manifestentries gaan van oracle naar
  // reader-only (rehab-2 = P3-uitvoer, de synthetische/generatorbestanden, hb-intel, stack_data_center en
  // de vier DCP-03 As-Built-kopieën zonder open taak). Geselecteerd: 34 → 9 entries, 47 → 21 projecten,
  // 13.982 → 5.983 taken. X12 11.529 → 1.274 zesassig (es 271, ef 280, ls 267, lf 282, tf 120, ff 54;
  // sameday es 2, ef 2, ls 1, lf 13); drivingPath 417 → 176. Per bestand (zesassig, ongewijzigd t.o.v.
  // de vorige meting — alleen de noemer is kleiner): Roads 811 (es 195, ef 197, ls 178, lf 178, tf 49,
  // ff 14), HarbourPointe 192 (36/39/39/35/32/11), OZB-Start 98 (18/18/23/23/13/3), DCP-03 Baseline 92
  // (20/22/4/4/22/20), Hotel 64 (0/2/22/36/1/3), Sample_Construction 13 (2/2/1/2/3/3), ashspace 4
  // (lf 4), TERMINAL 0, xernative 0. Uitgevallen: rehab-2 8.441, de niet-P6-bestanden 1.814 samen.
  // Hotel draagt nog project CR (2665, niet P6-doorgerekend): 0 zesassige cellen, wel 19 drivingPath-
  // cellen (diff); het manifest kan niet per project uitsluiten — vervolgpunt.
  // HERPIN 2026-09-23f (merge brok 4 — C7 + C8 — in de etappebranch met brok 3 — C4–C6): 10.947 →
  // 10.676 (−271, 0 cellen slechter, drivingPath 417 ongewijzigd; verwacht ≈ −242 uit de losse brok-4-
  // winsten, de rest is samenspel met C5/C6). Per bestand/as (dump per cel tegen de cellen van 23d):
  //  - Roads_Project_TEC: ls −65 (alle 65 sameday → exact), lf −65 (sameday 16 + diff 49 → exact),
  //    tf −61, ff −10, es −6, ef −6 (C7 op de startmijlpaal OCEC12101; C8 op B3071/B2591);
  //  - OZB-Start-09Dec24: es −18, ef −18, tf −18, ff −4 (C8, OZ1040 en keten).
  //  De twee brok-4-toelichtingen hieronder (23e, 23d-brok-4) zijn gemeten op de brok-4-tak zonder C5/C6.
  // HERPIN 2026-09-23d (X12 naar nul, brok 3 — conventies C5 `p6CompletedPhysicalAtDataDate` en C6
  // `p6InProgressStartLagElapsed`, samen geland; classificatiebrok B07): 11.771 → 10.947 (−824, 0 cellen
  // slechter, drivingPath 417 ongewijzigd). Per bestand/as (dump per cel tegen de vorige cellen):
  //  - Roads_Project_TEC: es −194, ef −194, ls −140, lf −140, tf −15, ff −10 (C5: voltooide CP_Phys-
  //    taken als punt op de rauwe statusdatum of relatiegrens, late kant één punt op de opvolgergrens);
  //  - HarbourPointe_AssistedLiving: es −18, ef −18, ls −16, lf −16 (C5);
  //  - OZB-Start-09Dec24: es −14, ef −14, ls −14, lf −14 (C5);
  //  - rehab-2: es −3, ef −3, ff −1 (C6: V3259220 e.a., SS+lag uit een lopende voorganger).
  //  C5 alleen gaf +733/−65: de 65 (Roads, drie wortels OCEC11381/OCEC18251/OCEC18401 en hun keten)
  //  stonden vóór C5 toevallig goed via een zelf verkeerde lopende voorganger; C6 maakt ze weer exact,
  //  vandaar samen landen. Sameday: ls 129 → 136, lf 93 → 100 (Roads, 7 + 7 cellen diff → sameday,
  //  een betere emmer); es/ef ongewijzigd.
  // HERPIN 2026-09-23e (X12 naar nul, brok 4 — conventie C8 `p6StartedTaskIgnoresPlannedStartFloor`,
  // brok B11): 11.608 → 11.529 (−79, 0 cellen slechter, drivingPath 417 ongewijzigd). OZB-Start-09Dec24
  // (projecten 9032 en 10096): es −18, ef −18, tf −18, ff −4 — de lopende OZ1040 start ná haar lopende
  // voorganger OZ1030 (12-24 12:00) in plaats van op haar target_start (12-30 08:00); OZ1050–OZ1130
  // schuiven mee. Roads: es −6, ef −6, tf −6, ff −3 — de lopende B3071/B2591 starten op de statusdatum.
  // Geen `restart_date` gelezen (bak 2). rehab-2 ongewijzigd (P3-orakel, telt niet als bron).
  // HERPIN 2026-09-23d (X12 naar nul, brok 4 — conventie C7 `p6FinishFinishStartMilestoneLateFinish`,
  // brok B08): 11.771 → 11.608 (−163, 0 cellen slechter, drivingPath 417 ongewijzigd). Alles Roads:
  // ls −58 (sameday 129 → 71), lf −58 (sameday −9, diff −49), tf −42, ff −5 — een FF-relatie naar de
  // startmijlpaal OCEC12101 (`TT_Mile`, LF 2014-01-15 16:00) bindt aan de mijlpaal zelf, niet aan het
  // begin van de mijlpaaldag (07:00). De vijf wortels (OCEC11971/11851/18821/11911/18751) staan op
  // ls/lf/tf exact; de rest van B08 (52 cellen, stroomopwaarts) hangt aan andere wortels (ES-afwijking
  // van OCEC11911/18821, voltooide CP_Phys-voorgangers B07). FF naar een `TT_FinMile` ongewijzigd.
  // HERPIN 2026-09-23c (X12 naar nul, brok 3 — conventie C4 `p6CompletedOutOfSequenceWindow`, brok
  // B04): 12.973 → 11.771 (−1.202, 0 cellen slechter, drivingPath 417 ongewijzigd). Alles rehab-2:
  // es −432, ef −432, tf −298, ff −40 — een voltooide taak (of actief met restduur 0) met een
  // onvoltooide voorganger krijgt haar nul-restvenster ná die voorganger (Retained Logic), en haar
  // opvolgers schuiven mee. De late kant van die 36 wortels wacht op B01/B05. Sameday ongewijzigd.
  // HERPIN 2026-09-23b (X12 naar nul, brok 2 vervolg — conventie C3 `p6CompletedRemainingLag`, brok
  // B03): 13.324 → 12.973 (−351, 0 cellen slechter, drivingPath 417 ongewijzigd). Alles rehab-2:
  // ls −122, lf −122, tf −107 — voltooide voorgangers op de B3-restvensterroute rekenen achterwaarts
  // alleen de lag die op de statusdatum nog niet verstreken is. De rest van B03 (772 geschat) hangt
  // aan B01 of aan actieve taken met restduur 0. Sameday ongewijzigd.
  // HERPIN 2026-09-23 (X12 naar nul, brok 2 — conventies C1 `p6CompletedPredecessorAtDataDate` en
  // C2 `p6FreeFloatOnOwnCalendar`, samen geland): 15.056 → 13.324 (−1.732, 0 cellen slechter,
  // drivingPath 417 ongewijzigd). Per bestand/as gemeten (dump per cel tegen de vorige cellen):
  //  - rehab-2: es −497, ef −497, tf −267 (C1: opvolgers van de vijf voltooide taken met werkelijk
  //    einde 2008-05-27 17:00 ná de statusdatum beginnen op de statusdatum; dossier 7b-4), ff −215
  //    (C1 40, C2 175). De overige 231 tf-cellen van brok B02 wachten op brok B01 (hun LS/LF).
  //  - Hotel ff −244, Roads ff −11, DCP-03 Baseline ff −1 (C2: vrije speling op de taakkalender).
  //  C1 alleen gaf +1.301/−1: de ene ff-cel (rehab-2 V3248175, taak op kalender 893, opvolger op
  //  842) was vóór C1 toevallig exact via de opvolgerkalender; C2 maakt hem weer exact, vandaar
  //  samen landen. Sameday ongewijzigd (es 96, ef 97, ls 129, lf 93).
  // HERPIN 2026-09-07 (één herpin, volledig corpus 93/93, na het landen van 7a én 7b, laag 3 en
  // origin/main): 18.398 (v2-baseline, vóór 7b) → 17.421 (kop 1206e010, ná 7b) → 15.056 (nu).
  // Per bestand/as gemeten: ALLE beweging zit in rehab-2 (proj_id 761); de overige 33 entries zijn
  // byte-identiek aan de v2-baseline. Reden per as, per stap:
  //  - 7b (weekend-klemherstel, X-O7-uitzondering, plan §5): es 618→940 (+322), ef 813→940 (+127)
  //    SLECHTER — de gedocumenteerde compensatiefout-blootlegging (dossier 7b-4, §9); ls 4.358→3.889,
  //    lf 4.350→3.889, tf 4.200→3.903, ff 473→274 beter; drivingPath 79→80.
  //  - 7a (completed-late, klasse (i)): ls 3.889→2.920 (−969: 969 cellen diff→exact, 0 exact→diff),
  //    lf 3.889→2.920 (−969, idem), tf 3.903→3.476 (netto −427: 642 diff→exact, 215 exact→diff — de
  //    215 zijn allemaal TK_Complete/DT_FixedDUR2 met P6 tf = 0, klasse (ii)); es/ef/ff ongewijzigd;
  //    drivingPath 80→86 (+6: 87418, 87419, 87420, 87421, 87422, 87426 — open taken die nu exact P6's
  //    tf = 0 krijgen en daardoor bij ons kritiek worden waar P6's driving_path_flag false zegt).
  //  - laag 3 en origin/main: 15.056 → 15.056, per constructie en gemeten.
  // Sameday (corpusbreed, alle 34 entries): es 96, ef 97, ls 129, lf 93, tf 0, ff 0 — ongewijzigd
  // t.o.v. de v2-baseline; plan §1 eist nul, dus dit is een open categorie, geen residu dat hier
  // 'met reden' wordt weggepind.
  // Eerdere toelichting (7a-herpin op de pre-7b-basis, 2026-09-05) blijft als geschiedenis: die mat
  // ls −890/lf −891/tf −358 op de OUDE kalender; op de gereconstrueerde kalender (7b) is de winst van
  // dezelfde regel groter (−969/−969/−427).
  productStrict: {
    exact: { es: 5_916, ef: 5_907, ls: 5_914, lf: 5_927, tf: 5_701, ff: 5_730 },
    sameday: { es: 2, ef: 2, ls: 1, lf: 2, tf: 0, ff: 0 },
    diff: { es: 43, ef: 52, ls: 46, lf: 32, tf: 71, ff: 42 },
    missing: { es: 0, ef: 0, ls: 0, lf: 0, tf: 0, ff: 0 },
    deviations: { es: 45, ef: 54, ls: 47, lf: 34, tf: 71, ff: 42 },
    drivingPath: { exact: 5_807, sameday: 0, diff: 176, missing: 0, measurable: 5_983, deviations: 176 },
  },
  productPayloadSha256: '5c4a582c01f5337abfb38933853562a1cf55cc73897c7f3077d82297091bf399',
  productPayloadGzipSha256: '694c5ec3df4492c95b6c3c73280c8d8cf0f90b5b0edefe7f5bf0d24d11c8e185',
  productProjectProjectionSha256: '16f5c6e72d0fc97cd6559bffce479589ee56871b740d491e9023007fb959edb0',
  roles: {
    oracle: 13,
    'engine-input': 14,
    'parser-fixture': 15,
    'pseudo-xer': 13,
    'reference-only': 1,
    'synthetic-fixture': 5,
    'reader-only': 32,
  } satisfies Record<Role, number>,
} as const;

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_16 = /^[0-9a-f]{16}$/;
const ALLOWED_STATIC_IMPORTS = new Set([
  'node:crypto',
  'node:fs',
  'node:path',
  'node:url',
  'node:zlib',
  './xerProductBaselineV2',
]);
const diffs: string[] = [];
const mutationEvidence: string[] = [];
const EXPECTED_MUTANTS = 52;
const EXPECTED_POSITIVE_CONTROLS = 5;
const EXPECTED_TOTAL_CHECKS = EXPECTED_MUTANTS + EXPECTED_POSITIVE_CONTROLS;
let mutationChecks = 0;
let positiveChecks = 0;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rawHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function issue(problems: string[], message: string): void {
  problems.push(message);
}

function equal(problems: string[], label: string, got: unknown, want: unknown): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    issue(problems, `${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function checkPositive(label: string, got: unknown, want: unknown): void {
  positiveChecks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function checkMutationEqual(label: string, got: unknown, want: unknown, evidence: string): void {
  mutationChecks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  } else {
    mutationEvidence.push(`${label}: ROOD — ${evidence}`);
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function manifestEntries(manifest: Manifest): Array<{ label: string; entry: ManifestEntry }> {
  return Object.entries(manifest.files).map(([label, entry]) => ({ label, entry }));
}

function manifestProjection(manifest: Manifest): unknown[] {
  return manifestEntries(manifest)
    .map(({ label, entry }) => ({
      label,
      sha256: entry.sha256,
      source: entry.source,
      role: entry.role,
      included: entry.included,
      exclusionReason: entry.exclusionReason ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function byHash(manifest: Manifest): Map<string, Array<{ label: string; entry: ManifestEntry }>> {
  const index = new Map<string, Array<{ label: string; entry: ManifestEntry }>>();
  for (const item of manifestEntries(manifest)) {
    const current = index.get(item.entry.sha256) ?? [];
    current.push(item);
    index.set(item.entry.sha256, current);
  }
  return index;
}

function selectedProjection(baseline: OracleBaseline, manifest: Manifest): Array<{
  prefix: string;
  sha256: string | null;
  schemaFingerprint: string | null;
  projects: number;
  tasks: number;
  counters: Record<Axis, AxisCounts>;
  reason: string | null;
}> {
  const fullHashes = [...byHash(manifest).keys()];
  return Object.entries(baseline.files)
    .map(([prefix, entry]) => ({
      prefix,
      sha256: fullHashes.filter(full => full.startsWith(prefix))[0] ?? null,
      schemaFingerprint: entry.schemaFingerprint ?? null,
      projects: entry.projects,
      tasks: entry.tasks,
      counters: entry.counters,
      reason: entry.reason ?? null,
    }))
    .sort((left, right) => (left.sha256 ?? '').localeCompare(right.sha256 ?? ''));
}

function validateInventory(raw: unknown): { manifest: Manifest | null; problems: string[] } {
  const problems: string[] = [];
  const root = asObject(raw);
  if (!root || !asObject(root.files)) {
    issue(problems, 'inventaris: root/files is geen object');
    return { manifest: null, problems };
  }
  const manifest = raw as Manifest;
  const entries = manifestEntries(manifest);
  equal(problems, 'inventaris.version', manifest.version, 1);
  equal(problems, 'inventaris.occurrences', entries.length, EXPECTED.occurrences);

  const roleCounts = Object.fromEntries(ROLES.map(role => [role, 0])) as Record<Role, number>;
  let included = 0;
  let excluded = 0;
  for (const { label, entry } of entries) {
    if (!label.trim()) issue(problems, 'inventaris: lege occurrence-identiteit');
    if (!entry || typeof entry !== 'object') { issue(problems, `inventaris ${label}: geen entry`); continue; }
    if (!HEX_64.test(entry.sha256 ?? '')) issue(problems, `inventaris ${label}: sha256 is niet 64 lowercase hex`);
    if (!isRole(entry.role)) issue(problems, `inventaris ${label}: onbekende rol`);
    else roleCounts[entry.role]++;
    if (entry.included !== (entry.role === 'oracle')) {
      issue(problems, `inventaris ${label}: included moet precies role=oracle volgen`);
    }
    if (entry.included) included++;
    else {
      excluded++;
      if (typeof entry.exclusionReason !== 'string' || !entry.exclusionReason.trim()) {
        issue(problems, `inventaris ${label}: uitgesloten entry mist exclusionReason`);
      }
    }
  }
  equal(problems, 'inventaris.rolverdeling', roleCounts, EXPECTED.roles);
  equal(problems, 'inventaris.included', included, EXPECTED.included);
  equal(problems, 'inventaris.excluded', excluded, EXPECTED.excluded);

  const hashIndex = byHash(manifest);
  equal(problems, 'inventaris.byte-uniek', hashIndex.size, EXPECTED.byteUnique);
  const occurrenceMultiset = Object.entries(Object.fromEntries(
    [...hashIndex.entries()].map(([hash, occurrences]) => [hash, occurrences.length]),
  )).sort(([left], [right]) => left.localeCompare(right));
  equal(problems, 'inventaris.byte-multiset-digest', stableHash(occurrenceMultiset), EXPECTED.byteMultisetSha256);
  equal(problems, 'inventaris.semantische-projectie', stableHash(manifestProjection(manifest)), EXPECTED.manifestProjectionSha256);
  return { manifest, problems };
}

function validateOracle(raw: unknown, manifest: Manifest): { baseline: OracleBaseline | null; problems: string[] } {
  const problems: string[] = [];
  const root = asObject(raw);
  if (!root || !asObject(root.files)) {
    issue(problems, 'orakel: root/files is geen object');
    return { baseline: null, problems };
  }
  const baseline = raw as OracleBaseline;
  const entries = Object.entries(baseline.files);
  equal(problems, 'orakel.selectie-aantal', entries.length, EXPECTED.selected);

  const fullIndex = byHash(manifest);
  const includedUnique = [...fullIndex.entries()]
    .filter(([, occurrences]) => occurrences.some(({ entry }) => entry.role === 'oracle' && entry.included))
    .map(([hash]) => hash)
    .sort();
  equal(problems, 'orakel.byte-unieke-orakels', includedUnique.length, EXPECTED.oracleByteUnique);
  equal(problems, 'orakel.byte-unieke-orakels-digest', stableHash(includedUnique), EXPECTED.oracleByteUniqueSha256);

  const seenFull = new Set<string>();
  const seenFingerprints = new Set<string>();
  let projects = 0;
  let tasks = 0;
  const measurable = { es: 0, ef: 0, ls: 0, lf: 0, tf: 0, ff: 0 } as Record<Axis, number>;
  for (const [prefix, entry] of entries) {
    if (!HEX_16.test(prefix)) issue(problems, `orakel ${prefix}: sleutel is geen 16-hexprefix`);
    const matches = [...fullIndex.entries()].filter(([hash]) => hash.startsWith(prefix));
    if (matches.length !== 1) issue(problems, `orakel ${prefix}: prefixbotsing of ontbrekende volledige SHA (${matches.length})`);
    const [fullHash, occurrences] = matches[0] ?? [];
    if (fullHash) {
      if (seenFull.has(fullHash)) issue(problems, `orakel ${prefix}: dubbele geselecteerde volledige SHA`);
      seenFull.add(fullHash);
      if (!occurrences?.some(({ entry: manifestEntry }) => manifestEntry.role === 'oracle' && manifestEntry.included)) {
        issue(problems, `orakel ${prefix}: verwijst niet naar een inbegrepen orakelentry`);
      }
    }
    if (!entry || typeof entry !== 'object') { issue(problems, `orakel ${prefix}: geen entry`); continue; }
    if (typeof entry.schemaFingerprint !== 'string' || !entry.schemaFingerprint.trim()) {
      issue(problems, `orakel ${prefix}: schemaFingerprint ontbreekt`);
    } else if (seenFingerprints.has(entry.schemaFingerprint)) {
      issue(problems, `orakel ${prefix}: dubbele schemaFingerprint`);
    } else seenFingerprints.add(entry.schemaFingerprint);
    if ('reason' in entry) issue(problems, `orakel ${prefix}: reason is in de nulpoort verboden`);
    if (!isNonNegativeInteger(entry.projects) || !isNonNegativeInteger(entry.tasks)) {
      issue(problems, `orakel ${prefix}: projects/tasks zijn geen niet-negatieve gehele getallen`);
    } else {
      projects += entry.projects;
      tasks += entry.tasks;
    }
    for (const axis of AXES) {
      const counts = entry.counters?.[axis];
      if (!counts || !isNonNegativeInteger(counts.measurable) || !isNonNegativeInteger(counts.deviations)) {
        issue(problems, `orakel ${prefix}.${axis}: ongeldige counters`);
        continue;
      }
      if (counts.deviations !== 0) issue(problems, `orakel ${prefix}.${axis}: deviations moet nul zijn`);
      if (counts.deviations > counts.measurable) issue(problems, `orakel ${prefix}.${axis}: deviations > measurable`);
      measurable[axis] += counts.measurable;
    }
  }
  equal(problems, 'orakel.tweede-dedup', includedUnique.length - seenFull.size, EXPECTED.schemaDuplicates);
  equal(problems, 'orakel.geselecteerde-volledige-SHAs', stableHash([...seenFull].sort()), EXPECTED.selectedFullSha256);
  equal(problems, 'orakel.schemafingerprintset', stableHash(selectedProjection(baseline, manifest)
    .map(({ sha256, schemaFingerprint }) => ({ sha256, schemaFingerprint }))), EXPECTED.selectedSchemaSha256);
  equal(problems, 'orakel.volledige-selectiecontract', stableHash(selectedProjection(baseline, manifest)), EXPECTED.selectedContractSha256);
  equal(problems, 'orakel.projecten', projects, EXPECTED.projects);
  equal(problems, 'orakel.TASK-rijen', tasks, EXPECTED.tasks);
  equal(problems, 'orakel.meetbaar-per-as', measurable, EXPECTED.measurable);
  return { baseline, problems };
}

function validateReplay(raw: unknown, oracle: OracleBaseline): string[] {
  const problems: string[] = [];
  const root = asObject(raw);
  if (!root || !asObject(root.candidates)) return ['replay: root/candidates is geen object'];
  const replay = raw as ReplayPin;
  const oracleEntries = Object.values(oracle.files);
  const oracleProjects = oracleEntries.reduce((sum, entry) => sum + entry.projects, 0);
  const oracleTasks = oracleEntries.reduce((sum, entry) => sum + entry.tasks, 0);
  const oracleMeasurable = Object.fromEntries(AXES.map(axis => [axis,
    oracleEntries.reduce((sum, entry) => sum + entry.counters[axis].measurable, 0),
  ])) as Record<Axis, number>;
  equal(problems, 'replay.version', replay.version, 1);
  equal(problems, 'replay.manifestEntries', replay.manifestEntries, EXPECTED.occurrences);
  equal(problems, 'replay.selectedEntries', replay.selectedEntries, EXPECTED.selected);
  equal(problems, 'replay.projecten', replay.projects, oracleProjects);
  equal(problems, 'replay.TASK-rijen', replay.tasks, oracleTasks);
  const zero = replay.candidates['synthetic-zero-regression'];
  const negative = replay.candidates['drop-p6-relation-finish-boundary'];
  if (!zero || !negative) return [...problems, 'replay: verplichte kandidaten ontbreken'];
  for (const axis of AXES) {
    const candidate = zero.aggregate?.[axis];
    if (!candidate) { issue(problems, `replay nul ${axis}: aggregate ontbreekt`); continue; }
    equal(problems, `replay nul ${axis}.improved`, candidate.improved, 0);
    equal(problems, `replay nul ${axis}.regressed`, candidate.regressed, 0);
    equal(problems, `replay nul ${axis}.unchanged`, candidate.unchanged, oracleMeasurable[axis]);
  }
  equal(problems, 'replay nul overall.improved', zero.aggregate?.overall?.improved, 0);
  equal(problems, 'replay nul overall.regressed', zero.aggregate?.overall?.regressed, 0);
  equal(problems, 'replay nul overall.unchanged', zero.aggregate?.overall?.unchanged, EXPECTED.tasksWithAnyMeasuredAxis);
  equal(problems, 'replay nul exitcode', zero.exitCode, 0);
  equal(problems, 'replay nul rejected', zero.rejected, false);
  const negativeRegressions = AXES.reduce((sum, axis) => sum + (negative.aggregate?.[axis]?.regressed ?? 0), 0);
  checkProblem(problems, 'replay negatief heeft minstens één regressie', negativeRegressions > 0);
  equal(problems, 'replay negatief exitcode', negative.exitCode, 1);
  equal(problems, 'replay negatief rejected', negative.rejected, true);
  return problems;
}

function decodeProductPayload(envelope: ProductEnvelope): ProductV2 {
  return decodeProductEnvelopeUnchecked(envelope);
}

function withMutatedProduct(envelope: ProductEnvelope, mutate: (product: ProductV2) => void): ProductEnvelope {
  const product = clone(decodeProductPayload(envelope));
  mutate(product);
  return createProductEnvelope(sealProductBaseline(product), envelope.cellMinutesSha256);
}

function withRawMutatedProduct(envelope: ProductEnvelope, mutate: (product: ProductV2) => void): ProductEnvelope {
  const product = clone(decodeProductPayload(envelope));
  mutate(product);
  const payloadText = canonicalProductJson(product);
  const compressed = gzipSync(Buffer.from(payloadText, 'utf8'), { level: 9 });
  return {
    ...envelope,
    payloadSha256: productSha256(payloadText),
    payloadGzipSha256: productSha256(compressed),
    projectProjectionSha256: productProjectionDigest(product),
    payloadGzipBase64: compressed.toString('base64'),
  };
}

function productPins(manifest: Manifest, oracle: OracleBaseline): ProductValidationPins {
  const fullHashes = [...byHash(manifest).keys()];
  const entries = Object.fromEntries(Object.entries(oracle.files).map(([prefix, entry]) => {
    const matches = fullHashes.filter(hashValue => hashValue.startsWith(prefix));
    if (matches.length !== 1 || !entry.schemaFingerprint) throw new Error(`product-v2-pin ${prefix} is niet eenduidig`);
    return [matches[0]!, { schemaFingerprint: entry.schemaFingerprint }];
  }));
  const counters = Object.fromEntries(AXES.map(axis => [axis, {
    exact: EXPECTED.productStrict.exact[axis],
    sameday: EXPECTED.productStrict.sameday[axis],
    diff: EXPECTED.productStrict.diff[axis],
    missing: EXPECTED.productStrict.missing[axis],
    measurable: EXPECTED.measurable[axis],
    deviations: EXPECTED.productStrict.deviations[axis],
  }])) as Record<Axis, ProductCounts>;
  return {
    manifestSha256: rawHash(manifestRaw),
    entries,
    projects: EXPECTED.projects,
    tasks: EXPECTED.tasks,
    counters,
    drivingPath: EXPECTED.productStrict.drivingPath,
    payloadSha256: EXPECTED.productPayloadSha256,
    payloadGzipSha256: EXPECTED.productPayloadGzipSha256,
    projectProjectionSha256: EXPECTED.productProjectProjectionSha256,
  };
}

/**
 * Corpusloze laag C pakt de volledige v2-snapshot uit en valideert hem tegen de al gepinde
 * manifest-/orakelselectie. Hij kan niet zélf productnul bewijzen, maar hij mag evenmin een
 * overgangssnapshot als eindacceptatie presenteren.
 */
function validateProductV2(raw: string | ProductEnvelope, manifest: Manifest, oracle: OracleBaseline): string[] {
  const rawText = typeof raw === 'string' ? raw : canonicalProductJson(raw);
  return validateProductBaselineV2(rawText, productPins(manifest, oracle)).problems;
}

function checkProblem(problems: string[], label: string, condition: boolean): void {
  if (!condition) issue(problems, label);
}

function stripExecutableNoise(source: string): string {
  let result = '';
  let state: 'code' | 'line-comment' | 'block-comment' | 'single-quote' | 'double-quote' | 'template' = 'code';
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        result += '  ';
        index++;
        state = 'line-comment';
        continue;
      }
      if (char === '/' && next === '*') {
        result += '  ';
        index++;
        state = 'block-comment';
        continue;
      }
      if (char === '\'') {
        result += char;
        state = 'single-quote';
        escaped = false;
        continue;
      }
      if (char === '"') {
        result += char;
        state = 'double-quote';
        escaped = false;
        continue;
      }
      if (char === '`') {
        result += char;
        state = 'template';
        escaped = false;
        continue;
      }
      result += char;
      continue;
    }

    if (state === 'line-comment') {
      result += char === '\n' ? '\n' : ' ';
      if (char === '\n') state = 'code';
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        result += '  ';
        index++;
        state = 'code';
      } else {
        result += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'single-quote') {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '\'') state = 'code';
      continue;
    }

    if (state === 'double-quote') {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') state = 'code';
      continue;
    }

    result += char;
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '`') state = 'code';
  }

  return result;
}

const DYNAMIC_IMPORT_RE = new RegExp(['\\b', 'import', '\\s*', '\\('].join(''));
const DYNAMIC_REQUIRE_RE = new RegExp(['\\b', 'require', '\\s*', '\\('].join(''));
const DYNAMIC_IMPORT_LABEL = ['import', '()'].join('');
const DYNAMIC_REQUIRE_LABEL = ['require', '()'].join('');

function validateOwnSource(raw: string): string[] {
  const problems: string[] = [];
  const importModules: string[] = [];
  const lines = raw.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) continue;

    const match = trimmed.match(/^import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?$/);
    if (!match) {
      issue(problems, `bron ${index + 1}: statische importregel is niet line-anchored of niet exact`);
      continue;
    }
    importModules.push(match[1]!);
  }

  equal(problems, 'bron.statische-import-aantal', importModules.length, 6);
  equal(problems, 'bron.statische-import-modules', [...new Set(importModules)].sort(), [...ALLOWED_STATIC_IMPORTS].sort());
  for (const module of importModules) {
    if (!ALLOWED_STATIC_IMPORTS.has(module)) {
      issue(problems, `bron: verboden statische import ${module}`);
    }
  }

  const executableScan = stripExecutableNoise(raw);
  if (DYNAMIC_IMPORT_RE.test(executableScan)) issue(problems, `bron: dynamische ${DYNAMIC_IMPORT_LABEL} is verboden`);
  if (DYNAMIC_REQUIRE_RE.test(executableScan)) issue(problems, `bron: ${DYNAMIC_REQUIRE_LABEL} is verboden`);

  return problems;
}

function validateContract(manifestRaw: unknown, oracleRaw: unknown, replayRaw: unknown): string[] {
  const inventory = validateInventory(manifestRaw);
  if (!inventory.manifest) return inventory.problems;
  const oracle = validateOracle(oracleRaw, inventory.manifest);
  if (!oracle.baseline) return [...inventory.problems, ...oracle.problems];
  return [...inventory.problems, ...oracle.problems, ...validateReplay(replayRaw, oracle.baseline)];
}

function expectRejected(label: string, manifest: Manifest, oracle: OracleBaseline, replay: ReplayPin): void {
  mutationChecks++;
  const problems = validateContract(manifest, oracle, replay);
  if (problems.length === 0) diffs.push(`${label}: mutant werd ten onrechte geaccepteerd`);
  else mutationEvidence.push(`${label}: ROOD — ${problems[0]}`);
}

function expectProductRejected(label: string, envelope: string | ProductEnvelope, manifest: Manifest, oracle: OracleBaseline): void {
  mutationChecks++;
  const problems = validateProductV2(envelope, manifest, oracle);
  if (problems.length === 0) diffs.push(`${label}: product-v2-mutant werd ten onrechte geaccepteerd`);
  else mutationEvidence.push(`${label}: ROOD — ${problems[0]}`);
}

function expectSourceRejected(label: string, raw: string): void {
  mutationChecks++;
  const problems = validateOwnSource(raw);
  if (problems.length === 0) diffs.push(`${label}: bronmutant werd ten onrechte geaccepteerd`);
  else mutationEvidence.push(`${label}: ROOD — ${problems[0]}`);
}

const manifestRaw = readFileSync(join(HERE, 'xer-corpus-manifest.json'), 'utf8');
const oracleRaw = readFileSync(join(HERE, 'xer-fidelity-baseline.json'), 'utf8');
const replayRaw = readFileSync(join(HERE, 'xer-task-replay-public-pin.json'), 'utf8');
const productV2Raw = readFileSync(join(HERE, 'xer-product-fidelity-baseline-v2.json'), 'utf8');
const sourceRaw = readFileSync(join(HERE, 'check-xer-corpusless-fidelity-gate.ts'), 'utf8');
const manifest = JSON.parse(manifestRaw) as Manifest;
const oracle = JSON.parse(oracleRaw) as OracleBaseline;
const replay = JSON.parse(replayRaw) as ReplayPin;
const productV2 = JSON.parse(productV2Raw) as ProductEnvelope;
const decodedProductV2 = decodeProductPayload(productV2);

/**
 * Herpinroute na een echte verbetering (regel A, `scripts/README.md` stap 3): `OPS_XER_GATE_PINS=print`
 * toont de uit de gecommitte v2 afgeleide pinwaarden; `OPS_XER_GATE_PINS=write` schrijft ze atomair
 * in het `EXPECTED`-blok van dit bestand (alleen de v2-afgeleide velden: `measurable`, `projects`,
 * `tasks`, `productStrict` en de drie product-hashes) en stopt. De toelichtende HERPIN-commentaar
 * erboven blijft mensenwerk. Daarna draai je deze check gewoon: die moet groen eindigen.
 */
const pinMode = process.env.OPS_XER_GATE_PINS;
if (pinMode !== undefined) {
  if (pinMode !== 'print' && pinMode !== 'write' && pinMode !== 'corpus') {
    console.log(`XX OPS_XER_GATE_PINS=${pinMode.slice(0, 20)} onbekend (verwacht print, write of corpus)`);
    process.exit(2);
  }
  const num = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  const sumAxis = (field: keyof ProductCounts) => Object.fromEntries(AXES.map(axis => [axis,
    Object.values(decodedProductV2.files).reduce((total, entry) => total + entry.counters[axis][field], 0)])) as Record<Axis, number>;
  const axisLine = (values: Record<Axis, number>) => `{ ${AXES.map(axis => `${axis}: ${num(values[axis])}`).join(', ')} }`;
  const driving = Object.values(decodedProductV2.files).reduce((total, entry) => {
    for (const key of Object.keys(total) as Array<keyof ProductCounts>) total[key] += entry.drivingPath[key];
    return total;
  }, { exact: 0, sameday: 0, diff: 0, missing: 0, measurable: 0, deviations: 0 } satisfies ProductCounts);
  const projects = Object.values(decodedProductV2.files).reduce((total, entry) => total + entry.projects, 0);
  const tasks = Object.values(decodedProductV2.files).reduce((total, entry) => total + entry.tasks, 0);
  const replacements: Array<[RegExp, string]> = [
    [/^  projects: [\d_]+,$/m, `  projects: ${num(projects)},`],
    [/^  tasks: [\d_]+,$/m, `  tasks: ${num(tasks)},`],
    [/^  measurable: \{[^}\n]*\},$/m, `  measurable: ${axisLine(sumAxis('measurable'))},`],
    [/^    exact: \{[^}\n]*\},$/m, `    exact: ${axisLine(sumAxis('exact'))},`],
    [/^    sameday: \{[^}\n]*\},$/m, `    sameday: ${axisLine(sumAxis('sameday'))},`],
    [/^    diff: \{[^}\n]*\},$/m, `    diff: ${axisLine(sumAxis('diff'))},`],
    [/^    missing: \{[^}\n]*\},$/m, `    missing: ${axisLine(sumAxis('missing'))},`],
    [/^    deviations: \{[^}\n]*\},$/m, `    deviations: ${axisLine(sumAxis('deviations'))},`],
    [/^    drivingPath: \{[^}\n]*\},$/m, `    drivingPath: { ${(Object.keys(driving) as Array<keyof ProductCounts>).map(key => `${key}: ${num(driving[key])}`).join(', ')} },`],
    [/^  productPayloadSha256: '[0-9a-f]{64}',$/m, `  productPayloadSha256: '${productV2.payloadSha256}',`],
    [/^  productPayloadGzipSha256: '[0-9a-f]{64}',$/m, `  productPayloadGzipSha256: '${productV2.payloadGzipSha256}',`],
    [/^  productProjectProjectionSha256: '[0-9a-f]{64}',$/m, `  productProjectProjectionSha256: '${productV2.projectProjectionSha256}',`],
  ];
  for (const [, line] of replacements) console.log(`PIN ${line.trim()}`);
  // Eén kant op (regel A): `write` weigert zodra een afwijkingenteller STIJGT t.o.v. de huidige
  // EXPECTED (deviations per as, diff+missing per as, drivingPath.deviations) of zodra de dekking
  // (measurable, projects, tasks) verandert — een verbetering zakt, een regressie of een blinder
  // orakel wordt geweigerd. Een gewijzigd corpusmanifest kan alleen via `=corpus`, en `=corpus`
  // alleen bij een werkelijk gewijzigd manifest.
  if (pinMode !== 'print') {
    const manifestChanged = rawHash(manifestRaw) !== EXPECTED.manifestRawSha256;
    const refusals: string[] = [];
    if (pinMode === 'corpus' && !manifestChanged) refusals.push('=corpus vereist een gewijzigd corpusmanifest; gebruik =write');
    if (pinMode === 'write' && manifestChanged) refusals.push('het corpusmanifest is gewijzigd; gebruik bewust =corpus');
    if (pinMode === 'write') {
      const deviations = sumAxis('deviations');
      const diff = sumAxis('diff');
      const missing = sumAxis('missing');
      const measurable = sumAxis('measurable');
      for (const axis of AXES) {
        if (deviations[axis] > EXPECTED.productStrict.deviations[axis]) {
          refusals.push(`${axis}.deviations stijgt ${EXPECTED.productStrict.deviations[axis]} → ${deviations[axis]}`);
        }
        const before = EXPECTED.productStrict.diff[axis] + EXPECTED.productStrict.missing[axis];
        if (diff[axis] + missing[axis] > before) refusals.push(`${axis}.diff+missing stijgt ${before} → ${diff[axis] + missing[axis]}`);
        if (measurable[axis] !== EXPECTED.measurable[axis]) refusals.push(`${axis}.measurable wijzigt ${EXPECTED.measurable[axis]} → ${measurable[axis]}`);
      }
      if (driving.deviations > EXPECTED.productStrict.drivingPath.deviations) {
        refusals.push(`drivingPath.deviations stijgt ${EXPECTED.productStrict.drivingPath.deviations} → ${driving.deviations}`);
      }
      if (driving.measurable !== EXPECTED.productStrict.drivingPath.measurable) refusals.push('drivingPath.measurable wijzigt');
      if (projects !== EXPECTED.projects) refusals.push(`projects wijzigt ${EXPECTED.projects} → ${projects}`);
      if (tasks !== EXPECTED.tasks) refusals.push(`tasks wijzigt ${EXPECTED.tasks} → ${tasks}`);
    }
    if (refusals.length > 0) {
      for (const refusal of refusals) console.log(`XX OPS_XER_GATE_PINS=${pinMode} geweigerd (alleen omlaag): ${refusal}`);
      process.exit(1);
    }
  }
  if (pinMode !== 'print') {
    let next = sourceRaw;
    for (const [pattern, line] of replacements) {
      const matches = next.match(new RegExp(pattern.source, 'gm')) ?? [];
      if (matches.length !== 1) {
        console.log(`XX pinregel ${pattern.source} komt ${matches.length}× voor in EXPECTED; verwacht precies 1 — niets geschreven`);
        process.exit(1);
      }
      next = next.replace(pattern, line);
    }
    const path = join(HERE, 'check-xer-corpusless-fidelity-gate.ts');
    const temp = `${path}.tmp-${process.pid}`;
    writeFileSync(temp, next);
    renameSync(temp, path);
    console.log(`OK  EXPECTED-pins ${next === sourceRaw ? 'ongewijzigd' : 'herschreven'} uit xer-product-fidelity-baseline-v2.json — draai deze check nu zonder OPS_XER_GATE_PINS`);
  }
  process.exit(0);
}
const firstProductLabel = Object.keys(decodedProductV2.files)[0]!;
const multiProjectLabel = Object.entries(decodedProductV2.files)
  .find(([, entry]) => entry.projectMeasurements.length >= 2)?.[0];
const algebraProjectLabel = Object.entries(decodedProductV2.files)
  .find(([, entry]) => entry.projectMeasurements.some((project, index) => project.counters.es.exact > 0
    && entry.projectMeasurements.some((candidate, candidateIndex) => candidateIndex !== index
      && candidate.counters.es.diff > 0)))?.[0];
if (!multiProjectLabel) throw new Error('product-v2-mutanten vereisen minstens een multi-projectentry');
if (!algebraProjectLabel) throw new Error('product-v2-mutanten vereisen geschikte projecttellers');

type NewMutationCase = {
  id: 'M33' | 'M34' | 'M35' | 'M36' | 'M37';
  label: string;
  run: () => string[];
};

const newMutationCases: readonly NewMutationCase[] = [
  {
    id: 'M33',
    label: 'M33 neutrale onbekende entrykey',
    run: () => validateProductV2(withRawMutatedProduct(productV2, product => {
      (product.files[firstProductLabel] as unknown as Record<string, unknown>).unknownEntryKey = true;
    }), manifest, oracle),
  },
  {
    id: 'M34',
    label: 'M34 projectprojectie niet canoniek op project-ID gesorteerd',
    run: () => validateProductV2(withRawMutatedProduct(productV2, product => {
      const projects = product.files[multiProjectLabel]!.projectMeasurements;
      [projects[0], projects[1]] = [projects[1]!, projects[0]!];
    }), manifest, oracle),
  },
  {
    id: 'M35',
    label: 'M35 meetbaarheid boven projecttaaknoemer met intacte telleralgebra',
    run: () => validateProductV2(withMutatedProduct(productV2, product => {
      const entry = product.files[firstProductLabel]!;
      const project = entry.projectMeasurements[0]!;
      const projectCounts = project.counters.es;
      const entryCounts = entry.counters.es;
      const delta = project.truthTasks - projectCounts.measurable + 1;
      projectCounts.missing += delta;
      projectCounts.measurable += delta;
      projectCounts.deviations += delta;
      entryCounts.missing += delta;
      entryCounts.measurable += delta;
      entryCounts.deviations += delta;
    }), manifest, oracle),
  },
  {
    id: 'M36',
    label: 'M36 entry-identiteitsnoemer wijkt af van projectsom',
    run: () => validateProductV2(withMutatedProduct(productV2, product => {
      product.files[firstProductLabel]!.identityCoverage.solvedTasks--;
    }), manifest, oracle),
  },
  {
    id: 'M37',
    label: 'M37 dynamische import omzeilt de statische bronallowlist',
    run: () => validateOwnSource([
      sourceRaw,
      `void ${['im', 'port'].join('')}('@/services/xer/xerReader');`,
      '',
    ].join('\n')),
  },
];

const singleMutant = process.env.OPS_XER_SINGLE_MUTANT;
if (singleMutant !== undefined) {
  const mutation = newMutationCases.find(candidate => candidate.id === singleMutant);
  if (!mutation) {
    console.error(`XX onbekende afzonderlijke mutant ${JSON.stringify(singleMutant)}; verwacht M33..M37`);
    process.exit(2);
  }
  const problems = mutation.run();
  if (problems.length === 0) {
    console.log(`XX MUTANT ${mutation.id} werd ten onrechte geaccepteerd: ${mutation.label}`);
    process.exit(0);
  }
  console.error(`MUTANT ${mutation.id} ROOD: ${mutation.label} — ${problems[0]}`);
  process.exit(1);
}

// De actuele contracten worden als drie afzonderlijke lagen gecontroleerd. Een lege foutlijst is
// de eerste groene toestand; de matrix hieronder bewijst vervolgens dat iedere bescherming bij
// één gerichte in-memory wijziging rood wordt, zonder een tracked JSON-bestand aan te raken.
{
  const currentSourceProblems = validateOwnSource(sourceRaw);
  checkPositive('bron huidige ongebundelde TS-bron is strikt corpusloos', currentSourceProblems, []);

  expectSourceRejected('bronmutant met readXER-import wordt afgewezen',
    `${sourceRaw}\nimport { readXER } from '@/services/xer/xerReader';\n`);

  const templateExpressionRequireSource = [
    sourceRaw,
    "const templateTrap = `probe ${" + ['requ', "ire('x')"].join('') + "} binnen een template-expressie`;",
    '',
  ].join('\n');
  expectSourceRejected('bronmutant met require in template-expressie wordt afgewezen', templateExpressionRequireSource);

  const multilineImportSource = [
    sourceRaw,
    'import {',
    '  readXER',
    "} from '@/services/xer/xerReader';",
    '',
  ].join('\n');
  expectSourceRejected('bronmutant met multiline import wordt afgewezen', multilineImportSource);

  const problems = validateContract(manifest, oracle, replay);
  checkPositive(`A+B+D huidige statische contracten zijn consistent (${problems.join('; ')})`, problems, []);
  checkPositive('A raw manifestbytes zijn exact gepind', rawHash(manifestRaw), EXPECTED.manifestRawSha256);
  checkPositive('B raw oraclebaselinebytes zijn exact gepind', rawHash(oracleRaw), EXPECTED.baselineRawSha256);
  const productProblems = validateProductV2(productV2Raw, manifest, oracle);
  checkPositive(`C v2-karakteriseringssnapshot is volledig maar strict zichtbaar rood (${productProblems.join('; ')})`, productProblems, []);
  console.log('INFO xer-corpusless-fidelity-gate: v2 productkarakterisering is volledig vastgepind; strict minute-exact eindnul blijft expliciet rood en ongeaccepteerd.');
}

// In-memory mutantmatrix. Elke mutatie treft één contractuitspraak; niets op schijf verandert.
{
  const firstLabel = Object.keys(manifest.files)[0]!;
  const excludedLabel = Object.entries(manifest.files)
    .find(([, entry]) => !entry.included)?.[0];
  const firstOracle = Object.keys(oracle.files)[0]!;
  const secondOracle = Object.keys(oracle.files)[1]!;
  const excludedHash = excludedLabel ? manifest.files[excludedLabel]!.sha256 : undefined;

  const removedOccurrence = clone(manifest);
  delete removedOccurrence.files[firstLabel];
  expectRejected('M1 occurrence verwijderen', removedOccurrence, oracle, replay);

  const addedOccurrence = clone(manifest);
  addedOccurrence.files['mutant-extra-occurrence.xer'] = clone(addedOccurrence.files[firstLabel]!);
  expectRejected('M2 occurrence toevoegen', addedOccurrence, oracle, replay);

  const changedSha = clone(manifest);
  changedSha.files[firstLabel]!.sha256 = `0${changedSha.files[firstLabel]!.sha256.slice(1)}`;
  expectRejected('M3 volledige SHA wijzigen', changedSha, oracle, replay);

  const changedRole = clone(manifest);
  changedRole.files[firstLabel]!.role = 'parser-fixture';
  expectRejected('M4 rol wijzigen zonder included mee te wijzigen', changedRole, oracle, replay);

  const changedIncluded = clone(manifest);
  changedIncluded.files[firstLabel]!.included = !changedIncluded.files[firstLabel]!.included;
  expectRejected('M5 included wijzigen zonder rol', changedIncluded, oracle, replay);

  const missingExclusionReason = clone(manifest);
  if (excludedLabel) delete missingExclusionReason.files[excludedLabel]!.exclusionReason;
  expectRejected('M6 uitsluitingsreden verwijderen', missingExclusionReason, oracle, replay);

  const emptyOccurrenceIdentity = clone(manifest);
  emptyOccurrenceIdentity.files[''] = emptyOccurrenceIdentity.files[firstLabel]!;
  delete emptyOccurrenceIdentity.files[firstLabel];
  expectRejected('M7 lege occurrence-identiteit', emptyOccurrenceIdentity, oracle, replay);

  const excludedOracleSource = clone(oracle);
  if (excludedHash) {
    delete excludedOracleSource.files[firstOracle];
    excludedOracleSource.files[excludedHash.slice(0, 16)] = clone(oracle.files[firstOracle]!);
  }
  expectRejected('M8 uitgesloten bron als orakel selecteren', manifest, excludedOracleSource, replay);

  const shortenedSourcePrefix = clone(oracle);
  delete shortenedSourcePrefix.files[firstOracle];
  shortenedSourcePrefix.files[firstOracle.slice(0, 15)] = clone(oracle.files[firstOracle]!);
  expectRejected('M9 bronhashprefix inkorten', manifest, shortenedSourcePrefix, replay);

  const duplicateFingerprint = clone(oracle);
  duplicateFingerprint.files[secondOracle]!.schemaFingerprint = duplicateFingerprint.files[firstOracle]!.schemaFingerprint;
  expectRejected('M10 duplicate schemafingerprint', manifest, duplicateFingerprint, replay);

  const changedFingerprint = clone(oracle);
  const originalFingerprint = changedFingerprint.files[firstOracle]!.schemaFingerprint!;
  changedFingerprint.files[firstOracle]!.schemaFingerprint = `${originalFingerprint.slice(0, -1)}${originalFingerprint.endsWith('0') ? '1' : '0'}`;
  expectRejected('M11 schemafingerprint wijzigen', manifest, changedFingerprint, replay);

  const lostSelectedKey = clone(oracle);
  delete lostSelectedKey.files[firstOracle];
  expectRejected('M12 selected keysetverlies', manifest, lostSelectedKey, replay);

  const measurableMinusOne = clone(oracle);
  measurableMinusOne.files[firstOracle]!.counters.es.measurable--;
  expectRejected('M13 measurable -1', manifest, measurableMinusOne, replay);

  const deviationOne = clone(oracle);
  deviationOne.files[firstOracle]!.counters.es.deviations = 1;
  expectRejected('M14 deviation 1', manifest, deviationOne, replay);

  const reasonAdded = clone(oracle);
  reasonAdded.files[firstOracle]!.reason = 'verboden eindpoort-pin';
  expectRejected('M15 reason toevoegen', manifest, reasonAdded, replay);

  const swappedTotals = clone(replay);
  swappedTotals.tasks = EXPECTED.tasksWithAnyMeasuredAxis;
  expectRejected('M16 13982/13959 verwisselen', manifest, oracle, swappedTotals);

  const zeroRegressed = clone(replay);
  zeroRegressed.candidates['synthetic-zero-regression']!.aggregate.es.regressed = 1;
  expectRejected('M17 replay nul kandidaat regressed 1', manifest, oracle, zeroRegressed);

  const negativeExitGreen = clone(replay);
  negativeExitGreen.candidates['drop-p6-relation-finish-boundary']!.exitCode = 0;
  expectRejected('M18 replay negatieve kandidaat exitcode 0', manifest, oracle, negativeExitGreen);

  const negativeWithoutRegression = clone(replay);
  for (const axis of AXES) {
    negativeWithoutRegression.candidates['drop-p6-relation-finish-boundary']!.aggregate[axis].regressed = 0;
  }
  expectRejected('M19 replay negatieve kandidaat zonder regressie', manifest, oracle, negativeWithoutRegression);

  const v1AsFinal = clone(productV2);
  (v1AsFinal as { version: number }).version = 1;
  expectProductRejected('M20 v1-baseline kan niet stil als finale v2 gelden', v1AsFinal, manifest, oracle);

  expectProductRejected('M21 projectnoemer vergeten', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.projects--;
  }), manifest, oracle);

  expectProductRejected('M22 een meetbare cel stil overslaan', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.projectMeasurements[0]!.counters.es.measurable--;
  }), manifest, oracle);

  expectProductRejected('M23 entry-project-taskcode-identiteit drift', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.projectMeasurements[0]!.taskCodeExact--;
  }), manifest, oracle);

  expectProductRejected('M24 productmanifesthash drift', withMutatedProduct(productV2, product => {
    product.manifestSha256 = `0${product.manifestSha256.slice(1)}`;
  }), manifest, oracle);

  expectProductRejected('M25 productschemafingerprint drift', withMutatedProduct(productV2, product => {
    const entry = product.files[firstProductLabel]!;
    entry.schemaFingerprint = `${entry.schemaFingerprint.slice(0, -1)}${entry.schemaFingerprint.endsWith('0') ? '1' : '0'}`;
  }), manifest, oracle);

  const drivingEntry = Object.values(decodeProductPayload(productV2).files)
    .find(entry => entry.drivingPath.deviations > 0);
  if (!drivingEntry) throw new Error('M26 vereist een entry met driving-path-afwijking');
  const strictZeroDrivingRed = clone(drivingEntry);
  for (const axis of PRODUCT_AXES) {
    const entryCounts = strictZeroDrivingRed.counters[axis];
    Object.assign(entryCounts, { exact: entryCounts.measurable, sameday: 0, diff: 0, missing: 0, deviations: 0 });
    for (const project of strictZeroDrivingRed.projectMeasurements) {
      const counts = project.counters[axis];
      Object.assign(counts, { exact: counts.measurable, sameday: 0, diff: 0, missing: 0, deviations: 0 });
    }
  }
  checkMutationEqual('M26 gedragsmutant: drivingPath aan zesassige gate koppelen wordt rood', {
    canonicalStrictGate: deriveStrictEntryGate(strictZeroDrivingRed),
    mutatedDrivingGate: deriveStrictEntryGate(strictZeroDrivingRed)
      && strictZeroDrivingRed.drivingPath.deviations === 0,
  }, { canonicalStrictGate: true, mutatedDrivingGate: false }, 'canonieke gate true, driving-mutant false');

  const routeInputs = {
    strictMinuteExact: 'STRICT-INVOER',
    historicalCompletedLate: 'HISTORISCH-TEGENFEIT',
    sourceDayPrecision: 'DAGPRECISIE-TEGENFEIT',
  };
  const strictRoute = selectProductReportMode('strict-minute-exact', routeInputs);
  const swappedRoute = selectProductReportMode('historical-completed-late', routeInputs);
  checkMutationEqual('M27 gedragsmutant: strict werkelijk naar tegenfeitelijke invoer routeren wordt rood', {
    canonical: [strictRoute.report, strictRoute.strictGateEligible],
    mutated: [swappedRoute.report, swappedRoute.strictGateEligible],
  }, {
    canonical: ['STRICT-INVOER', true],
    mutated: ['HISTORISCH-TEGENFEIT', false],
  }, 'strict gebruikt andere invoer en is als enige poortgeschikt');
  const swappedModes = clone(productV2);
  (swappedModes as unknown as { reportModes: string[] }).reportModes = [
    'historical-completed-late', 'strict-minute-exact', 'source-day-precision',
  ];
  expectProductRejected('M27b verwisselde runtime-modusvolgorde in envelope', swappedModes, manifest, oracle);

  expectProductRejected('M28 onbekend priveveld in entry', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel] as unknown as Record<string, unknown>).privateCustomerName = 'verboden';
  }), manifest, oracle);

  for (const forbiddenKey of ['taskName', 'taskCodes', ' reason Note ', 'acceptedDeviation'] as const) {
    expectProductRejected(`M28 privacy/beslisveld ${JSON.stringify(forbiddenKey)}`, withRawMutatedProduct(productV2, product => {
      (product.files[firstProductLabel] as unknown as Record<string, unknown>)[forbiddenKey] = 'verboden';
    }), manifest, oracle);
  }
  expectProductRejected('M28 unknown envelopekey', Object.assign(clone(productV2), { unknownEnvelopeKey: true }), manifest, oracle);
  expectProductRejected('M28 unknown payloadkey', withRawMutatedProduct(productV2, product => {
    (product as unknown as Record<string, unknown>).unknownPayloadKey = true;
  }), manifest, oracle);
  expectProductRejected('M28 unknown projectkey', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel]!.projectMeasurements[0] as unknown as Record<string, unknown>).unknownProjectKey = true;
  }), manifest, oracle);
  expectProductRejected('M28 unknown identityCoverage-key', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel]!.identityCoverage as unknown as Record<string, unknown>).unknownIdentityKey = true;
  }), manifest, oracle);
  expectProductRejected('M28 unknown tellerkey', withRawMutatedProduct(productV2, product => {
    (product.files[firstProductLabel]!.counters.es as unknown as Record<string, unknown>).unknownCountKey = 0;
  }), manifest, oracle);

  expectProductRejected('M29 projectprojecties tussen twee project-IDs migreren', withMutatedProduct(productV2, product => {
    const projects = product.files[multiProjectLabel]!.projectMeasurements;
    [projects[0]!.projectId, projects[1]!.projectId] = [projects[1]!.projectId, projects[0]!.projectId];
  }), manifest, oracle);

  const recompressedPayload = gunzipSync(Buffer.from(productV2.payloadGzipBase64, 'base64'));
  expectProductRejected('M30 pure gziprecompressie', {
    ...clone(productV2),
    payloadGzipSha256: productSha256(gzipSync(recompressedPayload, { level: 1 })),
    payloadGzipBase64: gzipSync(recompressedPayload, { level: 1 }).toString('base64'),
  }, manifest, oracle);
  const compactPayload = JSON.stringify(decodeProductPayload(productV2));
  const compactCompressed = gzipSync(Buffer.from(compactPayload, 'utf8'), { level: 9 });
  expectProductRejected('M30b compacte payloadserialisatie zonder finale newline', {
    ...clone(productV2),
    payloadSha256: productSha256(compactPayload),
    payloadGzipSha256: productSha256(compactCompressed),
    payloadGzipBase64: compactCompressed.toString('base64'),
  }, manifest, oracle);
  expectProductRejected('M30c compacte envelopeserialisatie zonder finale newline',
    JSON.stringify(productV2), manifest, oracle);

  expectProductRejected('M31 gatePassed flip', withMutatedProduct(productV2, product => {
    product.files[firstProductLabel]!.gatePassed = !product.files[firstProductLabel]!.gatePassed;
  }), manifest, oracle);

  expectProductRejected('M32 projecttelleralgebra breken met behouden entrysom', withMutatedProduct(productV2, product => {
    const projects = product.files[algebraProjectLabel]!.projectMeasurements;
    const donor = projects.find(project => project.counters.es.exact > 0);
    const receiver = projects.find(project => project !== donor && project.counters.es.diff > 0);
    if (!donor || !receiver) throw new Error('M32 vereist twee geschikte projecttellers');
    donor.counters.es.exact--;
    donor.counters.es.diff++;
    receiver.counters.es.exact++;
    receiver.counters.es.diff--;
  }), manifest, oracle);

  for (const mutation of newMutationCases) {
    const problems = mutation.run();
    mutationChecks++;
    if (problems.length === 0) diffs.push(`${mutation.label}: mutant werd ten onrechte geaccepteerd`);
    else mutationEvidence.push(`${mutation.label}: ROOD — ${problems[0]}`);
  }
}

const totalChecks = mutationChecks + positiveChecks;
if (mutationChecks !== EXPECTED_MUTANTS) {
  diffs.push(`mutantenteller: verwacht exact ${EXPECTED_MUTANTS}, kreeg ${mutationChecks}`);
}
if (positiveChecks !== EXPECTED_POSITIVE_CONTROLS) {
  diffs.push(`positieve-controles-teller: verwacht exact ${EXPECTED_POSITIVE_CONTROLS}, kreeg ${positiveChecks}`);
}
if (totalChecks !== EXPECTED_TOTAL_CHECKS) {
  diffs.push(`totale checkteller: verwacht exact ${EXPECTED_TOTAL_CHECKS}, kreeg ${totalChecks}`);
}
if (mutationEvidence.length !== mutationChecks) {
  diffs.push(`mutatiebewijs: verwacht ${mutationChecks} rode bewijzen, kreeg ${mutationEvidence.length}`);
}

if (diffs.length === 0) {
  if (process.env.OPS_XER_MUTATION_REPORT === '1') {
    for (const evidence of mutationEvidence) console.log(`MUTANT ${evidence}`);
  }
  console.log(`OK: xer-corpusless-fidelity-gate — ${mutationChecks} mutanten + ${positiveChecks} positieve controles = ${totalChecks} checks groen`);
} else {
  console.log(`XX xer-corpusless-fidelity-gate — ${diffs.length} fouten bij ${mutationChecks} mutanten + ${positiveChecks} positieve controles:`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
