# Dage og timer

En opgave på 2 dage og en opgave på 16 timer ser ens ud, men appen beregner dem forskelligt. Hvorfor kan du vælge mellem dage og timer? Og hvad sker der, når en opgave i timer er knyttet til en opgave i dage? I denne artikel læser du, hvordan appen tæller dage og timer, og hvor den runder af. Det gennemregnede eksempel viser tallene.

## Begrebet

En **dagopgave** har en varighed i hele arbejdsdage, for eksempel `5d`. Den optager hele arbejdsdage. På standardkalenderen har den en start- og slutdato uden klokkeslæt.

En **timeopgave** har en varighed i arbejdstimer, for eksempel `12h` eller `1h 30m`. Den har en start og en slut med et klokkeslæt, for eksempel tirsdag kl. 11:00.

Enheden hører til opgaven, ikke til projektet. Du kan blande dagopgaver og timeopgaver i én tidsplan. Det kaldes **blandet planlægning**.

Du bruger timer til opgaver, der ikke passer i hele dage: en kran, du lejer i tolv timer, en støbning på seks timer og en opgave, der kun kan starte efter frokost. Til alt andet er dage nok, og de er tydeligere.

**Timeplanlægning** er slået fra som standard. Så længe den er slået fra, arbejder appen i dage. Hvis en fil alligevel indeholder timeplanlægning, for eksempel opgaver i timer, viser appen *Denne fil indeholder timeplanlægning.* Disse opgaver beregnes stadig, men du kan kun ændre deres varighed, når du slår timeplanlægning til.

## Sådan beregner appen

### Arbejdstid og standard arbejdsdag

Hver kalender har **tidsbånd** for hver arbejdsdag (i appen kaldet *tidsbånd*). Standardkalenderen har kl. 07:00 til 12:00 og kl. 13:00 til 16:00. Mellemrummet er pausen. Appen udleder tidsbåndene af kalenderens *Start (time)*, *Slut (time)* og pause; du behøver ikke at indstille noget til det. Hvis du selv angiver tidsbånd pr. ugedag, har de forrang.

**Standard arbejdsdag** er den arbejdsdag, der forekommer oftest. Dens længde er summen af dens tidsbånd. Det er altså ikke et gennemsnit: med mandag på 16 timer og tirsdag til fredag på 10 timer er standard arbejdsdagen 10 timer. Hvis arbejdsdagene har forskellig længde, gælder den hyppigst forekommende daglige total. Ved lige mange gælder den højeste. Med fire dage på 8 timer og en fredag på 5 timer er standard arbejdsdagen dermed 8 timer. En kalender med egne timer pr. dag (for eksempel fra Primavera P6) regner også med denne daglige total, og kalendervinduet viser den. Den egne værdi bevares ved eksporten. Hvis den afviger, viser kalendervinduet en orange blok under *Standard arbejdsdag*. En opgave på 1870 timer med arbejdsdage på 10 timer varer derfor 187 dage, også hvis kalenderens egen værdi er 8 timer pr. dag.

### En opgave i timer

Appen tæller arbejdsminutter fra starten, gennem tidsbåndene. Pauser, aftener, weekender og helligdage tæller ikke med. En opgave på 12 timer passer derfor ikke i én arbejdsdag på 8 timer: den fortsætter til næste dag.

### En opgave i dage

Appen tæller hele arbejdsdage. Timerne pr. dag spiller ingen rolle. En opgave på 5 dage slutter på samme dag, uanset om kalenderen har 6 eller 8 timer pr. dag.

### Omregning mellem dage og timer

En dag er standard arbejdsdagen i opgavens kalender. Appen bruger det de tre steder:

