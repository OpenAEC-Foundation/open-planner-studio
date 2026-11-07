# Koppla en MCP-klient

Mål: låt en MCP-klient läsa med och arbeta i din tidsplan, med insyn i vad den gör och med gränser som du själv sätter.

## Snabbt: låt Claude göra det

Arbetar du med Claude Desktop eller Claude Code? Då kan Claude installera anslutningen själv:

1. Klicka på *Kopiera prompt* nedan.
2. Klistra in prompten i en ny chatt med Claude och skicka den.

Claude installerar sedan tillägget för Open Planner Studio och förklarar under tiden vad det gör. Om du själv måste göra något, till exempel klicka på *Installera* i Claude Desktop, säger Claude exakt vilket klick du ska göra. Du behöver ingen token för det.

```prompt
Installera tillägget för Open Planner Studio åt mig, så att du kan läsa och ändra mina tidsplaner för byggprojekt i Open Planner Studio. Gör så mycket du kan själv. Säg före varje steg i en enkel mening vad du ska göra och varför. Om du behöver mig, ställ en fråga i taget och vänta på mitt svar. Om jag själv måste göra något, säg exakt vilket enda klick eller vilken åtgärd det gäller, och var.

Det här behöver du veta:
- Tillägget är en enda fil, open-planner-studio-<version>.mcpb, i den senaste utgåvan: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Den direkta länken står i https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (filen vars namn slutar på .mcpb). Filen är en ZIP-fil.
- Tillägget fungerar med desktopappen Open Planner Studio och utan appen. När appen är öppen och dess MCP-brygga körs, arbetar du i planen som är öppen i appen. När appen är stängd arbetar du med tidsplanfiler i en arbetsmapp som jag väljer.
- Installationen kräver ingen token och inget lösenord. Be mig inte om någon, och läs eller visa ingen.

Om du körs i Claude Desktop:
1. Om du kan ladda ner en fil och öppna den på min dator, gör det med .mcpb-filen. Om du inte kan det, ge mig den direkta nedladdningslänken och säg att jag ska dubbelklicka på filen när nedladdningen är klar.
2. Claude Desktop visar sedan tillägget Open Planner Studio. Säg att jag ska klicka på Installera. Säg sedan att jag ska välja, vid Working folder, mappen med mina tidsplanfiler.
3. Säg att jag ska starta en ny chatt och där fråga dig vilka verktyg från Open Planner Studio du ser.

Om du körs i Claude Code:
1. Kontrollera att Node.js 22 eller nyare är installerat. Om det inte är det, säg hur jag installerar det, och stoppa.
2. Fråga mig i vilken mapp mina tidsplanfiler finns. Det är arbetsmappen.
3. Ladda ner .mcpb-filen och packa upp den i en ny, egen mapp i min användarmapp. Läs manifest.json där: server.mcp_config visar hur servern startar. Ersätt ${__dirname} med den uppackade mappen och ${user_config.workdir} med arbetsmappen.
4. Kör claude mcp list. Finns där redan en server med namnet open-planner-studio, fråga mig om du får ersätta den. Visa inte dess inställningar, eftersom de kan innehålla en token.
5. Lägg till servern för mitt användarkonto, till exempel: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<arbetsmapp> -- node <uppackad mapp>/server/index.mjs
6. Säg att jag ska starta en ny Claude Code-session, och att /mcp där visar om open-planner-studio är ansluten.

Om du körs någon annanstans, till exempel claude.ai i webbläsaren, säg att det kräver Claude Desktop eller Claude Code. Om du inte vet var du körs, fråga mig.

När installationen är klar förklarar du det i några meningar:
- hur jag låter dig arbeta i den öppna appen: välj i Open Planner Studio Inställningar › Projekt › Appinställningar, fliken Avancerat, och slå på Tillåt MCP-anslutning. Klicka sedan på Starta bryggan på fliken MCP.
- att en ändring utan appen bara finns i filen när du har sparat den, och att du inte skriver över en befintlig fil medan appen är öppen.
Om ett steg misslyckas, säg till mig i en mening vad som gick fel och vad jag kan göra. Gissa inte.
```

Vill du hellre göra det själv, eller använder du en annan MCP-klient? Då följer du stegen nedan.

## När du behöver det

