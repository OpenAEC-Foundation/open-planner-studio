# Lägga till uppgifter och milstolpar

Mål: lägg till en ny uppgift eller milstolpe i din tidsplan, på den plats där den hör hemma.

## När du behöver detta

Du bygger en tidsplan, nytt arbete tillkommer, eller du vill registrera ett ögonblick, till exempel en överlämning eller en besiktning.

En **uppgift** är arbete som tar tid. En ny uppgift varar som standard 5 arbetsdagar (vid timplanering kan projektets standard vara timmar). En **milstolpe** är ett ögonblick utan varaktighet: 0 dagar. En uppgift med underuppgifter kallas en **sammanfattningsuppgift**, i byggbranschen ofta en fas. Dess varaktighet och datum följer av dess underuppgifter så snart du använder **Beräkna** (F5).

## Steg

### Lägga till en uppgift

1. Välj *Start › Uppgifter › Uppgift*. Samma knapp finns på fliken *Tabell*.
2. Panelen *Egenskaper* öppnas och fältet *Namn* är markerat. Skriv namnet och tryck på Enter.

Den nya uppgiften heter först *Ny uppgift* och börjar vid projektstarten.

Om en uppgift är markerad, hamnar den nya uppgiften direkt under den, på samma nivå. Om den markerade uppgiften är en sammanfattningsuppgift, hamnar den nya uppgiften under hela den fasen, alltså efter dess underuppgifter. Om inget är markerat, hamnar den längst ned i listan. Knappens verktygstips visar vilket av de två som händer: *Ny uppgift direkt under markeringen* eller *Ny uppgift längst ned i listan*. Om du markerar flera uppgifter skapas en ny uppgift, under den nedersta av markeringen så som du ser den på skärmen.

### Snabbt en efter en i uppgiftstabellen

Under den sista uppgiften i uppgiftstabellen finns alltid en grå rad *Ny uppgift*. Det är ännu ingen uppgift: den finns varken i Gantt-diagrammet eller i filen.

1. Klicka i en cell på den raden, eller gå dit med pilen nedåt.
2. Skriv namnet och tryck på Enter. Nu är det en riktig uppgift, på samma nivå som uppgiften ovanför. Markören står direkt på den nya grå raden under.
3. Skriv nästa namn, och så vidare.

Om du bara fyller i en varaktighet eller ett datum på den grå raden, heter uppgiften *Ny uppgift*. Om du lämnar raden utan att fylla i något, händer ingenting: ingen uppgift och inget steg i *Ångra*. Att skapa uppgiften och dess första värde är ett gemensamt steg i *Ångra*. Den grå raden finns bara när uppgiftstabellen inte är filtrerad, grupperad eller sorterad.

### Med höger musknapp på tomt utrymme

Högerklicka på tomt utrymme: i uppgiftstabellen under den sista uppgiften, eller i Gantt-diagrammet bredvid eller under balkarna. Välj *Ny uppgift* eller *Lägg till milstolpe*. Uppgiften hamnar längst ned i listan. I Gantt-diagrammet börjar den på datumet där du klickade. I uppgiftstabellen öppnas namncellen direkt, så att du kan skriva.

### Ovanför eller under en viss uppgift

Högerklicka på uppgiften och välj *Infoga ovanför* eller *Infoga under*. Tangentbordet fungerar också: Insert lägger till en uppgift ovanför den markerade uppgiften, Ctrl+I (⌘+I på en Mac) under den. I uppgiftstabellen öppnas namncellen direkt efter Insert, redo för att skriva.

Om du har markerat flera uppgifter skapas en ny uppgift: *Infoga ovanför* lägger den ovanför den översta markerade uppgiften, *Infoga under* under den nedersta.

### Lägga till en underuppgift

Högerklicka på uppgiften och välj *Ny underuppgift*. Den nya uppgiften hamnar längst ned bland underuppgifterna för den uppgiften. I uppgiftstabellen bredvid Gantt-diagrammet har en sammanfattningsuppgift också ett litet **+** efter sitt namn, som gör samma sak.

### Lägga till en milstolpe

1. Välj *Start › Uppgifter › Milstolpe ▾* och sedan *Startmilstolpe*, *Slutmilstolpe* eller *Inspektionspunkt (obligatorisk)*.
2. Skriv namnet och tryck på Enter. Placeringen följer samma regel som för *Uppgift*.

De tre typerna skiljer sig åt så här:

- En *Startmilstolpe* hör till dagens början, en *Slutmilstolpe* till dagens slut. I Gantt-diagrammet sitter romben till vänster respektive höger om dagkolumnen. Det spelar också roll för den efterföljande uppgiften. Säg att en milstolpe ligger på tisdag 29 september 2026 och att en uppgift följer på den med ett slut-till-start-samband: efter en startmilstolpe börjar uppgiften samma tisdag, efter en slutmilstolpe på onsdag 30 september.
- En *Inspektionspunkt (obligatorisk)* är en slutmilstolpe med uppgiftstypen *Besiktning* och kryssrutan *Obligatorisk (avtalsenlig)*.

