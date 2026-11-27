# Getallen in rapporten: Latijnse cijfers en de bidi-markering

Getallen in rapporten en in de duurteksten van de schermen komen uit `formatReportNumber` en
`formatSignedReportNumber` (`src/utils/reportNumber.ts`). Die schrijven altijd Latijnse cijfers (`-u-nu-latn`
achter de taal), ook in het Perzisch en Arabisch. Datums, tellingen en percentages in dezelfde rapporten zijn
Latijns; zonder die toevoeging kiest `Intl` voor `fa` een ander cijfersysteem, en dan staat "۱٫۵" naast "3" en "75%".
Het decimaalteken volgt wel de app-taal.

De U+200E die `Intl` in `ar` en `fa` vóór een teken zet, blijft in de tekst staan. In een alinea van rechts naar
links houdt hij het minteken links van zijn cijfer; zonder hem staat "-2" als "2-". De vector-PDF haalt de
stuurtekens pas bij het tekenen weg, waar ze niets meer doen (`stripBidiControls`, ADR 0384).
