import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { isIfcSchemaId, type IfcSchemaId, type Project } from '@/types/project';

/**
 * Het IFC-schema is een eigenschap van het BESTAND, niet van de bewerkingsgeschiedenis (issue #292,
 * review #336 punt 2). Het staat op het project (`ifcSchema`, en de open schemavraag
 * `ifcSchemaUnconfirmed`) zodat het mee gaat door documentwissel, herstel en opslaan, maar:
 *
 *  - Ongedaan maken en opnieuw doen veranderen het nooit: `restoreSnapshot` (snapshot.ts) houdt het
 *    schema en de open vraag van de live state aan (`withFileIfcSchema`). Anders zette een undo naar
 *    een stand van vóór het antwoord het oude schema terug, en schreef AutoSave naar het bestand dat
 *    binnen 10 s stil weg.
 *  - Een keuze (het antwoord op de vraag bij opslaan, of een keuze in Projectinfo) is daarom geen
 *    undo-stap: `applyIfcSchemaChoice` buiten `beginUndoable`. `setProject` en `applyProjectInfo`
 *    halen het schema eerst uit hun patch (`splitIfcSchemaPatch`), zodat er geen undo-stap ontstaat
 *    die bij Ctrl+Z niets doet.
 */

/** Zet het schema van het bestand en wis de open vraag. `false` als er niets verandert. Werkt op een
 *  Immer-draft van het project. */
export function applyIfcSchemaChoice(project: Project, schema: IfcSchemaId, source?: IfcSource | null): boolean {
  if (hasForeignContent(source)) return false;
  if (project.ifcSchema === schema && project.ifcSchemaUnconfirmed === undefined) return false;
  project.ifcSchema = schema;
  delete project.ifcSchemaUnconfirmed;
  return true;
}

/** Haal het schema uit een projectpatch. `schema` is alleen gezet bij een echte keuze: een geldig
 *  schema dat verschilt van het schema van het project nu (`current`). Dezelfde waarde, `undefined` of
 *  een ongeldige waarde is geen keuze, zodat `setProject({ ...project, name })` de open vraag niet stil
 *  beantwoordt (herbeoordeling #336). `ifcSchemaUnconfirmed` gaat altijd uit `rest`: de open vraag
 *  vervalt alleen door een keuze. */
export function splitIfcSchemaPatch(
  patch: Partial<Project>,
  current: Pick<Project, 'ifcSchema'>,
): { schema: IfcSchemaId | undefined; rest: Partial<Project> } {
  if (!('ifcSchema' in patch) && !('ifcSchemaUnconfirmed' in patch)) return { schema: undefined, rest: patch };
  const { ifcSchema, ifcSchemaUnconfirmed: _question, ...rest } = patch;
  void _question;
  return { schema: isIfcSchemaId(ifcSchema) && ifcSchema !== current.ifcSchema ? ifcSchema : undefined, rest };
}

/** Het herstelde project, met het schema en de open vraag van het bestand (de live state). Hetzelfde
 *  object als er niets verschilt, zodat de snapshot en de live state blijven aliassen. */
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
