# Framdrift, rapportdatum och baslinje

En tidsplan är en prognos. När arbetet är igång vill du veta vad som är klart, vad som återstår och vad det betyder för överlämningen. Den här artikeln förklarar hur appen behandlar framdrift. Du får veta vad rapportdatumet gör, hur appen räknar ut återstående arbete och varför en uppgift som redan har startat ibland väntar på sin föregående uppgift. Du får också veta hur du jämför läget nu med den ursprungliga överenskommelsen. Ett exempel visar siffrorna.

## Begreppet

**Framdrift** är vad som verkligen har hänt. Appen sparar för varje uppgift tre saker: en slutförandegrad, en **verklig start** och ett **verkligt slut**. Det som tidsplanen förutspådde finns kvar bredvid det. Det verkliga är vad som faktiskt hände.

**Rapportdatumet** är den dag då du gör en lägesbedömning. Allt som hände före den dagen är ett faktum. Allt som ännu ska hända planerar appen från början av den dagen. Ett verkligt datum kan infalla på rapportdatumet, men aldrig efter det.

**Återstående arbete** är det som återstår att göra på en uppgift. En uppgift på 4 arbetsdagar som är 25% klar har 3 arbetsdagar återstående arbete.

En **baslinje** är en ögonblicksbild av tidsplanen vid ett bestämt ögonblick. Oftast är det det ögonblick då överenskommelsen godkändes. Senare lägger du den verkliga tidsplanen bredvid baslinjen. Då ser du hur mycket utförandet avviker.

## Så beräknar appen

Exemplet nedan använder beräkningsprofilen *Open Planner Studio*, som ett nytt projekt beräknas med. Längre fram kan du läsa vad som skiljer sig åt i beräkningsprofilerna för Primavera P6 och Microsoft Project.

Appen beräknar inte om av sig själv. Efter varje ändring i framdrift eller rapportdatum visar statusfältet *Inaktuell — beräkna om (F5)*. Tryck på **Beräkna** (F5), till exempel via *Tidsplan › Tidsplan › Beräkna*. Är *Beräkna automatiskt* på (under *Inställningar › Projekt › Inställningar*, fliken *Tidsplan*, rubriken *Beräkning*) gör appen detta själv.

### Rapportdatumet

Rapportdatumet gör tre saker.

Först vägrar appen ett verkligt datum efter rapportdatumet. Ett datum på rapportdatumet självt är tillåtet.

För det andra kan uppgifter som inte har startat inte ligga i det förflutna. Är en sådan uppgift planerad före rapportdatumet, flyttar appen den till rapportdatumet. Det gäller också för de efterföljande uppgifterna, som flyttar med via sina samband. Du ser effekten i exemplet nedan. I profilen för Microsoft Project gör appen detta inte.

För det tredje startar det återstående arbetet för en uppgift som redan pågår på rapportdatumet självt. Appen behandlar rapportdatumet som början på den dagen. Gör du en lägesbedömning på fredag efter arbetstid, sätt rapportdatumet då till måndag. Sätter du det till fredag, planerar appen det återstående arbetet ändå den fredagen.

Har du ännu inget rapportdatum och anger du framdrift, sätter appen rapportdatumet till idag och meddelar dig. Utan rapportdatum räknar appen en pågående uppgift framåt med dess återstående varaktighet, men bakåt med dess hela varaktighet. Slacket blir då negativt och uppgiften ser kritisk ut utan anledning.

### Slutförandegrad, verkliga datum och återstående varaktighet

Fälten påverkar varandra. Fyller du i ett fält, fyller appen i de andra.

- En slutförandegrad över 0 betyder att uppgiften har startat. Anger du ingen verklig start, tar appen den planerade starten. Är uppgiften planerad att starta efter rapportdatumet, frågar appen först när den verkligen startade.
- En slutförandegrad på 100 betyder klar. Anger du inget verkligt slut, blir det rapportdatumet, även om arbetet i själva verket var klart tidigare.
- Ett verkligt slut gör uppgiften till 100%. Sätter du en klar uppgift tillbaka under 100%, tas det verkliga slutet bort. Rensar du det verkliga slutet, går slutförandegraden tillbaka till 0 och uppgiften förblir *Pågår* tills du också rensar den verkliga starten.
- Den **återstående varaktigheten** är varaktigheten gånger det som ännu återstår, avrundat till hela arbetsdagar. För en uppgift på 2 arbetsdagar ger 0% och 25% båda 2 arbetsdagar återstående arbete. 50% och 75% ger båda 1. Vid 90% avrundar appen till 0: det återstående arbetet är då klart på rapportdatumet. En uppgift i timmar räknas i hela minuter. En uppgift på 5 timmar vid 40% har 3 timmar återstående arbete.
- En milstolpe har bara ett verkligt datum.
- En fas (sammanfattningsuppgift) har ingen egen framdrift. Efter beräkning följer dess slutförandegrad av uppgifterna under den: det viktade medelvärdet av deras slutförandegrader, med varaktigheten i arbetsdagar som vikt. En milstolpe väger 0.