Du vill att en MCP-klient ska läsa, analysera eller ändra din tidsplan. Till exempel att den tar fram ett första WBS, rättar uppgifter eller förklarar den kritiska linjen. Det fungerar via **Model Context Protocol** (MCP): en standard som låter ett AI-program, **MCP-klienten**, använda verktyg från ett annat program. För det kör Open Planner Studio en liten server på din egen dator, **bryggan**. Den erbjuder en uppsättning verktyg, alla med ett namn som börjar med `planner_`: att läsa och ändra uppgifter, samband, resurser, kalendrar, baslinjer, dokument och filer. Vilka verktyg som finns och vad de inte tillåter står i [MCP-verktyg](docs://ref-ai-tools). MCP-klienten arbetar i projektet som du har öppet, inte i en kopia: en uppgift som den lägger till syns direkt i Gantt. Den använder samma beräkning och samma *Ångra*-historik som du.

Bryggan fungerar bara i desktopappen. Om du tillåter MCP-anslutningen i webbläsaren ser du fliken *MCP*, men knappen *Starta bryggan* är grå med texten *Bryggan fungerar bara i desktopappen.* Resten av den här artikeln handlar om desktopappen. I webbläsaren är också *Gör backup nu* och *Öppna backupmapp* gråa.

## Steg

### 1. Tillåt MCP-kopplingen

1. Välj *Inställningar › Projekt › Appinställningar*. Du kan också välja *Fil › Appinställningar*, eller kugghjulet överst.
2. Välj fliken *Avancerat* och aktivera *Tillåt MCP-koppling*. Fliken *MCP* visas i menyfliksområdet.
3. Om du vill att bryggan ska vara aktiv så snart appen startar, aktivera också *Starta bryggan automatiskt*. Inställningen fungerar bara när MCP-kopplingen är på, och bara i skrivbordsappen. Den är av som standard, eftersom det är ett medvetet val att öppna en port.

Om du stänger av MCP-kopplingen stoppas bryggan och fliken *MCP* försvinner.

### 2. Starta bryggan

1. Gå till fliken *MCP* och klicka på *Starta bryggan* under *Server*.
2. Titta på statusen bredvid knappen. Där står *Av*, *Aktiv på port 3877*, *Port 3877 är upptagen* eller *Fel*. Om starten lyckas står där *Aktiv på port 3877* och knappen heter *Stoppa bryggan*. Vid *Port 3877 är upptagen* eller *Fel* heter knappen kvar *Starta bryggan*; se fallgroparna.

Bryggan lyssnar bara på din egen dator, på en enda port. Som standard är det port 3877. I gruppen *Anslutning* kan du välja en annan under *Port*, men bara när bryggan är stoppad. Anslutningen är vanlig HTTP på din egen dator. Appen skickar inget ut själv. Vad MCP-klienten gör med din tidsplan, till exempel vad dess leverantör gör med den, ligger utanför appen.

### 3. Anslut MCP-klienten

1. Klicka på *Anslut* under *Anslutning*. Fönstret *Anslutningsuppgifter* öppnas.
2. Välj vad din klient behöver, se nedan.
3. Tokenen är dold. Med ögonikonen visar du den. Kopieringsknapparna kopierar alltid det riktiga värdet, även om skärmen döljer tokenen.
4. Låt MCP-klienten begära listan med verktyg. Den kontrollen finns också i anslutningsprompten: den ska se verktygen med prefixet `planner_`. Det förväntade antalet står i anslutningsprompten.

Fönstret erbjuder fyra sätt att ansluta:

- *Låt Claude ordna det*: samma prompt som överst i den här artikeln, med knappen *Kopiera prompt*. Den är till för Claude Desktop och Claude Code. Du behöver ingen token för den.
- *Konfigurationsfragment*: ett stycke konfiguration som du klistrar in i MCP-inställningarna i din klient.
- *Anslutningsprompt*: en text som du klistrar in i din MCP-klient, varefter klienten ansluter sig själv.
- *Slutpunkt* och *Autentisering*: de separata uppgifterna. Slutpunkten är `http://localhost:3877/mcp` med transporten *streamable HTTP*. Varje begäran behöver en header `Authorization: Bearer` följt av din token. Klienten måste också stödja MCP-sessioner: när den ansluter ger bryggan en sessionskod i headern `Mcp-Session-Id`, och bryggan vägrar varje senare begäran utan den koden. Claude Code och `mcp-remote` gör detta själva.

**Anslut igen efter en uppdatering av appen.** Om din MCP-klient redan var ansluten till en äldre version av appen, skickar den ännu ingen sessionskod, och bryggan vägrar varje begäran. Anslut därför igen efter uppdateringen: starta en ny session i Claude Code, och avsluta Claude Desktop helt och starta det igen.

**Claude Code.** Konfigurationsfragmentet passar direkt i Claude Code. Kör det här kommandot i en terminal, med din egen token i stället för `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Du kan också lägga fragmentet i filen `.mcp.json` i din projektmapp. Lägg då inte den filen i git, eftersom token ger åtkomst till din plan. En server från `.mcp.json` måste godkännas första gången i Claude Code.

**Claude Desktop.** För Claude Desktop finns ett tillägg: filen `open-planner-studio-<version>.mcpb`. Claude Desktop installerar den med ett dubbelklick. Du behöver inte Node.js för det. Tillägget fungerar med appen och utan appen. Det går snabbare med prompten överst i den här artikeln. Nedan följer stegen för hand.

1. Ladda ner filen `.mcpb` från den senaste utgåvan: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Dubbelklicka på filen. Claude Desktop öppnas och visar tillägget *Open Planner Studio*. Installera det. Om ett dubbelklick inte fungerar, öppna *Inställningar › Tillägg* i Claude Desktop och installera filen där.
3. Under *Working folder* väljer du mappen med dina tidsplanfiler. Claude använder bara den mappen när appen är stängd. Claude läser och skriver sedan bara i den mappen.
4. Aktivera tillägget och starta en ny chatt. Fråga Claude vilka verktyg i Open Planner Studio som Claude ser.

Du anger ingen token och ingen port: medan bryggan körs hittar tillägget appen själv. För varje fråga från Claude väljer tillägget på nytt:

- *Appen är öppen och bryggan körs*: Claude arbetar i planen som är öppen i appen. Du ser varje ändring i appen direkt.
- *Appen är stängd, eller bryggan är av*: Claude arbetar i en tidsplanfil i arbetsmappen. En ändring finns i filen bara när Claude sparar filen. Det finns ingen automatisk sparning. Medan appen är öppen skriver Claude inte över en befintlig fil, utan sparar under ett nytt namn.

Om appen öppnas eller stängs medan Claude arbetar, byter tillägget och säger till Claude. Claude väljer eller öppnar då planen igen först, och ändrar något först därefter. Om Claude fortfarande har ändringar utan appen som inte är sparade, fortsätter tillägget att arbeta utan appen tills Claude har sparat dem. Så går inget arbete förlorat. Kan tillägget inte nå appen och finns ingen användbar arbetsmapp, ser Claude bara verktyget `open_planner_studio_status`, med ett meddelande som talar om vad du ska göra.

**Claude Desktop utan tillägget.** Kan du inte använda tillägget, anslut Claude Desktop med det externa verktyget `mcp-remote`. Konfigurationsfragmentet passar inte direkt i Claude Desktop: i filen `claude_desktop_config.json` anger du ett program som Claude Desktop startar själv, inte en adress. `mcp-remote` kräver Node.js. I Claude Desktop väljer du *Inställningar › Utvecklare › Redigera konfiguration*, lägger in detta i filen (med din egen token) och startar Claude Desktop igen:

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

Tokenen står i `env` och inte i `args` med avsikt: på Windows bryter Claude Desktop ett argument som innehåller ett mellanslag. En *anpassad anslutning* i Claude (*Anpassa › Anslutningar*) fungerar inte med bryggan. Claude ansluter då från Anthropics moln, och det kan inte nå bryggan på din egen dator.

I gruppen *Anslutning* finns också fältet *Token*. Det är en lång, slumpmässig kod som appen skapar åt dig och lagrar på den här datorn. I fönstret står det *Den här token ger åtkomst till den öppna planen. Dela den inte med andra*. Med ikonen *Ny token* skapar du en ny token. Appen frågar först *Om du skapar en ny token bryts alla befintliga anslutningar. Vill du fortsätta?* Körs bryggan startar den om med den nya tokenen, och den gamla fungerar inte längre.

**Så hittar tillägget appen.** Medan bryggan körs skriver skrivbordsappen porten och token till filen `mcp/runtime.json` i appens datamapp. Tillägget för Claude Desktop läser den filen vid varje fråga. På Linux och macOS kan bara ditt användarkonto läsa filen. På Windows skyddar standardbehörigheterna för din profilmapp filen; appen kontrollerar inte det separat. När du stoppar bryggan eller stänger av MCP-kopplingen tar appen bort filen. Appen håller dessutom en lista över öppna filer i `mcp/open-files.json`, även när MCP-kopplingen är av. Så länge den filen finns skriver varken tillägget eller den fristående MCP-servern över någon befintlig fil, inte heller en fil som du just har öppnat och som ännu inte står i listan. En ny fil är tillåten. Läsning är också tillåten: Claude ser då versionen på disken, utan dina ändringar som ännu inte är sparade.

### 4. Se vad MCP-klienten gör

1. Klicka på *Uppgiftspanel* under *Uppgift*. I sidokolumnen öppnas panelen *MCP-uppgifter*.
2. Varje anrop till bryggan står på en rad, med det nyaste överst: tid, vad som hände, hur lång tid det tog och om det lyckades eller inte. Klicka på en rad för att visa *Argument* och *Svar*.
3. Med *Rensa* tömmer du listan. Panelen sparar de senaste 500 anropen. Så länge ingenting har hänt står där *Inga MCP-uppgifter ännu. Anrop till bryggan visas här.*

Med MCP-kopplingen på finns en prick med *MCP* längst ner till höger i statusfältet. Färgen visar bryggans status, och ett klick på den tar dig till fliken *MCP*.

### 5. Sätt gränser

Under *Säkerhet* finns knapparna som du använder för att sätta gränser för MCP-klienten:

- *Stoppa tillfälligt*: MCP-klienten får tillfälligt inte ändra något, men läsning är fortfarande tillåten. Bryggan förblir aktiv. Knappen blir *Återuppta*.
- *Skrivskyddad*: alla verktyg som ändrar något avvisas så länge den är på.
- *Auto-backup: på*: innan MCP-klienten gör den första ändringen i ett dokument skriver appen en IFC-backup. Den är på som standard. Med knappen stänger du av den, och då står där *Auto-backup: av*. Detta sker en gång per dokument varje gång du startar bryggan.
- *Gör backup nu*: gör en backup av det aktiva dokumentet direkt. Därefter står där *Backup skapad:* med filnamnet.
- *Öppna backupmapp*: öppnar mappen med backuperna.

Backuperna finns i mappen `ai-backups` i appens datamapp. Appen behåller de senaste backuperna och gallrar ut de äldre. Exakt hur det går till står i [MCP-verktyg](docs://ref-ai-tools).

### 6. Låt MCP-klienten planera väl

En MCP-klient planerar bara väl om den känner till planeringsreglerna. Det här gör du själv:

1. **Gör ingenting för kärnreglerna.** De följer med vid anslutningen: bryggan skickar dem i fältet `instructions` i MCP-handskakningen. Om din klient lägger dem i sin systemprompt beror på klienten.
2. **Låt guiden läsas.** Anslutningsprompten i fönstret *Anslutningsuppgifter* ber MCP-klienten att läsa guiden med verktyget `planner_get_planning_guide`. Använder du inte prompten, fråga dig själv: *Läs planeringsguiden med planner_get_planning_guide först, innan du ändrar något.* Du kan själv läsa guiden på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Valfritt: installera skills.** Det fungerar bara med en MCP-klient som stödjer skills. Lägg `SKILL.md` för *goed-plannen* och *progress-update* i `.claude/skills/goed-plannen/SKILL.md` och `.claude/skills/progress-update/SKILL.md` i projektmappen där MCP-klienten arbetar, eller under `~/.claude/skills/` för alla projekt.

Du får filerna på två sätt. Be MCP-klienten att anropa verktyget `planner_get_planning_guide` med `part` satt till `skill`: svaret innehåller båda texterna och, för varje skill, de platser där den hör hemma. Eller ladda ner dem från `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` och `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Finns *goed-plannen* kvar från en äldre version av appen, ersätt den: den gamla texten är på nederländska och hänvisar till hjälpartikeln i stället för till guiden för MCP-klienter.

Om MCP-klienten verkligen har läst guiden ser du det i panelen *Uppgiftspanel*: då finns ett anrop till `planner_get_planning_guide`. Det slutliga svaret ska innehålla en lista med antaganden: uppskattade varaktigheter, den valda nedbrytningen, samband som den själv har skapat och varje restriktion som den har satt. Saknas listan, be om den. Efter en framdriftsuppdatering enligt *progress-update* ska svaret ange rapportdatumet, det nya slutdatumet och avvikelsen mot baslinjen.

## Fallgropar och vad appen gör då

**MCP-klienten ändrar något som du vill ta tillbaka.** Varje ändring av MCP-klienten är ett steg som du ångrar med *Ångra* (Ctrl+Z). En serie ändringar som MCP-klienten lämnar över som en helhet är ett enda steg. Därefter visas projektet som osparat. Efter en ändring beräknas tidsplanen om, så du behöver inte trycka på F5 själv.

**Appen vägrar ett anrop från MCP-klienten.** Med *Stoppa tillfälligt* och *Skrivskyddad* vägrar appen alla ändringar, men läsning är fortfarande möjlig. Även att beräkna om en inaktuell tidsplan är fortfarande möjligt. Om du själv är mitt i en redigering, till exempel när du drar i en balk eller skriver i ett fält, får MCP-klienten de datum som gällde före din redigering, med ett meddelande om att de är inaktuella. Har du en dialogruta öppen, till exempel inställningarna, en uppgiftsdialog eller välkomstfönstret, eller är presentationsläget på, vägrar appen alla anrop, även läsning, tills du stänger dialogrutan. MCP-klienten får då ett felmeddelande med det interna namnet på det som är öppet, till exempel `showTaskDialog`. Bara `planner_get_planning_guide` fungerar fortfarande, eftersom den inte läser din tidsplan.

**Du byter dokumentflik medan MCP-klienten arbetar.** MCP-klienten arbetar i dokumentet där dess första ändring hamnade. Byter du dokumentflik under tiden, vägrar appen nästa ändring från MCP-klienten tills MCP-klienten har bekräftat att den vill arbeta i den andra fliken. Så hamnar ingenting i fel projekt. Om MCP-klienten själv öppnar eller duplicerar ett dokument, arbetar den i det nya dokumentet efteråt.

**MCP-klienten skriver eller öppnar en fil.** MCP-klienten kan skriva en tidsplan som IFC-fil och öppna en tidsplanfil som en ny dokumentflik. Det kan den bara göra inom din användarmapp. Den skriver bara över en befintlig fil om den uttryckligen ber om det.

**Statusen är *Port 3877 är upptagen*.** Ett annat program använder porten. Appens meddelande visas under den. Portfältet är då låst (*Kan bara ändras när servern är stoppad.*), trots att bryggan inte körs, och det finns ingen stoppknapp. Det är ett känt problem. Tills det är åtgärdat: stäng av *Tillåt MCP-koppling* och aktivera den igen. Statusen står då åter på *Av*, och du kan välja en annan port. Kopiera sedan anslutningsuppgifterna igen, eftersom slutpunkten innehåller porten.

**Klienten kan inte ansluta efter en ny token.** En ny token bryter alla befintliga anslutningar. Ge klienten den nya tokenen, eller klistra in konfigurationsfragmentet igen. Tillägget i Claude Desktop läser den nya tokenen själv; där behöver du inte göra något.

**Du stoppade bryggan själv och den startar inte av sig själv.** *Starta bryggan automatiskt* fungerar en gång varje gång appen startar. Stoppar du bryggan själv, slår appen inte tyst på den igen.

**Fliken *MCP* är borta.** MCP-kopplingen är av. Aktivera den i steg 1.

**En webbsida i din webbläsare kan inte prata med bryggan.** Bryggan vägrar varje begäran som kommer från en webbläsare, och varje begäran utan rätt token.

## Utan appen

Det finns också en **MCP-server utan gränssnitt**, som fungerar utan skrivbordsappen. Den erbjuder samma `planner_*`-verktyg, men den arbetar med en tidsplanfil på disken i stället för med ditt öppna projekt. Därför ser du inte ändringarna i Gantt-diagrammet, och *Ångra* i appen gäller inte för dem. Använd den när du inte vill ha appen öppen, eller på en dator utan skärm.

Tillägget för Claude Desktop startar den här servern av sig själv när appen är stängd (se steg 3). Stegen nedan gäller för en annan MCP-klient, till exempel Claude Code.

Versionen innehåller ingen färdig serverfil att ladda ner. Du bygger den från källkoden med `npm run build:mcp-server`. Det kräver Node.js 22 eller nyare. Resultatet är en enda fil, `server.mjs`.

1. Välj en arbetsmapp med dina tidsplanfiler. Servern läser och skriver bara i den mappen.
2. Anslut din MCP-klient. För Claude Code står kommandot under de här stegen.
3. Be MCP-klienten att öppna en tidsplan, till exempel `~/plan.ifc`. I den här servern betyder `~` arbetsmappen.
4. Be MCP-klienten att spara resultatet. Det finns ingen automatisk sparning: MCP-klienten skriver filen med `planner_export_ifc`. Det som inte sparas går förlorat när servern stoppas.

För steg 2 i Claude Code, ge det här kommandot i en terminal, med dina egna sökvägar:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Före den första ändringen i varje dokument gör servern en MCP-säkerhetskopia, precis som appen. En MCP-klient som väljer en sökväg utanför arbetsmappen, även via en genväg (symbolisk länk), avvisas. Medan appen är öppen skriver servern inte över en befintlig fil.

## Se även

- [Ge feedback](docs://howto-feedback-geven): om anslutningen fungerar annorlunda än det som beskrivs här, rapportera det.
- [MCP-verktyg](docs://ref-ai-tools): alla `planner_*`-verktyg per grupp, felkoderna och hur länge säkerhetskopiorna behålls.
- [Appinställningar](docs://ref-instellingen): MCP-inställningarna.
