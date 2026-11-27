import type { ImportLabels, ReadImportResult } from '@/services/importTypes';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultProject } from '@/state/defaults';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { basename } from '@/utils/filePath';
import { baselineStart } from '@/types/baseline';
import { IfcxReadError } from './ifcx/ifcxErrors';
import { readIfcx } from './ifcx/ifcxReader';
import { readForeignIfcxPlanning, type ForeignIfcxPlanning } from './ifcx/foreignPlanning';
import { objectKinds } from './ifcx/foreignPlanningObjects';
import { ifcObjectSeed } from './ifcWriter';
import type { NodeKind } from './ifcx/nodes';
import { pathOfGlobalId } from './ifcx/identityPath';
import { readIfcxModelSource } from './ifcx/modelSource';
import { OWN_HEADER_ID_PREFIX } from './ifcx/profile';
import { checkValue } from './ifcx/fieldTable';
import { MODEL_SOURCE_VALUE } from './ifcx/modelReferences';
import { utf8BomLength } from './foreign/stepScanner';

function importedPaths({ paths, planning }: ForeignIfcxPlanning): Record<string, string> {
  const sourcePaths: Record<string, string> = {};
  for (const kind of Object.keys(objectKinds) as NodeKind[]) {
    for (const [id, path] of paths[kind]) {
      const guid = planning.ifcGlobalIds![ifcObjectSeed(objectKinds[kind], id)];
      if (path !== pathOfGlobalId(guid)) sourcePaths[guid] = path;
    }
  }
  return sourcePaths;
}

export async function openIfcx(bytes: Uint8Array, name: string, labels?: ImportLabels): Promise<ReadImportResult> {
  try {
    const read = readIfcx(bytes);
    const { modelSource, elementLinks, sourcePaths, baselineStarts } = read;
    return { ...read, ...(modelSource || elementLinks ? { ifcxReferences: { modelSource, elementLinks,
      ...(sourcePaths && { sourcePaths }), ...(baselineStarts && { baselineStarts }) } } : {}),
      ...(modelSource && { ownIfcxPlanBytes: Uint8Array.from(bytes) }),
      ifcxRead: { sha256: await precomputeSha256(bytes), byteLength: bytes.byteLength } };
  } catch (error) {
    if (!(error instanceof IfcxReadError) || !(error.code === 'foreign' || (error.code === 'invalid' && utf8BomLength(bytes)))) throw error;
    const model = await readIfcxModelSource(bytes);
    if (model.header.id?.startsWith(OWN_HEADER_ID_PREFIX)) throw error;
    const fileName = basename(name);
    const modelSource = { fileName, sha256: model.sha256 };
    if (checkValue(MODEL_SOURCE_VALUE, modelSource)) throw error;
    let ifcxImport: ReadImportResult['ifcxImport'];
    if (model.hasPlanning) {
      const imported = readForeignIfcxPlanning(bytes);
      const { planning, elementLinks, planningContent, leftBehind, convertedToManual, origin } = imported;
      ifcxImport = { planningContent, leftBehind, convertedToManual, origin };
      if (planningContent === 'known') {
        const sourcePaths = importedPaths(imported);
        const baselineStarts = Object.fromEntries((planning.baselines ?? []).flatMap(baseline => {
          const start = imported.baselineStarts.get(baseline.id);
          return start && !baselineStart(baseline) ? [[baseline.id, start]] : [];
        }));
        return { ...planning, ifcxImport, ifcxModel: model.elements, ifcxReferences: {
          modelSource, ...(elementLinks.size ? { elementLinks } : {}), ...(Object.keys(sourcePaths).length ? { sourcePaths } : {}),
          ...(Object.keys(baselineStarts).length ? { baselineStarts } : {}),
        } };
      }
    }
    if (!model.elements.size) throw new IfcxReadError('no-planning', ifcxImport?.leftBehind.attributes.map(item => item.attribute).join(', ') ?? '');
    const project = createDefaultProject();
    project.name = `${fileName.slice(0, -5)} - ${labels?.ifcxPlanSuffix ?? 'planning'}`;
    return { project, calendar: createDefaultCalendar(), timeModel: MINUTE_MODEL_TIME_MODEL,
      tasks: [], sequences: [], resources: [], assignments: [], ifcxReferences: { modelSource }, ifcxModel: model.elements, ifcxImport };
  }
}
