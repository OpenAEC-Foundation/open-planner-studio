# Datum så som de står i filen

Du öppnar en tidsplan från Primavera eller MS Project, och datumen skiljer sig från vad du såg i det programmet. Gick importen fel? Oftast inte. I den här artikeln läser du varför appen beräknar om av sig själv, när den visar datumen från filen, vad som då förblir tomt och hur du går tillbaka till appens egen beräkning. Exemplet i slutet följer två uppgifter genom hela förloppet.

## Begreppet

En tidsplanfil innehåller två slags data. Först logiken: uppgifter, varaktigheter, samband, kalendrar och restriktioner. Sedan de datum som programmet självt beräknade utifrån den logiken. När du öppnar filen använder Open Planner Studio logiken och beräknar själv. Datumen i filen är alltså inte indata.

Om appens egen beräkning hamnar på andra datum än filen anger vet du inte vilken sida som har rätt. Filen kan sakna logik som programmet verkligen använde. Programmet kan dessutom beräkna annorlunda än appen på någon punkt. Därför kan appen visa datumen **så som de står i filen**: de datum det andra programmet skrev i filen. Då jämför du med det du såg i det programmet.

## Så hanterar appen det

### Vilken beräkningsprofil appen använder

Appen beräknar med en **beräkningsprofil**: en uppsättning regler (beräkningsregler) som avgör hur den behandlar till exempel den planerade starten för en uppgift och restriktioner. Se [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen). Det finns tre inbyggda profiler: *Primavera P6*, *Microsoft Project* och *Open Planner Studio*. En `.xer` öppnas med *Primavera P6* och en `.mpp` med *Microsoft Project*. CSV, MS Project XML och Primavera P6 XML öppnas med *Open Planner Studio*. Projektets profil finns under *Fil › Projektinställningar*, vid *Beräkningsprofil och beräkningsalternativ*. En IFC-fil från appen behåller sin profil.

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

Det finns också ett meddelande: *12 uppgifter visar datumen så som de står i filen (inte beräknas om).* Bara med en `.xer` står det: *12 uppgifter visar datumen så som Primavera sparade dem (inte beräknas om).* Det talet räknar varje uppgift för vilken filen sparade datum, också de uppgifter som inte skiljer sig. Antalet uppgifter som skiljer sig efter omberäkningen står i fältet. Varje uppgift vars datum finns sparade i filen visar en orange markering i panelen *Egenskaper*, direkt ovanför *Start*: *Du ser de datumen som Primavera sparade, inte appens beräkning.* Vid en annan källa står det: *Du ser de datumen som fanns i filen, inte appens beräkning.* En andra rad säger vad som händer med uppgiften när du beräknar om: *När du beräknar om ändras den här uppgiften.* eller *När du beräknar om förblir den här uppgiften oförändrad.* Gantt-diagrammet, uppgiftstabellen och statusfältet visar datumen från filen.

### Uppgifter som har startat eller är klara

En uppgift som är klar ligger på de dagar då den verkligen skedde: från verklig start till verkligt slut. En uppgift som pågår startar den dag då den verkligen startade. Den slutar på det beräknade slutet. Detta gäller i den här vyn, efter en omberäkning och med alla beräkningsprofiler, precis som i Primavera och MS Project.

För en sådan uppgift sparar filen ofta andra tidigaste datum. Primavera sätter den tidigaste starten för en uppgift som pågår eller är klar på rapportdatumet. Du ser de datumen i kolumnerna *Tidigaste start* och *Tidigaste slut*, inte i *Start* och *Slut*. En uppgift som är klar räknas därför aldrig som en skillnad. En uppgift som pågår räknas bara när dess slut skiljer sig.

För en uppgift som har startat går startdatumet inte längre att skriva. I uppgiftstabellen, i panelen *Egenskaper* och i *Redigera uppgift* är starten då skrivskyddad. För en uppgift som är klar gäller det också slutet i uppgiftstabellen. Ändra i stället *Verklig start* eller *Verkligt slut* med framdriften. I Gantt-diagrammet flyttas inte bandet för en sådan uppgift; du får då ett meddelande.

