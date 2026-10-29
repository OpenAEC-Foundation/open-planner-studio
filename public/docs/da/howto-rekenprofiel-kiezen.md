# Valg eller opbygning af en beregningsprofil

Formål: bestem hvilke beregningsregler et projekt bruger. Du vælger en indbygget profil, eller du laver en egen profil med dine egne konventioner.

## Hvornår har du brug for dette

Du åbner et projekt, der skal beregnes som Primavera P6 eller Microsoft Project, eller du vil indstille én konvention anderledes end profilen gør. Hvad en profil er, og hvorfor datoerne kan forskydes, står i [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen).

## Trin

### Valg af profil for et nyt projekt

1. Vælg *Start › Fil › Ny*. Vinduet *Opret nyt projekt* åbner sig.
2. I rullelisten *Beregningsprofil* vælger du profilen: *Open Planner Studio*, *Primavera P6* eller *Microsoft Project*.
3. Opret projektet. Appen erstatter de beregningsindstillinger, du allerede har udfyldt, med standardværdierne for profilen.

### Skift af profil for et eksisterende projekt

1. Vælg *Indstillinger › Projekt › Projektindstillinger*. Du kan også vælge *Fil › Projektindstillinger*.
2. I blokken *Beregningsprofil og beregningsindstillinger* åbner du rullelisten *Beregningsprofil* og vælger en anden profil.
3. Klik på **Anvend**. Appen genberegner tidsplanen med det samme, selv om *Beregn automatisk* er slået fra. Er opgaver forskudt, viser appen hvor mange.

Indtil du klikker på *Anvend*, findes ændringen kun i formularen. Hele skiftet er ét trin for *Fortryd*. Skiftet ændrer kun konventionerne. Dine beregningsindstillinger bliver, som de er.

### Opbygning af en egen profil

1. I blokken *Beregningsprofil og beregningsindstillinger* klikker du på *Ny profil*, ved siden af rullelisten.
2. Indtast et navn. Appen foreslår *Kopi af* den valgte profil, for eksempel *Kopi af Open Planner Studio*.
3. Klik på *Opret*. Afsnittet *Konventioner i denne profil* udvides.
4. Slå konventionerne til eller fra med afkrydsningsfelterne. Det lille i-ikon efter en linje viser forklaringen på konventionen. En konvention, der afviger fra basis, får etiketten *Gendan basis*.
5. Klik på **Anvend**. Først derefter beregner projektet med den nye profil.

De tre indbyggede profiler kan ikke ændres. Deres konventioner vises kun til information.

### Gem en egen profil som skabelon

1. Giv om nødvendigt den egne profil et andet navn i feltet *Navn på denne egen profil*.
2. Klik på *Gem som skabelon*. Appen melder, at skabelonen er gemt, eller hvorfor det mislykkedes.
3. I et andet projekt i samme app står skabelonen i rullelisten *Beregningsprofil*.

Hvis profilen senere afviger fra skabelonen, viser en gul blok det. Vælg så *Opdater skabelon fra dette projekt* eller *Opdater fra skabelon*.

Du sletter en skabelon med *Slet skabelon*. Appen beder først om bekræftelse.

## Kontrol af resultatet

- Blokken *Beregningsprofil og beregningsindstillinger* viser den valgte profil.
- Efter *Anvend* melder appen, hvor mange opgaver der er forskudt, for eksempel *Efter anvendelsen er 4 opgaver forskudt.*
- En orange blok over beregningsindstillingerne siger, at dine beregningsindstillinger afviger fra profilens standard. Det er ofte med vilje. Vil du alligevel have standarden, så klik på *Brug standardindstillingerne for …*.

## Faldgruber, og hvad appen gør

**Datoerne forskydes.** En anden profil kan reelt ændre datoerne. Kontroller resultatet. Synes du ikke om det, så vælg *Fortryd*: profil og datoer går tilbage sammen.

**En gul blok efter Fortryd.** Trykker du på *Fortryd* eller *Gentag*, mens Projektindstillinger er åben, følger blokken projektets tilstand. Har du selv allerede ændret noget i blokken, bevares dit valg. En gul blok siger så, at *Anvend* sætter det valg tilbage.

**Der kan højst være 100 skabeloner.** Er der allerede 100, gemmer appen ikke skabelonen, og den melder det. Slet først en skabelon. Er appens lagerplads fuld, eller mangler den, får du også en besked.

**Skabeloner hører til appen, profilen hører til projektet.** Projektet har altid sin egen kopi af profilen. Ændrer du skabelonen senere, ændrer projektet sig ikke med den.

**Indstillinger fra en kildefil.** Vælger du *Primavera P6* eller *Microsoft Project* for et projekt, der kommer fra en anden fil, bevares indstillingerne fra kildefilen. Du kan ikke ændre dem her.

## Se også

- [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen): hvad en profil er, og hvad den gør ved datoerne.
- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): alle konventioner og beregningsindstillinger i ét overblik.
- [Valg af fremdriftsmetode](docs://howto-voortgangsmodus-kiezen): Retained Logic eller Progress Override, adskilt fra profilen.
