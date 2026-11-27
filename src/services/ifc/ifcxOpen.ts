import type { ImportLabels, ReadImportResult } from '@/services/importTypes';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultProject } from '@/state/defaults';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { basename } from '@/utils/filePath';
import { IfcxReadError } from './ifcx/ifcxErrors';
import { readIfcx } from './ifcx/ifcxReader';
import { readIfcxModelSource } from './ifcx/modelSource';
import { OWN_HEADER_ID_PREFIX } from './ifcx/profile';
import { checkValue } from './ifcx/fieldTable';
import { MODEL_SOURCE_VALUE } from './ifcx/modelReferences';
import { utf8BomLength } from './foreign/stepScanner';

export async function openIfcx(bytes: Uint8Array, name: string, labels?: ImportLabels): Promise<ReadImportResult> {
  try {
    const read = readIfcx(bytes);
    const { modelSource, elementLinks } = read;
    return { ...read, ...(modelSource || elementLinks ? { ifcxReferences: { modelSource, elementLinks } } : {}),
      ifcxRead: { sha256: await precomputeSha256(bytes), byteLength: bytes.byteLength } };
  } catch (error) {
    if (!(error instanceof IfcxReadError) || !(error.code === 'foreign' || (error.code === 'invalid' && utf8BomLength(bytes)))) throw error;
    const model = await readIfcxModelSource(bytes);
    if (!model.elements.size || model.hasPlanning || model.header.id?.startsWith(OWN_HEADER_ID_PREFIX)) throw error;
    const fileName = basename(name);
    const modelSource = { fileName, sha256: model.sha256 };
    if (checkValue(MODEL_SOURCE_VALUE, modelSource)) throw error;
    const project = createDefaultProject();
    project.name = `${fileName.slice(0, -5)} - ${labels?.ifcxPlanSuffix ?? 'planning'}`;
    return { project, calendar: createDefaultCalendar(), timeModel: MINUTE_MODEL_TIME_MODEL,
      tasks: [], sequences: [], resources: [], assignments: [], ifcxReferences: { modelSource }, ifcxModel: model.elements };
  }
}
