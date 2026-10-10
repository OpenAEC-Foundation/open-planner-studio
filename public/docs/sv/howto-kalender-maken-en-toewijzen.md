# Skapa och tilldela en kalender

Mål: skapa en egen kalender, till exempel en sexdagarsvecka, och ge den till de uppgifter som ska beräknas i den.

## När du behöver detta

En underleverantör arbetar också på lördagar. En grupp arbetar bara måndag till torsdag. En uppgift infaller i en tidsperiod då bara den uppgiften står stilla. Projektkalendern har då fel arbetsdagar. Med en egen kalender beräknar appen de uppgifterna på rätt dagar, och resten ligger kvar på projektkalendern. Exakt vad appen gör med en kalender kan du läsa i [Kalendrar och arbetsdagar](docs://uitleg-kalenders).

## Steg

### Skapa en kalender

1. Välj *Tidsplan › Kalender › Kalender*. Samma knapp finns under *Inställningar › Kalender › Kalender*. Fönstret *Kalendrar* öppnas. Till vänster finns projektets kalendrar. Projektkalendern har en stjärna.
2. Klicka under listan på knappen med plustecknet (*Ny kalender*). Den nya kalendern är en kopia av standarden: måndag till fredag, 07:00 till 16:00 med en timmes rast och, om *Byggläge* är på, de nederländska helgdagarna. Vill du utgå från en befintlig kalender, välj den i listan och klicka på knappen med de två arken under listan (*Duplicera*).
3. Ge kalendern ett namn under *Namn* som säger vem som använder den, till exempel *Six-day week*.
4. Klicka under *Arbetsdagar* på veckodagarna för att slå på eller av dem. *Mån–fre* återställer standardveckan, med 07:00 till 16:00. *Kontinuerligt (24/7)* slår på alla sju dagarna, från 00:00 till 24:00.
5. Justera arbetstiderna vid behov: *Start (timme)*, *Slut (timme)*, *Rasten börjar* och *Rastens varaktighet (minuter)*. Du skriver tider som HH:MM. Med pilarna höjer eller sänker du dem med en kvart. Om du anger rastens varaktighet till 0 fungerar kalendern utan rast. Appen räknar ut *Nettotimmar per dag* själv. Om timplanering är på och kalendern har band per veckodag ser du inte dessa fält. Se [Ställa in arbetstider](docs://howto-werktijden-instellen).
6. Justera helgdagarna vid behov. Hur det går till står i [Att generera helgdagar och byggsemestern](docs://howto-feestdagen-genereren).
7. Klicka på *Tillämpa*. Appen beräknar om tidsplanen direkt och stänger fönstret. Med *Avbryt* kastar du ändringarna. Om du trycker på Enter i ett inmatningsfält sparas ändringen tillfälligt och tidsplanen beräknas om också, utan att fönstret stängs. *Avbryt* ångrar då bara det du ändrat sedan dess.

### Ge en kalender till uppgifter

En ny kalender gör bara något när en uppgift använder den. Det finns två sätt.

**Via egenskapspanelen**

1. Markera uppgiften. Om du inte ser panelen *Egenskaper* slår du på den med *Visa › Paneler › Egenskaper*.
2. Välj under *Uppgift* kalendern i listan *Kalender*. Det översta valet, *Projektkalender* med namnet efter det, betyder att uppgiften inte har någon egen kalender.

**Via högerklicksmenyn**

1. Högerklicka på uppgiften i uppgiftstabellen eller på balken i Gantt.
2. Välj *Tilldela kalender* och sedan kalendern, eller *Projektkalender* för att ta bort uppgiftens egna kalender igen. Kalendern som gäller nu har en bock.
3. Vill du ge en kalender till flera uppgifter samtidigt, markera dem först med Ctrl (⌘ på en Mac) och högerklicka på en av de markerade uppgifterna. Valet gäller alla markerade uppgifter. Högerklickar du på en uppgift som inte är markerad, gäller det bara den uppgiften.

Ett nytt kalenderval gör tidsplanen inte aktuell än. Statusfältet visar *Inaktuell — beräkna om (F5)*. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Om *Beräkna automatiskt* är på (*Inställningar › Projekt › Inställningar*, fliken *Tidsplan*, rubriken *Beräkning*), gör appen det själv.

### Byta projektkalender

1. Öppna *Tidsplan › Kalender › Kalender* och välj kalendern i listan.
2. Klicka ovanför formuläret på *Som projektstandard*. Stjärnan flyttar till den kalendern.
3. Klicka på *Tillämpa*.

Bara uppgifterna utan egen kalender följer med.

### Ta bort en kalender

1. Öppna fönstret *Kalendrar* och välj kalendern i listan.
2. Klicka under listan på knappen med papperskorgen (*Ta bort*). Den knappen är inaktiverad så länge det bara finns en kalender.
3. Klicka på *Tillämpa*. Uppgifter och resurser som använde kalendern går tillbaka till projektkalendern. Tar du bort projektkalendern själv blir den första kalendern i listan den nya projektkalendern.

## Fallgropar och vad appen gör då

**Inga arbetsdagar.** Om du slår av alla veckodagar kan appen inte beräkna. När appen beräknar visar den *Kalendern har inga arbetsdagar inställda*.

**Ogiltig inmatning.** En rast utanför arbetsdagen, en starttid efter sluttiden eller en helgdag med ett felaktigt datum ger ett rött meddelande vid fältet, och *Tillämpa* är inaktiverad tills du rättar det. Vid en ogiltig rast eller helgdag visas dessutom en varningssymbol bredvid kalendern i listan (*Den här kalendern innehåller ogiltiga värden*).

**En kalender på en fas.** En fas beräknas alltid på projektkalendern, eftersom dess varaktighet följer av uppgifterna. Ge kalendern till uppgifterna själva.

**Samma kalender, två val.** I listan finns projektkalendern två gånger: som *Projektkalender: namn* och som en vanlig kalender med det namnet. Väljer du den andra, är det ett eget val för den uppgiften. Uppgiften följer då inte med när du senare väljer en annan projektkalender.

**Olika timmar per dag.** Ändrar du arbetstiderna eller rasten så att *Nettotimmar per dag* för en kalender ändras, räknar en uppgift i dagar fortfarande lika många dagar. För en uppgift med resurser och arbetsregeln *Fast arbete* eller *Fasta enheter* ändras varaktigheten med, eftersom arbetet förblir detsamma. Fyrtio timmars arbete är 5 dagar à 8 timmar per dag och 7 dagar à 6 timmar per dag. Appen visar hur många uppgifter som fick en annan varaktighet.

## Se även

- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): hur appen räknar arbetsdagar och vilken kalender som går före.
- [Dagar och timmar](docs://uitleg-dagen-en-uren): vad nettotimmar per dag gör.
- [Ställa in en resurskalender](docs://howto-resourcekalender-instellen): en kalender för en resurs i stället för en uppgift.
- [Kalenderfönster](docs://ref-kalenders): alla fält i kalenderfönstren.
