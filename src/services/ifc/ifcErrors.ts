/**
 * Getypeerde leesfout voor het IFC/STEP-pad.
 *
 * Zonder validatie leveren een lege string, willekeurige tekst of een afgekapt bestand stil een
 * `ImportResult` op (nul taken, of wel taken maar geen relaties): een compleet ogende planning
 * zonder melding, en de per-document `try/catch` in `useRecoveryRestore` vuurt dan nooit. Een
 * eigen klasse laat een `catch` onderscheiden tussen "geen bruikbaar IFC-bestand" en een
 * onverwachte programmeerfout.
 */
export type IfcParseErrorReason =
  /** Geen STEP-uitwisselingsbestand: de verplichte `ISO-10303-21;`-kop ontbreekt. */
  | 'not-step'
  /** Wel een STEP-kop, maar de afsluitende `END-ISO-10303-21;` ontbreekt ⇒ afgekapt/onvolledig. */
  | 'truncated'
  /** Kop én sluitmarkering aanwezig, maar er is geen `DATA;`-sectiegrens te vinden. Zonder die
   *  grens valt er niets te parsen; stil een leeg project teruggeven zou het bestand van de
   *  gebruiker onder een leeg document begraven (het pad blijft immers gekoppeld). */
  | 'no-data-section'
  /** UITSLUITEND een aanroepercontractfout: een compact (schema-2) XER-bronarchief via de lage
   *  synchrone `readIFC`-ingang, die de lazy XER-reader bewust niet laadt. Een corrupt of door andere
   *  software herschreven archief is GEEN leesfout: het project opent zonder archief en
   *  `ImportResult.xerArchiveIssue` draagt de reden (zie `readXerArchiveOrIssue` in `ifcReader.ts`). */
  | 'xer-source-archive';

export class IfcParseError extends Error {
  readonly reason: IfcParseErrorReason;

  constructor(reason: IfcParseErrorReason, message: string) {
    super(message);
    this.name = 'IfcParseError';
    this.reason = reason;
    // Zonder deze regel breekt `instanceof` zodra een bundelaar de klasse naar ES5 downlevelt
    // (de suite bundelt met esbuild, de app met Vite — beide doelen kunnen per build verschillen).
    Object.setPrototypeOf(this, IfcParseError.prototype);
  }
}
