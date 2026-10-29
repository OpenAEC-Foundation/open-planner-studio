# Sådan bruger du belægningsoversigten

Mål: Se på hvilke dage to eller flere åbne projekter tilsammen kræver mere af en ressource, end biblioteket har.

## Hvornår har du brug for dette

Dit murerhold er på facaderne i ét projekt og på garagerne i et andet. I hvert projekt ser holdet fint planlagt ud, fordi histogrammet og overallokeringen kun kigger på det ene projekt. Først når du lægger projekterne side om side, viser det sig, at de på de samme dage tilsammen kræver mere end du har murere. Belægningsoversigten lægger dem side om side for dig.

Oversigten tæller kun ressourcer, der kommer fra biblioteket, i projekter der er knyttet til det samme bibliotek. Hvordan det beregnes, kan du læse i [Biblioteket](docs://uitleg-resourcebibliotheek).

## Trin

### 1. Gør projekterne klar

1. Åbn de projekter, du vil sammenligne, hver i sin egen fane, se [Arbejde med flere projekter på én gang](docs://howto-meerdere-projecten). Oversigten ser kun de projekter, der er åbne i dette program.
2. Knyt hvert projekt til det samme bibliotek, og brug ressourcen fra biblioteket i hvert projekt. Uden en bibliotekskobling viser ressourcepanelet ikke oversigten. Se [Sådan bruger du biblioteket](docs://howto-resourcebibliotheek-gebruiken).
3. Beregn projekterne med *Beregn* (F5), eller slå *Beregn automatisk* til. Hvad oversigten gør med forældede projekter, står under faldgruberne nedenfor.

### 2. Åbn oversigten

1. Gå til et af projekterne, og vælg *Ressourcer › Administrer › Ressourcer*.
2. Øverst til højre vælger du *Belægning*. Oversigten hører til biblioteket i det projekt, du er i. Du kan ikke ændre noget i dette panel: det er et vindue, du kun kan læse i.

### 3. Læs tabellen

Hver ressource fra biblioteket, der er booket i mindst ét åbent projekt, får en række. Ressourcer uden booking vises ikke. Rækkerne med flest overallokerede dage står øverst, og derefter i alfabetisk rækkefølge.

- *Dokumenter* viser i hvor mange projekter ressourcen er booket, for eksempel *2 dokumenter*.
- *Periode* går fra den første til den sidste dag med belastning, skrevet som åååå-mm-dd, for eksempel *2027-06-07 – 2027-06-14*.
- *Top / Kapacitet* stiller den højeste daglige belastning af alle projekter sammen op mod kapaciteten for ressourcen i biblioteket, for eksempel *4,0 / 3,0*. Er der mindst én overallokeret dag, vises den i rødt.
- En rød markering efter rækken, for eksempel *3 dage overallokeret*, tæller de dage, hvor summen er større end kapaciteten. Holder du musen over den, ser du datoerne.

### 4. Se per projekt

1. Klik på den lille pil før navnet på en ressource. Rækken åbnes.
2. Øverst står de overallokerede datoer, de første fem, og derefter *… og 3 mere*, hvis der er flere. Nedenfor står for hvert projekt navnet med periode og top for netop det projekt, for eksempel *Houses North 2027-06-07 – 2027-06-11 Top: 2,0*.
3. Klik på selve rækken for at se et histogram nederst. Hvert projekt har sin egen farve, og søjlerne er stablet. Den stiplede linje er bibliotekets kapacitet. Hvis den ændrer sig over tid, ser du trin. Dage med overallokering får en rød baggrund bag søjlerne. Klik på rækken en gang til for at lukke histogrammet igen. Uden valgt række står der *Vælg en ressource for at se histogrammet.*

### 5. Løs det

Oversigten viser problemet, men løser det ikke. Du har to muligheder:

- Flyt en opgave i et af projekterne, eller giv den færre tildelingsenheder pr. dag. Genberegn derefter projektet med F5.
- Hvis der virkelig kommer nogen til, så hæv *Maksimalt antal enheder* for ressourcen i biblioteket. Det gør du i *Ressourcer › Administrer › Ressourcer*, visningen *Bibliotek*.

*Udjævn…* i båndet hjælper ikke her: den kigger på ressourcerne i det ene projekt, du er i. Se [Udjævning af ressourcer](docs://uitleg-nivelleren).

## Faldgruber, og hvad programmet så gør

**Oversigten er tom.** Der står *Ingen bibliotekressourcer booket i de åbne dokumenter.* Så har intet åbent projekt en ressource fra biblioteket på en opgave.

**Du ser ikke knappen *Belægning*.** Projektet, du er i, er ikke knyttet til et bibliotek.

**Et projekt tæller ikke med.** Det er ikke åbent i dette program, det er knyttet til et andet bibliotek, eller ressourcen i det er en egen ressource for netop det projekt. Nederst i oversigten står altid *Dette overblik ser kun de dokumenter, der er åbnet i dette program.* En kopi af en ressource, der siden er fjernet fra biblioteket, tæller heller ikke med.

**En kopi eller variant tæller fuldt med.** Hvert åbent projekt, der er knyttet til biblioteket, tæller med, også hvis det er en kopi eller variant af et andet åbent projekt. Eksempel: en variant, som en AI-assistent har lavet med `planner_duplicate_document`. Original og variant tilsammen kan så vise en overallokering, der i virkeligheden kun findes én gang. Oversigten filtrerer ikke stille på det: luk varianten et øjeblik, eller tag højde for det, når du læser tallene.

**Et projekt er forældet.** Et projekt er forældet, hvis du har ændret noget i tidsplanen uden at genberegne. Oversigten behandler så projektet således:

- For et projekt, der ikke er den aktive fane, beregner oversigten selv på forhånd, uden at ændre projektet. Over tabellen står der så *Ændrede dokumenter er allerede beregnet til dette overblik; tryk F5 i dokumentet, eller slå “Beregn automatisk” til for at gøre det permanent.* Efter projektet står der *Allerede beregnet til dette overblik — selve dokumentet viser ældre datoer, indtil du trykker F5 dér eller slår “Beregn automatisk” til.* Er *Beregn automatisk* slået til (*Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*), genberegner programmet virkelig sådanne projekter, så snart du kigger på oversigten, og meddelelsen forsvinder. Er det aktive projekt også forældet, vises meddelelsen fra det næste punkt over tabellen i stedet.
- Oversigten beregner ikke selv det projekt, du er i. Er det projekt forældet, står der *Et ændret dokument er ikke genberegnet endnu; det tæller her med sine senest beregnede tal. Tryk F5 i dette dokument, eller slå “Beregn automatisk” til.* Efter projektet står der *Forældet: dette er de senest beregnede tal — tryk F5 i dette dokument.* Pas på: *senest beregnede tal* er ikke helt rigtigt. Oversigten bruger de gamle startdatoer, men allerede en ændret varighed eller tildeling. Tallene kan derfor afvige fra både den gamle og den nye tidsplan og fra bjælker i Gantt-diagrammet. Stol kun på dem efter F5.
- Hvis oversigten ikke kan beregne et projekt, for eksempel på grund af en løkke i dets afhængigheder, tæller projektet ikke med. Det står stadig på listen, med *Tæller ikke med: tidsplanen er ikke beregnet — aktiver dette dokument og tryk F5.* og over tabellen *Mindst ét dokument er ikke beregnet og tæller ikke med i belægningen.*

**Oversigten stemmer ikke med det, du forventer.** Kapaciteten kommer fra biblioteket (*Maksimalt antal enheder* for biblioteksposten, eller dens *Tidsfaseret kapacitet* på den dag), ikke fra *Maksimalt antal enheder* for kopien i projektet. En sum, der er lig med kapaciteten, er ikke en konflikt.

## Se også

- [Biblioteket](docs://uitleg-resourcebibliotheek): hvordan belægningen tælles, med et gennemregnet eksempel.
- [Sådan bruger du biblioteket](docs://howto-resourcebibliotheek-gebruiken): knytte projekter til biblioteket og tildele ressourcer.
- [Sådan løser du overallokering](docs://howto-overbezetting-oplossen): overallokering inden for ét projekt.
