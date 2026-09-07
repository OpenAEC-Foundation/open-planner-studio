# Primavera P6 (.xer) openen

Een `.xer`-bestand is het uitwisselingsformaat van Primavera P6. Open Planner Studio kan zo'n bestand rechtstreeks openen; een tussenstap via P6 XML of een externe omzetter is niet nodig. Deze gids legt uit wat de import doet, welke gegevens bewaard blijven en waar de grenzen van het huidige P6-model liggen.

## Wat je hier leert

- Hoe één XER-bestand meerdere projectdocumenten kan openen.
- Hoe huidige projecten, lege projecten en baselineprojecten worden behandeld.
- Welke kalender-, resource-, voortgangs- en metadata-informatie wordt ingelezen.
- Hoe tekencodering en de P6-getalnotatie veilig worden bepaald.
- Wat er gebeurt als de herberekening afwijkt van de datums die Primavera zelf al had opgeslagen.
- Wat opslaan als IFC betekent en welke P6-functies nog geen eigen rekenmodel hebben.

## Openen en documenten

Open een `.xer`-bestand via **Bestand → Openen** of **Ctrl+O**. Eén export kan meerdere P6-projecten bevatten. Open Planner Studio opent ieder niet-leeg huidig project als een afzonderlijk document; het document met de meeste activiteiten wordt actief. Lege projecten krijgen geen zinloos tabblad.

Na één bestandsactie verschijnt één informatieve melding, ook wanneer er veel documenten openen. Die melding noemt de werkelijk gevonden en geopende projecten, lege projecten, baselines en eventuele terugvallen. Bij een volgende XER-bestandsactie krijg je opnieuw één eigen melding.

Een P6-baselineproject wordt niet als los, planbaar document geopend. Als het bij een geopend huidig project hoort, wordt het als baseline bij dat document bewaard. Een verwijzing naar een baseline die niet in het bestand staat wordt niet verzonnen: die blijft buiten de baselineverzameling en wordt in de melding geteld. Een zelfverwijzing, een kring van baselineverwijzingen of een selectie die anders geen enkel document zou openen, schakelt de uitsluiting veilig terug: de betrokken projecten openen dan gewoon als huidige documenten. Dat beschermt je tegen een stil leeg scherm en maakt de terugval zichtbaar.

Relaties tussen twee verschillende P6-projecten worden als externe bronlinks bewaard. De app rekent ze niet door als gewone relaties, omdat elk geopend document een zelfstandige planning is.

## Wat er uit P6 meekomt

De import leest onder meer:

- **Projecten, WBS, activiteiten en mijlpalen**, inclusief P6-activiteits- en duurtypen.
- **Relaties, lags, constraints, voortgang en actuals**, plus P6-suspend/resume-datums waar ze in het bronbestand staan.
- **Project- en resourcekalenders**, werktijden en uitzonderingen. Uren en kloktijden blijven daarbij gegevens van de kalender in plaats van een projectbrede gok.
- **Resources, tarieven en toewijzingen**.
- **Activity codes, UDF's en notities**, inclusief hun bronstructuur en koppelingen aan activiteiten.

Eén kalenderregel verdient een aparte vermelding. Sommige P6-exports klemmen een aaneengesloten vrij blok op de ma–vr-as: een vrije zaterdag staat dan als dubbel record op de vrijdag ervóór, een vrije zondag op de maandag erná. Ziet de lezer dat patroon op een kalender die op zaterdag of zondag wél werkt, dan maakt hij die weekenddag alsnog vrij. Zo'n gereconstrueerde dag staat niet als record in het bestand; hij heet in de kalender "Calendar exception (weekend reconstruction)" en telt mee in de kalenderbevindingen van de openingsmelding, zodat je altijd kunt zien dát de app hier iets heeft afgeleid. De regel is afgeleid uit één bestand en slaat alleen aan bij een meerdaags blok met bewijs op het record zelf; op een gewone ma–vr-kalender verandert er niets.

De rauwe P6-brongegevens die Open Planner Studio leest, blijven onderdeel van het document. Ze reizen mee door tabwissels, undo, herstel en opslaan. Dat is iets anders dan beloven dat iedere P6-functie al een gelijkwaardig bewerk- of rekenmodel heeft: waar zo'n motor ontbreekt, bewaren we de brondata in plaats van haar stil weg te gooien.

## Voltooide activiteiten krijgen echte speling

