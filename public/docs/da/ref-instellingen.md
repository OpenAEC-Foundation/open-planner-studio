# App-indstillinger

Alle indstillinger i appen: hvad de gør, hvad startværdien er, hvad de ændrer, og hvor du finder dem. For beregningsindstillingerne i et projekt (beregningsprofil, den kritiske definition) se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): de hører til projektfilen, ikke til appen.

## Hvor du finder dem, og hvordan de virker

Indstillingspanelet findes på tre steder, og overalt er det det samme panel: tandhjulet øverst i vinduet, *Indstillinger › Projekt › App-indstillinger* og *Fil › App-indstillinger*. Panelet har tre faner: *Udseende*, *Tidsplan* og *Avanceret*. Hver indstilling nedenfor nævner kun fanen.

En ændring træder straks i kraft. Der er ingen knap *Anvend* og ingen *Annuller*.

**Gælder for hele appen, ikke pr. projekt.** Alle indstillinger i denne artikel gælder for alle dine projekter og hører til denne enhed. Appen gemmer dem i lageret i appen eller i din browser, ikke i projektfilen. Hvis en anden åbner din fil, ser vedkommende sine egne indstillinger. En browser, hvis lager du rydder, starter igen med startværdierne.

## Fanen Udseende

**Tema** — farveskemaet i brugerfladen. Vælg mellem *Mørk*, *Lys* og *Høj kontrast*. Standard: *Mørk*. Effekt: farverne i hele brugerfladen, inklusive Gantt-diagrammet og histogrammet. Hvor: *Udseende*.

**Følg systemtema** — lader farveskemaet i dit operativsystem bestemme. Standard: fra. Effekt: appen er *Lys* eller *Mørk*, afhængig af dit system; de tre temakort er så slået fra. *Høj kontrast* følger ikke dit system: du vælger den selv. Slår du funktionen fra, forbliver det tema, der var på skærmen på det tidspunkt. Hvor: *Udseende*, under *Tema*.

**Sprog** — sproget i brugerfladen. Standard: sproget i din browser eller dit system, hvis appen kender det; ellers engelsk. Effekt: alle tekster i appen; sprogene sorteres efter deres korte kode. Arabisk og persisk spejler brugerfladen fra højre mod venstre. Du stiller sproget for hjælpeartiklerne separat under *Dokumentationssprog* i *Fil › Hjælp*. Hvor: *Udseende*.

**Skrifttype** — skrifttypen i hele brugerfladen. Vælg mellem *Standard*, *System*, *Med serifer* og *Monospace*. Standard: *Standard*. Effekt: overskrifter og tekst i vinduet, og teksten i Gantt-diagrammet og histogrammet. En webapp følger ikke selv din systemskrifttype; derfor vælger du den her. Hvor: *Udseende*.

**Tekststørrelse** — skala for brugerfladen. Vælg mellem 90%, 100%, 110% og 125%. Standard: 100%. Effekt: tekst og layout af båndet, panelerne og dialogerne bliver større eller mindre, og rækkehøjden i tabellen og i Gantt-diagrammet følger med. Der er intet valg over 125%, fordi knapteksterne i båndet da brydes over flere linjer. Hvor: *Udseende*.

**Datoformat** — hvordan datoer vises i appen. Vælg mellem *dd-mm-åååå*, *mm-dd-åååå* og *åååå-mm-dd*. Standard: *dd-mm-åååå*. Effekt: datoer i tabellen, dialogerne, rapporterne og udskriften. Filer og beregninger ændrer sig ikke; kun visningen. Hvor: *Udseende*.

**Tidsformat** — hvordan klokkeslæt vises i appen. Vælg mellem *24 timer (13:00)* og *12 timer (1:00 PM)*. Standard: *24 timer (13:00)*. Effekt: klokkeslættene i vinduet *Kalendere*, datoen og klokkeslættet for opgaver i timer (tabel, opdelinger, meddelelser) og tidsskalaen *Time* i Gantt-diagrammet. I et tidsfelt må du skrive begge former: *13:00*, *1300*, *13*, *1:00 PM* eller *1 pm*. Midnat som dagens slutning er *24:00* eller *12:00 AM*. Filer og beregninger ændrer sig ikke: de bliver ved 24 timer. Hvor: *Udseende*.