### Vad som förblir tomt i den här vyn

I den här vyn beräknar appen ingenting. Den visar bara det som filen sparade. Du ser därför slack och kritisk linje bara om filen innehåller dem. Om filen inte sparar några kritiska uppgifter visar statusfältet 0 kritiska uppgifter. Det säger inget om den kritiska linjen i programmet självt. Det som bara kommer fram vid en beräkning finns inte i den här vyn: vilka samband som styr tidsplanen, överträdda restriktioner, uppgifter som hamnar i fel ordning och nära kritiska uppgifter.

Om filen inte sparar allt för en uppgift får den orange markeringen i panelen *Egenskaper* en tredje rad, till exempel *Primavera sparade inte allt för den här uppgiften. Saknas: fritt slack.* Med en annan källa står det: *Filen innehåller inte allt för den här uppgiften.* De två första raderna står kvar: så ser du för en sådan uppgift också att datumen kommer från filen och om uppgiften ändras när du beräknar om. De saknade värdena har samma namn som kolumnerna i uppgiftstabellen. I en CSV-export förblir kolumnerna *Kritisk* och *Totalt slack* tomma för en sådan uppgift, i stället för en påhittad nolla.

### Lämna vyn

Du lämnar vyn på två sätt:

- Klicka på *Beräkna om* i fältet, eller välj *Beräkna* (F5). Appen beräknar med sina egna regler.
- Ändra något som kan ändra datumen, till exempel varaktigheten för en uppgift eller en ny uppgift. Appen lämnar vyn och beräknar om direkt, även om *Beräkna automatiskt* är avstängt. Att ändra ett namn, en beskrivning, en arbetskategori eller en uppgiftstyp gör inte det: vyn står kvar.

En kalenderändring från resursbiblioteket låter vyn och datumen från filen stå kvar, men uppdaterar talet i fältet.

Efter att du har lämnat vyn finns ingen knapp för att gå tillbaka till den. Ctrl+Z tar tillbaka den, direkt efter en omberäkning eller direkt efter en sådan ändring. Annars kan du öppna källfilen igen. Med en `.xer` slår också en IFC-fil som du sparade efter omberäkningen, men inte redigerade, på vyn igen.

### Återställa efter en krasch

