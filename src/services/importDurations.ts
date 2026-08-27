/**
 * Gedeelde duur-omrekening voor de import-readers (T7-kwaliteitsreview, M2) — spiegelt de F5-a-
 * conventie van `importDates.ts` (één gedeeld primitief i.p.v. losse, bijna-identieke kopieën per
 * reader). `mspdiReader.ts` (LinkLag-lag, LagFormat-"anders"-tak) en `mppReader.ts` (taakduur uit
 * `TBkndTask` + TBkndCons-lag WORKTIME-tak) bewaren beide een ruwe waarde in TIENDEN VAN EEN MINUUT
 * en rekenen 'm om naar hele WERKDAGEN met dezelfde afronding.
 *
 * Vóór deze samenvoeging waren dit twee losse functies: mspdiReader.ts's eigen `tenthsOfMinutesToDays`
 * had GEEN bovengrens op `hoursPerDay === 0` (`Math.round(hours / hoursPerDay)` ⇒ `Infinity`/`NaN`
 * bij een kapotte/lege kalender — hetzelfde soort lek als T7-kwaliteitsreview I2 in `mppPrimitives.
 * ts`'s `getDouble`), terwijl mppReader.ts's `durationTenthsOfMinuteToDays` die guard al had. Deze
 * gedeelde versie neemt de guard mee voor BEIDE lezers.
 *
 * T7-restpunt (N1/N2): de AFRONDINGSVOLGORDE (eerst tienden-van-minuut → minuten, dán delen door
 * `perDay` en pas daarna `Math.round`) is bewust gelijkgetrokken met `parseMSPDuration` — gemeten
 * verschil met de vroegere, los gegroeide varianten zit uitsluitend bij NIET-dyadische
 * `hoursPerDay` (bv. 7,6667 i.p.v. 8 of 4), waar een andere groeperingsvolgorde tot ±1 dag kan
 * afwijken op halve-dag-grenzen (zie `tenthsOfMinutesToDays(16100, 460 / 60) === 4` hieronder/in
 * `tests/planning/check-mpp-import.ts`).
 */
export function tenthsOfMinutesToDays(tenths: number, hoursPerDay: number): number {
  const minutes = tenths / 10;
  const perDay = hoursPerDay * 60;
  return perDay > 0 ? Math.round(minutes / perDay) : 0;
}