**Visning af varighed** — i hvilken enhed varigheden af en opgave vises. Vælg mellem *Automatisk (egen enhed pr. opgave)*, *Altid dage* og *Altid timer*. Standard: *Automatisk (egen enhed pr. opgave)*. Effekt: i opgavetabellen, på etiketterne på bjælkerne i Gantt-diagrammet, i værktøjstippet, i udskriften og i rapporterne. Med *Automatisk* viser en dagopgave dage, og en timeopgave viser timer. Med *Altid dage* eller *Altid timer* omregner appen med timerne pr. dag i opgavens kalender. Har opgaven en anden enhed, sætter appen sin egen enhed i parentes efter, for eksempel `2.25d(18h)`. Kun visningen ændrer sig; opgaven beholder sin egen enhed. Hvor: *Udseende*.

**Stil til skift mellem dokumenter** — hvordan du skifter mellem åbne projekter. Vælg mellem *Vandrette faner*, *Lodrette faner* og *Pille*. Standard: *Vandrette faner*. Effekt: *Vandrette faner* sætter en fanelinje under båndet; *Lodrette faner* en projektlinje til venstre; *Pille* en lille projektknap i titellinjen. Hvor: *Udseende*.

### Gantt-afsnit

**Vis kun arbejdsdage** — komprimerer tidsaksen. Standard: fra. Effekt: weekender og helligdage fra projektkalenderen springes over, så en opgave på 5 arbejdsdage er præcis 5 kolonner bred. Genvejene *Hop til i dag* og *Tilpas til projekt* tæller så også i arbejdsdage. Rapporten har sit eget afkrydsningsfelt med samme navn, og det er uafhængigt af denne indstilling. Hvor: *Udseende*, under *Gantt › Tidsakse*.

**Vis kvarterer ved stor zoom** — en ekstra fin tidsskala. Standard: fra. Effekt: du kan zoome længere ind, og tidsskalaen for timer får en ekstra række med kvarterer. Når du trækker en timeopgaves bjælke, kan den så fastgøres til kvarterer i stedet for hele timer. Du ser det kun, når *Slå timeplanlægning til* er slået til. Hvor: *Udseende*, under *Gantt › Kvarterzoom*.

**Opgavebjælker ved afbrydelser** — om en timeopgave tegnes i blokke. Vælg mellem *Del aldrig op*, *Del op ved markering* og *Del altid op*. Standard: *Del op ved markering*. Effekt: bjælken for en timeopgave tegnes så pr. tidsbånd i stedet for som én sammenhængende blok. *Del op ved markering* gør det kun for den markerede opgave. Det gælder kun timeopgaver. En opdelt opgave (med *Opdel opgave*) viser sin afbrydelse, uanset denne indstilling. Hvor: *Udseende*, under *Gantt*.

**Scroll og zoom › Tilstand** — hvad scrollhjulet gør over Gantt-diagrammet. Vælg mellem *Position*, *Taster* og *Zoom + træk*. Standard: *Zoom + træk*. Effekt: med *Zoom + træk* zoomer hjulet om markøren, Shift+hjul scroller gennem rækkerne, du panorerer tidsaksen ved at trække i baggrunden, og Ctrl + træk (Cmd på en Mac) tegner en markeringsboks. Med *Position* afhænger hjulets funktion af, hvor markøren er; Ctrl + hjul zoomer altid, og Shift + hjul scroller altid vandret. Med *Taster* vælger du selv, hvilken tast der gør hvad. Valget gælder også for den anden tidslinje i den opdelte visning. Hvor: *Udseende*, under *Gantt › Scroll og zoom*.

**Scroll og zoom › Skærmopdeling** — hvor markøren skal være for hvilken funktion. Kun synlig i tilstanden *Position*. Vælg mellem *Venstre/højre*, *Øverst/nederst* og *Øverste højre hjørne*. Standard: *Venstre/højre*. Effekt: med *Venstre/højre* scroller hjulet lodret over venstre halvdel og vandret over højre halvdel. Med *Øverst/nederst* scroller hjulet vandret over de øverste 30% (ved tidsskalaen) og lodret under dem. Med *Øverste højre hjørne* scroller hjulet vandret i den øverste højre kvadrant og lodret i resten. Hvor: *Udseende*, under *Gantt › Scroll og zoom*.

