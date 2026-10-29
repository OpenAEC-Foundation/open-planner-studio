# Kalendere og arbeidsdager

Hvor mange arbeidsdager tar en aktivitet, og på hvilken dato er den ferdig? Det avhenger av kalenderen som appen teller i. I denne artikkelen leser du hva en kalender er, hvordan appen teller arbeidsdager med den, og hvilken kalender som gjelder når flere er med. Eksempelet hjelper deg å følge tallene.

## Begrepet

En tidsplan teller i **arbeidsdager**, ikke i kalenderdager. «Fem dager murarbeid» betyr fem dager der det utføres arbeid. En helg eller en helligdag teller ikke, så en slik aktivitet strekker seg over mer enn fem dager i dagboken.

Hvilke dager som er arbeidsdager, står i en **kalender**. En kalender bestemmer tre ting:

- Den **arbeidsuken**: ukedagene der det utføres arbeid. Som standard er det mandag til fredag.
- De **arbeidstidene**: start, slutt og pause. De gir den **standardarbeidsdagen**. Som standard er det 07:00 til 16:00 med én times pause, altså 8 timer.
- De **helligdagene**: enkeltdager eller hele perioder der det ikke utføres arbeid, for eksempel Koningsdag, jul eller byggferien.

Et prosjekt har ett bibliotek med kalendere. Én av dem er **prosjektkalenderen**. Den gjelder for alle aktiviteter som ikke har en egen kalender. Du kan gi en enkelt aktivitet en annen kalender, for eksempel en arbeidsuke på seks dager for en underentreprenør som også jobber på lørdager. En ressurs kan også ha sin egen kalender, men den gjør noe annet (se nedenfor).

## Hvordan appen beregner

Denne artikkelen beskriver standardberegningen: beregningsprofilen *Open Planner Studio*, som et nytt prosjekt beregnes med.

### Slik telles arbeidsdager

Den første arbeidsdagen i en aktivitet telles som dag 1. En aktivitet på 5 dager slutter derfor på den femte arbeidsdagen. Starter den på en ikke-arbeidsdag, begynner aktiviteten på neste arbeidsdag. En helligdag eller byggferie midt i en aktivitet telles ikke: aktiviteten går bare over den og blir lengre i dagboken.