- Til *Varighedsvisning*. Under *Indstillinger › Projekt › App-indstillinger*, fanen *Udseende*, vælger du *Automatisk (egen enhed pr. opgave)*, *Altid dage* eller *Altid timer*. En opgave på 18 timer vises under *Altid dage* som `2.25d(18t)`: den egne enhed står i parentes.
- Til en forsinkelse i timer efter en dagopgave (se *Afrunding*).
- Når du skifter enheden for en opgave. Appen tæller så dagene fra opgavens start, hver dag med sine egne timer, og omregner varigheden med det samme, hvis resultatet er præcist. To dage bliver `16t`. På en kalender, hvor fredag har 5 timer, bliver 5 dage fra mandag `37t`. Tolv timer kan ikke omregnes til hele dage på en kalender med dage på 8 timer: appen lader enheden stå.

### Dagopgaver og timeopgaver sammen

Reglerne nedenfor gælder for en afhængighed af typen slut til start på en kalender uden egne tidsbånd, for eksempel standardkalenderen.

- **Time → time.** Den efterfølgende opgave begynder i det øjeblik, den foregående opgave er færdig, også hvis det er midt på dagen.
- **Time → dag.** En dagopgave begynder aldrig midt på en dag. Den begynder på den første arbejdsdag efter den dag, hvor timeopgaven slutter. Resten af den dag bliver ubrugt og kommer tilbage som slæk på timeopgaven.
- **Dag → time.** En dagopgave optager hele sin sidste dag. Timeopgaven begynder på den første arbejdsdag efter den, ved starten af det første tidsbånd.

### Afrunding

Appen runder af eller afviser på fire steder:

- **En dagopgave efter en timeopgave** begynder på den næste arbejdsdag. Timeopgaven rundes så at sige op til hele dage.
- **En forsinkelse i timer** tæller i forsinkelseskalenderen, som standard den foregående opgaves kalender. Hvis den foregående opgave er en dagopgave på en kalender uden egne tidsbånd, for eksempel standardkalenderen, omregner appen forsinkelsen til hele arbejdsdage: forsinkelsen divideret med timerne i standard arbejdsdagen, afrundet til et helt tal; en halv dag rundes op. Ved 8 timer pr. dag tæller 1 time som 0 dage, 4 timer som 1 dag og 12 timer som 2 dage. Det gælder også, hvis den efterfølgende opgave er en timeopgave. Hvis den foregående opgave er en timeopgave, eller dens kalender har egne tidsbånd, tæller forsinkelsen præcist i arbejdstimer, og pausen tæller ikke med.
- **En varighed i dage** er altid et helt tal. Hvis du skriver `1.5d`, viser appen *Indtast et helt antal dage eller timer, for eksempel 2d eller 12t.* En varighed i timer kan være `1.5h` eller `1h 30m`.
- **Skift af enhed** sker kun, hvis resultatet er præcist (se ovenfor).

## Gennemregnet eksempel: kranen

Kalenderen er mandag til fredag fra kl. 07:00 til 12:00 og fra kl. 13:00 til 16:00: en standard arbejdsdag på 8 timer. Projektstartdatoen er mandag den 7. juni 2027.

### Time, time og dag

*Place crane* varer 12 timer. Mandag har 8 arbejdstimer (5 indtil kl. 12:00 og 3 efter pausen), og tirsdag de sidste 4 timer. Opgaven løber fra mandag kl. 07:00 til **tirsdag den 8. juni kl. 11:00**.

*Adjust elements* varer 8 timer og følger efter via en afhængighed af typen slut til start. Den begynder med det samme tirsdag kl. 11:00: det er 1 time indtil pausen og 3 timer efter den. De sidste 4 timer er onsdag fra kl. 07:00 til 11:00. Slutdatoen er **onsdag den 9. juni kl. 11:00**.

*Finishing* varer 2 dage og følger efter *Adjust elements*. En dagopgave begynder ikke midt på en dag, så den begynder **torsdag den 10. juni** og slutter fredag den 11. juni.

### Afrunding ved overgangen

Hvis du udelader *Adjust elements* og knytter *Finishing* direkte til *Place crane*, begynder *Finishing* onsdag den 9. juni og slutter torsdag den 10. juni. Resten af tirsdag (4 arbejdstimer) kan ikke bruges. Du ser de 4 timer igen som samlet slæk på *Place crane*: en halv arbejdsdag.

