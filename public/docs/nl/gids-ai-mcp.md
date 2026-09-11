# AI-assistent koppelen (MCP)

Open Planner Studio kan zichzelf openstellen voor een AI-assistent. Zet je de AI-modus aan, dan wordt de app zelf een **MCP-server**: een assistent zoals Claude maakt verbinding met het venster dat je op dat moment open hebt staan, leest je planning en kan hem aanpassen. Je kijkt live mee — elke taak die erbij komt verschijnt meteen in de Gantt — en alles wat de assistent doet, draai je terug met één keer Ctrl+Z.

Dat is een wezenlijk ander model dan een bestand exporteren, ergens laten bewerken en weer importeren. Er is geen kopie, geen tussenformaat en geen moment waarop jij en de assistent naar iets anders kijken. Deze gids laat zien hoe je het aanzet, hoe je een assistent koppelt, wat hij wel en niet mag, en wat je doet als het niet lukt.

## Wat je hier leert

- De AI-modus aanzetten en het AI-tabblad vinden.
- De bridge starten, en hem automatisch laten meestarten met de app.
- Een assistent koppelen — met een kant-en-klare prompt of met een configuratiefragment.
- Wat een assistent met je planning kan doen.
- De veiligheidsknoppen: pauzeren, alleen lezen, automatische backup en het activiteitenoverzicht.
- Wat je doet als de verbinding niet tot stand komt.

De bridge werkt **alleen in de desktop-app**. In de browserversie is het AI-tabblad wel zichtbaar, maar de server zelf draait in de desktopschil en kan daar niet starten.

## Aanzetten

De AI-modus staat standaard uit. Je zet hem aan bij **Instellingen → Toepassing → AI-modus inschakelen** — via het tandwiel, via het lint-tabblad Instellingen of via Bestand → Instellingen; alle drie tonen dezelfde schakelaar.

Zodra hij aanstaat, verschijnt er een extra tabblad **AI** in het lint. Zet je de AI-modus weer uit, dan verdwijnt het tabblad en wordt een draaiende bridge meteen gestopt — er blijft dus nooit een server luisteren zonder dat het tabblad erbij staat.

Daaronder staat **Bridge automatisch starten**. Met die schakelaar aan gaat de server meteen live zodra je de app opent, zodat een assistent kan koppelen zonder dat je eerst het AI-tabblad langsgaat. Hij staat standaard uit: een luisterende poort openen op je eigen computer hoort een bewuste keuze te zijn.

## Het AI-tabblad

Het tabblad bestaat uit vier groepen.

**Server** — de knop **Bridge starten** (of **Bridge stoppen**) met daarnaast de status: *Uit*, *Actief op poort 3877*, *Poort … bezet* of *Fout*. Dezelfde status staat als gekleurd stipje rechtsonder in de statusbalk, zodat je ook vanaf een ander tabblad ziet of de bridge leeft.

**Verbinding** — het poortnummer (alleen te wijzigen als de server gestopt is; een draaiende server houdt zijn poort vast), het token, en de knop **Verbinden**. Het token staat standaard verborgen; met de oogknop maak je het zichtbaar, met de kopieerknop neem je het over, en met **Nieuw token** maak je een vers token aan. Let op: dat laatste verbreekt élke bestaande koppeling, want die dragen allemaal het oude token — de app vraagt daarom eerst om bevestiging.

**Veiligheid** — **Pauzeren**, **Alleen lezen**, de schakelaar **Auto-backup**, en de knoppen **Nu backup maken** en **Backup-map openen**. Wat ze precies doen, staat verderop bij *De veiligheidsknoppen*.

**Activiteit** — de knop **Activiteitenpaneel** opent een lijst met elke aanroep die de assistent doet: tijdstip, naam van de tool, hoe lang hij duurde, en of hij slaagde. Elke regel klap je open voor de argumenten en het antwoord. Dat is je logboek: je hoeft de assistent niet op zijn woord te geloven over wat hij heeft gedaan.

## Een assistent koppelen

Klik op **Verbinden**. Het venster dat opengaat bevat vier blokken die je stuk voor stuk kunt kopiëren:

1. **Endpoint** — het adres waarop de bridge luistert, standaard `http://localhost:3877/mcp`. Het transport is streamable HTTP.
2. **Authenticatie** — de HTTP-header die bij elke aanvraag mee moet, in de vorm `Authorization: Bearer …`.
3. **Configuratiefragment** — een kant-en-klaar blok JSON dat je in de MCP-configuratie van je client plakt.
4. **Koppelprompt** — een stukje tekst dat je rechtstreeks in je assistent plakt; die koppelt zichzelf en controleert daarna zijn eigen toollijst.

