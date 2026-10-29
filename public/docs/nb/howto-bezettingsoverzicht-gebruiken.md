# Bruke oversikten over belegg

Mål: se på hvilke dager to eller flere åpne prosjekter sammen krever mer av en ressurs enn ressursbiblioteket har.

## Når du trenger dette

Murermannskapet ditt er på fasadene i ett prosjekt og på garasjene i et annet. I hvert prosjekt ser murermannskapet ryddig planlagt ut, fordi histogrammet og overallokeringen i et prosjekt bare ser på det ene prosjektet. Først når du legger prosjektene ved siden av hverandre, viser det seg at de samme dagene til sammen krever mer enn du har murere. Oversikten over belegg legger prosjektene ved siden av hverandre for deg.

Oversikten teller bare ressurser fra ressursbiblioteket, i prosjekter som er koblet til samme bibliotek. Hvordan dette beregnes, leser du i [Ressursbiblioteket](docs://uitleg-resourcebibliotheek).

## Trinn

### 1. Gjør prosjektene klare

1. Åpne prosjektene du vil sammenligne, hver i sin egen fane, se [Å arbeide med flere prosjekter samtidig](docs://howto-meerdere-projecten). Oversikten ser bare prosjekter som er åpne i dette programmet.
2. Koble alle prosjektene til samme bibliotek, og bruk ressursen fra biblioteket i alle prosjektene. Uten bibliotekskobling viser ikke ressurspanelet oversikten. Se [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken).
3. Beregn prosjektene med *Beregn* (F5), eller slå på *Beregne automatisk*. Hva oversikten gjør med prosjekter som er utdatert, står under fallgruvene nedenfor.

### 2. Åpne oversikten

1. Gå til ett av prosjektene og velg *Ressurser › Administrer › Ressurser*.
2. Velg *Belegg* øverst til høyre. Oversikten hører til biblioteket til prosjektet du er i. Du kan ikke endre noe i dette panelet: det er et skrivebeskyttet vindu.

### 3. Les tabellen

Hver ressurs fra biblioteket som er booket i minst ett åpent prosjekt, får en rad. Ressurser som ikke er booket, vises ikke. Radene med flest dager med overallokering står øverst, deretter i alfabetisk rekkefølge.

- *Dokumenter* sier i hvor mange prosjekter ressursen er booket, for eksempel *2 dokumenter*.
- *Periode* går fra første til siste dag med belastning, skrevet som åååå-mm-dd, for eksempel *2027-06-07 – 2027-06-14*.
- *Topp / Kapasitet* setter den høyeste daglige belastningen av alle prosjekter samlet opp mot kapasiteten til ressursen i biblioteket, for eksempel *4,0 / 3,0*. Hvis det er minst én dag med overallokering, vises den i rødt.
- Et rødt merke etter raden, for eksempel *3 dager med overallokering*, teller dagene der summen er større enn kapasiteten. Hvis du holder musepekeren over det, ser du datoene.

### 4. Se per prosjekt

1. Klikk på den lille pilen før navnet på en ressurs. Raden åpnes.
2. Øverst står datoene med overallokering: de første fem, og deretter *… og 3 til* hvis det er flere. Under det står per prosjekt navnet med perioden og toppen for det ene prosjektet, for eksempel *Houses North 2027-06-07 – 2027-06-11 Topp: 2,0*.
3. Klikk på selve raden for å se et histogram nederst. Hvert prosjekt har sin egen farge, og søylene er stablet. Den stiplede linjen er kapasiteten i biblioteket. Hvis den endrer seg over tid, ser du trinn. Dager med overallokering får et rødt felt bak søylene. Klikk én gang til på raden for å lukke histogrammet igjen. Uten valgt rad står det *Velg en ressurs for å se histogrammet.*

### 5. Løs problemet

Oversikten viser problemet, men løser det ikke. Du har to valg:

- Flytt en aktivitet i ett av prosjektene, eller gi den færre tildelingsenheter per dag. Omberegn så prosjektet med F5.
- Hvis noen virkelig kommer til, øker du *Maksimalt antall* for ressursen i biblioteket. Det gjør du under *Ressurser › Administrer › Ressurser*, i visningen *Bibliotek*.

*Utjevn…* i båndet hjelper ikke her: den ser på ressursene i det ene prosjektet du er i, se [Utjevning av ressurser](docs://uitleg-nivelleren).

## Fallgruver og hva appen gjør da

**Oversikten er tom.** Der står *Ingen bibliotekressurser er booket i de åpne dokumentene.* Da har ingen åpent prosjekt en ressurs fra biblioteket på en aktivitet.

**Du ser ikke knappen *Belegg*.** Prosjektet du er i, er ikke koblet til et bibliotek.

**Et prosjekt telles ikke med.** Det er ikke åpnet i dette programmet, det er koblet til et annet bibliotek, eller ressursen i det er en egen ressurs for det prosjektet. Nederst i oversikten står det alltid *Denne oversikten ser bare dokumentene som er åpnet i dette programmet.* En kopi av en ressurs som siden er fjernet fra biblioteket, telles heller ikke.

**En kopi eller variant telles fullt ut.** Hvert åpent prosjekt som er koblet til biblioteket, telles, også hvis det er en kopi eller variant av et annet åpent prosjekt. Et eksempel er en variant som en KI-assistent laget med `planner_duplicate_document`. Original og variant sammen kan da vise en overallokering som i virkeligheten bare finnes én gang. Oversikten filtrerer ikke stille på det: lukk varianten en stund, eller les tallene uten den.

**Et prosjekt er utdatert.** Et prosjekt er utdatert hvis du har endret noe i tidsplanen uten å omberegne den. Oversikten handler da slik med det prosjektet:

- For et prosjekt som ikke er den aktive fanen, beregner oversikten selv på forhånd, uten å endre prosjektet. Over tabellen står da *Endrede dokumenter er beregnet på forhånd for denne oversikten. Trykk F5 i dokumentet, eller slå på “Beregn automatisk” for å gjøre dette varig.* Etter prosjektet står det *Beregnet på forhånd for denne oversikten. Selve dokumentet viser eldre datoer til du trykker F5 der, eller slår på “Beregn automatisk”.* Hvis *Beregne automatisk* er på (*Innstillinger › Prosjekt › Appinnstillinger*, fanen *Tidsplan*), omberegner appen slike prosjekter virkelig så snart du ser på oversikten, og meldingen forsvinner. Hvis det aktive prosjektet også er utdatert, vises meldingen fra det neste punktet over tabellen i stedet.
- Oversikten beregner ikke selv prosjektet du er i. Hvis det prosjektet er utdatert, står det *Et endret dokument er ikke beregnet ennå. Det telles her med sine sist beregnede tall. Trykk F5 i det dokumentet, eller slå på “Beregn automatisk”.* Etter prosjektet står det *Utdatert: dette er de sist beregnede tallene. Trykk F5 i dette dokumentet.* Pass på: *sist beregnede tall* er ikke helt riktig. Oversikten tar de gamle startdatoene, men allerede en endret varighet eller tildeling. Tallene kan derfor avvike fra både den gamle og den nye tidsplanen, og fra stolpene i Gantt-diagrammet. Stol bare på dem etter F5.
- Hvis oversikten ikke kan beregne et prosjekt, for eksempel på grunn av en løkke i avhengighetene, telles ikke prosjektet med. Det står fortsatt i listen, med *Telles ikke med: tidsplanen er ikke beregnet. Aktiver dette dokumentet og trykk F5.* Over tabellen står *Minst ett dokument er ikke beregnet og telles ikke med i belegget.*

**Oversikten stemmer ikke med det du forventer.** Kapasiteten kommer fra biblioteket (*Maksimalt antall* for biblioteksposten, eller *Tidsfasert kapasitet* på den dagen), ikke fra *Maksimalt antall* i kopien i prosjektet. En sum som er lik kapasiteten, er ikke en konflikt.

## Se også

- [Ressursbiblioteket](docs://uitleg-resourcebibliotheek): hvordan belegget telles, med et utregnet eksempel.
- [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken): koble prosjekter og tildele ressurser.
- [Løse overallokering](docs://howto-overbezetting-oplossen): overallokering binnen ett prosjekt.
