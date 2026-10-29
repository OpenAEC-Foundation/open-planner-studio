# Justér timefordelingen

Mål: for én tildeling bestemmer du selv, hvor meget ressourcen arbejder på hver arbejdsdag i opgaven, i stedet for at bruge en standardkurve.

## Hvornår har du brug for dette

En kurve som *Klokkeformet* er en fast form. Nogle gange ved du bedre besked. Mureren starter på den yderste skal af hulmuren med halv styrke, fordi stilladset stadig bliver sat op, og arbejder derefter fuld tid. Eller du vil holde en top lidt under kapaciteten. Så justerer du **timefordelingen**.

Du arbejder med **faser**: sammenhængende arbejdsdage, hvor ressourcen arbejder med de samme tildelingsenheder. Fordelingen ændrer kun timerne pr. dag for denne ene tildeling. Opgavens datoer ændres ikke.

## Trin

Eksemplet er den yderste skal af hulmuren: 6 arbejdsdage, én murer, 48 timer.

1. Vælg opgaven. Panelet *Egenskaber* står til højre. Ser du det ikke, så slå det til med *Visning › Paneler › Egenskaber*.
2. Klik på murerens navn i afsnittet *Tildelinger*. *Kurve* og knappen *Rediger timefordeling…* vises under navnet. Klik på *Rediger timefordeling…*. Vinduet *Timefordeling i faser* åbner. Du starter fra det, appen aktuelt har tildelt. For den yderste skal af hulmuren er det én fase på 6 dage med tildelingsenheder på 1.
3. Vælg om nødvendigt et startpunkt ved *Anvend form:*. Med *Klokkeformet* laver appen fem faser: 0,18 enheder på den første og den sidste dag, 0,84 på den anden og den femte dag og 1,98 på de to midterste dage. Den samlede tid forbliver 48 timer.

### Justér faserne

Du kan arbejde i tabellen eller i stripen over den.

- I en fase skriver du en anden værdi i *Tildelingsenheder pr. dag*. Kolonnerne *Timer/dag* og *Timer* beregnes automatisk med.
- Ændr antallet af *Dage* i en fase. Den sidste fase løber altid til slutningen af opgaven og får de resterende dage.
- Vælg *Opdel* for at dele en fase i to, fx 6 dage i 3 og 3. Vælg *Sammenlæg* for at lægge en fase sammen med den næste.
- I stripen trækker du en grænse for at forlænge eller forkorte en fase. Du trækker den øverste kant for at sætte tildelingsenhederne. Du dobbeltklikker på en dag for at opdele en fase.

### Anvend ændringen

Vælg *Anvend*. Med *Annuller* lukkes vinduet uden ændring.

Et eksempel. Du vælger *Opdel*, sætter *Dage* for den første fase til 2 og tildelingsenhederne for den fase til 0,5. Den anden fase løber så 4 dage med 1 tildelingsenhed pr. dag. Den samlede tid er 2 × 0,5 × 8 + 4 × 1 × 8 = 40 timer.

Efter *Anvend* er tildelingens kurve sat til *Profil*, og den er deaktiveret. *Tildelingsenheder* forbliver uændret. Et søjlediagram-ikon vises nu ved siden af navnet, også når tildelingen er klappet sammen. Histogrammet og overallokeringen følger den nye fordeling med det samme. Du behøver ikke at genberegne, fordi ingen datoer flyttes.

### Frigiv fordelingen

Har tildelingen en egen fordeling, har vinduet også *Frigiv fordeling*. Dermed fjerner du din egen fordeling, og appen bruger igen *Tildelingsenheder* og kurven. Vælg også dette, hvis du vil ændre kurven. Rullelisten *Kurve* er deaktiveret, så længe der er en egen fordeling.

## Faldgruber og hvad appen gør så

**Den samlede tid ændrer sig med.** Du fordeler ikke timerne, du bestemmer dem. Hvis du sætter en fase til 0,5 i stedet for 0,18, bliver den samlede tid større. Den samlede tid i timer står nederst i vinduet, så kontrollér den, før du vælger *Anvend*.

**Hvad tildelingsenhederne gør bagefter, afhænger af opgavetypen.** Med *Fast varighed og faste enheder* ændrer andre *Tildelingsenheder* ikke noget ved fordelingen. Med *Fast varighed og fast arbejde* skalerer appen timerne pr. dag med de nye tildelingsenheder. Ved 2 tildelingsenheder i stedet for 1 bliver hver dag dobbelt, og den samlede tid også (fra 32 til 64 timer). Varigheden forbliver den samme. Med *Fast arbejde* ændrer tildelingsenhederne opgavens varighed. Fordelingen bliver så presset sammen eller strakt ud over den nye varighed, med samme samlede tid. Med *Faste enheder* ændrer tildelingsenhederne også varigheden. Kontrollér bagefter den samlede tid nederst i vinduet.

**Ændrer du opgavens varighed, strækkes fordelingen med.** Formen forbliver den samme. Med *Fast varighed og faste enheder* og med *Faste enheder* vokser den samlede tid i forhold til varigheden. Hvis varigheden af en opgave med en egen fordeling fordobles fra 4 til 8 arbejdsdage, fordobles den samlede tid også, fra 32 til 64 timer. Med *Fast varighed og fast arbejde* og med *Fast arbejde* forbliver den samlede tid den samme (32 timer forbliver 32 timer), og enhederne falder.

**Arbejdet følger fordelingen.** *Arbejde (t)* bliver summen af dine faser, også under *Fast arbejde*. Opgavens varighed ændres ikke af den grund.

**Ugyldige tildelingsenheder.** Et tomt eller negativt felt får en rød kant, og *Anvend* er da deaktiveret. En fase med 0 tildelingsenheder er tilladt. En sådan fase forbliver inden for opgavens varighed.

**Alt gælder for denne ene tildeling.** Appen siger det selv: *Fordelingen ændrer kun timerne pr. dag for denne tildeling; opgavens datoer og opdelinger forbliver, som de er.* Andre ressourcer på samme opgave beholder deres egen fordeling.

**Udjævning følger fordelingen.** Udjævningen tæller de samme timer pr. dag som histogrammet.

**Fortrydelse.** *Anvend* og *Frigiv fordeling* er hver ét trin for *Fortryd* (Ctrl+Z).

## Se også

- [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen): at sætte en ressource på en opgave og vælge en kurve.
- [Løsning af overallokering](docs://howto-overbezetting-oplossen): hvad du gør, når en ressource har for meget at lave på én dag.