Die laatste is de kortste weg en werkt bij elke assistent die MCP-servers kan toevoegen. De prompt is bewust merkloos: hij noemt alleen het adres, het token en wat de assistent daarna moet controleren, dus hij werkt net zo goed bij de ene aanbieder als bij de andere.

De koppeling is klaar zodra de assistent zijn toollijst kan opvragen. Hij hoort daar een kleine veertig tools te zien die allemaal met `planner_` beginnen. Ziet hij er nul, dan is de bridge niet gestart of klopt het token niet.

Het token geeft toegang tot het plan dat je op dat moment open hebt staan. Behandel het als een wachtwoord: niet in een gedeeld document, niet in een chat met anderen.

## Wat een assistent mag

De tools dekken ongeveer alles wat je zelf in de app doet:

- **Lezen** — projectoverzicht, takenlijst, één taak in detail, het kritieke pad, resources en hun histogram, kalenders, baselines, en de vergelijking met een baseline.
- **Plannen** — taken aanmaken (een hele WBS met fasen en subtaken in één keer), wijzigen, verplaatsen en verwijderen; relaties leggen, aanpassen en weghalen; voortgang registreren.
- **Inrichten** — resources aanmaken en toewijzen, kalenders en vrije dagen beheren, baselines opslaan en activeren, nivelleren.
- **Beheren** — documenten aanmaken, dupliceren en wisselen, planningsbestanden importeren, en exporteren naar IFC.

Twee dingen zijn daarbij belangrijker dan de lijst zelf.

**Een assistent kan in één draaiboek werken.** In plaats van tool na tool aan te roepen kan hij een reeks stappen als één geheel indienen. Dat is niet alleen sneller: het hele draaiboek wordt één stap in je geschiedenis. Bouwt hij in één keer een planning van veertig taken met alle onderlinge relaties, dan haal je die met één keer Ctrl+Z weer weg. Gaat er halverwege iets structureel mis, dan wordt het hele draaiboek teruggedraaid in plaats van dat je met een half afgemaakte planning blijft zitten.

**Na elke wijziging wordt de planning herberekend.** De assistent hoeft dat niet apart te vragen en kan dus niet per ongeluk op verouderde datums verder werken.

## Wat een assistent níet mag

De bridge is bewust smaller dan de app. Een paar dingen kan een assistent niet, ook niet als je het hem vraagt — hij krijgt dan een weigering die uitlegt wat de route wél is. Dat is geen kinderslot: het gaat telkens om iets dat verder reikt dan het project waar je op dat moment naar kijkt.

**De resourcebibliotheek zelf.** Een assistent kan geen bibliotheekresource of -kalender aanmaken, wijzigen of verwijderen. Een bibliotheek is app-brede data die door al je projecten gedeeld wordt, en bewerkingen daarin vallen buiten de gewone ongedaan-maak-geschiedenis. Eén tariefwijziging zou dus doorwerken in projecten die niet eens openstaan, zonder dat je het terug kunt draaien. Dat doe je zelf, in Backstage → Bibliotheek.

**De vastgelegde velden van een geërfde resource.** Komt een resource uit een bibliotheek, dan bepaalt die bibliotheek wát die resource is: naam, soort, omschrijving, uurtarief en eenheid. Die velden staan in de Resources-tab niet voor niets als platte tekst — je kunt ze daar zelf ook niet wijzigen — en de assistent kan er net zomin bij. Wat het *project* bepaalt blijft wel gewoon van hem: max. eenheden, de tijd-gefaseerde beschikbaarheid, de kalender en het ploeg-lidmaatschap. Vraag je toch om een ander uurtarief, dan noemt de weigering de twee echte routes: wijzig het in de bibliotheek (geldt dan voor élk project), of maak de resource eerst los van de bibliotheek — daarna is hij projecteigen en volledig bewerkbaar, en dat losmaken draai je met Ctrl+Z terug.

**Wélke kalender de projectkalender is.** De inhoud van die kalender mag hij wijzigen, maar het omwisselen van de projectkalender doe je zelf in de kalenderbibliotheek. Hetzelfde geldt voor planningsopties zoals de meervoudige-kritieke-paden-stand.

**De app zelf.** Er is geen tool voor instellingen, thema, taal, extensies of de updater. Een assistent verandert niets aan hoe je programma is ingericht.

