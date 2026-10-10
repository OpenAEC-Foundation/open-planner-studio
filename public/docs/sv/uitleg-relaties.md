# Samband och fördröjning

Varför börjar murverket först när grunden är klar? Och varför glider takmonteringen en vecka när takelementen levereras sent? Det beror på sambanden mellan dina uppgifter. I den här artikeln läser du vilka fyra typer av samband appen känner till, vad fördröjning och överlapp gör, i vilken kalender en fördröjning räknas, vad som händer med ett samband på en fas, och hur appen avgör vilket samband som bestämmer en uppgifts startdatum.

Reglerna och exemplen gäller för ett nytt projekt, med beräkningsprofilen *Open Planner Studio* och en arbetsvecka från måndag till fredag.

## Begreppet

Ett **samband** anger att två uppgifter hänger ihop. Den första uppgiften är den **föregående**, den andra är den **efterföljande**. Ett samband är en undre gräns: den efterföljande uppgiften får aldrig starta eller sluta tidigare än sambandet tillåter, men den kan starta eller sluta senare. Har en uppgift flera föregående uppgifter, väntar den på det senaste datum som kommer ur alla dessa samband.

Det finns fyra typer. De skiljer sig åt i vilket moment hos den föregående uppgiften (start eller slut) som är kopplat till vilket moment hos den efterföljande uppgiften:

- **FS (slut-till-start).** Den efterföljande uppgiften börjar först när den föregående uppgiften är klar. Takelementen läggs på först när väggarna är upp. Det här är klart den vanligaste typen.
- **SS (start-till-start).** Den efterföljande uppgiften börjar först när den föregående uppgiften har startat. Uppgifterna kan löpa parallellt: rörarbetet kan börja så snart murverket är igång.
- **FF (slut-till-slut).** Den efterföljande uppgiften slutförs först när den föregående uppgiften är klar. Fogningen kan inte göras före murverket är klart, men den kan börja tidigare.
- **SF (start-till-slut).** Den efterföljande uppgiften slutförs först när den föregående uppgiften har startat. Den här typen är sällsynt. Ett exempel: den tillfälliga grundvattensänkningen får bara stoppas när murverket på grunden har startat.

Ett samband kan också ha en **fördröjning**: väntetid mellan de två uppgifterna, till exempel när betong måste härda. En fördröjning under noll kallas en **överlapp**: den efterföljande uppgiften börjar då innan den föregående uppgiften är klar, så att de två uppgifterna överlappar.

## Så beräknar appen

### De fyra typerna

För varje samband beräknar appen det tidigaste datum då den efterföljande uppgiften kan starta. Appen väljer sedan det senaste av alla samband för en uppgift. Utan fördröjning fungerar det så här:

- Med FS startar den efterföljande uppgiften på första arbetsdagen efter den föregående uppgiftens slut.
- Med SS startar den efterföljande uppgiften samma dag som den föregående.
- Med FF slutar den efterföljande uppgiften samma dag som den föregående. För att hitta startdatumet räknar appen bakåt över den efterföljande uppgiftens varaktighet. En efterföljande uppgift på 3 arbetsdagar startar alltså 2 arbetsdagar före den föregående uppgiftens slut.
- Med SF slutar den efterföljande uppgiften samma dag som den föregående startar. Även här räknar appen bakåt över den efterföljande uppgiftens varaktighet.

Dessa är undre gränser. En efterföljande uppgift startar senare om ett annat samband eller en restriktion kräver det. Alla datum visas först efter **Beräkna** (F5). Så länge statusfältet visar *Inaktuell — beräkna om (F5)* hör balkarna till den föregående beräkningen.

### Fördröjning och överlapp

En fördröjning kan uttryckas på fyra sätt:

