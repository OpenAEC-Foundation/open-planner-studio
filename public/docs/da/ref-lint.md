# Båndet, fane for fane

Båndet øverst på skærmen har faner, og hver fane har grupper med knapper. Denne artikel forklarer for hver knap, hvad den gør, og hvor du ser resultatet. Hvordan du løser en opgave trin for trin, står i vejledningerne. Her slår du op, hvad en knap er. En knap, der kun findes eller virker under en betingelse, har den betingelse ved siden af.

## Sådan opfører båndet sig

- **Faner** — *Fil* står til venstre, derefter *Start*, *Tidsplan*, *Ressourcer*, *Visning*, *Indstillinger*, *Tabel*, *IFC*, *Rapport* og, kun når AI-tilstand er slået til, *AI*.
- **Smalt vindue** — når båndet ikke passer, skrumpes knapperne ind til et ikon fra højre mod venstre. Navnet vises da som tooltip på knappen. Hver knap uden egen tooltip viser sit navn.
- **Sammenfold båndet** — pilen nederst til højre på båndet gør det til en flad stribe med kun ikoner. Gruppen *Oprindelige planer & fremdrift* og gruppen *Forbindelse* på fanen *AI* forsvinder så bag én knap med en pop op-menu. Standard: udvidet. Dit valg huskes.
- **Udvidelsesknapper** — en udvidelse kan tilføje sin egen gruppe til enden af en fane. En sådan knap gør det, som udvidelsen har fået den til at gøre.

## Fil

Et klik på *Fil* gør, at et eget skærmbillede (Backstage) overtager arbejdsområdet. Det har intet bånd. *Tilbage* lukker det. Har du ændret noget under *Projektindstillinger* og ikke anvendt det, spørger appen først, hvad der skal ske med ændringen.

