# Dager og timer

En aktivitet på 2 dager og en aktivitet på 16 timer ser like ut, men appen regner dem ulikt. Hvorfor kan du velge mellom dager og timer? Og hva skjer når en aktivitet i timer er koblet til en aktivitet i dager? I denne artikkelen leser du hvordan appen teller dager og timer, og hvor den runder av. Det regnede eksempelet viser tallene.

## Begrepet

En **dagbasert aktivitet** har en varighet i hele arbeidsdager, for eksempel `5d`. Den tar hele arbeidsdager. I standardkalenderen har den en startdato og en sluttdato uten klokkeslett.

En **timebasert aktivitet** har en varighet i arbeidstimer, for eksempel `12h` eller `1h 30m`. Den har en start og en slutt med klokkeslett, for eksempel tirsdag kl. 11:00.

Enheten hører til aktiviteten, ikke til prosjektet. Du kan blande dagbaserte og timebaserte aktiviteter i én tidsplan. Det kalles **blandet planlegging**.

Du bruker timer for jobber som ikke passer i hele dager: en kran du leier i tolv timer, en støping på seks timer, en aktivitet som bare kan starte etter lunsj. For alt annet er dager nok, og de er tydeligere.

**Timeplanlegging** er som standard av. Så lenge den er av, regner appen i dager. Hvis en fil inneholder timeplanlegging, for eksempel aktiviteter i timer, viser appen *Denne filen inneholder timeplanlegging*. Disse aktivitetene regnes fortsatt ut, men du kan bare endre varigheten deres når du slår på timeplanlegging.

## Slik regner appen

### Arbeidstider og standardarbeidsdag

Hver kalender har **tidsbånd** for hver arbeidsdag (kalt *bands* i appen). Standardkalenderen har 07:00 til 12:00 og 13:00 til 16:00. Mellomrommet er pausen. Appen utleder disse tidsbåndene fra kalenderens *Start (time)*, *Slutt (time)* og pause. Du trenger ikke å angi noe for det. Hvis du angir egne tidsbånd per ukedag, går de foran.

**Standardarbeidsdagen** er den arbeidsdagen som kommer oftest, og lengden er summen av tidsbåndene. Det er altså ikke et gjennomsnitt: med mandag på 16 timer og tirsdag til fredag på 10 timer er standardarbeidsdagen 10 timer. Hvis arbeidsdagene har ulik lengde, gjelder den vanligste daglige summen. Ved likhet gjelder den høyeste. Med fire dager på 8 timer og en fredag på 5 timer er standardarbeidsdagen derfor 8 timer. En kalender med egne timer per dag (for eksempel fra Primavera P6) regner også med denne daglige summen, og kalendervinduet viser den. Den egne verdien blir bevart for eksporten. Hvis de er ulike, viser kalendervinduet en oransje blokk under *Standardarbeidsdag*. En aktivitet på 1870 timer med tidsbånd på 10 timer varer derfor 187 dager, selv om kalenderens egen verdi er 8 timer per dag.

### En aktivitet i timer

Appen teller arbeidsminutter fra starten, gjennom tidsbåndene. Pauser, kvelder, helger og helligdager teller ikke med. En aktivitet på 12 timer passer derfor ikke i één arbeidsdag på 8 timer: den fortsetter neste dag.

### En aktivitet i dager

Appen teller hele arbeidsdager. Timene per dag spiller ingen rolle. En aktivitet på 5 dager slutter på samme dag, uansett om kalenderen har 6 eller 8 timer per dag.

### Omregning mellom dager og timer

En dag er standardarbeidsdagen i aktivitetens kalender. Appen bruker den på tre steder:

