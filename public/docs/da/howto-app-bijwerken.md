# Opdatering af appen

Mål: find ud af, om du har den nyeste version, opdater appen, og læs hvad der er nyt i en version.

## Hvornår du har brug for det

En ny version af Open Planner Studio kommer regelmæssigt. Du vil gerne vide, om du allerede har den, for eksempel før du melder en fejl, eller fordi en udvidelse kræver en nyere version. Eller du har lige opdateret og vil se, hvad der er ændret.

Opdatering virker kun i desktopappen. Browserversionen har ingen opdateringsfunktion.

## Trin

### Opdater når appen selv siger, at der er en ny version

1. Start desktopappen. Ved opstart kontrollerer appen i baggrunden, om der er en ny version. Hvis der ikke er en ny version, eller kontrollen mislykkes, for eksempel uden internet, mærker du ikke noget.
2. Hvis der er en ny version, åbner vinduet *Softwareopdatering*. Det viser *Aktuel version*, *Ny version*, meddelelsen *Der er en ny version tilgængelig* og under *Hvad er nyt* den tekst, der hører til opdateringen.
3. Gem dine åbne projekter.
4. Klik på *Download og installer*. En fremskridtsindikator viser *Downloader…*, og derefter følger installationen. Du kan ikke lukke vinduet, mens det downloader.
5. Vent, til appen genstarter sig selv. Så har du den nye version.

Lige før opdateringen installeres, tager appen også en automatisk sikkerhedskopi af det, du har åbent, til genoprettelse efter nedbrud, se [genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash).

### Søg selv efter en ny version

1. Vælg *Indstillinger › Projekt › App-indstillinger*. Du kan også vælge *Fil › App-indstillinger*, eller tandhjulet øverst.
2. Vælg fanen *Avanceret*. Under *Version* står nummeret på din aktuelle version.
3. Klik på *Søg efter opdateringer*. Vinduet *Softwareopdatering* åbner, og der står *Søger…*. Bagefter står der enten *Du bruger den nyeste version* eller meddelelsen om, at der er en ny version, med den samme knap *Download og installer*.

I browseren gør denne knap ikke noget særligt: vinduet siger med det samme *Du bruger den nyeste version*, uden at appen kontrollerer noget.

### Læs hvad der er nyt

1. Hvis du starter desktopappen første gang i en anden version end sidst, åbner et vindue af sig selv. Vinduets titel er *Du er opdateret!* Efter en ny installation åbnes det ikke: første start er ikke en opdatering. Vil du alligevel se det, bruger du knappen *Hvad er nyt* (se nedenfor).
2. Øverst står overgangen fra den forrige til den nye version. Med knappen *Hvad er nyt* vises kun den nye version.
3. Har appen en indbygget opsummering for denne version, ser du ét hovedpunkt og fire mindre punkter. Hovedpunktet kan have knappen *Læs guiden*. Ellers ser du kun overgangen mellem versionerne og det, der står nedenfor.
4. Med *Se alle udgivelsesnoter* åbner du ændringslisten på GitHub. Virker det ikke, står der *Udgivelsesnoterne kunne ikke åbnes.*
5. Under *Denne opdatering i tal* står antallet af dage siden den forrige udgivelse, antallet af commits og antallet af tilføjede kodelinjer. Kan appen se forskellen i størrelse på installationspakken, vises den også. Hvert tal vises kun, hvis det er tilgængeligt.
6. Klik på *Forstået* for at lukke vinduet.

Vil du se dette vindue igen senere, vælg *Indstillinger › Projekt › App-indstillinger*, fanen *Avanceret*, og klik under *Version* på knappen *Hvad er nyt*. Vinduet viser så din aktuelle version, uden en forrige version.

## Faldgruber, og hvad appen gør så

**Opdateringen mislykkes.** Vinduet viser *Noget gik galt under opdateringen* med den tekniske årsag nedenfor, og knappen *Prøv igen*.

**Du har installeret appen som .deb-pakke, og installationen mislykkes.** Vinduet forklarer: *Opdater manuelt ved at køre denne kommando i en terminal, eller download den nyeste pakke.* Under *Installationskommando* står kommandoen, med knappen *Kopiér kommando* (bagefter står der *Kopieret*). Med *Åbn downloadside* går du til downloadsiden for den nyeste version.

**Du har appen via Snap Store.** Appen opdaterer sig ikke selv, og den kontrollerer heller ikke ved opstart. Det gør Snap Store. I vinduet står der: *Denne version opdateres automatisk via Snap Store. Du behøver ikke gøre noget.*

**Der vises ikke noget ved opstart.** Det er normalt, hvis du allerede har den nyeste version. Kontrollen ved opstart melder ikke fejl. Vil du være sikker på, at du er opdateret, så kontrollér selv, som beskrevet ovenfor.

## Se også

- [Giv feedback](docs://howto-feedback-geven): meld en fejl i den nyeste version.
