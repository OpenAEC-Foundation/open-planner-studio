/**
 * Getypeerde leesfout voor het IFC/STEP-pad (bevinding K4).
 *
 * `readIFC` bevatte NUL `throw`-statements en had dus geen validatiecontract: een lege string,
 * willekeurige tekst, een JSON-bestand én een halverwege afgekapte snapshot leverden alle vier
 * gewoon een `ImportResult` op — nul taken, project "Geïmporteerd Project", startdatum vandaag.
 * Bij een op 80 % afgekapt bestand kwamen zelfs alle 10 taken terug en 0 van de 9 relaties: een
 * compleet ogende planning zónder logicanetwerk, zonder crash en zonder melding.
 *
 * Daardoor vuurde de per-document `try/catch` in `useRecoveryRestore` nooit en werd zo'n snapshot
 * na het "herstellen" ook nog eens gewist. Elke aanroeper van `readIFC` moet deze fout dus kunnen
 * zien; hij is bewust een eigen klasse zodat een `catch` het onderscheid kan maken tussen "dit is
 * geen bruikbaar IFC-bestand" en een onverwachte programmeerfout.
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
  /** Aanwezig XER-bronarchief is structureel of cryptografisch corrupt — geen legacy fallback. */
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
