export class ScopeEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeEscapeError';
  }
}