**Scroll og zoom › Lodret, Vandret, Zoom** — hvilken tast hører til hvilken hjulfunktion. Kun synlig i tilstanden *Taster*. For hver funktion vælger du mellem *Scroll*, *Ctrl + scroll* og *Shift + scroll*. Standard: *Lodret* er *Scroll*, *Zoom* er *Ctrl + scroll*, og *Vandret* er *Shift + scroll*. Effekt: vælger du en tast, der allerede er i brug, bytter den plads med den funktion, der havde den. Hvor: *Udseende*, under *Gantt › Scroll og zoom*.

## Fanen Tidsplan

**Slå byggetilstand til** — startværdier for nye projekter, som passer til byggeri. Standard: til. Effekt: til giver et nyt projekt kalenderen *Bouwkalender NL* med de nederlandske helligdage, lader dig vælge en byggehelligdag, når du genererer helligdage, tilbyder faseskabelonerne *Boligbyggeri* og *Erhvervsbyggeri / renovering* og giver nye opgaver arbejdskategorien *Byggeri*. Fra giver kalenderen *Standaardkalender* uden helligdage, kun skabelonen *Tom* og arbejdskategorien *Andet*. En ny opgave under en overordnet opgave, der har en arbejdskategori, overtager først den arbejdskategori; *Byggeri* eller *Andet* gælder først dernæst. Eksisterende opgaver og kalendere ændres ikke. Hvor: *Tidsplan*.

**Slå timeplanlægning til** — planlægning i arbejdstimer ved siden af arbejdsdage. Standard: fra. Effekt: tidsskalaen *Time* vises under *Visning › Tidsskala*. I vinduet *Kalendere* kan en almindelig kalender få tidsbånd (blokken *Arbejdstimer*; en kalender, der allerede har tidsbånd, viser den altid). Vinduet *Nyt projekt* får valgene *Arbejdsskift* og *Standardenhed for nye opgaver*. *Projektindstillinger* får også valget *Standardenhed for nye opgaver*. Fra arbejder appen kun med dage. Timeopgaver, der allerede findes, bliver, og de indgår i beregningen; du kan først redigere deres varighed, når du slår timeplanlægning til. Hvor: *Tidsplan*, under *Timeplanlægning*. Se [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten).

