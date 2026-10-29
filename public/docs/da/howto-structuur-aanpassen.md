# Tilpasse strukturen

Mål: ordne opgaver i faser og underopgaver, ændre deres rækkefølge og sørge for, at WBS-numrene er korrekte.

## Hvornår du har brug for det

Din tidsplan er et træ: faser (hovedopgaver) med underopgaver under sig, for eksempel *Foundation* med *Groundwork*, *Reinforcement* og *Pouring*. Du justerer træet, når du vil hænge opgaver under en fase, tage en opgave ud af en fase, eller når rækkefølgen er forkert. **WBS-koden** (1, 1.1, 1.2, 2, …) er en opgaves nummer i træet.

## Trin

### At indrykke en opgave

1. Vælg opgaven. Det er fint at vælge flere opgaver.
2. Vælg *Tidsplan › Struktur › Indryk*. Du kan også bruge Alt+→ (eller Alt+Shift+→) eller *Indryk* i genvejsmenuen.

Opgaven bliver den sidste underopgave under den foregående opgave på samme niveau. Den opgave bliver dermed en hovedopgave. Hvis du vælger en sammenhængende blok, indrykkes blokken som helhed. Hvis opgaven ikke har en foregående opgave på samme niveau, sker der ingenting, og der kommer ingen besked.

### At udrykke en opgave

Vælg *Tidsplan › Struktur › Udryk*, tryk på Alt+← (eller Alt+Shift+←), eller vælg *Udryk* i genvejsmenuen.

Opgaven bliver en opgave på samme niveau, lige efter den fase, den hang under. Dens egne underopgaver følger med. De opgaver, der kom efter den i fasen, bliver i fasen. En opgave på øverste niveau kan ikke længere udrykkes.

### Flytning af en opgave

Du har tre måder.

- **Med tastaturet.** Alt+↑ og Alt+↓ bytter opgaven med naboen på samme niveau. En hovedopgave tager sine underopgaver med. Øverst eller nederst på niveauet sker der ingenting. Når flere opgaver er valgt, er det kun den opgave, du klikkede på først, der bevæger sig.
- **Træk i opgavetabellen.** Tryk på en række, og træk lodret. Den øverste fjerdedel af en række betyder *før*, og den nederste fjerdedel betyder *efter*. Midten af en hovedopgave hænger opgaven under den som sidste underopgave. Midten af en almindelig opgave tæller som den nærmeste kant. Hvis du trækker en række, der hører til et flervalg, følger hele valget med.
- **Træk i Gantt-diagrammet.** Træk bjælken lodret til en anden række. Det virker på samme måde som at trække i opgavetabellen, og det ændrer ingen datoer. Hvis du trækker vandret, ændrer du i stedet datoerne.

Hver flytning kan fortrydes i ét trin med *Fortryd* (Ctrl+Z).

### Holde WBS-numrene opdaterede

Se på knappen *WBS auto* i *Tidsplan › Struktur*.

- **Til (standard i et nyt projekt).** Indstillingen er også slået til, når du åbner en fil uden denne indstilling, hvis alle WBS-koder allerede passer til nummereringen af træet (1, 1.1, 1.2 …). Koderne ændrer sig ikke. En tom fil uden denne indstilling får også *til*, ligesom et nyt projekt. Appen nummererer hele træet om ved hver tilføjelse, sletning og flytning. WBS-koden er så skrivebeskyttet: du kan ikke skrive den i opgavetabellen eller i panelet *Egenskaber*. *Nummerer WBS om* er deaktiveret.
- **Fra.** Standard i en fil med egne koder, for eksempel *A1000*, eller med én kode, der afviger fra træet. Kodene bliver, som de er, også efter flytning og efter at opgaver er indrykket. Du skriver dem selv i kolonnen *WBS* eller i feltet *WBS-kode* i *Egenskaber*, eller du får dem nummereret om én gang med *Nummerer WBS om*. Det overskriver også koder, du selv har skrevet.

Hvis du slår *WBS auto* til, nummererer appen træet med det samme. Både *WBS auto* og *Nummerer WBS om* kan fortrydes med *Fortryd*.

## Faldgruber og hvad appen gør

**Filtrering, gruppering eller sortering er slået til.** Rækkefølgen, du ser, er så ikke rækkefølgen i tidsplanen, så appen låser strukturen. *Indryk* og *Udryk* er deaktiverede, med værktøjstippet *Ikke tilgængelig under filtrering/gruppering/sortering*. Med Alt+→ eller ved at trække vises den samme tekst i en rød stribe med knappen *Ryd*. Det fjerner filter, gruppering og sortering på én gang, og Ctrl+Z henter dem ikke tilbage. Striben bliver, indtil du klikker på krydset, bruger Ctrl+Z eller Ctrl+Y, eller går til et andet dokument. *Indryk* og *Udryk* mangler så i genvejsmenuen.

