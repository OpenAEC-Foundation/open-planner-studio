# Kritisk vej og slæk

Hvorfor er projektslutdatoen, som den er? Og hvilken opgave kan blive en dag forsinket uden at flytte overdragelsen? Det er spørgsmålene bag den kritiske vej. Denne artikel forklarer præcis, hvad appen beregner, med et gennemregnet eksempel.

## Begrebet

En tidsplan er et net af opgaver, der er forbundet med **afhængigheder**: aftaler som "vinduesrammerne sættes først i, når taget er lukket". Afhængighederne binder opgaver sammen. Nogle kæder af opgaver er længere end andre. Den længste kæde bestemmer, hvor lang tid hele projektet tager.

Den længste kæde er den **kritiske vej**. Hvis en opgave på den bliver en dag forsinket, flytter overdragelsen sig en dag. Der er ingen margen i den.

Opgaver uden for den kritiske vej har derimod plads. Den plads kaldes **slæk**. Murereren, der bygger den ydre skalmur, kan starte to dage senere uden at nogen bemærker det. De to dage er opgavens slæk.

At en opgave er kritisk, siger altså intet om, hvor vigtig den er. Det siger kun, at der ikke er tid til overs.

Beregningsmetoden kaldes **CPM** (Critical Path Method). Derfor kaldes blokken med resultaterne i panelet *Egenskaber* for *CPM-resultat*.

## Sådan beregner appen

Appen genberegner ikke tidsplanen af sig selv. Beregningen starter med **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*. Hvis noget er ændret siden den sidste beregning, viser statuslinjen *Forældet — genberegn (F5)*. Hvis *Beregn automatisk* er slået til (under *Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*, overskriften *Beregning*), gør appen det selv.

En beregning gennemgår nettet to gange.

### Fremadgående gennemgang

Appen starter ved projektstartdatoen og følger afhængighederne fra foregående opgave til efterfølgende opgave. For hver opgave finder appen den tidligste dag, opgaven kan starte. Hvis en opgave har flere foregående opgaver, venter opgaven, til den sidste er færdig. Det giver hver opgave dens **tidligste startdato** og **tidligste slutdato**. Den seneste tidligste slutdato af alle opgaver er projektslutdatoen.

### Baglæns gennemgang

Derefter går appen baglæns fra projektslutdatoen til starten. Nu finder appen for hver opgave den sidste dag, opgaven skal være færdig uden at flytte slutdatoen. Hvis en opgave har flere efterfølgende opgaver, tæller den, der skal starte først. Det giver **seneste startdato** og **seneste slutdato**.

### Samlet og tilladt slæk

Forskellen mellem en opgaves seneste og tidligste datoer er dens **samlede slæk**: antallet af arbejdsdage, opgaven kan blive forsinket eller starte senere, før projektslutdatoen flytter sig. Appen tæller i arbejdsdage i opgavens kalender. En weekend eller en offentlig helligdag tæller ikke.

**Tilladt slæk** er strengere. Det er den plads, en opgave har, før en af dens efterfølgende opgaver skal starte senere. Du kan bruge den plads, uden at en anden opgave mærker det.

Samlet slæk kan deles. Hvis to ikke-kritiske opgaver følger hinanden, deler de den samme margen. Hvis den første bruger den op, har den anden ingen tilbage. Den første har så samlet slæk, men ingen tilladt slæk. Den del af den samlede slæk, der ikke er tilladt, kaldes **forstyrrende slæk**: bruger du den, flytter de efterfølgende opgaver sig også. Eksemplet nedenfor viser det med tal.

### Negativ slæk

Slæk kan også blive negativ. Det sker, når en opgave har en deadline, eller en begrænsning, der sætter en seneste dato, som ligger før den dato, appen beregner for opgaven. På papiret er opgaven allerede forsinket, og opgaven og kæden før den bliver kritiske.

### Hvornår er en opgave kritisk?

Som standard er en opgave kritisk, når dens samlede slæk er 0 eller mindre. Det kan du ændre under *Indstillinger › Projekt › Projektindstillinger*, i blokken *Beregningsprofil og beregningsindstillinger*, under *Beregningsindstillinger for dette projekt*. Når du klikker på *Anvend*, genberegner appen tidsplanen med det samme. Indstillingerne hører til projektfilen, ikke til appen.

