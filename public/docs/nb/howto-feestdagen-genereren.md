# Helligdager og byggferie genereren

Mål: få helligdagene for et land, og eventuelt byggferien, lagt inn i en kalender. Legg til en egen fridag eller fridperiode der det trengs.

## Når du trenger dette

Uten helligdager planlegger appen arbeid på jul eller Kongedagen. Et nytt prosjekt får de nederlandske helligdagene automatisk, så lenge *Byggmodus* er på. Du genererer på nytt hvis du trenger et annet land eller en annen region, hvis du vil ta med byggferien, eller hvis prosjektet ligger utenfor årene helligdagene er laget for. Disse årene er viktige: for appen er en dag utenfor dem ganske enkelt en arbeidsdag. Hvordan appen tar hensyn til en helligdag når den teller, kan du lese i [Kalendere og arbeidsdager](docs://uitleg-kalenders).

**Byggferien** (*bouwvak*) er den felles ferien i den nederlandske byggebransjen, tre uker om sommeren. I appen er den som standard av.

## Trinn

### Generere helligdager

1. Velg *Tidsplan › Kalender › Kalender* og velg til venstre kalenderen helligdagene skal inn i.
2. Klikk på *Generer helligdager…*. Under knappen åpnes et felt med valgene.
3. Velg *Land*: Nederland, Tyskland, Belgia, Frankrike, Storbritannia, Østerrike, Sveits eller *Ingen helligdager*. For en del land vises også en liste med *Region*, for eksempel en delstat i Tyskland. *Nasjonalt* beholder bare helligdagene som gjelder overalt.
4. For Nederland velg *Byggferie*: *Ingen* (standard), *Nord*, *Midt* eller *Sør*. Byggferien vises som én fridperiode i listen, for eksempel *Byggferie (Nord)*, tre uker fra mandag til fredag. Du ser dette valget bare hvis *Byggmodus* er på.
5. Under valgene står en oppsummering, for eksempel *21 helligdager, 2026–2028*. Klikk på det for å se datoene.
6. Klikk på *Generer*. Listen *Helligdager* er nå fylt.
7. Klikk på *Bruk*. Appen omberegner tidsplanen med en gang.

For Nederland legger appen Nyttårsdag, Langfredag, Påske (to dager), Kongedagen, Kristi himmelfartsdag, Pinse (to dager) og Første og andre juledag (25. og 26. desember) inn i listen hvert år. Hvis Kongedagen faller på en søndag, er den 26. april. Frigjøringsdagen står bare i listen i femårsår, for eksempel 2025 og 2030.

Årene følger prosjektperioden: fra året før startdatoen til året etter sluttdatoen. Har prosjektet ingen sluttdato, gjelder opptil tre år etter startåret. Du justerer start og slutt under *Innstillinger › Prosjekt › Prosjektinnstillinger*.

### Generere på nytt etter en ny prosjektperiode

Hvis prosjektet forskyves, eller får en senere sluttdato, dekker ikke helligdagene de nye årene lenger. Appen sier det i vinduet *Kalendere*, for eksempel *Helligdagene dekker 2025–2028; vil du generere på nytt til og med 2030?* Klikk da på *Generer på nytt*. Appen bruker de samme valgene som sist (land, region, byggferie) for årene i prosjektet. Klikk så på *Bruk*. Du ser denne meldingen bare for en kalender der helligdagene ble generert tidligere.

### Legge til en egen fridag eller fridperiode

1. I vinduet *Kalendere* klikk på *Legg til helligdag*. Nederst i listen vises en ny rad med dagens dato under *Fra*.
2. Fyll inn *Beskrivelse*, for eksempel *Bedriftsutflukt*.
3. Juster *Fra*. La *Til* stå tomt for én dag, eller fyll inn den siste fridagen for en fridperiode, for eksempel en vinterferie.
4. Klikk på *Bruk*.

Med søppelbøtta bak en rad fjerner du en helligdag.

### Fjerne alle helligdager

Velg *Ingen helligdager* under *Land* og klikk på *Generer*. Listen er da tom.

## Fallgruver og hva appen gjør da

**Genereren erstatter hele listen.** De dagene du selv la til, forsvinner også. Legg dem til igjen etterpå.

**Langfredag er med.** Hvis firmaet ditt jobber på Langfredag, eller på Frigjøringsdagen i et femårsår, fjern raden med søppelbøtta.

**Datoene for byggferien er veiledende datoer.** Appen kjenner dem for 2025 til og med 2028; for andre år gjør den et grovt anslag. Når du har valgt en byggferie, står det derfor *Veiledende datoer — kontroller hos Bouwend Nederland*. Juster perioden i listen ved behov.

**En ugyldig rad.** En rad uten gyldig *Fra*, en *Til* som ligger før *Fra*, eller en ulesbar dato, får en rød melding, for eksempel *Sluttdatoen ligger før startdatoen.* *Bruk* er deaktivert til du retter feilen.

**Med et nytt prosjekt.** Vinduet *Nytt prosjekt* har de samme valgene under *Helligdagssett*. Med *Egendefinert…* starter du uten helligdager. Etter at du har opprettet prosjektet, åpnes vinduet *Kalendere*, så du kan fylle dem inn selv.

## Se også

- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvordan appen tar hensyn til helligdager og byggferie når den teller arbeidsdager.
- [Lage og tilordne en kalender](docs://howto-kalender-maken-en-toewijzen): lage en egen kalender å legge helligdager i.
- [Kalendervinduer](docs://ref-kalenders): alle felt i kalendervinduene.
- [Nytt prosjekt og Prosjektinnstillinger](docs://ref-projectinfo): helligdagssettet for et nytt prosjekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): i tillegg til helligdagene har prosjektkalenderen en fridperiode *Frost delay, foundations*.
