# Udjævning af ressourcer

Du har én murer og to vægge, der skal bygges på de samme dage. På papiret fungerer tidsplanen, men i praksis kan han kun være ét sted ad gangen. Udjævning er den måde, appen løser sådanne konflikter på: den får opgaver til at starte senere, indtil ressourcen kan klare det. I denne artikel læser du præcis, hvad udjævning flytter, hvornår slutdatoen giver efter, og hvad appen ikke løser for dig.

## Begrebet

En ressource er **overallokeret** på en arbejdsdag, hvis tidsplanen kræver mere af den den dag, end den kan levere. Det den kan levere, er dens kapacitet: *Maksimalt antal enheder* på ressourcens arbejdsdage i kalenderen. Arbejder den ikke den dag ifølge sin kalender, er kapaciteten 0.

**Udjævning** løser det ved at få opgaver til at starte senere. Den gør ikke mere. Den forkorter ikke en opgave, deler ikke en opgave, ændrer ikke tildelingsenheder eller afhængigheder og tilføjer ikke en ekstra ressource. For hver opgave leder appen efter det første tidspunkt, hvor ressourcerne er ledige, og flytter opgaven dertil.

Der er to måder, i vinduet *Udjævn ressourcer*:

- Som standard må projektets slutdato rykke med. Det er udjævning i egentlig forstand.
- Med afkrydsningsfeltet *Kun udjævning inden for slæk — projektets slutdato forbliver fast* flytter appen kun opgaver inden for deres slæk. Slutdatoen bliver så, hvor den er. Virker det ikke, forbliver opgaven, hvor den er, og appen viser en konflikt. Hvad slæk er, læser du i [Kritisk vej og slæk](docs://uitleg-kritiek-pad).

## Sådan beregner appen

### Hvor meget en opgave kræver

Pr. arbejdsdag tæller appen, hvor mange tildelingsenheder hver opgave kræver af en ressource. Det er enhederne ifølge kurven eller din egen timefordeling, præcis de samme timer pr. dag, som histogrammet viser. Ressourcens kapacitet er *Maksimalt antal enheder*, eller den værdi af trinnet i den tidsfaserede kapacitet, der gælder den dag. En dag er overallokeret, hvis efterspørgslen er større end kapaciteten.

### I hvilken rækkefølge

Appen placerer opgaverne én ad gangen i denne rækkefølge: først den højeste prioritet, dernæst opgaven med mindst samlet slæk, dernæst den tidligste startdato og til sidst rækkefølgen i opgavetabellen. En opgave kommer først frem, når dens foregående opgaver har fået deres plads.

Prioriteten er et tal fra 0 til 1000, som du angiver pr. opgave. Standardværdien er 500. I genvejsmenuen på en opgavebjælke hedder den *Prioritet*, med valgene *Lav* (100), *Normal* (500) og *Høj* (900). En opgave, der kommer tidligere frem, får den plads, den vil have. De opgaver, der kommer senere, skal passe rundt om den. Så bestemmer prioriteten, hvilken opgave der bliver stående, og hvilken der må vige. Værdien 1000 er speciel: en sådan opgave flytter aldrig for kapacitet. Det er MS Projects „Do Not Level“.

### Hvor en opgave flytter hen

For hver opgave starter appen ved den tidligste startdato, som afhængighederne tillader. Det tager højde for, at foregående opgaver måske selv er flyttet. Passer opgaven der, bliver den stående. Passer den ikke, prøver appen opgavens næste arbejdsdag, og så videre. En opgave passer, hvis hver ressource er ledig på hver dag af opgaven. Har en opgave flere ressourcer, skal alle være ledige de dage. En opgave flytter altså altid frem, aldrig tilbage.

Appen registrerer flytningen som en **udjævningsforskydning**: et antal arbejdsdage, i opgavens kalender, som opgaven starter senere end afhængighederne kræver. Du ser den i kolonnen *Udjævningsforskydning* under *Beregnet*. Forskydningen gemmes med projektfilen. Beregn (F5) tager den med som ekstra ventetid før starten. Opgaver efter den flytter med via deres afhængigheder.

### Inden for slæk eller længere

Når afkrydsningen ikke er sat, leder appen, indtil opgaven passer. Derfor kan projektets slutdato rykke.

Med afkrydsningen sat må en opgave ikke starte senere end sin seneste startdato, altså den sidste dag den kan starte uden at slutdatoen flytter. Passer opgaven ikke i det vindue, bliver den på sin tidligste plads. Opgaven vises så under *Resterende konflikter*.

### Hvad appen ikke flytter

- Opgaver, der er startet eller afsluttet. Deres belastning tæller med, men de får aldrig en udjævningsforskydning.
- Opgaver med prioritet 1000. De følger de foregående opgaver, men flytter ikke for kapacitet.
- Opgaver uden tildeling til de valgte ressourcer, milepæle og faser. De flytter kun med, hvis en foregående opgave flytter.
- Materiale. Det udjævnes aldrig.

### Forslag og anvendelse

*Beregn* laver et forslag: de opgaver, der flytter, med gammel og ny startdato, og projektets slutdato før og efter. Der ændres intet i din tidsplan, før du vælger *Anvend*. Så skriver appen forskydningerne til opgaverne og genberegner tidsplanen med det samme.

## Arbejdseksempel: murer på to vægge

Eksemplet er selvstudiernes øvelsesprojekt *House extension*, sådan som det ser ud lige før udjævningen i selvstudium 5. I selvstudium 5 gør du det selv og kontrollerer tallene. I dette eksempel står pudsningen på *Fast arbejde*, og pudseren arbejder med tildelingsenheder på 2, som i [Opgavetyper: varighed, enheder og arbejde](docs://uitleg-werkregels).

Efter hulkassedækket, færdigt mandag den 28. juni, starter den indvendige hulmur (5 arbejdsdage) og den udvendige hulmur (6 arbejdsdage) begge tirsdag den 29. juni. Begge hører til den samme murer, med tildelingsenheder på 1 og *Maksimalt antal enheder* på 1. Efter den indvendige hulmur kommer tagelementerne (et kranjob på 6 timer) og tagdækningen (2 arbejdsdage). Vinduesrammerne venter på tagdækningen og på den udvendige hulmur. Overdragelsen er mandag den 30. august.

### Overallokeringen

Den indvendige hulmur løber fra 29. juni til og med 5. juli, den udvendige fra 29. juni til og med 6. juli. Fra 29. juni til og med 5. juli, altså 5 arbejdsdage, kræver tidsplanen 2 tildelingsenheder af en murer med kapacitet 1. Den murer er overallokeret på de 5 dage.

### Rækkefølgen

Begge opgaver har prioriteten 500. Vinduesrammerne leveres først 14. juli (i selvstudium 3 satte du en begrænsning, *Start ikke tidligere end (SNET)*, for dem). Dermed har den indvendige hulmur 3 arbejdsdage slæk, og den udvendige 5. Den indvendige hulmur har mindst slæk og kommer derfor først. Den står fra 29. juni til og med 5. juli.

### Flytningen

Den udvendige hulmur kan ikke starte 29. juni. Den første dag, han er ledig igen, er tirsdag den 6. juli. Det er 5 arbejdsdage senere end den tidligste startdato, så udjævningsforskydningen er 5. Den udvendige hulmur løber nu fra 6. juli til og med 13. juli. Rammerne starter alligevel først 14. juli, så overdragelsen bliver mandag den 30. august. Vinduet viser *Projektets slutdato: uændret (30-08-2027)* og én linje: *Build outer cavity leaf*, gammel start 29-06-2027, ny start 06-07-2027, *5 d*.

De 5 arbejdsdages forskydning er præcis slækken på den udvendige hulmur. Derfor giver *udjævning* her samme resultat. Den udvendige hulmur har nu ingen slæk tilbage og er kritisk.

### Hvad hvis rammerne ikke kommer 14. juli

Uden den begrænsning kan rammerne starte fredag den 9. juli, og overdragelsen er onsdag den 25. august. Den udvendige hulmur har så kun 2 arbejdsdage slæk.

- Uden *udjævning* flytter den udvendige hulmur stadig 5 arbejdsdage. Nu må rammerne vente: de starter 14. juli, 3 arbejdsdage senere. Alt, der kommer efter dem, flytter med, og overdragelsen går fra 25. august til 30. august, også 3 arbejdsdage senere.
- Med *udjævning* flytter intet. Den udvendige hulmur passer ikke inden for sine 2 arbejdsdage slæk. Vinduet viser konflikten *Build outer cavity leaf*, 5 dag(e), med årsagen *For lidt ledig kapacitet inden for slækken til at løse denne konflikt.*

### Hvad hvis den udvendige hulmur får prioritet

Giver du den udvendige hulmur prioriteten *Høj* (900), kommer den først. Den bliver stående 29. juni, og nu må den indvendige hulmur vige: 6 arbejdsdage senere, fra 7. juli til og med 13. juli. Den indvendige hulmur har kun 3 arbejdsdage slæk, så at rykke 6 arbejdsdage er 3 for meget. Tagelementerne, rammerne og alt, der kommer efter dem, flytter med. Overdragelsen går fra mandag den 30. august til torsdag den 2. september. Den samme overallokering giver altså en anden slutdato, afhængigt af hvilken opgave der bliver stående.

### Hvad hvis der kommer en murer mere

Sætter du murerens *Maksimalt antal enheder* til 2, er der ikke længere overallokering. *Beregn* viser *Ingen opgaver skal forskydes — tidsplanen er allerede konfliktfri.*

## Konsekvenser og misforståelser

**„Udjævning finder den korteste tidsplan.“** Nej. Appen arbejder opgave for opgave i en fast rækkefølge. Den leder ikke efter den bedste samlede løsning. Se eksemplet med prioriteten: en anden prioritet giver en anden slutdato.

**„En udjævnet opgave er sikker.“** Udjævning bruger slæk. Den flyttede opgave har dermed mindre eller ingen slæk tilbage og kan blive kritisk, ligesom den udvendige hulmur ovenfor. Bliver den så for sen, flytter overdragelsen.

**„Udjævning følger mine senere ændringer.“** Nej. Forskydningen er et fast antal arbejdsdage. Bliver den indvendige hulmur kortere efter udjævningen, starter den udvendige hulmur stadig 5 arbejdsdage senere, selv om det ikke længere er nødvendigt. Udjævn så igen. Appen begynder da forfra.

**Ikke alt kan løses ved at rykke opgaver.** Hvis ressourcen ikke arbejder de dage, opgaven har brug for, eller opgaven via sin kurve kræver mere på én dag, end ressourcen kan levere, bliver overallokeringen. Appen viser så årsagen ved opgaven.

**Materiale udjævnes ikke.** Kræver materiale på en dag mere end sin kapacitet, viser appen det som overallokering. Men udjævning lader det være.

**Fastlåste opgaver.** Er alle opgaver, der kolliderer, på prioritet 1000, viser vinduet *Ingen opgaver skal forskydes — tidsplanen er allerede konfliktfri.* Overallokeringen forbliver. Efter at du har anvendt, skal du derfor kigge efter meddelelsen *Overallokering* i båndet.

## Se også

- [Løs overallokering](docs://howto-overbezetting-oplossen): trinene til at finde overallokering og udjævne den.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad slæk er, og hvorfor en opgave bliver kritisk.
- [Opgavetyper: varighed, enheder og arbejde](docs://uitleg-werkregels): hvordan varigheden af en opgave følger med tildelingsenhederne.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tre tårne, der har brug for de samme hold og tårnkranen, og hvad udjævning gør ved dem.