**Bestanden — wel, maar met grenzen.** Importeren betekent dat hij een planningsbestand van je schijf mag lezen, en exporteren dat hij een IFC mag wegschrijven. Dat wegschrijven kan alleen binnen je persoonlijke map, en een bestaand bestand wordt nooit overschreven tenzij dat expliciet gevraagd is. Een export is bovendien geen "opslaan": je document blijft in de app als niet-opgeslagen staan, dus hij kan je projectbestand niet onder je vandaan vervangen.

Bij het opvragen van de resourcelijst ziet een assistent meteen welke resources uit een bibliotheek komen, bij welk bedrijf ze horen en welke velden vastliggen. Hij hoeft er dus niet eerst tegenaan te lopen om het te weten.

## De veiligheidsknoppen

**Pauzeren** houdt de bridge in de lucht maar weigert elke wijziging; lezen blijft toegestaan. Handig als je zelf even iets wilt doen zonder de verbinding te verbreken.

**Alleen lezen** doet hetzelfde, maar als houding in plaats van als pauze: laat een assistent je planning analyseren, rapporteren of vergelijken, zonder dat hij er iets aan kan veranderen.

**Auto-backup** maakt vóór de eerste wijziging in een document automatisch een IFC-kopie. Dat gebeurt één keer per document per sessie, dus je krijgt geen stapel bestanden bij elke aanroep. **Nu backup maken** doet het direct, bijvoorbeeld vlak voordat je een assistent iets ingrijpends laat doen. **Backup-map openen** brengt je naar de map waar ze staan; de app bewaart de laatste tien per document.

Daarbovenop komt de gewone ongedaan-maak-geschiedenis: een assistent deelt die met jou. Alles wat hij doet, kun jij terugdraaien — en de assistent kan dat zelf ook, want undo en redo zitten in zijn gereedschapskist.

## Als het niet lukt

**"Poort … bezet."** Er luistert al iets op die poort. Meestal is dat een tweede venster van deze app: de bridge kan er maar één tegelijk bedienen. Sluit het andere venster, of kies een ander poortnummer terwijl de server gestopt is.

**De assistent krijgt geen antwoord, of blijft hangen.** Dat gebeurt als het venster achter de server is weggevallen of opnieuw is geladen. Stop de bridge en start hem opnieuw; helpt dat niet, herstart dan de app. Twijfel je of hij nog leeft, kijk dan naar het statusstipje in de statusbalk.

**De assistent ziet geen tools, of krijgt een foutmelding over toegang.** Dan klopt het token niet. Dat gebeurt vooral als je op **Nieuw token** hebt geklikt nadat je de koppeling had gemaakt: de assistent draagt dan nog het oude. Kopieer het nieuwe uit het venster **Verbinden** en werk de configuratie van je client bij.

**Er gebeurt niets terwijl de assistent zegt dat het gelukt is.** Kijk in het activiteitenpaneel wat hij daadwerkelijk heeft aangeroepen en wat er terugkwam. Staat daar een weigering, dan noemt die vrijwel altijd het veld dat fout was én het alternatief.

## Laat je AI-assistent goed plannen

Een assistent die de tools kent, kan nog steeds een planning bouwen waar geen planner iets aan heeft:
taken zonder relaties, een vaste datum op elke taak, of een opdeling die veel te fijn is om bij te
houden. De principes die dat voorkomen staan in de gids [Goed plannen: van eisen naar een betrouwbare
planning](docs://gids-goed-plannen) — laat je assistent die lezen voordat hij begint, of verwijs er
in je opdracht naar. In de broncode van Open Planner Studio staat daarnaast een korte agent-skill
onder `.claude/skills/goed-plannen/`, die voor de inhoud naar diezelfde gids verwijst en alleen het
agent-specifieke toevoegt: in welke volgorde je de `planner_`-tools inzet en wat je aan de gebruiker
terugmeldt.

## Verder lezen

- [Baselines & voortgang](docs://gids-baselines-voortgang) — wat de statusdatum met je planning doet. Goed om te weten voordat je een assistent hem laat zetten: hij is niet alleen een peildatum, maar schuift ook nog niet gestart werk naar voren.
- [Im- en export](docs://gids-import-export) — hoe IFC, CSV, MS Project en P6 zich tot elkaar verhouden.
- [Instellingen](docs://ref-instellingen) — alle instellingen op een rij, inclusief de twee AI-schakelaars.
