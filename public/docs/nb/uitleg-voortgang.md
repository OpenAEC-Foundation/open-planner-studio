# Fremdrift, statusdato og grunnlinje

En tidsplan er en prognose. Når arbeidet er i gang, vil du vite hva som er ferdig, hva som fortsatt må gjøres, og hva dette betyr for overleveringen. Denne artikkelen forklarer hvordan appen behandler fremdrift: hva statusdatoen gjør, hvordan appen beregner gjenstående arbeid, hvorfor en aktivitet som allerede er startet, noen ganger fortsatt venter på forgjengeren, og hvordan du sammenligner den nåværende situasjonen med den opprinnelige avtalen. Et utregnet eksempel viser tallene.

## Begrepet

**Fremdrift** er det som faktisk har skjedd. For hver aktivitet registrerer appen tre ting: en prosentandel, en **faktisk start** og en **faktisk slutt**. Det tidsplanen forutsa, står ved siden av. Det faktiske er det som virkelig skjedde.

**Statusdatoen** er dagen du gjør en statusvurdering. Alt som skjedde før den dagen, er et faktum. Alt som fortsatt må skje, planlegger appen fra starten av den dagen. En faktisk dato kan være på statusdatoen, men aldri etter den.

**Gjenstående arbeid** er det som er igjen å gjøre på en aktivitet. En aktivitet på 4 arbeidsdager som er 25% ferdig, har 3 arbeidsdager med gjenstående arbeid.

En **grunnlinje** er et øyeblikksbilde av tidsplanen på et bestemt tidspunkt, vanligvis det tidspunktet avtalen ble godkjent. Senere legger du den faktiske tidsplanen ved siden av og ser hvor mye utførelsen avviker.

## Slik beregner appen

Eksemplet under bruker beregningsprofilen *Open Planner Studio*, som et nytt prosjekt beregnes med. Lenger fram kan du lese hva som er annerledes i profilene for Primavera P6 og Microsoft Project.

Appen omberegner ikke av seg selv. Etter hver endring av fremdrift eller statusdato viser statuslinjen *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Hvis *Beregne automatisk* er på (under *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*, overskriften *Beregning*), gjør appen dette selv.

### Statusdatoen

Statusdatoen gjør tre ting.

For det første godtar appen ikke en faktisk dato etter statusdatoen. En dato på statusdatoen selv er greit.

For det andre kan arbeid som ikke har startet, ikke ligge i fortiden. Hvis en slik aktivitet er planlagt før statusdatoen, flytter appen den til statusdatoen. Det gjelder også aktivitetene etter den, som flytter med via avhengighetene. Du ser effekten i eksemplet under. I Microsoft Project-profilen gjør appen ikke dette.

For det tredje begynner det gjenstående arbeidet på en aktivitet som allerede kjører, på statusdatoen selv. Appen regner statusdatoen som starten av den dagen. Hvis du gjør status fredag etter arbeidstid, setter du statusdatoen til mandag. Setter du den til fredag, planlegger appen fortsatt det gjenstående arbeidet den fredagen.

Hvis du ikke har en statusdato ennå og du registrerer fremdrift, setter appen statusdatoen til i dag og sier fra om det. En annen dato setter du under *Tidsplan › Grunnlinjer og fremdrift › Statusdato*. Uten statusdato regner appen en kjørende aktivitet fremover med gjenstående varighet, men bakover med hele varigheten. Slakken blir da negativ, og aktiviteten ser kritisk ut uten grunn.

### Prosent, faktiske datoer og gjenstående varighet

Feltene er avhengige av hverandre. Når du fyller ut ett felt, fyller appen ut de andre.

