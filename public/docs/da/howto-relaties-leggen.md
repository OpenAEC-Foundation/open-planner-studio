# Tilføj afhængigheder

Mål: sammenkæd opgaver, så en opgave kun starter, når arbejdet før den er færdigt, og tilføj en ventetid (forsinkelse) mellem dem, hvor det er nødvendigt.

## Hvornår du har brug for det

Uden afhængigheder ved appen ikke, at murerne kun kan starte, når fundamentet er støbt. Så starter alle opgaver på projektstartdatoen, og slutdatoen betyder ikke noget. En **afhængighed** registrerer den rækkefølge. Den første opgave er den **foregående opgave**, den anden er den **efterfølgende opgave**.

Du tilføjer afhængigheder, når du bygger en tidsplan, når du tilføjer en opgave, eller når to opgaver viser sig at afhænge af hinanden alligevel. En **forsinkelse** er ventetid mellem to opgaver, fx beton der skal hærde, eller et gulvlag der skal tørre.

Standardafhængigheden er **FS** (slut til start): den efterfølgende opgave kan først starte, når den foregående opgave er færdig. Appen kender også SS, FF og SF. Disse knytter en start eller en slut til en start eller en slut. Med SS (start til start) kan pudsningen fx kun starte, når installationerne er startet.

Er du ikke sikker på hvilken type du har brug for? Under typevalget forklarer en sætning med de rigtige opgavenavne det, fx *Metselwerk kan først starte, når Fundering er færdig.* Vælg en anden type, så ændrer sætningen sig. Du ser den i vinduet *Type afhængighed*, i blokken *Afhængigheder* og i kolonnen *Foregående opgaver* eller *Efterfølgende opgaver*.

## Trin

Der er fire måder at tilføje en afhængighed på. De opretter den samme afhængighed. Vælg den, der passer bedst til din situation.

### Sammenkæd to valgte opgaver

Nyttigt, når du arbejder i opgavetabellen.

1. I opgavetabellen klikker du på den opgave, der kommer først: den foregående opgave.
2. Hold Ctrl (⌘ på en Mac) nede, og klik på den opgave, der kommer efter: den efterfølgende opgave.
3. Vælg *Start › Opgaver › Sammenkæd ▾ › Sammenkæd valgte opgaver*. Den samme knap findes også under *Tidsplan › Afhængigheder*.

Appen opretter en afhængighed af typen slut til start uden forsinkelse. Du ser den som en pil i Gantt-diagrammet og i kolonnen *Foregående opgaver*. En meddelelse vises kun, hvis appen afviser afhængigheden. Knappen virker kun, når du har valgt præcis to opgaver.

### Tegn en afhængighed i Gantt-diagrammet

Nyttigt, når du tilføjer mange afhængigheder efter hinanden.

1. Vælg *Start › Opgaver › Sammenkæd ▾ › Tegn afhængighed*. Over tidsplanen vises meddelelsen *Afhængighedstilstand: træk i Gantt fra én bjælke til en anden for at oprette en afhængighed. Esc stopper.*
2. Hold museknappen nede på den foregående opgaves bjælke, og træk til den efterfølgende opgaves bjælke. En stiplet linje med en pil følger din markør.
3. Slip museknappen. Et lille vindue *Type afhængighed* vises med typen (FS som standard) og et felt til forsinkelsen.
4. Ændr typen eller forsinkelsen, hvis det er nødvendigt, og tryk på Enter, eller klik uden for vinduet. Afhængigheden oprettes.
5. Tilføj den næste med det samme: tilstanden forbliver aktiv. Du stopper med Esc, med knappen *Stop* i meddelelsen, eller ved at vælge *Tegn afhængighed* igen.

Trykker du på Esc i vinduet *Type afhængighed*, gemmes der ingenting. Til én enkelt afhængighed behøver du ikke at slå tilstanden til: hold Skift nede, mens du trækker fra bjælke til bjælke. *Start afhængighed herfra* i en bjælkes højreklikmenu slår afhængighedstilstanden til. Du trækker stadig selv. På fanen *Tabel* uden Gantt-diagram er *Tegn afhængighed* deaktiveret.

### Tilføj en afhængighed i egenskabspanelet

Nyttigt, når du kigger på én opgave og vil tilføje dens foregående eller efterfølgende opgaver.

1. Vælg opgaven. Panelet *Egenskaber* er til højre. Ser du det ikke, slår du det til med *Visning › Paneler › Egenskaber*.
2. I blokken *Afhængigheder* klikker du på *Tilføj afhængighed*.
3. Lad retningen stå på *Foregående opgave*, hvis den anden opgave kommer først. Eller vælg *Efterfølgende opgave*.
4. Skriv en del af den anden opgaves navn. Vælg den rigtige med piletasterne og Enter, eller klik på den.
5. Vælg typen (FS som standard), og udfyld en forsinkelse, hvis det er nødvendigt.
6. Tryk på Enter, eller klik på fluebenet (*Gem afhængighed*).

Opgavens afhængigheder vises derefter i *Afhængigheder*, hver med den anden opgaves WBS-nummer, typen og forsinkelsen.

### Skriv afhængigheder i kolonnen for foregående opgaver

Nyttigt, når du arbejder hurtigt med tastaturet og kender WBS-numrene.

1. Klik på **+** til højre i overskriften på opgavetabellen (*Tilføj kolonne*), og vælg under *Afhængigheder* kolonnen *Foregående opgaver*. Kolonnen *Efterfølgende opgaver* virker på samme måde.
2. Klik i cellen for den efterfølgende opgave i kolonnen *Foregående opgaver*.
3. Skriv WBS-nummeret for den foregående opgave, et mellemrum og typen, fx `2.6 FS`. Skriv en forsinkelse lige efter: `2.6 FS+1d`. Adskil flere foregående opgaver med semikolon eller komma: `3.1 FS; 3.2 SS+2d`.
4. Tryk på Enter.