- I **arbetsdagar** (`3` eller `3d`): appen hoppar över lediga dagar och helger. Det här är standard.
- I **kalenderdagar** (`3ed`, e står för *förlöpt* tid): varje dag räknas, också lördag och söndag. Det här är enheten för något som pågår utan att någon arbetar, till exempel härdning.
- Som en **procentandel** av den föregående uppgiftens varaktighet (`40%`): appen räknar ut det på nytt vid varje beräkning och avrundar till hela dagar (2,5 dagar blir 3).
- I **arbetstimmar** (`4h`): appen räknar fördröjningen i fördröjningskalendern, som standard den för den föregående uppgiften. Är den föregående uppgiften en daguppgift i en kalender utan egna band för arbetstid, till exempel standardkalendern, omvandlar appen timmarna till hela arbetsdagar. Avrundning sker till närmaste hela dag, och en halv dag avrundas uppåt. Med en arbetsdag på 8 timmar ger `2h` och `3h` alltså 0 dagar, `4h` till och med `11h` ger 1 dag och `12h` ger 2 dagar. Har den kalendern egna band för arbetstid, eller är den föregående uppgiften en timuppgift, räknas fördröjningen exakt i arbetstimmar.

Regeln för en fördröjning på N arbetsdagar med FS: de N arbetsdagarna efter den föregående uppgiftens slut är väntetid, och den efterföljande uppgiften startar nästa arbetsdag därefter. Med SS och FF läggs fördröjningen till på den föregående uppgiftens start respektive slut. En fördröjning under noll räknas bakåt: en överlapp på 1 arbetsdag med FS gör att den efterföljande uppgiften kan starta den dag den föregående uppgiften slutar.

En överlapp kan inte flytta en uppgift före projektstarten. Skulle det ske, håller appen den efterföljande uppgiften på projektstarten och rapporterar i panelen *Varningar*: *Överlapp kapat av projektstarten. Sambandet utnyttjas inte fullt ut*.

### I vilken kalender fördröjningen räknas

Varje uppgift kan ha en egen kalender. Vid en fördröjning i arbetsdagar spelar det roll vilken kalender som räknar arbetsdagarna. Inställningen *Fördröjningskalender* avgör det, med fyra val: *Föregående*, *Efterföljande*, *24-timmars* och *Projektkalender*. Som standard räknas fördröjningen i kalendern för den **föregående** uppgiften. Du hittar inställningen under *Inställningar › Projekt › Projektinfo*, i avsnittet *Beräkningsprofil och beräkningsalternativ*, vid *Beräkningsalternativ för det här projektet*. Valet hör till projektfilen och gäller först när du väljer *Tillämpa*. Tidsplanen beräknas då om.

En fördröjning i kalenderdagar (`3ed`) räknar alltid alla dagar, oavsett vilken *Fördröjningskalender* du väljer.

### Samband på sammanfattningsuppgifter

Du kan lägga ett samband på en fas (en sammanfattningsuppgift) i stället för på en uppgift i den. Appen lägger sambandet internt på varje uppgift i fasen:

- En fas som **föregående** med FS eller FF: den efterföljande uppgiften väntar tills den sista uppgiften i fasen som slutar är klar.
- En fas som **efterföljande** med FS eller SS: varje uppgift i fasen väntar på den föregående uppgiften, oberoende av de andra uppgifterna i fasen.
- En fas som **föregående** med SS eller SF: den efterföljande uppgiften väntar på starten av den uppgift i fasen som startar **sist**, inte på fasens egen start. Det är försiktigare än du kanske väntar: den efterföljande uppgiften startar aldrig för tidigt, men kanske senare än du menar. Vill du att den efterföljande uppgiften följer fasens start, lägg sambandet på den första uppgiften i fasen.
- En fas som **efterföljande** med FF eller SF: varje uppgift i fasen måste själv uppfylla slutkravet (med FF slutar den på eller efter den föregående uppgiftens slut, med SF på eller efter den föregående uppgiftens start), även en uppgift som hade kunnat göras mycket tidigare. Lägg ett sådant samband hellre på den sista uppgiften i fasen.

Ett samband mellan en uppgift och fasen den ligger under är inte tillåtet.

### Drivande samband

