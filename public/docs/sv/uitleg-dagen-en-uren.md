# Dagar och timmar

En uppgift på 2 dagar och en uppgift på 16 timmar ser likadana ut, men appen räknar dem olika. Varför kan du välja mellan dagar och timmar? Och vad händer när en uppgift i timmar kopplas till en uppgift i dagar? I den här artikeln läser du hur appen räknar dagar och timmar, och var den avrundar. Det genomarbetade exemplet visar siffrorna.

## Begreppet

En **daguppgift** har en varaktighet i hela arbetsdagar, till exempel `5d`. Den tar upp hela arbetsdagar. I standardkalendern har den ett startdatum och ett slutdatum utan tid.

En **timuppgift** har en varaktighet i arbetstimmar, till exempel `12h` eller `1h 30m`. Den har en start och ett slut med klockslag, till exempel tisdag 11:00.

Enheten hör till uppgiften, inte till projektet. Du kan blanda daguppgifter och timuppgifter i en tidsplan. Det heter **blandad planering**.

Du använder timmar för arbete som inte ryms i hela dagar: en kran som du hyr i tolv timmar, en gjutning på sex timmar, en uppgift som bara kan börja efter lunch. För allt annat räcker dagar, och de är tydligare.

**Timplanering** är avstängd som standard. Så länge den är avstängd arbetar appen med dagar. Om en fil ändå innehåller timplanering, till exempel uppgifter i timmar, visar appen *Den här filen innehåller timplanering.* Dessa uppgifter räknas fortfarande ut, men du kan bara ändra deras varaktighet när du slår på timplanering.

## Så räknar appen

### Arbetstider och nettotimmar

Varje kalender har **band** för varje arbetsdag (i appen heter de *band*). Standardkalendern har 07:00 till 12:00 och 13:00 till 16:00. Glappet är rasten. Appen härleder de banden från kalenderns *Start (timme)*, *Slut (timme)* och rasten. Du behöver inte ställa in något för det. Om du ställer in egna band per veckodag har de företräde.

**Nettotimmar per dag** är summan av banden för en arbetsdag. Om arbetsdagarna har olika längd gäller den vanligaste dagtotalen. Vid lika antal gäller den högsta. Med fyra dagar på 8 timmar och en fredag på 5 timmar är nettotimmarna per dag alltså 8.

### En uppgift i timmar

Appen räknar arbetsminuter från starten, genom banden. Raster, kvällar, helger och helgdagar räknas inte. En uppgift på 12 timmar ryms alltså inte i en arbetsdag på 8 timmar: den fortsätter till nästa dag.

### En uppgift i dagar

Appen räknar hela arbetsdagar. Timmarna per dag spelar ingen roll. En uppgift på 5 dagar slutar samma dag, oavsett om kalendern har 6 eller 8 timmar per dag.

### Omvandla dagar och timmar

En dag är nettotimmarna per dag i uppgiftens kalender. Appen använder det på tre ställen:

- För *Visning av varaktighet*. Under *Inställningar › Projekt › Inställningar*, fliken *Utseende*, väljer du *Automatiskt (egen enhet per uppgift)*, *Alltid dagar* eller *Alltid timmar*. En uppgift på 18 timmar visas under *Alltid dagar* som `2.25d(18h)`: den egna enheten står inom parentes.
- För en fördröjning i timmar efter en daguppgift (se *Avrundning*).
- När du byter enhet för en uppgift. Appen räknar då dagarna från uppgiftens start, där varje dag har sina egna timmar. Den gör bara ett förslag om resultatet är exakt. Två dagar blir `16h`. I en kalender där fredagen har 5 timmar blir 5 dagar från måndag `37h`. Tolv timmar kan inte göras om till hela dagar i en kalender med dagar på 8 timmar: då lämnar appen enheten som den är.

### Daguppgifter och timuppgifter tillsammans

Reglerna nedan gäller för ett samband slut-till-start i en kalender utan egna band, till exempel standardkalendern.

- **Timuppgift → timuppgift.** Den efterföljande uppgiften börjar i samma ögonblick som den föregående är klar, även om det är mitt på dagen.
- **Timuppgift → daguppgift.** En daguppgift börjar aldrig mitt på en dag. Den börjar första arbetsdagen efter den dag då timuppgiften slutar. Resten av den dagen används inte och återkommer som slack för timuppgiften.
- **Daguppgift → timuppgift.** En daguppgift tar hela sin sista dag i anspråk. Timuppgiften börjar första arbetsdagen efter den, vid starten av det första bandet.

### Avrundning

Appen avrundar eller vägrar på fyra ställen:

- **En daguppgift efter en timuppgift** börjar nästa arbetsdag. Timuppgiften avrundas, om man så vill, uppåt till hela dagar.
- **En fördröjning i timmar** räknas i fördröjningens kalender, som standard den för den föregående uppgiften. Om den föregående uppgiften är en daguppgift i en kalender utan egna band, till exempel standardkalendern, omvandlar appen fördröjningen till hela arbetsdagar: fördröjningen delat med nettotimmarna per dag, avrundat till ett helt tal. En halv dag avrundas uppåt. Vid 8 timmar per dag räknas 1 timme som 0 dagar, 4 timmar som 1 dag och 12 timmar som 2 dagar. Det gäller också om den efterföljande uppgiften är en timuppgift. Om den föregående uppgiften är en timuppgift, eller om dess kalender har egna band, räknas fördröjningen exakt i arbetstimmar, och rasten räknas inte med.
- **En varaktighet i dagar** är alltid ett helt tal. Skriver du `1.5d` visar appen *Ange ett helt antal dagar eller timmar, till exempel 2d eller 12h.* En varaktighet i timmar kan vara `1.5h` eller `1h 30m`.
- **Byta enhet** sker bara om resultatet är exakt (se ovan).