- For *Varighetsvisning*. Under *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Utseende*, velger du *Automatisk (egen enhet per aktivitet)*, *Alltid dager* eller *Alltid timer*. En aktivitet på 18 timer vises under *Alltid dager* som `2.25d(18h)`: den opprinnelige enheten blir stående i parentes.
- For en forsinkelse i timer etter en dagbasert aktivitet (se *Avrunding*).
- Når du bytter enhet for en aktivitet. Appen teller da dagene fra starten av aktiviteten, hver dag med sine egne timer, og gjør varigheten om med en gang hvis resultatet blir eksakt. To dager blir `16h`. På en kalender der fredag har 5 timer, blir 5 dager fra mandag `37h`. Tolv timer kan ikke gjøres om til hele dager på en kalender med dager på 8 timer: da lar appen enheten stå som den er.

### Dagbaserte og timebaserte aktiviteter sammen

Reglene under gjelder for en avhengighet av typen slutt-til-start i en kalender uten egne tidsbånd, for eksempel standardkalenderen.

- **Time → time.** Etterfølgeren starter i det øyeblikket forgjengeren er ferdig, også hvis det er midt på dagen.
- **Time → dag.** En dagbasert aktivitet starter aldri midt på dagen. Den starter første arbeidsdag etter dagen da den timebaserte aktiviteten slutter. Resten av den dagen blir ubrukt og kommer tilbake som slakk på den timebaserte aktiviteten.
- **Dag → time.** En dagbasert aktivitet tar hele sin siste dag. Den timebaserte aktiviteten starter første arbeidsdag etter den, ved starten av det første tidsbåndet.

### Avrunding

Appen runder av, eller avviser, på fire steder:

- **En dagbasert aktivitet etter en timebasert aktivitet** starter neste arbeidsdag. Den timebaserte aktiviteten blir, så å si, avrundet opp til hele dager.
- **En forsinkelse i timer** teller i kalenderen for forsinkelsen, som standard den til forgjengeren. Hvis forgjengeren er en dagbasert aktivitet i en kalender uten egne tidsbånd, for eksempel standardkalenderen, gjør appen forsinkelsen om til hele arbeidsdager: forsinkelsen delt på timene i standardarbeidsdagen, avrundet til et heltall. En halv dag rundes opp. Ved 8 timer per dag teller 1 time som 0 dager, 4 timer som 1 dag og 12 timer som 2 dager. Det gjelder også hvis etterfølgeren er en timebasert aktivitet. Hvis forgjengeren er en timebasert aktivitet, eller kalenderen har egne tidsbånd, teller forsinkelsen nøyaktig i arbeidstimer, og pausen teller ikke med.
- **En varighet i dager** er alltid et heltall. Hvis du skriver `1.5d`, viser appen *Skriv inn et heltall dager eller timer, for eksempel 2d eller 12t*. En varighet i timer kan være `1.5h`, eller `1h 30m`.
- **Å bytte enhet** skjer bare hvis resultatet er eksakt (se over).

## Regnet eksempel: kranen

Kalenderen er fra mandag til fredag, fra 07:00 til 12:00 og fra 13:00 til 16:00: en standardarbeidsdag på 8 timer. Prosjektstarten er mandag 7. juni 2027.

### Time, time og dag

*Place crane* varer 12 timer. Mandag har 8 arbeidstimer (5 til 12:00 og 3 etter pausen), og tirsdag de siste 4 timene. Aktiviteten går fra mandag 07:00 til **tirsdag 8. juni kl. 11:00**.

*Adjust elements* varer 8 timer og følger etter med en avhengighet av typen slutt-til-start. Den starter med en gang tirsdag kl. 11:00: det er 1 time til pausen og 3 timer etter den. De siste 4 timene er onsdag fra 07:00 til 11:00. Slutten er **onsdag 9. juni kl. 11:00**.

*Finishing* varer 2 dager og følger etter *Adjust elements*. En dagbasert aktivitet starter ikke midt på dagen, så den starter på **torsdag 10. juni** og slutter fredag 11. juni.

### Avrunding ved overgangen

Hvis du utelater *Adjust elements* og knytter *Finishing* direkte til *Place crane*, starter *Finishing* onsdag 9. juni og slutter torsdag 10. juni. Resten av tirsdagen (4 arbeidstimer) kan ikke brukes. Du ser de 4 timene igjen som totalslakk for *Place crane*: en halv arbeidsdag.

