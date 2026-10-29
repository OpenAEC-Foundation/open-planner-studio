# Kalendere og arbejdsdage

Hvor mange arbejdsdage tager en opgave, og på hvilken dato er den færdig? Det afhænger af den kalender, appen tæller i. I denne artikel læser du, hvad en kalender er, hvordan appen tæller arbejdsdage med den, og hvilken kalender der gælder, når der er mere end én. Det gennemregnede eksempel hjælper dig med at følge tallene.

## Begrebet

En tidsplan tæller i **arbejdsdage**, ikke i kalenderdage. "Fem dages murerarbejde" betyder fem dage, hvor der arbejdes. En weekend eller en offentlig helligdag tæller ikke med. Så en sådan opgave strækker sig over mere end fem kalenderdage.

Hvilke dage der er arbejdsdage, står i en **kalender**. En kalender fastlægger tre ting:

- **Arbejdsugen**: ugedagene, hvor der arbejdes. Som standard er det mandag til fredag.
- **Arbejdstiden**: start, slut og pause. De giver de **nettotimer per dag**. Som standard er det 07:00 til 16:00 med en times pause, altså 8 timer.
- **Helligdagene**: enkelte dage eller hele perioder, hvor der ikke arbejdes, fx Kongedag, jul eller **byggeferien**.

Et projekt har ét bibliotek med kalendere. En af dem er **projektkalenderen**. Den gælder for alle opgaver, der ikke har en egen kalender. Du giver en anden kalender til en enkelt opgave, fx en seksdages arbejdsuge for en underleverandør, der også arbejder lørdag. En ressource kan også have sin egen kalender, men den gør noget andet (se nedenfor).

## Sådan beregner appen

Denne artikel beskriver standardberegningen: beregningsprofilen *Open Planner Studio*, som et nyt projekt beregner med.

### Optælling af arbejdsdage

Den første arbejdsdag af en opgave tæller som dag 1. En opgave på 5 dage slutter derfor på den femte arbejdsdag. Hvis starten falder på en ikke-arbejdsdag, begynder opgaven på den næste arbejdsdag. En helligdag eller byggeferie midt i en opgave tæller ikke: opgaven løber bare hen over den og bliver længere i kalenderen.

