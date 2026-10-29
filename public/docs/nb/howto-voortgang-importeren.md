# Importere fremdrift fra et regneark

Mål: Legg fremdriften som ansatte på byggeplassen fyller inn i et regneark, inn i tidsplanen i én omgang, uten at du klikker på hver aktivitet selv.

## Når du trenger dette

En underentreprenør eller byggeleder har ikke appen, men rapporterer status hver uke: hvor mange prosent som er ferdig, når arbeidet startet og når det var ferdig. Du sender et ark med aktivitetene dine. Den som rapporterer fyller inn tre kolonner og sender det tilbake. Fra dette leser appen bare tre verdier per aktivitet: fullføringsgrad, faktisk start og faktisk slutt. Resten av tidsplanen din blir ikke endret. Hva appen gjør med denne fremdriften, står i [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).

## Trinn

### 1. Sett statusdatoen og beregn

Sett statusdatoen slik som beskrevet i [Oppdatere fremdrift](docs://howto-voortgang-bijwerken). Byggelederen fyller inn faktiske datoer fram til og med den dagen. Hvis tidsplanen er utdatert, omberegner appen den før arket lages.

### 2. Lag arket

Velg *Tidsplan › Fremdrift › Eksporter fremdriftsark*. Den samme knappen finnes på fanene *Tabell* og *Rapport*. Appen lager en Excel-fil og foreslår navnet *(prosjektnavn)-fremdrift.xlsx*. I nettleseren havner filen i nedlastingene dine. Foretrekker du CSV? Velg *Fil › Eksporter › Fremdriftsark (CSV)*. Excel-arket finnes der også, som *Fremdriftsark (Excel)*.

Arket har åtte kolonner. Kolonnenavnene står på engelsk, med en kort instruksjon på språket i appen etter dem:

- `OPS Task ID`, `WBS` og `Name` er bare der for å kjenne igjen aktiviteten. La dem stå.
- `Start` og `Finish` er de planlagte datoene, til informasjon. Appen skriver dem aldri tilbake.
- `Completion (%)`, `Actual Start` og `Actual Finish` er de du fyller inn.

Excel-arket er beskyttet, uten passord: bare de tre kolonnene du fyller inn kan redigeres. Excel kontrollerer at en prosent er mellom 0 og 100, og at en faktisk dato er en dato. En fase (hovedaktivitet) er merket grå med *— hovedaktivitet: ikke fyll inn*.

### 3. La arket fylles ut

For hver aktivitet fyller byggelederen inn:

- `Completion (%)`: 0 til og med 100. Appen leser også desimaltall, med komma eller punktum (for eksempel 33,3 eller 33.3). Instruksjonen i CSV-filen ber fortsatt om hele tall: et regneark med en annen regional innstilling kan lese 8,38 som 838.
- `Actual Start` og `Actual Finish`: i Excel som dato med det regionale oppsettet ditt; i CSV-filen som dd-mm-åååå eller som åååå-mm-dd.

Det som står tomt, endrer ingenting. En tom celle sletter altså heller ikke eksisterende fremdrift; det kan bare gjøres i appen. For en aktivitet som ikke har startet, lar byggelederen cellene stå helt tomme.

### 4. Les inn arket

1. Velg *Tidsplan › Fremdrift › Oppdater fremdrift fra et regneark* (også på fanene *Tabell* og *Rapport*), eller *Fil › Importer › Oppdater fremdrift fra et regneark*. Vinduet *Oppdater fremdrift fra et regneark* åpnes.
2. Klikk på *Velg fil…* og velg den utfylte filen (`.xlsx` eller `.csv`).
3. Hvis datoene i en CSV-fil er tvetydige, spør appen *Dag eller måned først?*, med datoen fra filen lest på to måter. Klikk på datoen som stemmer.
4. Du ser nå en forhåndsvisning. Øverst står fire tellere: *Brukt*, *Uendret*, *Venter på kobling* og *Avvist*. Under det ser du per aktivitet hva som endres, for eksempel *Fullføringsgrad: 0% → 100%*.
5. Kontroller forhåndsvisningen og klikk *Bruk*. Vinduet viser *Resultat*, med tellerne og radene som ble avvist, og hvorfor. Avslutt med *Lukk*.

Du kan ikke hoppe over forhåndsvisningen. Knappen *Bruk* er deaktivert så lenge det ikke er noe å bruke.

### 5. Omberegn tidsplanen

Innlesing omberegner ikke tidsplanen av seg selv. Trykk **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*, med mindre *Beregne automatisk* er på.

## Rader som ikke passer uten videre

Appen kobler hver rad til en aktivitet, først på `OPS Task ID` og ellers på WBS-nummeret.

**Kobling er usikker.** Hvis appen bare fant aktiviteten via WBS-nummeret, står raden under *Kobling er usikker*, med *Bekreft* og *Endre*. Raden blir også brukt hvis du ikke gjør noe, så kontroller at aktiviteten er riktig. *Bekreft* tar raden ut av denne listen; det endrer ingenting i det som blir brukt. *Endre* lar deg velge en annen aktivitet. Med *Fjern kobling* fjerner du en kobling som du selv har laget. Merk: et ark fra et annet prosjekt med de samme WBS-nummerne blir likevel koblet, under *Kobling er usikker*, og brukt når du klikker på *Bruk*.

**Venter på kobling.** Hvis appen ikke fant noen aktivitet, eller flere med samme WBS-nummer, står raden under *Venter på kobling*. Ved *Velg en aktivitet…* velger du riktig aktivitet. Du søker etter WBS-nummer eller navn. Hvis du ikke kobler den, blir raden avvist.

## Fallgruver og hva appen gjør

En rad som ikke passer, blir avvist med en grunn. Resten av arket fortsetter bare. Dette er hovedmeldingene:

- *Den faktiske datoen er etter statusdatoen.* Sett statusdatoen senere eller korriger arket.
- *Denne aktiviteten er planlagt å starte etter statusdatoen. Fyll først inn faktisk start i arket.* Appen finner ikke på en start; legg den inn i arket.
- *Prosent utenfor 0–100. Kontroller desimaltegnet: 8,38 kan leses som 838 av et regneark med en annen landinnstilling.*
- *Hovedaktiviteter kan ikke få fremdrift fra et ark.* Fremdriften til en fase følger av aktivitetene under den.
- *Faktisk slutt er før faktisk start.*
- *Ulesbar dato.* og *Ulesbar prosent.*
- *De utfylte verdiene strider mot hverandre.* For eksempel en faktisk slutt med en fullføringsgrad under 100.
- *Fant ingen aktivitet for denne raden.* Arket nevner en aktivitets-ID og et WBS-nummer som ikke finnes i dette prosjektet.
- *Denne WBS-koden finnes på flere aktiviteter. Koble raden manuelt.*
- *En annen rad har allerede tatt denne aktiviteten.* To rader peker på samme aktivitet.
- *Avvist av planleggeren.* En annen avvisning fra selve planleggeren, uten egen melding.

Hvis hele filen blir avvist, står en av disse meldingene i vinduet: *Denne filen har ingen kolonne “OPS Task ID” eller “WBS” for å koble rader til aktiviteter.*, *Denne filen har ingen av kolonnene Fullføringsgrad, Faktisk start eller Faktisk slutt.*, *Denne filen er for stor til å leses som fremdriftsark.* (mer enn 16 MB), *Denne filen har for mange rader til å leses som fremdriftsark.* (mer enn 50 000 rader) eller *Denne filen er passordbeskyttet og kan ikke leses.* eller *Denne filen kunne ikke leses som fremdriftsark.*

**Ingen statusdato.** Hvis det ikke finnes noen statusdato ennå og importen legger inn fremdriften, setter appen den til i dag og sier fra om det. Sett den derfor selv først.

**Alt angres i ett steg.** Hele arket er ett steg for Ctrl+Z.

**Bare det du fyller inn.** En rad uten forskjell fra tidsplanen telles som *Uendret*. En aktivitet uten rad i arket blir som den var.

## Se også

- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hva appen beregner med faktiske datoer og prosenter.
- [Oppdatere fremdrift](docs://howto-voortgang-bijwerken): å legge inn fremdrift i selve appen.
