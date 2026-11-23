// De fout van de opslagworker (#804 stap 4) in een eigen module: de opslagroutes van de store herkennen hem
// (`prepareAppIfcWrite` in `fileSlice.ts`, stap 5) zonder de client met zijn `new Worker(…)` te importeren.

/** De worker faalde nadat hij startte, de worker van een merge startte niet terwijl er in de sessie al eens een startte
 *  (`not-started`, knownbug 1936), of de opslag werd gestopt. Geen inhoudelijke fout en geen terugval. */
export class IfcSaveWorkerError extends Error {
  readonly code = 'IFC_SAVE_WORKER';
  constructor(readonly reason: 'crashed' | 'timeout' | 'transport' | 'not-started' | 'disposed', message: string) {
    super(message);
    this.name = 'IfcSaveWorkerError';
  }
}
