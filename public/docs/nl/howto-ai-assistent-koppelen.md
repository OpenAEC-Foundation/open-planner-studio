# Een MCP-client koppelen

Doel: een MCP-client laten meelezen en meewerken aan je planning, met zicht op wat hij doet en met grenzen die je zelf bepaalt.

## Wanneer je dit nodig hebt

Je wilt dat een MCP-client je planning leest, analyseert of aanpast. Bijvoorbeeld een eerste opzet van een WBS laten maken, taken corrigeren of het kritieke pad laten uitleggen. Dat werkt via het **Model Context Protocol** (MCP): een standaard waarmee een AI-programma, de **MCP-client**, gereedschappen van een ander programma kan gebruiken. Open Planner Studio draait daarvoor een kleine server op je eigen computer, de **bridge**. Die biedt een reeks gereedschappen (tools) aan, allemaal met een naam die begint met `planner_`: taken lezen en wijzigen, relaties, resources, kalenders, baselines, documenten en bestanden. Welke dat zijn en wat ze weigeren, staat in [MCP-tools](docs://ref-ai-tools); waarom de koppeling zo werkt, staat in [Hoe de MCP-koppeling werkt](docs://uitleg-ai-koppeling).

De bridge werkt alleen in de desktop-app. Sta je de MCP-koppeling in de browser toe, dan zie je het tabblad *MCP* wel, maar de knop *Bridge starten* is grijs met de tekst *De bridge werkt alleen in de desktop-app.* De rest van dit artikel gaat over de desktop-app. In de browser zijn ook *Nu backup maken* en *Backup-map openen* grijs.

## Stappen

### 1. De MCP-koppeling toestaan

1. Kies *Instellingen › Project › App-instellingen*. Je kunt ook *Bestand › App-instellingen* kiezen, of het tandwiel bovenaan.
2. Kies het tabblad *Geavanceerd* en zet *MCP-koppeling toestaan* aan. Het tabblad *MCP* verschijnt in het lint.
3. Wil je dat de bridge meteen live is zodra de app start, zet dan ook *Bridge automatisch starten* aan. Dat schakelt alleen als de MCP-koppeling aanstaat en werkt alleen in de desktop-app. Standaard staat het uit, want een poort openen is een bewuste keuze.

Zet je de MCP-koppeling uit, dan stopt de bridge en verdwijnt het tabblad *MCP*.

### 2. De bridge starten

1. Ga naar het tabblad *MCP* en klik bij *Server* op *Bridge starten*.
2. Kijk naar de status naast de knop. Die zegt *Uit*, *Actief op poort 3877*, *Poort 3877 bezet* of *Fout*. Lukt het starten, dan staat er *Actief op poort 3877* en heet de knop *Bridge stoppen*. Bij *Poort 3877 bezet* of *Fout* blijft de knop *Bridge starten*; zie de valkuilen.

De bridge luistert alleen op je eigen computer, op één poort. Standaard is dat 3877. In de groep *Verbinding* kun je bij *Poort* een andere kiezen, maar alleen als de bridge gestopt is.

### 3. De MCP-client koppelen

1. Klik bij *Verbinding* op *Verbinden*. Het venster *Verbindingsgegevens* opent.
2. Kies wat je client nodig heeft, zie hieronder.
3. Het token staat verborgen. Met het oog-pictogram toon je het. De kopieerknoppen kopiëren altijd de echte waarde, ook als het scherm het token verbergt.
4. Laat de MCP-client de lijst met tools opvragen. Die controle staat ook in de koppelprompt: hij hoort de tools met het voorvoegsel `planner_` te zien; het verwachte aantal staat in de koppelprompt.

Het venster biedt drie manieren om te koppelen:

- *Configuratiefragment*: een stukje configuratie dat je in de MCP-instellingen van je client plakt.
- *Koppelprompt*: een tekst die je in je MCP-client plakt, waarna die zichzelf koppelt.
- *Endpoint* en *Authenticatie*: de losse gegevens. Het endpoint is `http://localhost:3877/mcp` met transport *streamable HTTP*. Bij elke aanvraag hoort een header `Authorization: Bearer` gevolgd door je token. Je client moet ook MCP-sessies ondersteunen: de bridge geeft bij het verbinden een sessiecode in de header `Mcp-Session-Id`, en weigert elke latere aanvraag zonder die code. Claude Code en `mcp-remote` doen dat vanzelf.

**Na een update van de app opnieuw verbinden.** Was je MCP-client al verbonden met een oudere versie van de app, dan stuurt hij nog geen sessiecode mee en weigert de bridge elke aanvraag. Verbind daarom opnieuw na de update: start in Claude Code een nieuwe sessie, en sluit Claude Desktop helemaal af en start het opnieuw.

**Claude Code.** Het configuratiefragment past direct in Claude Code. Geef in een terminal deze opdracht, met je eigen token in plaats van `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Je kunt het fragment ook in het bestand `.mcp.json` in je projectmap zetten. Zet dat bestand dan niet in git, want het token geeft toegang tot je plan. Een server uit `.mcp.json` moet je de eerste keer goedkeuren in Claude Code.

**Claude Desktop.** Het configuratiefragment past niet direct in Claude Desktop. In het bestand `claude_desktop_config.json` noem je een programma dat Claude Desktop zelf start, geen adres. Gebruik daarom het externe hulpprogramma `mcp-remote` als tussenstuk; daarvoor heb je Node.js nodig. Kies in Claude Desktop *Settings › Developer › Edit Config*, zet dit in het bestand (met je eigen token) en start Claude Desktop opnieuw:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Het token staat bewust in `env` en niet in `args`: op Windows breekt Claude Desktop een argument met een spatie. Een *custom connector* in Claude (*Customize › Connectors*) werkt niet met de bridge. Claude verbindt dan vanuit de cloud van Anthropic, en die kan de bridge op je eigen computer niet bereiken.

In de groep *Verbinding* staat ook het veld *Token*. Dat is een lange, willekeurige code die de app voor je maakt en op deze computer bewaart. In het venster staat *Dit token geeft toegang tot het geopende plan. Deel het niet met anderen.* Met het pictogram *Nieuw token* maak je een nieuw token. De app vraagt eerst *Een nieuw token maken verbreekt alle bestaande koppelingen. Doorgaan?* Draait de bridge, dan herstart hij met het nieuwe token en werkt het oude niet meer.

### 4. Zien wat de MCP-client doet

1. Klik bij *Activiteit* op *Activiteitenpaneel*. In de zijkolom opent het paneel *MCP-activiteit*.
2. Elke aanroep van de bridge staat op een regel, de nieuwste bovenaan: tijdstip, wat er gebeurde, hoe lang het duurde, en of het lukte of niet. Klik op een regel om *Argumenten* en *Antwoord* uit te klappen.
3. Met *Wissen* leeg je de lijst. Het paneel bewaart de laatste 500 aanroepen. Zolang er niets is gebeurd, staat er *Nog geen MCP-activiteit. Aanroepen van de bridge verschijnen hier.*

Met de MCP-koppeling aan staat rechtsonder in de statusbalk een bolletje met *MCP*. De kleur laat de status van de bridge zien, en een klik erop brengt je naar het tabblad *MCP*.

### 5. Grenzen stellen

Bij *Veiligheid* staan de knoppen waarmee jij de MCP-client begrenst:

- *Pauzeren*: de MCP-client mag tijdelijk niets wijzigen, lezen mag nog wel. De bridge blijft actief. De knop wordt *Hervatten*.
- *Alleen lezen*: alle wijzigende tools worden geweigerd zolang dit aanstaat.
- *Auto-backup: aan*: vóór de eerste wijziging van de MCP-client in een document schrijft de app een IFC-backup. Dat staat standaard aan. Met de knop schakel je het uit, en dan staat er *Auto-backup: uit*. Dat gebeurt één keer per document per keer dat je de bridge start.
- *Nu backup maken*: maakt meteen een backup van het actieve document. Daarna staat er *Backup gemaakt:* met de bestandsnaam.
- *Backup-map openen*: opent de map met de backups.

De backups staan in de map `ai-backups` in de gegevensmap van de app. De app houdt de recente backups en dunt oudere uit; hoe precies, staat in [MCP-tools](docs://ref-ai-tools).

### 6. De MCP-client goed laten plannen

Een MCP-client plant pas goed als hij de planningsregels kent. Waarom dat nodig is en wat erin staat, lees je in [Hoe de MCP-koppeling werkt](docs://uitleg-ai-koppeling). Dit doe je zelf:

1. **Niets doen voor de kernregels.** Ze komen vanzelf mee bij het verbinden. Of je client ze in de systeemprompt zet, hangt van de client af.
2. **De gids laten lezen.** De koppelprompt uit het venster *Verbindingsgegevens* vraagt de MCP-client de gids te lezen met de tool `planner_get_planning_guide`. Gebruik je de prompt niet, vraag het dan zelf: *Lees eerst de planningsgids met planner_get_planning_guide, voordat je iets wijzigt.* Je kunt de gids zelf lezen op `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Optioneel: de skills installeren.** Dit werkt alleen met een MCP-client die skills ondersteunt. Zet `SKILL.md` van *goed-plannen* en *progress-update* in `.claude/skills/goed-plannen/SKILL.md` en `.claude/skills/progress-update/SKILL.md` in de projectmap waarin de MCP-client werkt, of onder `~/.claude/skills/` voor elk project.

De bestanden haal je op twee manieren op. Vraag de MCP-client de tool `planner_get_planning_guide` aan te roepen met `part` op `skill`: het antwoord bevat beide teksten en per skill de plekken waar hij hoort. Of download ze van `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` en `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Staat *goed-plannen* er nog van een oudere versie van de app, vervang hem dan: die oude tekst is Nederlands en verwijst naar het Help-artikel in plaats van naar de gids voor MCP-clients.

Of de MCP-client de gids echt heeft gelezen, zie je in het *Activiteitenpaneel*: er staat dan een aanroep van `planner_get_planning_guide`. Het antwoord dat hij op het laatst geeft, hoort een lijst aannames te bevatten: geschatte duren, gekozen opdeling, relaties die hij zelf legde en elke constraint die hij zette. Mist die lijst, vraag erom. Na een voortgangsupdate volgens *progress-update* hoort het antwoord de statusdatum, de nieuwe einddatum en de afwijking ten opzichte van de baseline te noemen.

## Valkuilen en wat de app dan doet

**De MCP-client wijzigt iets dat je wilt terugdraaien.** Elke wijziging van de MCP-client is een stap die je met *Ongedaan* (Ctrl+Z) terugdraait. Een reeks wijzigingen die de MCP-client als één geheel doorgeeft, is één stap. Het project staat daarna als niet opgeslagen. Na een wijziging staat de planning weer berekend, dus je hoeft zelf geen F5 te drukken.

**De app weigert een aanroep van de MCP-client.** Bij *Pauzeren* en *Alleen lezen* weigert de app alle wijzigingen en blijft lezen mogelijk, ook met het doorrekenen van een verouderde planning. Zit je zelf midden in een bewerking, zoals een balk slepen of typen in een veld, dan krijgt de MCP-client de datums van vóór je bewerking met een melding dat ze verouderd zijn. Heb je een dialoog open, bijvoorbeeld de instellingen, een taakdialoog of het welkomstvenster, of staat de presentatiemodus aan, dan weigert de app alle aanroepen, ook het lezen, totdat je de dialoog sluit. De MCP-client krijgt dan een foutmelding met de interne naam van wat openstaat, bijvoorbeeld `showTaskDialog`. Alleen `planner_get_planning_guide` blijft werken, omdat die je planning niet leest.

**Je wisselt van tabblad terwijl de MCP-client werkt.** De MCP-client werkt op het document waarop zijn eerste wijziging landde. Wissel jij intussen van tabblad, dan weigert de app zijn volgende wijziging totdat hij bevestigt dat hij op het andere tabblad wil werken. Zo belandt er niets in het verkeerde project.

**De MCP-client schrijft of opent een bestand.** De MCP-client kan een planning als IFC-bestand wegschrijven en een planningsbestand openen als nieuw tabblad. Dat kan alleen binnen je gebruikersmap. Een bestaand bestand overschrijft hij alleen als hij daar uitdrukkelijk om vraagt.

**De status is *Poort 3877 bezet*.** Een ander programma gebruikt de poort. De melding van de app staat eronder. Het poortveld blijft dan op slot (*Alleen wijzigbaar wanneer de server gestopt is.*), ook al draait de bridge niet, en een stopknop is er niet. Dat is een bekende tekortkoming. Tot die is opgelost: zet *MCP-koppeling toestaan* uit en weer aan. Dan staat de status weer op *Uit* en kun je een andere poort kiezen. Kopieer daarna de verbindingsgegevens opnieuw, want het endpoint bevat de poort.

**De client krijgt geen verbinding na een nieuw token.** Een nieuw token verbreekt alle bestaande koppelingen. Geef de client het nieuwe token, of plak het configuratiefragment opnieuw.

**Je hebt de bridge zelf gestopt en hij start niet vanzelf.** *Bridge automatisch starten* werkt één keer per keer dat de app start. Stop je de bridge zelf, dan zet de app hem niet stilletjes weer aan.

**Het tabblad *MCP* is weg.** De MCP-koppeling staat uit. Zet hem aan bij stap 1.

**Een webpagina in je browser kan de bridge niet aanspreken.** De bridge weigert elke aanvraag die vanuit een browser komt, en elke aanvraag zonder het juiste token.

## Zie ook

- [Feedback geven](docs://howto-feedback-geven): loopt de koppeling anders dan hier staat, meld het dan.
- [Hoe de MCP-koppeling werkt](docs://uitleg-ai-koppeling): wat de koppeling is, waarom de MCP-client in je open project werkt en wat hij niet mag.
- [MCP-tools](docs://ref-ai-tools): alle `planner_*`-tools per groep, de foutcodes en hoe lang backups bewaard blijven.
- [Goed plannen](docs://gids-goed-plannen): de planningsprincipes; de MCP-client krijgt ze in een Engelse versie met de tools erbij.
- [App-instellingen](docs://ref-instellingen): de MCP-instellingen.
