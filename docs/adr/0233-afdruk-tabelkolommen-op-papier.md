# De kolommen van de taaktabel op papier

De tabel links op de Gantt-afdruk deelt de paginabreedte met de tijdas. Haar kolommen zijn daarom zo smal als de
inhoud toelaat: het Rapport-tabblad meet ze op de koppen en cellen van het rapport (regel `reports`, *Kolombreedtes
zijn gemeten, niet vast*), en de printlaag klemt elke breedte tussen een vloer en een bovengrens. Een rijnummerkolom
(`#`) is er bewust niet: de WBS-kolom zegt al waar een rij staat, en op papier gaat elke millimeter naar de tijdas
(`check-print-report.ts`, sectie 8).

## Gevolgen

- Zonder meting gelden de terugvalbreedtes uit `COL`; volgens het weggehaalde commentaar zijn die gemeten met het
  meegeleverde Inter. De bovengrens (`max`) is tweemaal de terugval: ruim genoeg voor een vertaalde kop of een diepe
  WBS-code, en een grens waardoor één uitzonderlijke waarde de tijdas niet opeet; daarboven kapt `ellipsize` af.
- De vloer van een meegeschaalde kolom is `AUTO_COLUMN_MIN_WIDTH` (30): smaller leest een kolom als een dubbele
  scheidingslijn. De curvekolom ligt tussen `CURVE_COLUMN_WIDTH_MIN` (40) en `COL.curve.w` (98); zonder meting geldt
  het maximum (`check-print-report.ts`). De naamkolom: de schuif loopt van `NAME_COLUMN_WIDTH_MIN` tot
  `NAME_COLUMN_WIDTH_MAX`, en als het paneel de kolom op de langste naam meet (afkappen uit), is `NAME_COLUMN_AUTO_MAX`
  (800) de grens, zodat een absurd lange naam de pagina niet vult.
- Elke gemeten breedte krijgt 1 px bovenop tekst en marge (`measureTaskNameColumnWidth`, `measureTableColumnWidths`,
  `measureCurveColumnWidth`), zodat afronding van subpixelbreedtes geen beletselteken uitlokt.
  `measureTaskNameColumnWidth` rekent dezelfde som als de naamcel in `drawTaskTable`; wie de ene wijzigt, wijzigt de
  andere.
- Een kolomkop mag de volle kolombreedte gebruiken, een datacel de breedte min de celmarge aan beide kanten. De marge is
  voor een kop speling: de Arabische kop van Eenh./d meet volgens het weggehaalde commentaar 44,8 px in een kolom van 45
  en hoort voluit te staan. Een datacel houdt haar marge omdat rechts uitgelijnde getallen anders tegen de lijn staan.
- De ingebouwde kolommen (`BuiltinPrintColumnKey`) houden hun tekenwijze van vóór de kolomlijst van #817, zodat de
  standaardafdruk niet veranderde. `check-report-columns.ts` (sectie 1) vergelijkt de render zonder lijst met de render
  met de standaardlijst; het legt de oude afdruk zelf niet vast. `tableColumnSlots` laat een dubbele soort of sleutel
  weg, omdat die anders twee keer in de tabelbreedte telt.
- `getColPositions` geeft als tabelbreedte de som van de ongeschaalde breedtes maal de schaal, niet de som van de
  geschaalde, zodat de tabelbreedte gelijk bleef aan die van eerdere renders. Breedte en kolomposities komen uit één
  functie (`resolveSlotWidth`), anders loopt de tabelrand los van de laatste kolom.
- De twee toewijzingskolommen van het resourcediagram vallen weg als de tabel met die kolommen minder dan
  `minChartWidthPx` voor de tijdas overlaat (een vijfde van de printbreedte, minstens 160 px); de render meldt dat met
  `assignmentColumnsDropped`. Bij hetzelfde papier hangt de regel alleen van de tabelbreedte met de kolommen af, dus een
  bredere tabel laat ze ook vallen. Een variant "alleen weglaten als de tabel zonder de kolommen wel past" liet een zone open waarin een
  tabel die de pagina al niet past haar kolommen houdt, zonder melding. Een vaste grens als 240 px gooide op A4 staand
  de kolommen al bij verse instellingen weg. Toets: `check-print-report.ts`, de gevallen bij `assignmentColumnsDropped`.