Ändrar du varaktigheten för en uppgift som redan pågår, förblir det arbete som är gjort. Slutförandegraden justeras. En uppgift på 5 arbetsdagar vid 60% som du sätter till 10 arbetsdagar hamnar på 30%. Appen vägrar en varaktighet som är kortare än det arbete som redan är gjort.

### Färdiga och pågående uppgifter

En färdig uppgift är låst vid sina verkliga datum. Den flyttar inte längre, och med ett rapportdatum är den aldrig kritisk. Utan rapportdatum kan en färdig uppgift fortfarande vara kritisk.

En pågående uppgift behåller sin verkliga start. Bara det återstående arbetet flyttar. Var det återstående arbetet startar beror på framdriftsläget.

### Retained Logic och Progress Override

Vad gör appen om en uppgift redan har startat medan dess föregående uppgift fortfarande pågår? Ett sådant samband kallas **framdrift i fel ordning**: framdriften strider mot ordningen. Tänk på målaren som redan börjar i ett rum som är putsat, medan putsaren fortfarande arbetar på ett annat ställe.

Två framdriftslägen avgör hur appen räknar då:

- **Retained Logic** (standard): sambandet gäller fortfarande. Det återstående arbetet för den efterföljande uppgiften följer sambandet. Med slut-till-start startar den först när den föregående uppgiften är klar, och aldrig före rapportdatumet.
- **Progress Override**: verkligheten vinner. Det återstående arbetet för den efterföljande uppgiften startar på rapportdatumet, utan att vänta på den föregående uppgiften.

I den här profilen skiljer sig lägena bara åt i det återstående arbetet för uppgifter som redan har startat medan den föregående uppgiften ännu inte är klar. Andra uppgifter beräknas lika i båda lägena. Appen rapporterar ett sådant samband i båda lägena: i statusfältet som *1 samband med framdrift i fel ordning* och i panelen *Varningar*.

### Baslinjer och avvikelse

När du sparar registrerar appen för varje uppgift utan underuppgifter den tidigaste starten, det tidigaste slutet, varaktigheten och milstolpstypen. Sammanfattningsuppgifter ingår inte. Det du ändrar efteråt påverkar inte baslinjen. Du kan behålla flera baslinjer, men exakt en är **aktiv**. Gantt, avvikelserapporten och framdriftsrapporten använder den aktiva baslinjen.

**Avvikelsen** är skillnaden i arbetsdagar mellan baslinjen och den aktuella tidsplanen. Ett plus betyder senare, ett minus betyder tidigare. Appen räknar i projektets kalender. Avvikelserapporten visar avvikelsen för start och slut per uppgift. Statusen följer bara av slutet: *Försenad* vid plus, *Tidigare* vid minus, annars *Enligt tidsplan*. En uppgift som lagts till efter baslinjen heter *Ny*. En uppgift som inte längre finns är *Bortfallen*.

Två anmärkningar. Avvikelsen i varaktighet står i uppgiftstabellen (kolumnen *Varaktighetsavvikelse*), inte i avvikelserapporten. Den jämför den planerade varaktigheten för uppgiften nu med den i baslinjen. Framdrift ändrar inte den planerade varaktigheten. En uppgift som planerades till två dagar och tog tre dagar har därför en slutavvikelse på +1, men en varaktighetsavvikelse på 0. Och sparar du en baslinje efter att framdrift har angetts, registreras läget med de verkliga datumen. Avvikelsen är då noll.

Framdriftsrapporten ställer den planerade framdriften bredvid den verkliga framdriften. Båda viktas med arbetsdagar. Planerat är den del av varje uppgift som enligt baslinjen borde ha varit klar på rapportdatumet. Verkligt är den slutförandegrad som du har angett.

### Var du ser det

