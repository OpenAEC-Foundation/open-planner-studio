# Spara och hantera en baslinje

Mål: spara tidsplanen som en överenskommelse (en baslinje), så att du senare kan se hur utförandet avviker, och behålla, byta namn på, välja och ta bort flera baslinjer.

## När du behöver detta

Du sparar en baslinje när tidsplanen är godkänd och arbetet ännu inte har börjat. Om tidsplanen senare revideras formellt, till exempel efter en ändringsorder, sparar du en andra baslinje och behåller den första. Så mäter du utförandet mot både den första överenskommelsen och den reviderade. Vad en baslinje exakt sparar och hur appen beräknar avvikelsen förklaras i [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).

## Steg

### Spara en baslinje

1. Tryck på **Beräkna** (F5), till exempel via *Tidsplan › Tidsplan › Beräkna*. Baslinjen sparar de datum som beräknas just då.
2. Välj *Tidsplan › Baslinjer & framdrift › Hantera baslinjer…*. Fönstret *Baslinjer* öppnas.
3. Under *Spara ny baslinje* finns ett föreslaget namn, till exempel *Baslinje 1 — (dagens datum)*. Skriv ett eget namn som du känner igen senare, till exempel *Baslinje*.
4. Klicka på *Spara*. Baslinjen finns nu i listan och är direkt den aktiva baslinjen.
5. Klicka på *Stäng*.

Under varje uppgiftsbalk i Gantt-diagrammet finns nu en tunn balk med baslinjens datum. En milstolpe får en liten romb. Du slår på eller av överlägget med *Visa › Baslinjer & framdrift › Baslinjeöverlägg*.

### Välja den aktiva baslinjen

Öppna *Hantera baslinjer…* och välj i kolumnen *Aktiv* den baslinje som du vill jämföra med. Så länge det finns baslinjer är exakt en aktiv. Gantt-överlägget, rapporttypen *Avvikelse* och *Framdriftsrapport* använder den.

### Byta namn på en baslinje

Ändra namnet i listan. Ändringen gäller direkt. Du behöver inte klicka på *Spara*.

### Ta bort en baslinje

Klicka på den lilla papperskorgen bredvid baslinjen i listan. Om du tar bort den aktiva baslinjen frågar appen *Ta bort den aktiva baslinjen?*. Därefter blir den senaste kvarvarande baslinjen den aktiva. Om det inte finns någon annan baslinje finns ingen aktiv baslinje längre och överlägget försvinner. Med Ctrl+Z återställer du en borttagen baslinje.

### Avvikelser i uppgiftstabellen

Varje baslinje har sex kolumner i uppgiftstabellen. Klicka på **+** till höger om rubriken för uppgiftstabellen (*Lägga till kolumn*) och öppna kategorin *Baslinje*. Per baslinje finns *Planerad start*, *Planerat slut*, *Varaktighet*, *Startavvikelse*, *Slutavvikelse* och *Varaktighetsavvikelse*, med namnet på baslinjen först, till exempel *Baslinje — Slutavvikelse*. Avvikelserna anges i arbetsdagar: ett plus betyder senare, ett minus betyder tidigare. En uppgift som inte finns i baslinjen visar ett streck (—) i de kolumnerna.

## Fallgropar och vad appen gör

**En föråldrad tidsplan.** Om tidsplanen är föråldrad visar fönstret *Tidsplanen är föråldrad. Beräkna om först (F5)*. Det är en varning, men du kan fortfarande spara. Då sparar du dock de gamla datumen. Stäng fönstret, tryck på **Beräkna** och spara först därefter.

**En baslinje med framdrift.** Sparar du en baslinje efter att du har fört in framdrift, sparas läget med de verkliga datumen. Avvikelsen blir då noll och säger inget om utförandet längre. Spara baslinjen innan arbetet börjar.

**En baslinje kan inte uppdateras.** Vill du revidera överenskommelsen sparar du en ny baslinje. Ta bort den gamla om det behövs.

**Bara uppgifter utan underuppgifter.** En fas finns inte i baslinjen: den har ingen baslinjebalk och ingen avvikelse. Fasen följer av uppgifterna under den.

**Nya och borttagna uppgifter.** En uppgift som du lägger till efter att du har sparat har ingen baslinjebalk. I avvikelserapporten visas den som *Ny*. En uppgift som du tar bort visas som *Bortfallen*.

**Flytta projekt.** I fönstret *Flytta projekt…* finns, så snart det finns baslinjer, kryssrutan *Flytta baslinjer också*. Den är avmarkerad som standard: baslinjerna står kvar på sin plats, så förflyttningen syns som avvikelse. Se [Flytta ett projekt](docs://howto-project-verplaatsen).

**Sparas i projektfilen.** Baslinjer och valet av aktiv baslinje sparas med projektet och finns kvar när du öppnar filen.

## Se även

- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): vad en baslinje sparar och hur avvikelsen beräknas.
- [Flytta ett projekt](docs://howto-project-verplaatsen): kryssrutan *Flytta baslinjer också*.
- [Uppdatera framdrift](docs://howto-voortgang-bijwerken): att föra in det verkliga läget som du jämför med baslinjen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): en baslinje (*Baseline at start*) före starten, med framdrift och ett rapportdatum den 20 maj 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): två baslinjer, *Contract* och *Re-baseline (variation order)*, med framdrift och ett rapportdatum den 5 juli 2027.
