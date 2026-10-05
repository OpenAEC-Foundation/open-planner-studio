# Een AI-assistent koppelen (MCP)

Doel: een AI-assistent laten meelezen en meewerken aan je planning, met zicht op wat hij doet en met grenzen die je zelf bepaalt.

## Wanneer je dit nodig hebt

Je wilt dat een AI-assistent je planning leest, doorrekent of aanpast. Bijvoorbeeld een eerste opzet van een WBS laten maken, taken corrigeren of het kritieke pad laten uitleggen. Dat werkt via het **Model Context Protocol** (MCP): een standaard waarmee een AI-assistent gereedschappen van een programma kan gebruiken. Open Planner Studio draait daarvoor een kleine server op je eigen computer, de **bridge**. Die biedt een reeks gereedschappen (tools) aan, allemaal met een naam die begint met `planner_`: taken lezen en wijzigen, relaties, resources, kalenders, baselines, documenten en bestanden.

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

De backups staan in de map `ai-backups` in de gegevensmap van de app. De app houdt de recente backups en dunt oudere uit.

## Valkuilen en wat de app dan doet

**De AI wijzigt iets dat je wilt terugdraaien.** Elke wijziging van de AI is een stap die je met *Ongedaan* (Ctrl+Z) terugdraait. Een reeks wijzigingen die de AI als één geheel doorgeeft, is één stap. Het project staat daarna als niet opgeslagen. Na een wijziging staat de planning weer berekend, dus je hoeft zelf geen F5 te drukken.

**De app weigert een aanroep van de AI.** Bij *Pauzeren* en *Alleen lezen* weigert de app alle wijzigingen en blijft lezen mogelijk. Heb je een dialoog open, bijvoorbeeld de instellingen of een taakdialoog, dan weigert de app alle aanroepen, ook het lezen, totdat je de dialoog sluit. De AI krijgt dan een foutmelding.

**Je wisselt van tabblad terwijl de AI werkt.** De AI werkt op het document waarop zijn eerste wijziging landde. Wissel jij intussen van tabblad, dan weigert de app zijn volgende wijziging totdat hij bevestigt dat hij op het andere tabblad wil werken. Zo belandt er niets in het verkeerde project.

**De AI schrijft of opent een bestand.** De AI kan een planning als IFC-bestand wegschrijven en een planningsbestand openen als nieuw tabblad. Dat kan alleen binnen je gebruikersmap. Een bestaand bestand overschrijft hij alleen als hij daar uitdrukkelijk om vraagt.

**De status is *Poort 3877 bezet*.** Een ander programma gebruikt de poort. De melding van de app staat eronder. Het poortveld blijft dan op slot (*Alleen wijzigbaar wanneer de server gestopt is.*), ook al draait de bridge niet, en een stopknop is er niet. Dat is een bekende tekortkoming. Tot die is opgelost: zet *AI-modus inschakelen* uit en weer aan. Dan staat de status weer op *Uit* en kun je een andere poort kiezen. Kopieer daarna de verbindingsgegevens opnieuw, want het endpoint bevat de poort.

**De client krijgt geen verbinding na een nieuw token.** Een nieuw token verbreekt alle bestaande koppelingen. Geef de client het nieuwe token, of plak het configuratiefragment opnieuw.

**Je hebt de bridge zelf gestopt en hij start niet vanzelf.** *Bridge automatisch starten* werkt één keer per keer dat de app start. Stop je de bridge zelf, dan zet de app hem niet stilletjes weer aan.

**Het tabblad *AI* is weg.** AI-modus staat uit. Zet hem aan bij stap 1.

**Een webpagina in je browser kan de bridge niet aanspreken.** De bridge weigert elke aanvraag die vanuit een browser komt, en elke aanvraag zonder het juiste token.

## Zie ook

- [Feedback geven](docs://howto-feedback-geven): loopt de koppeling anders dan hier staat, meld het dan.
- [Goed plannen](docs://gids-goed-plannen): de planningsprincipes die de assistent meekrijgt.
- [Instellingen](docs://ref-instellingen): de AI-instellingen.