I Gantt markerar en streckad linje rapportdatumet, med datumet i rubriken. Vid varje pågående uppgift böjer linjen ut till den punkt i balken som slutförandegraden anger. Det är **framdriftslinjen**. Stänger du av framdriftslinjen men låter rapportdatumlinjen vara på, blir en rak linje kvar. Är båda av, försvinner linjen och etiketten. Knapparna *Baslinjeöverlägg*, *Framdriftslinje* och *Rapportdatumlinje* finns under *Visa › Baslinjer & framdrift*. De ändrar ingenting i beräkningen. Baslinjen syns som en smal balk under varje uppgiftsbalk. Uppgiftstabellen har kolumner för framdrift och, per baslinje, för avvikelsen. På fliken *Rapport* hittar du rapporttyperna *Avvikelse* och *Framdriftsrapport*.

## Genomräknat exempel: tillbygget efter tre veckor

Exemplet är övningsprojektet *House extension* från självstudierna, i läget efter att alla samband har lagts till. Där finns ingen byggsemester, inga resurser och inga timmar. I självstudie 6 gör du detta själv i övningsprojektet. Projektet innehåller då mer, så siffrorna där skiljer sig. Här läser du varför siffrorna är som de är.

Tillbygget startar måndag 7 juni 2027. På den beräknade tidsplanen sparar appen en baslinje med namnet *Baslinje*: överlämning fredag 6 augusti 2027, 45 arbetsdagar.

### Läget på måndag 28 juni

Rapportdatumet är måndag 28 juni 2027. Så här har det gått:

- *Start of construction*, *Set up site*, *Clear garden and paving* och *Set out the extension* är klara enligt planen, från 7 till 10 juni.
- *Excavate foundation trench* var planerad på 2 arbetsdagar (fredag 11 och måndag 14 juni) och tog 3: från 11 till 15 juni.
- *Foundation formwork and reinforcement* går från 16 till 18 juni. *Reinforcement inspection* är 18 juni, *Pour foundation* måndag 21 juni.
- *Foundation brickwork* (2 arbetsdagar) startade fredag 25 juni och är på 50%.

Efter **Beräkna** räknar appen ut det så här:

- Det återstående arbetet för foundation brickwork är 2 × (1 − 0,5) = 1 arbetsdag. Det startar på rapportdatumet, så det är klart måndag 28 juni.
- *Lay hollow-core floor* följer tisdag 29 juni. Därmed startar *Build inner cavity leaf* onsdag 30 juni i stället för tisdag 29 juni. Överlämningen kommer måndag 9 augusti: en arbetsdag senare än baslinjen. Den extra dagen vid schaktningen är därför förseningen för hela projektet, eftersom den uppgiften låg på den kritiska linjen.
- Statusfältet visar *Kritisk linje: 13 uppgifter, 46 arbetsdagar*, mot 21 uppgifter och 45 arbetsdagar före framdriften. De åtta färdiga uppgifterna som låg på den kritiska linjen räknas inte längre med.
- Fasen *Foundations* står på 77,8%. Uppgifterna i den väger 2 + 3 + 1 + 2 + 1 = 9 arbetsdagar. Klara är 2 + 3 + 1 arbetsdagar, plus hälften av 2: totalt 7. Och 7 av 9 är 77,8%. Milstolpen *Reinforcement inspection* väger 0.

Avvikelserapporten ställer detta bredvid baslinjen:

- *Excavate foundation trench*: start 0, slut +1 (baslinjens slut 14 juni, nu 15 juni).
- *Foundation brickwork*: start +1 (24 juni blev 25 juni), slut +1.
- *Build outer cavity leaf*: +1, +1. Den uppgiften är ännu inte kritisk. Den hade 2 arbetsdagar slack och behåller dem.
- *Handover*: +1. Projektslutet avviker med 1 arbetsdag.
- Sammanlagt står 19 uppgifter på *Försenad* och 4 på *Enligt tidsplan*. Ingen uppgift står på *Tidigare*.

Framdriftsrapporten visar *Planerat* 28,3% och *Verkligt* 23,9%. Uppgifterna väger 46 arbetsdagar tillsammans. Enligt baslinjen skulle 13 vara klara: 4 arbetsdagar i förberedelsen, 2 för schaktningen, 3 för armeringen, 1 för gjutningen, 2 för foundation brickwork och 1 för hollow-core floor. I verkligheten är 11 klara: 4 + 2 + 3 + 1, plus den halva dagen för foundation brickwork.

### Vad händer om du flyttar rapportdatumet?

