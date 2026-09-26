/**
 * Gedeelde duur-omrekening voor de import-readers — net als `importDates.ts` één gedeeld primitief
 * i.p.v. losse, bijna-identieke kopieën per reader. `mspdiReader.ts` (LinkLag-lag, LagFormat-"anders"-tak) en `mppReader.ts` (taakduur uit
 * `TBkndTask` + TBkndCons-lag WORKTIME-tak) bewaren beide een ruwe waarde in TIENDEN VAN EEN MINUUT
 * en rekenen 'm om naar hele WERKDAGEN met dezelfde afronding.
 *
 * Guard: `hoursPerDay === 0` mag geen `Infinity`/`NaN` opleveren (`Math.round(hours / hoursPerDay)`)
 * bij een kapotte/lege kalender.
 *
 * De AFRONDINGSVOLGORDE (eerst tienden-van-minuut → minuten, dán delen door `perDay` en pas daarna
 * `Math.round`) is bewust gelijk aan `parseMSPDuration` — bij NIET-dyadische `hoursPerDay` (bv.
 * 7,6667 i.p.v. 8 of 4) kan een andere groeperingsvolgorde tot ±1 dag afwijken op halve-dag-grenzen (zie `tenthsOfMinutesToDays(16100, 460 / 60) === 4` hieronder/in
 * `tests/planning/check-mpp-import.ts`).
 */
export function tenthsOfMinutesToDays(tenths: number, hoursPerDay: number): number {
  const minutes = tenths / 10;
  const perDay = hoursPerDay * 60;
  return perDay > 0 ? Math.round(minutes / perDay) : 0;
}
