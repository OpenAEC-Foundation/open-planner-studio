# Hoe de AI-koppeling werkt

Wat gebeurt er eigenlijk als een AI-assistent in je planning werkt? In dit artikel lees je wat de koppeling is, waarom hij anders is dan een bestand uitwisselen, welke grenzen de app zelf bewaakt en hoe de assistent te weten komt hoe hij een planning hoort te bouwen. Het voorbeeld aan het eind laat met getallen zien wat een assistent in één keer kan doen en wat jij daarvan terugdraait.

## Het begrip

Een AI-assistent, zoals een chatprogramma of een programmeerassistent, kan een ander programma bedienen via het **Model Context Protocol** (MCP). Open Planner Studio doet daarin de rol van de server. De desktop-app draait een kleine server op je eigen computer, de **bridge**. De assistent verbindt daarmee en krijgt een lijst **tools**: gereedschappen met een naam die begint met `planner_`, zoals taken lezen, een relatie leggen of een baseline opslaan. Welke dat zijn, staat in [AI-tools](docs://ref-ai-tools).

Het bijzondere is dat de assistent werkt in het project dat je op dat moment open hebt, niet in een kopie. Je exporteert niets, je importeert niets en er is geen moment waarop jij en de assistent naar twee verschillende versies kijken. Een taak die de assistent toevoegt, verschijnt meteen in de Gantt. De app is daarbij niet naïef: de assistent werkt met dezelfde berekening, dezelfde ongedaan-maakgeschiedenis en dezelfde regels als jij.

Hoe je de koppeling aanzet, staat in [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen). Hieronder lees je hoe hij werkt.

## Hoe de app ermee omgaat

### Een server die alleen jouw computer hoort

De bridge luistert alleen op je eigen computer (`127.0.0.1`), op één poort, standaard 3877. Hij neemt alleen aanvragen aan op het adres `/mcp`, en alleen met jouw **token** in de header `Authorization: Bearer`. Een aanvraag zonder het juiste token weigert hij. Een aanvraag die uit een browser komt, herkent hij aan een `Origin`-header en weigert hij ook, zodat een webpagina die je toevallig open hebt niet met je planning kan praten. Aanvragen verwerkt hij strikt één voor één.

De verbinding is gewone HTTP op je eigen computer; er gaat niets naar buiten via de app zelf. Wat een assistent met de planning doet die hij leest, bijvoorbeeld wat zijn aanbieder ermee doet, regelt de assistent zelf en valt buiten de app.

### De assistent werkt op één document

Bij zijn eerste wijziging bindt de bridge de verbinding aan het document dat dan actief is. Wissel jij daarna zelf van tabblad, dan weigert de app de volgende wijziging van de assistent (code `DOC_DRIFT`) totdat hij met `planner_switch_document` bevestigt op welk document hij wil werken. Zo belandt er niets in het verkeerde project. Een assistent die zelf een document opent of dupliceert, werkt daarna in dat nieuwe document.

### Elke wijziging rekent door

In de app plan je handmatig: je wijzigt, daarna druk je op *Bereken* (F5), tenzij *Automatisch berekenen* aan staat. Voor een wijziging door de assistent geldt dat niet. Elke schrijfactie van de assistent loopt door één transactie. Verandert er daarbij projectdata, dan rekent de app aan het eind zelf door, bij een draaiboek één keer. Een leestool rekent alleen bij als de planning verouderd is, bijvoorbeeld omdat jij zelf iets wijzigde en nog niet op *Bereken* drukte. De assistent hoeft de planning dus nooit te verversen, en jij hoeft na een wijziging van hem niet op *Bereken* te drukken. Het resultaat, zoals het projecteinde en het kritieke pad, leest hij daarna terug met de leestools.

### Een draaiboek is één stap

Een assistent kan een reeks stappen als één geheel indienen met `planner_batch`, een draaiboek van maximaal 100 stappen. Dat levert één ongedaan-maakstap voor jou, één herberekening en één backup op. Valt één stap structureel om, bijvoorbeeld een onbekende tool of een kringverwijzing, dan draait de app het hele draaiboek terug. Je houdt nooit een half afgemaakte planning over. Een weigering van één item binnen een bulkstap, zoals één ongeldige voortgangsregel van twintig, is milder: dat item blijft liggen en de rest wordt wel uitgevoerd. De weigeringen staan bovenaan in het antwoord.

### Jouw grenzen

Vier dingen bepaal je zelf, in het tabblad *AI*:

- *Pauzeren* en *Alleen lezen* laten de assistent verbonden, maar weigeren elke wijziging. Lezen blijft mogelijk.
- Een open dialoog blokkeert alles. Met bijvoorbeeld een taakdialoog, de instellingen, de presentatiemodus of het welkomstvenster open weigert de app ook het lezen, omdat je dan midden in een handmatige actie zit. De assistent krijgt de foutcode `DIALOG_OPEN` met de naam van de dialoog.
- *Auto-backup* schrijft vóór de eerste wijziging per document een IFC-kopie. Mislukt die backup, dan voert de app de wijziging niet uit.
- Het *Activiteitenpaneel* laat elke aanroep zien, met argumenten en antwoord.

Daarbovenop komt je gewone *Ongedaan* (Ctrl+Z). De assistent deelt die geschiedenis met jou en heeft zelf ook `planner_undo` en `planner_redo`.

### Wat de assistent niet kan

De bridge is bewust smaller dan de app. Wat de assistent niet kan, heeft meestal één van drie redenen.

**Het reikt verder dan het project.** Een assistent kan de resourcebibliotheek niet wijzigen. Een bibliotheek is gedeeld door al je projecten en valt buiten de ongedaan-maakgeschiedenis; één tariefwijziging werkte dus door in projecten die niet eens openstaan. Voor een resource uit een bibliotheek liggen naam, type, omschrijving, uurtarief en eenheid vast, net als in het resourcepaneel. Wat het project bepaalt, blijft wel van de assistent: maximale inzet, beschikbaarheid in de tijd, kalender en ploeg. Hij kan ook niet kiezen welke kalender de projectkalender is. Het rekenprofiel en de reken-opties kan hij lezen maar niet wijzigen; alleen de voortgangsmodus en de projectstandaard voor de werkregel kan hij zetten. Er zijn geen tools voor instellingen, thema, taal, extensies of updates.

**Het laat zich niet betrouwbaar valideren.** Een assistent kan geen hammock zetten, een taak handmatig plannen, een tweede constraint zetten, aantekeningen, kleuren, activiteitcodes, eigen velden of externe koppelingen invullen, en geen nivelleervertraging met de hand zetten. Een WBS-code kiest hij ook niet; die leidt de app zelf af.

**Het raakt iets wat jij zelf moet bepalen.** Voortgang registreert hij alleen als er een statusdatum is. Die kiest hij niet zelf: het is jouw peildatum. Heeft een nog niet gestarte taak een geplande start na de statusdatum, dan moet hij de werkelijke start meegeven. Bestanden schrijft en leest hij alleen binnen je gebruikersmap, en een bestaand bestand overschrijft hij alleen als hij dat uitdrukkelijk vraagt. Een export is geen *Opslaan*: het project blijft in de app als niet opgeslagen staan.

### Hoe de assistent weet hoe hij moet plannen

Een assistent die de tools kent, kan nog steeds een planning bouwen waar geen planner iets aan heeft: taken zonder relaties, een vaste datum op elke taak of een veel te fijne opdeling. De app geeft hem daarom drie dingen mee.

**De kernregels in de handdruk.** Bij het verbinden stuurt de bridge in het veld `instructions` van de MCP-handdruk een korte tekst mee. Veel clients zetten die tekst in hun systeemprompt; of jouw client dat doet, hangt van de client af. De regels: begin bij de mijlpalen en de opleverdatum, bouw taken van ongeveer een dag tot twee weken, stuur met relaties in plaats van met vaste datums, gebruik constraints alleen voor harde externe datums, gebruik `planner_batch` voor een samenhangende reeks, en meld aan het eind wat je hebt aangenomen en wat je bewust niet hebt gedaan.

**De volledige gids.** De tool `planner_get_planning_guide` geeft de planningsgids terug, de tekst van [Goed plannen](docs://gids-goed-plannen) of een versie ervan voor assistenten. De koppelprompt uit het venster *Verbindingsgegevens* vraagt de assistent die eerst te lezen. De tool werkt ook als er een dialoog openstaat, in pauze en in alleen-lezen, want hij leest je planning niet.

**De skill.** Een skill is een klein bestand met instructies dat een assistent bij elke sessie meeleest. De skill *goed-plannen* beschrijft de volgorde waarin de tools worden ingezet, de herberekeningsregel en de plicht om aannames terug te melden. De planningsprincipes zelf staan er niet in; die staan in de gids. De tool geeft de skill mee, samen met de plek waar hij hoort. Hoe je hem installeert, staat in [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen).

## Een voorbeeld

Je vraagt een assistent: bouw een uitbouw met fundering, metselwerk en dak, in die volgorde. Je project begint op maandag 2 maart 2026. De assistent leest eerst de gids, en dient dan één draaiboek in:

1. de projectstart op 2 maart 2026;
2. drie taken: Fundering van 5 werkdagen, Metselwerk van 10 en Dak van 4;
3. twee Eind-Start-relaties: Fundering naar Metselwerk, Metselwerk naar Dak.

De app voert de drie stappen uit en rekent door. Leest de assistent daarna terug, dan staat er: projecteinde donderdag 26 maart 2026, projectduur 19 werkdagen, alle drie de taken kritiek. Dat klopt met de som: 5 + 10 + 4 is 19 werkdagen, en 19 werkdagen na maandag 2 maart eindigen op donderdag 26 maart. Het hele draaiboek is één stap in je geschiedenis. Een keer *Ongedaan* haalt de drie taken, de twee relaties én de nieuwe projectstart weg.

Nu de wat-als. Je vraagt de assistent daarna om de voortgang bij te werken, en hij zet daarvoor de statusdatum op maandag 16 maart. Een statusdatum is geen label: werk dat nog niet begonnen is, mag niet vóór die datum liggen en schuift ernaartoe. Zonder één regel voortgang schuift daardoor de hele planning mee: Fundering loopt van 16 tot 20 maart, Metselwerk van 23 maart tot 7 april en Dak van 8 tot 13 april. Het projecteinde springt van 26 maart naar 13 april. De planning schuift twee werkweken op, en de kalender in dit voorbeeld, *Bouwkalender NL*, kent Goede Vrijdag (3 april) en Pasen (5 en 6 april). Die twee vrije weekdagen duwen het einde nog twee dagen verder. Daarom zet de assistent de statusdatum alleen op jouw verzoek, en pas als er echt voortgang te registreren is.

## Gevolgen voor je planning en veelgemaakte misverstanden

**De assistent heeft geen eigen kopie.** Wat hij wijzigt, wijzigt jouw project. Staat Auto-backup aan, dan heb je vóór zijn eerste wijziging een IFC-backup. Met *Alleen lezen* kan hij analyseren zonder iets te veranderen.

**Een nieuw token verbreekt alle koppelingen.** Het token is het wachtwoord van de bridge. Een nieuw token maakt het oude ongeldig, ook op een draaiende bridge, en de assistent moet het nieuwe krijgen.

**Dat de assistent zegt dat het gelukt is, is nog geen bewijs.** Het activiteitenpaneel laat zien welke tool hij echt aanriep en wat terugkwam. Een weigering noemt bijna altijd het veld dat fout was en de route die wel werkt.

**De assistent kan een wat-als niet met undo doen.** Ongedaan maken deelt hij met jou, dus voor varianten dupliceert hij het document met `planner_duplicate_document`. De kopie is losgekoppeld, heeft geen bestandspad en staat als niet opgeslagen. De assistent sluit varianten niet af; dat beslis jij.

**Een export van de assistent is geen opslaan.** Hij schrijft een IFC-bestand naar een pad dat hij zelf kiest, binnen je gebruikersmap, en een bestaand bestand overschrijft hij alleen als hij dat uitdrukkelijk vraagt. Je project blijft in de app als niet opgeslagen staan en houdt zijn eigen opslagdoel. Importeert hij een bestand, dan opent dat in een nieuw tabblad of in een leeg, ongewijzigd tabblad.

## Zie ook

- [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen): de stappen om de bridge te starten en een assistent te koppelen, en de skill te installeren.
- [AI-tools](docs://ref-ai-tools): alle tools per groep, wat ze weigeren en hoe lang backups bewaard blijven.
- [Goed plannen](docs://gids-goed-plannen): de planningsprincipes die de assistent meekrijgt.
- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): wat de statusdatum met je planning doet.
