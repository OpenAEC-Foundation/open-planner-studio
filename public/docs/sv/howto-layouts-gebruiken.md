# Skapa och använda en layout

Mål: växla mellan vyer av din tidsplan med ett klick, till exempel bara de kritiska uppgifterna, uppgifterna per arbetslag eller en annan sorteringsordning.

## När du behöver detta

På platsmötet vill kunden bara se de kritiska uppgifterna. Sedan vill arbetsledaren se per arbetslag vem som behövs när. Sedan vill du se hela tidsplanen igen. Att ställa in filter, grupper och sorteringar på nytt varje gång är omständligt. En **layout** sparar en sådan vy som en knapp i menyfliksområdet.

En layout kan spara sex saker: filtret, grupperingen, sorteringen, kolumnerna i uppgiftstabellen bredvid Gantt-diagrammet, tidsskalan samt sambandslinjerna och överlagringarna (baslinje, framdriftslinje, linje för rapportdatum, resursmarkering, slackband och balkfärger). Bara det du markerar ändras när du klickar på knappen. Resten av vyn förblir som den är.

Du filtrerar, grupperar och sorterar med en layout. De separata knapparna *Filtrera…*, *Gruppera…* och *Sortera…* finns nu bara bakom en dold inställning (se fallgroparna).

## Steg

### Använda en befintlig layout

1. Välj fliken *Visa*. I gruppen *Layout* finns en knapp per layout. Som standard är det *Resursdiagram*.
2. Klicka på den. *Resursdiagram* grupperar uppgifterna per resurs, sorterar i varje grupp på start och stänger av sambandslinjerna. En uppgift med två resurser syns under båda.
3. Klicka igen för att stänga av layouten. Vyn går tillbaka till läget före ditt klick.

Varje klick är ett steg för *Ångra* (Ctrl+Z), både när du slår på och när du slår av.

### Skapa en egen layout

1. Klicka på *Ny layout* i gruppen *Layout*. Fönstret *Ny layout* öppnas.
2. Skriv ett *Namn* och välj en *Ikon*.
3. Under *Vad sparar den här layouten?* finns de sex delarna med en kryssruta. Ett nytt fönster börjar med alla delar ibockade och fyllt med det som finns på skärmen nu. Bocka ur allt som layouten inte får ändra. Om du bara vill ha ett filter lämnar du bara *Filtrera* ibockat. *Använd aktuell vy* fyller alla delar på nytt med det du ser på skärmen.
4. Ställ in delarna.
5. Klicka på *Spara*.

Layouten är nu en knapp i menyfliksområdet, men den är ännu inte tillämpad. Klicka på knappen för att slå på den.

### Ställa in filtret

Under *Filtrera* bygger du regler. Klicka på *+ regel*, välj ett *Fält*, en *Operator* och ett värde. Om du bara vill ha de kritiska uppgifterna: fältet *Kritisk*, operatorn *är lika med*, värdet *Ja*. Fälten omfattar *Uppgiftsnamn*, *Start*, *Slut*, *Totalt slack*, *Framdrift* och *Milstolpe*, plus dina egna uppgiftskoder och fält och *Resurser*. Operatorerna beror på typen av fält: för text kan du välja *innehåller*, för tal och datum *mellan*.

Vilka operatorer du får beror på typen av fält:

- Text (*Uppgiftsnamn*, *WBS*): *är lika med*, *är inte lika med*, *innehåller*, *börjar med* och *är tom*.
- Tal och datum (*Totalt slack*, *Start*, *Framdrift*): *är lika med*, *är inte lika med*, *mindre än*, *mindre än eller lika med*, *större än*, *större än eller lika med*, *mellan* och *är tom*. Vid *mellan* finns två fält: för ett tal med *Från* och *Till* som vägledning, för ett datum utan vägledning (det första datumet är början, det andra slutet).
- Ja/nej (*Kritisk*, *Milstolpe*, *Nära kritisk*): *är lika med* och *är inte lika med*, med värdet *Ja* eller *Nej*.
- Val (*Typ*, en uppgiftskod): *är lika med*, *är inte lika med*, *är en av* (med värden som kryssrutor) och *är tom*.
- *Resurser*: *är en av* och *är tom*.
- *Pågår*: bara *mellan*, med två datum (från och till).

Med fältet *Pågår*, operatorn *mellan* och två datum får du alla uppgifter som pågår någon gång under perioden, till exempel allt som är aktivt i juni.

Du kombinerar flera regler med listan överst: *Alla nedan (AND)* visar uppgifter som uppfyller alla regler, *Något nedan (OR)* uppgifter som uppfyller minst en regel. Med *+ grupp* lägger du till en undergrupp med egna regler.

Filtret tittar bara på uppgifterna själva. Sammanfattningsuppgifterna (faserna) som uppgiften hör till förblir synliga i grått, så att du ser var uppgiften hör hemma. Om du också grupperar försvinner de grå faserna.

### Gruppera och sortera

