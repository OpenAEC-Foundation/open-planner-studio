# Kalendrar och arbetsdagar

Hur många arbetsdagar tar en uppgift, och vilket datum är den klar? Det beror på kalendern som appen räknar i. I den här artikeln läser du vad en kalender är, hur appen räknar arbetsdagar med den och vilken kalender som gäller när fler än en är inblandad. Exemplet hjälper dig att följa siffrorna.

## Begreppet

En tidsplan räknar i **arbetsdagar**, inte i kalenderdagar. ”Fem dagars murning” betyder fem dagar då arbete utförs. En helg eller en allmän helgdag räknas inte. Därför spänner en sådan uppgift över mer än fem dagar i almanackan.

Vilka dagar som är arbetsdagar anges i en **kalender**. En kalender bestämmer tre saker:

- **Arbetsveckan**: de veckodagar då arbete utförs. Som standard är det måndag till fredag.
- **Arbetstiderna**: start, slut och rast. De ger de **nettotimmarna per dag**. Som standard är det 07:00 till 16:00 med en timmes rast, alltså 8 timmar.
- **Helgdagarna**: enskilda dagar eller hela perioder då inget arbete utförs, till exempel Kungens dag, jul eller byggsemestern.

Ett projekt har ett bibliotek med kalendrar. En av dem är **projektkalendern**. Den gäller för varje uppgift som inte har en egen kalender. Du ger en enskild uppgift en annan kalender, till exempel en sexdagarsvecka för en underentreprenör som också arbetar på lördagar. En resurs kan också ha en egen kalender, men den gör något annat (se nedan).

## Hur appen beräknar

Den här artikeln beskriver standardberäkningen: beräkningsprofilen *Open Planner Studio*, som ett nytt projekt beräknas med.

### Att räkna arbetsdagar

Den första arbetsdagen för en uppgift räknas som dag 1. En uppgift på 5 dagar slutar alltså på den femte arbetsdagen. Om starten faller på en ledig dag börjar uppgiften nästa arbetsdag. En helgdag eller byggsemestern mitt i en uppgift räknas inte. Uppgiften går bara över den och blir längre i almanackan.