- En prosent over 0 betyr at aktiviteten er startet. Gir du ingen faktisk start, tar appen den planlagte starten. Er aktiviteten planlagt til å starte etter statusdatoen, spør appen først når den faktisk startet.
- En prosent på 100 betyr fullført. Gir du ingen faktisk slutt, blir den statusdatoen, selv om arbeidet i virkeligheten var ferdig tidligere.
- En faktisk slutt gjør aktiviteten til 100%. Setter du en fullført aktivitet tilbake under 100%, slettes den faktiske slutten. Sletter du den faktiske slutten, settes prosenten til 0, og aktiviteten forblir *Pågår* til du også sletter den faktiske starten.
- Den **gjenstående varigheten** er varigheten ganger det som gjenstår, avrundet til hele arbeidsdager. For en aktivitet på 2 arbeidsdager gir både 0% og 25% 2 arbeidsdager med gjenstående arbeid, og 50% og 75% gir 1. Ved 90% runder appen av til 0: det gjenstående arbeidet er da ferdig på statusdatoen. En aktivitet i timer telles i hele minutter: en aktivitet på 5 timer med 40% har 3 timer med gjenstående arbeid.
- En milepæl har bare én faktisk dato.
- En fase (hovedaktivitet) har ingen egen fremdrift. Etter beregning følger prosenten av aktivitetene under den: det vektede gjennomsnittet av deres prosenter, med varigheten i arbeidsdager som vekt. En milepæl veier 0.

Endrer du varigheten av en aktivitet som allerede kjører, blir det utførte arbeidet stående som utført. Prosenten tilpasser seg: en aktivitet på 5 arbeidsdager med 60% som du setter til 10 arbeidsdager, ender på 30%. Appen godtar ikke en varighet som er kortere enn arbeidet som allerede er gjort.

### Fullførte og kjørende aktiviteter

En fullført aktivitet er låst til sine faktiske datoer. Den flytter ikke lenger, og med en statusdato er den aldri kritisk. Uten statusdato kan en fullført aktivitet fortsatt være kritisk.

En kjørende aktivitet beholder sin faktiske start. Bare det gjenstående arbeidet flytter seg. Hvor det gjenstående arbeidet begynner, avhenger av fremdriftsmodusen.

### Retained Logic og Progress Override

Hva gjør appen hvis en aktivitet allerede er startet, mens forgjengeren fortsatt kjører? En slik avhengighet kalles **fremdrift utenfor rekkefølge**: fremdriften strider mot rekkefølgen. Tenk på maleren som allerede begynner i et rom som er pusset, mens pusseren fortsatt jobber et annet sted.

To fremdriftsmoduser bestemmer hvordan appen regner det ut:

- **Retained Logic** (standard): avhengigheten gjelder fortsatt. Det gjenstående arbeidet på etterfølgeren følger avhengigheten: med slutt-til-start starter det først når forgjengeren er ferdig, og aldri før statusdatoen.
- **Progress Override**: virkeligheten vinner. Det gjenstående arbeidet på etterfølgeren starter på statusdatoen, uten å vente på forgjengeren.

I denne profilen ligger forskjellen bare i det gjenstående arbeidet på aktiviteter som allerede er startet, mens forgjengeren ikke er ferdig. Andre aktiviteter regnes likt i begge moduser. Appen rapporterer en slik avhengighet i begge moduser: i statuslinjen som *1 avhengighet(er) utenfor rekkefølge* og i panelet *Advarsler*.

### Grunnlinjer og avvik

Når du lagrer, registrerer appen for hver aktivitet uten delaktiviteter den tidligste starten, den tidligste slutten, varigheten og milepæltypen. Faser er ikke med. Det du endrer senere, rører ikke grunnlinjen. Du kan ha flere grunnlinjer. Nøyaktig én er **aktiv**. Gantt, avviksrapporten og fremdriftsrapporten bruker den aktive grunnlinjen.

