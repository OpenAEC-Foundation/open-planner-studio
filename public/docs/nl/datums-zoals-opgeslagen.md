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

## Bij het openen van een ander bestandsformaat gaat deze weergave vanzelf aan

Voor elk bestand dat uit een ander pakket komt, gaat de weergave bij het openen meteen aan zodra er
verschillen zijn — je hoeft niet eerst op **Opgeslagen datums tonen** te klikken. Dat geldt voor
Primavera P6 (`.xer` en P6 XML), Microsoft Project (`.mpp` en MS Project XML), CSV en een
IFC-bestand dat niet door Open Planner Studio zelf is geschreven. De app leest uit zo'n bestand de
datums die het bronpakket zelf vastlegde — waar het bestand ze draagt ook de late datums, de speling
en het kritiek-kenmerk — en vergelijkt die met zijn eigen herberekening. Wijkt er iets af, dan zie
je de opgeslagen datums, met de openingsmelding die het aantal afwijkende taken noemt en de vaste
strook boven de planning. Wat het bestand niet vastlegde, blijft "Niet vastgelegd" (zie hieronder):
een CSV met alleen start en einde wordt op die twee assen vergeleken en toont de andere vier leeg.

Bij een `.xer`- of P6 XML-bestand zegt de strook "zoals Primavera hem opsloeg"; bij de andere
formaten "zoals ze in het bestand staan", omdat de app dan niet weet uit welk pakket de datums komen.

Sla je het project daarna op als IFC en open je dat bestand later opnieuw, dan gaat de weergave
alleen vanzelf aan zolang je het project sinds de import **niet hebt bewerkt**. Herberekenen met
**F5** en opslaan tellen daarbij niet als bewerking; een taak wijzigen, een relatie toevoegen of een
kalender aanpassen wel. Heb je bewerkt, dan wordt de weergave bij het heropenen alleen nog
aangeboden — je klikt dan zelf — zodat een planning die je intussen hebt veranderd nooit ongevraagd
weer met de oude datums uit het bronbestand op het scherm komt. De app onthoudt dat "ongewijzigd
sinds import" in het projectbestand zelf.

De taken die in deze weergave zitten, zijn ook te herkennen in de tabel — kolom **Herkomst (opgeslagen
datums)** — en met een badge in het eigenschappenpaneel van de geselecteerde taak. **F5** en het
bewerken van een taak verlaten deze weergave op precies dezelfde manier als hierboven beschreven; de
berekening zelf gebruikt de opgeslagen datums van het bronpakket nooit als invoer, alleen als
weergave. Zie [Primavera P6 (.xer) openen](docs://gids-xer-import) en
[MS Project (.mpp) openen](docs://gids-msproject-import) voor wat die imports verder meebrengen.

## "Niet vastgelegd"

Primavera legt niet voor elke activiteit alle vier de assen laatste start, laatste einde, totale
speling en vrije speling vast — een activiteit kan bijvoorbeeld wel een vroege datum hebben, maar geen
speling. Mist zo'n as in het bronbestand, dan toont de betreffende kolom in de tabel "Niet vastgelegd"
in plaats van een getal. Dat is geen foutmelding: het betekent alleen dat het bestand zelf op dat punt
niets zei, en Open Planner Studio verzint daar dus ook niets bij. Dit geldt alleen zolang je déze weergave bekijkt:
zodra de app zijn eigen berekening toont — buiten deze weergave, of na herberekenen met **F5** —
staat in die kolom gewoon het berekende getal.

Diezelfde eerlijkheid geldt buiten het scherm: exporteer je naar CSV terwijl deze weergave aanstaat,
dan blijft de cel voor een niet-vastgelegde as leeg in plaats van een `0` te tonen, en de
AI-assistent krijgt voor zo'n as `null` te zien met de opsomming van welke assen het bestand niet
vastlegde. De rapporten (het Rapport-tabblad, inclusief de PDF en het printvoorbeeld) kennen die
lege cel nog niet: daar staat voor een niet-vastgelegde as een leeg veld of een `0`. Zolang deze
weergave aanstaat, staat daarom boven elk rapport één melding die zegt dat je naar de datums uit het
bestand kijkt en waar die nullen vandaan komen.

## Verder lezen

- Meer over welke formaten je kunt importeren en wat daarbij wel en niet meekomt — lees de gids
  [Im-/export](docs://gids-import-export).
- Speling en kritiek pad in detail, inclusief wat "bepalend" precies betekent — lees de gids
  [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).
- Alles over wat een `.xer`-import meebrengt — lees de gids
  [Primavera P6 (.xer) openen](docs://gids-xer-import).
