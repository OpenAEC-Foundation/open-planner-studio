export type PlanOnlyReason = 'missingSourceSaveAs' | 'export' | 'exportWithPool' | 'ifcxSaveAs' | 'ifcxXerArchive' | 'ifcxModelSaveAsIfc';

export type PlanOnlyAsker = (reason: PlanOnlyReason) => Promise<boolean>;

export interface PlanOnlyConfirmation { readonly reason: PlanOnlyReason }

const cancel: PlanOnlyAsker = () => Promise.resolve(false);
let asker = cancel;
const unused = new WeakSet<PlanOnlyConfirmation>();

export function setPlanOnlyAsker(fn: PlanOnlyAsker): void { asker = fn; }
export function resetPlanOnlyAsker(): void { asker = cancel; }

export async function askPlanOnly(reason: PlanOnlyReason): Promise<PlanOnlyConfirmation | null> {
  if (!(await asker(reason))) return null;
  const confirmation: PlanOnlyConfirmation = Object.freeze({ reason });
  unused.add(confirmation);
  return confirmation;
}

export function spendPlanOnlyConfirmation(confirmation: PlanOnlyConfirmation): boolean {
  return unused.delete(confirmation);
}
