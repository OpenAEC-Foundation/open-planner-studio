# Ange en restriktion eller ett måldatum

Mål: registrera en datumöverenskommelse på en uppgift. Då tar tidsplanen hänsyn till den, eller så visar den att du inte håller den.

## När du behöver det

Tegelstenarna levereras först den 21 juni, så murningen får inte starta tidigare: en **restriktion** *starta tidigast*. Taket måste vara tätt innan byggarbetarnas helgdag börjar, och du vill få en varning om det inte går: ett **måldatum**. Gjutningen ligger fast på en dag, eftersom betongfabriken har lovat det: *måste starta på*. Vilken typ som passar när, och vad appen gör med den, förklaras i [Restriktioner och måldatum](docs://uitleg-constraints).

## Steg

Du anger en restriktion och ett måldatum i panelen *Egenskaper*.

1. Markera uppgiften. Ser du inte panelen *Egenskaper*, aktivera den med *Visa › Paneler › Egenskaper*.
2. I *Restriktion* väljer du typ, till exempel *Starta tidigast (SNET)*.
3. Med alla typer utom *Så tidigt som möjligt (ASAP)* och *Så sent som möjligt (ALAP)* visas fältet *Restriktionsdatum*. Skriv datumet i de tre rutorna för dag, månad och år, till exempel 21, 06 och 2027, och tryck på Enter. Appen hoppar själv till nästa ruta så snart en ruta är full. När du har valt typen står där redan ett datum: det från den föregående restriktionen, eller annars uppgiftens ursprungliga planerade start. Det kan skilja sig från starten som panelen visar. Skriv därför alltid själv in det datum du menar.
4. Vill du låsa uppgiften på datumet, även före de föregående uppgifterna, välj *Måste starta på (MSO)* eller *Måste slutföras på (MFO)* och markera *Obligatorisk (pinlogik)*. Det är en hård låsning. Använd den bara för ett datum som verkligen är fast.
5. Vill du också ha en andra gräns, till exempel en uppgift som tidigast får starta 14 juni och som ska avslutas senast 17 juni, välj en typ i *Sekundär restriktion* och fyll i *Sekundärt datum*. Fältet visas vid alla restriktioner som har ett datum, utom vid en hård låsning. Vid MSO och MFO är en sekundär restriktion inte tillåten: appen markerar den då i rött.
6. För ett måldatum fyller du i fältet *Måldatum* på samma sätt som restriktionsdatumet. Ett måldatum är fristående från restriktionen: du kan ange båda på samma uppgift.
7. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Tills dess visar statusfältet *Inaktuell — beräkna om (F5)*.

Fälten finns också i fönstret *Redigera uppgift*, som du öppnar genom att högerklicka på uppgiften och välja *Redigera...*. Du bekräftar med *Spara*.

I tabellen arbetar du med kolumner. Klicka på **+** i tabellhuvudet och välj under *Restriktioner* kolumnerna *Restriktionstyp*, *Restriktionsdatum* och *Måldatum* (det finns också *Hård restriktion*, *Sekundär restriktionstyp* och *Datum för sekundär restriktion*). Dubbelklicka på en cell för att redigera den: du väljer typ i en lista, och du skriver ett datum med bindestreck, till exempel 21-06-2027. *Hård restriktion* kan bara ändras för MSO och MFO.

Om uppgiften har en föregående uppgift finns en genväg för *starta tidigast*: skriv bara ett nytt startdatum i fältet *Start* (i panelen *Egenskaper*, i *Redigera uppgift* eller i tabellen), eller flytta balken i Gantt. Appen gör då själv om det till en restriktion *Starta tidigast (SNET)* och säger det till dig.

## Kontrollera resultatet

- I Gantt ligger ovanför balken en liten romb: vid startsidan för en startrestriktion och vid slutsidan för en slutrestriktion. Blå för SNET och FNET, violett för SNLT, FNLT, MSO och MFO, röd om restriktionen är överträdd. En hård låsning har en nål. Ett måldatum är en pil nedåt på måldatumet: grön så länge uppgiften är klar i tid, röd om den är försenad.
- En överträdd restriktion eller ett missat måldatum visas i panelen *Varningar* (*Tidsplan › Tidsplan › Varningar*) och i statusfältet. *Totalt slack* för uppgiften och för uppgifterna före den är då negativt.
- Med en övre gräns (*starta senast*, *avsluta senast*) eller ett måldatum betyder avsaknaden av en varning att tidsplanen klarar datumet.

## Ta bort en restriktion eller ett måldatum

I *Restriktion* väljer du *Så tidigt som möjligt (ASAP)* igen. Då tas även den sekundära restriktionen bort. Ett måldatum tar du bort genom att tömma de tre rutorna och trycka på Enter. Tryck sedan på **Beräkna**.

## Fallgropar och vad appen gör

**En restriktion på en fas.** En restriktion eller ett måldatum på en fas (sammanfattningsuppgift) har ingen effekt. Lägg den i stället direkt på uppgiften.

**En uppgift som redan har startat.** Om uppgiften har en verklig start eller framdrift behåller den sin verkliga start. En restriktion *starta tidigast* med ett senare datum flyttar uppgiften inte.

**Att skriva in ett startdatum bredvid en annan restriktion.** Om uppgiften har en föregående uppgift och redan har en annan restriktion, till exempel *Så sent som möjligt (ALAP)*, använder appen inte ett inskrivet startdatum. Ett meddelande anger restriktionen. Ändra den om du vill flytta starten.

**Ett datum i helgen.** Ett datum på en lördag, söndag eller ledig dag räknas som en arbetsdag: en nedre gräns (*starta tidigast*, *avsluta tidigast*) som nästa arbetsdag, en övre gräns (*starta senast*, *avsluta senast*) som föregående.

**En sekundär restriktion som inte är tillåten.** Appen markerar en ogiltig kombination i rött, med skälet, till exempel *Primär och sekundär får inte begränsa samma sida.* En sekundär restriktion är inte tillåten med ASAP, ALAP, MSO, MFO och en hård låsning.

**En hård låsning.** Första gången du aktiverar den varnar appen för att en hård låsning åsidosätter sambanden. Uppgiften ligger då på datumet, även före sina föregående uppgifter. De föregående uppgifterna får negativt slack.

**Ingenting ändras efter att du har angett den.** Restriktioner verkar först efter **Beräkna**. Om en övre gräns (*starta senast*, *avsluta senast*) inte har någon effekt på balkarna är det normalt: en övre gräns flyttar ingenting. Den gör slacket negativt om datumet inte hålls.

## Se också

- [Restriktioner och måldatum](docs://uitleg-constraints): vad varje typ gör, och förklaringen av hård låsning, negativt slack och måldatum.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad negativt slack gör med den kritiska linjen.
- [Samband och fördröjning](docs://uitleg-relaties): de samband som en restriktion ligger bredvid.
- [Meddelanden och varningar](docs://ref-meldingen): varningarna för en överträdd restriktion eller ett missat måldatum.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): en restriktion *starta tidigast* för bygglovet på *Demolish existing extension* (14 maj 2027) och ett måldatum som nås med marginal.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): ett medvetet snävt måldatum på *Contractual project handover* (15 juli 2027). Efter beräkning ligger slutet den 17 augusti, och många uppgifter har negativt slack.
