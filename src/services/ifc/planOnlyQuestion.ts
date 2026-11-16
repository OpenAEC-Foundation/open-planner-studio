// De vraag "alleen de planning" (#804): het nieuwe IFC-bestand bevat dan alleen de planning, zonder gebouwmodel en
// zonder de gegevens van een ander programma. Eén vraag met een reden; de dialoog kiest de tekst per reden.
// Zonder UI of zonder uitdrukkelijk ja wordt niets geschreven.

/** Waarom alleen de planning: Opslaan als bij een ontbrekend gebouwmodel (PR 9e), Exporteren → IFC zonder gebouwmodel,
 *  of Exporteren → IFC met de resourcebibliotheek (PR 13). */
export type PlanOnlyReason = 'missingSourceSaveAs' | 'export' | 'exportWithPool';

export type PlanOnlyAsker = (reason: PlanOnlyReason) => Promise<boolean>;

/** Een ja op de vraag. Alleen `askPlanOnly` maakt er een, en `prepareIfcOutput` laat hem één keer gelden. */
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

/** `true` als dit een ongebruikt ja van `askPlanOnly` was; daarna geldt het niet meer. */
export function spendPlanOnlyConfirmation(confirmation: PlanOnlyConfirmation): boolean {
  return unused.delete(confirmation);
}
