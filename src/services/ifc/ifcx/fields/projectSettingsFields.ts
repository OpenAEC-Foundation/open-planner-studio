import type { ProgressMode, Project } from '@/types/project';
import type { RecordedSourceFormat } from '@/services/importTypes';
import { WORK_RULES } from '@/types/workRule';
import { BOOLEAN, enumOf, TEXT, type IfcxField, type IfcxValue } from '../fieldTable';
import { enumOfTable, passthroughField } from './passthroughFields';
import type { DocumentReadTarget, DocumentWriteSource } from './documentFields';

type DocumentField = IfcxField<DocumentWriteSource, DocumentReadTarget>;

const PROGRESS_MODES = { RETAINED_LOGIC: true, PROGRESS_OVERRIDE: true } satisfies Record<ProgressMode, true>;
const RECORDED_SOURCE_FORMATS = { xer: true, p6xml: true, mspdi: true, mpp: true, ifc: true } satisfies Record<RecordedSourceFormat, true>;

function projectField<K extends keyof Project>(key: K, value: IfcxValue): DocumentField {
  return passthroughField<DocumentWriteSource, DocumentReadTarget, Project[K]>(
    key, value, source => source.project[key], (target, stored) => { target.project[key] = stored; },
  );
}

export const PROJECT_SETTINGS_FIELDS: readonly DocumentField[] = [
  projectField('progressMode', enumOfTable(PROGRESS_MODES)),
  projectField('defaultWorkRule', enumOf(WORK_RULES)),
  projectField('companyId', TEXT),
  projectField('companyName', TEXT),
  projectField('p6ProjectCode', TEXT),
  projectField('dependentProjectsFolder', TEXT),
  projectField('anchorsFromOpenDocuments', BOOLEAN),
  passthroughField<DocumentWriteSource, DocumentReadTarget, RecordedSourceFormat>(
    'recordedSourceFormat', enumOfTable(RECORDED_SOURCE_FORMATS),
    source => source.recordedSourceFormat, (target, stored) => { target.recordedSourceFormat = stored; },
  ),
];

export const PROJECT_SETTINGS_KEYS_CARRIED: readonly (keyof Project)[] = [
  'progressMode', 'defaultWorkRule', 'companyId', 'companyName', 'p6ProjectCode', 'dependentProjectsFolder', 'anchorsFromOpenDocuments',
];
