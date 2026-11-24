# De voorwaartse pass is herbruikbaar zolang alleen vertraging, splits en voortgang veranderen

De nivelleerder heeft per plaatsing alleen de vroege start van één taak nodig; de achterwaartse pass en de
spelinganalyse waren daar ruim de helft van de kosten (meting 2026-09-26). `solveEarlyStarts` draait daarom alleen
de voorwaartse pass, in dezelfde serialisatie als `solve()`. `createIncrementalForwardPass` bouwt die pass één keer
en herrekent daarna, na `markChanged`, alleen de taak en wat er stroomafwaarts van afhangt, via een topologische
wachtrij tot aan de gevraagde taak. Hergebruik geldt alleen zolang graaf, kalenders, duurbronnen, ankers,
constraints en opties vaststaan: alleen vertraging, splits en voortgang van bestaande taken mogen veranderen. De
graaf, de volgorde en de projectstartvloer worden bij het bouwen één keer bepaald. Twee aanroepers gebruiken hem: de
nivelleerder (`ResourceLeveler.ts`, alleen de vroege start) en de geplande datums bij voortgang
(`src/state/progressPlannedDates.ts`, de vroege start en via `earlyDates` ook de vroege finish, voor afmelden op 100 %), die
een wijziging weigert (opnieuw bouwen) als bij een taak het anker, de geplande finish, de duurbron, het duurtype of de
duureenheid verandert. `check-leveler-differential.ts` houdt het incrementele en het volledige pad byte-gelijk.

## Gevolgen

- Beide zijn exact gelijk aan `solve()` voor elke taak die niet voltooid is en die na de voorwaartse pass niet meer
  verschuift door ALAP of een hammock. `createIncrementalForwardPass` geeft daarom `null` zodra het netwerk een
  hammock, een ALAP-taak of een taak met voortgang 100 % zonder werkelijke finish bevat; die laatste blijft actief in
  de nivelleerder, terwijl de resultaatpass haar start nog op een voltooid venster kan zetten. De voortgangsaanroeper
  weigert zo'n taak ook per wijziging.
- Bij een herrekening wist de pass alleen de forward-invoer van die ene taak: haar statusdatumvensters (C4, C5) en
  de relatiegrenzen van haar inkomende relaties. De vensters van onaangeraakte voorgangers blijven geldig.
- Een herrekende taak markeert haar opvolgers altijd, ook als haar ES en EF gelijk bleven: een voltooid P6-venster
  kan veranderen zonder dat de werkelijke datums veranderen.
- De voorwaartse pass alloceert in de nivelleerder geen spoorobjecten (ADR 0019).
