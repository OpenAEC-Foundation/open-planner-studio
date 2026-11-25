export interface ForeignChangesQuestion {
  readonly count: number;
  readonly file: string | null;
}

export interface ForeignChangesAnswer {
  readonly save: boolean;
  readonly dontAskAgain: boolean;
}

export type ForeignChangesAsker = (question: ForeignChangesQuestion) => Promise<ForeignChangesAnswer>;

export const CANCEL_FOREIGN_CHANGES: ForeignChangesAnswer = Object.freeze({ save: false, dontAskAgain: false });

const cancel: ForeignChangesAsker = () => Promise.resolve(CANCEL_FOREIGN_CHANGES);
let asker = cancel;

export function setForeignChangesAsker(fn: ForeignChangesAsker): void { asker = fn; }
export function resetForeignChangesAsker(): void { asker = cancel; }

export function askForeignChanges(question: ForeignChangesQuestion): Promise<ForeignChangesAnswer> {
  return asker(question);
}
