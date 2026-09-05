# Datums zoals opgeslagen

Importeer je een planning uit Primavera P6 (of een ander pakket) als IFC, dan rekent Open Planner
Studio die bij het openen meteen door — normaal gedrag, en meestal onopvallend. Maar een
geëxporteerde planning bevat vaak niet alle logica die het oorspronkelijke pakket gebruikte: een
paar ontbrekende relaties zijn genoeg om de herberekende datums te laten afwijken van wat er in het
bestand stond. Deze gids legt uit hoe je dat verschil ziet, hoe je de oorspronkelijke datums terugzet,
en waar de grenzen van die weergave liggen.

## Wat je hier leert

- Waarom herberekende datums kunnen afwijken van de datums in een geïmporteerd bestand.
- De melding die verschijnt zodra dat gebeurt, en de knop **Opgeslagen datums tonen**.
- Wat er verandert zodra je de opgeslagen datums bekijkt — en wat er dan tijdelijk leeg blijft.
- Hoe je teruggaat naar de doorgerekende planning, en wat **Ctrl+Z** daarin doet.
- Wat **Opslaan** doet terwijl je de opgeslagen datums bekijkt.

## Het probleem: geïmporteerde datums die verschuiven

Een IFC-bestand bevat twee dingen: de datums van elke taak, en de logica — welke taak op welke
volgt. Bij het openen rekent Open Planner Studio altijd door op basis van die logica, ook al
stonden er al datums in het bestand. Komt een bestand uit deze app zelf, dan is dat zelden een
verrassing: de logica was compleet, dus de uitkomst klopt met wat er al stond.

Bij een export uit een ander pakket ligt dat anders. Primavera P6 (en vergelijkbare software) kan
relaties op een manier vastleggen die niet altijd volledig in IFC terechtkomt, of de export bevat
bewust niet alle logica. De app rekent dan door met wat hij wél heeft, en komt op andere datums uit
dan er in het bestand stonden. Zonder verdere uitleg zou je dan denken dat de import iets kapot
heeft gemaakt — terwijl de oorspronkelijke datums er nog steeds zijn, alleen niet meer zichtbaar.

## De melding boven de planning

Bij het openen vergelijkt de app zelf wat het bestand zei met zijn eigen herberekening.

- **Komt dat overeen** — het normale geval bij een bestand dat je zelf hebt opgeslagen — dan merk je
  niets.
- **Wijkt het af**, dan verschijnt er een balk boven de planning, bijvoorbeeld: *"Herberekening
  verschoof 47 van de 312 taken ten opzichte van de datums in het bestand."* Daarnaast staat de knop
  **Opgeslagen datums tonen**.

## Opgeslagen datums bekijken

Klik op **Opgeslagen datums tonen** en de app zet elke taak terug op de datum die in het bestand
stond. De balk verandert dan in een blijvende melding: *"Je ziet de datums zoals ze in het bestand
staan. Er is niet herberekend."* Die melding blijft staan zolang je deze weergave gebruikt, zodat je
onderweg nooit per ongeluk denkt naar een doorgerekende planning te kijken.

### Wat je niet ziet in deze weergave

Sommige informatie bestaat alleen omdat de app hem berekent — die kan niet uit het bestand komen als
hij er niet in stond. Zolang je de opgeslagen datums bekijkt, blijven deze dingen leeg:

- Welke relaties bepalend zijn voor de planning.
- Overschreden randvoorwaarden.
- Taken die uit hun logische volgorde lopen.

Speling en het kritieke pad worden wél getoond, maar alleen als het bestand die waarden zelf al
bevatte. Herbereken je, dan vult dit alles zich weer.

## Terug naar de berekening

Bewerk je een taak, of druk je op **F5**, dan rekent de app gewoon weer door en verdwijnt de
melding — je zit dan weer in de normale, doorgerekende planning. **Ctrl+Z** maakt die stap ongedaan
en brengt je terug naar de opgeslagen datums.

Werk je eenmaal verder in de doorgerekende planning, dan is er geen knop meer om op elk moment heen
en weer te schakelen: de enige manier om de oorspronkelijke datums opnieuw te zien is het bestand
opnieuw te openen.

## Opslaan

Sla je op terwijl je de opgeslagen datums bekijkt, dan schrijft de app die datums weg — niet de
doorgerekende versie. Zo overschrijf je nooit per ongeluk de planning van een collega of van het
bronpakket met een uitkomst die de app er zelf bij heeft bedacht.

## Primavera P6 (.xer): deze weergave kan vanzelf aangaan

Bij een `.xer`-bestand werkt dit net iets anders dan bij de andere formaten hierboven. Primavera P6
levert namelijk niet alleen datums, maar ook zíjn eigen berekening daarvan — geen losse datums zonder
logica. Blijven er na het openen restverschillen over met de herberekening van Open Planner Studio,
dan zet de app zichzelf meteen in deze weergave, zonder dat je eerst op **Opgeslagen datums tonen**
hoeft te klikken. De melding boven de planning noemt in dat geval meteen het aantal activiteiten dat
zou verschuiven, en verwijst naar de vaste blijvende melding zodra de weergave actief is.

De taken die in deze weergave zitten, zijn ook te herkennen in de tabel — kolom **Herkomst (opgeslagen
datums)** — en met een badge in het eigenschappenpaneel van de geselecteerde taak. **F5** en het
bewerken van een taak verlaten deze weergave op precies dezelfde manier als bij elk ander formaat (zie
hierboven); de berekening zelf gebruikt Primavera's opgeslagen datums nooit als invoer, alleen als
weergave. Zie [Primavera P6 (.xer) openen](docs://gids-xer-import) voor de rest van wat een XER-import
meebrengt.

## "Niet vastgelegd"

Primavera legt niet voor elke activiteit alle vier de assen laatste start, laatste einde, totale
speling en vrije speling vast — een activiteit kan bijvoorbeeld wel een vroege datum hebben, maar geen
speling. Mist zo'n as in het bronbestand, dan toont de betreffende kolom in de tabel "Niet vastgelegd"
in plaats van een getal. Dat is geen foutmelding: het betekent alleen dat het bestand zelf op dat punt
niets zei, en Open Planner Studio verzint daar dus ook niets bij. Zodra je herberekent (bewerken of
**F5**), vult de kolom zich met de eigen berekening van de app.

## Verder lezen

- Meer over welke formaten je kunt importeren en wat daarbij wel en niet meekomt — lees de gids
  [Im-/export](docs://gids-import-export).
- Speling en kritiek pad in detail, inclusief wat "bepalend" precies betekent — lees de gids
  [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).
- Alles over wat een `.xer`-import meebrengt — lees de gids
  [Primavera P6 (.xer) openen](docs://gids-xer-import).
