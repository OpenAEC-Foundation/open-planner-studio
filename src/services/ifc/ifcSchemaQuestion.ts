/**
 * De schemavraag bij opslaan (issue #292, besluit eigenaar 2026-10-13). De app slaat standaard op als
 * IFC4X3_ADD2. Opent de gebruiker een IFC-bestand met een ander schema in de kop, dan verandert de app
 * dat niet stil: het eerste EXPLICIETE opslaan (Opslaan, Ctrl+S, Opslaan als, ook "Opslaan" in de
 * sluitvraag) vraagt eerst of het bestand naar IFC4X3_ADD2 gaat of zijn eigen schema houdt.
 * Automatisch opslaan, crashherstel, de MCP-backup en MCP-opslaan vragen niets en veranderen niets.
 *
 * De openstaande vraag woont op het project (`Project.ifcSchemaUnconfirmed`), zodat ze meegaat door
 * documentwissel, crashherstel en undo, en via `OPS_ProjectSettings` round-tript.
 *
 * Zelfde opzet als `services/fileAccess/siteDialogs.ts`: de opslaanroute in de store STELT de vraag via
 * een injecteerbare vrager, de UI BEANTWOORDT hem (`state/ifcSchemaQuestionBridge.ts`). Zo importeert
 * `fileSlice` geen componenten en blijft elk pad headless te draaien.
 *
 * TERUGVAL ZONDER VRAGER (headless, tests): het schema van het bestand houden als de app het kan
 * schrijven, anders niet opslaan. Een ontbrekende vrager verandert zo nooit een bestandstype.
 */
import { hasForeignContent, type IfcSource } from './foreign/ifcSource';
import { DEFAULT_IFC_SCHEMA, isIfcSchemaId, type IfcSchemaId, type Project } from '@/types/project';

/** De vraag: het schema in de kop van het geopende bestand, en of de app dat schema kan schrijven. */
export interface IfcSchemaQuestion {
  /** Zoals in de kop, in hoofdletters: `IFC4`, `IFC4X3`, `IFC2X3`, … Nooit `IFC4X3_ADD2`. */
  fileSchema: string;
  /** Het schema als keuze, als de app het kan schrijven; anders `null` (bijvoorbeeld IFC2X3). */
  keep: IfcSchemaId | null;
}

/** Het antwoord: het schema waarin het document voortaan opslaat, of `null` = annuleren (niet opslaan). */
export type IfcSchemaAnswer = IfcSchemaId | null;

export type IfcSchemaAsker = (question: IfcSchemaQuestion) => Promise<IfcSchemaAnswer>;

/** Weergavenaam van een schema: de namen van de norm, in elke taal gelijk. Een schema dat de app niet
 *  schrijft, staat er zoals in de kop. */
export function ifcSchemaDisplayName(schema: string): string {
  switch (schema) {
    case 'IFC4X3_ADD2': return 'IFC 4.3 ADD2';
    case 'IFC4X3': return 'IFC 4.3';
    default: return schema;
  }
}

/** Een schemanaam uit een bestand (kop of pset) als veilige waarde: hoofdletters, alleen `A-Z0-9_`,
 *  hoogstens 40 tekens. Anders `undefined`. Zo komt er nooit vrije tekst in de vraag of de pset. */
export function cleanIfcSchemaName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const upper = raw.trim().toUpperCase();
  return /^[A-Z0-9_]{1,40}$/.test(upper) ? upper : undefined;
}

/**
 * Welke vraag staat er na het lezen van een IFC-bestand open? `headerSchema` = het schema in de kop
 * (`readFileSchemaName`); `markers` = wat `OPS_ProjectSettings` erover zegt.
 *  - `IfcSchemaUnconfirmed` (een open vraag, door automatisch opslaan of herstel bewaard) wint;
 *  - `IfcSchemaConfirmed` (de vraag is beantwoord, of er viel niets te vragen) ⇒ geen vraag;
 *  - geen van beide (een bestand van een oudere versie of een ander pakket) ⇒ een vraag als de kop iets
 *    anders zegt dan de standaard. Geen kop ⇒ geen vraag: er is geen bestandstype om te bewaren.
 */
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

/** De vraag die het eerste expliciete opslaan van dit project moet stellen, of `null`. */
export function ifcSchemaQuestionFor(project: Pick<Project, 'ifcSchemaUnconfirmed'>, source?: IfcSource | null): IfcSchemaQuestion | null {
  if (hasForeignContent(source)) return null;
  const fileSchema = cleanIfcSchemaName(project.ifcSchemaUnconfirmed);
  if (!fileSchema || fileSchema === DEFAULT_IFC_SCHEMA) return null;
  return { fileSchema, keep: isIfcSchemaId(fileSchema) ? fileSchema : null };
}

/** Mag automatisch opslaan dit document NIET naar zijn eigen bestand schrijven? Alleen als de vraag
 *  openstaat voor een schema dat de app niet kan schrijven (IFC2X3 e.d.): dan zou automatisch opslaan
 *  het bestandstype stil veranderen. Een schrijfbaar schema (IFC4, IFC4X3) blijft gewoon staan. */
export function ifcSchemaBlocksSilentWrite(project: Pick<Project, 'ifcSchemaUnconfirmed'>, source?: IfcSource | null): boolean {
  // Een vreemde bron houdt haar letterlijke kop; de gewone projectkeuze is dan geen schrijfbeperking.
  const question = ifcSchemaQuestionFor(project, source);
  return question !== null && question.keep === null;
}

/**
 * Het project zoals een EXPORT naar een nieuw bestand het schrijft (Exporteren › IFC, de export met
 * bibliotheek, `planner_export_ifc`). Een export vraagt niets. Staat de vraag open voor een schema dat de
 * app niet schrijft (IFC2X3 e.d.), dan krijgt de export de kop van de standaard; een markering
 * "IfcSchemaUnconfirmed = IFC2X3" past daar niet bij en liet het heropenen vragen naar een schema dat het
 * bestand niet heeft (review #336 punt 4). Die vraag gaat dus niet mee: de export is gewoon een
 * IFC 4.3 ADD2-bestand. Een open vraag over IFC4 of IFC 4.3 past wel bij de kop en gaat mee. Het
 * document zelf houdt zijn vraag; crashherstel en de MCP-backup schrijven het project ongewijzigd.
 */
export function projectForIfcExport<P extends Pick<Project, 'ifcSchemaUnconfirmed'>>(project: P): P {
  if (!ifcSchemaBlocksSilentWrite(project)) return project;
  const { ifcSchemaUnconfirmed: _question, ...rest } = project;
  void _question;
  return rest as P;
}

const keepWhenWritable: IfcSchemaAsker = (question) => Promise.resolve(question.keep);

let asker: IfcSchemaAsker = keepWhenWritable;

/** Installeer de vrager (de dialoog, of een override in tests). */
export function setIfcSchemaAsker(fn: IfcSchemaAsker): void {
  asker = fn;
}

/** Terug naar de terugval (houden als dat kan, anders niet opslaan). Voor tests. */
export function resetIfcSchemaAsker(): void {
  asker = keepWhenWritable;
}

/** Stel de schemavraag. */
export function askIfcSchema(question: IfcSchemaQuestion): Promise<IfcSchemaAnswer> {
  return asker(question);
}
