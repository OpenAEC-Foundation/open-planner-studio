// Eén bewaakte voorbereiding voor documentopslag en IFC-export (#804 fase 1c).
// Geen bestandsactie of documentcommit: alleen de documentroute legt een geslaagde opslag vast.
import { writeIFCWithChoices } from '@/services/ifc/ifcWriter';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent, type PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { spendPlanOnlyConfirmation, type PlanOnlyConfirmation, type PlanOnlyReason } from '@/services/ifc/planOnlyQuestion';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { ifcFullWriteBlocked } from './ifcForeignGuard';
import type { IFCSaveSource, IFCWriteInput } from './ifcSaveInput';

export type IfcOutput =
  | { readonly content: string; readonly literalCalendarIds: readonly string[]; readonly prepared?: never }
  | { readonly content?: never; readonly literalCalendarIds: readonly string[]; readonly prepared: PreparedIfcWrite };

export class IfcWriteBlockedError extends Error {
  readonly code = 'IFC_WRITE_BLOCKED';
  constructor() {
    super('IFC-uitvoer is geblokkeerd: bron ontbreekt, flag staat uit of alleen planning is gevraagd.');
    this.name = 'IfcWriteBlockedError';
  }
}

type GuardState = IFCSaveSource & Parameters<typeof ifcFullWriteBlocked>[0];

/** Moet deze route eerst "alleen de planning" vragen? Alleen met de flag aan. Bij een ontbrekend gebouwmodel alleen
 *  Opslaan als (besluit eigenaar, 14 november 2026); de twee exports alleen met een aanwezig gebouwmodel. */
export function planOnlyQuestionApplies(state: GuardState, reason: PlanOnlyReason): boolean {
  if (!ifcForeignContentEnabled(state.ui.featureFlags)) return false;
  const missing = state.foreignSourceMark?.sourceMissing === true;
  return reason === 'missingSourceSaveAs'
    ? missing && !hasForeignContent(state.ifcSource)
    : !missing && hasForeignContent(state.ifcSource);
}

/** De modus beslist hier, vóór I/O. planOnly met een vreemd deel of een ontbrekende bron gaat alleen door met een
 *  ongebruikt ja op de vraag voor precies deze toestand; zonder dat ja blijft hij geweigerd. */
export async function prepareIfcOutput(
  state: GuardState, input: IFCWriteInput, planOnly?: PlanOnlyConfirmation,
): Promise<IfcOutput> {
  if (planOnly) {
    if (!spendPlanOnlyConfirmation(planOnly) || input.writeMode !== 'planOnly'
      || !planOnlyQuestionApplies(state, planOnly.reason)) throw new IfcWriteBlockedError();
    return writeIFCWithChoices(input);
  }
  if (ifcFullWriteBlocked(state)) throw new IfcWriteBlockedError();
  if (!hasForeignContent(state.ifcSource)) return writeIFCWithChoices(input);
  if (input.writeMode !== 'merge') throw new IfcWriteBlockedError();
  const prepared = await prepareIfcWrite(input, state.ifcSource!);
  return { prepared, literalCalendarIds: prepared.literalCalendarIds };
}
