# Het datumveld: drie vakjes in de volgorde van de Datumnotatie, gelezen per soort

Het gedeelde datumveld `DateTextInput` (`src/components/common/DateTextInput.tsx`) vervangt de datumprikker van de
browser (`input[type=date]`) en heeft een eigen kalender achter een knop (#904, ADR 0464). Het veld bestaat uit drie
vakjes, één per soort (`SegKind`: dag, maand, jaar). We kozen ervoor de volgorde als gegevens te houden:
`ORDER_BY_NOTATION` geeft per waarde van de instelling Datumnotatie (`ui.dateNotation`) de volgorde van de vakjes,
en alleen die volgorde draait mee. Het lezen gaat per soort en niet per positie: `computeSeg` zet de drie vakjes als
dag-maand-jaar achter elkaar en leest dat met `parseFlexibleDate`, dat `parsePersonalDate(raw, 'dmy')` is
(`src/utils/displayDate.ts`). Zo raakt een andere weergavevolgorde de parser niet.

## Gevolgen

- De leesregels staan in `parsePersonalDate`. Een jaar onder 100 wordt 20xx: `6-7-26` is 2026-07-06 (blok *c* van
  `tests/planning/check-date-input-commit.ts`, en de gids `howto-datum-invoeren`). Een eerste groep van vier cijfers
  leest als jaar-maand-dag; omdat het dagvakje hoogstens twee cijfers houdt, komt dat alleen via plakken voor
  (ADR 0461). Een datum die niet bestaat, zoals 31-02-2026, geeft `null`; in drie gevulde vakjes toont het veld dan
  bij het afronden een fout (ADR 0461).
- Plakken leest ook dag-maand-jaar, los van de Datumnotatie: knownbug 2500. Het weggehaalde commentaar noemde
  dag-maand-jaar de gangbare volgorde voor de Nederlandse doelgroep. Een jaar van vier cijfers onder 0100 wordt
  20xx: knownbug 2503.
- De hints in de vakjes komen uit de prop `placeholder` als de aanroeper die opgeeft, en anders uit de vertaalsleutel
  `dateInput.placeholder`. Beide horen in dag-maand-jaar-volgorde te staan (`dd-mm-jjjj`). `placeholders` splitst de
  hint op `-`, `/`, `.` en witruimte en geeft de drie delen per soort aan de vakjes, zodat de hints met de
  Datumnotatie meedraaien zonder extra sleutels. Geen aanroeper in `src/` geeft nu `placeholder` op. Levert de hint geen drie
  delen, dan blijven de vakjes zonder hint. De Hongaarse hint staat in een andere volgorde: knownbug 2502.