### Göra en befintlig uppgift till milstolpe

Högerklicka på uppgiften och välj *Milstolpe på/av*, eller markera kryssrutan *Milstolpe* i panelen *Egenskaper*. Menyalternativet fungerar för hela markeringen. Varaktigheten blir 0.

Om du stänger av det igen, förblir det en vanlig uppgift med varaktighet 0: ange själv en varaktighet.

### Andra sätt

- Ctrl+M (⌘+M på en Mac) lägger en ny milstolpe längst ned i listan, även om en uppgift är markerad. Panelen *Egenskaper* öppnas inte.
- *Lägg till milstolpe* i högerklicksmenyn för en uppgift gör milstolpen till en underuppgift till den uppgiften, inte till en syskonuppgift.

### Kopiera en uppgift eller en hel gren

1. Klicka i Gantt-diagrammet på uppgiftens balk. Markera fler uppgifter med Ctrl+klick.
2. Tryck på Ctrl+C (⌘+C på en Mac). Appen kopierar uppgiften med alla sina underuppgifter, sambanden mellan de kopierade uppgifterna och deras resurstilldelningar.
3. Om du vill, klicka på balken för den uppgift som kopian ska placeras bredvid, och tryck på Ctrl+V (⌘+V).

Kopian har samma namn, samma datum och samma framdrift. Den läggs in som syskon till den markerade uppgiften (vid flera: den du klickade på först), längst ned bland syskonen. Om inget är markerat, hamnar den längst ned i listan. De kopierade uppgifterna markeras efteråt, WBS-koderna (varje uppgifts nummer i trädet, till exempel 1.2; se [Ändra strukturen](docs://howto-structuur-aanpassen)) fastställs på nytt och tidsplanen är inaktuell.

Urklippet delas av hela appen, så du kan också klistra in i ett annat dokument. Det som inte finns där, till exempel en kalender för uppgiften, en egen uppgiftstyp, en uppgiftskod eller ett eget fält, rensar appen och meddelar dig om det.

### Efteråt

En ny uppgift ändrar ännu inte de andra datumen. Statusfältet visar *Inaktuell — beräkna om (F5)*. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*.

## Fallgropar och vad appen gör

**Varje ny uppgift börjar vid projektstarten.** Utan samband väntar en uppgift på ingenting. Lägg till samband, se [Lägga till samband](docs://howto-relaties-leggen).

**Filtrering, gruppering eller sortering är på.** Ordningen du ser är då inte tidsplanens ordning. När en uppgift är markerad lägger *Uppgift* och *Milstolpe ▾* till den nya uppgiften längst ned, och remsan *Inte tillgänglig vid filtrering/gruppering/sortering* visas. *Infoga ovanför* och *Infoga under* nekas, med samma remsa. Knappen *Rensa* i remsan tar bort filter, gruppering och sortering på en gång. Det ingår inte i *Ångra*: Ctrl+Z återställer dem inte.

**En underuppgift under en uppgift med resurstilldelningar.** Uppgiften blir en sammanfattningsuppgift, och en sammanfattningsuppgift har inga tilldelningar själv. Appen flyttar tilldelningarna till den nya underuppgiften och meddelar dig det. Om det inte går, till exempel för att du valde *Lägg till milstolpe* och en milstolpe inte kan ha tilldelningar, lägger appen inte till något och säger varför.

**En underuppgift under en milstolpe.** Milstolpen blir en sammanfattningsuppgift och appen avmarkerar kryssrutan *Milstolpe*, med ett meddelande.

**Milstolpe på för en sammanfattningsuppgift eller en uppgift med tilldelningar.** Appen nekar och säger varför. Med tilldelningar: ta bort dem först.

**Kopiera i uppgiftstabellen.** I uppgiftstabellen (och på fliken *Tabell*) kopierar Ctrl+C bara värdena i de markerade cellerna, som i ett kalkylblad, och Ctrl+V klistrar in i celler. Att kopiera uppgifter fungerar därför bara om du använder Gantt-diagrammet: klicka först på en balk.

## Se även

- [Ändra strukturen](docs://howto-structuur-aanpassen): ändra indraget av uppgifter, flytta dem och håll WBS-numren uppdaterade.
- [Lägga till samband](docs://howto-relaties-leggen): länka uppgifter till varandra.
- [Markera, ta bort och ångra uppgifter](docs://howto-taken-selecteren-verwijderen): ta bort en uppgift igen.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad appen beräknar när det finns samband.
- [Uppgiftsdialogen och egenskapspanelen](docs://ref-taak-eigenschappen): alla fält för en uppgift.
- [Nytt projekt och projektinfo](docs://ref-projectinfo): börja med en mall för faser.
- [Högerklicksmenyer](docs://ref-contextmenus): alla alternativ i menyn för en uppgift.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): ett litet exempelprojekt (*Fil › Exempel*) med fyra faser, en startmilstolpe och en obligatorisk överlämningsmilstolpe.