Primavera zet een voltooide activiteit voor zijn hele berekening neer als een taak met nul restwerk op de statusdatum — ook aan de late kant. Open Planner Studio doet dat sinds september 2026 na, maar uitsluitend voor projecten die uit een `.xer`-bestand komen. Gevolg: een voltooide activiteit toont voortaan een echte totale speling in plaats van altijd nul, en ze legt net als elke andere taak druk op haar eigen voorgangers. Dat is geen wijziging van je gegevens: de werkelijke start- en einddatums blijven staan zoals ze in het bestand stonden.

De regel geldt alleen waar het bronbestand hem ondersteunt: activiteiten van het type "vaste duur en eenheden" met een voortgangspercentage op duurbasis, een vastgelegd geplande venster, en een project dat resterend werk aan het plan koppelt. Verklaart het bestand bovendien dat het met *progress override* gerekend is in plaats van *retained logic*, dan blijft het oude gedrag staan. Projecten uit IFC, MS Project of Primavera P6 XML veranderen niet.

## Tekencodering en getallen

XER noemt zijn tekencodering niet betrouwbaar in het bestand. Een UTF-BOM wordt gevolgd; zonder BOM gebruikt de lezer geldige UTF-8 en valt hij anders terug op Windows-1252. Is zo'n niet-ASCII-keuze nodig, dan staat de gebruikte codering in de openingsmelding. De app probeert geen regels te raden of als "overgeslagen" voor te stellen.

P6 kan de decimaal- en duizendtallenscheiding in de `CURRTYPE`-tabel vastleggen, zowel als letterlijk teken als met symbolische tokens zoals `ds_Period` en `dg_Comma`. Die notatie wordt gelezen vóór duren, werk en float worden omgezet. Ontbreekt `CURRTYPE`, dan is punt de veilige standaard. Lijkt een waarde een komma-decimaal terwijl die broninformatie ontbreekt, dan stopt de import met een gerichte fout in plaats van een mogelijk verkeerd schema te openen.

## Datums zoals Primavera ze opsloeg

Open Planner Studio herberekent een geopende planning altijd zelf — ook een `.xer`-bestand. Op de
meeste bestanden komt die herberekening exact overeen met wat Primavera zelf had opgeslagen. Blijven
er verschillen over, dan zet de app zichzelf bij het openen automatisch in de weergave **datums zoals
opgeslagen**: je ziet dan Primavera's eigen resultaat op het scherm, niet onze herberekening. Dat is
een andere volgorde dan bij andere formaten — daar biedt de app deze weergave alleen aan via een knop;
bij een `.xer`-bestand met restverschillen staat hij meteen aan, omdat het bestand een betrouwbare,
eigen berekening meebrengt in plaats van alleen datums zonder rekenlogica.

Bij het openen verschijnt dezelfde ene melding als hierboven, aangevuld met het aantal activiteiten
waarvan een herberekening de datums zou verschuiven. Taken die in deze weergave zitten, zijn herkenbaar
in de tabel — kolom **Herkomst (opgeslagen datums)** — en in het eigenschappenpaneel van de
geselecteerde taak. Ontbreekt voor een taak de laatste start, het laatste einde, de totale speling of
de vrije speling in het bronbestand, dan toont de betreffende kolom "Niet vastgelegd" in plaats van een
verzonnen getal.

Bewerk je een taak, of druk je op **F5**, dan verlaat de app deze weergave en rekent hij gewoon weer
door — precies zoals bij elk ander formaat. De herberekening zelf gebruikt Primavera's opgeslagen
datums nooit als invoer: ze reizen als aparte, alleen-lezen brondata mee en worden uitsluitend gebruikt
om te tonen wat het bestand zei, nooit om te sturen wat de app berekent. Sla je op als IFC, dan gaan Primavera's
opgeslagen datums mee het projectbestand in — inclusief welke assen het bronbestand niet vastlegde.
Bij het openen van dat IFC-bestand zet de app deze weergave niet uit zichzelf weer aan: je krijgt de
melding met een knop **Opgeslagen datums tonen** en kiest zelf. Zo kan een planning die je intussen
hebt bewerkt en opgeslagen nooit ongevraagd weer met de oude datums op het scherm komen.

