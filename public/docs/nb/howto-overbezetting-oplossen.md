# Løse overallokering

Mål: se hvor en ressurs har for mye å gjøre på en dag, og løse det. Oftest gjør du det med utjevning av aktiviteter.

## Når du trenger dette

På papiret fungerer tidsplanen din. Men murerne er tilordnet to vegger som pågår samme dager. Appen kaller det **overallokering**. En ressurs er overallokert på en arbeidsdag hvis tidsplanen krever mer av den den dagen enn kapasiteten (*Maksimalt antall*). Det gjelder også hvis ressursen ikke jobber den dagen ifølge kalenderen sin.

Du slår først opp overallokeringen. Deretter velger du en løsning. **Utjevning** er løsningen som appen beregner for deg. Den får aktiviteter til å starte senere, til ressursen klarer det. Hvordan den beregner det, leser du i [Utjevning av ressurser](docs://uitleg-nivelleren).

## Trinn

### 1. Finn overallokeringen

1. Se i båndet under *Ressurser › Overallokering*. Der står *Ingen*, eller i rødt antallet overallokerte ressurser, for eksempel *1 ressurs*. Etter en beregning står det også i statuslinjen: *⚠ 1 ressurs(er) med overallokering*.
2. Klikk på den meldingen i statuslinjen. Panelet *Advarsler* åpnes til høyre. Der er en linje for hver ressurs, for eksempel *Bricklayer* med *Overallokering på 5 dag(er) (29-06-2027 – 05-07-2027)*.
3. Klikk på den linjen. Appen slår på histogrammet, velger ressursen og markerer alle aktiviteter som ressursen er tilordnet.
4. Se på histogrammet under Gantt-diagrammet. Røde søyler er overallokerte dager. Hvis du beveger musepekeren over en dag, ser du hvilke aktiviteter som bidrar, for eksempel *2 aktiviteter bidrar på 2027-06-30* med navnene under.

Du kan også slå på histogrammet selv med *Ressurser › Histogram › Histogram*. Velg en ressurs i listen til venstre, eller bla gjennom ressursene med *Forrige* og *Neste*. En rød prikk i listen betyr at den ressursen er overallokert. Raden *Alle ressurser* legger ressursene sammen, uten materiale.

Hvis en aktivitet er valgt, viser histogrammet bare belastningen for den aktiviteten, og bare ressursene som er tilordnet den. Trykk på Esc for å fjerne markeringen og se hele prosjektet igjen.

### 2. Velg en løsning

- **Mer kapasitet.** Hvis en annen murer virkelig kommer, sett *Maksimalt antall* til 2 (se [Administrere ressurser](docs://howto-resources-beheren)). Overallokeringen er da borte.
- **Færre tildelingsenheter per dag.** Senk *Tildelingsenheter*, eller velg en annen kurve for tilordningen (se [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen)).
- **Sett aktivitetene etter hverandre.** Legg til en avhengighet mellom de to aktivitetene, slik at den andre bare starter når den første er ferdig (se [Legge til avhengigheter](docs://howto-relaties-leggen)).
- **Utjevning.** Appen får en aktivitet til å starte senere.

### 3. Utjevning

1. Kontroller at tidsplanen er beregnet med **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*.
2. Velg *Ressurser › Utjevning › Utjevn…*. Vinduet *Utjevning av ressurser* åpnes.
3. Bestem om sluttdatoen for prosjektet kan flytte seg. Lar du boksen *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast* stå av, kan sluttdatoen flytte seg. Slår du den på, flytter appen bare aktiviteter innen slakken deres.
4. Under *Ressurser* står ressursene som utjevnes. Som standard er alle ressurser avkrysset, unntatt materiale. Fjern avkrysningen ved en ressurs du vil la være i fred.
5. Klikk på *Beregn*. Mens appen beregner, står det *Beregner…*. Du kan stoppe med *Stopp*. Tidsplanen endres ennå ikke. Dette er et forslag.
6. Les forslaget. Øverst står sluttdatoen, for eksempel *Prosjektets sluttdato: uendret (30-08-2027)* eller *Prosjektets sluttdato: 25-08-2027 → 30-08-2027*. Under dette står en tabell. Den viser for hver aktivitet *Gammel start*, *Ny start* og *Dager forskjøvet*, for eksempel *Build outer cavity leaf*, 29-06-2027, 06-07-2027 og *5 d*.
7. Velg *Bruk*. Appen legger forskyvningene inn i aktivitetene og omberegner tidsplanen med én gang. Du trenger ikke å trykke på F5. *Avbryt* lukker vinduet uten endring.
8. Kontroller *Ressurser › Overallokering*. Det står nå *Ingen*.

Endrer du et valg i vinduet etter at du har klikket på *Beregn*, forsvinner forslaget. Klikk da på *Beregn* igjen. Endres tidsplanen mens appen beregner, står det *Tidsplanen ble endret under beregningen. Klikk på Beregn igjen.*

### Bestem hvilken aktivitet som blir stående

Appen plasserer aktivitetene én for én. Aktivitetene som kommer først, blir stående der de er. Aktivitetene med høyest prioritet går først. Ved lik prioritet går aktiviteten med minst slakk først.

Vil du selv bestemme hvilken aktivitet som blir stående, gi den en høyere prioritet. Høyreklikk på stolpen til aktiviteten i Gantt-diagrammet. Velg *Prioritet*, og velg så *Lav* (100), *Normal* (500) eller *Høy* (900). *Normal* er standard. Du kan også skrive et tall fra 0 til 1000 selv i kolonnen *Utjevningsprioritet*. Klikk på **+** til høyre i overskriften til aktivitetstabellen (*Legg til kolonne*), og velg den kolonnen under *Tidsplan*. Et høyere tall betyr at det er mer sannsynlig at aktiviteten blir stående. Appen godtar ikke et tall over 1000. En aktivitet med prioritet 1000 flyttes aldri på grunn av kapasitet.

### Angre og gjøre om

- *Angre* (Ctrl+Z) angrer *Bruk* i ett trinn.
- *Ressurser › Utjevning › Fjern utjevning* fjerner all utjevning fra aktivitetene. Knappen er grå så lenge det ikke finnes noen utjevning. Overallokering som kommer tilbake på den måten, er bare den samme som før.
- Har du endret tidsplanen siden, velger du bare *Utjevn…* igjen. Appen starter da på nytt. De gamle forskyvningene telles ikke med.

## Fallgruver og hva appen gjør da

**Ikke beregnet ennå.** Er tidsplanen ikke beregnet, står det i vinduet *Beregn tidsplanen (F5) før du starter utjevning.* og *Beregn* er ikke tilgjengelig.

**Gjenstående konflikter.** Ikke all overallokering kan løses ved å flytte aktiviteter. Aktivitetene som er igjen, står under *Gjenstående konflikter*, med antall dager og årsaken:

- *For lite ledig kapasitet innen slakken til å løse denne konflikten.* Du ser dette med *smoothing*: innen slakken til aktiviteten finnes det ikke et ledig øyeblikk. Fjern avkrysningen i boksen, så kan sluttdatoen flytte seg.
- *Ressursen arbeider ikke alle dagene denne aktiviteten trenger. Flytting løser ikke dette.* Ressursen har fridager i sin egen kalender midt i aktiviteten. Endre kalenderen eller aktiviteten.
- *Bricklayer krever 2 tildelingsenheter/dag på toppen, kapasiteten er 1 — kan ikke løses ved å flytte.* Via kurven sin ber aktiviteten alene om mer på én dag enn ressursen kan levere. Velg en annen kurve eller senk tildelingsenhetene.

**Det står** *Ingen aktiviteter må flyttes — tidsplanen er allerede konfliktfri.* Står den linjen sammen med listen *Gjenstående konflikter* i forslaget, stol på listen. Linjen sier bare at det ikke er noe å flytte. Står linjen uten liste, mens *Ressurser › Overallokering* fortsatt viser en ressurs, da er alle aktiviteter som gir konflikt låst på prioritet 1000 eller har allerede startet. De flyttes ikke, og vinduet rapporterer dem ikke som konflikt. Kontroller derfor alltid *Overallokering* etter at du har brukt forslaget.

**Aktiviteter som ikke flyttes.** En aktivitet som allerede er startet eller ferdig, flyttes aldri. Belastningen den gir, teller likevel med. Milepæler og faser flyttes heller ikke.

**Materiale utjevnes ikke.** Ber en materialressurs om mer enn sitt *Maksimalt antall* på en dag, teller den som overallokert i *Overallokering*. Men den står ikke i vinduet for utjevning.

**Utjevning tilpasser seg ikke.** Forskyvningene blir stående slik de ble beregnet. Endrer du varigheten til en aktivitet senere, blir en utjevnet aktivitet stående der den er. Det gjelder også hvis stedet ikke lenger trengs. Utjevn da på nytt.

**Overallokert på grunn av kalenderen.** Hvis ressursen ikke jobber en dag ifølge kalenderen sin, står det i panelet *Advarsler*, for eksempel *Overallokering på 5 dag(er) (29-06-2027 – 05-07-2027), hvorav 1 dag(er) der ressursen ikke jobber ifølge kalenderen sin*. Går en aktivitet alltid over en slik dag, som er den andre grunnen ovenfor, løser utjevning ikke dette.

## Se også

- [Utjevning av ressurser](docs://uitleg-nivelleren): hva utjevning flytter, innen slakk og utover, og hva den ikke gjør.
- [Administrere ressurser](docs://howto-resources-beheren): endre kapasiteten og kalenderen til en ressurs.
- [Legge til avhengigheter](docs://howto-relaties-leggen): sette aktiviteter etter hverandre.
- [Meldinger og advarsler](docs://ref-meldingen): advarselen om overallokering i panelet *Advarsler*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): pusserne er overallokert på 5 dager. Med *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast* på, ligger slutten fortsatt på 17. august 2027, og én konflikt er igjen. Med boksen av (standard) er alt løst, og slutten flytter seg til 24. august 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tårnkranen er overallokert på 65 dager og pusserne på 15 dager. Utjevning med boksen *Kun utjevning innen slakk (smoothing) — prosjektets sluttdato forblir fast* av, flytter slutten fra 9. mai til 12. oktober 2028.