Om du återställer ett projekt efter en krasch som var i vyn, förblir vyn på. Om vyn var av glömmer appen datumen från filen. Det aktiva projektet visar samma fält som förut. Ett projekt på en annan flik visar fältet utan siffra: *Du ser datumen så som de står i filen. Ingen omberäkning har gjorts.* Se [Återställa efter en krasch](docs://howto-herstellen-na-een-crash).

### Spara och öppna igen

Om du sparar medan du använder vyn skriver appen de visade datumen till IFC-filen, tillsammans med källformatet. Om du senare öppnar den IFC-filen igen är vyn på igen, utan ett nytt meddelande. Det gäller också om du har ändrat något i vyn som inte påverkar datumen, till exempel ett namn. Appen öppnar filen så som du lämnade den.

Om du sparar efter att du har lämnat vyn, genom en omberäkning eller genom en redigering som kan ändra datumen, innehåller filen appens egen beräkning. När du öppnar den igen ser du den beräkningen, utan fält och utan markering i panelen *Egenskaper*. Det finns ett undantag: en `.xer` som du bara har beräknat om och inte redigerat (se ovan). Din redigerade tidsplan är nu tidsplanen; de gamla datumen från källprogrammet hör inte längre till den. Om du ändå vill se dem öppnar du källfilen igen.

## Exempel: tillbyggnaden

Anta att du öppnar en Primavera-fil *Uitbouw* (tillbyggnad) med två uppgifter, på en kalender utan helgdagar. År 2027 är 6 maj Kristi himmelsfärdsdag och 17 maj är annandag pingst: med helgdagar i kalendern blir datumen annorlunda. *Fundering storten* (gjuta grunden) tar 5 arbetsdagar, *Metselwerk* (murverk) 10 arbetsdagar, och Metselwerk följer på Fundering med ett samband av typen slut-till-start. Filen anger att Fundering går från måndag 3 maj till fredag 7 maj 2027 och Metselwerk från måndag 17 maj till fredag 28 maj 2027: en vecka efter den tidigaste start som sambandet tillåter. Den planerade starten för Metselwerk i filen är måndag 10 maj 2027.

Direkt efter öppningen ser du datumen från filen. Statusfältet visar *Slut: 28-05-2027* och *Kritisk linje: 2 uppgifter, 20 arbetsdagar*. Fältet visar att 1 uppgift skiljer sig vid omberäkning. Båda uppgifterna visar en orange markering: *Du ser de datumen som Primavera sparade, inte appens beräkning.* Under den säger Metselwerk *När du beräknar om ändras den här uppgiften.* och Fundering *När du beräknar om förblir den här uppgiften oförändrad.*

När du väljer *Beräkna om* ligger Fundering kvar på 3 till 7 maj. Metselwerk börjar nu måndag 10 maj, den arbetsdag efter att Fundering slutar, och slutar fredag 21 maj. Tidsplanen slutar 21 maj 2027 och omfattar 15 arbetsdagar i stället för 20. Den kritiska linjen består av samma 2 uppgifter.

Vad händer om det är annorlunda?

- Om Metselwerk också är planerad till måndag 17 maj i filen behåller beräkningsprofilen *Primavera P6* den starten. Beräkningen ger 17 till 28 maj, det finns ingen skillnad och vyn slås inte på.
- Du lägger till en uppgift i vyn: samma omberäkning. Metselwerk flyttas till 10 till 21 maj.
- Du sparar i vyn och öppnar IFC-filen igen, utan att redigera: Metselwerk är tillbaka på 17 till 28 maj.
- Du beräknar om, sparar utan att redigera mer och öppnar IFC-filen igen: vyn är på igen och Metselwerk ligger på 17 till 28 maj.
- Du ändrar bara namnet på Metselwerk i vyn, sparar och öppnar igen: vyn är på igen och Metselwerk ligger på 17 till 28 maj.
- Du lägger till en uppgift i vyn, sparar och öppnar igen: appen glömmer datumen från filen. Metselwerk ligger på 10 till 21 maj, utan fält och utan markering.
- Fundering är redan klar i filen: den startade verkligen 3 maj och slutade verkligen 7 maj. Filen sparar rapportdatumet som dess tidigaste start. Bandet för Fundering ligger kvar på 3 till 7 maj, i vyn och efter omberäkningen. Fundering räknas inte som en skillnad.

## Konsekvenser och missförstånd

**En skillnad är inget importfel.** Appen beräknar med sina egna regler: med en `.xer` och beräkningsprofilen *Primavera P6*, med en `.mpp` och *Microsoft Project*, med CSV, MS Project XML och Primavera P6 XML och *Open Planner Studio*. Varför datumen i källprogrammet blev annorlunda kan bero på filen eller på programmet. Vyn visar dig *att* de skiljer sig.

**Vyn är inget beräkningsresultat.** Appen har inte beräknat datumen. Ta dem inte bara över som resultatet av din egen tidsplan.

**Att spara i vyn behåller datumen från källprogrammet.** IFC-filen innehåller då vad källprogrammet angav, inte vad appen skulle beräkna.

**Efter en redigering som kan ändra datumen kommer datumen från filen inte tillbaka.** Om du har lämnat vyn genom en sådan redigering ser du först efter att du har sparat och öppnat igen appens egen beräkning. Att ändra ett namn räknas inte: då står vyn kvar (se *Spara och öppna igen*). Öppna källfilen igen om du vill se datumen från källprogrammet.

## Se också

- [Filer och format](docs://uitleg-bestanden): vad appen sparar i en fil och vad en import eller export bär.
- [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen): stegen och meddelandena för en `.xer`-fil.
- [Öppna en MS Project-fil (.mpp)](docs://howto-mpp-openen): stegen och meddelandena för en `.mpp`-fil.
- [Återställa efter en krasch](docs://howto-herstellen-na-een-crash): vad som händer med det här projektet efter en krasch.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): hur appen beräknar slack och kritiskhet när den gör en beräkning.
