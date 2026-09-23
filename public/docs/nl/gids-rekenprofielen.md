# Rekenprofielen

Open Planner Studio rekent met één planningsmotor, maar Primavera P6 en Microsoft Project maken op een handvol plekken een andere keuze. Een **rekenprofiel** bundelt die keuzes. Elk project heeft precies één profiel; je ziet en wijzigt het onder **Bestand → Projectinfo → Rekenprofiel en reken-opties**.

## Wat je hier leert

- Wat een rekenprofiel is en welke drie ingebouwde profielen er zijn.
- Welk profiel een geopend bestand krijgt, en waarom je daar een melding over ziet.
- Hoe je van profiel wisselt en wat er dan met je planning gebeurt.
- Hoe je een eigen profiel maakt en als sjabloon bewaart.
- Wat de vierentwintig conventies doen.
- Wanneer een combinatie geen referentiepakket heeft.

## Wat een rekenprofiel is

Een profiel is een set van vierentwintig **conventies**: regels die bij een planningspakket horen, zoals "een niet-gestarte taak schuift niet vanzelf naar de statusdatum". Daarnaast heeft elk project **reken-opties** die per bestand verschillen, zoals de lag-kalender, de kritiek-definitie en de speling-berekening. Die opties horen bij het project; het profiel levert er alleen de standaard voor bij een nieuw project.

De drie ingebouwde profielen:

- **Open Planner Studio** — de standaard voor nieuwe projecten, CSV-bestanden en IFC-bestanden uit andere programma's. Rekent zoals Open Planner Studio altijd rekende.
- **Primavera P6** — de conventies van P6. Een `.xer`-bestand opent met dit profiel.
- **Microsoft Project** — de voortgangsconventies van MS Project. Een `.mpp`-bestand opent met dit profiel.

## Welk profiel krijgt een geopend bestand?

- `.xer` (Primavera P6): **Primavera P6**. De reken-opties uit het bestand worden de reken-opties van het project.
- `.mpp` (Microsoft Project): **Microsoft Project**.
- MS Project XML en P6 XML: in deze versie **Open Planner Studio**. Voor deze formaten bestaat nog geen referentiemeting; een automatische keuze zou datums verschuiven zonder dat aantoonbaar is dat het klopt.
- CSV, een nieuw project en IFC uit een ander programma: **Open Planner Studio**.
- Een eigen IFC-bestand: het profiel dat erin is opgeslagen.
- Een IFC-bestand uit een oudere versie van Open Planner Studio, zonder opgeslagen profiel: het profiel volgt uit de opgeslagen reken-opties. Een eerder geopend `.xer`-project krijgt zo **Primavera P6**, een eerder geopend `.mpp`-project **Microsoft Project**, al het andere **Open Planner Studio**.

Open je een `.xer`- of `.mpp`-bestand, dan zie je één melding, bijvoorbeeld "Dit project rekent als Primavera P6". De knop in die melding opent Projectinfo. Bij een `.xer`-bestand staat die regel in de gewone openingsmelding, ook als het bestand meerdere projecten bevat. Bij het heropenen van een eigen IFC-bestand en bij crashherstel komt die melding niet: het profiel stond er al, en je hebt het zelf gekozen of gezien.

## Van profiel wisselen

Kies in **Projectinfo** een ander profiel en klik op **Toepassen**. De planning wordt meteen opnieuw berekend, ook als *Automatisch berekenen* uit staat. Verschuiven daardoor taken, dan vertelt een melding hoeveel; verschuift er niets, dan komt er geen melding. De telling gaat over gewone taken, niet over samenvattingstaken (die volgen hun onderliggende taken). Een wissel is één stap in *Ongedaan maken*.

Sommige waarden kwamen uit het bestand zelf, zoals de P6-instelling voor het begin van het restwerk. Die blijven bij elke wissel staan, ook als je een eigen profiel of een sjabloon kiest. Daarom kan in de keuzelijst "Primavera P6 (aangepast)" staan: dat is geen eigen profiel, maar het ingebouwde profiel met waarden uit je bestand.

Wissel je tussen de ingebouwde profielen, dan blijven alle afwijkingen letterlijk staan, ook een afwijking die onder het nieuwe profiel toevallig gelijk is aan de standaard. Zo geeft Primavera P6 → Open Planner Studio → Primavera P6 precies het profiel terug waarmee je begon.

De reken-opties van het project veranderen bij een wissel niet. Wil je de standaardopties van het nieuwe profiel, klik dan op **Standaardopties van dit profiel toepassen**.

