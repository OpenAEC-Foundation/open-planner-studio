// "Er loopt een bewerking" — het signaal waarop Automatisch berekenen wacht.
//
// Sleepgebaren (balk, splitsen, voortgangsschuif) en tekstvelden die per toetsaanslag committeren,
// zetten `scheduleStale` telkens opnieuw. Met alleen een korte debounce draaide de CPM zodra de muis
// of de vingers even stilstonden — midden in het gebaar, zodat balken onder de muis versprongen.
// Een gebaar houdt de berekening daarom vast tot het af is; pas bij de laatste `release` mag hij.
//
// Bewust een losse bladmodule en geen store-veld: het is geen documentdata en geen UI-toestand die
// iets moet renderen, en elke store-mutatie zou de auto-calc-subscriber zelf weer wakker maken.

let holds = 0;
const listeners = new Set<() => void>();

/** Houd Automatisch berekenen vast. Roep de teruggegeven functie precies één keer aan als het
 *  gebaar klaar is (loslaten, Esc, veld verlaten); een tweede aanroep doet niets. */
export function holdAutoCalc(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) for (const listener of [...listeners]) listener();
  };
}

export function isAutoCalcHeld(): boolean {
  return holds > 0;
}

/** Wordt aangeroepen zodra de laatste hold is losgelaten. */
export function onAutoCalcReleased(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
