# Afhængigheder og forsinkelse

Hvorfor starter murværket først, når fundamentet er lagt? Og hvorfor glider monteringen af taget en uge, når tagelementerne leveres for sent? Det skyldes afhængighederne mellem dine opgaver. I denne artikel læser du, hvilke fire typer afhængigheder appen kender. Du læser også, hvad forsinkelse og forskud gør, i hvilken kalender en forsinkelse tæller, og hvad der sker med en afhængighed på en fase. Til sidst læser du, hvordan appen afgør, hvilken afhængighed der bestemmer en opgaves startdato.

Reglerne og eksemplerne gælder for et nyt projekt. Projektet bruger beregningsprofilen *Open Planner Studio* og en arbejdsuge fra mandag til fredag.

## Begrebet

En **afhængighed** betyder, at to opgaver afhænger af hinanden. Den første opgave er den **foregående opgave**. Den anden opgave er den **efterfølgende opgave**. En afhængighed er en nedre grænse. Den efterfølgende opgave kan aldrig starte eller slutte tidligere, end afhængigheden tillader. Den kan dog starte eller slutte senere. Har en opgave flere foregående opgaver, venter den til den seneste dato fra alle disse afhængigheder.

Der findes fire typer. De adskiller sig i, hvilket tidspunkt for den foregående opgave (start eller slut) der er knyttet til hvilket tidspunkt for den efterfølgende opgave:

- **FS (slut til start).** Den efterfølgende opgave starter først, når den foregående opgave er færdig. Tagelementerne monteres først, når væggene er rejst. Dette er langt den mest brugte type.
- **SS (start til start).** Den efterfølgende opgave starter først, når den foregående opgave er startet. Opgaverne må overlappe: rørarbejdet kan starte, så snart murværket er i gang.
- **FF (slut til slut).** Den efterfølgende opgave kan først blive færdig, når den foregående opgave er færdig. Fugningen kan ikke blive færdig, før murværket er færdigt, men den må gerne starte tidligere.
- **SF (start til slut).** Den efterfølgende opgave slutter først, når den foregående opgave er startet. Denne type er sjælden. Et eksempel: den midlertidige grundvandssænkning må først stoppe, når murværket på fundamentet er startet.

En afhængighed kan også have en **forsinkelse**: ventetid mellem de to opgaver, for eksempel beton, der skal hærde. Er forsinkelsen negativ, kaldes den et **forskud**. Den efterfølgende opgave starter så, før den foregående opgave er færdig. De to opgaver overlapper så.

## Sådan beregner appen

### De fire typer

Appen beregner for hver afhængighed den tidligste dato, hvor den efterfølgende opgave kan starte. Den bruger den seneste af alle afhængighederne på en opgave. Uden forsinkelse virker det sådan:

- Ved FS starter den efterfølgende opgave på den første arbejdsdag efter den foregående opgaves slutdato.
- Ved SS starter den efterfølgende opgave samme dag som den foregående opgave.
- Ved FF slutter den efterfølgende opgave samme dag som den foregående opgave. For at finde startdatoen tæller appen baglæns over varigheden af den efterfølgende opgave. En efterfølgende opgave på 3 arbejdsdage starter derfor 2 arbejdsdage før den foregående opgaves slutdato.
- Ved SF slutter den efterfølgende opgave den dag, hvor den foregående opgave starter. Også her tæller appen baglæns over varigheden af den efterfølgende opgave.

Disse er nedre grænser. En efterfølgende opgave starter senere, hvis en anden afhængighed eller en begrænsning kræver det. Datoerne vises først efter **Beregn** (F5). Så længe statuslinjen viser *Forældet — genberegn (F5)*, hører bjælkerne til den forrige beregning.

### Forsinkelse og forskud

Du kan angive en forsinkelse på fire måder:

- I **arbejdsdage** (`3` eller `3d`): appen springer fridage og weekender over. Dette er standardvalget.
- I **kalenderdage** (`3ed`; e står for *elapsed*, dvs. forløbet tid): hver dag tæller, også lørdag og søndag. Denne enhed bruges til noget, der fortsætter uden at der udføres arbejde, for eksempel hærdning.
- Som en **procentdel** af den foregående opgaves varighed (`40%`): appen beregner det igen ved hver beregning og runder af til hele dage (2,5 dage bliver 3).
- I **arbejdstimer** (`4h`): appen tæller forsinkelsen i forsinkelseskalenderen. Som standard er det den kalender for den foregående opgave. Er den foregående opgave en dagopgave på en kalender uden egne tidsbånd, for eksempel standardkalenderen, omregner appen timerne til hele arbejdsdage. Den runder af til nærmeste hele dag (en halv dag rundes op). Med en arbejdsdag på 8 timer giver `2h` og `3h` derfor 0 dage. `4h` til og med `11h` giver 1 dag, og `12h` giver 2 dage. Har den kalender egne tidsbånd, eller er den foregående opgave en timeopgave, tæller forsinkelsen præcis i arbejdstimer.

