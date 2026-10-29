# Administrer ressourcer

Mål: opret, redigér og slet ressourcer (personer, maskiner og materiale) i dit projekt, så du kan tildele dem til opgaver.

## Hvornår du har brug for dette

Før du sætter en murer eller en kran på en opgave, skal den person eller maskine findes som ressource. Ressourcen registrerer, hvor meget der er af den, og på hvilke dage den arbejder. Med det kan appen finde ud af, om du belaster den for meget på én dag. Du redigerer en ressource, når bemandingen ændres, for eksempel når en ekstra murer kommer til.

To begreber. **Maksimalt antal enheder** er kapaciteten per arbejdsdag: 1 er én person eller maskine, 2 er to af dem. En **tildeling** er en ressource på en opgave (se [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen)).

## Trin

### Oprettelse af en ressource

1. Vælg *Ressourcer › Administrer › Opret ressource*. Ressourcepanelet overtager arbejdsområdet, og en tom række vises nederst i tabellen. Du kan også åbne panelet med *Ressourcer › Administrer › Ressourcer* og så vælge *Opret ressource i projektet*.
2. Skriv navnet, for eksempel *Bricklayer*.
3. Vælg *Type*: *Arbejde* (standard), *Udstyr*, *Materiale*, *Underentreprenør* eller *Arbejdsskift*.
4. Udfyld de andre felter, hvis det er nødvendigt. Alt har en standardværdi: *Maksimalt antal enheder* er 1, og *Kalender* er *Projektkalender*. *Standardsats/time* er tom. Du kan kun udfylde *Enhed* for typen *Materiale*, for eksempel m³.
5. Tryk på Enter, eller klik uden for rækken. Ressourcen står i tabellen. Med Enter åbnes straks en tom række under den for den næste. Tryk på Esc, når du er færdig.

Rækken bliver først en ressource, når den har et navn. Med Esc, eller hvis du klikker væk uden navn, opretter appen intet. Rækkefølgen, du udfylder ting i, betyder ikke noget. Du må gerne vælge typen først og skrive navnet bagefter.

### Redigering af en ressource

Redigér felterne i rækken. Appen gemmer navnet, standardsatsen og enheden, når du forlader feltet, og de andre felter straks.

- *Maksimalt antal enheder* accepteres kun af appen, hvis værdien er større end 0. Med 0 eller mindre får feltet en rød kant og springer tilbage til den forrige værdi.
- *Kalender* bestemmer på hvilke dage ressourcen arbejder. Vælg *Projektkalender* eller en egen kalender. Med *+ Ressourcekalender* opretter du en ny, og blyanten (*Redigér…*) åbner den valgte kalender. Hvis en opgave er planlagt på en dag, hvor ressourcen ifølge sin kalender er fri, tæller den dag som overallokeret. Hvordan du opretter en ressourcekalender, beskrives i [Opsætning af en ressourcekalender](docs://howto-resourcekalender-instellen).
- *Standardsats/time* og *I alt*: *I alt* er de belastede timer for den ressource gange standardsatsen. En stukkatør, der er belastet i 32 timer med en standardsats på 50 pr. time, giver 1.600,00. Nederst i tabellen står summen af alle ressourcer.
- *Arbejdsskift* grupperer en ressource under en ressource af typen *Arbejdsskift*. Det er kun en gruppering: appen lægger ikke kapaciteten eller belastningen af medlemmerne sammen i arbejdsskiftet.
- Den farvede firkant til venstre er ressourcens farve. Den vises kun og har ingen effekt på tidsplanen.

### Kapacitet, der ændrer sig over tid

Kommer din anden murer først den 19. juli? Klik på pilen ved siden af *Maksimalt antal enheder*. Under *Tidsfaseret kapacitet* vælger du *Tilføj trin*. Hvert trin har en dato (*Fra*) og et tal (*Maksimalt antal enheder*). Fra den dato gælder det tal. Uden trin gælder den vaste værdi altid.

Et nyt trin begynder med dagens dato og 1 enhed. Ændr begge dele, for ellers gælder en kapacitet på 1 fra i dag.

### Sletning af en ressource

1. Klik på papirkurven i rækken.
2. Har ressourcen tildelinger, spørger appen om bekræftelse, for eksempel *'Bricklayer' har 4 tildeling(er) — slet?*. Klik på fluebenet for at slette, eller på krydset for at annullere. Uden tildelinger forsvinder ressourcen straks.

Ressourcens tildelinger følger med den. Har en opgave en opgavetype anden end *Fast varighed og faste enheder*, fordeler appen arbejdet fra den fjernede ressource over de ressourcer, der er tilbage. Afhængigt af opgavetypen ændrer det deres tildelingsenheder eller opgavens varighed. Ændrer varigheden sig, er tidsplanen ikke længere opdateret.

Du kan fortryde oprettelse, redigering og sletning med *Fortryd* (Ctrl+Z).

### Det lille overblik i sidekolonnen

*Ressourcer › Administrer › Ressourcedock* viser et kompakt overblik i den højre kolonne, ved siden af *Egenskaber*. Der ser du navn og farve for hver ressource, og et advarselssymbol (*Overallokeret*) ved en ressource, der er overallokeret. Du kan kun ændre *Maksimalt antal enheder* der. Vælger du en eller flere opgaver, viser overblikket kun ressourcerne for dem.

## Faldgruber, og hvad appen gør så

**Kun typen *Materiale* gør en forskel for beregningen.** Arbejde, Udstyr, Underentreprenør og Arbejdsskift behandles ens. Materiale tæller ikke med i en opgaves varighed og udjævnes ikke. I histogrammet tæller rækken *Alle ressourcer* heller ikke materiale med.

**Intet navn, ingen ressource.** En tom række forsvinder uden spor.

**Et nyt trin i kapaciteten.** Glemmer du at ændre datoen og tallet, er kapaciteten 1 fra i dag.

**Fjerner du en ressource, du stadig har brug for.** Hvis du sletter den ved en fejl, tryk straks på Ctrl+Z. Tildelingerne kommer også tilbage.

## Se også

- [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen): at sætte en ressource på en opgave.
- [Opsætning af en ressourcekalender](docs://howto-resourcekalender-instellen): at vastlægge arbejdsdagene for én ressource.
- [Løsning af overallokering](docs://howto-overbezetting-oplossen): hvad du gør, når en ressource har for meget at lave på en dag.
- [Ressourcepanel](docs://ref-resourcepaneel): alle felter og knapper i ressourcepanelet.
