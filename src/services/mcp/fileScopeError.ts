/** Gedeeld, platformvrij foutcontract voor een fysiek geweigerde bestandsoperatie.
 * Ook ná een geslaagde voorcontrole kan een pad wisselen; de tool moet SCOPE blijven melden. */
export class ScopeEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeEscapeError';
  }
}
