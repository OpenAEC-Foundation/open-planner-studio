# Datum så som de står i filen

Du öppnar en tidsplan från Primavera eller MS Project, och datumen skiljer sig från vad du såg i det programmet. Gick importen fel? Oftast inte. I den här artikeln läser du varför appen beräknar om av sig själv, när den visar datumen från filen, vad som då förblir tomt och hur du går tillbaka till appens egen beräkning. Exemplet i slutet följer två uppgifter genom hela förloppet.

## Begreppet

En tidsplanfil innehåller två slags data. Först logiken: uppgifter, varaktigheter, samband, kalendrar och restriktioner. Sedan de datum som programmet självt beräknade utifrån den logiken. När du öppnar filen använder Open Planner Studio logiken och beräknar själv. Datumen i filen är alltså inte indata.

Om appens egen beräkning hamnar på andra datum än filen anger vet du inte vilken sida som har rätt. Filen kan sakna logik som programmet verkligen använde. Programmet kan dessutom beräkna annorlunda än appen på någon punkt. Därför kan appen visa datumen **så som de står i filen**: de datum det andra programmet skrev i filen. Då jämför du med det du såg i det programmet.

## Så hanterar appen det

### Vilken beräkningsprofil appen använder

Appen beräknar med en **beräkningsprofil**: en uppsättning regler (beräkningsregler) som avgör till exempel hur den behandlar den planerade starten för en uppgift och restriktioner. Se [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen). Det finns tre inbyggda profiler: *Primavera P6*, *Microsoft Project* och *Open Planner Studio*. En `.xer` öppnas med *Primavera P6* och en `.mpp` med *Microsoft Project*. CSV, MS Project XML och Primavera P6 XML öppnas med *Open Planner Studio*. Projektets profil finns under *Fil › Projektinfo*, vid *Beräkningsprofil och beräkningsalternativ*. En IFC-fil från appen behåller sin profil.

### När appen jämför

Vid öppning noterar appen vad filen sa och jämför det med sitt eget resultat. Det gör den för:

- en Primavera-fil (`.xer`) och Primavera P6 XML;
- MS Project XML och MS Project-filer (`.mpp`);
- en IFC-fil från ett annat program, för de uppgifter vars tidigaste datum finns i filen;
- en IFC-fil från appen själv som har sparat sitt ursprung. Nedan läser du när det är fallet.

Appen jämför aldrig en CSV-fil: startdatumet i en CSV är indata, inte resultatet av en beräkning. En IFC-fil från appen själv utan sparat ursprung jämförs inte heller.

Om ingen uppgift skiljer sig märker du ingenting. Om minst en uppgift skiljer sig i en fil som du importerar just nu slår appen på vyn direkt.

Med en Primavera-fil beräknar appen med beräkningsprofilen *Primavera P6*. Då behålls den planerade starten från filen som tidigaste start. En uppgift som ligger senare i filen än sambanden kräver, men som också är planerad där, står därför kvar: då finns ingen skillnad.

### Vad du ser

Under menyfliksområdet finns ett fält. Där står: *Du ser datumen så som de står i filen; när du beräknar om skulle 4 uppgifter flyttas.* Med en Primavera-källa (en `.xer` eller Primavera P6 XML) står det: *Du ser tidsplanen så som Primavera sparade den; när du beräknar om skulle 1 uppgift flyttas.* Till höger i fältet finns knappen *Beräkna om*. Fältet har inget kryss.

Det finns också ett meddelande: *4 uppgifter visar datumen så som de står i filen (inte beräknas om).* Bara med en `.xer` står det *1 uppgift visar datumen så som Primavera sparade dem (inte beräknas om).* Varje uppgift vars datum finns sparade i filen visar en markering i panelen *Egenskaper*: *Visar Primaveras egna sparade datum för den här uppgiften* vid en Primavera-källa, eller *Visar datumen så som de står i filen för den här uppgiften* vid en annan källa. Gantt-schemat, uppgiftstabellen och statusfältet visar datumen från filen.

### Vad som förblir tomt i den här vyn

I den här vyn beräknar appen ingenting. Den visar bara det som filen sparade. Du ser därför slack och kritisk linje bara om filen innehåller dem. Om filen inte sparar några kritiska uppgifter visar statusfältet 0 kritiska uppgifter. Det säger inget om den kritiska linjen i programmet självt. Det som bara kommer fram vid en beräkning finns inte i den här vyn: vilka samband som styr tidsplanen, överträdda restriktioner, uppgifter som hamnar i fel ordning och nära kritiska uppgifter.

Om filen inte sparar allt för en uppgift ser du markeringen *Lagringen är delvis ofullständig. Se kolumnerna senaste start/slack* i panelen *Egenskaper*. I en CSV-export förblir kolumnerna *Kritisk* och *Totalt slack* tomma för en sådan uppgift, i stället för en påhittad nolla.

### Lämna vyn

Du lämnar vyn på två sätt:

- Klicka på *Beräkna om* i fältet, eller välj *Beräkna* (F5). Appen beräknar med sina egna regler.
- Ändra något som kan ändra datumen, till exempel varaktigheten för en uppgift eller en ny uppgift. Appen lämnar vyn och beräknar om direkt, även om *Beräkna automatiskt* är avstängt. Att ändra ett namn gör inte det: vyn står kvar.

Efter att du har lämnat vyn finns ingen knapp för att gå tillbaka till den. Ctrl+Z tar tillbaka den, direkt efter en omberäkning eller direkt efter en sådan ändring. Annars kan du öppna källfilen igen. Med en `.xer` slår också en IFC-fil som du sparade efter omberäkningen, men inte redigerade, på vyn igen.

