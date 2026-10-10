# Lägga till samband

Mål: länka uppgifter till varandra, så att en uppgift bara startar när det som kommer före den är klart. Lägg till en väntetid (fördröjning) mellan uppgifterna där det behövs.

## När du behöver det

Utan samband vet appen inte att murarna bara kan börja när fundamentet är gjutet. Då startar varje uppgift vid projektstarten och slutdatumet betyder ingenting. Ett **samband** registrerar den ordningen. Den första uppgiften är **föregående**, den andra är **efterföljande**.

Du lägger till samband när du bygger en tidsplan, när en uppgift läggs till, eller när två uppgifter visar sig bero på varandra trots allt. En **fördröjning** är väntetid mellan två uppgifter, till exempel betong som måste härda eller en golvavjämning som måste torka.

Typen för ett samband är som standard **FS** (slut-till-start). Den efterföljande uppgiften kan då bara starta när den föregående uppgiften är klar. Appen känner också till SS, FF och SF. De kopplar en start eller ett slut till en start eller ett slut. Med SS (start-till-start) kan till exempel putsningen bara starta när installationerna har startat.

Är du osäker på vilken typ du behöver? Under typvalet förklarar en mening med de riktiga uppgiftsnamnen det, till exempel *Metselwerk kan först starta när Fundering är klar.* Väljer du en annan typ ändras meningen. Du ser den i fönstret *Typ av samband*, i blocket *Samband* och i kolumnen *Föregående* eller *Efterföljande*.

## Steg

Det finns fyra sätt att lägga till ett samband. De skapar samma samband. Välj det sätt som passar din situation bäst.

### Länka två valda uppgifter

Användbart när du arbetar i uppgiftstabellen.

1. Klicka i uppgiftstabellen på den uppgift som kommer först: den föregående uppgiften.
2. Håll ned Ctrl (⌘ på Mac) och klicka på den uppgift som kommer härnäst: den efterföljande uppgiften.
3. Välj *Start › Uppgifter › Länka ▾ › Länka valda uppgifter*. Samma knapp finns också under *Tidsplan › Samband*.

Appen skapar ett samband av typen slut-till-start utan fördröjning. Appen visar till exempel *Samband skapat: Foundation brickwork → Lay hollow-core floor*. Knappen fungerar bara med exakt två valda uppgifter.

### Rita ett samband i Gantt-diagrammet

Användbart när du lägger till många samband i rad.

1. Välj *Start › Uppgifter › Länka ▾ › Rita samband*. Ovanför tidsplanen visas meddelandet *Länkläge: dra i Gantt från en balk till en annan för att skapa ett samband. Esc stoppar.*
2. Tryck på balken för den föregående uppgiften och dra till balken för den efterföljande uppgiften. En streckad linje med en pil följer med dig.
3. Släpp musknappen. Ett litet fönster *Typ av samband* visas med typen (FS som standard) och en ruta för fördröjningen.
4. Ändra typen eller fördröjningen vid behov och tryck på Enter, eller klicka utanför fönstret. Sambandet skapas.
5. Lägg till nästa samband direkt: läget är kvar på. Du stoppar med Esc, med knappen *Stoppa* i meddelandet, eller genom att välja *Rita samband* igen.

Trycker du på Esc i fönstret *Typ av samband* registreras inget. För ett enda samband behöver du inte slå på läget. Håll Shift nedtryckt när du drar från balk till balk. *Starta samband härifrån* i en balks högerklicksmeny slår på länkläget. Du drar själv fortfarande. På fliken *Tabell*, utan Gantt, är *Rita samband* inaktiverat.

### Lägga till ett samband i egenskapspanelen

Användbart när du tittar på en uppgift och vill lägga till dess föregående eller efterföljande uppgifter.

1. Markera uppgiften. Panelen *Egenskaper* finns till höger. Om du inte ser den, slå på den med *Visa › Paneler › Egenskaper*.
2. Klicka på *Lägg till samband* i blocket *Samband*.
3. Låt riktningen vara *Föregående* om den andra uppgiften kommer först, eller välj *Efterföljande*.
4. Skriv en del av namnet på den andra uppgiften. Välj rätt uppgift med piltangenterna och Enter, eller klicka på den.
5. Välj typ (FS som standard) och fyll i en fördröjning vid behov.
6. Tryck på Enter eller klicka på bockmarkeringen (*Skapa samband*).

Uppgiftens samband visas sedan i *Samband*. Var och en visas med den andra uppgiftens WBS-nummer, typen och fördröjningen.

### Skriva samband i kolumnen Föregående

Användbart när du arbetar snabbt med tangentbordet och känner till WBS-numren.

1. Klicka på **+** till höger om rubriken i uppgiftstabellen (*Lägga till kolumn*). Välj under *Samband* kolumnen *Föregående*. Kolumnen *Efterföljande* fungerar på samma sätt.
2. Klicka i cellen för den efterföljande uppgiften i kolumnen *Föregående*.
3. Skriv WBS-numret för den föregående uppgiften, ett mellanslag och typen, till exempel `2.6 FS`. Skriv fördröjningen direkt efter: `2.6 FS+1d`. Skilj flera föregående uppgifter åt med semikolon eller komma: `3.1 FS; 3.2 SS+2d`.
4. Tryck på Enter.

