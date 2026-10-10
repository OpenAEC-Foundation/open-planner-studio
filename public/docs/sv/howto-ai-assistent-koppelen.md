# Ansluta en AI-assistent (MCP)

Mål: låt en AI-assistent läsa med och arbeta i din tidsplan. Du ser vad den gör. Du sätter själv gränserna.

## När du behöver det

Du vill att en AI-assistent läser, analyserar eller ändrar din tidsplan. Till exempel för att den ska ta fram ett första WBS, rätta uppgifter eller förklara den kritiska linjen. Det fungerar via **Model Context Protocol** (MCP): en standard som låter en AI-assistent använda verktyg i ett program. Därför kör Open Planner Studio en liten server på din egen dator, **bryggan**. Bryggan erbjuder en uppsättning verktyg. Alla namn börjar med `planner_`: läsa och ändra uppgifter, samband, resurser, kalendrar, baslinjer, dokument och filer. Vilka verktyg det finns och vad de avvisar står i [AI-verktyg](docs://ref-ai-tools). Varför kopplingen fungerar så står i [Så fungerar AI-kopplingen](docs://uitleg-ai-koppeling).

Bryggan fungerar bara i desktopappen. Slår du på AI-läget i webbläsaren, ser du fliken *AI*. Knappen *Starta bryggan* är då grå, med texten *Bryggan fungerar bara i desktopappen.* Resten av den här artikeln gäller desktopappen. I webbläsaren är *Gör backup nu* och *Öppna backupmapp* också grå.

## Steg

### 1. Slå på AI-läge

1. Välj *Inställningar › Projekt › Inställningar*. Du kan också välja *Fil › Inställningar*, eller kugghjulet högst upp.
2. Välj fliken *Avancerat* och slå på *Aktivera AI-läge*. Fliken *AI* visas i menyfliksområdet.
3. Vill du att bryggan är aktiv så snart appen startar, slå då också på *Starta bryggan automatiskt*. Det fungerar bara när AI-läget är på, och bara i desktopappen. Den är av som standard, eftersom det är ett avsiktligt val att öppna en port.

Slår du av AI-läget, stoppas bryggan och fliken *AI* försvinner.

### 2. Starta bryggan

1. Gå till fliken *AI* och klicka på *Starta bryggan* under *Server*.
2. Titta på statusen bredvid knappen. Den säger *Av*, *Aktiv på port 3877*, *Port 3877 är upptagen* eller *Fel*. Lyckas starten, då visar den *Aktiv på port 3877* och heter knappen *Stoppa bryggan*. Vid *Port 3877 är upptagen* eller *Fel* heter knappen kvar *Starta bryggan*. Se fallgroparna.

Bryggan lyssnar bara på din egen dator, på en enda port. Som standard är det port 3877. I gruppen *Anslutning* kan du välja en annan port under *Port*. Det går bara när bryggan är stoppad.

### 3. Anslut assistenten

1. Klicka på *Anslut* under *Anslutning*. Fönstret *Anslutningsuppgifter* öppnas.
2. Välj vad din klient behöver. Se nedan.
3. Token är dold. Med ögonikonen visar du den. Kopieringsknapparna kopierar alltid det riktiga värdet, även när skärmen döljer token.
4. Låt assistenten begära listan med verktyg. Den kontrollen finns också i anslutningsprompten. Assistenten ska se verktyg med prefixet `planner_`. Det förväntade antalet står i anslutningsprompten.

Fönstret erbjuder tre sätt att ansluta:

- *Konfigurationsfragment*: ett stycke konfiguration som du klistrar in i MCP-inställningarna i din klient.
- *Anslutningsprompt*: en text som du klistrar in i din AI-assistent. Därefter ansluter assistenten sig själv.
- *Slutpunkt* och *Autentisering*: de separata uppgifterna. Slutpunkten är `http://localhost:3877/mcp` med transporten *streamable HTTP*. Varje begäran behöver en header `Authorization: Bearer` följt av din token.

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

En assistent som känner verktygen kan ändå bygga en tidsplan som ingen planerare har nytta av: uppgifter utan samband, ett fast datum på varje uppgift eller en uppdelning som är alldeles för fin. Därför får assistenten planeringsreglerna på tre sätt. För de två första behöver du inget göra.

1. **Kärnreglerna följer med av sig själva.** När du ansluter skickar bryggan en kort text med kärnreglerna. Många klienter lägger den i sin systemprompt. Om din klient gör det beror på klienten. Texten säger bland annat: börja med milstolpar, bygg uppgifter som tar ungefär en dag till två veckor, styr tidsplanen med samband i stället för fasta datum och redovisa till slut vad du antog.
2. **Anslutningsprompten pekar mot hela guiden.** Anslutningsprompten i fönstret *Anslutningsuppgifter* ber assistenten att först läsa planeringsguiden med verktyget `planner_get_planning_guide`. Det ger en engelsk guide för assistenter: samma principer som [Planera väl](docs://gids-goed-plannen), med för varje princip de verktyg som assistenten använder för den. Du kan själv läsa guiden på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Använder du inte prompten, be assistenten själv: *Läs planeringsguiden med planner_get_planning_guide först, innan du ändrar något.*
3. **Valfritt: skills.** En skill är en liten fil med instruktioner som en assistent läser i varje session. Så vet den också i ett senare samtal hur den ska arbeta. Det finns två skills, båda på engelska: *goed-plannen* för att sätta upp eller ordna om en tidsplan, och *progress-update* för den veckovisa uppdateringen av framdriften. Det fungerar bara med en assistent som stöder skills. Skillsen själva nämner Claude Code och liknande assistenter. Varje skill är en fil `SKILL.md` i en egen mapp med skillens namn: `.claude/skills/goed-plannen/SKILL.md` och `.claude/skills/progress-update/SKILL.md` i projektmappen som assistenten arbetar i. Eller samma mappar under `~/.claude/skills/` om du vill ha dem i alla projekt.

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
