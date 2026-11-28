# Getallen in rapporten: Latijnse cijfers en de bidi-markering

`formatReportNumber` en `formatSignedReportNumber` (`src/utils/reportNumber.ts`) schrijven altijd Latijnse cijfers
(`-u-nu-latn` achter de taal), ook in het Perzisch en Arabisch. Zonder die toevoeging kiest `Intl` voor `fa` een ander
cijfersysteem, en dan staat "۱٫۵" naast Latijnse tellingen en percentages. Het decimaalteken volgt wel de app-taal.
`intlFormatter` bewaart de formatters per taal, omdat aanmaken veel duurder is dan hergebruik (gemeten rond 89 µs
tegen 1,2 µs per getal).

De U+200E die `Intl` in `ar` en `fa` vóór een teken zet, blijft in de tekst staan. In een alinea van rechts naar
links houdt hij het minteken links van zijn cijfer; zonder hem staat "-2" als "2-". De vector-PDF haalt de
stuurtekens weg waar ze niets meer doen (`stripBidiControls`, ADR 0384).