Let op bij een wissel naar Primavera P6 voor een project dat niet uit P6 komt: de conventie *Geplande start als extra ondergrens* maakt de geplande start van een taak tot ondergrens zodra die meer dan een kalenderdag later ligt dan het netwerk toelaat.

## Een eigen profiel maken

Zet in het blok een conventie aan of uit. Is het profiel ingebouwd, dan maakt Open Planner Studio er automatisch een eigen kopie van, bijvoorbeeld "Kopie van Primavera P6". Die naam kun je aanpassen. Kies je een sjabloon voor een project uit een `.xer`-bestand, dan houdt het project de waarde uit het bestand voor het begin van het restwerk; die telt niet als afwijking van het sjabloon.

Met **Opslaan als sjabloon** bewaar je het eigen profiel in de app, zodat je het in andere projecten kunt kiezen. Een project bewaart altijd een eigen kopie van zijn profiel: een sjabloon later wijzigen verandert geen bestaand project. Wijkt het profiel van een project af van zijn sjabloon, dan zie je dat in een gekleurd blok, met de knoppen **Bijwerken vanuit sjabloon** en **Sjabloon bijwerken vanuit dit project**. Met **Sjabloon verwijderen** haal je het sjabloon weer uit de app; het project houdt zijn eigen kopie.

## De vierentwintig conventies

Onder Open Planner Studio staan ze alle vierentwintig uit.

- **Actuele datums behouden in de terugwaartse berekening** (Primavera P6) — een gestarte of voltooide taak houdt haar geregistreerde datums ook aan de late kant.
- **Vrije speling nooit negatief** (Primavera P6) — bij een onhaalbare late constraint blijft de totale speling negatief, maar wordt de vrije speling nul.
- **Mijlpaal volgt de geplande kalendergrens** (Primavera P6) — een mijlpaal zonder duur blijft op de kalendergrens die het bestand plande.
- **Geplande start als extra ondergrens** (Primavera P6) — zie de waarschuwing hierboven.
- **Eindmijlpaal als grensvenster** (Primavera P6) — een eindmijlpaal mag op twee aangrenzende kalendergrenzen staan.
- **Actuele datums exact overnemen** (Primavera P6) — geregistreerde actuele datums worden niet naar een werktijdband verschoven.
- **Lopende taak: vroege start = begin van het restwerk** (per bestand uit Primavera P6) — de vroege start van een lopende taak is waar het resterende werk begint. Terugrekenend over een start-start-relatie telt alleen haar restduur: zonder restwerk vallen late start en late finish samen.
- **Constraintmoment op een mijlpaal exact** (Primavera P6) — een datum-en-tijdconstraint op een mijlpaal is een exact punt.
- **Restwerk hervat na de al verstreken duur** (Microsoft Project) — een lopende taak hervat op de actuele start plus de al verstreken duur.
- **Niet-gestarte taken niet naar de statusdatum** (Microsoft Project) — een taak die nog niet begonnen is, schuift niet vanzelf naar de statusdatum.
- **Opvolger start op de finishgrens** (Primavera P6) — bij relaties die het bestand zo markeert. Terugrekenend toont de opvolger haar late start gewoon als begin van een werkband.
- **Lag terugrekenen vanaf een finishgrens** (Primavera P6) — een lag die precies op een bandstart uitkomt, landt op de vorige finishgrens. Ook bij een einde-einde-relatie zonder lag blijft een late finish op een bandeinde die finishgrens.
- **Voltooide taak in het statusdatumvenster** (Primavera P6) — alleen voor taken met P6-herkomst.
- **Voltooide LOE via het actuele einde** (Primavera P6) — alleen voor taken met P6-herkomst.
- **Niet-gestarte LOE neemt het doelvenster** (Primavera P6) — alleen voor taken met P6-herkomst.
- **Vrije speling in de eigen kalender** (Primavera P6) — de vrije speling van een open taak over een eind-start-relatie zonder lag telt in de kalender van de taak zelf, niet in die van de opvolger. Dit geldt alleen voor planningen in uren.
- **Verstreken lag van een voltooide voorganger telt niet** (Primavera P6) — van de lag na een voltooide taak telt alleen het deel dat op de statusdatum nog niet verstreken is. Dat geldt aan de late kant, en ook vooruit: staat een voltooide taak op de statusdatum (of direct na een voorganger die nog niet klaar is), dan begint haar opvolger na de rest van de lag. Uitzetten verslechtert in de gemeten Primavera P6-bestanden 640 datums en floats die nu exact kloppen, en 56 die al afweken wijken verder af.
- **Voltooide fysieke-voortgangstaak staat op de statusdatum** (Primavera P6) — een voltooide taak met een fysiek voortgangspercentage staat niet op haar werkelijke datums, maar als één punt op de statusdatum, of later als een voorganger die nog loopt of nog moet beginnen dat eist. Haar opvolgers rekenen vanaf dat punt.
- **Verstreken SS-lag uit een lopende voorganger telt niet** (Primavera P6) — bij een start-start-relatie uit een taak die al gestart is, telt van de lag alleen het deel dat sinds haar werkelijke start op de statusdatum nog niet verstreken is. Is de lag al verstreken, dan mag de opvolger beginnen zodra het restwerk van de voorganger begint.
- **Eind-eind-relatie naar een startmijlpaal bindt aan de mijlpaal zelf** (Primavera P6) — bij een eind-eind-relatie naar een startmijlpaal mag de voorganger uitlopen tot de mijlpaal zelf, niet alleen tot het begin van de mijlpaaldag. Dat verandert de late datums en de speling van die voorganger. Een eindmijlpaal verandert niet.
- **Geplande start is geen vloer voor een lopende taak** (Primavera P6) — het resterende werk van een gestarte taak begint op de statusdatum en direct na haar voorgangers, ook als haar geplande start later ligt. Haar opvolgers schuiven mee. Voor een taak die nog niet gestart is, blijft de geplande start een ondergrens (*Geplande start als extra ondergrens*).
- **Late finish op de eigen kalender** (Primavera P6) — legt een opvolger een late finish op die buiten de werktijd van de taak zelf valt (meestal omdat die opvolger op een andere kalender rekent), dan wordt de late finish het einde van de vorige werkperiode op de eigen kalender. Voorbeeld: een taak werkt niet op vrijdag en haar opvolger moet vrijdag 16:00 starten; dan is haar late finish donderdag 17:00.

