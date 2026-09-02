/**
 * Versie van het PUBLIEKE EXTENSIE-CONTRACT — los van de app-versie (K-item 37).
 *
 * WAAROM DIT NAAST `minAppVersion` BESTAAT. De app-versie is CalVer (`2026.8.3`): die zegt wanneer
 * een build gemaakt is, niet of het contract veranderd is. Een extensie die `minAppVersion` op
 * `2026.4.0` zet, zegt daarmee "ik heb een app van minstens april 2026 nodig" — een uitspraak over
 * FEATURES. Wat hij eigenlijk moet kunnen zeggen is "ik ben gebouwd tegen extensie-API 1.2" — een
 * uitspraak over het CONTRACT. Zonder dat onderscheid heeft een breaking change aan `ExtTask` of
 * `ExtensionApi` geen enkel signaal: de extensie laadt, roept een verdwenen methode aan en klapt
 * midden in `onLoad`, met een foutmelding die niets over de oorzaak zegt.
 *
 * DIT IS SEMVER, en de betekenis is bewust smal:
 *   MAJOR  — brekende wijziging in `ExtensionApi` of de `Ext*`-DTO's: een methode/veld verdwijnt of
 *            verandert van betekenis. Een extensie voor een andere major mag NIET draaien.
 *   MINOR  — toevoeging: nieuwe methode, nieuw optioneel veld. Een extensie voor een OUDERE minor
 *            draait prima (alles wat hij kent bestaat nog); een extensie voor een NIEUWERE minor
 *            niet, want die rekent op iets dat deze host nog niet heeft.
 *   PATCH  — geen contractwijziging (documentatie, bugfix in een mapper). Speelt geen rol in de
 *            poort; hij wordt alleen genoemd zodat het veld een echte semver blijft.
 *
 * BIJ 1.0.0 BEGINNEN en niet bij de CalVer-versie is opzet: het contract bestond al lang zonder
 * versienummer, dus 1.0.0 betekent "de vorm zoals die op het moment van invoering was". Elke
 * volgende wijziging aan `extTypes.ts`/`types.ts` hoort hier een bump te krijgen.
 */
export const EXTENSION_API_VERSION = '1.1.0';

export interface ApiCompatibility {
  ok: boolean;
  /** Gevulde, gebruikergerichte reden wanneer `ok` onwaar is. */
  reason?: string;
  /** True wanneer het manifest géén `apiVersion` declareert (van vóór K-item 37). */
  legacy?: boolean;
}

/** `1.2.3` → `[1, 2, 3]`; ontbrekende delen worden 0, onzin wordt 0. */
function parts(v: string): [number, number, number] {
  const p = v.split('.').map((n) => {
    const x = parseInt(n, 10);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  });
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
}

/** Is dit een herkenbare `major.minor[.patch]`? Alles anders behandelen we als onbruikbaar in
 *  plaats van als 0.0.0 — stil naar nul afronden zou een typefout in een manifest laten passeren
 *  als "compatibel met alles". */
function isSemver(v: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(v.trim());
}

/**
 * Mag een extensie die tegen `declared` gebouwd is op deze host draaien?
 *
 * - `undefined`/leeg ⇒ **toegestaan**, met `legacy: true`. Elk bestaand manifest in IndexedDB mist
 *   dit veld; die weigeren zou elke geïnstalleerde extensie in één update slopen. De aanroeper logt
 *   een waarschuwing zodat het zichtbaar blijft zonder te breken.
 * - Andere MAJOR ⇒ geweigerd, in beide richtingen. Een oudere major mist de brekende wijziging,
 *   een nieuwere rekent op een contract dat deze host niet heeft.
 * - Zelfde major, HOGERE minor dan de host ⇒ geweigerd: de extensie verwacht iets dat er nog niet
 *   is. Lagere of gelijke minor ⇒ toegestaan (toevoegingen zijn achterwaarts compatibel).
 * - Patch speelt geen rol.
 *
 * Pure functie zonder store-/DOM-afhankelijkheden, zodat `tests/planning/check-ext-contract.ts` de
 * hele matrix headless kan aflopen.
 */
export function checkApiCompatibility(
  declared: string | undefined,
  hostVersion: string = EXTENSION_API_VERSION,
): ApiCompatibility {
  const d = declared?.trim();
  if (!d) return { ok: true, legacy: true };
  if (!isSemver(d)) {
    return { ok: false, reason: `Ongeldige apiVersion "${declared}" — verwacht een semver als "1.0" of "1.0.0"` };
  }
  const [dMajor, dMinor] = parts(d);
  const [hMajor, hMinor] = parts(hostVersion);
  if (dMajor !== hMajor) {
    return {
      ok: false,
      reason: `Gebouwd voor extensie-API ${dMajor}.x; deze app biedt ${hMajor}.${hMinor}`,
    };
  }
  if (dMinor > hMinor) {
    return {
      ok: false,
      reason: `Vereist extensie-API ${dMajor}.${dMinor}; deze app biedt ${hMajor}.${hMinor}`,
    };
  }
  return { ok: true };
}
