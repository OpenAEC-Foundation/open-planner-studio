# De nivelleerder gebruikt alleen de voorwaartse pass, en die stroomafwaarts

De nivelleerder heeft per plaatsing alleen de vroege start van één taak nodig. De achterwaartse pass en de
spelinganalyse waren daar ruim de helft van de kosten (meting 2026-09-26). `solveEarlyStarts` draait daarom alleen
de voorwaartse pass, in dezelfde serialisatie als `solve()`. `createIncrementalForwardPass` herrekent na een
gewijzigde vertraging, split of voortgang alleen de taak en wat er stroomafwaarts van afhangt, via een topologische
wachtrij tot aan de gevraagde taak. Beide zijn exact gelijk aan `solve()` voor elke taak die niet voltooid is en die
na de voorwaartse pass niet meer verschuift door ALAP of een hammock. `check-leveler-differential.ts` houdt het
incrementele en het volledige pad byte-gelijk.

## Gevolgen

- `createIncrementalForwardPass` weigert (geeft `null`) zodra het netwerk een hammock, een ALAP-taak of een taak met
  voortgang 100 % zonder werkelijke finish bevat. Die laatste blijft actief in de nivelleerder, terwijl de
  resultaatpass haar start nog op een voltooid venster kan zetten.
- Bij een herrekening wist de pass alleen de forward-invoer van die ene taak: haar statusdatumvensters (C4, C5) en
  de relatiegrenzen van haar inkomende relaties. De vensters van onaangeraakte voorgangers blijven geldig.
- Een herrekende taak markeert haar opvolgers altijd, ook als haar ES en EF gelijk bleven: een voltooid P6-venster
  kan veranderen zonder dat de werkelijke datums veranderen.
- De voorwaartse pass alloceert in de nivelleerder geen spoorobjecten (ADR 0019).
