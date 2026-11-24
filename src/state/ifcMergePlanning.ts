/** Vaste heropening voor de mergecontrole: dezelfde actie als een gewoon geopend document.
 * De contextfabriek is dezelfde als voor andere scratch-documentacties, laat gekoppeld om
 * fileSlice → mergeWriter → appStoreFactory als importcyclus te voorkomen.
 */
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { RECORDED_SLOT_KEYS, type RecordedFieldKey } from '@/services/ifc/ifcTaskSlots';
import { createScratchDocumentContext } from './runtime/scratchDocument';
import { buildWriteIFCInput } from './ifcSaveInput';
import { MINUTE_MODEL_TIME_MODEL } from './migrations/minuteModel';

export function openMergePlanning(input: WriteIFCInput, side: 'uitvoer' | 'domein'): WriteIFCInput {
  // Alleen de eigen kopie mag door de laadstappen worden veranderd; nooit de invoer of een live store.
  const parsed = structuredClone(input) as ImportResult;
  if (side === 'domein') {
    // De planner werkt al in minuten. De writer draagt de projectkalender óók in de bibliotheek,
    // de lezer levert die daar niet: voorkom een tweede kalender bij ensureUniqueImportIds.
    parsed.timeModel = MINUTE_MODEL_TIME_MODEL;
    parsed.resourceCalendars = parsed.resourceCalendars?.filter(c => c.id !== parsed.project.calendarId);
    if (input.recordedSourceFormat) {
      parsed.recordedTimesOrigin = 'ifc-own';
      parsed.recordedFields = recordedFieldsWritten(input);
    }
  }
  const { store } = createScratchDocumentContext();
  store.getState().openAsDocument(parsed, { name: 'mergecontrole.ifc', ref: null });
  return structuredClone(buildWriteIFCInput(store.getState(), 'merge'));
}

function recordedFieldsWritten(input: WriteIFCInput): Record<string, RecordedFieldKey[]> {
  const out: Record<string, RecordedFieldKey[]> = {};
  for (const task of input.tasks) {
    const withheld = input.withheldTaskTimeFields?.[task.id] ?? [];
    out[task.id] = RECORDED_SLOT_KEYS.filter(key => !withheld.includes(key));
  }
  return out;
}