**Avviket** er forskjellen i arbeidsdager mellom grunnlinjen og den nåværende tidsplanen. Et pluss betyr senere, et minus tidligere. Appen teller i prosjektets kalender. Avviksrapporten gir avviket for start og slutt per aktivitet. Statusen følger bare av sluttdatoen: *Forsinket* ved pluss, *Tidligere* ved minus, ellers *Etter tidsplan*. En aktivitet som er lagt til etter grunnlinjen, heter *Ny*. En aktivitet som ikke finnes lenger, er *Fjernet*.

To merknader. Varighetsavviket står i aktivitetstabellen (kolonnen *Varighetsavvik*), ikke i Avviksrapporten. Det sammenligner den planlagte varigheten av aktiviteten nå med den i grunnlinjen. Fremdrift endrer ikke den planlagte varigheten. En aktivitet som var planlagt til to dager og tok tre dager, har derfor et sluttavvik på +1, men et varighetsavvik på 0. Og lagrer du en grunnlinje etter at fremdrift er registrert, legger den inn tilstanden med de faktiske datoene. Avviket er da null.

Fremdriftsrapporten viser den planlagte fremdriften ved siden av den faktiske fremdriften. Begge er vektet etter arbeidsdager. Planlagt er den delen av hver aktivitet som skulle vært ferdig på statusdatoen ifølge grunnlinjen. Faktisk er prosenten som ble registrert.

### Hvor du ser det

I Gantt står en stiplet linje for statusdatoen, med datoen i overskriften. På hver kjørende aktivitet bøyer linjen seg ut til punktet i stolpen som prosenten angir. Det er **fremdriftslinjen**. Slår du av fremdriftslinjen og lar statusdatolinjen stå på, blir det en rett linje. Er begge av, forsvinner linjen og etiketten. Knappene *Grunnlinjeoverlegg*, *Fremdriftslinje* og *Statusdatolinje* ligger under *Visning › Grunnlinjer og fremdrift*. De endrer ingenting i beregningen. Grunnlinjen vises som en tynn stolpe under hver aktivitetsstolpe. Aktivitetstabellen har kolonner for fremdrift og, per grunnlinje, for avvik. På fanen *Rapport* finner du rapporttypene *Avvik* og *Fremdriftsrapport*.

## Utregnet eksempel: tilbygget etter tre uker

Eksemplet er øvingsprosjektet *House extension* fra opplæringene, i tilstanden etter at alle avhengigheter er lagt inn: uten byggferie, ressurser eller timer. I opplæring 6 gjør du dette selv i øvingsprosjektet. Det prosjektet har da mer innhold, så tallene der er annerledes. Her leser du hvorfor tallene er som de er.

Tilbygget starter mandag 7. juni 2027. I den beregnede tidsplanen lagrer appen en grunnlinje med navnet *Grunnlinje*: overlevering fredag 6. august 2027, 45 arbeidsdager.

### Situasjonen mandag 28. juni

Statusdatoen er mandag 28. juni 2027. Dette har skjedd:

- *Start of construction*, *Set up site*, *Clear garden and paving* og *Set out the extension* er ferdige etter planen, fra 7. til 10. juni.
- *Excavate foundation trench* var planlagt til 2 arbeidsdager (fredag 11. og mandag 14. juni) og tok 3: fra 11. til 15. juni.
- *Foundation formwork and reinforcement* går fra 16. til 18. juni. *Reinforcement inspection* er 18. juni, *Pour foundation* mandag 21. juni.
- *Foundation brickwork* (2 arbeidsdager) startet fredag 25. juni og er på 50%.

Etter **Beregn** regner appen slik ut:

- Det gjenstående arbeidet på *Foundation brickwork* er 2 × (1 − 0,5) = 1 arbeidsdag. Det starter på statusdatoen, så det er ferdig mandag 28. juni.
- *Lay hollow-core floor* følger tirsdag 29. juni. Derfor starter *Build inner cavity leaf* onsdag 30. juni i stedet for tirsdag 29. juni. Overleveringen kommer mandag 9. august: én arbeidsdag senere enn grunnlinjen. Den ene ekstra dagen på utgravingen gjør derfor hele prosjektet én dag senere, fordi den aktiviteten lå på den kritiske linjen.
- Statuslinjen melder *Kritisk linje: 13 aktiviteter, 46 arbeidsdager*, mot 21 aktiviteter og 45 arbeidsdager før fremdriften. De åtte fullførte aktivitetene som lå på den kritiske linjen, telles ikke lenger.
- Fasen *Foundations* er på 77,8%. Aktivitetene i den veier 2 + 3 + 1 + 2 + 1 = 9 arbeidsdager. Ferdig er 2 + 3 + 1 arbeidsdager, pluss halvparten av 2: 7 i alt. Og 7 av 9 er 77,8%. Milepælen *Reinforcement inspection* veier 0.

Avviksrapporten setter dette ved siden av grunnlinjen:

- *Excavate foundation trench*: start 0, slutt +1 (grunnlinjens slutt 14. juni, nå 15. juni).
- *Foundation brickwork*: start +1 (24. juni ble 25. juni), slutt +1.
- *Build outer cavity leaf*: +1, +1. Den aktiviteten er fortsatt ikke kritisk: den hadde 2 arbeidsdager med slakk og beholder dem.
- *Handover*: +1. Prosjektslutten avviker med 1 arbeidsdag.
- I alt står 19 aktiviteter på *Forsinket* og 4 på *Etter tidsplan*; ingen står på *Tidligere*.

Fremdriftsrapporten viser *Planlagt* 28,3% og *Faktisk* 23,9%. Aktivitetene veier 46 arbeidsdager sammen. Ifølge grunnlinjen skulle 13 vært ferdig: 4 arbeidsdager i forberedelsen, 2 for utgravingen, 3 for armeringen, 1 for støpingen, 2 for foundation brickwork og 1 for hollow-core floor. Faktisk er 11 ferdig: 4 + 2 + 3 + 1, pluss 1 arbeidsdag for foundation brickwork (halvparten av 2 arbeidsdager).

### Hva skjer hvis du flytter statusdatoen?

Samme fremdrift, en annen statusdato. Det gjenstående arbeidet på foundation brickwork starter alltid på statusdatoen, så overleveringen flytter med den:

- Statusdato fredag 25. juni: det gjenstående arbeidet faller på fredag 25. juni, overleveringen forblir fredag 6. august.
- Mandag 28. juni: overlevering mandag 9. august.
- Tirsdag 29. juni: overlevering tirsdag 10. august, 2 arbeidsdager senere enn grunnlinjen.

### Hva skjer hvis du endrer prosenten?

Foundation brickwork har 2 arbeidsdager. Ved 0% eller 25% er det gjenstående arbeidet 2 arbeidsdager: det er ferdig tirsdag 29. juni, og overleveringen blir tirsdag 10. august. Ved 50% eller 75% er det 1 arbeidsdag: mandag 28. juni, overlevering mandag 9. august. Ved 90% er det gjenstående arbeidet 0, og aktiviteten er ferdig på statusdatoen.

### Hva skjer hvis du setter en statusdato uten å registrere fremdrift?

Hvis du bare setter statusdatoen til mandag 28. juni og ikke registrerer noe, har ifølge tidsplanen ingenting skjedd ennå. Arbeid som ikke har startet, kan ikke ligge i fortiden. Appen flytter derfor alt til 28. juni: *Start of construction* ligger da på den dagen, og overleveringen kommer fredag 27. august, 15 arbeidsdager etter grunnlinjen. Registrer derfor først den fremdriften som finnes.

## Arbeidseksempel: pusser og maler

Nå kommer et eksempel på fremdriftsmodus. Samme tilbygg, men en annen tilstand: det er onsdag 21. juli 2027. Alt til og med *Install building services* er ferdig etter planen. *Plastering* (4 arbeidsdager) startet tirsdag 20. juli og er på 25%. *Painting* (3 arbeidsdager) følger etter *Plastering*, men maleren har allerede startet i dag og er på 33%.

