# Beregningsprofiler og konventioner

Den samme tidsplan kan give forskellige datoer, afhængigt af hvilke beregningsregler du bruger. Denne artikel forklarer, hvorfor Primavera P6 og Microsoft Project beregner forskelligt på nogle punkter, hvordan appen registrerer forskellen i en **beregningsprofil**, og hvordan en profil adskiller sig fra de beregningsindstillinger, du selv vælger pr. projekt. Et arbejdseksempel med et lille netværk viser, hvad det betyder for datoerne.

## Begrebet

Opgaver, afhængigheder og en kalender bestemmer det meste af en tidsplan, men ikke alt. Hvad sker der med arbejde, der ikke er startet, når du sætter en statusdato? Hvor begynder det resterende arbejde på en opgave, der allerede er i gang? Hvad er en opgaves tilladte slæk, når en deadline overskrides? Netværket siger intet om det. Et tidsplanprogram skal vælge en regel for det. Appen kender en række punkter, hvor reglen i Primavera P6 og reglen i Microsoft Project er forskellige.

Appen kalder et sådant valg en **konvention**. En **beregningsprofil** er samlingen af konventioner, der hører til ét program. Appen har tre:

- *Open Planner Studio*: profilen, som et nyt projekt beregnes med. Ingen konvention er slået til.
- *Primavera P6*: de konventioner, appen kender fra P6.
- *Microsoft Project*: de konventioner, appen kender fra Microsoft Project.

Så profilen siger, hvordan et program beregner. Hvad du vil have for dit projekt, er ikke en del af den. Det er **beregningsindstillinger**: valg som hvor lidt slæk der gør en opgave kritisk, eller i hvilken kalender en forsinkelse tæller. Du sætter dem pr. projekt.

## Sådan beregner appen

### Konventioner og beregningsindstillinger

En konvention er en afbryder: til eller fra. Profilen bestemmer, hvilke afbrydere der er til. En beregningsindstilling er et valg, du selv træffer. Du kan se forskellen i appen selv, i blokken *Beregningsprofil og beregningsindstillinger*:

- **Konventioner** står under *Konventioner i denne profil*, grupperet efter emne, for eksempel *Fremdrift og færdiggjort arbejde*, *Afhængigheder og forsinkelse* og *Slæk og seneste datoer*. Denne del er først klappet sammen. Overskriften viser, hvor mange konventioner der er. Afviger profilen, står der også et mærke *ændret: 1*. Klik på overskriften for at folde den ud. Med en indbygget profil har hver linje et mærke *TIL* eller *FRA*. Disse værdier er kun til information og kan ikke ændres. Med en egen profil har hver linje et afkrydsningsfelt, med basisværdien efter sig (*basis: til* eller *basis: fra*). Hvis dit valg afviger, fremhæves linjen, og *Gendan basis* vises. Ikonet *i* efter en linje åbner forklaringen af konventionen. Peg på det med musen, gå til det med Tab, eller tryk på det. Læs forklaringen først, hvis du vil ændre en konvention. Virker en konvention kun ved timeplanlægning, eller kun på opgaver fra en .xer-fil, så viser et blåt mærke ved siden af det: *kun ved timeplanlægning* eller *kun opgaver fra .xer*. Timeplanlægning betyder: en kalender med tidsbånd, en opgave hvis varighed er i timer, eller *Forsinkelseskalender* sat til *24-timers*. Et projekt med kun en dagkalender og opgaver i dage mærker intet af en konvention med mærket *kun ved timeplanlægning*, medmindre *Forsinkelseskalender* er sat til *24-timers*. Så tæller en forsinkelse i timer, og en konvention om forsinkelse kan ændre noget.
- **Beregningsindstillinger** står under *Beregningsindstillinger for dette projekt*: blandt andet *Definition af kritisk*, *Slækberegning*, *Opgaver med åben ende er kritiske*, *Markér næsten kritisk* og *Forsinkelseskalender*. De siger, hvad du vil have for dit projekt, ikke hvordan et program beregner. Hvad de gør, forklares i [Kritisk vej og slæk](docs://uitleg-kritiek-pad) og [Afhængigheder og forsinkelse](docs://uitleg-relaties).

Et eksempel på hver. »En opgave er kritisk, hvis dens samlede slæk er 0 eller mindre« er en beregningsindstilling: du kan sætte grænseværdien til 4. Så er alt med 4 arbejdsdage slæk eller mindre kritisk. »Arbejde, der ikke er startet, flytter sig til statusdatoen« er en konvention: Open Planner Studio og Primavera P6 gør det, Microsoft Project gør ikke.

Profilen og beregningsindstillingerne hører til projektfilen, ikke til appen. Gemmer du projektet, følger de med. To projekter i samme app kan derfor beregnes med forskellige profiler. Et projekt uden profil beregnes som Open Planner Studio.

Kommer dit projekt fra en .xer-fil, så viser blokken nederst også *Indstillinger fra kildefilen*. Der står beregningsindstillinger, som kun Primavera kender, og som filen har med. Du kan ikke ændre dem her. Knappen til standardindstillingerne og en anden profil lader dem også være, som de er. Et nyt projekt har ikke dem, heller ikke med *Primavera P6*.

### Hvor du vælger profilen

For et nyt projekt står profilen i vinduet *Nyt projekt*, som du åbner via *Start › Fil › Ny*. *Beregningsprofil* er en rulleliste. Vælger du en profil der, erstatter appen de beregningsindstillinger, du allerede har udfyldt, med standardindstillingerne for profilen. Kun indstillinger fra en kildefil bliver stående. Med *Primavera P6* står *Slækberegning* så på *Slutslæk*. Med *Microsoft Project* og *Open Planner Studio* står hver beregningsindstilling på sin standard, så *Slækberegning* er *Automatisk (standard)*. Med en statusdato er det også sådan, Microsoft Project selv beregner: en startet opgave får slutslæk, og alle andre opgaver får den mindste af start- og slutslæk.

For et eksisterende projekt vælger du profilen under *Indstillinger › Projekt › Projektindstillinger*, i blokken *Beregningsprofil og beregningsindstillinger*, i rullelisten *Beregningsprofil*. Du kommer også til samme sted via *Fil › Projektindstillinger*. Skift af profil ændrer kun konventionerne. Dine beregningsindstillinger bliver, som de er. Afviger dine beregningsindstillinger fra profilens standard, så viser en orange blok over indstillingerne det. Det er ofte med vilje, for eksempel fordi indstillingerne kommer fra den åbnede fil. Vil du alligevel have standarden, så vælg *Brug standardindstillingerne for …* i blokken. Krydset skjuler blokken for denne åbnede fil.

Til du trykker på *Anvend*, findes en ændring kun i formularen. Med *Anvend* genberegner appen tidsplanen med det samme, også selv om *Beregn automatisk* er slået fra. Er der opgaver flyttet, siger appen hvor mange, for eksempel *Efter anvendelsen er 4 opgaver forskudt.* Hele skiftet er ét trin for *Fortryd*. Trykker du på *Fortryd* eller *Gentag*, mens Projektindstillinger er åben, følger blokken projektets tilstand. Har du selv ændret noget i blokken, bliver dit valg stående, og en gul blok siger, at *Anvend* sætter det valg tilbage.

De tre indbyggede profiler kan ikke ændres. Vil du have andre konventioner, så laver du en egen profil. Du kan også gemme den som skabelon til andre projekter i denne app. Projektet har altid sin egen kopi: ændrer du skabelonen senere, ændres projektet ikke med. Stegene står i [Vælg eller opbyg en beregningsprofil](docs://howto-rekenprofiel-kiezen).

### Hvornår appen selv vælger en profil

Når du åbner en fil, foreslår appen en profil ud fra formatet:

- En .mpp-fil (Microsoft Project) åbnes med profilen *Microsoft Project*.
- En .xer-fil (Primavera P6) åbnes med profilen *Primavera P6*.
- En fil i formatet *MS Project XML*, *Primavera P6 XML* eller *CSV (semikolonsepareret)* åbnes med *Open Planner Studio*, uden besked om profil.
- Dit eget projekt (.ifc) åbnes med den profil, der er gemt i det.

For en .mpp-fil eller en .xer-fil melder appen profilen: *Dit projekt beregnes som Microsoft Project. Ændr det via Fil → Projektinfo → Beregningsprofil og beregningsindstillinger.* Knappen *Åbn beregningsprofil* i meddelelsen tager dig direkte til Projektindstillinger. For en .xer-fil er denne linje den første detaljelinje i filens åbningsbesked. Mere om meddelelsen står i [Åbn en Primavera P6-fil (.xer)](docs://howto-xer-openen) og [Åbn en MS Project-fil (.mpp)](docs://howto-mpp-openen).

For en .mpp-fil sætter appen kun profilen. Beregningsindstillingerne forbliver tomme, ligesom i et nyt projekt med profilen *Microsoft Project*: *Slækberegning* er *Automatisk (standard)*. En åbnet .mpp-fil og et nyt projekt med *Microsoft Project* beregner derfor slæk på samme måde.

## Arbejdseksempel: ét netværk, tre profiler

Eksemplet er et lille netværk. Kalenderen har en arbejdsuge fra mandag til fredag og ingen fridage i disse uger. Fremdriftsmetoden er Retained Logic (standard). Projektet starter mandag den 7. juni 2027. Alle opgaver er i arbejdsdage.

- *Pour foundation*: 5 arbejdsdage, planlagt fra mandag den 7. juni.
- *Lay walls*: 5 arbejdsdage, efter *Pour foundation* (slut til start).
- *Order window frames*: 3 arbejdsdage, ingen foregående opgave, planlagt fra mandag den 7. juni.
- *Fit roof*: 2 arbejdsdage, efter *Lay walls* og efter *Order window frames*. Slutdatoen for denne opgave er overdragelsen.

Tallene er beregnet med appens beregningsmotor. Du læser dem i panelet *Egenskaber* under *CPM-resultat*.

**Uden statusdato og uden fremdrift beregner de tre profiler dette netværk ens.** *Pour foundation* kører fra mandag den 7. til fredag den 11. juni, *Lay walls* fra mandag den 14. til fredag den 18. juni, og *Fit roof* mandag den 21. og tirsdag den 22. juni. Overdragelsen er tirsdag den 22. juni. *Order window frames* (mandag den 7. til onsdag den 9. juni) har 7 arbejdsdage samlet slæk.

Nu registrerer du fremdriften. Statusdatoen er onsdag den 9. juni. Fundamentet er startet mandag den 7. juni og står på 60 %. Det resterende arbejde er derfor 2 arbejdsdage (5 × 40 %). *Order window frames* er ikke startet. Hvordan [fremdrift og statusdato](docs://uitleg-voortgang) virker, står i den artikel. Her er spørgsmålet, hvad profilen gør med det.

### Open Planner Studio

Det resterende arbejde på fundamentet starter på statusdatoen: onsdag den 9. og torsdag den 10. juni. Den tidligste startdato forbliver den faktiske startdato, mandag den 7. juni. Den tidligste slutdato er torsdag den 10. juni. *Lay walls* kører fra fredag den 11. til torsdag den 17. juni, og *Fit roof* fredag den 18. og mandag den 21. juni.

*Order window frames* var planlagt til mandag den 7. juni, men er ikke startet. Arbejde, der ikke er startet, kan ikke ligge i fortiden. Derfor flytter appen det til statusdatoen: onsdag den 9. til fredag den 11. juni, med 4 arbejdsdage samlet slæk. Overdragelsen er mandag den 21. juni.

### Primavera P6

Alt er det samme som i Open Planner Studio, bortset fra ét punkt: den tidligste startdato for *Pour foundation* er onsdag den 9. juni. Det er startdatoen for det resterende arbejde, ikke den faktiske startdato. Det gør konventionen *Igangværende opgave: tidligste startdato = start på resterende arbejde* i gruppen *Fremdrift og færdiggjort arbejde*. Slutdatoen og slækken ændres ikke af det. Overdragelsen er mandag den 21. juni.

### Microsoft Project

Her er datoerne anderledes. To konventioner i gruppen *Fremdrift som i Microsoft Project* er årsag til det.

*Flyt ikke ikke-startede opgaver til statusdatoen*: *Order window frames* forbliver fra mandag den 7. til onsdag den 9. juni, selv om det delvist ligger før statusdatoen. Den samlede slæk er 7 arbejdsdage.

*Resterende arbejde genoptages efter forløbet varighed*: Det resterende arbejde begynder tidligst på statusdatoen, og ikke tidligere end den faktiske startdato plus den forløbne varighed. Ved 60 % af 5 arbejdsdage er 3 arbejdsdage udført. Mandag den 7. juni plus 3 arbejdsdage er torsdag den 10. juni. Det ligger efter statusdatoen, så det resterende arbejde kører torsdag den 10. og fredag den 11. juni. *Lay walls* kører fra mandag den 14. til fredag den 18. juni, og *Fit roof* mandag den 21. og tirsdag den 22. juni. Overdragelsen er tirsdag den 22. juni: én arbejdsdag senere end i de to andre profiler.

### Hvad hvis

**Fundamentet står på 20 % i stedet for 60 %.** Det resterende arbejde er så 4 arbejdsdage. Under alle tre profiler er fundamentet færdigt mandag den 14. juni, og overdragelsen er onsdag den 23. juni. Microsoft Project-konventionen for det resterende arbejde gør ingen forskel her: mandag den 7. juni plus 1 forløbet arbejdsdag er tirsdag den 8. juni, og det ligger før statusdatoen. En sådan konvention er en nedre grænse, som kun kan gøre det resterende arbejde senere. *Order window frames* og den tidligste startdato under Primavera P6 er stadig forskellige, som ovenfor. Under Microsoft Project har *Order window frames* så 8 arbejdsdage samlet slæk.

**Du sætter kun en statusdato og indtaster ingen fremdrift.** Under Open Planner Studio og Primavera P6 flyttes hele netværket til onsdag den 9. juni. Fundamentet kører så fra onsdag den 9. til tirsdag den 15. juni, og overdragelsen bliver torsdag den 24. juni: to arbejdsdage senere end uden statusdato. Under Microsoft Project bliver alt stående, hvor det var, og overdragelsen er tirsdag den 22. juni.

**Du sætter selv en profil sammen.** Under Open Planner Studio laver du en egen profil med *Ny profil* og *Kopi af Open Planner Studio*, og slår i den kun *Flyt ikke ikke-startede opgaver til statusdatoen* til. Med 60 % fremdrift beholder fundamentet datoerne fra Open Planner Studio (slutdato torsdag den 10. juni, overdragelse mandag den 21. juni). *Order window frames* bliver dog fra mandag den 7. til onsdag den 9. juni, med 6 arbejdsdage samlet slæk. En profil er altså en samling af enkelte afbrydere, som du kan ændre én for én.

**En beregningsindstilling i stedet for en konvention.** Sætter du *Definition af kritisk* (*Samlet slæk ≤ grænseværdi*) til en *Grænseværdi (arbejdsdage)* på 4 under Open Planner Studio, bliver *Order window frames* kritisk, fordi dens samlede slæk er præcis 4. Ingen dato ændres. En beregningsindstilling er dit eget valg for projektet og står uafhængigt af profilen.

**En deadline, der overskrides.** Giv *Fit roof* en deadline på fredag den 18. juni. Under Open Planner Studio er den samlede slæk for *Fit roof* så −1 arbejdsdag, og den tilladte slæk er også −1. Under Primavera P6 forbliver den samlede slæk −1, men den tilladte slæk bliver 0. Det gør konventionen *Tilladt slæk aldrig negativ* i gruppen *Slæk og seneste datoer*. Under Microsoft Project er begge −2, fordi overdragelsen der falder en dag senere. Hvordan en deadline virker, står i [Begrænsninger og deadlines](docs://uitleg-constraints).

## Konsekvenser og misforståelser

**"Profilen er en indstilling i appen."** Nej. Profilen og beregningsindstillingerne hører til projektet og følger med i filen. Kun de skabeloner, du gemmer, hører til appen. Et projekt har altid sin egen kopi.

**"Hvis jeg eksporterer, følger min profil med."** Kun med dit eget projektformat (.ifc). Hvis du eksporterer til *MS Project XML*, *Primavera P6 XML* eller *CSV (semikolonsepareret)*, er profilen ikke med i filen. Af beregningsindstillingerne skriver MS Project XML-eksporten højst den kritiske grænseværdi. Appen advarer kun om dette for et projekt, der kommer fra en .xer-fil. For et projekt, du selv har lavet, får du ingen besked. Filen åbnes som et Open Planner Studio-projekt, uden en besked om profilen. Tag eksemplet med profilen Microsoft Project og 60 % fremdrift. Eksporterer du den til *MS Project XML* og åbner den igen, viser appen først datoerne fra filen, med overdragelsen tirsdag den 22. juni. Lader du appen genberegne selv, bliver det mandag den 21. juni. Hvad en eksport ellers mister, står i [Filer og formater](docs://uitleg-bestanden).

**"Primavera P6-profilen giver det samme resultat som P6."** Appen kan ikke love det. Profilen slår de konventioner til, som appen kender fra P6, og de er ikke alle indstillingerne i P6. Ud over Retained Logic og Progress Override har P6 en tredje fremdriftsmetode, Actual Dates. Appen kender den ikke. En sådan .xer-fil beregnes som Retained Logic, og åbningsbeskeden melder det, for eksempel som *1 P6-planindstilling brugte en sikker reserve.* Nogle konventioner i Primavera P6-profilen virker også kun på opgaver, der kommer fra en .xer-fil, for eksempel *Ikke-startet LOE bruger målvinduet* og *Overtag faktiske datoer præcist*. For nogle af dem siger forklaringen det: "kun opgaver med P6-herkomst". På opgaver, du selv laver, gør de konventioner ingenting.

**"Fremdriftsmetoden er en del af profilen."** Nej. Retained Logic eller Progress Override er et separat valg for hvert projekt. Du angiver det adskilt fra profilen, se [Valg af fremdriftsmetode](docs://howto-voortgangsmodus-kiezen). Én Primavera P6-konvention, *Progress Override ignorerer også en startet efterfølgende opgave baglæns*, gør kun noget under Progress Override.

**"Jeg skifter bare profil for at se, hvad der sker."** Det kan du, for *Anvend* kan fortrydes i ét trin med *Fortryd*: profil og datoer går tilbage sammen. Men datoerne kan virkelig flytte sig. I eksemplet flytter skiftet fra Open Planner Studio til Microsoft Project alle 4 opgaver. Beskeden tæller dem for dig. Kig på tidsplanen bagefter, før du går videre. Viser appen stadig datoerne fra filen efter åbning af en .xer-fil eller .mpp, så forlader et profilskift den visning, og appen beregner selv. Hvordan det virker, står i [Datoer som gemt](docs://uitleg-datums-zoals-opgeslagen).

**Eksemplet viser fire konventioner, og listen i appen er længere.** Hver linje i blokken har sin egen forklaring. Læs den først. Kig også på gruppen *Kun egne profiler*: de konventioner er slået fra i alle indbyggede profiler, også i Primavera P6. Kun en egen profil kan slå dem til. Lav en med *Ny profil*.

## Se også

- [Valg eller opbygning af en beregningsprofil](docs://howto-rekenprofiel-kiezen): vælg, skift eller byg en beregningsprofil.
- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvad statusdatoen og det resterende arbejde gør, med forskellene per profil.
- [Valg af fremdriftsmetode](docs://howto-voortgangsmodus-kiezen): at vælge Retained Logic eller Progress Override.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): beregningsindstillingerne for kritisk og slæk.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): beregningsindstillingen *Forsinkelseskalender*.
- [Filer og formater](docs://uitleg-bestanden): hvad en eksport medbringer, og hvad den ikke gør.
- [Eksport](docs://howto-exporteren): eksport af et projekt.
- [Opdater fremdrift](docs://howto-voortgang-bijwerken): indtast procent, faktisk startdato og statusdato.
- [Datoer som gemt](docs://uitleg-datums-zoals-opgeslagen): hvorfor importerede datoer kan afvige fra det, appen selv beregner.
- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): alle konventioner og beregningsindstillinger på én liste.
