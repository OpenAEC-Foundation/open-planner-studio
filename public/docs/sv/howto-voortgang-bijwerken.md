# Uppdatera framdrift

Mål: lägg in det verkliga läget för arbetet i tidsplanen och beräkna om tidsplanen: vilka uppgifter som är klara, vilka som pågår och hur mycket som ännu återstår.

## När du behöver det

Du uppdaterar framdriften vid fasta tidpunkter, till exempel varje fredag när platschefen rapporterar läget. På så sätt ser tidsplanen vad som verkligen har hänt och beräknar det återstående arbetet från rapportdatumet. Varför appen gör det så förklaras i [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).

## Steg

### 1. Ange rapportdatumet

Rapportdatumet är dagen då du gör en lägesbedömning. Ange det innan du anger framdriften.

1. Gå till *Tidsplan › Baslinjer & framdrift › Rapportdatum*.
2. Skriv datumet i de tre rutorna för dag, månad och år (i den ordning som din datumnotation använder), till exempel 28, 06 och 2027, och tryck på Enter. Appen hoppar själv till nästa ruta.
3. Med det lilla krysset bredvid fältet tömmer du rapportdatumet igen.

Om du gör lägesbedömningen på fredag efter arbetstid anger du rapportdatumet till nästa arbetsdag, måndag. Appen planerar det återstående arbetet från början av rapportdatumet.

Om du anger framdrift när det ännu inte finns något rapportdatum sätter appen det till idag och visar: *Det fanns inget rapportdatum ännu. Det är nu satt till idag (…), eftersom framdrift mäts fram till rapportdatumet. Du kan ändra det under Tidsplan → Rapportdatum.* Gör därför hellre det själv först.

### 2. Ange framdriften

Välj det sätt som passar din situation. De ger samma resultat.

**En uppgift i egenskapspanelen.** Användbart när du uppdaterar en enda uppgift.

1. Klicka på uppgiften. Om du inte ser panelen *Egenskaper* aktiverar du den med *Visa › Paneler › Egenskaper*.
2. Dra reglaget *Framdrift (%)* till den procentandel som är klar.
3. Fyll vid behov i *Verklig start* och *Verkligt slut* på samma sätt som för rapportdatumet. Appen räknar ut fältet *Återstående* själv. Du kan inte ändra det här.

En milstolpe har ett fält, *Verkligt datum*.

**Välja en procentsats i menyn.** Användbart för en snabb lägesbild.

1. Högerklicka på balken i Gantt.
2. Välj *Framdrift* och välj sedan 0 %, 25 %, 50 %, 75 % eller 100 %.

**Flera uppgifter i tabellen.** Användbart när du uppdaterar en hel lista.

1. Klicka på **+** till höger om uppgiftstabellens rubrik (*Lägga till kolumn*) och öppna kategorin *Framdrift*. Lägg till kolumnerna *Verklig start*, *Verkligt slut*, *Återstående* och *Status*. Kolumnen *Framdrift* finns redan på fliken *Tabell*.
2. Dubbelklicka på en cell, skriv värdet och tryck på Enter. Du skriver en procentsats som `50` eller `50%`, ett datum som `25-06-2027` och en återstående varaktighet som `1`.
3. För *Status* dubbelklickar du, trycker på Enter och väljer *Inte startad*, *Pågår* eller *Klar*.

Om du skriver en återstående varaktighet räknar appen tillbaka till procenten: för en uppgift på 2 arbetsdagar ger en rest på 1 en procentsats på 50. En rest på 0 gör uppgiften klar. Om du väljer *Inte startad* vid *Status* blir procenten 0 och de verkliga datumen försvinner.

**Allt för en uppgift i fönstret Redigera uppgift.** Högerklicka på uppgiften och välj *Redigera...*. Framdriftsfälten finns där också. De gäller först när du klickar på *Spara*.

**Många uppgifter samtidigt från ett kalkylblad.** Se [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren).

### 3. Beräkna om tidsplanen

Varje ändring av framdrift eller rapportdatum gör tidsplanen inaktuell. Statusfältet visar *Inaktuell — beräkna om (F5)*. Tryck på **Beräkna** (F5), till exempel via *Tidsplan › Tidsplan › Beräkna*. Om *Beräkna automatiskt* är på (under *Inställningar › Projekt › Inställningar*, flik *Tidsplan*), gör appen det själv.