Timene per dag spiller ingen rolle for datoene til en aktivitet i dager. Bare arbeidsuken og helligdagene teller. Arbeidstidene kommer bare i spill for en aktivitet i timer; det beskrives i [Dager og timer](docs://uitleg-dagen-en-uren).

### Hvilken kalender som gjelder

Appen velger én kalender per aktivitet:

1. Har aktiviteten en egen kalender, beregner appen hele aktiviteten i den kalenderen: varighet, sluttdato og slakk.
2. Har den ingen egen kalender, gjelder prosjektkalenderen. Peker en aktivitet på en kalender som ikke finnes lenger, bruker den også prosjektkalenderen.

En hovedaktivitet (en fase) har ikke noe arbeid selv og derfor ingen egen kalender. Varigheten følger av datoene til aktivitetene i den, og appen teller den på prosjektkalenderen.

Kalenderen til en **ressurs** spiller ingen rolle for datoene. I en tidsplan du bygger selv i appen bestemmer den bare når ressursen er tilgjengelig: i histogrammet, for overallokering og ved utjevning.

### Aktiviteter på ulike kalendere

Når to aktiviteter med ulike kalendere kobles, gjelder dette:

- Med en slutt-til-start-avhengighet begynner etterfølgeren på den første arbeidsdagen etter slutten av forgjengeren, telt i kalenderen til **etterfølgeren**. Slutter en aktivitet på en fredag, starter en etterfølger med en arbeidsuke på seks dager på lørdag.
- En **forsinkelse** telles som standard i kalenderen til **forgjengeren**. Du kan endre det under *Innstillinger › Prosjekt › Prosjektinnstillinger*, i blokken *Beregningsprofil og beregningsalternativer*, under *Beregningsalternativer for dette prosjektet*, med valget *Forsinkelseskalender*: *Forgjenger* (standard), *Etterfølger*, *24-timers* eller *Prosjektkalender*.
- Den **totalslakken** telles i arbeidsdager i kalenderen til aktiviteten selv. I denne profilen telles **fri slakk** i kalenderen til etterfølgeren.

Hva en forsinkelse presis er, beskrives i [Legge til avhengigheter](docs://howto-relaties-leggen). Hva slakk er, beskrives i [Kritisk linje og slakk](docs://uitleg-kritiek-pad).

### I Gantt

Den grå bakgrunnen i Gantt viser alltid ikke-arbeidsdagene i **prosjektkalenderen**. En aktivitet på en egen kalender kan derfor gå over en grå dag, for eksempel en aktivitet på seks dager over lørdagen. En blokk med helligdager på tre dager eller mer får navnet vist, for eksempel *Bouwvak (Noord)*. Dette skjer ikke når *Vis bare arbeidsdager* er på. Vil du ikke se de grå dagene i det hele, slå på *Vis bare arbeidsdager* under *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Utseende*, overskriften *Tidsakse*.

## Eksempel: tidsplanen for bygget

Eksemplet bruker standardkalenderen *Bouwkalender NL*: mandag til fredag, med de nederlandske offentlige helligdagene. Alle aktiviteter varer et helt antall dager. I opplæringen om kalendere (opplæring 3) bygger du selv en slik kalender.

### Helg, helligdag og byggferie

*Brickwork* varer 5 arbeidsdager og begynner torsdag 13. mai 2027. Torsdag 13. og fredag 14. mai er dag 1 og 2. Helgen og annen pinsedag, 17. mai, telles ikke. Tirsdag 18., onsdag 19. og torsdag 20. mai er dag 3, 4 og 5. Aktiviteten er ferdig **torsdag 20. mai**: åtte kalenderdager for fem arbeidsdager.

En byggferie gjør forskjellen større. Ta *Bouwvak (Noord)*, fra 26. juli til og med 13. august 2027, og den samme aktiviteten på 5 arbeidsdager fra fredag 23. juli. Fredag 23. juli er dag 1. Deretter står kalenderen stille i tre uker. Mandag 16. til torsdag 19. august er dag 2 til 5. Ferdig er **torsdag 19. august**, 28 kalenderdager etter start. Uten byggferien hadde det vært torsdag 29. juli.

### En aktivitet på lørdag

Tre aktiviteter følger på hverandre, alle med en slutt-til-start-avhengighet uten forsinkelse: *Groundwork* (4 dager), *Pour foundation* (3 dager) og *Brickwork* (5 dager). Prosjektstart er mandag 24. mai 2027.

Står alle tre på prosjektkalenderen, går *Groundwork* fra mandag 24. til torsdag 27. mai. *Pour foundation* går fra fredag 28. mai til tirsdag 1. juni (fredag, mandag, tirsdag). *Brickwork* går fra onsdag 2. juni til tirsdag 8. juni. Prosjektslutt er **tirsdag 8. juni**.

Gi *Pour foundation* kalenderen *Six-day week* (mandag til lørdag), så teller lørdagen. Aktiviteten går fra fredag 28. mai til **mandag 31. mai** (fredag, lørdag, mandag). *Brickwork* blir på prosjektkalenderen, starter tirsdag 1. juni og er ferdig **mandag 7. juni**. Hele prosjektet er én dag kortere, fordi én aktivitet arbeider på lørdag.

### En forsinkelse over to kalendere

*Pour floor* (kalenderen Six-day week, 4 dager) begynner mandag 31. mai og er ferdig torsdag 3. juni. *Pointing* (prosjektkalenderen, 3 dager) følger med en forsinkelse på 2 arbeidsdager. Uten forsinkelsen hadde *Pointing* startet fredag 4. juni.

- Som standard telles forsinkelsen i kalenderen til forgjengeren, altså *Six-day week*. Fra fredag 4. juni er lørdag 5. juni den første arbeidsdagen og mandag 7. juni den andre. *Pointing* starter **mandag 7. juni** og er ferdig onsdag 9. juni.
- Setter du *Forsinkelseskalender* til *Etterfølger*, telles prosjektkalenderen. Lørdag telles da ikke: mandag 7. juni er den første arbeidsdagen og tirsdag 8. juni den andre. *Pointing* starter **tirsdag 8. juni** og er ferdig torsdag 10. juni.

### Slakk i sin egen kalender

*Brickwork* (5 dager, prosjektkalenderen) og *Crane hire* (3 dager, Six-day week) starter begge mandag 24. mai. Begge er forgjengere til *Fit window frames* (2 dager, prosjektkalenderen).

*Brickwork* er ferdig fredag 28. mai, så *Fit window frames* starter mandag 31. mai. *Crane hire* er allerede ferdig onsdag 26. mai. Totalslakken til *Crane hire* telles i sin egen kalender: torsdag 27., fredag 28. og lørdag 29. mai, altså **3 arbeidsdager**. Hadde *Crane hire* stått på prosjektkalenderen, hadde det vært 2 arbeidsdager. Fri slakk er 2 arbeidsdager (torsdag og fredag), fordi appen teller den i kalenderen til etterfølgeren.

### Kalenderen til en ressurs

I et annet eksempelprosjekt har ressursen *Bricklaying crew* kalenderen *Crew Mon–Thu* (mandag til torsdag). Den er tildelt med 1 tildelingsenhet per dag til *Brickwork* (5 dager, prosjektkalenderen, fra mandag 31. mai til fredag 4. juni).

Datoene til *Brickwork* endrer seg ikke. Men fredag 4. juni er rød i histogrammet, med meldingen *Arbeider ikke denne dagen i følge kalenderen “Crew Mon–Thu”*, og båndet melder én ressurs under *Overallokering*. Utjevning løser ikke dette. Å flytte hjelper heller ikke, for fem arbeidsdager på rad inneholder alltid en fredag. I vinduet *Utjevning av ressurser* står aktiviteten derfor under *Gjenstående konflikter*, med årsaken *Ressursen arbeider ikke alle dagene denne aktiviteten trenger. Flytting løser ikke dette.*

## Konsekvenser og misforståelser

**«Kalenderen til ressursen flytter aktivitetene mine.»** Nei. En ressurskalender endrer ingen dato i det hele tatt. Den gjør bare overallokering synlig. Vil du at aktiviteten selv skal gå på andre dager, gi aktiviteten en egen kalender.

**«Hvis jeg bytter prosjektkalender, flytter alt seg.»** Bare aktiviteter uten egen kalender flytter seg. En aktivitet du selv har gitt en kalender fra listen, beholder den, også om det tilfeldigvis er den gamle prosjektkalenderen. Sletter du en kalender, går aktivitetene og ressursene som brukte den over til prosjektkalenderen.

**«Helligdagene er med, ikke sant?»** Helligdager finnes bare for de årene de ble laget for. En dag utenfor disse årene er bare en arbeidsdag. I kalenderdialogen sier appen det med *Helligdagene dekker 2025–2028; vil du generere på nytt til og med 2030?*

**«Flere timer per dag gjør aktiviteten min kortere.»** Ikke for en aktivitet i dager: den teller hele arbeidsdager, enten dagen har 6 eller 8 timer. Bare for en aktivitet med ressurser og aktivitetstypen *Fast arbeid* eller *Faste enheter* endrer varigheten seg med timene.

**En kalender uten arbeidsdager** kan ikke beregnes av appen. Beregningen melder *Kalenderen har ingen arbeidsdager angitt*.

## Se også

- [Dager og timer](docs://uitleg-dagen-en-uren): hvordan appen teller arbeidstimer, og hva som skjer når dagbaserte aktiviteter og timebaserte aktiviteter møtes.
- [Opprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen): stegene for å lage en egen kalender og gi den til aktiviteter.
- [Generere helligdager og byggferie](docs://howto-feestdagen-genereren): hvordan du fyller inn helligdagene i et land og byggferien.
- [Sette opp en ressurskalender](docs://howto-resourcekalender-instellen): å registrere når en ressurs er tilgjengelig.
- [Kalendervinduene](docs://ref-kalenders): alle felt i kalendervinduene.
