# Lage og tilordne en kalender

Mål: lag en egen kalender, for eksempel en arbeidsuke på seks dager, og gi den til aktivitetene som må beregnes i den.

## Når du trenger dette

En underleverandør jobber også på lørdager. Et mannskap jobber bare fra mandag til torsdag. En aktivitet faller i en periode der bare den aktiviteten står stille. Prosjektkalenderen har da feil arbeidsdager. Med en egen kalender beregner appen disse aktivitetene på de riktige dagene, og resten blir på prosjektkalenderen. Hva appen gjør med en kalender, nøyaktig, kan du lese i [Kalendere og arbeidsdager](docs://uitleg-kalenders).

## Trinn

### Lage en kalender

1. Velg *Tidsplan › Kalender › Kalender*. Den samme knappen finnes under *Innstillinger › Kalender › Kalender*. Vinduet *Kalendere* åpnes. Til venstre ser du prosjektets kalendere; prosjektkalenderen har en stjerne.
2. Klikk under listen på knappen med plusstegnet (*Legg til ny kalender*). Den nye kalenderen er en kopi av standarden: mandag til fredag, klokken 07:00 til 16:00 med én times pause og, når *Byggmodus* er på, de nederlandske helligdagene. Vil du bruke en eksisterende kalender som utgangspunkt, velg den i listen og klikk på knappen med de to arkene under listen (*Dupliser*).
3. Gi kalenderen et navn under *Navn* som sier hvem som bruker den, for eksempel *Six-day week*.
4. Klikk under *Arbeidsdager* på ukedagene for å slå dem på eller av. *Man–fre* gjenoppretter standarduken, med 07:00 til 16:00. Har kalenderen tidsbånd, slår *Man–fre* bare på mandag til fredag, og hver dag beholder sine tidsbånd. *Kontinuerlig (24/7)* slår på alle sju dager, fra 00:00 til 24:00.
5. Juster arbeidstidene ved behov: *Start (time)*, *Slutt (time)*, *Pausen starter* og *Pausevarighet (minutter)*. Du skriver tidspunkter som TT:MM. Med pilene øker eller senker du dem med en kvart time. Setter du pausevarigheten til 0, arbeider kalenderen uten pause. Appen beregner *Standardarbeidsdag* selv. Har kalenderen tidsbånd per ukedag (for eksempel fra MS Project), ser du ikke disse feltene, men blokken *Arbeidstider*, også når timeplanlegging er av; se [Angi arbeidstider](docs://howto-werktijden-instellen).
6. Juster helligdagene ved behov. Hvordan det fungerer, står i [Generere helligdager og byggferie](docs://howto-feestdagen-genereren).
7. Klikk på *Bruk*. Appen omberegner tidsplanen med en gang og lukker vinduet. Med *Avbryt* kaster du endringene. Trykker du Enter i et inndatafelt, lagres endringen underveis og tidsplanen omberegnes også, uten at vinduet lukkes. *Avbryt* angrer da bare det du endret etter det.

### Gi en kalender til aktiviteter

En ny kalender gjør først noe når en aktivitet bruker den. Det finnes to måter.

**Via egenskapspanelet**

1. Velg aktiviteten. Ser du ikke panelet *Egenskaper*, slår du det på med *Visning › Paneler › Egenskaper*.
2. Under *Aktivitet* velger du kalenderen i listen *Kalender*. Det øverste valget, *Prosjektkalender* med navnet etter, betyr at aktiviteten ikke har en egen kalender.

**Via høyreklikkmenyen**

1. Høyreklikk aktiviteten, i aktivitetstabellen eller på stolpen i Gantt-diagrammet.
2. Velg *Tilordne kalender* og deretter kalenderen, eller *Prosjektkalender* for å fjerne kalenderen som aktiviteten har selv. Kalenderen som nå gjelder har en hake.
3. Vil du gi én kalender til flere aktiviteter samtidig, velg dem først med Ctrl (⌘ på Mac), og høyreklikk på én av de valgte aktivitetene. Valget gjelder for alle valgte aktiviteter. Høyreklikker du på en aktivitet som ikke er valgt, gjelder valget bare for den aktiviteten.

Et nytt kalendervalg gjør at tidsplanen ikke er oppdatert ennå: statuslinjen viser *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Er *Beregne automatisk* på (*Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*, overskriften *Beregning*), gjør appen dette selv.

### Bytte prosjektkalender

1. Åpne *Tidsplan › Kalender › Kalender* og velg kalenderen i listen.
2. Klikk over skjemaet på *Angi som prosjektstandard*. Stjernen flytter til den kalenderen.
3. Klikk på *Bruk*.

Bare aktivitetene uten egen kalender flytter med.

### Slette en kalender

1. Åpne vinduet *Kalendere* og velg kalenderen i listen.
2. Klikk under listen på knappen med søppelbøtten (*Slett*). Den knappen er inaktiv så lenge det bare finnes én kalender.
3. Klikk på *Bruk*. Aktiviteter og ressurser som brukte kalenderen, settes til prosjektkalenderen. Sletter du selve prosjektkalenderen, blir den første kalenderen i listen den nye prosjektkalenderen.

## Fallgruver og hva appen gjør da

**Ingen arbeidsdager.** Slår du av alle ukedager, kan appen ikke beregne. Ved beregning viser den *Kalenderen har ingen arbeidsdager angitt*.

**Ugyldige verdier.** En pause utenfor arbeidsdagen, et starttidspunkt etter sluttidspunktet eller en helligdag med feil dato får en rød melding ved feltet. *Bruk* er da inaktiv til du retter det. Ved en ugyldig pause eller helligdag vises også et varseltegn ved kalenderen i listen (*Denne kalenderen inneholder ugyldige verdier*).

**En kalender på en fase.** En fase beregnes alltid på prosjektkalenderen, fordi varigheten følger av aktivitetene. Gi kalenderen til aktivitetene selv.

**Samme kalender, to valg.** I listen står prosjektkalenderen to ganger: som *Prosjektkalender: navn* og som en vanlig kalender med det navnet. Velger du den andre, er det et eget valg for den aktiviteten. Aktiviteten flytter da ikke med når du senere velger en annen prosjektkalender.

**Ulike timer per dag.** Endrer du arbeidstidene eller pausen, slik at *Standardarbeidsdag* for en kalender endres, så teller en aktivitet i dager fortsatt like mange dager. For en aktivitet med ressurser og aktivitetstypen *Fast arbeid* eller *Faste enheter* endres varigheten med, fordi arbeidet forblir det samme. Førti timers arbeid er 5 dager med 8 timer per dag og 7 dager med 6 timer per dag. Appen melder hvor mange aktiviteter som fikk en annen varighet.

## Se også

- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvordan appen teller arbeidsdager og hvilken kalender som vinner.
- [Dager og timer](docs://uitleg-dagen-en-uren): hva standardarbeidsdagen gjør.
- [Oppsett av ressurskalender](docs://howto-resourcekalender-instellen): en kalender for en ressurs i stedet for en aktivitet.
- [Kalendervinduene](docs://ref-kalenders): alle felt i kalendervinduene.
