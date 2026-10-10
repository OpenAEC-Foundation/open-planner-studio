# Så fungerar AI-kopplingen

Vad händer egentligen när en AI-assistent arbetar i din tidsplan? I den här artikeln läser du vad kopplingen är, varför den skiljer sig från att utbyta en fil, vilka gränser appen bevakar själv och hur assistenten får veta hur en tidsplan ska byggas. Exemplet i slutet visar med siffror vad en assistent kan göra i ett svep och vad du får ut av det.

## Begreppet

En AI-assistent, till exempel ett chattprogram eller ett programmeringsverktyg, kan styra ett annat program via **Model Context Protocol** (MCP). Open Planner Studio spelar servern i det utbytet. Skrivbordsappen kör en liten server på din egen dator, **bryggan**. Assistenten ansluter till den och får en lista med **verktyg**: funktioner med ett namn som börjar med `planner_`, till exempel läsa uppgifter, lägga till ett samband eller spara en baslinje. Vilka det finns beskrivs i [AI-verktyg](docs://ref-ai-tools).

Det märkliga är att assistenten arbetar i det projekt som du har öppet just då, inte i en kopia. Du exporterar inget och importerar inget, och det finns inget ögonblick då du och assistenten tittar på två olika versioner. En uppgift som assistenten lägger till syns direkt i Gantt. Appen tar det på allvar: assistenten arbetar med samma beräkning, samma ångrahistorik och samma regler som du.

Hur du slår på kopplingen står i [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen). Nedan läser du hur den fungerar.

## Så hanterar appen det

### En server som bara din egen dator hör

Bryggan lyssnar bara på din egen dator (`127.0.0.1`), på en port, som standard 3877. Den tar bara emot förfrågningar på adressen `/mcp`, och bara med din **token** i huvudet `Authorization: Bearer`. Den avvisar en förfrågan utan rätt token. En förfrågan från en webbläsare känner den igen på ett `Origin`-huvud och avvisar den också, så att en webbsida som du råkar ha öppen inte kan prata med din tidsplan. Den behandlar förfrågningar strikt en i taget.

Anslutningen är vanlig HTTP på din egen dator; appen själv skickar ingenting ut. Vad en assistent gör med tidsplanen som den läser, till exempel vad dess leverantör gör med den, avgörs av assistenten och ligger utanför appen.

### Assistenten arbetar i ett dokument

Vid sin första ändring binder bryggan anslutningen till det dokument som är aktivt då. Byter du flik själv efteråt, så vägrar appen assistentens nästa ändring (kod `DOC_DRIFT`) tills den bekräftar med `planner_switch_document` vilket dokument den vill arbeta i. Så hamnar inget i fel projekt. En assistent som öppnar eller kopierar ett dokument själv arbetar sedan i det nya dokumentet.

### Varje ändring beräknar om

I appen planerar du för hand: du ändrar något och trycker sedan på *Beräkna* (F5), om inte *Beräkna automatiskt* är på. Det gäller inte för en ändring av assistenten. Varje skrivåtgärd av assistenten går via en transaktion. Ändrar den projektdata, så beräknar appen till slut om av sig själv, en gång per skript. Ett läsverktyg ger alltid aktuella datum: är tidsplanen inaktuell, till exempel för att du har ändrat något själv och ännu inte har tryckt på *Beräkna*, så beräknar läsverktyget först om. Ett undantag finns: står projektet i vyn *Datum som registrerats* (efter en import), så beräknar ett läsverktyg inte tyst om, för det skulle ersätta de datumen. Assistenten får då de registrerade datumen, med en notis att de inte har räknats om. En ändring av assistenten själv beräknar alltid om, även då. Du behöver inte trycka på *Beräkna* efter en ändring av assistenten. Den läser sedan resultatet, till exempel projektets slutdatum och den kritiska linjen, tillbaka med läsverktygen. Se också [Datum som registrerats](docs://uitleg-datums-zoals-opgeslagen).

### Ett skript är ett steg

En assistent kan skicka en serie steg som en helhet med `planner_batch`, ett skript med högst 100 steg. Då får du ett ångrasteg, en omberäkning och en säkerhetskopia. Är ett steg strukturellt fel, till exempel ett okänt verktyg eller en cirkelreferens, så rullar appen tillbaka hela skriptet. Du får aldrig en halvfärdig tidsplan. En avvisning av ett enskilt objekt i ett massteg, till exempel en ogiltig framdriftsrad av tjugo, är mildare: det objektet hoppas över och resten utförs. Avvisningarna står överst i svaret.

### Dina gränser

Du ställer in fyra saker själv, i fliken *AI*:

- *Stoppa tillfälligt* och *Skrivskyddad* håller assistenten ansluten, men vägrar varje ändring. Läsning är fortfarande möjlig, även omberäkningen av en inaktuell tidsplan vid läsning: det är beräknade fält, inga projektdata. Därför läggs inget ångrasteg till och projektet räknas inte som ändrat. Redigerar du själv just nu, till exempel genom att dra i en balk eller skriva i ett fält, så beräknar ett läsverktyg inte om. Assistenten får då datumen från före din redigering, med en notis att de är inaktuella.
- En öppen dialog blockerar allt. Med till exempel uppgiftsdialogen, inställningarna, presentationsläget eller välkomstfönstret öppet vägrar appen även läsning, eftersom du är mitt i en manuell åtgärd. Assistenten får felkoden `DIALOG_OPEN`. Meddelandet anger det interna namnet på det som är öppet, till exempel `showTaskDialog` för uppgiftsdialogen.
- *Automatisk säkerhetskopiering* skriver en IFC-kopia före den första ändringen per dokument. Lyckas inte den kopian, så utför appen inte ändringen.
- Panelen *Uppgiftspanel* visar varje anrop, med argument och svar.

Utöver det gäller din vanliga *Ångra* (Ctrl+Z). Assistenten delar den historiken med dig och har själv `planner_undo` och `planner_redo`.

### Vad assistenten inte kan

Bryggan är med avsikt smalare än appen. Det som assistenten inte kan har vanligen en av tre orsaker.

**Den når längre än projektet.** Assistenten kan inte ändra biblioteket för resurser. Biblioteket delas av alla dina projekt och ligger utanför ångrahistoriken; en ändring av en standardkostnad skulle då gälla i projekt som inte ens är öppna. För en resurs från ett bibliotek är namn, typ, beskrivning, standardkostnad och enhet fasta, precis som i resurspanelen. Det som projektet bestämmer blir kvar hos assistenten: max tilldelningsenheter, tillgänglighet över tid, kalender och besättning. Den kan inte heller välja vilken kalender som är projektkalender. Den kan läsa beräkningsprofilen och beräkningsalternativen men inte ändra dem; den kan bara ställa in framdriftsläget och projektstandarden för arbetsregeln. Det finns inga verktyg för inställningar, tema, språk, tillägg eller uppdateringar.

**Den lämpar sig inte för pålitlig validering.** Assistenten kan inte sätta en hängmatta, planera en uppgift manuellt, sätta en andra restriktion, fylla i anteckningar, färger, uppgiftskoder, egna fält eller externa länkar, och den kan inte sätta en förskjutning pga utjämning för hand. Den väljer inte heller en WBS-kod; appen härleder den själv.

**Den rör vid något som du måste bestämma själv.** Den registrerar bara framdrift om det finns ett rapportdatum. Det väljer den inte själv: det är din referensdag. Har en uppgift som ännu inte har startat en planerad start efter rapportdatumet, då måste den ange den verkliga starten. Den läser och skriver filer enbart i din användarmapp, och den skriver bara över en befintlig fil om den uttryckligen begär det. En export är inte ett *Spara*: projektet förblir osparat i appen.

### Så vet assistenten hur den ska planera

En assistent som kan verktygen kan ändå bygga en tidsplan som ingen planerare har nytta av: uppgifter utan samband, ett fast datum på varje uppgift, eller en nedbrytning som är alldeles för detaljerad. Därför ger appen den tre saker.

**De kärnregler i handskakningen.** När den ansluter skickar bryggan en kort text i fältet `instructions` i MCP-handskakningen. Många klienter lägger den texten i sin systemprompt; om din gör det beror på klienten. Reglerna: börja vid milstolparna och leveransdatumet, bygg uppgifter på ungefär en dag till två veckor, styr tidsplanen med samband i stället för fasta datum, använd restriktioner endast för hårda externa datum, åtgärda först en misslyckad beräkning, använd `planner_batch` för en sammanhängande serie, registrera framdrift endast med ditt rapportdatum och de verkliga datum du anger, och säg till sist vad du antog och vad du medvetet inte gjorde.

**Guiden för assistenter.** Verktyget `planner_get_planning_guide` returnerar en guide som är skriven särskilt för assistenter. Den följer samma principer som [Planera bra](docs://gids-goed-plannen), men en assistent arbetar annorlunda än du: den trycker inte på F5 och klickar inte i menyfliksområdet, den anropar verktyg och appen beräknar om åt den. Därför anger guiden för varje princip vilka verktyg assistenten använder för den, och förklarar vad assistenten gör med *Datum som registrerats* eller en misslyckad beräkning. Guiden är på engelska, liksom allt som assistenten läser via kopplingen; verktyget accepterar fortfarande ett språkval för äldre assistenter, men det ändrar inte texten. Du kan läsa den själv på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Anslutningsprompten i fönstret *Anslutningsuppgifter* ber assistenten att först läsa guiden. Verktyget fungerar också när en dialog är öppen, vid paus och i skrivskyddat läge, eftersom det inte läser din tidsplan.

**Två skills.** En skill är en liten fil med instruktioner som en assistent läser i varje session. Det finns två, eftersom det är två slags arbete. Att sätta upp en tidsplan handlar om logik; att uppdatera framdrift handlar om fakta som bara du känner till. Skillen *goed-plannen* är för att sätta upp eller omstrukturera en tidsplan: i vilken ordning verktygen används, beräkningsregeln, `planner_batch` och skyldigheten att redovisa antaganden. Skillen *progress-update* är för den veckovisa framdriftsuppdateringen: först ditt rapportdatum, sedan de verkliga start- och slutdatumen samt slutförandegrad, och därefter en rapport om avvikelsen mot baslinjen, den kritiska linjen och det nya slutdatumet. Planeringsprinciperna själva finns i guiden. Båda skills är på engelska. Verktyget returnerar båda och anger var de hör hemma. Hur du installerar dem beskrivs i [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Ett exempel

Du ber en assistent: bygg en tillbyggnad med foundation, brickwork and roof, i den ordningen. Ditt projekt startar måndag 2 mars 2026. Assistenten läser först guiden och skickar sedan ett enda skript:

1. projektstarten den 2 mars 2026;
2. tre uppgifter: Foundation med 5 arbetsdagar, Brickwork med 10 och Roof med 4;
3. två samband av typen slut-till-start: Foundation till Brickwork, Brickwork till Roof.

Appen utför de tre stegen och beräknar om. Läser assistenten sedan tillbaka, hittar den: projektets slut torsdag 26 mars 2026, projektets varaktighet 19 arbetsdagar och alla tre uppgifterna kritiska. Det stämmer med summan: 5 + 10 + 4 är 19 arbetsdagar, och 19 arbetsdagar efter måndag 2 mars slutar på torsdag 26 mars. Hela skriptet är ett steg i din historik. Ett *Ångra* tar bort de tre uppgifterna, de två sambanden och den nya projektstarten.

Nu följer ett ”vad händer om”-exempel. Du ber sedan assistenten uppdatera framdriften, och då sätter den rapportdatumet till måndag 16 mars. Ett rapportdatum är inte bara en etikett: arbete som inte har startat får inte ligga före det datumet och flyttas upp till det. Utan en enda rad framdrift flyttas därför hela tidsplanen: Foundation går från 16 till 20 mars, Brickwork från 23 mars till 7 april och Roof från 8 till 13 april. Projektets slut hoppar från 26 mars till 13 april. Tidsplanen flyttas två arbetsveckor framåt, och kalendern i det här exemplet, *Bouwkalender NL*, har långfredag (3 april) och påsk (5 och 6 april). De två lediga vardagarna skjuter slutet ytterligare två dagar. Därför sätter assistenten bara rapportdatumet på din begäran, och bara när det finns verklig framdrift att registrera.

## Följder för din tidsplan och vanliga missförstånd

**Assistenten har ingen egen kopia.** Det den ändrar, ändrar ditt projekt. Med *Automatisk säkerhetskopiering* på har du en IFC-säkerhetskopia före dess första ändring. Med *Skrivskyddad* kan den analysera utan att ändra något.

**En ny token bryter alla anslutningar.** Token är bryggans lösenord. En ny token gör den gamla ogiltig, även på en körande brygga, och assistenten måste få den nya.

**Att assistenten säger att det lyckades är inget bevis.** Uppgiftspanelen visar vilket verktyg den verkligen anropade och vad som kom tillbaka. En avvisning anger nästan alltid vilket fält som var fel och vilken väg som fungerar.

**Assistenten kan inte testa ett ”vad händer om” med ångra.** Den delar ångra med dig, så för varianter kopierar den dokumentet med `planner_duplicate_document`. Kopian är frikopplad, har ingen filsökväg och visas som osparad. Assistenten stänger inte varianter. Det bestämmer du.

**En export av assistenten är inte ett sparande.** Den skriver en IFC-fil till en sökväg som den väljer själv, inom din användarmapp, och den skriver bara över en befintlig fil om den uttryckligen begär det. Ditt projekt förblir osparat i appen och behåller sitt eget sparmål. Importerar den en fil, så öppnas den i en ny flik eller i en tom, oförändrad flik.

## Se även

- [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen): stegen för att starta bryggan, koppla en assistent och installera skillen.
- [AI-verktyg](docs://ref-ai-tools): alla verktyg per grupp, vad de avvisar och hur länge säkerhetskopior bevaras.
- [Planera bra](docs://gids-goed-plannen): planeringsprinciperna; assistenten får dem i en engelsk version med verktygen tillagda.
- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): vad rapportdatumet gör med din tidsplan.
