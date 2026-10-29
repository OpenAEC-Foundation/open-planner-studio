# Beregningsprofiler og beregningsregler

Den samme tidsplanen kan gi ulike datoer, avhengig av hvilke regler for beregning du bruker. Denne artikkelen forklarer hvorfor Primavera P6 og Microsoft Project beregner ulikt på noen punkter, hvordan appen registrerer den forskjellen i en **beregningsprofil**, og hvordan en beregningsprofil skiller seg fra beregningsalternativene du selv setter per prosjekt. Et gjennomregnet eksempel med ett lite nettverk viser hva dette gjør med datoene.

## Begrepet

Aktiviteter, avhengigheter og en kalender bestemmer det meste av en tidsplan, men ikke alt. Hva skjer med aktiviteter som ikke er startet når du setter en statusdato? Hvor begynner gjenstående arbeid for en aktivitet som allerede er i gang? Hva er fri slakk for en aktivitet når en tidsfrist ikke overholdes? Nettverket sier ingenting om dette. Et planleggingsprogram må velge en regel for det. Appen kjenner flere punkter der regelen i Primavera P6 og regelen i Microsoft Project er ulike.

Appen kaller et slikt valg en **beregningsregel**. En **beregningsprofil** er settet med beregningsregler som hører til ett program. Appen har tre:

- *Open Planner Studio*: profilen et nytt prosjekt beregnes med. Ingen beregningsregel er på.
- *Primavera P6*: beregningsreglene appen kjenner fra P6.
- *Microsoft Project*: beregningsreglene appen kjenner fra Microsoft Project.

Profilen sier altså hvordan et program beregner. Det du vil ha for prosjektet, er ikke en del av den. Det er **beregningsalternativene**: valg som hvor lite slakk en aktivitet må ha for å bli kritisk, eller i hvilken kalender en forsinkelse telles. Du setter dem per prosjekt.

## Hvordan appen beregner

### Beregningsregler og beregningsalternativer

En beregningsregel er en bryter: på eller av. Profilen bestemmer hvilke brytere som er på. Et beregningsalternativ er et valg du gjør selv. Du kan se forskjellen i appen selv, i blokken *Beregningsprofil og beregningsalternativer*:

- **Beregningsregler** står under *Beregningsregler i denne profilen*, gruppert per emne, for eksempel *Fremdrift og fullført arbeid*, *Avhengigheter og forsinkelse* og *Slakk og seneste datoer*. Denne delen er først sammenfoldet. Overskriften viser hvor mange beregningsregler det er, og hvis profilen avviker, etiketten *endret: 1*. Klikk på overskriften for å utvide den. Med en innebygd profil har hver linje etiketten *PÅ* eller *AV*. Disse verdiene er til informasjon og kan ikke endres. Med en egendefinert profil har hver linje et avkrysningsfelt, med grunnlagsverdien etter seg (*grunnlag: på* eller *grunnlag: av*). Avviker valget ditt fra det, skiller linjen seg ut, og *Tilbakestill til grunnlag* vises. Ikonet med bokstaven i etter en linje viser forklaringen av den beregningsregelen. Hold musepekeren over det, gå til det med Tab, eller trykk på det. Les den forklaringen først hvis du vil endre en beregningsregel. Fungerer en beregningsregel bare med timeplanlegging, eller bare på aktiviteter fra en .xer-fil, så sier en blå etikett ved siden av det: *bare ved timeplanlegging* eller *bare .xer-aktiviteter*. Timeplanlegging betyr: en kalender med tidsbånd, en aktivitet der varigheten er i timer, eller *Forsinkelseskalender* satt til *24-timers*. Et prosjekt med bare en dagkalender og aktiviteter i dager merker ikke noe av en beregningsregel merket *bare ved timeplanlegging*, med mindre forsinkelseskalenderen er satt til *24-timers*. Da telles en forsinkelse i timer, og en beregningsregel om forsinkelse kan endre noe.
- **Beregningsalternativer** står under *Beregningsalternativer for dette prosjektet*: blant annet *Definisjon av kritisk*, *Slakkberegning*, *Åpne-ende aktiviteter er kritiske*, *Marker nesten kritisk* og *Forsinkelseskalender*. De sier hva du vil ha for dette prosjektet, ikke hvordan et program beregner. Hva de gjør, står i [Kritisk linje og slakk](docs://uitleg-kritiek-pad) og [Avhengigheter og forsinkelse](docs://uitleg-relaties).

Et eksempel på hvert. «En aktivitet er kritisk hvis totalslakken er 0 eller mindre» er et beregningsalternativ: du kan sette terskelverdien til 4, og da er alt med slakk på 4 arbeidsdager eller mindre kritisk. «Aktiviteter som ikke er startet, flyttes til statusdatoen» er en beregningsregel: Open Planner Studio og Primavera P6 gjør det, Microsoft Project gjør det ikke.

Profilen og beregningsalternativene hører til prosjektfilen, ikke til appen. Lagrer du prosjektet, følger de med. To prosjekter i samme app kan derfor beregne med ulik profil. Et prosjekt uten profil beregnes som Open Planner Studio.

Kommer prosjektet fra en .xer-fil, viser blokken også *Innstillinger fra kildefilen* nederst: beregningsalternativer som bare Primavera kjenner, og som filen tok med seg. Du kan ikke endre dem her. Knappen for standardinnstillingene og en annen profil lar dem også stå som de er. Et nytt prosjekt har dem ikke, heller ikke med *Primavera P6*.

### Hvor du velger profilen

For et nytt prosjekt står beregningsprofilen i vinduet *Nytt prosjekt*, som du åpner via *Hjem › Fil › Ny*. Der er *Beregningsprofil* en nedtrekksliste. Velger du en profil der, erstatter appen beregningsalternativene du allerede har fylt inn, med standardverdiene for den profilen. Bare innstillinger fra en kildefil blir stående. Med *Primavera P6* er *Slakkberegning* da *Sluttslakk*. Med *Microsoft Project* og *Open Planner Studio* står hvert beregningsalternativ på standard, så *Slakkberegning* er *Automatisk (standard)*. Med en statusdato er det også slik MS Project selv beregner: en påbegynt aktivitet får sluttslakk, og alle andre aktiviteter får den minste av startslakk og sluttslakk.

For et eksisterende prosjekt velger du profilen under *Innstillinger › Prosjekt › Prosjektinnstillinger*, i blokken *Beregningsprofil og beregningsalternativer*, i nedtrekkslisten *Beregningsprofil*. Du kommer også til samme sted via *Fil › Prosjektinnstillinger*. Å bytte profil her endrer bare beregningsreglene. Beregningsalternativene dine blir som de er. Avviker beregningsalternativene dine fra standarden for profilen, viser en oransje blokk over alternativene det. Det er ofte med vilje, for eksempel fordi alternativene kommer fra den åpnede filen. Vil du likevel ha standarden, velger du *Bruk standardinnstillingene til …* i den blokken. Krysset skjuler blokken for denne åpnede filen.

Frem til du trykker *Bruk*, ligger endringen bare i skjemaet. Med *Bruk* omberegner appen tidsplanen med en gang, også når *Beregne automatisk* er av. Har aktiviteter flyttet seg, sier appen hvor mange, for eksempel *Etter bruk er 4 aktiviteter forskjøvet.* Hele endringen angres i ett steg med *Angre*. Trykker du *Angre* eller *Gjør om* mens prosjektinnstillingene er åpne, følger blokken tilstanden til prosjektet. Har du allerede endret noe i blokken selv, blir valget ditt stående, og en gul blokk sier at *Bruk* setter det valget tilbake.

De tre innebygde profilene kan ikke endres. For andre beregningsregler lager du en egen profil. Du kan også beholde den som mal for andre prosjekter i denne appen. Prosjektet har alltid sin egen kopi: endrer du malen senere, endres ikke prosjektet med den. Stegene står i [Velge eller lage en beregningsprofil](docs://howto-rekenprofiel-kiezen).

### Når appen velger en profil selv

Når du åpner en fil, foreslår appen en profil basert på formatet:

- En .mpp-fil (Microsoft Project) åpnes med profilen *Microsoft Project*.
- En .xer-fil (Primavera P6) åpnes med profilen *Primavera P6*.
- En fil i formatet *MS Project XML*, *Primavera P6 XML* eller *CSV (semikolonseparert)* åpnes med *Open Planner Studio*, uten melding om profil.
- Det egne prosjektet ditt (.ifc) åpnes med profilen som er lagret i filen.

For en .mpp- eller .xer-fil melder appen hvilken profil som brukes: *Dette prosjektet beregner som Microsoft Project. Endre det via Fil → «Prosjektinfo» → «Beregningsprofil og beregningsalternativer».* Med knappen *Åpne beregningsprofil* i meldingen går du rett til prosjektinnstillingene. For en .xer-fil er denne linjen den første detaljlinjen i åpningsmeldingen for filen. Mer om meldingen står i [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen) og [Åpne en MS Project-fil (.mpp)](docs://howto-mpp-openen).

For en .mpp-fil setter appen bare profilen. Beregningsalternativene blir tomme, akkurat som i et nytt prosjekt med profilen *Microsoft Project*: *Slakkberegning* er *Automatisk (standard)*. En åpnet .mpp-fil og et nytt prosjekt med *Microsoft Project* beregner derfor slakk på samme måte.

## Gjennomregnet eksempel: ett nettverk, tre profiler

Eksemplet er et lite nettverk. Kalenderen har en arbeidsuke fra mandag til fredag, og ingen fridager i disse ukene. Fremdriftsmodusen er Retained Logic (standard). Prosjektet starter mandag 7. juni 2027. Alle aktiviteter er i arbeidsdager.

- *Pour foundation*: 5 arbeidsdager, planlagt fra mandag 7. juni.
- *Lay walls*: 5 arbeidsdager, etter *Pour foundation* (slutt-til-start).
- *Order window frames*: 3 arbeidsdager, uten forgjenger, planlagt fra mandag 7. juni.
- *Fit roof*: 2 arbeidsdager, etter *Lay walls* og etter *Order window frames*. Slutten på denne aktiviteten er overleveringen.

Tallene er beregnet med appens beregningsmotor. Du leser dem i panelet *Egenskaper* under *CPM-resultat*.

**Uten statusdato og uten fremdrift beregner de tre profilene dette nettverket likt.** *Pour foundation* løper fra mandag 7. til fredag 11. juni, *Lay walls* fra mandag 14. til fredag 18. juni og *Fit roof* mandag 21. og tirsdag 22. juni. Overleveringen er tirsdag 22. juni. *Order window frames* (mandag 7. til onsdag 9. juni) har 7 arbeidsdager i totalslakk.

Nå registrerer du status. Statusdatoen er onsdag 9. juni. Fundamentet startet mandag 7. juni og står på 60 %. Gjenstående arbeid er derfor 2 arbeidsdager (5 × 40 %). *Order window frames* er ikke startet. Hvordan [fremdrift og statusdato](docs://uitleg-voortgang) virker, står i den artikkelen. Her er spørsmålet hva profilen gjør med det.

### Open Planner Studio

Gjenstående arbeid for fundamentet begynner på statusdatoen: onsdag 9. og torsdag 10. juni. Tidligste start forblir faktisk start, mandag 7. juni. Tidligste slutt er torsdag 10. juni. *Lay walls* går fra fredag 11. til torsdag 17. juni, og *Fit roof* fredag 18. og mandag 21. juni.

*Order window frames* var planlagt til mandag 7. juni, men er ikke startet. Aktiviteter som ikke er startet, kan ikke ligge i fortiden. Appen flytter den derfor til statusdatoen: onsdag 9. til fredag 11. juni, med 4 arbeidsdager i totalslakk. Overleveringen er mandag 21. juni.

### Primavera P6

Alt er likt med Open Planner Studio, bortsett fra ett punkt: tidligste start for *Pour foundation* er onsdag 9. juni. Det er start på gjenstående arbeid, ikke faktisk start. Dette gjøres av beregningsregelen *Pågående aktivitet: tidligste start = start på gjenstående arbeid*, i gruppen *Fremdrift og fullført arbeid*. Slutten og slakken endres ikke av den. Overleveringen er mandag 21. juni.

### Microsoft Project

Her er datoene ulike. To beregningsregler i gruppen *Fremdrift slik som i Microsoft Project* forårsaker det.

*Ikke-startede aktiviteter flyttes ikke til statusdatoen*: *Order window frames* blir stående fra mandag 7. til onsdag 9. juni, selv om det delvis ligger før statusdatoen. Totalslakken er 7 arbeidsdager.

*Gjenstående arbeid fortsetter etter forløpt tid*: det gjenstående arbeidet begynner tidligst på statusdatoen, og tidligst på faktisk start pluss den allerede forløpte tiden. Ved 60 % av 5 arbeidsdager er 3 arbeidsdager gjort. Mandag 7. juni pluss 3 arbeidsdager er torsdag 10. juni. Det er etter statusdatoen, så det gjenstående arbeidet løper torsdag 10. og fredag 11. juni. *Lay walls* går fra mandag 14. til fredag 18. juni, og *Fit roof* mandag 21. og tirsdag 22. juni. Overleveringen er tirsdag 22. juni: én arbeidsdag senere enn i de to andre profilene.

### Hva om

**Fundamentet står på 20 % i stedet for 60 %.** Gjenstående arbeid er da 4 arbeidsdager. I alle tre profilene er fundamentet ferdig mandag 14. juni, og overleveringen er onsdag 23. juni. Beregningsregelen i Microsoft Project for gjenstående arbeid gjør ingen forskjell her: mandag 7. juni pluss 1 forløpt arbeidsdag er tirsdag 8. juni, og det er før statusdatoen. En slik beregningsregel er en nedre grense som bare kan gjøre det gjenstående arbeidet senere. *Order window frames* og den tidligste starten under Primavera P6 er fortsatt ulike, som over. Under Microsoft Project har *Order window frames* da 8 arbeidsdager i totalslakk.

**Du setter bare en statusdato og registrerer ingen fremdrift.** Under Open Planner Studio og Primavera P6 flyttes hele nettverket til onsdag 9. juni. Fundamentet løper da fra onsdag 9. til tirsdag 15. juni, og overleveringen blir torsdag 24. juni: to arbeidsdager senere enn uten statusdato. Under Microsoft Project blir alt værende der det var, og overleveringen er tirsdag 22. juni.

**Du lager en profil selv.** Under Open Planner Studio lager du en egen profil med *Ny profil*, *Kopi av Open Planner Studio*, og slår bare på *Ikke-startede aktiviteter flyttes ikke til statusdatoen* i den. Med 60 % fremdrift beholder fundamentet datoene fra Open Planner Studio (slutt torsdag 10. juni, overlevering mandag 21. juni). *Order window frames* blir faktisk stående fra mandag 7. til onsdag 9. juni, med 6 arbeidsdager i totalslakk. En profil er altså en samling av separate brytere, og du kan endre dem én for én.

**Et beregningsalternativ i stedet for en beregningsregel.** Setter du *Definisjon av kritisk* (*Totalslakk ≤ terskelverdi*) til en *Terskelverdi (arbeidsdager)* på 4 under Open Planner Studio, blir *Order window frames* kritisk, fordi totalslakken er nøyaktig 4. Ingen datoer endres. Et beregningsalternativ er ditt valg for prosjektet og er uavhengig av profilen.

**En tidsfrist som ikke overholdes.** Gi *Fit roof* en tidsfrist på fredag 18. juni. Under Open Planner Studio er totalslakken til *Fit roof* da −1 arbeidsdag, og fri slakk er også −1. Under Primavera P6 blir totalslakken −1, men fri slakk blir 0. Det gjør beregningsregelen *Fri slakk aldri negativ*, i gruppen *Slakk og seneste datoer*. Under Microsoft Project er begge −2, fordi overleveringen da faller én dag senere. Hvordan en tidsfrist virker, står i [Begrensninger og tidsfrister](docs://uitleg-constraints).

## Konsekvenser og misforståelser

**«Profilen er en innstilling i appen.»** Nei. Profilen og beregningsalternativene hører til prosjektet og følger med i filen. Bare malene du beholder, hører til appen. Et prosjekt beholder alltid sin egen kopi.

**«Hvis jeg eksporterer, følger profilen min med.»** Bare med ditt eget prosjektformat (.ifc). Hvis du eksporterer til *MS Project XML*, *Primavera P6 XML* eller *CSV (semikolonseparert)*, er profilen ikke med i filen. Av beregningsalternativene skriver eksporten til MS Project XML høyst den kritiske terskelverdien. Appen varsler bare om dette for et prosjekt som kommer fra en .xer-fil. For et prosjekt du laget selv, får du ingen melding. Filen åpnes da som Open Planner Studio, uten melding om profil. Ta eksemplet med profilen Microsoft Project og 60 % fremdrift. Hvis du eksporterer den til *MS Project XML* og åpner den igjen, viser appen først datoene fra filen, med overleveringen på tirsdag 22. juni. Hvis du lar appen omberegne selv, blir det mandag 21. juni. Hva ellers en eksport mister, står i [Filer og formater](docs://uitleg-bestanden).

**«Primavera P6-profilen gir samme resultat som P6.»** Appen kan ikke love det. Profilen slår på beregningsreglene appen kjenner fra P6, og de er ikke alle innstillingene i P6. I tillegg til Retained Logic og Progress Override har P6 en tredje fremdriftsmodus, Actual Dates. Appen kjenner den ikke. En slik .xer-fil beregnes etter Retained Logic, og åpningsmeldingen sier det, for eksempel som *1 P6-planleggingsinnstilling brukte en trygg reserveløsning.* Noen beregningsregler i Primavera P6-profilen virker også bare på aktiviteter som kommer fra en .xer-fil, for eksempel *Ikke-startet LOE bruker målvinduet* og *Behold faktiske datoer nøyaktig*. For noen av dem står det i forklaringen: «bare aktiviteter med P6-opprinnelse». På aktiviteter du lager selv, gjør disse reglene ingenting.

**«Fremdriftsmodusen er en del av profilen.»** Nei. Retained Logic eller Progress Override er et eget valg per prosjekt. Du velger det separat fra profilen, se [Velge fremdriftsmodus](docs://howto-voortgangsmodus-kiezen). Én beregningsregel fra Primavera P6, *Progress Override ignorerer en startet etterfølger også bakover*, gjør bare noe under Progress Override.

**«Jeg bytter bare profil for å se hva som skjer.»** Det kan du, for *Bruk* er ett trinn som *Angre* kan ta tilbake: profil og datoer går tilbake sammen. Men datoene kan virkelig flytte seg. I eksemplet flytter bytte fra Open Planner Studio til Microsoft Project alle 4 aktiviteter. Meldingen teller dem for deg. Se på tidsplanen etterpå før du fortsetter. Viser appen fortsatt datoene fra filen etter at du har åpnet en .xer eller .mpp, så forlater et profilbytte den visningen, og appen beregner selv. Hvordan det fungerer, står i [Datoer slik de er lagret](docs://uitleg-datums-zoals-opgeslagen).

**«Eksemplet viser fire beregningsregler, og listen i appen er lengre.»** Hver linje i blokken har sin egen forklaring. Les den først. Se også på gruppen *Bare for egne profiler*: disse reglene er av i alle innebygde profiler, også Primavera P6. Bare en egen profil kan slå dem på: lag en med *Ny profil*.

## Se også

- [Velge eller bygge en beregningsprofil](docs://howto-rekenprofiel-kiezen): velge, bytte eller bygge en profil.
- [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang): hva statusdatoen og gjenstående arbeid gjør, med forskjellene per profil.
- [Velge fremdriftsmodus](docs://howto-voortgangsmodus-kiezen): velge Retained Logic eller Progress Override.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): beregningsalternativene for kritisk linje og slakk.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): beregningsalternativet *Forsinkelseskalender*.
- [Filer og formater](docs://uitleg-bestanden): hva en eksport tar med og ikke tar med.
- [Eksportere](docs://howto-exporteren): eksportere et prosjekt.
- [Oppdatere fremdrift](docs://howto-voortgang-bijwerken): legge inn prosent, faktisk start og statusdato.
- [Datoer slik de er lagret](docs://uitleg-datums-zoals-opgeslagen): hvorfor importerte datoer kan avvike fra det appen selv beregner.
- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): alle beregningsregler og beregningsalternativer på én liste.