Alt+↑ og Alt+↓ virker dog i sådan en visning, uden besked. Med kun et filter ser du den nye rækkefølge med det samme. Ved sortering ændrer rækkefølgen i tidsplanen sig, men du ser det først efter *Ryd*.

**WBS auto er fra.** Det sker ved en fil med egne koder, eller ved en fil der gemmer indstillingen som *fra*. En ny opgave får den kode, der passer til dens plads i træet, også selv om en anden opgave allerede har den kode. Dermed kan der opstå dubletnumre. Også efter at du har indrykket, passer koderne ikke længere til træet. *Nummerer WBS om* retter begge dele.

**En milepæl får underopgaver.** En milepæl er et tidspunkt og har ingen underopgaver. Appen fjerner markeringen som milepæl og giver dig besked.

**En opgave med tildelinger til ressourcer får underopgaver.** En hovedopgave har ikke selv tildelinger. Derfor spørger appen først, hvad der skal ske med dem, i vinduet *Opgave bliver en hovedopgave*. Det sker, når du indrykker, bruger *Tilføj underopgave* eller *Tilføj milepæl* på en opgave, indsætter en skabelon, og i *Rediger opgave*, når du vælger en ny *Overordnet opgave*: for en eksisterende opgave og for en ny opgave. I *Rediger opgave* kommer spørgsmålet før gemning. Hvis du vælger *Annuller* der, forbliver *Rediger opgave* åben med dine ændringer. Du vælger:

- *Annuller*: intet ændres, og strukturen forbliver også, som den var.
- *Fjern tildeling*: opgaven får sine underopgaver, og tildelingerne fjernes. Det faktiske arbejde på disse tildelinger fjernes også.
- *Flyt til '…'*: tildelingerne flyttes til den første nye underopgave, der kan bære dem. Det faktiske arbejde flyttes også med. En milepæl eller en hovedopgave bærer ingen tildelinger.

Har den underopgave allerede den samme ressource, eller findes der ingen passende underopgave, er *Flyt* deaktiveret. En orange blok i vinduet fortæller dig hvorfor.

Har en tildeling allerede faktisk arbejde, fortæller den orange blok, hvor mange timer der gælder for hver ressource, for eksempel *Tildelingen af Metselaar har allerede 8 timer faktisk arbejde. Hvis du fjerner den, går det arbejde tabt.* *Annuller* er så standardknappen: Enter ændrer ikke noget. Vil du stadig fjerne tildelingen, skal du selv klikke på *Fjern tildeling*.

Mens vinduet er åbent, virker ingen genvej uden for vinduet, inklusive *Fortryd*, *Indsæt*, Slet, F5 og Ctrl+S. Hvis én handling laver flere hovedopgaver på én gang, viser vinduet ressourcerne pr. opgave, og dit valg gælder for dem alle. Ét *Fortryd* (Ctrl+Z) fortryder hele handlingen.

**En afhængighed ville skabe en cyklus.** Afhængighederne for en hovedopgave gælder også for dens underopgaver. Hvis en flytning på grund af det ville skabe en cyklus, afviser appen den med beskeden *Denne flytning ville skabe en cyklus i tidsplanen (…)*. Intet ændres.

**En afhængighed mellem en opgave og dens egen fase.** Hvis du sætter en opgave under en fase, som opgaven allerede har en afhængighed med, forbliver afhængigheden, men den tæller ikke længere i beregningen. Appen giver dig besked. Du kan læse mere om afhængigheder på hovedopgaver i [Afhængigheder og forsinkelse](docs://uitleg-relaties).

**Tidsplanen er ikke længere opdateret.** En flytning til en anden fase kan ændre datoer. Tryk på **Beregn** (F5). Kun at bytte rækkefølgen inden for samme fase gør det ikke.

## Se også

- [Tilføje opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen): sæt nye opgaver på det rigtige sted.
- [Gemme og indsætte WBS-skabeloner](docs://howto-wbs-sjablonen): genbrug en hel fase.
- [Tilføje afhængigheder](docs://howto-relaties-leggen): sammenkæd opgaver med hinanden.
- [Vælge, slette og fortryde opgaver](docs://howto-taken-selecteren-verwijderen): fortryd en flytning.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): fire faser med deres underopgaver, sådan som du bygger dem op ved at indrykke.
