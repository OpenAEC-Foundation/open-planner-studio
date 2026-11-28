export class IfcSaveWorkerError extends Error {
  readonly code = 'IFC_SAVE_WORKER';
  constructor(readonly reason: 'crashed' | 'timeout' | 'transport' | 'not-started' | 'disposed', message: string) {
    super(message);
    this.name = 'IfcSaveWorkerError';
  }
}
