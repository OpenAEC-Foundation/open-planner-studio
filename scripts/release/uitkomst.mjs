export const EXIT = { klaar: 0, stop: 2, taak: 3, droog: 0 };

export class ReleaseStop extends Error {
  constructor(code, reden) {
    super(`${code}: ${reden}`);
    if (!STOPCODES.has(code)) throw new Error(`onbekende stopcode ${code}`);
    this.code = code;
    this.reden = reden;
  }
}

export class ReleaseTaak extends Error {
  constructor(code, reden) {
    super(`${code}: ${reden}`);
    if (!TAAKCODES.has(code)) throw new Error(`onbekende taakcode ${code}`);
    this.code = code;
    this.reden = reden;
  }
}

export class DroogStop extends Error {
  constructor(stap) {
    super(stap);
    this.stap = stap;
  }
}

export const STOPCODES = new Set([
  'al-actief', 'origin', 'weekendstop', 'reparatie-geblokkeerd', 'geen-tag', 'wacht-te-lang',
  'release-ontbreekt', 'release-rood', 'release-verify-rood', 'snap-mislukt', 'snap-ontbreekt',
  'uitlevering', 'wiki',
  'kandidaat', 'main-ci-rood', 'main-ci-ontbreekt', 'werkplek', 'inhoud-ontbreekt',
  'tekst-agent', 'tekst-grens', 'tekst-checks', 'merge-conflict', 'pr-ci-rood', 'main-beweegt',
  'cijfers', 'poort', 'onverwacht',
]);
export const TAAKCODES = new Set(['vertalen', 'browserreparatie']);

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