Under *Gruppera* lägger du till ett fält med *+ nivå*. Det finns högst två grupperingsnivåer. Utan gruppering ser du WBS-trädet. Under *Sortera* lägger du till ett fält med *+ nivå* och väljer *Stigande* eller *Fallande*. Med två nivåer avgör den andra nivån när värdena på den första är lika.

### Testa snabbt utan knapp

Klicka i fönstret på *Tillämpa utan att spara*. De ibockade delarna tillämpas på skärmen, men ingen knapp läggs till. Det är praktiskt för ett filter som du bara behöver en gång. Ctrl+Z ångrar det.

### Ändra, kopiera eller ta bort en layout

Högerklicka på layoutknappen. Du kan välja *Redigera…*, *Duplicera* eller *Ta bort*. *Ta bort* frågar först om bekräftelse. En kopia heter *namn (kopia)*. En inbyggd layout, till exempel *Resursdiagram*, kan du inte redigera eller ta bort. Du duplicerar den för att få en egen version.

### Mer än en layout samtidigt

Layouter som inte sparar samma delar kan vara påslagna samtidigt. Har du en layout som bara sparar filtret *Kritisk är lika med Ja* (kalla den till exempel *Bara kritiska*) och slår på den tillsammans med *Resursdiagram* (gruppering, sortering, sambandslinjer), så får du de kritiska uppgifterna per resurs. Om två layouter sparar samma del, till exempel båda ett filter, tar den andra över och den första stängs av. Stänger du av den andra igen, återgår du till vyn från före ditt första klick, inte till den första layouten.

## Fallgropar och vad appen gör

**Du glömmer att bocka ur delar.** En layout som också sparar kolumnerna, tidsskalan och överlagringarna återställer dessa delar till det sparade läget vid varje klick. Din zoomnivå hoppar då iväg, trots att du bara ville ha ett filter. Kontrollera i fönstret att bara de avsedda delarna är ibockade.

**En ofullständig regel visar ingenting.** Om du inte väljer något värde för ett ja/nej-fält (där det fortfarande står *—*) eller lämnar datumen för *Pågår* tomma, matchar ingen uppgift och listan förblir tom. Slutför regeln.

**En manuell ändring stänger av layouten.** Ändrar du själv en del som layouten sparar, till exempel *Sambandslinjer* medan *Resursdiagram* är påslaget, då släpper den layouten och de andra delarna går tillbaka till vyn från före layouten. Zoomning stänger av en layout som sparar tidsskalan, och att göra en kolumn bredare stänger av en layout som sparar kolumnerna. Resten av vyn förblir då som den är. *Resursdiagram* sparar inte tidsskalan, så zoomning påverkar det inte.

**Kolumner gäller uppgiftstabellen bredvid Gantt-diagrammet.** Delen *Kolumner* sparar kolumnerna i uppgiftstabellen till vänster om tidslinjen. Tabellen på fliken *Tabell* behåller sina egna kolumner. Hur du väljer kolumner beskrivs i [Justera tabellkolumner](docs://howto-tabelkolommen-aanpassen).

**Indrag och dra ut är inaktiverade.** Så länge ett filter, en gruppering eller en sortering är påslaget, stämmer den visade ordningen inte med tidsplanens ordning. *Indrag* och *Dra ut* är då inaktiverade, med infotexten *Inte tillgänglig vid filtrering/gruppering/sortering*. Stäng av layouten om du vill ändra strukturen igen, så som beskrivs i [Justera strukturen](docs://howto-structuur-aanpassen).

**Statusfältet följer inte med.** *Uppgifter:* i statusfältet visar antalet uppgifter i hela projektet, även om ett filter bara visar en del av dem.

**Layouter finns på din enhet, inte i projektet.** Appen sparar dina layouter och kolumnerna för alla dina projekt på den här enheten. Överlagringarna från en layout (baslinje, framdriftslinje och resten) gäller för alla dina projekt. Filtret, grupperingen och sorteringen som är påslagna just nu hör till det öppna projektet, men de ingår inte i projektfilen. Efter att du sparat och öppnat igen är vyn ren igen. De gör inte heller projektet ”ändrat”.

**De separata knapparna är dolda.** *Kolumner…*, *Filtrera…*, *Gruppera…* och *Sortera…* som egna knappar på fliken *Visa* hör till en äldre vy. Du hämtar tillbaka dem med *Visa klassiska vyknappar* under *Äldre funktioner* på fliken *Avancerat* i inställningsfönstret (⚙ i namnlisten). Använd helst layouter.

## Se även

- [Justera tabellkolumner](docs://howto-tabelkolommen-aanpassen): att välja, flytta och fästa kolumnerna självt.
- [Skapa och skriva ut en rapport](docs://howto-rapport-maken-en-afdrukken): få vyn på papper med *Följ vy*.
- [Justera strukturen](docs://howto-structuur-aanpassen): varför du inte kan använda indrag medan du filtrerar.