- **Definitionen af kritisk** med *Samlet slæk ≤ grænseværdi* og feltet *Grænseværdi (arbejdsdage)*. Grænseværdien er som standard 0. For at beskytte en buffer, sæt den til 2, for eksempel: hver opgave med 2 arbejdsdage slæk eller mindre tæller dermed som kritisk og bliver rød. Hvis du vælger *Længste sti*, er en opgave kritisk, når den ligger på den længste kæde til den sidste slutdato. Dens slæk har da ingen betydning.
- **Flere slækstier** nummererer kæderne efter deres slæk i kolonnen *Slækssti*. Sti 1 er den kritiske vej. Se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies).
- **Markér næsten kritisk** med sin egen *Grænseværdi*, som standard 2 arbejdsdage. En opgave med mere end 0, men højst så meget slæk, får en gul bjælke. Så ser du, hvilke opgaver der næsten ingen margen har tilbage, uden at de kaldes kritiske.
- **Opgaver med åben ende er kritiske**: en opgave uden efterfølgende opgave, som endnu ikke er færdig, tæller som kritisk. Nyttigt som sikkerhedsnet mod glemte afhængigheder (se misforståelserne nedenfor).
- **Slækberegning** bestemmer, om samlet slæk måles ved opgavens start, ved dens slutning, eller som den mindste af de to. Nye projekter er indstillet til *Automatisk (standard)*. Hvis projektet bruger Primavera P6-profilen, og valget ikke er *Slutslæk*, viser en orange blok under *Projektindstillinger*, at det ikke er sat. Dens knap sætter valget til *Slutslæk*. For MS Project sætter den samme knap det tilbage til *Automatisk (standard)*: med en statusdato beregner MS Project selv på den måde.

### Hvor du ser det

Kritiske opgaver har en rød bjælke i Gantt-diagrammet. Bag en ikke-kritisk bjælke ligger et grønt bånd op til opgavens seneste slutdato: det er slæken. Du slår båndet til eller fra med *Visning › Oprindelige planer & fremdrift › Slækbånd*.

For en valgt opgave viser panelet *Egenskaber* alt under *CPM-resultat*: tidligste og seneste start og slut, samlet, tilladt og forstyrrende slæk, og om opgaven ligger på den kritiske vej. Slækken for alle opgaver ved siden af hinanden står i kolonnerne under *Beregnet* (**+** til højre i tabelhovedet), fx *Samlet slæk*, *Tilladt slæk*, *Kritisk* og *Næsten kritisk*.

Statuslinjen nederst tæller de kritiske opgaver, for eksempel *Kritisk vej: 21 opgaver, 45 arbejdsdage*.

## Gennemregnet eksempel: House extension

Eksemplet er øvelsesprojektet *House extension* fra selvstudierne, i den stand det er i, når alle afhængigheder er på plads. I selvstudium 2, "Afhængigheder og den kritiske vej", bygger du det selv og kontrollerer tallene. Her læser du, hvorfor tallene er, som de er.

Tilbygningen starter mandag den 7. juni 2027. Efter beregningen er overdragelsen fredag den 6. august 2027, og statuslinjen siger *Kritisk vej: 21 opgaver, 45 arbejdsdage*. To opgaver er ikke kritiske: *Build outer cavity leaf* og *Painting*.

### To kæder, der mødes

Efter det bærende gulv (*Lay hollow-core floor*, færdigt mandag den 28. juni) deles arbejdet op i to kæder. Begge ender ved *Install window frames*:

- Indersiden: *Build inner cavity leaf* (5 arbejdsdage), derefter *Place roof elements* (1), derefter *Apply roofing* (2). Vinduesrammerne kan kun sættes i, når taget er lukket.
- Ydersiden: *Build outer cavity leaf* (6 arbejdsdage). Rammerne sidder i facaden, så den skal også være færdig.

**Fremad.** Begge skalmure kan starte tirsdag den 29. juni. Den indre skalmur er færdig mandag den 5. juli. Tagelementerne sættes på tirsdag den 6. juli, og tagdækningen følger onsdag den 7. og torsdag den 8. juli. Den ydre skalmur er færdig tirsdag den 6. juli. *Install window frames* venter på den seneste af de to kæder, tagdækningen, og starter derfor fredag den 9. juli.

**Baglæns.** Rammerne skal senest starte fredag den 9. juli, ellers flytter overdragelsen sig. Så skal den ydre skalmur være færdig senest torsdag den 8. juli. Seks arbejdsdage tilbage giver en seneste startdato torsdag den 1. juli.

**Slæk.** Den ydre skalmur kan tidligst starte den 29. juni og skal senest starte den 1. juli. Derimellem ligger 2 arbejdsdage: onsdag den 30. juni og torsdag den 1. juli. Det er dens samlede slæk; panelet viser *Samlet slæk: 2 dage* og *Kritisk vej: Nej*. Den tilladte slæk er også 2 dage, fordi dens eneste efterfølgende opgave, *Install window frames*, ligger på den kritiske vej.

Den indre kæde har ingen slæk. Hver dag, den indre kæde bliver forsinket, flytter rammerne og alt efter dem.

### Painting

*Painting* (3 arbejdsdage) starter efter pudsningen, mandag den 26. juli, og er færdig onsdag den 28. juli. Den næste opgave, *Snagging and cleaning*, venter også på flisearbejdet. Flisearbejdet er først færdigt torsdag den 5. august, fordi gulvafretningen skal tørre i fem arbejdsdage først. *Painting* må derfor løbe videre til torsdag den 5. august. Det giver 6 arbejdsdage slæk: 29. og 30. juli samt 2. til 5. august. Også her er tilladt slæk lig med samlet slæk, fordi den efterfølgende opgave er kritisk.