Uten fremdrift var *Plastering* planlagt fra tirsdag 20. til fredag 23. juli. *Painting* var planlagt fra mandag 26. til onsdag 28. juli. Statuslinjen melder nå *1 avhengighet(er) utenfor rekkefølge*: *Painting* er startet, mens *Plastering* ikke er ferdig. I panelet *Advarsler* står det: *Utenfor rekkefølge: fremdriften til etterfølgeren strider mot avhengigheten*.

*Plastering* har 4 × (1 − 0,25) = 3 arbeidsdager gjenstående arbeid: 21., 22. og 23. juli. *Painting* har 3 × (1 − 0,33) = 2 arbeidsdager gjenstående arbeid.

- Med **Retained Logic** kan det gjenstående arbeidet bare starte når *Plastering* er ferdig. Det er fredag 23. juli. *Painting* starter derfor mandag 26. juli og er ferdig tirsdag 27. juli. Stolpen går fra den faktiske starten 21. juli til 27. juli. Totalslakken er 7 arbeidsdager.
- Med **Progress Override** starter det gjenstående arbeidet på statusdatoen. *Painting* er ferdig torsdag 22. juli, før *Plastering* er ferdig. Totalslakken er 10 arbeidsdager.

Overleveringen blir fredag 6. august i begge tilfeller: *Painting* hadde uansett slakk.

### Andre beregningsprofiler

I profilene Primavera P6 og Microsoft Project er *Painting* i dette eksemplet ferdig på samme datoer (27. og 22. juli). De skiller seg på følgende punkter. Dette er beregningsregler i profilen. Du finner dem under *Innstillinger › Prosjekt › Prosjektinnstillinger*, i blokken *Beregningsprofil og beregningsalternativer*.

- I Microsoft Project-profilen flyttes aktiviteter som ikke er startet, ikke til statusdatoen (beregningsregel *Ikke-startede aktiviteter flyttes ikke til statusdatoen*). Hvis du i eksemplet over bare setter en statusdato og ikke registrerer noe, blir overleveringen i den profilen fredag 6. august.
- I Microsoft Project-profilen starter det gjenstående arbeidet heller ikke tidligere enn den faktiske starten pluss den forløpte tiden (beregningsregel *Gjenstående arbeid fortsetter etter forløpt tid*). Det er en ekstra nedre grense ved siden av statusdatoen: den seneste av de to gjelder. Tenk deg aktiviteten *Build inner cavity leaf* (5 arbeidsdager). Den er startet tirsdag 29. juni og er på 40% onsdag 30. juni, som er statusdatoen. To mannskaper murer samtidig, så 40% er allerede gjort etter én dag. Alt før den er ferdig etter planen. Open Planner Studio og Primavera P6 lar aktiviteten bli ferdig fredag 2. juli. Microsoft Project lar den bli ferdig mandag 5. juli, fordi tirsdag 29. juni pluss 2 forløpte arbeidsdager er torsdag 1. juli, etter statusdatoen.
- Primavera P6 viser som tidligste start for en pågående aktivitet starten på det gjenstående arbeidet, ikke den faktiske starten (i eksemplet med *Build inner cavity leaf* onsdag 30. juni). Kolonnen *Start* og stolpen viser i alle profiler den faktiske starten.
- I Primavera P6-profilen teller også ikke avhengigheten til en etterfølger som allerede er startet, for forgjengeren når du bruker Progress Override. Den begrenser ikke lenger forgjengerens seneste datoer og fri slakk (beregningsregel *Progress Override ignorerer en startet etterfølger også bakover*). I eksemplet med pusser og maler ser du ikke dette, fordi *Plastering* uansett er kritisk via gulvavrettingen. De seneste datoene og den fri slakken er like under Retained Logic og Progress Override.
- Når du åpner en .xer-fil, henter appen fremdriftsmodusen fra filen. Actual Dates, den tredje P6-modusen, kjenner appen ikke. En slik fil regnes som Retained Logic.

