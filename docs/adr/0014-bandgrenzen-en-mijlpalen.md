# Een moment op een blokeinde blijft daar als het een eindmoment is

Een werkblok loopt van begin tot einde. Als start telt een moment in `[begin, einde)`: een start exact op het einde
van een blok hoort bij het volgende blok. Als eindmoment telt `(begin, einde]`: een finish op het blokeinde is
geldig. `snapOnOrAfter` normaliseert met de startregel en duwt een moment op het blokeinde dus altijd naar het
volgende blokbegin. Voor een start is dat goed; voor een eindmijlpaal of een moment dat al een geldige eindgrens is,
zou het een dubbele snap zijn die de relatiewiskunde (de FS-kortsluiting bij lag 0) al voorkomt. Daarom her-snapt
`snapSuccessorEarlyStart` de vroege start van een opvolger alleen waar het een start is.

## Gevolgen

- Geen her-snap voor: een kalendertijdtaak (MS Project plant die in kloktijd, ook buiten werktijd); een mijlpaal op
  het moment van haar MSO/MFO, ook een START op een blokeinde (MFO di wordt di 16:00, niet wo 07:00); een mijlpaal
  op het eindmoment van haar FNET; een opvolger die op de P6-finishgrens van haar voorganger staat (ADR 0029); en
  een nulduurmijlpaal die een eindmijlpaal is, de P6-finishgrens draagt, of zonder soort door een FF/SF-relatie of
  een FNET/MFO op precies dit moment werd gezet. Die laatste groep blijft alleen staan als het moment al een geldig
  eindmoment is (`snapOnOrBefore(d) === d`).
- Een wortelanker exact op het laatste blokeinde van zijn dag blijft rauw (`ownAnchor`, `isExactBandEnd`). Bewijs:
  in `mpxj/junit/data/timephased-prorated-cost-resource.mpp` start "No Progress - Actual Cost" in MS Project op
  2026-01-29 17:00, terwijl `snapOnOrAfter` 2026-01-30 08:00 zou geven. Een wortelanker is altijd een gelezen
  waarde, nooit een berekende; daarom geldt deze vrijheid voor elke wortel en niet alleen voor mijlpalen. Alleen het
  laatste blokeinde van de dag telt, niet een tussenliggend blokeinde zoals 12:00 op een dag 08–12/13–17: de bredere
  toets zou de hele ochtend in de duur meetellen, en het bewijs gaat alleen over het laatste blokeinde.
- In datzelfde bestand eindigen alle vier taken met dezelfde duur en kalender op hetzelfde moment, ook de taak die om
  17:00 start. MS Project telt de ankerdag dus als volledig verbruikt. Een taak met duur die op zo'n rauw blokeinde
  start, telt haar duur daarom vanaf het eerste blok van die dag; de getoonde vroege start blijft het rauwe anker.
  Een taak zonder lengte valt erbuiten (de statusdatumgevallen `msp-06`/`msp-06b`).
- De late kant spiegelt dat: landt de late start van zo'n wortel precies op het eerste blok van een dag, dan wordt
  het het laatste blokeinde van die dag, zodat LS − ES gelijk blijft aan LF − EF. Dat geldt alleen als de wortel
  haar vroege start in deze berekening echt uit `ownAnchor` kreeg (geen pin of bindende constraint); de solver geeft
  daarom de vroege start van de eigen berekening mee, niet het veld op de taak, dat nog van de vorige berekening is.
  Vastgelegd in `cases-advanced-cpm.json` (`z13-root-anchor-band-eind-speling`).
- Een wortel met een bindende constraint her-snapt ná de constraint, omdat een constraint een middernachtmoment kan
  geven terwijl de vroege finish al vanaf het blokbegin rekent. Is de constraint niet bindend, dan blijft de start
  wat `ownAnchor` gaf; de her-snap zou de blokeinde-vrijstelling ongedaan maken.
- Een losse mijlpaal zonder voorganger, of een eindmijlpaal zonder voorganger, staat onder
  `milestoneWithoutPredecessorAtDayEnd` (B6) aan het einde van haar werkdag. Een MSO of MFO wint: B6 is alleen de
  standaardplaats.
- In het dagmodel begint de late kant van een START-mijlpaal (zonder B6, of in een keten) en van een mijlpaal zonder
  soort na een FS/SS-voorganger op het begin van de laatste projectwerkdag (`usesLastProjectDayStart`), mits de
  mijlpaal zelf op het begin van haar werkdag staat. Het projecteinde is een eindmoment: op een 24-uurskalender hoort
  wo 00:00 bij dinsdag. Staat zo'n mijlpaal zelf precies op het berekende projecteinde, dan opent dat moment de
  laatste werkdag (P eindigt di 00:00, de START erna staat daar, de laatste dag is dinsdag). Het dagbegin komt uit
  de kalender van de mijlpaal: met een projecteinde di 07:00 (kalender 7–16) krijgt een mijlpaal op een kalender
  8–16 di 08:00.