Timerne per dag spiller ingen rolle for datoerne for en opgave i dage. Kun arbejdsugen og helligdagene tæller. Arbejdstiden får først betydning for en opgave i timer. Det står i [Dage og timer](docs://uitleg-dagen-en-uren).

### Hvilken kalender gælder

Appen vælger én kalender per opgave:

1. Har opgaven en egen kalender, beregner appen opgaven helt i den kalender: varighed, slutdato og slæk.
2. Har den ingen, gælder projektkalenderen. Peger en opgave på en kalender, der ikke længere findes, falder den også tilbage på projektkalenderen.

En hovedopgave (en fase) har ikke noget arbejde selv og dermed ingen egen kalender. Dens varighed følger af datoerne for dens opgaver, og appen tæller den på projektkalenderen.

Kalenderen for en **ressource** spiller ingen rolle for datoerne. I en tidsplan, du selv bygger i appen, bepaler den kun, hvornår ressourcen er tilgængelig: i histogrammet, ved overallokering og ved udjævning.

### Opgaver på forskellige kalendere

Når to opgaver med forskellige kalendere er sammenkædet, gælder dette:

- Med en afhængighed af typen slut til start begynder den efterfølgende opgave på den første arbejdsdag efter slutdatoen for den foregående opgave, talt i kalenderen for den **efterfølgende opgave**. Slutter en opgave på en fredag, begynder en efterfølgende opgave med en seksdages arbejdsuge på lørdag.
- En **forsinkelse** tælles som standard i kalenderen for den **foregående opgave**. Det kan du ændre under *Indstillinger › Projekt › Projektindstillinger*, i blokken *Beregningsprofil og beregningsindstillinger*, under *Beregningsindstillinger for dette projekt*, med valget *Forsinkelseskalender*: *Foregående opgave* (standard), *Efterfølgende opgave*, *24-timers* eller *Projektkalender*.
- Den **samlede slæk** tælles i arbejdsdage i kalenderen for opgaven selv. I denne profil tælles den **tilladte slæk** i kalenderen for den efterfølgende opgave.

Hvad en forsinkelse præcist er, står i [Tilføjelse af afhængigheder](docs://howto-relaties-leggen); hvad slæk er, i [Kritisk vej og slæk](docs://uitleg-kritiek-pad).

### I Gantt-diagrammet

Den grå baggrund i Gantt viser altid de ikke-arbejdsdage i **projektkalenderen**. En opgave med sin egen kalender kan derfor løbe hen over en grå dag, fx en seksdages opgave hen over lørdagen. En række helligdage på tre dage eller mere får sit navn vist, fx *Bouwvak (Noord)*. Det sker ikke, når *Vis kun arbejdsdage* er slået til. Vil du slet ikke se de grå dage, så slå *Vis kun arbejdsdage* til under *Indstillinger › Projekt › App-indstillinger*, fanen *Udseende*, overskriften *Tidsakse*.

## Gennemregnet eksempel: tidsplanen for byggeriet

Eksemplet bruger standardkalenderen *Bouwkalender NL*: mandag til fredag, med de nederlandske offentlige helligdage. Alle opgaver varer et helt antal dage. I selvstudiet om kalendere (selvstudium 3) bygger du selv sådan en kalender.

### Weekend, helligdag og byggeferie

*Brickwork* varer 5 arbejdsdage og starter torsdag den 13. maj 2027. Torsdag den 13. og fredag den 14. maj er dag 1 og 2. Weekenden og pinsemandag, 17. maj, tæller ikke. Tirsdag den 18., onsdag den 19. og torsdag den 20. maj er dag 3, 4 og 5. Opgaven slutter **torsdag den 20. maj**: otte kalenderdage for fem arbejdsdage.

En byggeferie gør forskellen større. Tag *Bouwvak (Noord)*, fra 26. juli til og med 13. august 2027, og den samme opgave på 5 arbejdsdage fra fredag den 23. juli. Fredag den 23. juli er dag 1. Derefter står kalenderen stille i tre uger. Mandag den 16. til torsdag den 19. august er dag 2 til 5. Slutdatoen er **torsdag den 19. august**, 28 kalenderdage efter starten. Uden byggeferien var det blevet torsdag den 29. juli.

### En opgave på lørdag

Tre opgaver følger efter hinanden, alle med en afhængighed af typen slut til start uden forsinkelse: *Groundwork* (4 dage), *Pour foundation* (3 dage) og *Brickwork* (5 dage). Projektet starter mandag den 24. maj 2027.

Hvis alle tre bruger projektkalenderen, løber *Groundwork* fra mandag den 24. til torsdag den 27. maj. *Pour foundation* løber fra fredag den 28. maj til tirsdag den 1. juni (fredag, mandag, tirsdag). *Brickwork* løber fra onsdag den 2. juni til tirsdag den 8. juni. Projektet slutter **tirsdag den 8. juni**.

Giv *Pour foundation* kalenderen *Six-day week* (mandag til lørdag), så tæller lørdagen med. Opgaven løber fra fredag den 28. maj til **mandag den 31. maj** (fredag, lørdag, mandag). *Brickwork* bliver på projektkalenderen, starter tirsdag den 1. juni og slutter **mandag den 7. juni**. Hele projektet er en dag kortere, fordi én opgave arbejder lørdag.

### En forsinkelse over to kalendere

*Pour floor* (six-day week, 4 dage) starter mandag den 31. maj og slutter torsdag den 3. juni. *Pointing* (projektkalender, 3 dage) følger med en forsinkelse på 2 arbejdsdage. Uden forsinkelsen ville *Pointing* starte fredag den 4. juni.

- Som standard tælles forsinkelsen i kalenderen for den foregående opgave, altså six-day week. Fra fredag den 4. juni er lørdag den 5. juni den første arbejdsdag, og mandag den 7. juni den anden. *Pointing* starter **mandag den 7. juni** og slutter onsdag den 9. juni.
- Sætter du *Forsinkelseskalender* til *Efterfølgende opgave*, tæller projektkalenderen. Lørdag tæller så ikke: mandag den 7. juni er den første arbejdsdag, og tirsdag den 8. juni den anden. *Pointing* starter **tirsdag den 8. juni** og slutter torsdag den 10. juni.

### Slæk i sin egen kalender

*Brickwork* (5 dage, projektkalender) og *Crane hire* (3 dage, six-day week) starter begge mandag den 24. maj. Begge er foregående opgaver til *Fit window frames* (2 dage, projektkalender).

*Brickwork* slutter fredag den 28. maj, så *Fit window frames* starter mandag den 31. maj. *Crane hire* er allerede færdig onsdag den 26. maj. Den samlede slæk for *Crane hire* tælles i dens egen kalender: torsdag den 27., fredag den 28. og lørdag den 29. maj, så **3 arbejdsdage**. Hvis *Crane hire* lå på projektkalenderen, ville det have været 2 arbejdsdage. Den tilladte slæk er 2 arbejdsdage (torsdag og fredag), fordi appen tæller den i kalenderen for den efterfølgende opgave.

### Kalenderen for en ressource

I et andet eksempelprojekt har ressourcen *Bricklaying crew* kalenderen *Crew Mon–Thu* (mandag til torsdag). Den er tildelt 1 tildelingsenhed per dag til *Brickwork* (5 dage, projektkalender, fra mandag den 31. maj til fredag den 4. juni).

Datoerne for *Brickwork* ændres ikke. Men fredag den 4. juni er rød i histogrammet, med meldingen *Arbejder ikke denne dag ifølge kalender "Crew Mon–Thu"*, og båndet viser én ressource under *Overallokering*. Udjævning løser ikke dette. Forskydning hjælper heller ikke, for fem arbejdsdage i træk indeholder altid en fredag. I vinduet *Udjævn ressourcer* står opgaven derfor under *Resterende konflikter*, med årsagen *Ressourcen arbejder ikke på alle de dage, opgaven kræver — forskydning løser ikke dette*.

## Konsekvenser og misforståelser

**"Ressourcekalenderen flytter mine opgaver."** Nej. En ressourcekalender ændrer ingen dato. Den gør kun overallokering synlig. Vil du have, at opgaven selv løber på andre dage, så giv opgaven sin egen kalender.

**"Hvis jeg skifter projektkalenderen, flytter alt sig."** Kun opgaver uden egen kalender flytter med. En opgave, du selv har givet en kalender fra listen, beholder den, også selv om det er den gamle projektkalender. Sletter du en kalender, falder de opgaver og ressourcer, der brugte den, tilbage på projektkalenderen.

**"Helligdagene er da med, ikke?"** Helligdage findes kun for de år, de er oprettet for. En dag uden for de år er bare en arbejdsdag. I dialogboksen for kalenderen siger appen det med *Helligdage dækker 2025–2028; generér igen til og med 2030?*

**"Flere timer per dag gør min opgave kortere."** Ikke for en opgave i dage: den tæller hele arbejdsdage, uanset om dagen har 6 eller 8 timer. Kun for en opgave med ressourcer og opgavetypen *Fast arbejde* eller *Faste enheder* ændrer varigheden sig med det.

**En kalender uden arbejdsdage** kan ikke beregnes af appen. Beregningen viser *Kalenderen har ingen arbejdsdage angivet*.

## Se også

- [Dage og timer](docs://uitleg-dagen-en-uren): hvordan appen tæller arbejdstimer, og hvad der sker, når dagopgaver og timeopgaver mødes.
- [Oprettelse og tildeling af en kalender](docs://howto-kalender-maken-en-toewijzen): trinene til at lave en egen kalender og give den til opgaver.
- [Generering af helligdage og byggeferie](docs://howto-feestdagen-genereren): udfyldning af helligdage for et land og byggeferien.
- [Opsætning af ressourcekalender](docs://howto-resourcekalender-instellen): registrering af, hvornår en ressource er tilgængelig.
- [Kalendervinduer](docs://ref-kalenders): alle felter i kalendervinduerne.