Det du skriver ersätter hela cellen. Finns det redan föregående uppgifter i cellen skriver du dem också. Se fallgroparna. Trycker du på Enter eller F2 i cellen i stället för att skriva, öppnas ett fält som behåller de befintliga sambanden. Du söker efter en uppgift på WBS-nummer eller namn och väljer typ och fördröjning för varje samband.

### Ange eller ändra en fördröjning

Du skriver en fördröjning i rutan bredvid typen, på alla sätten ovan. Du ändrar en befintlig fördröjning i *Samband*. Klicka i fördröjningsrutan, skriv det nya värdet och tryck på Enter.

- `3` eller `3d`: 3 arbetsdagar. En helg räknas inte. Appen visar `+3d`.
- `3ed`: 3 kalenderdagar. Helgen räknas med, som när betong även härdar på lördag och söndag.
- `-1`: ett överlapp. Den efterföljande uppgiften kan starta en dag tidigare, så uppgifterna överlappar.
- `4h`: 4 timmar arbetstid. Appen visar det som `+4u`. Är den föregående uppgiften en daguppgift i en kalender utan egna band för arbetstid, till exempel standardkalendern, omvandlar appen detta till hela arbetsdagar. Det avrundas till närmaste hela dag: `4h` blir då 1 dag, `2h` blir 0. I en kalender med egna band för arbetstid, eller efter en timuppgift, räknas fördröjningen exakt i timmar.
- `50%`: hälften av den föregående uppgiftens varaktighet.

Exempel: fundamentbetongen måste härda innan murarna kan arbeta på den. Därför får *Pour foundation → Foundation brickwork* ett FS-samband med fördröjning `3`. Om gjutningen är fredag 18 juni 2027 startar murverket efter **Beräkna** på torsdag 24 juni. Måndag till onsdag är väntetid. Med `3ed` räknas helgen med och murverket startar tisdag 22 juni.

### Till sist: beräkna om

Ett nytt samband flyttar inga balkar ännu. Statusfältet visar *Inaktuell — beräkna om (F5)*. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Först då får de efterföljande uppgifterna sina nya datum. Vill du att appen gör detta åt dig, slå på *Beräkna automatiskt* under *Inställningar › Projekt › Inställningar*, fliken *Tidsplan*.

## Fallgropar och vad appen gör

**Omvänd ordning.** Med *Länka valda uppgifter* räknas ordningen i vilken du klickar, inte ordningen i listan. Klickar du först på den senare uppgiften går sambandet åt fel håll. Ta bort sambandet i *Samband* med papperskorgsikonen och lägg till det igen.

**Skriver du i kolumnen raderas det som fanns.** Innehåller cellen `3.4 FS; 3.2 FS` och du skriver bara `3.2 FS`, är sambandet med 3.4 borta, utan meddelande. Skriv alla föregående uppgifter, använd Enter eller F2 för att lägga till i dem, eller ångra med Ctrl+Z.

**Ett cirkelberoende.** Lägger du till ett samband som leder tillbaka till en uppgift tidigare i kedjan, kan tidsplanen aldrig starta. Appen nekar ett sådant samband: *Det här sambandet skulle ge ett cirkelberoende i tidsplanen (…). Det har inte skapats*, med uppgifterna i cirkelberoendet inom parentes. Ta först bort sambandet som sluter cirkelberoendet.

**En uppgift och dess sammanfattningsuppgift.** Ett samband mellan en uppgift och sammanfattningsuppgiften den ligger under är inte möjligt. Appen säger *Ett samband mellan en uppgift och en av dess sammanfattningsuppgifter högre upp är inte tillåtet.*

**Dubblett.** Finns sambandet redan, säger appen *Det här sambandet finns redan* och ingenting ändras.

**Kortare meddelanden i kolumnen.** Kolumnen *Föregående* ger samma avslag med en kortare text under cellen: *Den här ändringen skulle skapa ett cirkelberoende i tidsplanen.*, *Det här sambandet finns redan.* eller *En uppgift kan inte ha ett samband med sin egen sammanfattningsuppgift.* Skriver du bara ett WBS-nummer, till exempel `3.1`, saknas typen och cellen visar *Använd till exempel 1.2 FS+2d.* Cellen förblir öppen. Rätta inmatningen eller tryck på Esc för att avbryta.

**Inga halva dagar i fördröjningen.** En fördröjning i dagar är alltid ett helt tal: `1.5` blir `+2d`. En timfördröjning efter en daguppgift i en kalender utan egna band för arbetstid avrundas till hela arbetsdagar. Oläsbar inmatning, till exempel ett ord, sparas inte. Rutan hoppar tillbaka till det föregående värdet.

## Se även

- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad appen beräknar från dina samband och varför en uppgift blir kritisk.
- [Samband och fördröjning](docs://uitleg-relaties): vad de fyra typerna av samband och en fördröjning gör med datumen.
- [Spåra en väg](docs://howto-pad-traceren): hur du visar kedjan av föregående och efterföljande uppgifter.
- [Uppgiftsdialogen och egenskapspanelen](docs://ref-taak-eigenschappen): fälten för samband och fördröjning i panelen och i dialogen.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): en kedja av slut-till-start-samband med ett start-till-start-samband (väggar och tak, fördröjning på 2 dagar) och ett slut-till-slut-samband (kakel och målning, fördröjning på 1 dag).
