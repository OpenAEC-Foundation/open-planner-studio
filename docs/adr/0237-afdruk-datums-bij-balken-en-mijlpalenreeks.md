# Datums bij de balken en de mijlpalenreeks op papier (#868)

Issue #868 bracht twee keuzes voor de Gantt-afdruk. Datums bij de balken zijn een eigen rapportoptie
(`PrintOptions.showBarDates`, standaard uit), los van de knop op het scherm (besluit Ethan 14-11-2026). Het gedrag staat
in de gids `ref-rapporttypes.md` en in `check-print-bar-dates.ts`; de datumtekst is die van de kolommen Start en Einde
(`taskOwnCellTexts`). Een ingeklapte mijlpalenreeks (`ViewRow` met `kind: 'milestones'`) staat op papier uitgeklapt,
elke mijlpaal op een eigen rij (`buildPrintRows`; besluit 14-11-2026 punt 10, bron: het weggehaalde commentaar). Voor
dat laatste vond ik geen toets.

## Gevolgen

- Met datums aan en zonder tijdvak reserveert de render een strook vóór en achter de tijdas
  (`barDateReservePx`), voor de begindatum van de vroegste en de einddatum van de laatste balk. De strook is in px, niet
  in dagen, zodat ze niet van de breedte per dag afhangt; dat houdt de wissel van *Passend maken* naar de overgenomen
  *Vaste schaal* (ADR 0234) zonder sprong in de breedte. `check-print-bar-dates.ts` (de jaarplanning) vergelijkt die
  twee breedtes, op de kalender- en de werkdagas. Is de strook samen meer dan de helft van
  de beschikbare breedte, dan vervalt hij; een datum die dan niet past, staat er niet.
- De breedte van de strook is de gemeten breedte van de kolom Start of Einde (dezelfde teksten plus celmarge, dus niet
  smaller dan de datum); zonder meting de bovengrens van die kolom.
- De einddatum staat direct achter de balk (`barEndX`), niet achter de spelingsband: daar zou hij een ander einde
  suggereren. De naam staat achter de einddatum en gaat met datums aan nooit naar links (daar staat de begindatum);
  past hij rechts niet, dan wordt hij afgekapt.