Zie [Datums zoals opgeslagen](docs://datums-zoals-opgeslagen) voor de volledige uitleg van deze
weergave, inclusief wat je wel en niet ziet zolang hij actief is en hoe je er handmatig weer uit stapt.

## Opslaan en uitwisselen

Een XER-import is een **import**, geen XER-editor of XER-exporter. Wanneer je daarna opslaat, schrijft Open Planner Studio een IFC-bestand. Dat IFC is het eigen projectbestand en bewaart de gelezen XER-brondata naast de gegevens waarmee de app werkt. Het oorspronkelijke `.xer`-bestand wordt nooit stil overschreven.

Die bewaarde brondata heeft een prijs bij grote bestanden. Het volledige oorspronkelijke `.xer`-bestand reist mee in het projectbestand én in elke crashherstel-snapshot, zonder bovengrens. Gemeten op het grootste testbestand (een `.xer` van 17,7 MB met ruim 2.000 activiteiten): het IFC-projectbestand wordt ongeveer 50 MB, opslaan duurt tientallen seconden en het crashherstel schrijft dat bestand elke tien seconden opnieuw zolang je bewerkt. Bij een export met veel projecten vermenigvuldigt dat: elk geopend document draagt zijn eigen kopie. Voor de meeste planningen merk je hier niets van; werk je met een export van tientallen megabytes, houd dan rekening met een traag opslaan en een grote projectmap.

Voor uitwisseling naar Primavera bestaat de bestaande **Primavera P6 XML**-export. Dat is een ander formaat met eigen beperkingen; zie [Im-/export](docs://gids-import-export). Bewaar daarom altijd ook het IFC-bestand wanneer je een bewerkt project later opnieuw wilt openen.

## Grenzen die zichtbaar blijven

Een paar P6-begrippen zijn al opgeslagen, maar hebben nog geen volledig gelijkwaardig rekenmodel:

- **`TT_Rsrc`** (resource-dependent activity) en **`TT_WBS`** worden als P6-brontype bewaard. De solver heeft nog geen afzonderlijke P6-rekenmodus voor deze typen.
- Een P6-resourcecurve met 21 punten wordt als bronverdeling bewaard. Een herkenbare vorm kan voor het histogram naar de dichtstbijzijnde ingebouwde curve worden vertaald, maar de oorspronkelijke 21-puntsvorm wordt na een bewerking nog niet opnieuw berekend.
- De bestaande **P6 XML**-lezer en deze XER-lezer hebben nog niet dezelfde volledige veldendekking. XER kan daarom gegevens bevatten die P6 XML in de app nog niet leest of schrijft.
- **Projecteinde als spelingsanker zonder einddatum.** Staat in het bestand de P6-optie "bereken totale speling ten opzichte van het projecteinde" aan, maar heeft het project géén *Must Finish By*-datum en geen enkele activiteit een geplande einddatum, dan valt het projecteinde in de app terug op de projectstart. Alle laatste datums verankeren dan daarop en vrijwel elke activiteit toont negatieve speling en staat kritiek. In het testmateriaal komt die combinatie voor in P6-exports van kleine, kaal aangemaakte projecten. De vroege datums en de weergave **datums zoals opgeslagen** kloppen wél; alleen de herberekende late kant is dan niet bruikbaar, en er is nog geen schakelaar om de optie uit te zetten. Dit staat als bekende fout geregistreerd.

Deze grenzen verwijderen geen brongegevens uit het IFC-projectbestand. Als XER-specifieke brondata aanwezig is en je exporteert naar CSV, MS Project XML of Primavera P6 XML, past die broninformatie niet volledig in het doelformaat. Na een geslaagde export verschijnt daarom één informatieve melding met een link naar deze gids. Annuleer je de export of mislukt het opslaan, dan verschijnt die melding niet. De export naar IFC bewaart de XER-brondata; de andere exports nemen alleen de gegevens mee die hun eigen formaat ondersteunt. Het oorspronkelijke `.xer`-bestand wordt niet overschreven.

## Verder lezen

- [Kalenders & uren-planning](docs://gids-kalenders-uren) legt uit hoe werktijden en uitzonderingen de planning sturen.
- [Resources, histogram & nivellering](docs://gids-resources-histogram) behandelt resources, toewijzingen en belasting in Open Planner Studio.
- [Baselines & voortgang](docs://gids-baselines-voortgang) legt het gebruik van baselines na import uit.
- [Im-/export](docs://gids-import-export) vergelijkt IFC, CSV, MS Project XML en Primavera P6 XML.
