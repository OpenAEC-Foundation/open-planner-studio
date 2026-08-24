/**
 * De XER-fidelity-baselinevorm (X0, XER-etappeplan §3/§6-X0). Dit bestand legt uitsluitend de
 * STRUCTUUR vast — geen meetkern, geen lezer, geen dedup-logica. Dat is allemaal X1-werk (de
 * meetlat-baan): X1 heeft de formaat-agnostische kern uit `measureFidelity` gehaald
 * (`fidelityCore.ts`), plus de onafhankelijke `xerGroundTruth.ts`, de per-project-lus en de
 * byte-hash + schema-vingerafdruk-dedup uit §2 (het Hotel-paar: twee bestanden met dezelfde
 * proj_id-set/taakcodes/orakelwaarden in net andere bytes).
 *
 * ZES ASSEN, TWEE TELLERS PER AS (§3) — anders dan de .mpp-baseline (`mpp-fidelity-baseline.json`,
 * drie emmers exact/sameday/diff per as): de XER-meetlat is uniform MINUUT-EXACT (§1-granulariteit
 * — élk orakelbestand wordt in uurmodus gelezen), dus er is geen "zelfde dag, andere kloktijd"-
 * tussencategorie zoals bij een dag-vs-uur-gemengd .mpp-corpus. Per as is het dus binair: een
 * meting wijkt af, of niet — vandaar `Deviations`/`Measurable` i.p.v. `Exact`/`Sameday`/`Diff`. De
 * assen: ES/EF/LS/LF (datums) + TF/FF (float, via de formule uit plan §1:
 * `ons_float_in_minuten === round(p6_float_uren × 60)`).
 *
 * `Measurable` bestaat APART van `Deviations` omdat de orakeldekking scheef is (planreview M1,
 * her-check-meting): na herkomstselectie en beide deduplagen zijn ES/EF/LS/LF/TF/FF respectievelijk
 * 13.935/13.941/13.833/13.825/13.677/13.322 keer meetbaar — sommige bestanden dragen alleen float
 * en geen datums, en andersom. Beide tellers worden gepind (X1): een lezer die stilletjes MINDER
 * gaat meten moet de suite even rood maken als een lezer die FOUT meet.
 */

/** De dubbele teller van één as: hoeveel taken op deze as gemeten zijn (`measurable`), en hoeveel
 *  daarvan afweken van het P6-orakel (`deviations`, per definitie `<= measurable`). */
export interface XerFidelityAxisCounts {
  deviations: number;
  measurable: number;
}

/** Alle zes assen — het "zes afwijkings- + zes meetbaar-tellers"-blok uit plan §3, met de
 *  P6-veldnamen als sleutel (dezelfde as-benamingen als in het plandocument: early/late start/
 *  finish + total/free float). */
export interface XerFidelityCounters {
  es: XerFidelityAxisCounts; // early start
  ef: XerFidelityAxisCounts; // early finish
  ls: XerFidelityAxisCounts; // late start
  lf: XerFidelityAxisCounts; // late finish
  tf: XerFidelityAxisCounts; // total float
  ff: XerFidelityAxisCounts; // free float
}

/** Één as, nul metingen — de "leeg maar welgevormd"-bouwsteen voor het harness-skelet hieronder. */
export function emptyAxisCounts(): XerFidelityAxisCounts {
  return { deviations: 0, measurable: 0 };
}

/** Alle zes assen, nul metingen. */
export function emptyCounters(): XerFidelityCounters {
  return {
    es: emptyAxisCounts(), ef: emptyAxisCounts(),
    ls: emptyAxisCounts(), lf: emptyAxisCounts(),
    tf: emptyAxisCounts(), ff: emptyAxisCounts(),
  };
}

/**
 * Eén gepind bestand. In X1 zijn `tasks`/`projects` de onafhankelijke WAARHEIDSTELLINGEN over de
 * taakdragende projecten; vanaf X4a moeten de apart gemeten adaptertellingen daar exact aan gelijk
 * zijn. Lege PROJECT-rijen blijven wel onderdeel van `schemaFingerprint`, maar niet van deze som.
 */
export interface XerFidelityBaselineEntry {
  /** Corpus is publiek (plan §4.3/§2) — een leesbaar relatief pad mag hier altijd, in
   *  tegenstelling tot `mpp-fidelity-baseline.json`'s hash-only-regime voor `OPS_MPP_CORPUS`
   *  (échte bedrijfsbestanden, die het XER-corpus niet kent). */
  label: string;
  tasks: number;
  projects: number;
  counters: XerFidelityCounters;
  /** OPTIONEEL — schema-vingerafdruk voor het §2-dedupmechanisme (het Hotel-paar-geval: geen
   *  byte-hash-duplicaat, wel dezelfde proj_id-set/taakcodes/orakelwaarden). De dedup-LOGICA zelf
   *  is X1-werk; dit veld legt alleen de PLEK in de baseline-vorm vast zodat X1 'm niet zelf hoeft
   *  te verzinnen. */
  schemaFingerprint?: string;
  /** OPTIONEEL, maar VERPLICHT zodra minstens één as een afwijking draagt (zelfde §T15-precedent
   *  als `mpp-fidelity-baseline.json`'s `reason`-veld) — een geschreven, gemeten reden, geen stille
   *  pin. De poort die dit afdwingt is X1-werk (de `hasDeviation`-analoog van `hasDiff` in
   *  `check-mpp-fidelity.ts`); dit bestand legt alleen het VELD vast. */
  reason?: string;
}

/** Sleutel = SHA-256 van de bestandsbytes (eerste 16 hex-tekens) — zelfde dedup-anker als
 *  `mpp-fidelity-baseline.json`. Byte-identieke duplicaten (§2: twee Harbour Point-bestanden 4×,
 *  drie 2×) delen zo automatisch één entry. */
export interface XerFidelityBaseline {
  files: Record<string, XerFidelityBaselineEntry>;
}

/** HET HARNESS-SKELET (X0-acceptatie): de lege, welgevormde bouwsteen blijft als schemafixture
 *  bestaan. De gecommitte `xer-fidelity-baseline.json` is sinds X1 gevuld uit het publieke corpus. */
export function createEmptyXerFidelityBaseline(): XerFidelityBaseline {
  return { files: {} };
}