Snur du rekkefølgen, blir det enklere. *Pour foundation* varer 2 dager, fra mandag 7. til tirsdag 8. juni. *Place crane* varer nå 4 timer og følger etter. Den starter **onsdag 9. juni kl. 07:00** og slutter kl. 11:00.

### En forsinkelse i timer

Mellom *Place crane* (12 timer) og *Adjust elements* (8 timer) legger du inn en forsinkelse på 2 timer. *Adjust elements* starter da ikke kl. 11:00, men tirsdag kl. **14:00**: 1 time til pausen, og 1 time etter den. Slutten flytter seg til **onsdag 9. juni kl. 14:00**.

Etter en dagbasert aktivitet fungerer en forsinkelse annerledes. *Pour foundation* slutter tirsdag 8. juni. Uten forsinkelse starter *Finishing* onsdag 9. juni. Med en forsinkelse på 4 timer er det en halv dag, og appen runder opp: *Finishing* starter **torsdag 10. juni**. Med en forsinkelse på 1 time runder appen ned, og *Finishing* starter rett og slett onsdag.

### En fri fredagsettermiddag

Nå har fredag bare ett tidsbånd, fra 07:00 til 12:00: 5 timer. De andre dagene er fortsatt 8 timer. Standardarbeidsdagen er fortsatt 8 timer, fordi det er den vanligste daglige summen. En uke har nå 37 arbeidstimer.

En aktivitet på 40 timer fra mandag 7. juni kl. 07:00 bruker mandag til torsdag (32 timer) og fredag (5 timer). De siste 3 timene havner på mandagen etter, fra 07:00 til 10:00. Slutten er **mandag 14. juni kl. 10:00**. En aktivitet på 5 dager vil ta 37 timer fra mandag, og det er det appen foreslår hvis du bytter enheten for 5 dager til timer.

I opplæring 4 om timeplanlegging planlegger du selv kranjobben i timer.

## Konsekvenser og misforståelser

**«8 timer er 1 dag.»** Bare hvis kalenderen har dager på 8 timer. I kalenderen med den frie fredagsettermiddagen er 5 dager 37 timer, ikke 40.

**«Hvis jeg setter flere timer per dag, blir den dagbaserte aktiviteten ferdig tidligere.»** Nei. En dagbasert aktivitet teller hele arbeidsdager. Timene per dag endrer bare hva en dag er verdt i timer, for eksempel i visningen og for en forsinkelse i timer. Bare for en aktivitet med ressurser og aktivitetstypen *Fast arbeid* eller *Faste enheter* endres varigheten med det, fordi arbeidet blir det samme: 40 timer arbeid er 5 dager på 8 timer per dag, og 7 dager på 6 timer per dag.

**«En aktivitet på 8 timer varer én dag.»** Bare hvis den starter ved dagens begynnelse. Hvis den starter senere, som *Adjust elements* tirsdag kl. 11:00, fortsetter den inn i neste dag.

**En kalender med egne tidsbånd** oppfører seg annerledes enn standardkalenderen. Du får en slik kalender ved å angi arbeidstider per ukedag, eller ved å velge et ferdig oppsett for skift (*2 skift*, *3 skift*, *Nattskift* eller *24/7*). I en slik kalender teller en forsinkelse i timer nøyaktig i arbeidstimer, også etter en dagbasert aktivitet.

**Å slå av timeplanlegging** fjerner ingenting. Aktiviteter i timer blir værende og regnes fortsatt ut, men du kan ikke redigere dem før du slår på timeplanlegging igjen.

## Se også

- [Slå på timeplanlegging](docs://howto-urenplanning-aanzetten): stegene for å planlegge en aktivitet i timer.
- [Angi arbeidstider](docs://howto-werktijden-instellen): tilpasse tidsbåndene i en kalender.
- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvordan appen teller arbeidsdager, og hvilken kalender som går foran.
- [Legge til avhengigheter](docs://howto-relaties-leggen): stegene for å legge til en avhengighet eller forsinkelse.