Har en efterföljande uppgift flera föregående uppgifter, bestämmer oftast ett samband startdatumet. Det är sambandet som gör att den efterföljande uppgiften inte kan starta en enda dag tidigare än nu. Ett sådant samband kallas **drivande**. Vid lika läge finns flera drivande samband. Du känner igen ett drivande samband på blixtsymbolen i kolumnerna *Föregående* och *Efterföljande* i tabellen, på kolumnen *Drivande* (**+** till höger i tabellrubriken, under *Samband*) och på den starkare färgtonen när du spårar en väg. Hur du öppnar den vägen står i [Spåra en väg](docs://howto-pad-traceren).

Att ett samband är drivande säger något om datum, inte om varaktighet. En kort föregående uppgift kan också vara drivande, till exempel på grund av en lång fördröjning. Du ser det i exemplet nedan.

## Ett genomräknat exempel

Exemplen använder egna miniprojekt, som alla startar måndag 7 juni 2027 om inget annat anges. Begrepp som kritisk linje och slack förklaras i [Kritisk linje och slack](docs://uitleg-kritiek-pad). Att själv bygga ett nätverk av samband och kontrollera det gör du i självstudie 2, ”Samband och kritisk linje”.

### De fyra typerna sida vid sida

*Pour foundation* tar 5 arbetsdagar: måndag 7 till fredag 11 juni. *Build walls* (5 arbetsdagar) följer med FS och pågår från måndag 14 till fredag 18 juni. Fyra uppgifter på 3 arbetsdagar vardera hänger på *Build walls*, var och en med en annan typ:

- *Place roof elements* (FS) startar måndag 21 juni, den första arbetsdagen efter murverket, och är klar onsdag 23 juni.
- *Pipework* (SS) startar måndag 14 juni, tillsammans med murverket, och är klar onsdag 16 juni.
- *Pointing* (FF) måste vara klar fredag 18 juni, samtidigt som murverket. Med 3 arbetsdagar startar den alltså onsdag 16 juni.
- *Dewatering* (SF) måste sluta måndag 14 juni, den dag murverket startar. Räknar man bakåt 3 arbetsdagar (torsdag 10, fredag 11, måndag 14 juni) blir starten torsdag 10 juni.

Bara *Place roof elements* ligger på den kritiska linjen. Projektet är klart onsdag 23 juni. *Pipework*, *Pointing* och *Dewatering* har 5, 3 respektive 7 arbetsdagar slack.

### Fördröjning och överlapp i siffror

*Pour foundation* är klar fredag 18 juni. *Build walls* (2 arbetsdagar) följer med FS. Så påverkar fördröjningen startdatumet:

- Utan fördröjning startar murverket måndag 21 juni.
- Med fördröjning `3` (tre arbetsdagar) är måndag 21, tisdag 22 och onsdag 23 juni väntetid. Murverket startar torsdag 24 juni.
- Med fördröjning `3ed` (tre kalenderdagar) räknas lördag, söndag och måndag. Murverket startar tisdag 22 juni.
- Med fördröjning `-1` (en överlapp på en arbetsdag) startar murverket fredag 18 juni, den dag gjutningen är klar.
- Med fördröjning `40%` är fördröjningen 40 procent av 5 arbetsdagar, alltså 2 arbetsdagar. Murverket startar onsdag 23 juni.
- Med fördröjning `50%` är fördröjningen 2,5 arbetsdagar, avrundat till 3 arbetsdagar. Murverket startar torsdag 24 juni.

### Vilken kalender räknar fördröjningen

*Build walls* (4 arbetsdagar) ligger i projektkalendern (måndag till fredag) och är klar torsdag 10 juni. *Pointing* (2 arbetsdagar) följer med FS och fördröjning `3`, och ligger i en kalender där lördag och söndag också är arbetsdagar. Startdatumet beror då på *Fördröjningskalender*:

- *Föregående* (standard): fördröjningen räknas i murverkets kalender. Fredag 11, måndag 14 och tisdag 15 juni är väntetid. Fogningen startar onsdag 16 juni.
- *Efterföljande*: fördröjningen räknas i fogningens kalender. Fredag 11, lördag 12 och söndag 13 juni är väntetid. Fogningen startar måndag 14 juni.
- *24-timmars*: varje kalenderdag räknas. Även här är fredag, lördag och söndag väntetid. Fogningen startar måndag 14 juni.
- *Projektkalender*: fördröjningen räknas i projektkalendern, precis som med *Föregående*. Fogningen startar onsdag 16 juni.

### Samband på en fas

*Foundation* är en fas med två uppgifter: *Excavate* (2 arbetsdagar, måndag 7 och tisdag 8 juni) och sedan *Pour* (3 arbetsdagar, onsdag 9 till fredag 11 juni). *Build walls* följer fasen *Foundation* med FS och startar måndag 14 juni. Appen låter den vänta på *Pour*, den sista uppgiften som slutar.

Med en fas som efterföljande: *Permit* (3 arbetsdagar, klar onsdag 9 juni) går med FS till fasen *Struktur*. Fasen innehåller *Build walls* (4 arbetsdagar) och sedan *Lay floor* (2 arbetsdagar). Varje uppgift i fasen väntar på *Permit*: *Build walls* startar torsdag 10 juni och är klar tisdag 15 juni. *Lay floor* väntar också på murverket och pågår från onsdag 16 till torsdag 17 juni.

Med SS från en fas: fasen *Finishing* innehåller *Plastering* (2 arbetsdagar, 7 och 8 juni), sedan *Painting* (3 arbetsdagar, 9 till 11 juni) och sedan *Snagging* (2 arbetsdagar, 14 och 15 juni). *Cleaning* följer fasen med SS. Du skulle vänta dig en start måndag 7 juni. Appen låter *Cleaning* vänta på starten av *Snagging*, uppgiften som startar sist: måndag 14 juni.

### Vilket samband är drivande

*Pour foundation* (2 arbetsdagar) pågår från måndag 7 till tisdag 8 juni. Två grenar följer:

- *Build walls* (5 arbetsdagar): onsdag 9 till tisdag 15 juni.
- *Order roof elements* (2 arbetsdagar): onsdag 9 och torsdag 10 juni.

*Place roof elements* (3 arbetsdagar) följer båda: med FS efter murverket, och med FS och fördröjning `5` efter beställningen (leveranstiden). Från murverket skulle placeringen kunna starta onsdag 16 juni. Från beställningen är fredag 11, måndag 14, tisdag 15, onsdag 16 och torsdag 17 juni väntetid. Placeringen startar fredag 18 juni. Sambandet med beställningen är därför drivande, trots att beställningen är mycket kortare än murverket. Murverket har 2 arbetsdagar slack.

## Gevolgen och vanliga misstag

**”Ett samband låser uppgifterna.”** Nej, ett samband är en undre gräns. En efterföljande uppgift startar tidigast på det datum sambandet ger, och senare om ett annat samband eller en restriktion kräver det. Hur restriktioner passar in förklaras i [Restriktioner och måldatum](docs://uitleg-constraints).

**”SS betyder att uppgifterna startar samtidigt.”** SS säger bara att den efterföljande uppgiften inte får starta före den föregående. Har den efterföljande uppgiften en annan föregående uppgift som slutar senare, startar den senare.

**”Med FF startar den efterföljande uppgiften samma dag.”** Nej, med FF sammanfaller slutdatumen. En kort efterföljande uppgift startar därför senare än den föregående, som Pointing i exemplet.

**”En fördröjning i dagar räknar kalenderdagar.”** Som standard räknar en fördröjning arbetsdagar, i den föregående uppgiftens kalender. Vid härdning eller torkning, när helgen också ska räknas, använder du kalenderdagar (`ed`).

**”En uppgift utan samband är inget problem.”** En uppgift utan föregående uppgift startar på sitt planerade startdatum. En uppgift utan efterföljande uppgift får slack till projektets slut. Om du glömmer ett samband ser en uppgift alltså ut att ha gott om utrymme. Se de vanliga misstagen i [Kritisk linje och slack](docs://uitleg-kritiek-pad).

**”Ett samband på en fas är ett enda samband.”** För beräkningen är det ett samband per uppgift i fasen. Flyttar du uppgifter in i eller ut ur en fas, ändras också de samband som gäller för de uppgifterna.

## Se även

- [Lägga till samband](docs://howto-relaties-leggen): stegen för att länka uppgifter till varandra och ange en fördröjning.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad appen beräknar utifrån dina samband, och varför en uppgift blir kritisk.
- [Restriktioner och måldatum](docs://uitleg-constraints): datumavtal vid sidan av sambanden.
- [Spåra en väg](docs://howto-pad-traceren): göra kedjan före eller efter en uppgift synlig.
- [Skapa en hängmatta](docs://howto-hammock): en uppgift med en härledd varaktighet, som hänger på samband av typen SS och FF.
- [Externa samband till ett annat projekt](docs://howto-externe-relaties): samband med en uppgift i en annan projektfil.