Reglen for en forsinkelse på N arbejdsdage med FS: de N arbejdsdage efter den foregående opgaves slutdato er ventetid. Den efterfølgende opgave starter på den arbejdsdag efter dem. Ved SS og FF lægges forsinkelsen til henholdsvis den foregående opgaves start og slut. Et forskud tæller baglæns. Et forskud på 1 arbejdsdag med FS lader den efterfølgende opgave starte den dag, den foregående opgave slutter.

Et forskud kan ikke sætte en opgave før projektstartdatoen. Ville det ske, holder appen den efterfølgende opgave på projektstartdatoen. Appen melder det i panelet *Advarsler*: *Forskud afkortet af projektstartdatoen. Afhængigheden er ikke fuldt udnyttet*.

### I hvilken kalender forsinkelsen tæller

Hver opgave kan have sin egen kalender. Ved en forsinkelse i arbejdsdage betyder det noget, hvilken kalender der tæller arbejdsdagene. Indstillingen *Forsinkelseskalender* bestemmer det. Der er fire valg: *Foregående opgave*, *Efterfølgende opgave*, *24-timers* og *Projektkalender*. Som standard tæller forsinkelsen i kalenderen for den **foregående opgave**. Du finder indstillingen under *Indstillinger › Projekt › Projektindstillinger*, i blokken *Beregningsprofil og beregningsindstillinger*, ved *Beregningsindstillinger for dette projekt*. Valget hører til projektfilen. Det gælder kun, når du klikker på *Anvend*. Derefter genberegnes tidsplanen.

En forsinkelse i kalenderdage (`3ed`) tæller altid alle dage, uanset hvilken *Forsinkelseskalender* du vælger.

### Afhængigheder på hovedopgaver

Du kan sætte en afhængighed på en fase (en hovedopgave) i stedet for på en opgave i fasen. Internt lægger appen afhængigheden på hver opgave i fasen:

- En fase som **foregående opgave** med FS eller FF: den efterfølgende opgave venter, til den sidste opgave i fasen er færdig.
- En fase som **efterfølgende opgave** med FS eller SS: hver opgave i fasen venter på den foregående opgave, uafhængigt af de andre opgaver i fasen.
- En fase som **foregående opgave** med SS eller SF: den efterfølgende opgave venter på starten af den opgave i fasen, der starter **sidst**, og ikke på starten af fasen selv. Det er mere forsigtigt, end du måske forventer: den efterfølgende opgave starter aldrig for tidligt, men muligvis senere, end du mener. Vil du have, at den efterfølgende opgave følger starten af fasen, så sæt afhængigheden på den første opgave i fasen.
- En fase som **efterfølgende opgave** med FF eller SF: hver opgave i fasen skal selv opfylde kravet om slut. Med FF skal den slutte på eller efter den foregående opgaves slutdato. Med SF skal den slutte på eller efter den foregående opgaves start. Det gælder endda en opgave, der kunne være udført meget tidligere. Sæt hellere en sådan afhængighed på den sidste opgave i fasen.

En afhængighed mellem en opgave og den fase, den ligger under, er ikke tilladt.

### Bestemmende afhængigheder