Antalet timmar per dag spelar ingen roll för datumen för en uppgift i dagar. Bara arbetsveckan och helgdagarna räknas. Arbetstiderna används bara för en uppgift i timmar. Det beskrivs i [Dagar och timmar](docs://uitleg-dagen-en-uren).

### Vilken kalender som gäller

Appen väljer en kalender per uppgift:

1. Har uppgiften en egen kalender, då beräknar appen uppgiften helt i den kalendern: varaktighet, slutdatum och slack.
2. Har den ingen, då gäller projektkalendern. Pekar en uppgift på en kalender som inte längre finns, då gäller också projektkalendern.

En sammanfattningsuppgift (en fas) har inget eget arbete och därmed ingen egen kalender. Dess varaktighet följer av datumen för dess uppgifter, och appen räknar den i projektkalendern.

Kalendern för en **resurs** spelar ingen roll för datumen. I en tidsplan som du bygger själv i appen avgör den bara när resursen är tillgänglig: i histogrammet, för överbeläggning och vid utjämning.

### Uppgifter på olika kalendrar

När två uppgifter med olika kalendrar är länkade gäller följande:

- Med ett samband av typen slut-till-start börjar den efterföljande uppgiften på den första arbetsdagen efter slutet på den föregående uppgiften. Det räknas i kalendern för den **efterföljande** uppgiften. Slutar en uppgift på en fredag, då börjar en efterföljande uppgift med sexdagarsvecka på lördagen.
- En **fördröjning** räknas som standard i kalendern för den **föregående** uppgiften. Det kan du ändra under *Inställningar › Projekt › Projektinfo*, i blocket *Beräkningsprofil och beräkningsalternativ*, under *Beräkningsalternativ för det här projektet*, med valet *Fördröjningskalender*: *Föregående* (standard), *Efterföljande*, *24-timmars* eller *Projektkalender*.
- Det **totalt slack** räknas i arbetsdagar i kalendern för uppgiften självt. I den här profilen räknas det **fritt slack** i kalendern för den efterföljande uppgiften.

Vad en fördröjning exakt är beskrivs i [Lägga till samband](docs://howto-relaties-leggen). Vad slack är beskrivs i [Kritisk linje och slack](docs://uitleg-kritiek-pad).

### I Gantt-diagrammet

Den grå bakgrunden i Gantt-diagrammet visar alltid de lediga dagarna i **projektkalendern**. En uppgift med en egen kalender kan därför löpa över en grå dag, till exempel en sexdagarsuppgift över lördagen. Ett block med helgdagar på tre dagar eller mer får sitt namn visat, till exempel *Bouwvak (Noord)*. Det händer inte när *Visa endast arbetsdagar* är på. Vill du inte se de grå dagarna alls, slå då på *Visa endast arbetsdagar* under *Inställningar › Projekt › Inställningar*, fliken *Utseende*, rubriken *Tidsaxel*.

## Exempel: tidsplanen för bygget

Exemplet använder kalendern *Bouwkalender NL*: måndag till fredag, med de nederländska allmänna helgdagarna. Alla uppgifter varar ett helt antal dagar. I självstudien om kalendrar (självstudie 3) bygger du en sådan kalender själv.

### Helg, helgdag och byggsemester

*Brickwork* varar 5 arbetsdagar och börjar på torsdag 13 maj 2027. Torsdag 13 och fredag 14 maj är dag 1 och 2. Helgen och annandag pingst, 17 maj, räknas inte. Tisdag 18, onsdag 19 och torsdag 20 maj är dag 3, 4 och 5. Uppgiften är klar på **torsdag 20 maj**: åtta kalenderdagar för fem arbetsdagar.

En byggsemester gör skillnaden större. Tänk dig *Bouwvak (Noord)*, från 26 juli till och med 13 augusti 2027, och samma uppgift på 5 arbetsdagar från fredag 23 juli. Fredag 23 juli är dag 1. Därefter står kalendern stilla i tre veckor. Måndag 16 till torsdag 19 augusti är dag 2 till 5. Slutet är **torsdag 19 augusti**, 28 kalenderdagar efter starten. Utan byggsemestern hade det varit torsdag 29 juli.

### En uppgift på lördag

Tre uppgifter följer på varandra. Alla tre har ett samband av typen slut-till-start utan fördröjning: *Groundwork* (4 dagar), *Pour foundation* (3 dagar) och *Brickwork* (5 dagar). Projektstarten är måndag 24 maj 2027.

Ligger alla tre i projektkalendern, då löper *Groundwork* från måndag 24 till torsdag 27 maj. *Pour foundation* löper från fredag 28 maj till tisdag 1 juni (fredag, måndag, tisdag). *Brickwork* löper från onsdag 2 juni till tisdag 8 juni. Projektslutet är **tisdag 8 juni**.

Ge *Pour foundation* kalendern *Six-day week* (måndag till lördag). Då räknas lördagen. Uppgiften löper från fredag 28 maj till **måndag 31 maj** (fredag, lördag, måndag). *Brickwork* ligger kvar i projektkalendern, startar tisdag 1 juni och är klar på **måndag 7 juni**. Hela projektet är en dag kortare, eftersom en uppgift arbetar på lördag.

### En fördröjning över två kalendrar

*Pour floor* (sexdagarsvecka, 4 dagar) startar måndag 31 maj och är klar torsdag 3 juni. *Pointing* (projektkalender, 3 dagar) följer med en fördröjning på 2 arbetsdagar. Utan fördröjningen hade *Pointing* startat fredag 4 juni.

- Som standard räknas fördröjningen i kalendern för den föregående uppgiften, sexdagarsveckan. Från fredag 4 juni är lördag 5 juni den första arbetsdagen och måndag 7 juni den andra. *Pointing* startar på **måndag 7 juni** och är klar onsdag 9 juni.
- Ställer du *Fördröjningskalender* på *Efterföljande* räknas projektkalendern. Lördagen räknas då inte: måndag 7 juni är den första arbetsdagen och tisdag 8 juni den andra. *Pointing* startar på **tisdag 8 juni** och är klar torsdag 10 juni.

### Slack i sin egen kalender

*Brickwork* (5 dagar, projektkalender) och *Crane hire* (3 dagar, sexdagarsvecka) startar båda måndag 24 maj. Båda är föregående uppgifter till *Fit window frames* (2 dagar, projektkalender).

*Brickwork* är klar fredag 28 maj, så *Fit window frames* startar måndag 31 maj. *Crane hire* är redan klar onsdag 26 maj. Det **totalt slack** för *Crane hire* räknas i kalendern för uppgiften självt: torsdag 27, fredag 28 och lördag 29 maj. Det är alltså **3 arbetsdagar**. Låg *Crane hire* i projektkalendern, då hade det blivit 2 arbetsdagar. Det **fritt slack** är 2 arbetsdagar (torsdag och fredag), eftersom appen räknar det i kalendern för den efterföljande uppgiften.

### Kalendern för en resurs

I ett annat exempelprojekt har resursen *Bricklaying crew* kalendern *Crew Mon–Thu* (måndag till torsdag). Den är tilldelad med 1 tilldelningsenhet per dag till *Brickwork* (5 dagar, projektkalender, från måndag 31 maj till fredag 4 juni).

Datumen för *Brickwork* ändras inte. Men fredag 4 juni är röd i histogrammet, med meddelandet *Arbetar inte denna dag enligt kalendern "Crew Mon–Thu"*. Menyfliksområdet visar dessutom en resurs under *Överbeläggning*. Utjämning löser inte detta. Att flytta hjälper inte, eftersom fem arbetsdagar i rad alltid innehåller en fredag. I fönstret *Utjämna resurser* står uppgiften därför under *Kvarvarande konflikter*, med skälet *Resursen arbetar inte alla dagar som uppgiften behöver — att flytta löser inte detta.*

## Följder och missförstånd

**”Resursens kalender flyttar mina uppgifter.”** Nej. En resurskalender ändrar inga datum alls. Den gör bara överbeläggning synlig. Vill du att uppgiften självt ska löpa på andra dagar, ge uppgiften en egen kalender.

**”Om jag byter projektkalender flyttas allt.”** Bara de uppgifter som saknar egen kalender flyttas med. En uppgift som du själv har gett en kalender från listan behåller den, även om det råkar vara den gamla projektkalendern. Tar du bort en kalender, då sätts de uppgifter och resurser som använde den till projektkalendern.

**”Helgdagarna finns väl med?”** Helgdagar finns bara för de år för vilka de skapades. En dag utanför de åren är helt enkelt en arbetsdag. I kalenderdialogen säger appen det med *Helgdagar täcker 2025–2028; projektet löper till 2030. Generera om?*

**”Fler timmar per dag gör min uppgift kortare.”** Inte för en uppgift i dagar. Den räknar hela arbetsdagar, oavsett om dagen har 6 eller 8 timmar. Bara för en uppgift med resurser och arbetsregeln *Fast arbete* eller *Fasta enheter* ändras varaktigheten med det.

**En kalender utan arbetsdagar** kan appen inte beräkna. Beräkningen meddelar *Kalendern har inga arbetsdagar inställda*.

## Se även

- [Dagar och timmar](docs://uitleg-dagen-en-uren): hur appen räknar arbetstimmar och vad som händer när daguppgifter och timuppgifter möts.
- [Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen): stegen för att skapa en egen kalender och ge den till uppgifter.
- [Generera helgdagar och byggsemestern](docs://howto-feestdagen-genereren): stegen för att fylla i helgdagarna för ett land och byggsemestern.
- [Ställa in en resurskalender](docs://howto-resourcekalender-instellen): att registrera när en resurs är tillgänglig.
- [Kalenderfönstren](docs://ref-kalenders): alla fält i kalenderfönstren.
