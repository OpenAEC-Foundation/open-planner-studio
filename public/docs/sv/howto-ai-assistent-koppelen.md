# Ansluta en AI-assistent (MCP)

Mål: låt en AI-assistent läsa med och arbeta i din tidsplan. Du ser vad den gör. Du sätter själv gränserna.

## När du behöver det

Du vill att en AI-assistent läser, analyserar eller ändrar din tidsplan. Till exempel för att den ska ta fram ett första WBS, rätta uppgifter eller förklara den kritiska linjen. Det fungerar via **Model Context Protocol** (MCP): en standard som låter en AI-assistent använda verktyg i ett program. Därför kör Open Planner Studio en liten server på din egen dator, **bryggan**. Bryggan erbjuder en uppsättning verktyg. Alla namn börjar med `planner_`: läsa och ändra uppgifter, samband, resurser, kalendrar, baslinjer, dokument och filer. Vilka verktyg det finns och vad de avvisar står i [AI-verktyg](docs://ref-ai-tools). Varför kopplingen fungerar så står i [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling).

Bryggan fungerar bara i desktopappen. Slår du på AI-läget i webbläsaren, ser du fliken *AI*. Knappen *Starta bryggan* är då grå, med texten *Bryggan fungerar bara i desktopappen.* Resten av den här artikeln gäller desktopappen. I webbläsaren är *Gör backup nu* och *Öppna backupmapp* också grå.

## Steg

### 1. Slå på AI-läget

1. Välj *Inställningar › Projekt › Appinställningar*. Du kan också välja *Fil › Appinställningar*, eller kugghjulet högst upp.
2. Välj fliken *Avancerat* och slå på *Aktivera AI-läge*. Fliken *AI* visas i menyfliksområdet.
3. Vill du att bryggan är aktiv så snart appen startar, slå då också på *Starta bryggan automatiskt*. Det fungerar bara när AI-läget är på, och bara i desktopappen. Den är av som standard, eftersom det är ett avsiktligt val att öppna en port.

Slår du av AI-läget, stoppas bryggan och fliken *AI* försvinner.

### 2. Starta bryggan

1. Gå till fliken *AI* och klicka på *Starta bryggan* under *Server*.
2. Titta på statusen bredvid knappen. Den säger *Av*, *Aktiv på port 3877*, *Port 3877 är upptagen* eller *Fel*. Om starten lyckas visar den *Aktiv på port 3877* och heter knappen *Stoppa bryggan*. Vid *Port 3877 är upptagen* eller *Fel* heter knappen fortfarande *Starta bryggan*. Se fallgroparna.

Bryggan lyssnar bara på din egen dator, på en enda port. Som standard är det port 3877. I gruppen *Anslutning* kan du välja en annan port under *Port*. Det går bara när bryggan är stoppad.

### 3. Anslut assistenten

1. Klicka på *Anslut* under *Anslutning*. Fönstret *Anslutningsuppgifter* öppnas.
2. Välj vad din klient behöver. Se nedan.
3. Token är dold. Med ögonikonen visar du den. Kopieringsknapparna kopierar alltid det riktiga värdet, även när skärmen döljer token.
4. Låt assistenten begära listan med verktyg. Den kontrollen finns också i anslutningsprompten. Assistenten ska se verktyg med prefixet `planner_`. Det förväntade antalet står i anslutningsprompten.

Fönstret erbjuder tre sätt att ansluta:

- *Konfigurationsfragment*: ett stycke konfiguration som du klistrar in i MCP-inställningarna i din klient.
- *Anslutningsprompt*: en text som du klistrar in i din AI-assistent. Därefter ansluter assistenten sig själv.
- *Slutpunkt* och *Autentisering*: de separata uppgifterna. Slutpunkten är `http://localhost:3877/mcp` med transporten *streamable HTTP*. Varje begäran behöver en header `Authorization: Bearer` följt av din token. Din klient måste också stödja MCP-sessioner: när den ansluter ger bryggan en sessionskod i headern `Mcp-Session-Id`, och bryggan avvisar varje senare begäran utan den koden. Claude Code och `mcp-remote` gör detta av sig själva.

**Anslut på nytt efter en uppdatering av appen.** Om din AI-klient redan var ansluten till en äldre version av appen, skickar den ännu ingen sessionskod. Då avvisar bryggan varje begäran. Anslut därför på nytt efter uppdateringen: starta en ny session i Claude Code, och avsluta Claude Desktop helt och starta det igen.

**Claude Code.** Konfigurationsfragmentet passar direkt i Claude Code. Kör det här kommandot i en terminal, med din egen token i stället för `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Du kan också lägga fragmentet i filen `.mcp.json` i din projektmapp. Lägg då inte den filen i git, eftersom token ger åtkomst till din plan. En server från `.mcp.json` måste godkännas första gången i Claude Code.

**Claude Desktop.** Konfigurationsfragmentet passar inte direkt i Claude Desktop. I filen `claude_desktop_config.json` anger du ett program som Claude Desktop startar själv, inte en adress. Använd därför det externa verktyget `mcp-remote` däremellan. Det kräver Node.js. I Claude Desktop väljer du *Inställningar › Utvecklare › Redigera konfiguration*, lägger in detta i filen (med din egen token) och startar Claude Desktop igen:

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

Token står i `env` och inte i `args` med avsikt: på Windows bryter Claude Desktop ett argument som innehåller ett mellanslag. En *anpassad connector* i Claude (*Anpassa › Connectors*) fungerar inte med bryggan. Claude ansluter då från Anthropics moln, och det kan inte nå bryggan på din egen dator.

I gruppen *Anslutning* finns även fältet *Token*. Det är en lång, slumpmässig kod som appen skapar åt dig och sparar på den här datorn. I fönstret står det *Den här token ger åtkomst till den öppna planen. Dela den inte med andra.* Med ikonen *Ny token* skapar du en ny token. Appen frågar först *Om du skapar en ny token bryts alla befintliga anslutningar. Vill du fortsätta?* Om bryggan körs startar den om med den nya token. Den gamla token fungerar då inte längre.

### 4. Se vad AI:n gör

1. Klicka på *Uppgiftspanel* under *Uppgift*. I sidokolumnen öppnas panelen *AI-uppgifter*.
2. Varje anrop till bryggan står på en egen rad. Den nyaste står överst. Raden visar tid, vad som hände, hur lång tid det tog och om det lyckades. Klicka på en rad för att visa *Argument* och *Svar*.
3. Med *Rensa* tömmer du listan. Panelen behåller de senaste 500 anropen. Så länge inget har hänt står det *Ingen AI-uppgift ännu. Anrop till bryggan visas här.*

När AI-läget är på finns en punkt med *AI* längst ned till höger i statusfältet. Dess färg visar bryggans status. Klickar du på punkten går du till fliken *AI*.

### 5. Sätt gränser

Under *Säkerhet* finns knapparna som begränsar AI:n:

- *Stoppa tillfälligt*: AI:n får tillfälligt inte ändra något, men läsning är fortfarande tillåten. Bryggan är kvar aktiv. Knappen blir *Återuppta*.
- *Skrivskyddad*: alla verktyg som ändrar något avvisas så länge den är på.
- *Auto-backup: på*: innan AI:n gör den första ändringen i ett dokument skriver appen en IFC-backup. Den är på som standard. Med knappen stänger du av den. Då står det *Auto-backup: av*. Det sker en gång per dokument varje gång du startar bryggan.
- *Gör backup nu*: gör en backup av det aktiva dokumentet direkt. Därefter står det *Backup skapad:* med filnamnet.
- *Öppna backupmapp*: öppnar mappen med backuperna.

Backuperna ligger i mappen `ai-backups` i appens datamapp. Appen behåller de senaste backuperna och gallrar ut de äldre. Exakt hur det går till står i [AI-verktyg](docs://ref-ai-tools).

### 6. Låt assistenten planera väl

En assistent planerar bara väl om den känner planeringsreglerna. Varför det är viktigt och vad reglerna innehåller, läser du i [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling). Det här gör du själv:

1. **Gör inget för kärnreglerna.** De följer med när du ansluter. Om din klient lägger dem i sin systemprompt beror på klienten.
2. **Låt assistenten läsa guiden.** Anslutningsprompten i fönstret *Anslutningsuppgifter* ber assistenten att först läsa guiden med verktyget `planner_get_planning_guide`. Använder du inte prompten, be assistenten själv: *Läs planeringsguiden med planner_get_planning_guide först, innan du ändrar något.* Du kan själv läsa guiden på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Valfritt: installera skills.** Det fungerar bara med en assistent som stöder skills. Lägg `SKILL.md` från *goed-plannen* och *progress-update* i `.claude/skills/goed-plannen/SKILL.md` och `.claude/skills/progress-update/SKILL.md` i projektmappen som assistenten arbetar i. Eller under `~/.claude/skills/` för alla projekt.

Du får filerna på två sätt. Be assistenten anropa verktyget `planner_get_planning_guide` med `part` satt till `skill`. Svaret innehåller båda texterna och, för varje skill, de platser där den ska ligga. Eller ladda ner dem från `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` och `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Finns *goed-plannen* kvar från en äldre version av appen, ersätt den. Den gamla texten är på nederländska och pekar på hjälpartikeln i stället för guiden för assistenter.

Om du vill veta om assistenten verkligen läste guiden ser du i panelen *Uppgiftspanel*. Då finns ett anrop till `planner_get_planning_guide`. Svaret i slutet ska innehålla en lista med antaganden: uppskattade varaktigheter, vald uppdelning, samband som assistenten skapade själv och varje restriktion den satte. Saknas listan, be om den. Efter en framdriftsuppdatering enligt *progress-update* ska svaret ange rapportdatumet, det nya slutdatumet och avvikelsen mot baslinjen.

## Fallgropar och vad appen gör då

**AI:n ändrar något som du vill ta tillbaka.** Varje ändring av AI:n är ett steg som du ångrar med *Ångra* (Ctrl+Z). En serie ändringar som AI:n skickar som en enda helhet är ett steg. Därefter visas projektet som osparat. Efter en ändring beräknas tidsplanen om, så du behöver inte trycka på F5 själv.

**Appen avvisar ett anrop från AI:n.** Med *Stoppa tillfälligt* och *Skrivskyddad* avvisar appen alla ändringar. Läsning är fortfarande tillåten, inklusive att en föråldrad tidsplan beräknas om. Är du själv mitt i en redigering, till exempel när du drar en balk eller skriver i ett fält, får AI:n datumen från före din redigering. Då får den ett meddelande om att de är föråldrade. Har du en dialogruta öppen, till exempel inställningarna, en uppgiftsdialog eller välkomstfönstret, eller är presentationsläget på, avvisar appen alla anrop, även läsning, tills du stänger dialogrutan. AI:n får då ett felmeddelande med det interna namnet på det som är öppet, till exempel `showTaskDialog`. Bara `planner_get_planning_guide` fungerar fortfarande, eftersom den inte läser din tidsplan.

**Du byter flik medan AI:n arbetar.** AI:n arbetar i dokumentet där dess första ändring hamnade. Byter du flik under tiden, avvisar appen dess nästa ändring. Det gör den tills AI:n bekräftar att den vill arbeta i den andra fliken. Så hamnar inget i fel projekt.

**AI:n skriver eller öppnar en fil.** AI:n kan skriva en tidsplan som IFC-fil och öppna en tidsplansfil som en ny flik. Det kan den bara göra i din användarmapp. Den skriver bara över en befintlig fil om den uttryckligen ber om det.

**Statusen är *Port 3877 är upptagen*.** Ett annat program använder porten. Appens meddelande visas under statusen. Fältet för port är då kvar låst (*Kan bara ändras när servern är stoppad.*), trots att bryggan inte körs. Det finns ingen stoppknapp. Det är en känd brist. Tills den är åtgärdad: slå av *Aktivera AI-läge* och slå på det igen. Statusen är då tillbaka på *Av*, och du kan välja en annan port. Kopiera sedan anslutningsuppgifterna igen, eftersom slutpunkten innehåller porten.

**Klienten kan inte ansluta efter en ny token.** En ny token bryter alla befintliga anslutningar. Ge klienten den nya token, eller klistra in konfigurationsfragmentet igen.

**Du stoppade bryggan själv, och den startar inte av sig själv.** *Starta bryggan automatiskt* fungerar en gång varje gång appen startar. Stoppar du bryggan själv, slår appen inte tyst på den igen.

**Fliken *AI* är borta.** AI-läget är av. Slå på det i steg 1.

**En webbsida i din webbläsare kan inte prata med bryggan.** Bryggan avvisar alla anrop från en webbläsare och alla anrop utan rätt token.

## Se också

- [Ge feedback](docs://howto-feedback-geven): om anslutningen fungerar på ett annat sätt än här beskrivs, rapportera det.
- [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling): vad kopplingen är, varför assistenten arbetar i ditt öppna projekt och vad den får och inte får göra.
- [AI-verktyg](docs://ref-ai-tools): alla verktyg med `planner_*` per grupp, felkoderna och hur länge backuper sparas.
- [Planera väl](docs://gids-goed-plannen): planeringsprinciperna; assistenten får dem i en engelsk version med verktygen tillagda.
- [Inställningar](docs://ref-instellingen): AI-inställningarna.