**Tillad blandet dag/time-planlægning** — om du vælger enheden pr. opgave. Kun synlig når *Slå timeplanlægning til* er slået til. Standard: til. Effekt: til viser rullelisten *Varighedsenhed* ved siden af varigheden for hver opgave. Fra skjuler rullelisten. Hvor: *Tidsplan*, under *Timeplanlægning*. Se [Dage og timer](docs://uitleg-dagen-en-uren).

**Ugen starter på** — den første dag i ugen. Vælg mellem *Mandag* og *Søndag*. Standard: *Mandag*. Effekt: ugeopdelingen og ugenumrene på tidsskalaen i Gantt-diagrammet og i rapporterne (udskriften af Gantt-diagrammet), og rækkefølgen af ugedagene i vinduet *Kalendere*. Hvor: *Tidsplan*.

**Beregn automatisk** — genberegner tidsplanen, så snart den er forældet. Standard: fra. Effekt: fra betyder, at du selv trykker på *Beregn* (F5). Til gør, at appen genberegner tidsplanen inden for en brøkdel af et sekund efter en ændring af opgaver, afhængigheder eller kalender. Under et træk eller mens du skriver i et felt, venter appen og beregner én gang, når du er færdig. Efter en mislykket beregning beregner appen først igen, når du har ændret noget. Hvor: *Tidsplan*, under *Beregning*.

**Brug opgavetyper** — felterne for opgavetype og arbejde i appen. Standard: fra. Effekt: til viser feltet *Opgavetype* på en opgave og arbejdskolonnen for tildelingerne, og gør kolonnen *Opgavetype* tilgængelig i tabellen. Fra skjuler dem; varighed og tildelingsenheder bliver, og arbejdet følger med. Et projekt, der allerede indeholder data om opgavetype eller arbejde, for eksempel fra en `.mpp`- eller `.xer`-fil, viser dem altid, også selv om indstillingen er fra. Hvor: *Tidsplan*, under *Beregning*. Se [Opgavetyper: varighed, tildelingsenheder og arbejde](docs://uitleg-werkregels).

## Fanen Avanceret

**Vis en forklaring efter åbning af** — ét afkrydsningsfelt pr. format: *Primavera-fil (.xer)*, *MS Project-fil (.mpp)*, *MS Project XML*, *Primavera P6 XML* og *CSV-fil*. Standard: alle til. Effekt: til viser et vindue med en kort forklaring af formatet, efter du har åbnet en sådan fil: hvad appen har overtaget, hvad den ikke har, og hvordan gemning og tilbageskrivning virker. *Vis ikke igen for …* i det vindue fjerner afkrydsningen her; her slår du den igen til. En IFC-fil, et eksempel og et projekt, som en AI-assistent eller en udvidelse åbner, får aldrig denne forklaring. Hvor: *Avanceret*, under *Vis en forklaring efter åbning af*. Se [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan).

**Aktiver AI-tilstand** — lader en AI-assistent arbejde med din tidsplan. Standard: fra. Effekt: til viser fanen *AI* med MCP-broen, så en AI-assistent kan arbejde med din tidsplan via Model Context Protocol. Fra skjuler fanen og stopper broen. Hvor: *Avanceret*, under *AI-tilstand*. Se [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

**Start broen automatisk** — starter MCP-broen, når appen starter. Kan kun slås til, når *Aktiver AI-tilstand* er slået til. Standard: fra. Effekt: broen er aktiv med det samme, så en AI-klient kan forbinde, uden at du først åbner fanen *AI*. Det virker kun i desktopappen, og kun én gang pr. start: slår du broen fra selv bagefter, starter den ikke igen. Hvor: *Avanceret*, under *AI-tilstand*.

**Slå debugterminal til** — et logpanel til fejlfinding. Standard: fra. Effekt: til sætter en terminalknap i statuslinjen, som viser eller skjuler logpanelet. Fra lukker panelet. Hvor: *Avanceret*, under *Debugterminal*.

**Benchmark…** — måler ydelsen af tidsplanmotoren. Effekt: åbner et vindue, hvor en testtidsplan i en valgt størrelse genereres, og kernefaserne måles. Dit åbne projekt bliver ikke ændret. Det er en knap, ikke en indstilling: der er intet at huske. Hvor: *Avanceret*, under *Benchmark*.

**Statistik…** — hvor ofte appen er blevet downloadet. Effekt: åbner vinduet *Downloadstatistik* med offentlige tal fra GitHub Releases; der indsamles intet om dig. Det er en knap, ikke en indstilling. Hvor: *Avanceret*, under *Statistik*. I vinduet:

- *Downloads pr. operativsystem* — pr. system er kolonnerne *Downloads*, *Installationer* (det en person downloader) og *Opdateringer* (det opdateringsfunktionen i appen henter), med en *I alt*. På Linux kan de to ikke skilles ad: opdateringsfunktionen henter den samme `.deb`-, `.rpm`- eller `.AppImage`-fil, som folk også downloader selv. Derfor tæller kun snap-filen som installation. Under den vises *Opdateringstjek fra appen*: hvor ofte opdateringsfunktionen i en installeret app har hentet versionsfilen fra GitHub for at søge efter en ny version. Det er tjek, ikke installationer.
- *Pr. udgivelse* — de samme downloads pr. version, med datoen; først de seks nyeste, med *Vis alle … udgivelser* for resten.
- *Kilde* — datoen for tallene (GitHub Releases, opdateret ugentligt) og *Opdater nu*. Appen gemmer hentede tal i en halv time. Hvis hentningen mislykkes, siger vinduet det. Installationer via Snap Store går ikke via GitHub og mangler.

**Start rundvisning** — introrundvisningen igen. Effekt: lukker vinduet *App-indstillinger* og starter rundvisningen fra det første trin. Hvor: *Avanceret*, under *Start rundvisning*.

**Version** — versionsnummeret af appen, med to knapper. *Søg efter opdateringer* åbner opdateringsvinduet. *Hvad er nyt* viser nyhederne i den aktuelle version. Hvor: *Avanceret*, under *Version*.

**Vis klassiske visningsknapper** — en erstattet funktion, under *Ældre funktioner*. Standard: fra. Effekt: til sætter en gruppe *Visning* tilbage på fanen *Visning* med de separate knapper *Vælg kolonner…*, *Filtrer…*, *Gruppér…* og *Sortér…*. De er erstattet af plusset i tabelhovedet, layoutknapperne og layoutvinduet. Hvor: *Avanceret*, under *Ældre funktioner*.

## Husket visningsvalg uden for panelet

Appen gemmer også disse valg på denne enhed. Men du angiver dem ved selve elementet, ikke i indstillingspanelet.

**Overlay for oprindelig plan** — den aktive oprindelige plan som en tynd bjælke under opgavebjælken. Standard: til. Hvor: *Visning › Oprindelige planer & fremdrift › Overlay for oprindelig plan*.

**Fremdriftslinje** — zigzaglinjen for fremdriften ved statusdatoen. Standard: til. Effekt: linjen vises kun, når projektet har en statusdato, og erstatter så den separate statusdatolinje. Hvor: *Visning › Oprindelige planer & fremdrift › Fremdriftslinje*.

**Statusdatolinje** — en prikket linje ved statusdatoen. Standard: til. Effekt: hvis fremdriftslinjen er til, tegner den selv markeringen. Hvor: *Visning › Oprindelige planer & fremdrift › Statusdatolinje*.

**Ressourceaccent** — en tynd stribe i ressourcens farve under opgavebjælken. Standard: fra. Hvor: *Visning › Oprindelige planer & fremdrift › Ressourceaccent*.

**Slækbånd** — slækken som et bånd bag ikke-kritiske bjælker. Ikke for afsluttede opgaver. Standard: til. Hvor: *Visning › Oprindelige planer & fremdrift › Slækbånd*.

**Bjælkefarver** — hvad farven på en bjælke afhænger af. Vælg mellem *Kritisk vej*, *Pr. opgave — automatisk* og *Efter kategori*. Standard: *Kritisk vej*. Effekt: gælder samtidig for Gantt-diagrammet og rapporten. Hvor: *Visning › Oprindelige planer & fremdrift › Bjælkefarver*.

**Histogram** — histogrammet som en stribe under Gantt-diagrammet. Standard: fra. Hvor: *Ressourcer › Histogram › Histogram*, *Visning › Paneler › Histogram* eller Ctrl+Shift+H. Du angiver højden af striben (standard 160 pixels, mellem 80 og 480) ved at trække i dens kant.

**Minikort** — et oversigtskort over tidslinjen. Standard: fra. Hvor: *Visning › Præsentation › Minikort*.

**Skjul båndet** — et kompakt bånd. Standard: fra. Hvor: pilknappen nederst til højre i båndet.

**Bredde på opgavetabellen** — standard 350 pixels, mellem 150 og 800. Du angiver den ved at trække skilleren ved siden af tabellen, eller med venstre pil og højre pil, når skilleren har fokus.

**Bredde på højre panel** — standard 280 pixels, mellem 200 og 900. Du angiver den ved at trække i kanten af panelet.

**Højde af *Egenskaber* og *Advarsler* i højre panel** — standard 240 og 220 pixels, mellem 120 og 2000. *Egenskaber* har den højde, også når listen over ressourcer er åben. Du angiver højden med trækhåndtaget mellem sektionerne. Appen husker ikke, om sektionerne er åbne eller lukkede.

**Også husket, beskrevet andre steder** — appen gemmer også kolonnerne i tabellen ([Tilpasning af tabelkolonner](docs://howto-tabelkolommen-aanpassen)), dine layouts ([Oprettelse og brug af et layout](docs://howto-layouts-gebruiken)), indstillingerne for rapporter ([Rapporttyper](docs://ref-rapporttypes)), dine egne skabeloner til beregningsprofiler ([Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies)) og *Dokumentationssprog* i Hjælp (*Fil › Hjælp*) på denne enhed, ikke i projektfilen.

## Se også

- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): de indstillinger, der hører til et projekt.
- [Timeplanlægning slås til](docs://howto-urenplanning-aanzetten): de trin for kontakten *Slå timeplanlægning til*.
- [Dage og timer](docs://uitleg-dagen-en-uren): hvordan appen tæller dage og timer.
- [Opgavetyper: varighed, tildelingsenheder og arbejde](docs://uitleg-werkregels): hvad *Brug opgavetyper* gør synligt.
- [Tastaturgenveje](docs://ref-sneltoetsen): alle taster i appen, inklusive dem til zoom og rulning.