### Når den ydre skalmur bliver forsinket

Tager den ydre skalmur 8 arbejdsdage i stedet for 6, er den færdig torsdag den 8. juli: præcis dens seneste slutdato. Slækken er væk, og opgaven bliver rød. Begge kæder er så kritiske, og statuslinjen tæller 22 kritiske opgaver. Overdragelsen bliver fredag den 6. august.

Tager den 9 arbejdsdage, er den ydre skalmur først færdig fredag den 9. juli. Rammerne flytter til mandag den 12. juli, og overdragelsen til mandag den 9. august: én arbejdsdag senere. Den ydre kæde er nu den kritiske vej; statuslinjen siger *Kritisk vej: 19 opgaver, 46 arbejdsdage*.

Den indre kæde har så 1 arbejdsdag samlet slæk, men den dag deles:

- *Build inner cavity leaf*: samlet slæk 1, tilladt slæk 0, forstyrrende slæk 1. Hvis den indre skalmur bliver en dag forsinket, flytter tagelementerne med.
- *Place roof elements*: samlet slæk 1, tilladt slæk 0, forstyrrende slæk 1.
- *Apply roofing*: samlet slæk 1, tilladt slæk 1. Kun her går det ikke ud over nogen, hvis opgaven bliver en dag forsinket.

Det er den samme ene dag, delt af hele kæden. Bruger den indre skalmur den, er den væk for tagelementerne og tagdækningen.

### Næsten kritisk og negativ slæk

Med *Markér næsten kritisk* slået til ved standardgrænseværdien på 2 arbejdsdage, får den ydre skalmur, med præcis 2 dages slæk, en gul bjælke. *Painting* med 6 dage forbliver blå.

Får overdragelsen en deadline onsdag den 4. august, to arbejdsdage før den beregnede overdragelse, bliver slækken negativ. Alle 21 opgaver på den kritiske vej får en samlet slæk på −2 arbejdsdage. Den ydre skalmur har ingen slæk tilbage og bliver også kritisk; *Painting* beholder 4 arbejdsdage.

## Konsekvenser og misforståelser

**"Kritisk betyder vigtig."** Nej. En besigtigelse kan være afgørende og stadig have slæk. Omvendt kan en simpel opgave være kritisk: i eksemplet ligger *Snagging and cleaning* på den kritiske vej. Kritisk handler kun om tid: der er ingen margen tilbage.

**"Denne opgave har slæk, så den kan vente."** Kig først på tilladt slæk. Har en opgave samlet slæk, men ingen tilladt slæk, så tager hver dag, den bliver forsinket, margen fra de efterfølgende opgaver, ligesom med den indre skalmur i tilfældet med 9 arbejdsdage.

**En glemt afhængighed giver falsk slæk.** En opgave uden efterfølgende opgave får slæk op til projektets slutning. Hvis eksemplet manglede afhængigheden fra den ydre skalmur til rammerne, ville den ydre skalmur pludselig have 23 arbejdsdage slæk, op til overdragelsen den 6. august. På papiret kunne den så blive flere uger forsinket, uden at rammerne venter. Med *Opgaver med åben ende er kritiske* slået til bliver den ydre skalmur i så fald kritisk, og hullet bliver synligt.

**Den kritiske vej er ikke fast.** Bliver en ikke-kritisk opgave senere end sin slæk, bliver en anden kæde den længste. Det så du ovenfor med 9 dage murerarbejde. Tidsplanen skal derfor genberegnes efter hver ændring. Så længe statuslinjen viser *Forældet — genberegn (F5)*, hører de røde bjælker stadig til den forrige beregning.

**Slæk tælles i arbejdsdage.** De 6 arbejdsdage med slæk for *Painting* løber fra torsdag den 29. juli til torsdag den 5. august: otte kalenderdage, fordi weekenden ikke tæller. En offentlig helligdag eller byggeferie i kalenderen tæller heller ikke.

## Se også

- [Tilføj afhængigheder](docs://howto-relaties-leggen): trinnene til at sammenkæde opgaver og sætte en forsinkelse.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): hvordan afhængigheder og forsinkelse bestemmer de tidligste datoer.
- [Begrænsninger og deadlines](docs://uitleg-constraints): hvordan en begrænsning eller deadline giver negativ slæk.
- [Spor en sti](docs://howto-pad-traceren): følg kæden bag en opgave.
- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): definitionen af kritisk, næsten kritisk og slækberegningen, indstilling for indstilling.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): et stort projekt med flere slækstier, næsten kritisk arbejde (grænseværdi 3 arbejdsdage), en hængekøje, en hård fastlåsning og en ekstern afhængighed.
