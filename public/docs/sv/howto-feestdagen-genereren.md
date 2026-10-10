# Generera helgdagar och byggsemester

Mål: få in ett lands helgdagar, och eventuellt byggsemestern, i en kalender. Lägg till en egen ledig dag eller period där det behövs.

## När du behöver det

Utan helgdagar planerar appen arbete på juldagen eller Kungens dag. Ett nytt projekt får redan de nederländska helgdagarna, så länge *Byggläge* är på. Du genererar igen om du behöver ett annat land eller en annan region. Gör det också om du vill ta med byggsemestern. Gör det även om ditt projekt ligger utanför de år som helgdagarna skapades för. De åren spelar roll: för appen är en dag utanför dem helt enkelt en arbetsdag. Hur appen tar hänsyn till en helgdag när den räknar kan du läsa i [Kalendrar och arbetsdagar](docs://uitleg-kalenders).

**Byggsemestern** är den gemensamma ledigheten i den nederländska byggbranschen, tre veckor på sommaren. I appen är den avstängd som standard.

## Steg

### Generera helgdagar

1. Välj *Tidsplan › Kalender › Kalender* och välj till vänster den kalender som helgdagarna ska gå in i.
2. Klicka på *Generera helgdagar…*. Under knappen öppnas en panel med valen.
3. Välj *Land*: Nederländerna, Tyskland, Belgien, Frankrike, Storbritannien, Österrike, Schweiz eller *Inga helgdagar*. För ett antal länder visas också listan *Region*, till exempel en delstat i Tyskland. *Nationellt* lämnar bara kvar de helgdagar som gäller överallt.
4. För Nederländerna väljer du *Byggsemester*: *Ingen* (standard), *Norra*, *Mellersta* eller *Södra*. Byggsemestern visas som en ledighet i listan, till exempel *Byggsemester (Norra)*, tre veckor från måndag till fredag. Du ser det här valet bara om *Byggläge* är på.
5. Under valen står en sammanfattning, till exempel *21 helgdagar, 2026–2028*. Klicka på den för att se datumen.
6. Klicka på *Generera*. Listan *Helgdagar* är nu fylld.
7. Klicka på *Tillämpa*. Appen beräknar om tidsplanen direkt.

För Nederländerna lägger appen varje år in följande i listan: Nyårsdagen, Långfredagen, Påsk (två dagar), Kungens dag, Kristi himmelsfärd, Pingst (två dagar) och juldagen och annandag jul (25 och 26 december). Om Kungens dag infaller på en söndag ligger den 26 april. Befrielsedagen finns bara med i listan vart femte år, till exempel 2025 och 2030.

Åren följer projektperioden: från året före startdatumet till året efter slutdatumet. Saknar projektet ett slutdatum gäller i stället upp till tre år efter startåret. Du ändrar start och slut under *Inställningar › Projekt › Projektinfo*.

### Generera om efter en ny projektperiod

Om ditt projekt flyttas, eller får ett senare slutdatum, täcker helgdagarna inte längre de nya åren. Appen säger det i fönstret *Kalendrar*, till exempel *Helgdagar täcker 2025–2028; projektet löper till 2030. Generera om?* Klicka sedan på *Generera om*. Appen använder samma val som sist (land, region och byggsemester) för projektets år. Klicka sedan på *Tillämpa*. Du ser bara det här meddelandet för en kalender vars helgdagar genererades tidigare.

### Lägg till en egen ledig dag eller period

1. Klicka på *Lägg till helgdag* i fönstret *Kalendrar*. Längst ner i listan visas en ny rad, med dagens datum under *Från*.
2. Fyll i *Beskrivning*, till exempel *Företagsutflykt*.
3. Ändra *Från*. Lämna *Till* tomt för en enda dag, eller fyll i den sista lediga dagen för en längre ledighet, till exempel en vinterledighet.
4. Klicka på *Tillämpa*.

Med papperskorgen bakom en rad tar du bort en helgdag.

### Ta bort alla helgdagar

Välj *Inga helgdagar* under *Land* och klicka på *Generera*. Listan är då tom.

## Fallgropar och vad appen gör då

**Generering ersätter hela listan.** Dagarna som du lagt till själv försvinner också. Lägg till dem igen efteråt.

**Långfredagen ingår.** Om ditt företag arbetar på Långfredagen, eller på Befrielsedagen under ett år då den finns med i listan, tar du bort den raden med papperskorgen.

**Datumen för byggsemestern är vägledande datum.** Appen känner till dem för 2025 till och med 2028; för andra år gör den en grov uppskattning. Med en vald byggsemester visar den därför *Vägledande datum — kontrollera hos Bouwend Nederland*. Justera ledigheten i listan vid behov.

**En ogiltig rad.** En rad utan giltigt *Från*, ett *Till* som ligger före *Från* eller ett datum som inte går att läsa visas med ett rött meddelande, till exempel *Slutdatumet ligger före startdatumet.* *Tillämpa* är inaktiverad tills du har rättat den.

**Med ett nytt projekt.** Fönstret *Nytt projekt* har samma val under *Helgdagsuppsättning*. Med *Anpassad…* börjar du utan helgdagar. När du har skapat projektet öppnas fönstret *Kalendrar*, så att du kan fylla i dem själv.

## Se också

- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): hur appen tar helgdagar och byggsemestern med i räkningen av arbetsdagar.
- [Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen): skapa en egen kalender att lägga helgdagarna i.
- [Kalenderfönstren](docs://ref-kalenders): alla fält i kalenderfönstren.
- [Nytt projekt och Projektinfo](docs://ref-projectinfo): helgdagsuppsättningen för ett nytt projekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): förutom helgdagarna har projektkalendern en ledig period, *Frost delay, foundations*.