### Kraschskydd

Om du återställer ett projekt efter en krasch som var i vyn, står vyn kvar på. Det aktiva projektet visar samma fält som förut. Ett projekt på en annan flik visar fältet utan siffra: *Du ser datumen så som de står i filen. Ingen omberäkning har gjorts.* Se [Återställa efter en krasch](docs://howto-herstellen-na-een-crash).

### Spara och öppna igen

Om du sparar medan du använder vyn skriver appen de visade datumen till IFC-filen, tillsammans med källformatet. Om du senare öppnar den IFC-filen igen och inte har redigerat den sedan importen, är vyn på igen, utan ett nytt meddelande.

Om du har redigerat och sparat däremellan beror det på källan. Med en Primavera-fil sparar IFC-filen också den ursprungliga `.xer`-filen. Appen jämför då på nytt och erbjuder vyn: *Omberäkningen flyttade 1 uppgift av 2 jämfört med datumen i filen.* Tillsammans med det följer knappen *Visa sparade datum* och ett kryss. På varje avvikande uppgift visar panelen *Egenskaper* markeringen *Avviker från de sparade datumen*. *Visa sparade datum* slår på vyn; Ctrl+Z ångrar det. Krysset döljer erbjudandet.

Med MS Project XML, `.mpp`, Primavera P6 XML eller en IFC-fil från ett annat program sparar IFC-filen inte källan. Om du redigerar och sparar ett sådant projekt jämför appen inte längre när du öppnar det igen.

## Exempel: tillbyggnaden

Anta att du öppnar en Primavera-fil *Uitbouw* (tillbyggnad) med två uppgifter, på en kalender utan helgdagar. År 2027 är 6 maj Kristi himmelsfärsdag och 17 maj är annandag pingst: med helgdagar i kalendern blir datumen annorlunda. *Fundering storten* (gjuta grund) tar 5 arbetsdagar, *Metselwerk* (murverk) 10 arbetsdagar, och Metselwerk följer på Fundering med ett samband av typen slut-till-start. Filen anger att Fundering går från måndag 3 maj till fredag 7 maj 2027 och Metselwerk från måndag 17 maj till fredag 28 maj 2027: en vecka efter den tidigaste start som sambandet tillåter. Den planerade starten för Metselwerk i filen är måndag 10 maj 2027.

Direkt efter öppningen ser du datumen från filen. Statusfältet visar *Slut: 28-05-2027* och *Kritisk linje: 2 uppgifter, 20 arbetsdagar*. Fältet visar att 1 uppgift skiljer sig vid omberäkning, och båda uppgifterna visar *Visar Primaveras egna sparade datum för den här uppgiften*.

När du väljer *Beräkna om* ligger Fundering kvar på 3 till 7 maj. Metselwerk börjar nu måndag 10 maj, den arbetsdag efter att Fundering slutar, och slutar fredag 21 maj. Tidsplanen slutar 21 maj 2027 och omfattar 15 arbetsdagar i stället för 20. Den kritiska linjen består av samma 2 uppgifter.

Vad händer om det är annorlunda?

- Om Metselwerk också är planerad till måndag 17 maj i filen behåller beräkningsprofilen *Primavera P6* den starten. Beräkningen ger 17 till 28 maj, det finns ingen skillnad och vyn slås inte på.
- Du lägger till en uppgift i vyn: samma omberäkning. Metselwerk flyttas till 10 till 21 maj.
- Du sparar i vyn och öppnar IFC-filen igen, utan att redigera: Metselwerk är tillbaka på 17 till 28 maj.
- Du beräknar om, sparar utan att redigera mer och öppnar IFC-filen igen: vyn är på igen och Metselwerk ligger på 17 till 28 maj.
- Du redigerar, sparar och öppnar igen: appen erbjuder vyn med *Omberäkningen flyttade 1 uppgift av 2 jämfört med datumen i filen.* Metselwerk visar *Avviker från de sparade datumen*.

## Konsekvenser och missförstånd

**En skillnad är inget importfel.** Appen beräknar med sina egna regler: med en `.xer` och beräkningsprofilen *Primavera P6*, med en `.mpp` och *Microsoft Project*, med CSV, MS Project XML och Primavera P6 XML och *Open Planner Studio*. Varför datumen i källprogrammet blev annorlunda kan bero på filen eller på programmet. Vyn visar dig *att* de skiljer sig.

**Vyn är inget beräkningsresultat.** Appen har inte beräknat datumen. Ta dem inte bara över som resultatet av din egen tidsplan.

**Att spara i vyn behåller datumen från källprogrammet.** IFC-filen innehåller då vad källprogrammet angav, inte vad appen skulle beräkna.

**Knappen *Visa sparade datum* visas inte vid varje import.** Med en nyss öppnad fil är vyn redan på. Knappen visas bara med en återöppnad IFC-fil med en Primavera-källa som du har redigerat sedan importen.

## Se också

- [Filer och format](docs://uitleg-bestanden): vad appen sparar i en fil och vad en import eller export bär.
- [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen): stegen och meddelandena för en `.xer`-fil.
- [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen): stegen och meddelandena för en `.mpp`-fil.
- [Återställa efter en krasch](docs://howto-herstellen-na-een-crash): vad som händer med det här projektet efter en krasch.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): hur appen beräknar slack och kritiskhet när den gör en beräkning.