## Kontrollera resultatet

- På rapportdatumet visar Gantt en streckad linje med datumet i rubriken. Vid uppgifter som pågår buktar linjen ut till procentsatsen i balken. Du slår på eller av dessa med *Visa › Baslinjer & framdrift › Framdriftslinje* och *Rapportdatumlinje*.
- Klara uppgifter är aldrig röda: med ett rapportdatum är en klar uppgift inte kritisk.
- Faser visar en härledd procentsats och tidsplanens slut kan ha flyttats.
- Om du har sparat en baslinje visas den ursprungliga tidsplanen under varje balk. Rapporttypen *Avvikelse* visar avvikelsen.

## Fallgropar och vad appen gör

**Ett datum efter rapportdatumet.** Appen accepterar inte en verklig start eller ett verkligt slut efter rapportdatumet. I panelen står under fälten *Verkliga värden kan inte ligga efter rapportdatumet*. I tabellen visar cellen *Det verkliga datumet ligger efter rapportdatumet.* Ange först ett senare rapportdatum eller rätta datumet.

**En uppgift som först skulle starta efter rapportdatumet.** Om du anger framdrift för en uppgift som enligt tidsplanen ännu inte skulle ha startat öppnas fönstret *Ange den verkliga starten*. Det frågar när uppgiften verkligen startade. Förslaget är rapportdatumet. Med *Tillämpa framdrift* sparar du det. Med *Avbryt* ändras ingenting.

**100 % utan datum.** Om du sätter en uppgift till 100 % utan verkligt slut blir det verkliga slutet rapportdatumet, även om uppgiften blev klar tidigare. Fyll sedan i det verkliga slutet själv.

**En procentsats under 100 %.** Om du sätter en klar uppgift tillbaka under 100 % tas det verkliga slutet bort. Om du rensar enbart det verkliga slutet blir procentsatsen 0 och uppgiften förblir *Pågår*. Om du vill att uppgiften ska räknas som inte startad igen rensar du också den verkliga starten, eller väljer *Inte startad* vid *Status* i tabellen.

**Att ändra varaktigheten för en uppgift som pågår.** Det utförda arbetet står kvar och procentsatsen justeras. En uppgift på 5 arbetsdagar med 60 % som du sätter till 10 arbetsdagar hamnar på 30 %. Appen accepterar inte en varaktighet som är kortare än arbetet som redan är gjort: *'Build inner cavity leaf' är redan 60 % klar. En varaktighet kortare än det redan utförda arbetet är inte möjlig. Varaktigheten har inte ändrats.* I tabellen visar cellen *Den här varaktigheten är kortare än arbetet som redan är gjort.*

**Den återstående varaktigheten avrundas.** Appen avrundar den återstående varaktigheten till hela arbetsdagar. För en uppgift på 2 arbetsdagar ger både 50 % och 75 % en rest på 1 arbetsdag.

**En fas.** En fas har ingen egen framdrift. I panelen står *Härleds från underuppgifterna: ändra framdriften där. Sammanfattningsuppgiften uppdateras när du har beräknat (F5).* I tabellen visar cellen *Framdriften för en sammanfattningsuppgift härleds från underuppgifterna och kan inte ändras här.*

**Rapportdatumet flyttas senare.** Det återstående arbetet för uppgifter som pågår börjar på det nya rapportdatumet. Arbete som ännu inte har startat kan inte ligga före det datumet. Flytta det därför bara samtidigt med en uppdatering av framdriften. Om du anger ett rapportdatum utan att också ange framdrift flyttas allt arbete som ännu inte har startat till det datumet (utom i profilen Microsoft Project).

**Ett misstag.** Varje ändring av framdrift är ett steg för Ctrl+Z.

## Se även

- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): hur appen räknar ut det återstående arbetet och rapportdatumet, med ett genomräknat exempel.
- [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren): läsa in framdrift för många uppgifter samtidigt.
- [Välja framdriftsläge](docs://howto-voortgangsmodus-kiezen): vad appen gör med en uppgift som har startat medan den föregående uppgiften fortfarande pågår.
- [Spara och hantera en baslinje](docs://howto-baseline-opslaan-en-beheren): spara den ursprungliga tidsplanen för att jämföra framdriften med.