### Standaard uit in elk profiel

Twee conventies staan in elk ingebouwd profiel uit, ook onder Primavera P6. Ze zijn afgeleid uit een bestand dat niet door P6 is doorgerekend (uitvoer van het oudere Primavera P3) en veranderen niets in de bestanden die wel aantoonbaar door P6 zijn doorgerekend. Wil je ze toch gebruiken, zet ze dan aan in een eigen profiel.

- **Voltooide voorganger houdt niet vast na de statusdatum** (standaard uit) — staat het werkelijke einde van een voltooide taak ná de statusdatum, dan mogen haar opvolgers toch al op de statusdatum beginnen. De eigen datums van de voltooide taak veranderen niet.
- **Voltooide taak buiten volgorde wacht op haar voorgangers** (standaard uit) — is een taak al voltooid terwijl een voorganger nog loopt of nog moet beginnen, dan staat ze niet op de statusdatum maar direct ná die voorganger, en haar opvolgers schuiven mee. Onder de P6-instelling Progress Override geldt dit niet.

## Combinaties zonder referentiepakket

Een deel van de P6-conventies werkt alleen op taken met P6-herkomst, dus uit een `.xer`-bestand. Kies je Primavera P6 voor een eigen project, een `.mpp`-bestand of een P6 XML-bestand, dan gaan die regels niet aan. Een `.xer`-project onder het profiel Microsoft Project is eveneens een combinatie waarvoor geen referentiepakket bestaat. Zulke combinaties rekenen consistent, maar er is geen pakket om de uitkomst tegen te controleren.

## Opslaan en uitwisselen

Het profiel wordt in het IFC-bestand opgeslagen, met alle vierentwintig waarden, zodat het bestand overal hetzelfde rekent. Een project met het standaardprofiel slaat niets extra's op. Oudere versies van Open Planner Studio kennen het profiel niet: zij lezen alleen de reken-opties en de twee voortgangsconventies van Microsoft Project, en rekenen een P6-project zonder P6-conventies.

Bij exporteren naar CSV, MS Project XML of P6 XML gaat het profiel niet mee; die bestanden openen weer als Open Planner Studio. Voor een project uit een `.xer`-bestand meldt de export dat er XER-broninformatie verloren gaat; het rekenprofiel hoort daarbij, maar de melding noemt het niet apart.

## Verder lezen

- [Primavera P6 (.xer) openen](docs://gids-xer-import)
- [MS Project (.mpp) openen](docs://gids-msproject-import)
- [Im-/export](docs://gids-import-export)
