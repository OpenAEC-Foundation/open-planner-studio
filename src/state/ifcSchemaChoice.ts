import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { isIfcSchemaId, type IfcSchemaId, type Project } from '@/types/project';

export function applyIfcSchemaChoice(project: Project, schema: IfcSchemaId, source?: IfcSource | null): boolean {
  if (hasForeignContent(source)) return false;
  if (project.ifcSchema === schema && project.ifcSchemaUnconfirmed === undefined) return false;
  project.ifcSchema = schema;
  delete project.ifcSchemaUnconfirmed;
  return true;
}

export function splitIfcSchemaPatch(
  patch: Partial<Project>,
  current: Pick<Project, 'ifcSchema'>,
): { schema: IfcSchemaId | undefined; rest: Partial<Project> } {
  if (!('ifcSchema' in patch) && !('ifcSchemaUnconfirmed' in patch)) return { schema: undefined, rest: patch };
  const { ifcSchema, ifcSchemaUnconfirmed: _question, ...rest } = patch;
  void _question;
  return { schema: isIfcSchemaId(ifcSchema) && ifcSchema !== current.ifcSchema ? ifcSchema : undefined, rest };
}

export function withFileIfcSchema(restored: Project, live: Pick<Project, 'ifcSchema' | 'ifcSchemaUnconfirmed'>): Project {
  if (restored.ifcSchema === live.ifcSchema && restored.ifcSchemaUnconfirmed === live.ifcSchemaUnconfirmed) return restored;
  const { ifcSchema: _schema, ifcSchemaUnconfirmed: _question, ...rest } = restored;
  void _schema; void _question;
  return {
    ...rest,
    ...(live.ifcSchema !== undefined ? { ifcSchema: live.ifcSchema } : {}),
    ...(live.ifcSchemaUnconfirmed !== undefined ? { ifcSchemaUnconfirmed: live.ifcSchemaUnconfirmed } : {}),
  };
}

export function projectForIfcx(project: Project): Project {
  return withFileIfcSchema(project, { ifcSchema: project.ifcSchema });
}
