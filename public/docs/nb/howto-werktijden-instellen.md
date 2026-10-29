# Angi arbeidstider

Mål: legg inn per ukedag på hvilke klokkeslett en kalender arbeider, slik at aktiviteter i timer får riktige klokkeslett.

## Når du trenger dette

Fredag ettermiddag er fri. Mannskapet arbeider fra 06:00 til 22:00 i to skift. Det er et nattlag. Pausen er kortere enn én time. Så lenge du bare planlegger i dager, er *Start (time)*, *Slutt (time)* og pausen nok ([Opprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen)). Planlegger du aktiviteter i timer, teller appen arbeidsminutter innenfor **tidsbåndene** i kalenderen. I appen heter disse tidsbåndene *bånd*. Et tidsbånd er en sammenhengende periode med arbeidstid på én ukedag. Et mellomrom mellom to tidsbånd er en pause. Hva dette betyr for tidsplanen din, står i [Dager og timer](docs://uitleg-dagen-en-uren).

Vil du gi en vanlig kalender tidsbånd, trenger du *Slå på timeplanlegging* ([Slå på timeplanlegging](docs://howto-urenplanning-aanzetten)). Har kalenderen allerede tidsbånd, for eksempel fra en MS Project-fil, er blokken *Arbeidstider* alltid der. Da endrer du tidsbåndene også når timeplanlegging er av.

## Trinn

### Velge et skiftpreset

1. Velg *Tidsplan › Kalender › Kalender* og velg kalenderen til venstre.
2. Klikk på et preset i blokken *Arbeidstider*. Det erstatter arbeidsdagene og arbeidstidene i kalenderen.
3. Klikk på *Bruk*.

Hvert preset gjør dette:

- *Dagskift*: mandag til fredag fra 08:00 til 16:00 uten pause. Dette gjør den igjen til en vanlig kalender uten tidsbånd.
- *2 skift*: mandag til fredag fra 06:00 til 14:00 og fra 14:00 til 22:00, 16 timer til sammen.
- *3 skift*: mandag til fredag tre skift, fra 06:00 til 14:00, fra 14:00 til 22:00 og fra 22:00 til 06:00 neste dag, 24 timer til sammen.
- *Nattskift*: mandag til fredag fra 22:00 til 06:00 neste dag, 8 timer.
- *24/7*: alle syv dager fra 00:00 til 24:00.

### Angi arbeidstider per ukedag

1. Klikk på *Angi per ukedag…* i blokken *Arbeidstider*. Under knappene vises en rad per ukedag med arbeidstiden for den dagen, og kalenderen har nå tidsbånd per ukedag. Har kalenderen dem allerede, er denne oversikten åpen med én gang. Knappen heter da *Skjul arbeidstider* og skjuler oversikten igjen.
2. Juster starttiden og sluttiden for hvert tidsbånd i de to tidsfeltene. Skriv inn klokkeslettet og trykk Enter, eller bruk pilene (15 minutter per trinn). Feltene følger *Tidsformat* i innstillingene; *13:00* og *1:00 PM* fungerer begge.
3. Vil du legge inn en pause, klikk på **+** (*Legg til bånd*) for den dagen. Juster tidene for tidsbåndene, slik at det blir et mellomrom mellom dem. Et nytt tidsbånd starter klokken 08:00 og slutter klokken 16:00.
4. Et tidsbånd som går over midnatt, huker du av med *neste dag*. Tidsbåndet teller for den dagen det begynner.
5. Klikk på søppelbøtta bak et tidsbånd for å fjerne det. En dag uten tidsbånd vises som *Ikke-arbeidsdag*.
6. Klikk på kopisymbolet (*Kopier til alle arbeidsdager*) for en dag fra mandag til fredag. Tidsbåndene for den dagen legges da på mandag til fredag.
7. Over blokken *Arbeidstider* står *Standardarbeidsdag*: arbeidstiden per dag som appen utleder av blokkene og regner med. Tallet følger med én gang når du endrer blokkene. Har kalenderen egne timer per dag (for eksempel fra Primavera P6), beholdes den egne verdien og følger med ved eksport, til et preset erstatter den. Avviker den egne verdien fra *Standardarbeidsdag*, vises rett under tallet en oransje blokk, for eksempel: *Filen har en egen arbeidsdag på 8t. Den beholdes ved eksport til MS Project og P6. Der regnes én dag som 8t, her 10t.* Blokken forsvinner så snart tidsbåndene gir samme dagsum, eller når et preset erstatter den egne verdien. Blokken endrer ikke beregningen. Klikk på *Bruk*.

**Eksempel: en fri fredag ettermiddag.** Klikk på *Angi per ukedag…*. Fjern det andre tidsbåndet (13:00 til 16:00) for *Fr*. Fredag har nå 5 timer, de andre dagene 8. *Standardarbeidsdag* blir fortsatt 8 timer.

### Lagre et eget preset

1. Klikk på *Lagre som preset…* og skriv et navn i feltet *Navn på ditt eget preset*.
2. Klikk på *Lagre*. Presetet står nå blant de andre presetene, og du kan bruke det i alle prosjekter. Med krysset ved siden av det fjerner du det igjen.

Et eget preset lagres på denne enheten, ikke i prosjektfilen.

## Fallgruver og hva appen gjør da

**Et preset erstatter alt.** Velger du et preset, forsvinner arbeidsdagene og arbeidstidene du satte før. Helligdager blir ikke endret.

**Dagknappene endrer tidsbåndene.** Slår du av en dag under *Arbeidsdager*, forsvinner tidsbåndene for den dagen. Slår du den på igjen, får den tidsbåndene den hadde da du åpnet dialogen (eller etter det siste presetet), ellers dem for den første arbeidsdagen. *Man–fre* gjør det for mandag til fredag og fjerner tidsbåndene for lørdag og søndag. *Kontinuerlig (24/7)* erstatter alle tidsbånd: hver dag får 00:00 til 24:00.

**Justering av arbeidstider når timeplanlegging er av.** En kalender med tidsbånd beholder blokken *Arbeidstider*, også når du slår av timeplanlegging. Du endrer tidsbåndene der. Velger du *Dagskift*, blir den igjen en vanlig kalender med feltene *Start (time)*, *Slutt (time)* og pausen. Da kan du bare legge tidsbånd tilbake med timeplanlegging på.

**Ingen brukbare arbeidstider.** En kalender uten tidsbånd eller uten arbeidsdager kan ikke bære en aktivitet i timer. Appen viser da *Denne kalenderen har ingen gyldige arbeidstider. Kontroller arbeidsdagene og arbeidstidene*.

## Se også

- [Dager og timer](docs://uitleg-dagen-en-uren): hvordan appen teller arbeidstimer og utleder standardarbeidsdagen.
- [Slå på timeplanlegging](docs://howto-urenplanning-aanzetten): planlegge en aktivitet i timer.
- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvilken kalender som gjelder for hvilken aktivitet.
- [Kalendervinduer](docs://ref-kalenders): alle felt i kalendervinduene.