## Genomarbetat exempel: kranen

Kalendern är måndag till fredag från 07:00 till 12:00 och från 13:00 till 16:00: 8 nettotimmar per dag. Projektet börjar måndag 7 juni 2027.

### Timuppgift, timuppgift och daguppgift

*Place crane* tar 12 timmar. Måndag har 8 arbetstimmar (5 fram till 12:00 och 3 efter rasten) och tisdag de sista 4 timmarna. Uppgiften går från måndag 07:00 till **tisdag 8 juni 11:00**.

*Adjust elements* tar 8 timmar och följer på ett samband slut-till-start. Den börjar direkt på tisdag 11:00: det är 1 timme fram till rasten och 3 timmar efter den. De sista 4 timmarna är onsdag från 07:00 till 11:00. Slutet är **onsdag 9 juni 11:00**.

*Finishing* tar 2 dagar och följer på *Adjust elements*. En daguppgift börjar inte mitt på en dag, så den börjar på **torsdag 10 juni** och slutar fredag 11 juni.

### Avrundning vid övergången

Om du utelämnar *Adjust elements* och kopplar *Finishing* direkt till *Place crane* börjar *Finishing* onsdag 9 juni och slutar torsdag 10 juni. Resten av tisdagen (4 arbetstimmar) kan inte användas. Du ser de 4 timmarna igen som totalt slack för *Place crane*: en halv arbetsdag.

Vänd på ordningen så blir det enklare. *Pour foundation* tar 2 dagar, från måndag 7 till tisdag 8 juni. *Place crane* tar nu 4 timmar och följer efter. Den börjar **onsdag 9 juni 07:00** och slutar 11:00.

### En fördröjning i timmar

Mellan *Place crane* (12 timmar) och *Adjust elements* (8 timmar) lägger du en fördröjning på 2 timmar. *Adjust elements* börjar då inte 11:00 utan på tisdag **14:00**: 1 timme fram till rasten och 1 timme efter den. Slutet flyttar med till **onsdag 9 juni 14:00**.

Efter en daguppgift fungerar en fördröjning på ett annat sätt. *Pour foundation* slutar tisdag 8 juni. Utan fördröjning börjar *Finishing* onsdag 9 juni. Med en fördröjning på 4 timmar är det en halv dag, och appen avrundar uppåt: *Finishing* börjar **torsdag 10 juni**. Med en fördröjning på 1 timme avrundar appen nedåt, och *Finishing* börjar helt enkelt på onsdag.

### En ledig fredagseftermiddag

Nu har fredagen bara ett band, från 07:00 till 12:00: 5 timmar. De andra dagarna har kvar 8 timmar. Nettotimmarna per dag är kvar 8, eftersom det är den vanligaste dagtotalen. En vecka har nu 37 arbetstimmar.

En uppgift på 40 timmar från måndag 7 juni 07:00 använder måndag till torsdag (32 timmar) och fredagen (5 timmar). De sista 3 timmarna infaller på följande måndag, från 07:00 till 10:00. Slutet är **måndag 14 juni 10:00**. En uppgift på 5 dagar skulle ta 37 timmar i anspråk från måndag, och det är vad appen föreslår om du byter enheten för 5 dagar till timmar.

I självstudie 4 om timplanering planerar du själv ett kranjobb i timmar.

## Konsekvenser och missförstånd

**”8 timmar är 1 dag.”** Bara om kalendern har dagar på 8 timmar. I kalendern med den lediga fredagseftermiddagen är 5 dagar 37 timmar, inte 40.

**”Om jag ställer in fler timmar per dag blir min daguppgift klar tidigare.”** Nej. En daguppgift räknar hela arbetsdagar. Timmarna per dag ändrar bara vad en dag är värd i timmar, till exempel i visningen och för en fördröjning i timmar. Bara för en uppgift med resurser och arbetsregeln *Fast arbete* eller *Fasta enheter* ändras varaktigheten med det, eftersom arbetet är detsamma: 40 timmars arbete är 5 dagar vid 8 timmar per dag och 7 dagar vid 6 timmar per dag.

**”En uppgift på 8 timmar varar en dag.”** Bara om den börjar i början av dagen. Om den börjar senare, till exempel *Adjust elements* tisdag 11:00, fortsätter den till nästa dag.

**En kalender med egna band** beter sig annorlunda än standardkalendern. Du får en sådan kalender genom att ställa in arbetstider per veckodag eller genom att välja en skiftmall (*2 skift*, *3 skift*, *Nattskift* eller *24/7*). I en sådan kalender räknas en fördröjning i timmar exakt i arbetstimmar, även efter en daguppgift.

**Att stänga av timplanering** tar inte bort något. Uppgifter i timmar finns kvar och räknas fortfarande ut, men du kan inte redigera dem förrän du slår på timplanering igen.

## Se även

- [Att slå på timplanering](docs://howto-urenplanning-aanzetten): stegen för att planera en uppgift i timmar.
- [Ställa in arbetstider](docs://howto-werktijden-instellen): hur du justerar kalenderns band.
- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): hur appen räknar arbetsdagar och vilken kalender som har företräde.
- [Lägga till samband](docs://howto-relaties-leggen): stegen för att lägga till ett samband eller en fördröjning.
