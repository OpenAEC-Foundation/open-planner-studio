/**
 * `ifcSource`: waar de IFC-bron woont (#804, ontwerp "Gebouwmodel behouden" §4.8). Een bladmodule met alleen het type
 * en twee kleine vragen, zodat store, documentcontract en meldingen het kunnen lezen zonder de scanner te laden.
 *
 * Fase 1a vult het veld alleen via de bytes-route (`ifcBytesRoute.ts`, achter de flag `ifcForeignContent`). Nog niet in
 * fase 1a (fase 2): `sourceSlots`, `jsonExtras`, `unusedKeys`, `idExceptions`, herkomstmerken, `elementLinks`,
 * `detached`, de wijzigingstijd op het doel en het manifest 6.
 *
 * De bronbytes blijven buiten undo (documentcontract, `snapshot: 'none'`), buiten de herstelsnapshot
 * (`recoverySnapshotInput` neemt alleen `IFC_SAVE_KEYS`) en buiten de MCP-backup (die schrijft
 * `writeIFC(buildWriteIFCInput(…))`, zonder dit veld). `check-ifc-foreign-open.ts` eist dat. Dat geldt ook voor
 * `opened` (vervolg-PR van #867): een verwijzing naar het domein van het document zoals het na openen was.
 */
import type { WriteIFCInput } from '../ifcWriter';

export interface IfcSource {
  /** De bronbytes zoals gelezen. Nooit wijzigen: sha256, stukgrenzen en klassen horen erbij. */
  readonly bytes: Uint8Array;
  /** SHA-256 van `bytes`, als hex. */
  readonly sha256: string;
  /** De schemanaam uit de kop, zoals hij er staat (ook `IFC4X3_ADD1` of `IFC4X3_TC1`, §4.11). */
  readonly schemaName: string;
  /** Eerste byte van elk stuk (§4.1), met de lengte van de bron als laatste waarde: `count + 1` waarden. */
  readonly chunkStarts: Uint32Array;
  /** Het `#id` van elk stuk; -1 voor kop, `DATA;` en staart. */
  readonly chunkIds: Int32Array;
  /** Klasse per stuk (`classify.ts`): 0 = geen entiteit, 1 = P, 2 = C, 3 = A, 4 = V. */
  readonly classes: Uint8Array;
  /** Kaart domein-id → bron-`#id` (§4.3), gesleuteld op `ifcObjectSeed(soort, id)`: `task`, `res`, `seq`, `cal`
   *  (`cal:cal-default` is de projectkalender), en `proj`, `wp` en `ws` met het project-id. */
  readonly stepIds: Readonly<Record<string, number>>;
  /** Properties in een eigen pset (of property-templates in een eigen template) die de lezer niet leest (stukken). */
  readonly foreignMembers: readonly number[];
  /** Is er een vreemd deel: een entiteit die niet P is (§3)? */
  readonly foreign: boolean;
  /** Aantal entiteiten dat niet P is (C, A en V), voor de melding van §4.15. */
  readonly foreignObjectCount: number;
  /** Regeleinde van de bron. */
  readonly lineEnding: '\r\n' | '\n';
  /**
   * Het domein zoals de app het na het openen liet zien, in de vorm van de writer (`buildWriteIFCInput`): na de lezer,
   * de omzetting naar het minutenmodel en de herberekening bij openen (knownbug 1105). De store zet het bij het openen
   * van een bron met een vreemd deel (`applyLoadedProject`). De merge leest er af wat de planner wijzigde: een veld dat
   * gelijk is aan `opened`, wijzigde hij niet, ook als de omzetting het anders maakte dan de lezing van de bron
   * (`sourceForm.ts`). Ontbreekt het (de bytes-route zonder store), dan is de lezing van de bron wat de app liet zien.
   * Het zijn dezelfde objecten als in het document (geen kopie); ze veranderen niet, want de store is onveranderlijk.
   */
  readonly opened?: WriteIFCInput;
}

/** Heeft dit document een vreemd deel? Zonder bron (nieuw document, ander formaat, flag uit): nee. */
export function hasForeignContent(source: IfcSource | null | undefined): boolean {
  return source?.foreign === true;
}
