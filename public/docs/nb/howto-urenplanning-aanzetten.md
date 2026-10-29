# Slå på timeplanlegging

Mål: planlegg aktiviteter i arbeidstimer, sammen med aktiviteter i dager.

## Når du trenger dette

Du leier en kran per time, ikke per dag. En støp på seks timer får ikke plass i én hel arbeidsdag. Et nattmannskap arbeider til andre tider enn dagmannskapet. For slikt arbeid vil du ha en varighet i timer, og en start og en slutt med klokkeslett. Du slår dette også på hvis du åpner en fil og appen viser *Denne filen inneholder timeplanlegging.* Hvorfor appen teller dager og timer på ulike måter, kan du lese i [Dager og timer](docs://uitleg-dagen-en-uren).

## Trinn

### Slik slår du på timeplanlegging

1. Velg *Innstillinger › Prosjekt › Appinnstillinger* og åpne fanen *Tidsplan*.
2. Under *Timeplanlegging* krysser du av for *Slå på timeplanlegging*. Det virker med én gang. Knappen *Slå på timeplanlegging* i meldingen *Denne filen inneholder timeplanlegging* gjør det samme.
3. Under dette står *Tillat blandet dag/timeplanlegging*, som er på som standard. Med denne innstillingen velger du per aktivitet om den telles i dager eller timer. Slår du den av, forsvinner listen *Varighetsenhet*. Du kan da fortsatt skrive inn en varighet med en enhet, for eksempel `12h`.

Dette endrer mer enn varigheten til en aktivitet: under *Visning › Tidsskala* kan du velge skalaen *Time*. I vinduet *Kalendere* kan en vanlig kalender få arbeidstidsblokker (blokken *Arbeidstider*; en kalender som allerede har blokker, viser den alltid). Vinduet *Nytt prosjekt* får i tillegg valgene *Skift* og *Standardenhet for nye aktiviteter*.

### Planlegge en aktivitet i timer

1. Velg aktiviteten, og se i panelet *Egenskaper*, under *Tid*, på feltet *Varighet*.
2. Skriv inn varigheten med en enhet, og trykk på Enter: `12h` (`12u`, den nederlandske forkortelsen, fungerer også) for tolv timer, `1h 30m` for halvannen time. `1.5h` går også bra. Et tall uten enhet telles i enheten aktiviteten allerede har.
3. Hvis du vil konvertere en eksisterende aktivitet, velg enheten *Timer* under *Varighetsenhet*. Appen konverterer varigheten med en gang, for eksempel fra `2` dager til `16` timer. Vil du gå tilbake, bruk *Angre*.
4. Du kan gå tilbake til dager med `2d` eller med enheten *Dager*.
5. Trykk på **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Aktiviteten har nå en start og en slutt med klokkeslett.
6. Hvis du vil se timene i Gantt-diagrammet, velg skalaen *Time* i listen under *Visning › Tidsskala*.

### Nye aktiviteter i timer som standard

1. Velg *Innstillinger › Prosjekt › Prosjektinnstillinger*.
2. Under *Standardenhet for nye aktiviteter* velger du enheten *Timer* og klikker på *Bruk*.

En ny aktivitet begynner da med 5 timer i stedet for 5 dager. Eksisterende aktiviteter endres ikke. Med et nytt prosjekt finner du det samme valget i vinduet *Nytt prosjekt*. Velger du *Dagskift* under *Skift* der, er *Timer* deaktivert. Velg et annet skift, eller angi standardenheten i *Prosjektinnstillinger* etter at du har opprettet prosjektet.

## Valkuiler og hva appen da gjør

**Ingen gyldige arbeidstider.** Har kalenderen for aktiviteten ingen brukbare arbeidstider, viser appen *Denne kalenderen har ingen gyldige arbeidstider. Kontroller arbeidsdagene og arbeidstidene*. Ved beregning kan meldingen *Timebasert aktivitet 'name' har ingen gyldige arbeidstimer i kalenderen sin* komme opp.

**Ingen desimaler med dager.** En varighet i dager er et heltall. `1.5d` gir meldingen *Skriv inn et heltall dager eller timer, for eksempel 2d eller 12t*. Vil du ha en og en halv dag, så beregn i timer.

**En konvertering som ikke kan bli nøyaktig.** Tolv timer går ikke opp i hele dager på 8 timer. I *Egenskaper* og i *Rediger aktivitet* viser appen da en gul boks med *12h tilsvarer ikke hele dager i denne kalenderen. Enheten er ikke endret*. Enheten blir som den er. I aktivitetstabellen står en kortere melding: *Denne varigheten kan ikke regnes nøyaktig om til den andre enheten*.

**Feltet er deaktivert.** For en fase, en hengekøye eller en milepæl med varighet null følger varigheten av noe annet, og du kan ikke skrive den inn.

**Timeplanlegging slås av igjen.** Timebaserte aktiviteter blir beholdt og beregnes fortsatt. Varigheten kan da ikke redigeres. Feltet viser *Slå på timeplanlegging for å redigere denne timebaserte aktiviteten*, med en knapp for å slå den på igjen.

## Se også

- [Dager og timer](docs://uitleg-dagen-en-uren): hvordan appen teller timer, hva som skjer når dager og timer møtes, og hvor den runder av.
- [Angi arbeidstider](docs://howto-werktijden-instellen): tidene i en kalender per ukedag.
- [Legge til avhengigheter](docs://howto-relaties-leggen): en forsinkelse i timer mellom to aktiviteter.
- [Appinnstillinger](docs://ref-instellingen): innstillingen Slå på timeplanlegging og hva den ellers endrer.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): inneholder aktiviteter i timer (armering og støping) med en egen timekalender, *Hourly calendar, rebar fixing & pouring*.
