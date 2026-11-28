import { hasForeignContent, type IfcSource } from './foreign/ifcSource';
import { DEFAULT_IFC_SCHEMA, isIfcSchemaId, type IfcSchemaId, type Project } from '@/types/project';

export interface IfcSchemaQuestion {
  fileSchema: string;
  keep: IfcSchemaId | null;
}

export type IfcSchemaAnswer = IfcSchemaId | null;

export type IfcSchemaAsker = (question: IfcSchemaQuestion) => Promise<IfcSchemaAnswer>;

export function ifcSchemaDisplayName(schema: string): string {
  switch (schema) {
    case 'IFC4X3_ADD2': return 'IFC 4.3 ADD2';
    case 'IFC4X3': return 'IFC 4.3';
    default: return schema;
  }
}

export function cleanIfcSchemaName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const upper = raw.trim().toUpperCase();
  return /^[A-Z0-9_]{1,40}$/.test(upper) ? upper : undefined;
}

export function ifcSchemaUnconfirmedOnRead(
  headerSchema: string | undefined,
  markers: { confirmed: boolean; unconfirmed?: string },
): string | undefined {
  const pending = cleanIfcSchemaName(markers.unconfirmed);
  if (pending) return pending === DEFAULT_IFC_SCHEMA ? undefined : pending;
  if (markers.confirmed) return undefined;
  const header = cleanIfcSchemaName(headerSchema);
  return header && header !== DEFAULT_IFC_SCHEMA ? header : undefined;
}

export function ifcSchemaQuestionFor(project: Pick<Project, 'ifcSchemaUnconfirmed'>, source?: IfcSource | null): IfcSchemaQuestion | null {
  if (hasForeignContent(source)) return null;
  const fileSchema = cleanIfcSchemaName(project.ifcSchemaUnconfirmed);
  if (!fileSchema || fileSchema === DEFAULT_IFC_SCHEMA) return null;
  return { fileSchema, keep: isIfcSchemaId(fileSchema) ? fileSchema : null };
}

export function ifcSchemaBlocksSilentWrite(project: Pick<Project, 'ifcSchemaUnconfirmed'>, source?: IfcSource | null): boolean {
  const question = ifcSchemaQuestionFor(project, source);
  return question !== null && question.keep === null;
}

export function projectForIfcExport<P extends Pick<Project, 'ifcSchemaUnconfirmed'>>(project: P): P {
  if (!ifcSchemaBlocksSilentWrite(project)) return project;
  const { ifcSchemaUnconfirmed: _question, ...rest } = project;
  void _question;
  return rest as P;
}

const keepWhenWritable: IfcSchemaAsker = (question) => Promise.resolve(question.keep);

let asker: IfcSchemaAsker = keepWhenWritable;

export function setIfcSchemaAsker(fn: IfcSchemaAsker): void {
  asker = fn;
}

export function resetIfcSchemaAsker(): void {
  asker = keepWhenWritable;
}

export function askIfcSchema(question: IfcSchemaQuestion): Promise<IfcSchemaAnswer> {
  return asker(question);
}
