# Oprette og tildele en kalender

Mål: Opret en egen kalender, for eksempel en seks-dages arbejdsuge, og giv den til de opgaver, der skal beregnes i den.

## Hvornår du har brug for dette

En underleverandør arbejder også om lørdagen. Et mandskab arbejder kun mandag til torsdag. En opgave ligger i et tidsrum, hvor kun den opgave står stille. Projektkalenderen har så de forkerte arbejdsdage. Med en egen kalender beregner appen de opgaver på de rigtige dage, og resten bliver på projektkalenderen. Hvad appen præcis gør med en kalender, kan du læse i [Kalendere og arbejdsdage](docs://uitleg-kalenders).

## Trin

### Oprette en kalender

1. Vælg *Tidsplan › Kalender › Kalender*. Den samme knap findes under *Indstillinger › Kalender › Kalender*. Vinduet *Kalendere* åbnes. Til venstre står projektets kalendere; projektkalenderen har en stjerne.
2. Klik under listen på knappen med plustegnet (*Opret kalender*). Den nye kalender er en kopi af standarden: mandag til fredag, 07:00 til 16:00 med en times pause og, hvis *Byggetilstand* er slået til, de nederlandske helligdage. Vil du bruge en eksisterende kalender som grundlag, så vælg den i listen og klik på knappen med de to ark under listen (*Dupliker*).
3. Giv kalenderen et navn under *Navn*, der siger, hvem der bruger den, for eksempel *Six-day week*.
4. Klik under *Arbejdsdage* på ugedagene for at slå dem til eller fra. *Man–fre* gendanner standardugen med 07:00 til 16:00. Har kalenderen tidsbånd, så slår *Man–fre* kun mandag til fredag til, og hver dag beholder sine tidsbånd. *Kontinuerlig (24/7)* slår alle syv dage til, fra 00:00 til 24:00.
5. Juster om nødvendigt arbejdstiderne: *Start (time)*, *Slut (time)*, *Pausen starter* og *Pausens varighed (minutter)*. Du skriver tider som TT:MM. Med pilene hæver eller sænker du dem med et kvarter. Sæt pausens varighed til 0, så arbejder kalenderen uden pause. Appen beregner *Standard arbejdsdag* selv. Har kalenderen tidsbånd pr. ugedag (for eksempel fra MS Project), så ser du ikke disse felter, men blokken *Arbejdstimer*, også når timeplanlægning er slået fra; se [Angiv arbejdstider](docs://howto-werktijden-instellen).
6. Juster om nødvendigt helligdagene. Hvordan det virker, står i [Generering af helligdage og byggeferie](docs://howto-feestdagen-genereren).
7. Klik på *Anvend*. Appen genberegner tidsplanen med det samme og lukker vinduet. Med *Annuller* smider du ændringerne væk. Indtastning i et felt gemmer undervejs og genberegner også, men uden at lukke vinduet; *Annuller* fortryder da kun det, du har ændret efter det.

### Tildele en kalender til opgaver

En ny kalender gør først noget, når en opgave bruger den. Der er to måder.

**Via egenskabspanelet**

1. Vælg opgaven. Ser du ikke panelet *Egenskaber*, så slå det til med *Visning › Paneler › Egenskaber*.
2. Vælg under *Opgave* kalenderen i listen *Kalender*. Det øverste valg, *Projektkalender* med navnet efter, betyder at opgaven ikke har en egen kalender.

**Via genvejsmenuen**

1. Højreklik på opgaven, i opgavetabellen eller på bjælken i Gantt-diagrammet.
2. Vælg *Tildel kalender* og derefter kalenderen, eller *Projektkalender* for at fjerne kalenderen igen. Den kalender, der gælder nu, har et flueben.
3. Vil du give én kalender til flere opgaver på én gang, så vælg dem først med Ctrl (⌘ på en Mac) og højreklik på en af de valgte opgaver. Valget gælder for alle valgte opgaver. Højreklikker du på en opgave, der ikke er valgt, gælder det kun for den opgave.

Et nyt kalendervalg gør ikke tidsplanen aktuel med det samme: statuslinjen viser *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*. Er *Beregn automatisk* slået til (*Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*, overskriften *Beregning*), så gør appen det selv.

### Skifte projektkalender

1. Åbn *Tidsplan › Kalender › Kalender* og vælg kalenderen i listen.
2. Klik over formularen på *Angiv som projektstandard*. Stjernen flytter til den kalender.
3. Klik på *Anvend*.

Kun opgaver uden egen kalender flytter med.

### Slette en kalender

1. Åbn vinduet *Kalendere* og vælg kalenderen i listen.
2. Klik under listen på knappen med skraldespanden (*Slet*). Knappen er deaktiveret, så længe der kun er én kalender.
3. Klik på *Anvend*. Opgaver og ressourcer, der brugte kalenderen, sættes til projektkalenderen. Sletter du selve projektkalenderen, bliver den første kalender i listen projektkalender.

## Faldgruber, og hvad appen gør så

**Ingen arbejdsdage.** Slår du alle ugedage fra, kan appen ikke beregne. Ved beregning viser den *Kalenderen har ingen arbejdsdage angivet*.

**Ugyldig indtastning.** En pause uden for arbejdsdagen, et starttidspunkt efter sluttidspunktet eller en helligdag med en forkert dato får en rød besked ved feltet, og *Anvend* er deaktiveret, indtil du retter det. Ved en ugyldig pause eller helligdag står der også et advarselstegn ved kalenderen i listen (*Denne kalender indeholder ugyldige indtastninger*).

**En kalender på en fase.** En fase beregnes altid på projektkalenderen, fordi dens varighed følger af opgaverne. Giv kalenderen i stedet til opgaverne selv.

**Dobbelt valg af samme kalender.** I listen står projektkalenderen to gange: som *Projektkalender: navn* og som en almindelig kalender med det navn. Vælger du den anden, er det et eget valg for den opgave. Opgaven flytter så ikke med, når du senere vælger en anden projektkalender.

**Forskellige timer pr. dag.** Ændrer du arbejdstiderne eller pausen, så *Standard arbejdsdag* for en kalender ændres, tæller en opgave i dage stadig det samme antal dage. For en opgave med ressourcer og opgavetypen *Fast arbejde* eller *Faste enheder* ændres varigheden med, fordi arbejdet er det samme. Fyrre timers arbejde er 5 dage med 8 timer pr. dag og 7 dage med 6 timer pr. dag. Appen viser, hvor mange opgaver der fik en anden varighed.

## Se også

- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvordan appen tæller arbejdsdage, og hvilken kalender der vinder.
- [Dage og timer](docs://uitleg-dagen-en-uren): hvad standard arbejdsdag gør.
- [Opsætning af en ressourcekalender](docs://howto-resourcekalender-instellen): en kalender for en ressource i stedet for en opgave.
- [Kalendervinduer](docs://ref-kalenders): alle felter i kalendervinduerne.