Samma framdrift, men ett annat rapportdatum. Det återstående arbetet för foundation brickwork startar alltid på rapportdatumet, så överlämningen flyttar med det:

- Rapportdatum fredag 25 juni: det återstående arbetet faller på fredag 25 juni. Överlämningen blir kvar fredag 6 augusti.
- Måndag 28 juni: överlämning måndag 9 augusti.
- Tisdag 29 juni: överlämning tisdag 10 augusti, 2 arbetsdagar senare än baslinjen.

### Vad händer om du ändrar slutförandegraden?

*Foundation brickwork* har 2 arbetsdagar. Vid 0% eller 25% är det återstående arbetet 2 arbetsdagar: det är klart tisdag 29 juni och överlämningen blir tisdag 10 augusti. Vid 50% eller 75% är det 1 arbetsdag: måndag 28 juni, överlämning måndag 9 augusti. Vid 90% är det återstående arbetet 0 och uppgiften är klar på rapportdatumet.

### Vad händer om du sätter ett rapportdatum utan att ange framdrift?

Sätter du bara rapportdatumet till måndag 28 juni och anger ingenting, så har enligt tidsplanen ännu inget hänt. Uppgifter som inte har startat kan inte ligga i det förflutna. Därför flyttar appen allt till 28 juni. *Start of construction* ligger då på den dagen, och överlämningen kommer fredag 27 augusti, 15 arbetsdagar efter baslinjen. Ange därför först den framdrift som finns.

## Genomgånget exempel: putsare och målare

Nu ett exempel för framdriftsläget. Samma tillbyggnad, ett annat läge: det är onsdag 21 juli 2027. Allt till och med *Install building services* är slutfört enligt plan. *Plastering* (4 arbetsdagar) startade tisdag 20 juli och är 25 % klar. *Painting* (3 arbetsdagar) följer på putsningen, men målaren har redan börjat i dag och är 33 % klar.

Utan framdrift var putsningen planerad från tisdag 20 till fredag 23 juli, och målningen från måndag 26 till onsdag 28 juli. Statusfältet visar nu *1 samband med framdrift i fel ordning*: målningen har startat, men putsningen är inte klar. I panelen *Varningar* står det: *Framdrift i fel ordning: framdriften för den efterföljande uppgiften strider mot sambandet*.

Putsningen har 4 × (1 − 0,25) = 3 arbetsdagar återstående arbete: 21, 22 och 23 juli. Målningen har 3 × (1 − 0,33) = 2 arbetsdagar återstående arbete.

- Med **Retained Logic** kan det återstående arbetet bara börja när putsningen är klar. Det är fredag 23 juli, så målningen börjar måndag 26 juli och slutar tisdag 27 juli. Balken går från den verkliga starten 21 juli till 27 juli. Det totala slacket är 7 arbetsdagar.
- Med **Progress Override** börjar det återstående arbetet på rapportdatumet. Målningen slutar torsdag 22 juli, före putsningen är klar. Det totala slacket är 10 arbetsdagar.

Överlämningen stannar på fredag 6 augusti i båda fallen: målningen hade ändå slack.

### Andra beräkningsprofiler

I profilerna Primavera P6 och Microsoft Project slutar målningen i det här exemplet på samma datum (27 och 22 juli). De skiljer sig på följande punkter. De är beräkningsregler i profilen. Du hittar dem under *Inställningar › Projekt › Projektinfo*, i blocket *Beräkningsprofil och beräkningsalternativ*.

- I profilen Microsoft Project flyttas arbete som inte har startat inte till rapportdatumet (beräkningsregel *Ej påbörjade uppgifter flyttas inte till rapportdatumet*). Om du i exemplet ovan bara sätter ett rapportdatum och inte matar in något, stannar överlämningen i den profilen kvar på fredag 6 augusti.
- I profilen Microsoft Project startar det återstående arbetet också inte tidigare än verklig start plus den förflutna tiden (beräkningsregel *Återstående arbete återupptas efter den förflutna tiden*). Det är en extra nedre gräns bredvid rapportdatumet: den senare av de två gäller. Ta *Build inner cavity leaf* (5 arbetsdagar), startad tisdag 29 juni. Den är 40 % klar onsdag 30 juni, som är rapportdatumet. Två team murar samtidigt, så 40 % är redan klart efter en dag. Allt före det är slutfört enligt plan. Open Planner Studio och Primavera P6 låter uppgiften slutföras fredag 2 juli. Microsoft Project gör det måndag 5 juli, eftersom tisdag 29 juni plus 2 förflutna arbetsdagar är torsdag 1 juli, efter rapportdatumet.
- Primavera P6 visar som tidigaste start för en pågående uppgift starten av det återstående arbetet, inte den verkliga starten (i innerskiktsexemplet onsdag 30 juni).
- I profilen Primavera P6 räknas under Progress Override inte heller samband till en efterföljande uppgift som redan har startat för den föregående uppgiften. Det begränsar inte längre dess senaste datum och dess fritt slack (beräkningsregel *Progress Override negeras även för en påbörjad efterföljande uppgift bakåt*). I exemplet med putsare och målare syns det inte, eftersom putsningen ändå är kritisk via golvavjämningen: dess senaste datum och fritt slack är lika under Retained Logic och Progress Override.
- När du öppnar en xer file tar appen framdriftsläget från filen. Actual Dates, det tredje P6-läget, känner appen inte till. En sådan fil beräknas med Retained Logic.

