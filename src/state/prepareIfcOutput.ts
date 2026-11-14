// Eén bewaakte voorbereiding voor documentopslag en IFC-export (#804 fase 1c).
// Geen bestandsactie of documentcommit: alleen de documentroute legt een geslaagde opslag vast.
import { writeIFCWithChoices } from '@/services/ifc/ifcWriter';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent, type PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
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

/** De modus beslist hier, vóór I/O. planOnly met een vreemd deel blijft geweigerd tot de verliesvraag bestaat. */
export async function prepareIfcOutput(
  state: IFCSaveSource & Parameters<typeof ifcFullWriteBlocked>[0], input: IFCWriteInput,
): Promise<IfcOutput> {
  if (ifcFullWriteBlocked(state)) throw new IfcWriteBlockedError();
  if (!hasForeignContent(state.ifcSource)) return writeIFCWithChoices(input);
  if (input.writeMode !== 'merge') throw new IfcWriteBlockedError();
  const prepared = await prepareIfcWrite(input, state.ifcSource!);
  return { prepared, literalCalendarIds: prepared.literalCalendarIds };
}