Det, du skriver, erstatter hele cellen. Står der allerede foregående opgaver i cellen, skriv dem også med (se faldgruberne). Trykker du på Enter eller F2 i cellen i stedet for at skrive, åbnes et felt, der beholder de eksisterende afhængigheder. Du søger efter en opgave med WBS-nummer eller navn, og vælger typen og forsinkelsen for hver afhængighed.

### Sæt eller ændr en forsinkelse

Du skriver en forsinkelse i feltet ved siden af typen, på hver af måderne ovenfor. Du ændrer en eksisterende forsinkelse i *Afhængigheder*: klik i forsinkelsesfeltet, skriv den nye værdi, og tryk på Enter.

- `3` eller `3d`: 3 arbejdsdage. En weekend tæller ikke med. Appen viser `+3d`.
- `3ed`: 3 kalenderdage. Weekenden tæller med, ligesom ved beton, der også hærder lørdag og søndag.
- `-1`: et forskud. Den efterfølgende opgave må starte en dag tidligere, så opgaverne overlapper.
- `4h`: 4 arbejdstimer. Appen viser det som `+4h`. Er den foregående opgave en dagopgave i en kalender uden egne tidsbånd, fx standardkalenderen, omregner appen det til hele arbejdsdage, afrundet til nærmeste hele dag: `4h` gælder så som 1 dag, `2h` som 0. I en kalender med egne tidsbånd, eller efter en timeopgave, tæller forsinkelsen præcist i timer.
- `50%`: halvdelen af den foregående opgaves varighed.

Eksempel: fundamentsbetonen skal hærde, før murerne kan arbejde på den, så *Pour foundation → Foundation brickwork* får en FS-afhængighed med forsinkelse `3`. Hvis støbningen er fredag den 18. juni 2027, starter murværket efter **Beregn** torsdag den 24. juni: mandag til onsdag er ventetid. Med `3ed` tæller weekenden med, og murværket starter tirsdag den 22. juni.

### Til sidst: genberegn

En ny afhængighed flytter endnu ikke nogen bjælker. Statuslinjen siger *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), fx via *Start › Tidsplan › Beregn*. Først da får de efterfølgende opgaver deres nye datoer. Vil du have appen til at gøre det for dig, slår du *Beregn automatisk* til under *Indstillinger › Projekt › App-indstillinger*, fanen *Tidsplan*.

## Faldgruber og hvad appen gør

**Omvendt rækkefølge.** Med *Sammenkæd valgte opgaver* tæller den rækkefølge, du klikker i, ikke rækkefølgen i listen. Klikker du først på den senere opgave, vender afhængigheden forkert. Slet den i *Afhængigheder* med papirkurv-ikonet, og tilføj den igen.

**Skrivning i kolonnen sletter det, der stod der.** Indeholder cellen `3.4 FS; 3.2 FS`, og skriver du kun `3.2 FS`, er afhængigheden med 3.4 væk, uden en meddelelse. Skriv alle foregående opgaver, brug Enter eller F2 for at tilføje til dem, eller fortryd med Ctrl+Z.

**En cyklus.** Tilføjer du en afhængighed, der fører tilbage til en opgave tidligere i kæden, kan tidsplanen aldrig beregnes. Appen afviser en sådan afhængighed: *Denne afhængighed ville skabe en cyklus i tidsplanen (…), og den er ikke oprettet*, med opgaverne i cyklussen i parentes. Slet først den afhængighed, der lukker cyklussen.

**En opgave og dens egen hovedopgave.** En afhængighed mellem en opgave og den hovedopgave, den ligger under, er ikke mulig. Appen siger: *En afhængighed mellem en opgave og dens egen (over)ordnede hovedopgave er ikke tilladt.*

**Dublet.** Findes afhængigheden allerede, siger appen *Denne afhængighed findes allerede*, og intet ændres.

**Kortere meddelelser i kolonnen.** Kolonnen *Foregående opgaver* giver de samme afvisninger med en kortere tekst under cellen: *Denne ændring vil skabe en cyklus i tidsplanen.*, *Denne afhængighed findes allerede.* eller *En opgave kan ikke have en afhængighed med sin egen hovedopgave.* Skriver du kun et WBS-nummer, fx `3.1`, mangler typen, og cellen siger *Brug fx 1.2 FS+2d.* Cellen forbliver åben. Ret input, eller tryk på Esc for at annullere.

**Ingen halve dage i forsinkelse.** En forsinkelse i dage er altid et helt tal: `1.5` bliver til `+2d`, og en timeforsinkelse efter en dagopgave i en kalender uden egne tidsbånd afrundes til hele arbejdsdage. Input, der ikke kan læses, fx et ord, gemmes ikke. Feltet springer tilbage til den forrige værdi.

## Se også

- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad appen beregner ud fra dine afhængigheder, og hvorfor en opgave bliver kritisk.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): hvad de fire typer afhængighed og en forsinkelse gør ved datoerne.
- [Følg en vej](docs://howto-pad-traceren): at få kæden af foregående opgaver og efterfølgende opgaver vist.
- [Opgavedialog og egenskabspanel](docs://ref-taak-eigenschappen): felterne til afhængigheder og forsinkelse i panelet og dialogen.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): en kæde af afhængigheder af typen slut til start med én start til start (vægge og tag, forsinkelse på 2 dage) og én slut til slut (fliser og maling, forsinkelse på 1 dag).