## Konsekvenser och missförstånd

**”Jag flyttar bara rapportdatumet framåt.”** Om du flyttar det startar det återstående arbetet för pågående uppgifter på det nya datumet. Arbete som ännu inte har startat kan aldrig ligga före det datumet. Flytta därför rapportdatumet bara samtidigt med en uppdatering av framdriften.

**”Att ange 100 % registrerar det verkliga slutet.”** Bara om du också anger det verkliga slutet. Om du sätter en uppgift på 100 % utan verkligt slut, blir uppgiftens slut rapportdatumet. Om den i själva verket var klar tidigare, fyll i det verkliga slutet.

**”0 % betyder att uppgiften inte är påbörjad.”** Om en uppgift har en verklig start räknas den som startad, även på 0 %. Det återstående arbetet är då hela varaktigheten och startar på rapportdatumet. Ta bort den verkliga starten för att den igen ska räknas som ej påbörjad.

**”Progress Override löser varningen.”** Varningen om framdrift i fel ordning finns kvar. Läget avgör bara hur appen beräknar. Om sambandet inte längre stämmer, ändra sambandet.

**”Avbrottet i en delad uppgift försvinner.”** Nej: ett avbrott i den del som återstår finns kvar i det återstående arbetet. Ta en uppgift på 5 arbetsdagar med ett avbrott på 1 dag efter 2 arbetsdagar, startad tisdag 29 juni. Med rapportdatumet onsdag 30 juni och uppgiften på 40 % är det återstående arbetet 3 arbetsdagar. Det startar på rapportdatumet och går över avbrottet: slutet är måndag 5 juli. Utan avbrottet hade det varit fredag 2 juli.

**Timmar och rapportdatumet.** Du kan inte ange en tid i menyfliksområdet: du fyller i rapportdatumet som ett datum. Om du gör en avstämning efter arbetstid, sätt rapportdatumet på nästa arbetsdag. En uppgift i timmar beräknar det återstående arbetet från starten av rapportdatumet. Ta *Lay hollow-core floor* i övningsprojektet efter självstudie 4: 5 timmar, måndag 28 juni, arbetsdag från 07:00. Med rapportdatumet måndag 28 juni och uppgiften på 40 % har den 3 timmar återstående arbete, från 07:00 till 10:00, även om arbete redan utförts den morgonen. Hur appen räknar timmar förklaras i [Dagar och timmar](docs://uitleg-dagen-en-uren).

**Uppdatera en baslinje.** Det är inte möjligt. Du sparar en ny och tar bort den gamla. Om du flyttar projektet följer de verkliga datumen och rapportdatumet med, men baslinjerna gör det som standard inte: så syns förskjutningen kvar som avvikelse. Se [Flytta ett projekt](docs://howto-project-verplaatsen).

## Se också

- [Uppdatera framdriften](docs://howto-voortgang-bijwerken): ställa in rapportdatumet och ange framdriften.
- [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren): läsa in framdriften från platspersonal i ett svep.
- [Välja framdriftsläge](docs://howto-voortgangsmodus-kiezen): ställa in Retained Logic eller Progress Override.
- [Spara och hantera en baslinje](docs://howto-baseline-opslaan-en-beheren): spara en baslinje och använda den.
- [Flytta ett projekt](docs://howto-project-verplaatsen): vad som händer med verkliga datum, rapportdatumet och baslinjerna.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): varför en uppgift är kritisk och vad slack betyder.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): framdrift och ett rapportdatum mitt i projektet (20 maj 2027).