Har en efterfølgende opgave flere foregående opgaver, bestemmer normalt én afhængighed startdatoen. Det er den afhængighed, der forhindrer, at den efterfølgende opgave starter en enkelt dag tidligere, end den gør nu. En sådan afhængighed kaldes **bestemmende**. Ved lighed er der flere bestemmende afhængigheder. Du genkender en bestemmende afhængighed på lynsymbolet i kolonnerne *Foregående opgaver* og *Efterfølgende opgaver* i tabellen. Du genkender den også på kolonnen *Bestemmende afhængighed* (**+**-tegnet til højre i tabelhovedet, under *Afhængigheder*). Og du genkender den på den stærkere farve, når du følger en sti. Hvordan du åbner den sti, står i [Sporing af en sti](docs://howto-pad-traceren).

Bestemmende afhængighed siger noget om datoer, ikke om varighed. Også en kort foregående opgave kan være bestemmende, for eksempel på grund af en lang forsinkelse. Det ser du i eksemplet nedenfor.

## Gennemregnet eksempel

Eksemplerne bruger aparte mini-projekter. Alle starter mandag den 7. juni 2027, medmindre andet er angivet. Begreber som kritisk vej og slæk forklares i [Kritisk vej og slæk](docs://uitleg-kritiek-pad). At bygge et netværk af afhængigheder selv og kontrollere det er det, du gør i selvstudium 2, "Afhængigheder og den kritiske vej".

### De fire typer side om side

*Pour foundation* tager 5 arbejdsdage: fra mandag 7. til fredag 11. juni. *Build walls* (5 arbejdsdage) følger med FS og løber fra mandag 14. til fredag 18. juni. Fire opgaver på hver 3 arbejdsdage hænger under *Build walls*, hver med en anden type:

- *Place roof elements* (FS) starter mandag 21. juni, den første arbejdsdag efter murværket, og er færdig onsdag 23. juni.
- *Pipework* (SS) starter mandag 14. juni, sammen med murværket, og er færdig onsdag 16. juni.
- *Pointing* (FF) skal være færdig fredag 18. juni, sammen med murværket. Med 3 arbejdsdage starter den derfor onsdag 16. juni.
- *Dewatering* (SF) skal slutte mandag 14. juni, den dag murværket starter. Når man tæller 3 arbejdsdage baglæns (torsdag 10., fredag 11. og mandag 14. juni), starter den torsdag 10. juni.

Kun *Place roof elements* ligger på den kritiske vej. Projektet er færdigt onsdag 23. juni. *Pipework*, *Pointing* og *Dewatering* har henholdsvis 5, 3 og 7 arbejdsdage slæk.

### Forsinkelse og forskud i tal

*Pour foundation* er færdig fredag 18. juni. *Build walls* (2 arbejdsdage) følger med FS. Her er effekten af forsinkelsen på startdatoen:

- Uden forsinkelse starter murværket mandag 21. juni.
- Med forsinkelsen `3` (tre arbejdsdage) er mandag 21., tirsdag 22. og onsdag 23. juni ventetid. Murværket starter torsdag 24. juni.
- Med forsinkelsen `3ed` (tre kalenderdage) tæller lørdag, søndag og mandag. Murværket starter tirsdag 22. juni.
- Med forsinkelsen `-1` (et forskud på én arbejdsdag) starter murværket fredag 18. juni, den dag støbningen er færdig.
- Med forsinkelsen `40%` er forsinkelsen 40% af 5 arbejdsdage, altså 2 arbejdsdage. Murværket starter onsdag 23. juni.
- Med forsinkelsen `50%` er forsinkelsen 2,5 arbejdsdage, afrundet til 3 arbejdsdage. Murværket starter torsdag 24. juni.

### Hvilken kalender tæller forsinkelsen

*Build walls* (4 arbejdsdage) ligger på projektkalenderen (mandag til fredag) og er færdig torsdag 10. juni. *Pointing* (2 arbejdsdage) følger med FS og forsinkelsen `3`. Den ligger på en kalender, hvor lørdag og søndag også er arbejdsdage. Så afhænger startdatoen af *Forsinkelseskalender*:

- *Foregående opgave* (standard): forsinkelsen tæller i murværkets kalender. Fredag 11., mandag 14. og tirsdag 15. juni er ventetid. Fugningen starter onsdag 16. juni.
- *Efterfølgende opgave*: forsinkelsen tæller i fugningens kalender. Fredag 11., lørdag 12. og søndag 13. juni er ventetid. Fugningen starter mandag 14. juni.
- *24-timers*: hver kalenderdag tæller. Også her er fredag, lørdag og søndag ventetid. Fugningen starter mandag 14. juni.
- *Projektkalender*: forsinkelsen tæller i projektkalenderen, ligesom ved *Foregående opgave*. Fugningen starter onsdag 16. juni.

### Afhængigheder på en fase

*Foundation* er en fase med to opgaver: *Excavate* (2 arbejdsdage, mandag 7. og tirsdag 8. juni) og derefter *Pour* (3 arbejdsdage, onsdag 9. til fredag 11. juni). *Build walls* følger fasen *Foundation* med FS og starter mandag 14. juni. Appen får den til at vente på *Pour*, den sidste opgave, der er færdig.

Ved en fase som efterfølgende opgave: *Permit* (3 arbejdsdage, færdig onsdag 9. juni) går med FS til fasen *Struktur*. Fasen indeholder *Build walls* (4 arbejdsdage) og derefter *Lay floor* (2 arbejdsdage). Hver opgave i fasen venter på *Permit*: *Build walls* starter torsdag 10. juni og er færdig tirsdag 15. juni. *Lay floor* venter også på murværket og løber fra onsdag 16. til torsdag 17. juni.

Ved SS fra en fase: fasen *Finishing* indeholder *Plastering* (2 arbejdsdage, 7. og 8. juni), derefter *Painting* (3 arbejdsdage, 9. til 11. juni) og derefter *Snagging* (2 arbejdsdage, 14. og 15. juni). *Cleaning* følger fasen med SS. Du ville forvente en start mandag 7. juni. Men appen får *Cleaning* til at vente på starten af *Snagging*, den opgave, der starter sidst: mandag 14. juni.

### Hvad er en bestemmende afhængighed

*Pour foundation* (2 arbejdsdage) løber fra mandag 7. til tirsdag 8. juni. Der følger to grene:

- *Build walls* (5 arbejdsdage): onsdag 9. til tirsdag 15. juni.
- *Order roof elements* (2 arbejdsdage): onsdag 9. og torsdag 10. juni.

*Place roof elements* (3 arbejdsdage) følger begge: med FS efter murværket, og med FS og forsinkelsen `5` efter bestillingen (leveringstiden). Fra murværket kan placeringen starte onsdag 16. juni. Fra bestillingen er fredag 11., mandag 14., tirsdag 15., onsdag 16. og torsdag 17. juni ventetid. Placeringen starter fredag 18. juni. Afhængigheden med bestillingen er derfor en bestemmende afhængighed, selv om bestillingen er meget kortere end murværket. Murværket har 2 arbejdsdage slæk.

## Konsekvenser og misforståelser

**"En afhængighed låser opgaverne."** Nej, en afhængighed er en nedre grænse. En efterfølgende opgave starter tidligst på den dato, afhængigheden giver. Den starter senere, hvis en anden afhængighed eller en begrænsning kræver det. Hvordan begrænsninger passer ind, forklares i [Begrænsninger og deadlines](docs://uitleg-constraints).

**"SS betyder, at opgaverne starter samtidig."** SS siger kun, at den efterfølgende opgave ikke må starte før den foregående opgave. Har den efterfølgende opgave en anden foregående opgave, der slutter senere, starter den senere.

**"Ved FF starter den efterfølgende opgave samme dag."** Nej, ved FF falder slutdatoerne sammen. En kort efterfølgende opgave starter derfor senere end den foregående opgave, ligesom fugningen i eksemplet.

**"En forsinkelse i dage tæller kalenderdage."** Som standard tæller en forsinkelse arbejdsdage, i den foregående opgaves kalender. Til hærdning eller tørring, hvor weekenden også tæller med, bruger du kalenderdage (`ed`).

**"En opgave uden afhængigheder er ikke et problem."** En opgave uden foregående opgave starter på sin planlagte startdato. En opgave uden efterfølgende opgave får slæk op til projektets slutdato. Glemmer du en afhængighed, ser en opgave derfor ud til at have god plads. Se misforståelserne i [Kritisk vej og slæk](docs://uitleg-kritiek-pad).

**"En afhængighed på en fase er én afhængighed."** For beregningen er det én afhængighed pr. opgave i fasen. Flytter du opgaver ind i en fase eller ud af den, ændrer de afhængigheder, der gælder for opgaverne, sig også.

## Se også

- [Oprettelse af afhængigheder](docs://howto-relaties-leggen): trinene til at sammenkæde opgaver og angive en forsinkelse.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad appen beregner ud fra dine afhængigheder, og hvorfor en opgave bliver kritisk.
- [Begrænsninger og deadlines](docs://uitleg-constraints): datoaftaler ved siden af afhængighederne.
- [Sporing af en vej](docs://howto-pad-traceren): så kæden før eller efter en opgave bliver synlig.
- [Oprettelse af en hængekøje](docs://howto-hammock): en opgave med en afledt varighed, hængt op på afhængigheder af typen SS og FF.
- [Eksterne afhængigheder til et andet projekt](docs://howto-externe-relaties): afhængigheder med en opgave i en anden projektfil.
