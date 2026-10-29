# Velge eller bygge en beregningsprofil

Mål: bestem hvilke beregningsregler et prosjekt bruker. Du velger en innebygd beregningsprofil, eller du lager en egendefinert beregningsprofil med dine egne beregningsregler.

## Når du trenger dette

Du åpner et prosjekt som må beregnes som Primavera P6 eller Microsoft Project, eller du vil sette én beregningsregel annerledes enn profilen gjør. Hva en beregningsprofil er, og hvorfor datoene kan forskyves, står i [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen).

## Steg

### Velge en profil for et nytt prosjekt

1. Velg *Hjem › Fil › Ny*. Vinduet *Opprett nytt prosjekt* åpnes.
2. I rullegardinlisten *Beregningsprofil* velger du profilen: *Open Planner Studio*, *Primavera P6* eller *Microsoft Project*.
3. Opprett prosjektet. Appen erstatter beregningsalternativene du allerede hadde fylt inn, med standardverdiene for profilen.

### Bytte beregningsprofil for et eksisterende prosjekt

1. Velg *Innstillinger › Prosjekt › Prosjektinnstillinger*. Du kan også velge *Fil › Prosjektinnstillinger*.
2. I blokken *Beregningsprofil og beregningsalternativer* åpner du rullegardinlisten *Beregningsprofil* og velger en annen profil.
3. Klikk **Bruk**. Appen omberegner tidsplanen med én gang, selv om *Beregne automatisk* er av. Hvis aktiviteter er forskjøvet, viser appen hvor mange.

Til du klikker *Bruk*, finnes endringen bare i skjemaet. Hele byttet er ett trinn for *Angre*. Å bytte profil endrer bare beregningsreglene. Beregningsalternativene dine forblir som de er.

### Bygge en egendefinert beregningsprofil

1. I blokken *Beregningsprofil og beregningsalternativer* klikker du *Ny profil*, ved siden av rullegardinlisten.
2. Skriv et navn. Appen foreslår *Kopi av* den valgte profilen, for eksempel *Kopi av Open Planner Studio*.
3. Klikk *Opprett*. Delen *Beregningsregler i denne profilen* utvides.
4. Slå beregningsreglene på eller av med avkrysningsboksene. I-ikonet etter en linje viser forklaringen av den beregningsregelen. En beregningsregel som avviker fra grunnlaget, får etiketten *Tilbakestill til grunnlag*.
5. Klikk **Bruk**. Først da beregner prosjektet med den nye beregningsprofilen.

De tre innebygde beregningsprofilene kan ikke endres. Beregningsreglene vises bare til informasjon.

### Beholde en egendefinert beregningsprofil som mal

1. Gi om nødvendig den egendefinerte profilen et annet navn i feltet *Navn på denne egendefinerte profilen*.
2. Klikk *Lagre som mal*. Appen melder at malen er lagret, eller hvorfor det mislyktes.
3. I et annet prosjekt i samme app står malen i rullegardinlisten *Beregningsprofil*.

Hvis profilen senere avviker fra malen, viser en gul blokk det. Velg da *Oppdater mal fra dette prosjektet* eller *Oppdater fra mal*.

Du sletter en mal med *Slett mal*. Appen ber om bekreftelse først.

## Kontrollere resultatet

- Blokken *Beregningsprofil og beregningsalternativer* viser den valgte profilen.
- Etter *Bruk* melder appen hvor mange aktiviteter som er forskjøvet, for eksempel *Etter bruk er 4 aktiviteter forskjøvet.*
- En oransje blokk over beregningsalternativene sier at beregningsalternativene dine avviker fra standardverdiene for profilen. Det er ofte med vilje. Vil du likevel ha standardverdiene, klikker du *Bruk standardinnstillingene til …*.

## Fallgruver og hva appen gjør

**Datoene forskyves.** En annen beregningsprofil kan endre selve datoene. Kontroller resultatet. Vil du ikke ha det, velger du *Angre*: profil og datoer går tilbake sammen.

**En gul blokk etter Angre.** Trykker du *Angre* eller *Gjør om* mens Prosjektinnstillinger er åpent, følger blokken tilstanden i prosjektet. Har du allerede endret noe i blokken selv, blir valget ditt stående. En gul blokk sier da at *Bruk* setter det valget tilbake.

**Det kan være maksimalt 100 maler.** Er det allerede 100, lagrer appen ikke malen, og den melder det. Slett først en mal. Er lagringen i appen full eller mangler den, får du også en melding.

**Maler hører til appen, profilen til prosjektet.** Prosjektet har alltid sin egen kopi av beregningsprofilen. Endrer du malen senere, endrer prosjektet seg ikke med den.

**Innstillinger fra en kildefil.** Velger du *Primavera P6* eller *Microsoft Project* for et prosjekt som kommer fra en annen fil, blir innstillingene fra kildefilen stående. Du kan ikke endre dem her.

## Se også

- [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen): hva en beregningsprofil er og hva den gjør med datoene.
- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): alle beregningsregler og beregningsalternativer på ett sted.
- [Velge fremdriftsmodus](docs://howto-voortgangsmodus-kiezen): Retained Logic eller Progress Override, adskilt fra beregningsprofilen.