- **Ny** — åbner vinduet *Opret nyt projekt* og lukker Backstage. Felterne står i [Opret nyt projekt og Projektindstillinger](docs://ref-projectinfo).
- **Åbn** — vælger en fil og åbner den som dokument. Lukker Backstage.
- **Seneste** — en liste over projekter, der er åbnet for nylig; et klik åbner et af dem. Kun synlig, når omgivelsen kan åbne filer igen: i desktopappen og i browsere, der tilbyder filadgang, som Chrome og Edge. I andre browsere er knappen der, men siden forbliver tom.
- **Eksempler** — medfølgende eksempeltidsplaner, opdelt i *Fulde showcase-tidsplaner* (mærke *Alle funktioner*) og *Enkle eksempler*. Et klik åbner en i en ny fane.
- **Gem** — skriver projektet til filen for dette dokument. Har dokumentet endnu ingen fil, vælger du først et navn og en placering. En fil, du har åbnet i et andet format end IFC, overskrives aldrig; så spørger *Gem* efter et navn og en placering til en IFC-fil.
- **Gem som** — vælger et nyt navn eller en ny placering og gemmer der som IFC.
- **Eksportér** — kort pr. eksportformat, med en beskrivelse. Et klik konverterer projektet og gemmer det og bringer dig tilbage til *Start*. Har tidsplanen en cyklus, vises fejlen i Backstage, og du bliver der. Er projektet knyttet til et ressourcebibliotek, vises afkrydsningsfeltet *Gem biblioteksfilen ved siden af* nedenfor; det virker kun for IFC-kortet.
- **Importér** — øverst står kortet *Opdater fremdrift fra et ark* (ikke aktivt uden opgaver). Under det står de importører, som udvidelser tilføjer.
- **Udskriv** — knappen *Åbn forhåndsvisning* bringer dig til fanen *Rapport*.
- **Projektindstillinger** — metadata og beregningsprofil for dette projekt. Ændringer træder kun i kraft efter *Anvend*. Se [Opret nyt projekt og Projektindstillinger](docs://ref-projectinfo) og [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen).
- **App-indstillinger** — de samme indstillinger som i vinduet *App-indstillinger*.
- **Udvidelser** — administration og installation af udvidelser; se [Installér og administrér en udvidelse](docs://howto-extensie-installeren).
- **Bibliotek** — administration af ressourcebiblioteker; se [Administrér og del ressourcebiblioteker](docs://howto-bibliotheken-beheren).
- **Hjælp** — den indbyggede dokumentation, også med F1. Søgefeltet søger i titler, overskrifter og selve teksten. Artiklerne står i fire afsnit: *Selvstudier*, *How-to-vejledninger*, *Forklaring* og *Reference*. Under *Dokumentationssprog* vælger du *Følg appens sprog* eller et sprog fra listen. Nederlandsk og engelsk er kildesprogene; de andre sprog har de artikler, der allerede er oversat. Mangler en artikel i dit sprog, læser du den engelske version, med en besked. Valget gemmes på denne enhed, adskilt fra appens sprog. Du kan også åbne Hjælp fra et vindue eller et panel. Mange vinduer og panelerne *Egenskaber*, *Ressourcer* og *Advarsler* har et spørgsmålstegn øverst til højre (*Hjælp til dette område*). Det åbner Hjælp for artiklen om det vindue eller panel. Har du skrevet noget i vinduet, som ikke er gemt endnu, spørger appen først: *Gem*, *Annuller* (kassér din indtastning) eller *Tilbage* (bliv i vinduet). Derefter lukkes vinduet, og Hjælp åbnes. Nogle få vinduer, som *Rediger opgave* og *Udjævn ressourcer*, spørger altid. Uden indtastning åbnes Hjælp med det samme.
- **Start rundvisning** — lukker Backstage og starter rundvisningen ved trin 1.
- **Luk projekt** — lukker det aktive dokument. Har det ugemte ændringer, beder appen om en bekræftelse.

## Start

### Start › Fil

- **Ny**, **Gem**, **Åbn** og **Gem som** — de samme handlinger som i *Fil*.
- **Seneste** — rulleliste med de seneste projekter; et klik åbner et projekt. Kun synlig under samme betingelse som *Fil › Seneste*. Uden seneste filer står der *Ingen nylige filer*.
- **Eksportér** — rulleliste med eksportformaterne (korte navne). Et klik konverterer projektet og gemmer det.

### Start › Rediger

- **Fortryd** — fortryder den sidste ændring. Ikke aktiv, når der ikke er noget at fortryde.
- **Gentag** — genskaber den sidst fortrudte ændring. Ikke aktiv, når der ikke er noget at gentage.
- **Slet** — sletter de valgte opgaver, sammen med deres underopgaver, i ét trin. Ikke aktiv uden valg.

### Start › Opgaver

- **Opgave** — tilføjer en opgave med navnet *Ny opgave* og en varighed på 5 arbejdsdage, startende på projektstartdatoen. (Er *Slå timeplanlægning til* slået til, og er *Standardenhed for nye opgaver* i *Projektindstillinger* timer, er varigheden 5 timer.) Er en opgave valgt, og er visningen den almindelige trævisning, kommer den nye opgave lige under den nederste valgte opgave (tooltip *Ny opgave lige under valget*). Uden valg kommer den nederst (tooltip *Ny opgave nederst på listen*). Med valg, men mens du filtrerer, grupperer eller sorterer, kommer den også nederst. En rød besked siger så, at appen ikke kan placere den under dit valg, med knappen *Ryd*. Den nye opgave bliver det eneste valg. Gantt springer til den, og du kan skrive over dens navn med det samme i panelet *Egenskaber*.
- **Milepæl ▾** — en rulleliste, der sætter en milepæl (varighed 0) på samme sted som *Opgave*. *Startmilepæl* og *Slutmilepæl* bestemmer typen af milepæl. Den nye milepæl får navnet *Ny milepæl* og arbejdskategorien *Andet*. *Kontrolpunkt (obligatorisk)* laver en slutmilepæl med arbejdskategorien *Kontrol/inspektion* og markeringen *Obligatorisk (kontraktuel)*, med navnet *Nyt inspektionspunkt*.
- **Sammenkæd ▾** — en rulleliste med fire faste handlinger. Hovedknappen skifter aldrig betydning. Se *Tidsplan › Afhængigheder* for de fire handlinger.
- **Opdel opgave** — slår opdelingstilstand til eller fra. Til: en strimmel under båndet forklarer, at du klikker på en bjælke, hvor afbrydelsen starter, og trækker til højre over bjælkens længde. Ikke aktiv, når Gantt ikke er synligt (på fanerne *Tabel*, *IFC* og *Rapport* og under det fulde ressourcepanel). Tooltip siger så *Kun tilgængelig, når Gantt-diagrammet er synligt*. Se [Opdeling af en opgave](docs://howto-taak-splitsen).

### Start › Tidsplan

- **Beregn** — beregner tidsplanen: datoer, slæk, kritisk vej og ressourcebelastning. Det sker aldrig af sig selv, medmindre du slår *Beregn automatisk* til (*App-indstillinger*, fane *Tidsplan*, overskrift *Beregning*). Når tidsplanen er forældet, siger statuslinjen *Forældet — genberegn (F5)*.

### Start › Zoom

- **Zoom +** — zoomer tidsaksen ind med 10 pixels pr. dag.
- **Zoom -** — zoomer tidsaksen ud med 10 pixels pr. dag.

## Tidsplan

### Tidsplan › Tidsplan

Knappen *Beregn* er den samme som på *Start*.

- **Flyt projekt…** — åbner vinduet *Flyt projekt*. Ikke aktiv uden projektstartdato. Se [Flytning af et projekt](docs://howto-project-verplaatsen).
- **Advarsler** — viser eller skjuler panelet *Advarsler* i kolonnen til højre. Knappen lyser, mens du kan se panelet. Når du slår det til, udvides en sammenfoldet kolonne. Hvad der står i panelet, beskrives i [Meddelelser og advarsler](docs://ref-meldingen).

### Tidsplan › Afhængigheder

Gruppen har knappen *Sammenkæd ▾* med fire handlinger og knappen *Opdel opgave* (samme som på *Start*). De fire handlinger:

- **Tegn afhængighed** — slår sammenkædningstilstand til eller fra. Et flueben vises, når den er til, og hovedknappen lyser. Til: du trækker fra en bjælke til en anden i Gantt for at oprette en afhængighed. En strimmel under båndet siger, hvordan du stopper (*Stop* eller Esc). Ikke aktiv, når Gantt ikke er synligt.
- **Sammenkæd valgte opgaver** — opretter en afhængighed af typen slut til start uden forsinkelse mellem to opgaver. Den først valgte bliver den foregående opgave. Kun tilgængelig med præcis to valgte opgaver (ellers *Vælg præcis to opgaver*). En dobbelt afhængighed eller en cyklus afvises med en besked.
- **Tilføj ekstern afhængighed…** — åbner et vindue, hvor du tilføjer en ekstern foregående eller efterfølgende opgave til den valgte opgave. Kun tilgængelig med præcis én valgt opgave (ellers *Vælg præcis én opgave*).
- **Opdater alle eksterne afhængigheder** — opdaterer forankringerne for alle eksterne afhængigheder og viser i menuen, hvor mange der blev opdateret, eller hvor mange der mangler. Kun tilgængelig, når projektet har eksterne afhængigheder (ellers *Dette projekt har ingen eksterne afhængigheder*).

Se [Oprettelse af afhængigheder](docs://howto-relaties-leggen) og [Afhængigheder og forsinkelse](docs://uitleg-relaties) for uddybning.

### Tidsplan › Spor sti

- **Foregående opgaver** — fremhæver i Gantt de foregående opgaver for de valgte opgaver, kæde for kæde.
- **Efterfølgende opgaver** — fremhæver de efterfølgende opgaver for de valgte opgaver.

Du kan slå begge til samtidig. Et ekstra klik på en knap slår den side fra igen. Bestemmende afhængigheder får en kraftigere farvetoning. Se [Spor en sti](docs://howto-pad-traceren).

### Tidsplan › Kalender

- **Kalender** — åbner vinduet *Kalendere* med projektets kalenderbibliotek. Se [Kalendervinduer](docs://ref-kalenders).

### Tidsplan › Struktur

- **Koder og felter** — åbner vinduet *Koder og felter* for opgavekoder og brugerdefinerede felter. Se [Koder og brugerdefinerede felter](docs://howto-codes-en-velden).
- **WBS auto** — slår automatisk nummerering af WBS-koderne til eller fra. Standard: til i et nyt projekt. I en åbnet fil uden denne indstilling: til, hvis filen er tom, eller hvis alle koder allerede passer til nummereringen af træet; ellers fra. Til: hele træet nummereres igen på én gang, koderne følger så hver ændring i strukturen, og feltet *WBS-kode* i panelet og dialogen er ikke aktivt.
- **Nummerér WBS igen** — nummererer WBS-koderne én gang, efter positionen i træet (1.2.3). Ikke aktiv, mens *WBS auto* er til.
- **Skabeloner** — rulleliste med gemte WBS-skabeloner, hver med sit antal opgaver og afhængigheder. Et klik indsætter skabelonen under den valgte opgave, eller på øverste niveau uden valg. Papirkurv-ikonet sletter en skabelon. Uden skabeloner står der, hvordan du gemmer en (højreklik på en hovedopgave, *Gem gren som skabelon*). Se [Gem og indsæt WBS-skabeloner](docs://howto-wbs-sjablonen).
- **Indryk** — gør de valgte opgaver til underopgaver af opgaven før dem. Ikke aktiv uden valg, og så snart du filtrerer, grupperer eller sorterer. Tooltip siger så *Ikke tilgængelig under filtrering/gruppering/sortering*.
- **Udryk** — flytter de valgte opgaver ét niveau op, direkte efter deres nuværende overordnede opgave. Samme betingelser som *Indryk*.

### Tidsplan › Oprindelige planer & fremdrift

- **Administrér oprindelige planer…** — åbner vinduet for oprindelige planer. Se [Gem og administrér en oprindelig plan](docs://howto-baseline-opslaan-en-beheren).
- **Statusdato** — datoen, du måler fremdriften til. Skriv en dato; krydset (*Ryd statusdato*) fjerner den. Har projektkalenderen tidsbånd, så beregner appen i timer, og et tidsfelt vises ved siden af datoen (MS Project gemmer ofte 17:00). Tiden tæller så med: 12:00 i stedet for 17:00 giver en halv dag forskel i det resterende arbejde. Uden tidsbånd beregner appen i hele dage, og der er intet tidsfelt. Effekt: fremdriften måles til den dato, og statusdatolinjen og fremdriftslinjen i Gantt ligger på den. Se [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang).
- **Fremdriftsmetode** — et valg mellem *Retained Logic* og *Progress Override*. Standard: *Retained Logic*. Effekt: med *Retained Logic* afhænger det resterende arbejde for en startet efterfølgende opgave af afhængigheden. Med *Progress Override* starter det resterende arbejde på statusdatoen, uden at vente på den foregående opgave. Se [Vælg fremdriftsmetode](docs://howto-voortgangsmodus-kiezen).

I det sammenfoldede bånd står disse tre bag én flagknap med titlen *Oprindelige planer & fremdrift*.

### Tidsplan › Fremdrift

- **Eksportér fremdriftsark** — laver et `.xlsx`-ark med opgaverne, så du kan udfylde fremdriften uden for appen. Ikke aktiv uden opgaver.
- **Opdater fremdrift fra et ark** — åbner importvinduet for et tilbageleveret ark. Ikke aktiv uden opgaver. Se [Import af fremdrift fra et regneark](docs://howto-voortgang-importeren).

Denne gruppe findes også på *Tabel* og *Rapport*.

## Ressourcer

### Ressourcer › Administrér

- **Ressourcer** — åbner det fulde ressourcepanel; det overtager arbejdsområdet. Lyser, mens du ser panelet. Se [Ressourcepanel](docs://ref-resourcepaneel).
- **Ressourcedok** — docker det kompakte ressourcepanel i kolonnen til højre, ved siden af Gantt. Lyser, mens docken er synlig; et ekstra klik lukker den. Docken viser kun navn, farve, en advarsel ved overallokering og *Maksimalt antal enheder*. Med et opgavevalg viser den kun ressourcerne for disse opgaver.
- **Ny ressource** — åbner det fulde ressourcepanel med en tom kladderække til en ny ressource. Der oprettes intet, før du skriver et navn; klikker du et andet sted, bliver der ikke noget tilbage. Ressourcen kommer i biblioteket eller i projektet, afhængigt af visningen.

### Ressourcer › Tildeling

- **Tildel ▾** — tildeler en ressource til den valgte opgave. Kun tilgængelig med præcis én valgt opgave, som er en opgave uden underopgaver og ikke en milepæl; ellers er knappen grå. I menuen sætter du først *Enh./dag* (standard 1) og *Kurve* (standard *Jævn*). Et klik på en ressource tildeler den med disse værdier. Menuen viser kun ressourcer, der ikke allerede er på opgaven. Se [Tildel ressourcer med en kurve](docs://howto-resource-toewijzen).

### Ressourcer › Histogram

- **Histogram** — viser eller skjuler histogramstrimlen under Gantt. Standard: fra. Dit valg huskes.
- **Forrige** og **Næste** — gå trin for trin gennem ressourcerne i vælgeren på histogramstrimlen, med *Alle ressourcer* som ekstra trin i rundgangen. Ikke aktiv, når histogrammet er fra, eller når projektet ingen ressourcer har.

### Ressourcer › Udjævning

- **Udjævn…** — åbner vinduet *Udjævn ressourcer*. Se [Udjævning](docs://uitleg-nivelleren).
- **Ryd udjævning** — fjerner de forskydninger og afbrydelser, som udjævningen har lagt ind. Ikke aktiv, når ingen opgave har et resultat af udjævning.

### Ressourcer › Overallokering

- **Overallokering** — ikke en knap, men en tæller: antallet af ressourcer med mindst én overallokeret dag, eller *Ingen*. Den bliver rød med et advarselsikon, så snart der er én. Tallet opdateres efter *Beregn* og efter ændringer i ressourcer og tildelinger. Ændrer du datoerne for opgaver, tæller det først efter *Beregn*.

## Vis

### Vis › Tidsskala

- **Zoom +** og **Zoom -** — zoomer tidsaksen ind eller ud med 10 pixels pr. dag.
- **Nulstil** — sætter zoomen tilbage til standarden på 30 pixels pr. dag.
- **Tilpas til projekt** — zoomer og scroller, så hele projektet passer i visningen.
- **Skalavalg** — en liste med *År*, *Kvartal*, *Måned*, *Uge*, *Dag* og, kun når *Slå timeplanlægning til* er slået til, *Time*. Et valg sætter en fast zoom. Den viste værdi følger den aktuelle zoom, og under den vises zoomen i pixels pr. dag.

### Vis › Visning

- **Kolonner…**, **Filtrér…**, **Gruppér…** og **Sortér…** — er kun synlige, når *Vis klassiske visningsknapper* er slået til (*App-indstillinger*, fanen *Avanceret*, overskriften *Ældre funktioner*). Standard: fra. *Kolonner…* går til *Tabel* og åbner kolonnevælgeren der. *Filtrér…* åbner filtervinduet med det samme, så længe der ikke findes et gemt filter. Med gemte filtre åbner den en menu med *Filtrér…*, *Ryd* (kun når et filter er aktivt) og de gemte filtre. *Gruppér…* tillader to niveauer. *Sortér…* tillader flere niveauer. En knap lyser op, når den visningsindstilling er aktiv. I det aktuelle bånd gør du det med layoutknapper; se [Oprettelse og brug af et layout](docs://howto-layouts-gebruiken).

### Vis › Struktur

- **Fold sammen** — folder de valgte hovedopgaver sammen. Uden valg folder den alle sammen. I en gruppevisning folder den alle grupper sammen, og et valg har ingen effekt.
- **Udvid** — det modsatte.

### Vis › Layout

- **Layoutknapper** — hvert layout er en kontakt med et ikon og et navn. *Ressourcediagram* er med. Ét klik slår layoutet til. Et nyt klik slår det fra og viser igen visningen fra før klikket. Layouts med forskellige dele kan være til samtidig. Højreklik på et layout: *Redigér…*, *Dupliker* og *Slet* (efter bekræftelse). Et medfølgende layout kan kun duplikeres.
- **Nyt layout** — åbner layoutvinduet for et nyt layout.

### Vis › Præsentation

- **Præsentation** — slår præsentationstilstand til eller fra (Esc for at stoppe, i desktopappen også F11): kun Gantt-diagrammet fylder skærmen. Se [Præsentation på en stor skærm](docs://howto-presentatie).
- **Opdelt visning** — deler Gantt-diagrammet i to tidsvinduer, som begge starter med din aktuelle zoom og position (hver delt i 50 procent), eller gør det til ét igen. Standard: fra. Se [Brug af opdelt visning og minikortet](docs://howto-split-view-en-mini-map).
- **Minikort** — viser eller skjuler minikortet. Standard: fra. Dit valg bliver husket.

### Vis › Paneler

- **Egenskaber** — viser eller skjuler panelet *Egenskaber* i højre kolonne. Standard: til. Se [Opgavedialog og egenskabspanel](docs://ref-taak-eigenschappen).

Knapperne *Ressourcer*, *Ressourcedock* og *Histogram* er de samme som under *Ressourcer*. *Advarsler* er det samme som under *Tidsplan*.

**Den højre kolonne.** Kolonnen til højre for Gantt-diagrammet er der, så snart mindst ét af panelerne *Egenskaber*, *Ressourcedock* eller *Advarsler* er til. Er ingen til, er der ingen kolonne. Hvis et fuldt panel overtager arbejdsområdet, for eksempel det fulde ressourcepanel, forsvinder kolonnen. Kun på fanen *Tabel* bliver den.

- **Bredde** — træk skillelinjen mellem arbejdsområdet og kolonnen. Én bredde gælder for alle paneler i kolonnen.
- **Deling** — hvis to paneler er til, træk grænsen mellem dem. Hvis ét panel er til, fylder det hele kolonnen.
- **Skjul** — knappen *Skjul sidekolonne* i overskriften skjuler kolonnen. En smal stribe med knappen *Vis sidekolonne* viser den igen, med de samme paneler som før.
- **Luk** — hvert panel har et kryds i overskriften. Det er den samme kontakt som knappen i båndet.
- **Fuldt panel** — i ressourcedokken åbner knappen *Udvid til fuldt panel* det fulde ressourcepanel.

### Vis › Oprindelig plan og fremdrift

Denne gruppe har samme navn som gruppen under *Tidsplan*, men den indeholder tegneindstillingerne for Gantt-diagrammet.

- **Oprindelig plan-overlay** — viser den aktive oprindelige plan som en tynd bjælke under hver opgavebjælke. Standard: til. Uden en aktiv oprindelig plan er der ikke noget at se.
- **Fremdriftslinje** — tegner en linje på statusdatoen, som buler ud pr. opgave til dens fremdrift. Standard: til. Uden statusdato er der ikke noget at se. Når fremdriftslinjen er til, er den linje også markøren for statusdatoen.
- **Statusdatolinje** — tegner en stiplet linje på statusdatoen. Standard: til. Du ser den kun, når fremdriftslinjen er fra, for ellers tager fremdriftslinjen dens plads. Etiketten med datoen i overskriften bliver, så længe mindst en af de to er til. Etiketten følger dit datoformat, for eksempel 20-09-2006. Hvis appen regner i timer, placeres linjen og etiketten på tidspunktet, og etiketten viser også klokkeslættet, for eksempel 20-09-2006 17:00.
- **Bjælkefarver** — vælger hvordan bjælkerne farves: *Kritisk vej* (standard), *Pr. opgave — automatisk* eller *Efter kategori* med et valg af felt. Hvis feltet ikke findes i dette projekt, siger menuen, at *Arbejdskategori* bruges midlertidigt. Uden for *Kritisk vej* markerer en rød kontur den kritiske vej. Valget gælder også for rapporten.
- **Ressourceaccent** — tegner en tynd stribe i ressourcens farve under hver bjælke for en opgave uden underopgaver. Striben er delt i forhold til tildelingsenhederne pr. dag. Standard: fra.
- **Slækbånd** — tegner det grønne bånd efter en ikke-kritisk bjælke, op til opgavens seneste slutdato. Standard: til.
- **Afhængighedslinjer** — viser eller skjuler afhængighedslinjerne mellem opgaver. Standard: til. Valget hører til dokumentet og til layoutet.

## Indstillinger

### Indstillinger › Projekt

- **Projektindstillinger** — åbner vinduet *Projektindstillinger*: metadata for projektet og, i blokken *Beregningsprofil og beregningsindstillinger*, hvordan projektet beregnes. Se [Nyt projekt og Projektindstillinger](docs://ref-projectinfo).
- **App-indstillinger** — åbner vinduet *App-indstillinger* med fanerne *Udseende*, *Tidsplan* og *Avanceret*. De samme indstillinger findes under *Fil › App-indstillinger*.

### Indstillinger › Kalender

Knappen *Kalender* er den samme som under *Tidsplan*.

### Indstillinger › Tastaturgenveje

- **Tastaturgenveje** — åbner vinduet *Tastaturgenveje*.

## Tabel

Fanen *Tabel* viser opgaverne som en fuld tabel i stedet for Gantt-diagrammet. Grupperne *Fil*, *Redigér*, *Opgaver*, *Tidsplan* og *Spor sti* er de samme som under *Start* og *Tidsplan*, og de virker på det samme valg. Der er ingen gruppe *Zoom*, fordi zoom kun skalerer tidsaksen i Gantt-diagrammet. Knapperne *Opdel opgave* og *Tegn afhængighed* er deaktiveret her, for der er intet Gantt-diagram.

### Tabel › Kolonner

- **Kolonner…** — åbner kolonnevælgeren for denne tabel. Den samme vælger åbner med plusknappen i tabelhovedet. Værktøjstippet siger *Vælg kolonnerne i tabelvisningen*. Se [Tilpasning af tabelkolonner](docs://howto-tabelkolommen-aanpassen) og [Tabelkolonner](docs://ref-tabelkolommen).

## IFC

Fanen viser IFC-panelet i arbejdsområdet. Båndet har ingen knapper her, kun tekstlinjen *IFC - Industry Foundation Classes, i projektets skema (standard IFC 4.3 ADD2)*.

## Rapport

### Rapport › Rapport

- **Udskriv** — kun på denne fane, hvor den ikke gør noget, fordi *Rapport* allerede er åben. Valgene for rapporten findes på rapportskærmen.

## AI

Fanen *AI* findes kun, når *Aktiver AI-tilstand* er slået til (*App-indstillinger*, fanen *Avanceret*, overskriften *AI-tilstand*). Standard: fra. Slår du den fra, fjerner appen fanen og stopper broen. En AI-assistent arbejder med din tidsplan via en MCP-bro, som du starter her. Se [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Start bro** og **Stop bro** — starter eller stopper MCP-broen. Ved siden af står status: *Fra*, *Aktiv på port …*, *Port … er optaget* (med årsagen) eller *Fejl*. Knapperne er deaktiveret i webversionen; værktøjstippet siger *Broen virker kun i desktopappen*. Den samme status vises som en prik ved *AI* i statuslinjen.

### AI › Forbindelse

- **Port** — broens port. Standard: 3877. Kan kun redigeres, når status er *Fra* (værktøjstippet siger *Kan kun ændres, når serveren er stoppet*.)
- **Token** — adgangskoden til broen, vist skjult. Små knapper *Vis token*/*Skjul token*, *Kopiér* og *Opret nyt token*. *Opret nyt token* beder først om bekræftelse, fordi et nyt token bryder alle eksisterende forbindelser. Hvis broen kører, genstarter den med det nye token.
- **Forbind** — viser forbindelsesoplysningerne: endepunkt, token, et konfigurationsuddrag og en forbindelsesprompt, som du indsætter i din AI-agent.

### AI › Sikkerhed

- **Pause** / **Genoptag** — afviser midlertidigt alle ændringer fra AI'en. Læsning er stadig tilladt, og broen forbliver aktiv. Knappen lyser rødt, mens den er sat på pause.
- **Skrivebeskyttet** — afviser alle værktøjer, der ændrer data, mens den er slået til.
- **Automatisk backup: til** / **Automatisk backup: fra** — skriver automatisk en IFC-backup før den første AI-ændring pr. dokument. Standard: til.
- **Lav backup nu** — skriver straks en backup og viser filnavnet. Kun i desktopappen.
- **Åbn backupmappe** — åbner mappen med backuperne. Kun i desktopappen.

### AI › AI-handlinger

- **Panel AI-handlinger** — viser eller skjuler panelet *AI-handlinger* med kaldene til broen, med deres argumenter og svar.