Vend rækkefølgen om, og det er enklere. *Pour foundation* varer 2 dage, fra mandag den 7. til tirsdag den 8. juni. *Place crane* varer nu 4 timer og følger efter. Den begynder **onsdag den 9. juni kl. 07:00** og slutter kl. 11:00.

### En forsinkelse i timer

Mellem *Place crane* (12 timer) og *Adjust elements* (8 timer) sætter du en forsinkelse på 2 timer. *Adjust elements* begynder så ikke kl. 11:00, men tirsdag kl. **14:00**: 1 time indtil pausen og 1 time efter den. Slutdatoen flyttes med til **onsdag den 9. juni kl. 14:00**.

Efter en dagopgave virker en forsinkelse anderledes. *Pour foundation* slutter tirsdag den 8. juni. Uden forsinkelse begynder *Finishing* onsdag den 9. juni. Med en forsinkelse på 4 timer er det en halv dag, og appen runder op: *Finishing* begynder **torsdag den 10. juni**. Med en forsinkelse på 1 time runder appen ned, og *Finishing* begynder ganske enkelt onsdag.

### En fri fredag eftermiddag

Nu har fredag kun ét tidsbånd, fra kl. 07:00 til 12:00: 5 timer. De andre dage bliver ved 8 timer. Standard arbejdsdagen bliver 8 timer, fordi det er den hyppigst forekommende daglige total. En uge har nu 37 arbejdstimer.

En opgave på 40 timer fra mandag den 7. juni kl. 07:00 bruger mandag til torsdag (32 timer) og fredag (5 timer). De sidste 3 timer falder på den følgende mandag, fra kl. 07:00 til 10:00. Slutdatoen er **mandag den 14. juni kl. 10:00**. En opgave på 5 dage ville optage 37 timer fra mandag, og det er det, appen foreslår, hvis du skifter enheden for 5 dage til timer.

I selvstudium 4 om timeplanlægning planlægger du selv kranopgaven i timer.

## Konsekvenser og misforståelser

**"8 timer er 1 dag."** Kun hvis kalenderen har dage på 8 timer. På kalenderen med den frie fredag eftermiddag er 5 dage 37 timer, ikke 40.

**"Hvis jeg sætter flere timer pr. dag, slutter min dagopgave tidligere."** Nej. En dagopgave tæller hele arbejdsdage. Timerne pr. dag ændrer kun, hvad en dag er værd i timer, for eksempel i visningen og for en forsinkelse i timer. Kun for en opgave med ressourcer og opgavetypen *Fast arbejde* eller *Faste enheder* ændres varigheden med det, fordi arbejdet er det samme: 40 timers arbejde er 5 dage på 8 timer pr. dag og 7 dage på 6 timer pr. dag.

**"En opgave på 8 timer varer én dag."** Kun hvis den starter ved dagens begyndelse. Hvis den starter senere, som *Adjust elements* tirsdag kl. 11:00, fortsætter den til næste dag.

**En kalender med egne tidsbånd** virker anderledes end standardkalenderen. Du får en sådan kalender ved at angive arbejdstid pr. ugedag eller ved at vælge en skiftforindstilling (*2 arbejdsskift*, *3 arbejdsskift*, *Natarbejdsskift* eller *24/7*). På en sådan kalender tæller en forsinkelse i timer præcist i arbejdstimer, også efter en dagopgave.

**Når du slår timeplanlægning fra**, fjerner det ikke noget. Opgaver i timer forbliver og beregnes stadig, men du kan ikke redigere dem, før du slår timeplanlægning til igen.

## Se også

- [Slå timeplanlægning til](docs://howto-urenplanning-aanzetten): trinene for at gøre en opgave til en timeopgave.
- [Angiv arbejdstid](docs://howto-werktijden-instellen): tilpasning af tidsbåndene i en kalender.
- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvordan appen tæller arbejdsdage, og hvilken kalender der vinder.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): trinene for at tilføje en afhængighed eller forsinkelse.
