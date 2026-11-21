// De drie manieren waarop het releasescript eindigt zonder dat de release af is.
//
//   RELEASE-STOP <code>: <reden>   exit 2  Iets ging mis of de toestand is onbekend. De release-thread geeft de
//                                          regel letterlijk door aan wrakko en volgt daarna de route bij die code.
//   RELEASE-TAAK <code>: <reden>   exit 3  Een vaste klus voor de release-thread zelf (vertalen, de browserreparatie).
//                                          Daarna start de thread het script opnieuw. Geen fout.
//   RELEASE-DROOG <stap>: <wat>    exit 0  De droogloop kwam bij zijn eerste schrijvende stap en stopte daar.
//
// Klaar is `RELEASE-KLAAR <samenvatting>` met exit 0.

export const EXIT = { klaar: 0, stop: 2, taak: 3, droog: 0 };

/** Een vaste stopcode met een korte reden. Alleen codes uit `STOPCODES` mogen. */
export class ReleaseStop extends Error {
  constructor(code, reden) {
    super(`${code}: ${reden}`);
    if (!STOPCODES.has(code)) throw new Error(`onbekende stopcode ${code}`);
    this.code = code;
    this.reden = reden;
  }
}

/** Een vaste klus voor de release-thread. Alleen codes uit `TAAKCODES` mogen. */
export class ReleaseTaak extends Error {
  constructor(code, reden) {
    super(`${code}: ${reden}`);
    if (!TAAKCODES.has(code)) throw new Error(`onbekende taakcode ${code}`);
    this.code = code;
    this.reden = reden;
  }
}

/** De droogloop stopt vóór de eerste stap die iets schrijft. */
export class DroogStop extends Error {
  constructor(stap) {
    super(stap);
    this.stap = stap;
  }
}

// Elke code staat ook in de skill, met wat de thread daarna doet.
export const STOPCODES = new Set([
  'al-actief', 'origin', 'weekendstop', 'reparatie-geblokkeerd', 'geen-tag', 'wacht-te-lang',
  'release-ontbreekt', 'release-rood', 'release-verify-rood', 'snap-mislukt', 'snap-ontbreekt',
  'aur-mislukt', 'uitlevering', 'wiki',
  'kandidaat', 'main-ci-rood', 'main-ci-ontbreekt', 'werkplek', 'inhoud-ontbreekt',
  'tekst-agent', 'tekst-grens', 'tekst-checks', 'merge-conflict', 'pr-ci-rood', 'main-beweegt',
  'cijfers', 'poort', 'onverwacht',
]);
export const TAAKCODES = new Set(['vertalen', 'browserreparatie']);

/** De laatste regel en de exitcode voor een geworpen fout of een gewone afloop. */
export function slotregel(uitkomst) {
  if (uitkomst instanceof ReleaseStop) return { regel: `RELEASE-STOP ${uitkomst.code}: ${eenRegel(uitkomst.reden)}`, exit: EXIT.stop };
  if (uitkomst instanceof ReleaseTaak) return { regel: `RELEASE-TAAK ${uitkomst.code}: ${eenRegel(uitkomst.reden)}`, exit: EXIT.taak };
  if (uitkomst instanceof DroogStop) return { regel: `RELEASE-DROOG ${eenRegel(uitkomst.stap)}`, exit: EXIT.droog };
  if (uitkomst instanceof Error) return { regel: `RELEASE-STOP onverwacht: ${eenRegel(uitkomst.message)}`, exit: EXIT.stop };
  return { regel: `RELEASE-KLAAR ${eenRegel(String(uitkomst))}`, exit: EXIT.klaar };
}

function eenRegel(tekst) {
  const vlak = String(tekst).replace(/\s+/g, ' ').trim();
  return vlak.length > 400 ? `${vlak.slice(0, 397)}...` : vlak;
}
