# Een AI-assistent koppelen (MCP)

Doel: een AI-assistent laten meelezen en meewerken aan je planning, met zicht op wat hij doet en met grenzen die je zelf bepaalt.

## Wanneer je dit nodig hebt

Je wilt dat een AI-assistent je planning leest, analyseert of aanpast. Bijvoorbeeld een eerste opzet van een WBS laten maken, taken corrigeren of het kritieke pad laten uitleggen. Dat werkt via het **Model Context Protocol** (MCP): een standaard waarmee een AI-assistent gereedschappen van een programma kan gebruiken. Open Planner Studio draait daarvoor een kleine server op je eigen computer, de **bridge**. Die biedt een reeks gereedschappen (tools) aan, allemaal met een naam die begint met `planner_`: taken lezen en wijzigen, relaties, resources, kalenders, baselines, documenten en bestanden. Welke dat zijn en wat ze weigeren, staat in [AI-tools](docs://ref-ai-tools); waarom de koppeling zo werkt, staat in [Hoe de AI-koppeling werkt](docs://uitleg-ai-koppeling).

De bridge werkt alleen in de desktop-app. Zet je AI-modus in de browser aan, dan zie je het tabblad *AI* wel, maar de knop *Bridge starten* is grijs met de tekst *De bridge werkt alleen in de desktop-app.* De rest van dit artikel gaat over de desktop-app. In de browser zijn ook *Nu backup maken* en *Backup-map openen* grijs.

## Stappen

### 1. AI-modus aanzetten

1. Kies *Instellingen › Project › Instellingen*. Je kunt ook *Bestand › Instellingen* kiezen, of het tandwiel bovenaan.
2. Kies het tabblad *Geavanceerd* en zet *AI-modus inschakelen* aan. Het tabblad *AI* verschijnt in het lint.
3. Wil je dat de bridge meteen live is zodra de app start, zet dan ook *Bridge automatisch starten* aan. Dat schakelt alleen als AI-modus aanstaat en werkt alleen in de desktop-app. Standaard staat het uit, want een poort openen is een bewuste keuze.

Zet je AI-modus uit, dan stopt de bridge en verdwijnt het tabblad *AI*.

### 2. De bridge starten

1. Ga naar het tabblad *AI* en klik bij *Server* op *Bridge starten*.
2. Kijk naar de status naast de knop. Die zegt *Uit*, *Actief op poort 3877*, *Poort 3877 bezet* of *Fout*. Lukt het starten, dan staat er *Actief op poort 3877* en heet de knop *Bridge stoppen*. Bij *Poort 3877 bezet* of *Fout* blijft de knop *Bridge starten*; zie de valkuilen.

De bridge luistert alleen op je eigen computer, op één poort. Standaard is dat 3877. In de groep *Verbinding* kun je bij *Poort* een andere kiezen, maar alleen als de bridge gestopt is.

### 3. De assistent koppelen

1. Klik bij *Verbinding* op *Verbinden*. Het venster *Verbindingsgegevens* opent.
2. Kies wat je client nodig heeft, zie hieronder.
3. Het token staat verborgen. Met het oog-pictogram toon je het. De kopieerknoppen kopiëren altijd de echte waarde, ook als het scherm het token verbergt.
4. Laat de assistent de lijst met tools opvragen. Die controle staat ook in de koppelprompt: hij hoort de tools met het voorvoegsel `planner_` te zien; het verwachte aantal staat in de koppelprompt.

Het venster biedt drie manieren om te koppelen:

- *Configuratiefragment*: een stukje configuratie dat je in de MCP-instellingen van je client plakt.
- *Koppelprompt*: een tekst die je in je AI-assistent plakt, waarna die zichzelf koppelt.
- *Endpoint* en *Authenticatie*: de losse gegevens. Het endpoint is `http://localhost:3877/mcp` met transport *streamable HTTP*. Bij elke aanvraag hoort een header `Authorization: Bearer` gevolgd door je token.

In de groep *Verbinding* staat ook het veld *Token*. Dat is een lange, willekeurige code die de app voor je maakt en op deze computer bewaart. In het venster staat *Dit token geeft toegang tot het geopende plan. Deel het niet met anderen.* Met het pictogram *Nieuw token* maak je een nieuw token. De app vraagt eerst *Een nieuw token maken verbreekt alle bestaande koppelingen. Doorgaan?* Draait de bridge, dan herstart hij met het nieuwe token en werkt het oude niet meer.

### 4. Zien wat de AI doet

1. Klik bij *Activiteit* op *Activiteitenpaneel*. In de zijkolom opent het paneel *AI-activiteit*.
2. Elke aanroep van de bridge staat op een regel, de nieuwste bovenaan: tijdstip, wat er gebeurde, hoe lang het duurde, en of het lukte of niet. Klik op een regel om *Argumenten* en *Antwoord* uit te klappen.
3. Met *Wissen* leeg je de lijst. Het paneel bewaart de laatste 500 aanroepen. Zolang er niets is gebeurd, staat er *Nog geen AI-activiteit. Aanroepen van de bridge verschijnen hier.*

Met AI-modus aan staat rechtsonder in de statusbalk een bolletje met *AI*. De kleur laat de status van de bridge zien, en een klik erop brengt je naar het tabblad *AI*.

### 5. Grenzen stellen

Bij *Veiligheid* staan de knoppen waarmee jij de AI begrenst:

- *Pauzeren*: de AI mag tijdelijk niets wijzigen, lezen mag nog wel. De bridge blijft actief. De knop wordt *Hervatten*.
- *Alleen lezen*: alle wijzigende tools worden geweigerd zolang dit aanstaat.
- *Auto-backup: aan*: vóór de eerste wijziging van de AI in een document schrijft de app een IFC-backup. Dat staat standaard aan. Met de knop schakel je het uit, en dan staat er *Auto-backup: uit*. Dat gebeurt één keer per document per keer dat je de bridge start.
- *Nu backup maken*: maakt meteen een backup van het actieve document. Daarna staat er *Backup gemaakt:* met de bestandsnaam.
- *Backup-map openen*: opent de map met de backups.

De backups staan in de map `ai-backups` in de gegevensmap van de app. De app houdt de recente backups en dunt oudere uit; hoe precies, staat in [AI-tools](docs://ref-ai-tools).

### 6. De assistent goed laten plannen

Een assistent die de tools kent, kan nog steeds een planning bouwen waar geen planner iets aan heeft: taken zonder relaties, een vaste datum op elke taak of een opdeling die veel te fijn is. Daarom krijgt de assistent de planningsregels op drie manieren mee. Voor de eerste twee hoef je niets te doen.

1. **De kernregels komen vanzelf mee.** Bij het verbinden stuurt de bridge een korte tekst mee met de kernregels. Veel clients zetten die tekst in hun systeemprompt; of de jouwe dat doet, hangt van de client af. Daarin staat onder meer: begin bij de mijlpalen, bouw taken van ongeveer een dag tot twee weken, stuur met relaties in plaats van met vaste datums, en meld aan het eind wat je hebt aangenomen.
2. **De koppelprompt wijst naar de volledige gids.** De koppelprompt uit het venster *Verbindingsgegevens* vraagt de assistent om eerst de planningsgids te lezen met de tool `planner_get_planning_guide`. Die geeft de planningsgids terug, de tekst van [Goed plannen](docs://gids-goed-plannen) of een versie ervan voor assistenten. Gebruik je de prompt niet, vraag het de assistent dan zelf: *Lees eerst de planningsgids met planner_get_planning_guide, voordat je iets wijzigt.*
3. **Optioneel: de skill.** Een skill is een klein bestand met instructies dat een assistent in elke sessie meeleest, zodat hij ook in een volgend gesprek de goede volgorde van tools kent. Dit werkt alleen met een assistent die skills ondersteunt; de skill zelf noemt Claude Code en verwante assistenten. Zet het bestand `SKILL.md` op één van deze plekken: `.claude/skills/goed-plannen/SKILL.md` in de projectmap waarin de assistent werkt, of `~/.claude/skills/goed-plannen/SKILL.md` om hem in elk project te hebben.

Het bestand haal je op twee manieren op. Vraag de assistent de tool `planner_get_planning_guide` aan te roepen met `part` op `skill`: het antwoord bevat de tekst en de plekken waar hij hoort. Of download hem van `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md`.

Of de assistent de gids echt heeft gelezen, zie je in het *Activiteitenpaneel*: er staat dan een aanroep van `planner_get_planning_guide`. Het antwoord dat hij op het laatst geeft, hoort een lijst aannames te bevatten: geschatte duren, gekozen opdeling, relaties die hij zelf legde en elke constraint die hij zette. Mist die lijst, vraag erom.

## Valkuilen en wat de app dan doet

**De AI wijzigt iets dat je wilt terugdraaien.** Elke wijziging van de AI is een stap die je met *Ongedaan* (Ctrl+Z) terugdraait. Een reeks wijzigingen die de AI als één geheel doorgeeft, is één stap. Het project staat daarna als niet opgeslagen. Na een wijziging staat de planning weer berekend, dus je hoeft zelf geen F5 te drukken.

**De app weigert een aanroep van de AI.** Bij *Pauzeren* en *Alleen lezen* weigert de app alle wijzigingen en blijft lezen mogelijk, ook met het doorrekenen van een verouderde planning. Zit je zelf midden in een bewerking, zoals een balk slepen of typen in een veld, dan krijgt de AI de datums van vóór je bewerking met een melding dat ze verouderd zijn. Heb je een dialoog open, bijvoorbeeld de instellingen, een taakdialoog of het welkomstvenster, of staat de presentatiemodus aan, dan weigert de app alle aanroepen, ook het lezen, totdat je de dialoog sluit. De AI krijgt dan een foutmelding met de interne naam van wat openstaat, bijvoorbeeld `showTaskDialog`. Alleen `planner_get_planning_guide` blijft werken, omdat die je planning niet leest.

**Je wisselt van tabblad terwijl de AI werkt.** De AI werkt op het document waarop zijn eerste wijziging landde. Wissel jij intussen van tabblad, dan weigert de app zijn volgende wijziging totdat hij bevestigt dat hij op het andere tabblad wil werken. Zo belandt er niets in het verkeerde project.

**De AI schrijft of opent een bestand.** De AI kan een planning als IFC-bestand wegschrijven en een planningsbestand openen als nieuw tabblad. Dat kan alleen binnen je gebruikersmap. Een bestaand bestand overschrijft hij alleen als hij daar uitdrukkelijk om vraagt.

**De status is *Poort 3877 bezet*.** Een ander programma gebruikt de poort. De melding van de app staat eronder. Het poortveld blijft dan op slot (*Alleen wijzigbaar wanneer de server gestopt is.*), ook al draait de bridge niet, en een stopknop is er niet. Dat is een bekende tekortkoming. Tot die is opgelost: zet *AI-modus inschakelen* uit en weer aan. Dan staat de status weer op *Uit* en kun je een andere poort kiezen. Kopieer daarna de verbindingsgegevens opnieuw, want het endpoint bevat de poort.

**De client krijgt geen verbinding na een nieuw token.** Een nieuw token verbreekt alle bestaande koppelingen. Geef de client het nieuwe token, of plak het configuratiefragment opnieuw.

**Je hebt de bridge zelf gestopt en hij start niet vanzelf.** *Bridge automatisch starten* werkt één keer per keer dat de app start. Stop je de bridge zelf, dan zet de app hem niet stilletjes weer aan.

**Het tabblad *AI* is weg.** AI-modus staat uit. Zet hem aan bij stap 1.

**Een webpagina in je browser kan de bridge niet aanspreken.** De bridge weigert elke aanvraag die vanuit een browser komt, en elke aanvraag zonder het juiste token.

## Zie ook

- [Feedback geven](docs://howto-feedback-geven): loopt de koppeling anders dan hier staat, meld het dan.
- [Hoe de AI-koppeling werkt](docs://uitleg-ai-koppeling): wat de koppeling is, waarom de assistent in je open project werkt en wat hij niet mag.
- [AI-tools](docs://ref-ai-tools): alle `planner_*`-tools per groep, de foutcodes en hoe lang backups bewaard blijven.
- [Goed plannen](docs://gids-goed-plannen): de planningsprincipes die de assistent meekrijgt.
- [Instellingen](docs://ref-instellingen): de AI-instellingen.
