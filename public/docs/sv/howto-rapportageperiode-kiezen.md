# Välj rapportperioden

Mål: bestäm vilken period en rapport omfattar, till exempel de kommande fyra veckorna eller månaden juni.

## När du behöver det

Veckomötet vill veta vad som händer under de kommande fyra veckorna. Månadsrapporten omfattar juni. Utan en period får du hela tidsplanen på papper. Fem rapporter arbetar därför med en *Rapportperiod:*: *Look-ahead*, *Framdriftsrapport*, *Resursbelastning*, *Resurstilldelningar* och *Resursdiagram*. De andra rapporterna har ingen period.

Perioden är inte kopplad till en kalendermånad, utan till en **referensdag**: rapportdatumet för ditt projekt (dagen då du mäter framdriften, se [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang)), eller idag om projektet inte har något rapportdatum. *Nästa 4 veckor* räknar från den dagen. Om du flyttar rapportdatumet flyttar också perioden med det.

## Steg

### 1. Ange rapportdatumet

Arbetar du med ett relativt val, till exempel *Nästa 4 veckor* eller *Förra månaden*, ange rapportdatumet först. Välj *Tidsplan › Baslinjer & framdrift* och fyll i fältet *Rapportdatum*. Med krysset bredvid tar du bort datumet igen (*Töm rapportdatum*). Arbetar du med en fast period (steg 4) behöver du inte detta.

### 2. Välj en rapport med en period

Öppna fliken *Rapport* och välj en av de fem rapporterna under *Rapporttyp*. Listan *Rapportperiod:* finns under *Rapportalternativ*. För Resursdiagrammet finns den under *Inställningar*, under de fyra kryssrutorna för den rapporten.

Varje rapport kommer ihåg sin egen period. Dessa är startvärdena:

- *Look-ahead*: *Nästa månad*.
- *Framdriftsrapport*: *Förra månaden*.
- *Resursbelastning*, *Resurstilldelningar* och *Resursdiagram*: *Hela projektet*.

### 3. Välj en period i listan

Listan har *Nästa vecka*, *Nästa 2 veckor*, *Nästa 4 veckor*, *Nästa 6 veckor*, *Nästa 8 veckor*, *Nästa 12 veckor*, *Nästa månad*, samma sju bakåt (till exempel *Senaste 2 veckorna* och *Förra månaden*), *Hela projektet* och *Anpassad*. Under listan finns *Från* och *Till* med de datum som valet ger. Du kan bara läsa av dem här.

Båda dagarna räknas med. Om rapportdatumet är torsdag 20 maj, sträcker sig *Nästa vecka* från 20 till och med 26 maj och *Nästa 4 veckor* från 20 maj till och med 16 juni (28 dagar). *Nästa månad* går till en dag före samma datum i nästa månad, här till och med 19 juni. *Senaste 2 veckorna* går från 7 till och med 20 maj.

*Hela projektet* tar tidsplanen från första start till sista slut.

### 4. Eller välj Anpassad

Med *Anpassad* blir *Från* och *Till* två datumfält. De börjar med datumen från valet du just hade. Fyll i båda, till exempel 1 och 14 juni. Om inmatningen inte är korrekt, blir rapporten kvar på den senaste giltiga perioden och det står i rött:

- *Slutdatumet är före startdatumet.* om *Till* ligger tidigare än *Från*.
- *Fyll i båda datumen.* om ett av de två är tomt.

### 5. Läs perioden i rapporten

För Look-ahead, Resursbelastning och Resurstilldelningar står perioden under titeln, till exempel *Period: 20-05-2027 – 19-06-2027*. Om du väljer *Hela projektet* läggs *Hela projektet* till efter datumen. *Framdriftsrapport* visar perioden i sammanfattningen under *Period*. Resursdiagrammet låter sin tidsaxel löpa exakt över perioden.

### Vad perioden gör per rapport

Perioden fungerar inte likadant i varje rapport.

- **Look-ahead** tar med de uppgifter som inte är klara och som berör perioden, även om de sträcker sig över hela perioden. Försenade uppgifter från före referensdagen tas också med, så länge periodens slut inte ligger före referensdagen. En anpassad period helt i det förflutna är en tillbakablick: den visar bara det som pågick då och som ännu inte är klart, utan dagens eftersläpning.
- **Framdriftsrapport** använder perioden för *Slutförda under förra perioden*. Avsnittet *Startar under nästa period* blickar framåt från rapportdatumet, till datumet vid *Look-ahead t.o.m* i sammanfattningen. Väljer du en period bakåt, blickar rapporten framåt lika långt som den blickar bakåt: med *Senaste 2 veckorna* och rapportdatum 20 maj står det *Look-ahead t.o.m* 3 juni. En anpassad period eller *Hela projektet* som helt ligger i det förflutna speglas inte.
- **Resursbelastning** visar varje vecka eller månad som berör perioden, helt. Om din period går från onsdag till onsdag ser du alltså hela veckor, så att en rad alltid visar samma tal som histogrammet.
- **Resurstilldelningar** visar tilldelningarna för uppgifter som berör perioden. Med *Hela projektet* filtreras inte på datum.
- **Resursdiagram** visar bara de uppgifter som berör perioden. I sammanfattningen räknar *Utanför perioden:* hur många uppgifter som lämnats utanför.

## Fallgropar och vad appen gör

**Det finns inget rapportdatum.** Appen använder då dagens datum. För de fyra tabellrapporterna med en period (*Look-ahead*, *Framdriftsrapport*, *Resursbelastning* och *Resurstilldelningar*) står det överst, vid en relativ period: *Inget rapportdatum angivet — rapporten räknar med idag (29-09-2026).* Datumet är ditt eget datum för idag. Resursdiagrammet visar inte detta. Titta därför på *Från* och *Till*: de ligger då kring idag, inte kring din tidsplan.

**Perioden ligger utanför din tidsplan.** Då är rapporten tom. Resursdiagrammet säger det med *Inga uppgifter i rapportperioden — välj en annan period eller Hela projektet.* (i listan heter det valet *Hela projektet*). I de andra rapporterna ser du noll uppgifter eller inga rader.

**Datumen visas i din egen notation.** *Från* och *Till* följer datumnotationen från dina inställningar, utom i datumfälten för *Anpassad*: de visar notationen i din webbläsare.

**Perioden följer med.** Ett relativt val, till exempel *Nästa månad*, räknas om varje gång. Ändras rapportdatumet, eller är det inget rapportdatum och är det en dag senare, då följer perioden med direkt. Vill du ha en fast period, välj *Anpassad*.

**Valet gäller för alla dina projekt.** En anpassad period gäller också för alla dina projekt på den här enheten, inte bara för det öppna projektet.

## Se även

- [Skapa och skriva ut en rapport](docs://howto-rapport-maken-en-afdrukken): hela vägen från rapporttyp till PDF.
- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): vad rapportdatumet är och varför appen räknar med det.
- [Lösa överbeläggning](docs://howto-overbezetting-oplossen): vad du gör med veckorna med överbeläggning från Resursbelastning.
- [Rapporttyper](docs://ref-rapporttypes): alla rapporttyper och deras alternativ.
