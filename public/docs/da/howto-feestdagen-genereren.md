# Generering af helligdage og byggeferie

Mål: få helligdagene for et land, og eventuelt byggeferien, udfyldt i en kalender, og tilføj selv en dag eller periode fri, hvor det er nødvendigt.

## Hvornår du har brug for dette

Uden helligdage regner appen simpelthen med arbejde på juledag eller Koningsdag. Et nyt projekt får allerede de hollandske helligdage, så længe *Byggetilstand* er slået til. Du genererer igen, hvis du har brug for et andet land eller en anden region, hvis du vil medtage byggeferien, eller hvis dit projekt ligger uden for de år, som helligdagene er oprettet for. Årene har betydning: for appen er en dag uden for dem blot en arbejdsdag. Hvordan appen tager en helligdag med i tællingen, kan du læse i [Kalendere og arbejdsdage](docs://uitleg-kalenders).

**Byggeferien** (*bouwvak*) er den fælles sommerpause i den hollandske byggebranche, tre uger om sommeren. I appen er den som standard slået fra.

## Trin

### Generering af helligdage

1. Vælg *Tidsplan › Kalender › Kalender*, og vælg til venstre den kalender, helligdagene skal indgå i.
2. Klik på *Generer helligdage…*. Under knappen åbnes et felt med valgmulighederne.
3. Vælg *Land*: Nederlandene, Tyskland, Belgien, Frankrig, Storbritannien, Østrig, Schweiz eller *Ingen helligdage*. For en række lande vises også feltet *Region*, for eksempel en delstat i Tyskland. *Landsdækkende* beholder kun de helligdage, der gælder overalt.
4. For Nederlandene vælger du *Byggeferie*: *Ingen* (standard), *Nord*, *Midt* eller *Syd*. Byggeferien vises som én periode på listen, for eksempel *Bouwvak (Noord)*, tre uger fra mandag til fredag. Du ser kun dette valg, hvis *Byggetilstand* er slået til.
5. Under valgene står en opsummering, for eksempel *21 helligdage, 2026–2028*. Klik på den for at se datoerne.
6. Klik på *Generér*. Listen *Helligdage* er nu udfyldt.
7. Klik på *Anvend*. Appen genberegner tidsplanen med det samme.

For Nederlandene lægger appen hvert år Nieuwjaar, Goede Vrijdag, Pasen (to dage), Koningsdag, Hemelvaart, Pinksteren (to dage) og Kerst (25. og 26. december) på listen (nytårsdag, langfredag, påskedag, kongedag, Kristi himmelfartsdag, pinse og jul). Hvis Koningsdag falder på en søndag, er den 26. april. Bevrijdingsdag (befrielsesdag) står kun på listen i femårsår, for eksempel 2025 og 2030.

Årene følger projektperioden: fra året før startdatoen til året efter slutdatoen. Har projektet ingen slutdato, går det op til tre år efter startåret. Du justerer start og slut under *Indstillinger › Projekt › Projektindstillinger*.

### Generering igen efter en ny projektperiode

Hvis dit projekt forskydes, eller får en senere slutdato, dækker helligdagene ikke længere de nye år. Appen siger det i vinduet *Kalendere*, for eksempel *Helligdage dækker 2025–2028; generér igen til og med 2030?* Klik derefter på *Generér igen*. Appen bruger de samme valg som sidst (land, region, byggeferie) for projektets år. Klik derefter på *Anvend*. Du ser kun denne besked for en kalender, hvis helligdage tidligere er genereret.

### Tilføj selv en dag eller periode fri

1. Klik på *Tilføj helligdag* i vinduet *Kalendere*. Nederst på listen vises en ny række med dagens dato under *Fra*.
2. Udfyld *Beskrivelse*, for eksempel *Firmaudflugt*.
3. Justér *Fra*. Lad *Til* være tom for én dag, eller udfyld den sidste fridag for en periode, for eksempel en vinterlukning.
4. Klik på *Anvend*.

Med skraldespanden bagved en række fjerner du en helligdag.

### Fjern alle helligdage

Vælg *Ingen helligdage* under *Land*, og klik på *Generér*. Listen er så tom.

## Faldgruber, og hvad appen gør da

**Generering erstatter hele listen.** De dage, du selv har tilføjet, forsvinder også. Tilføj dem igen bagefter.

**Goede Vrijdag er med.** Hvis din virksomhed arbejder på langfredag, eller på Bevrijdingsdag i et femårsår, fjerner du rækken med skraldespanden.

**Datoerne for byggeferien er vejledende.** Appen kender dem for 2025 til og med 2028. For andre år laver den et groft skøn. Når du har valgt en byggeferie, står der derfor *Vejledende datoer — tjek hos Bouwend Nederland*. Justér perioden på listen, hvis det er nødvendigt.

**En ugyldig række.** En række uden en gyldig *Fra*, en *Til* der ligger før *Fra*, eller en ulæselig dato får en rød besked, for eksempel *Slutdatoen ligger før startdatoen*. *Anvend* er deaktiveret, indtil du retter det.

**Med et nyt projekt.** Vinduet *Opret nyt projekt* har de samme valg under *Helligdagssæt*. Med *Brugerdefineret…* starter du uden helligdage. Når du har oprettet projektet, åbnes vinduet *Kalendere*, så du selv kan udfylde dem.

## Se også

- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvordan appen tager helligdage og byggeferie med i tællingen af arbejdsdage.
- [Oprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen): at lave en egen kalender, som helligdagene kan lægges i.
- [Kalendervinduerne](docs://ref-kalenders): alle felter i kalendervinduerne.
- [Nyt projekt og Projektindstillinger](docs://ref-projectinfo): helligdagssættet for et nyt projekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): ud over helligdagene har projektkalenderen en periode fri *Frost delay, foundations*.