## Konsekvenser og misforståelser

**«Jeg flytter bare statusdatoen.»** Hvis du flytter den, starter det gjenstående arbeidet for pågående aktiviteter på den nye datoen. Aktiviteter som ikke er startet ennå, kan aldri ligge før den datoen. Flytt derfor statusdatoen bare sammen med en oppdatering av fremdriften.

**«Å sette 100% registrerer den faktiske slutten.»** Bare hvis du også registrerer faktisk slutt. Hvis du setter en aktivitet til 100% uten faktisk slutt, blir faktisk slutt lik statusdatoen. Var aktiviteten faktisk ferdig tidligere, fyll inn faktisk slutt.

**«0% betyr ikke startet.»** Har en aktivitet en faktisk start, regnes den som startet, også på 0%. Det gjenstående arbeidet er da hele varigheten og starter på statusdatoen. Tøm faktisk start for at aktiviteten igjen skal regnes som ikke startet.

**«Progress Override løser advarselen.»** Meldingen om fremdrift utenfor rekkefølge blir stående. Modusen bestemmer bare hvordan appen beregner. Hvis avhengigheten ikke lenger er riktig, endrer du avhengigheten.

**«Pausen i en delt aktivitet faller bort.»** Nei: en pause i delen som gjenstår, blir værende i det gjenstående arbeidet. Tenk deg en aktivitet på 5 arbeidsdager med en pause på 1 dag etter 2 dagers arbeid. Den er startet tirsdag 29. juni. Med statusdatoen onsdag 30. juni er den på 40%. Det gjenstående arbeidet på 3 arbeidsdager starter på statusdatoen og går gjennom pausen. Slutten er mandag 5. juli. Uten pausen var den fredag 2. juli.

**Timer og statusdatoen.** Du kan ikke skrive inn et klokkeslett i båndet. Du fyller inn statusdatoen som dato. Gjør du status etter arbeidstid, setter du statusdatoen til neste arbeidsdag. En aktivitet i timer beregner det gjenstående arbeidet fra starten av statusdatoen. Tenk deg *Lay hollow-core floor* i øvelsesprosjektet etter opplæring 4, på det punktet der alt før den er ferdig: 5 timer, mandag 28. juni, arbeidsdag fra 07:00. Med statusdatoen mandag 28. juni og aktiviteten på 40% har den 3 timer gjenstående arbeid, fra 07:00 til 10:00. Det gjelder selv om det allerede er gjort arbeid den morgenen. Hvordan appen teller timer, står forklart i [Dager og timer](docs://uitleg-dagen-en-uren).

**Oppdatere grunnlinjen.** Det er ikke mulig. Du lagrer en ny og sletter den gamle. Hvis du flytter prosjektet, flytter de faktiske datoene og statusdatoen seg med. Grunnlinjene gjør det som standard ikke. Slik blir forskyvningen synlig som avvik. Se [Flytte et prosjekt](docs://howto-project-verplaatsen).

## Se også

- [Oppdatere fremdrift](docs://howto-voortgang-bijwerken): sette statusdatoen og registrere fremdrift.
- [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren): lese inn fremdrift fra byggeplassen i én omgang.
- [Velge fremdriftsmodus](docs://howto-voortgangsmodus-kiezen): sette Retained Logic eller Progress Override.
- [Lagre og administrere en grunnlinje](docs://howto-baseline-opslaan-en-beheren): registrere en grunnlinje og bruke den.
- [Flytte et prosjekt](docs://howto-project-verplaatsen): hva som skjer med faktiske datoer, statusdatoen og grunnlinjer.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvorfor en aktivitet er kritisk, og hva slakk betyr.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): fremdrift og en statusdato midt i prosjektet (20. mai 2027).
