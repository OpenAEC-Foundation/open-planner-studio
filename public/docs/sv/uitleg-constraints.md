# Restriktioner och måldatum

Tegelstenarna levereras först den 21 juni. Bygglovet har ännu inte kommit. Taket måste vara klart före byggarnas helgdag. Samband anger att en uppgift väntar på en annan uppgift, men överenskommelser om ett datum följer inte av arbetets ordning. Där kommer restriktioner och måldatum in. I den här artikeln läser du vad varje typ gör, när en uppgift flyttas och när bara slacket ändras, vad en hård fixering är och hur appen rapporterar en konflikt.

Reglerna och exemplen gäller för ett nytt projekt med beräkningsprofilen *Open Planner Studio* och en arbetsvecka från måndag till fredag.

## Begreppet

En **restriktion** är en datumgräns för en enskild uppgift, oberoende av uppgiftens samband. En sådan gräns kan fungera på två sätt:

- Den **skjuter**: uppgiften får inte starta eller avslutas tidigare än datumet. Om uppgiften annars skulle starta tidigare på grund av sina samband flyttas den till datumet.
- Den **bevakar**: uppgiften måste starta eller avslutas senast på datumet. Appen flyttar ingenting. Om tidsplanen inte klarar datumet blir **slacket** för uppgiften, och för kedjan före den, negativt. Slack är utrymmet en uppgift har innan projektets slutdatum flyttas; negativt betyder att du på papperet redan är försenad (se [Kritisk linje och slack](docs://uitleg-kritiek-pad)).

Ett **måldatum** är en enklare form av bevakning: ett datum för när en uppgift ska avslutas, utan att något flyttar uppgiften.

Alla restriktioner är **mjuka**: beräkningen fortsätter även om ett datum inte nås. Det finns ett undantag, den **hårda fixeringen**, som åsidosätter sambanden. Mer om den nedan.

## Så beräknar appen

### De åtta typerna

Du väljer typen vid *Restriktion* i panelen *Egenskaper*. Så beräknar varje typ:

- *Så tidigt som möjligt (ASAP)*: ingen gräns. Det här är standardvärdet: uppgiften startar så snart sambanden tillåter.
- *Så sent som möjligt (ALAP)*: uppgiften flyttas så sent den kan utan att en efterföljande uppgift måste starta senare. Den förbrukar alltså sitt fritt slack. Har den därefter ännu totalt slack, eftersom de efterföljande uppgifterna själva har utrymme, är den inte kritisk. Är även det förbrukat, räknas den som kritisk.
- *Starta tidigast (SNET)*: en undre gräns för starten. Om uppgiften annars skulle starta tidigare flyttas den till datumet. Ligger datumet tidigare än vad sambanden tillåter, gör restriktionen ingenting.
- *Avsluta tidigast (FNET)*: samma sak, men för uppgiftens slut.
- *Starta senast (SNLT)* och *Avsluta senast (FNLT)*: en övre gräns för start eller slut. De flyttar ingenting. Om gränsen inte nås rapporterar appen en överträdd restriktion och slacket blir negativt.
- *Måste starta på (MSO)* och *Måste slutföras på (MFO)*: en undre och en övre gräns tillsammans. Uppgiften flyttas till datumet om det är senare än sambanden kräver. Ligger datumet tidigare än vad sambanden tillåter, står uppgiften kvar där sambanden placerar den, och slacket blir negativt.

Om ett datum infaller på en lördag, söndag eller ledig dag läser appen det som en arbetsdag: en undre gräns (SNET, FNET) som nästa arbetsdag, en övre gräns (SNLT, FNLT) som föregående.

### Vad negativt slack betyder

En övre gräns fungerar baklänges. Om restriktionen lägger en uppgifts senaste datum före dess tidigaste datum, blir det totala slacket negativt. Det gäller även uppgifterna före den: om brickwork senast måste starta fredag 11 juni och inte kan starta före måndag 14 juni, är de uppgifter som ligger före brickwork också en arbetsdag försenade. Alla uppgifter med negativt slack är kritiska. Hur det fungerar förklaras i [Kritisk linje och slack](docs://uitleg-kritiek-pad).

Balkarna flyttas inte på grund av en övre gräns. Du ser konflikten i det negativa *Totalt slack*, i en röd romb ovanför balken, i meddelandet i statusfältet (till exempel *1 restriktion(er) bröts*) och i panelen *Varningar*.

### Den hårda fixeringen

Med MSO och MFO visas kryssrutan *Obligatorisk (pinlogik)*. Med den markeringen fixerar du uppgiften på datumet, även om de föregående uppgifterna inte är klara då. Sambanden åsidosätts:

- Uppgiften ligger på datumet (med MSO startar den där, med MFO avslutas den där) och överlappar de föregående uppgifterna.
- De föregående uppgifterna får negativt slack, och appen rapporterar en överträdd restriktion så snart sambanden skulle låta uppgiften starta senare än fixeringen. Den fixerade uppgiften själv behåller 0 i slack.
- De efterföljande uppgifterna beräknas utifrån den fixerade uppgiften. De kan därför starta tidigare än utan fixering, även om logiken före den inte är klar. I exemplet nedan flyttas projektets slut tre arbetsdagar framåt på grund av fixeringen.

Första gången du slår på fixeringen visar appen en kort förklaring: en hård fixering åsidosätter sambanden, balken är fixerad på datumet, även innan de föregående uppgifterna är klara.

### Den sekundära restriktionen

En uppgift har en primär restriktion. Vill du också en andra gräns, till exempel en uppgift som inte får starta före 14 juni och måste vara avslutad senast 17 juni, lägger du till en **sekundär restriktion**. Det måste vara en riktig gräns (SNET, FNET, SNLT eller FNLT) och den ska begränsa åt andra hållet än den primära: en undre gräns (SNET eller FNET) med en övre gräns (SNLT eller FNLT). SNET med SNLT är alltså tillåtet, SNET med FNET är det inte. Appen markerar andra kombinationer i rött och anger skälet, till exempel *Primär och sekundär får inte begränsa samma sida.* Med ASAP, ALAP, MSO, MFO och en hård fixering är ingen sekundär restriktion tillåten.

### Måldatumet

Ett måldatum är ett separat datum för en uppgift, vid sidan av restriktionen. Det är en övre gräns för slutet: det flyttar ingenting, men gör slacket negativt om uppgiften inte är avslutad i tid. Appen rapporterar då i panelen *Varningar* *Måldatum … passerades. Tidigaste slut …* och statusfältet räknar de missade måldatumen. I Gantt finns en nedåtriktad pil på måldatumet: grön så länge uppgiften är avslutad i tid, röd så snart den är försenad. Ett måldatum på en lördag räknas till och med fredagen innan.

För slacket gör ett måldatum samma sak som FNLT. Skillnaden ligger i hur du använder det. Ett måldatum är ett datum som du vill bevaka; det står fristående från restriktionen, så en uppgift kan ha både en restriktion och ett måldatum. FNLT är en restriktion: en överträdelse visas som en överträdd restriktion i stället för som ett missat måldatum.

### Vad en restriktion inte gör

- På en **fas** (sammanfattningsuppgift) räknas inte en restriktion eller ett måldatum: appen beräknar med uppgifterna i fasen. Lägg den på uppgiften själv.
- En uppgift som redan har en verklig start eller framdrift behåller den starten. En SNET med ett senare datum flyttar den inte.
- **Att skriva in ett startdatum** på en uppgift med en föregående uppgift fungerar inte som en fast start: den föregående uppgiften bestämmer fortfarande. Därför gör appen det till en SNET på datumet du skrev in, i panelen *Egenskaper*, i *Redigera uppgift*, i tabellen och när du flyttar balken i Gantt. Appen meddelar dig om det. Har uppgiften redan en annan restriktion (till exempel ALAP eller MSO), använder appen inte den nya starten och meddelar dig även det. Ändra då den restriktionen.

Alla ändringar syns först efter **Beräkna** (F5).

## Ett genomarbetat exempel

Exemplet är ett litet nätverk av uppgifter för en tillbyggnad av ett hus. Det startar måndag 7 juni 2027:

- *Groundwork* (3 arbetsdagar): måndag 7 till onsdag 9 juni.
- *Pour foundation* (2): torsdag 10 och fredag 11 juni.
- *Brickwork* (5): måndag 14 till fredag 18 juni.
- *Roofing* (3): måndag 21 till onsdag 23 juni.
- *Scaffolding* (2): följer efter *Pour foundation* och kommer före *Roofing*. Den pågår måndag 14 och tisdag 15 juni och har 3 arbetsdagar i slack.

Den kritiska linjen är *Groundwork*, *Pour foundation*, *Brickwork* och *Roofing*. Projektet är klart onsdag 23 juni. Vad ändras med en restriktion på *Brickwork*?

- **SNET måndag 21 juni** (tegelstenarna kommer först då): *Brickwork* pågår från måndag 21 till fredag 25 juni, *Roofing* från måndag 28 till onsdag 30 juni. Projektet är klart onsdag 30 juni. *Groundwork* och *Pour foundation* har nu 5 arbetsdagar i slack och är inte längre kritiska, *Scaffolding* har 8.
- **SNET onsdag 9 juni**: ingen effekt. Sambanden låter *Brickwork* ändå bara starta måndag 14 juni.
- **SNLT onsdag 16 juni**: ingen effekt. *Brickwork* startar måndag 14 juni och klarar gränsen med god marginal.
- **SNLT fredag 11 juni**: för snävt. *Brickwork* startar ändå måndag 14 juni, en arbetsdag för sent. *Groundwork*, *Pour foundation* och *Brickwork* får −1 arbetsdag i slack, och appen rapporterar *Restriktionen Starta senast (SNLT) 11-06-2027 överskrids av logiken (negativt slack)*. Ingenting flyttas.
- **MSO onsdag 16 juni** (utan hård fixering): *Brickwork* flyttas till onsdag 16 juni och är klar tisdag 22 juni. *Roofing* pågår från onsdag 23 till fredag 25 juni, och projektet är klart fredag 25 juni.
- **MSO fredag 11 juni** (utan hård fixering): datumet ligger före vad sambanden tillåter. *Brickwork* startar ändå måndag 14 juni och slacket blir −1, precis som med SNLT.
- **MSO onsdag 9 juni med hård fixering**: *Brickwork* startar onsdag 9 juni och är klar tisdag 15 juni, medan *Pour foundation* fortfarande pågår till fredag 11 juni. *Roofing* pågår från onsdag 16 till fredag 18 juni: projektet är klart tre arbetsdagar tidigare än utan fixering. *Groundwork* och *Pour foundation* får −3 arbetsdagar i slack.

Och med en restriktion eller ett måldatum på en annan uppgift:

- **ALAP på** *Scaffolding*: uppgiften flyttas till torsdag 17 och fredag 18 juni, det senaste ögonblicket före *Roofing*. *Roofing* är dess enda efterföljande uppgift och hade utrymme för exakt sina 3 arbetsdagar i slack. Det slacket är nu förbrukat och *Scaffolding* är kritisk.
- **SNET lördag 19 juni på** *Scaffolding*: gränsen räknas som måndag 21 juni. *Scaffolding* pågår måndag 21 och tisdag 22 juni, och *Roofing* följer med till onsdag 23 till fredag 25 juni.
- **Måldatum fredag 18 juni på** *Roofing*: ingenting flyttas, *Roofing* står kvar måndag 21 till onsdag 23 juni. *Groundwork*, *Pour foundation*, *Brickwork* och *Roofing* får −3 arbetsdagar i slack, och appen rapporterar *Måldatum 18-06-2027 passerades. Tidigaste slut 23-06-2027*. *Scaffolding* behåller 0 arbetsdagar i slack och blir också kritisk.
- **SNET måndag 21 juni på** *Brickwork*, **måldatum fredag 25 juni på** *Roofing*: restriktionen skjuter brickwork en vecka framåt, och måldatumet visar att *Roofing* är försenad onsdag 30 juni. *Brickwork* och *Roofing* får −3 arbetsdagar i slack. *Groundwork* och *Pour foundation* behåller 2 arbetsdagar.

I självstudie 3 lägger du själv en restriktion och ett måldatum i självstudieprojektet och ser hur tidsplanen flyttas.

## Konsekvenser och missförstånd

**”En restriktion flyttar uppgiften.”** Bara SNET, FNET, MSO och MFO kan placera en uppgift senare än dess samband gör, och ALAP kan flytta den senare inom dess fritt slack. SNLT och FNLT flyttar aldrig något: de varnar bara. Att nå datumet betyder då att kedjan före det måste kortas.

**”Negativt slack är ett fel i appen.”** Det är signalen att tidsplanen krockar med din datumöverenskommelse. Du löser det genom att korta kedjan, mjuka upp överenskommelsen eller medvetet acceptera konflikten.

**”En hård fixering löser konflikten.”** En hård fixering döljer konflikten: uppgiften ligger på datumet, men de föregående uppgifterna är inte redo för den, och de efterföljande uppgifterna beräknas som om de vore det. Använd den bara för ett datum som verkligen är fast, till exempel ett juridiskt överlämningsdatum, och inte för att få en uppgift på ett datum.

**”Jag skriver bara in ett startdatum.”** För en uppgift med en föregående uppgift blir det en SNET. Ligger datumet tidigare än vad den föregående uppgiften tillåter, gör det ingenting.

**”Måldatum eller FNLT?”** Välj ett måldatum för ett datum du vill bevaka, och en restriktion för ett datum som verkligen är ett randvillkor för tidsplanen.

**”En restriktion på fasen.”** Det räknas inte. Lägg den på uppgiften själv.

## Se även

- [Att ange en restriktion eller ett måldatum](docs://howto-constraint-deadline-zetten): stegen för att ange en restriktion eller ett måldatum.
- [Samband och fördröjning](docs://uitleg-relaties): de samband som restriktionerna ligger bredvid.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): hur negativt slack uppstår och vad det gör med den kritiska linjen.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): en hård fixering (*Måste starta på*) på *Municipal road closure (permitted closure period)* och en sekundär restriktion (*Starta senast*) på *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): ett måldatum som inte nås, med negativt slack.
