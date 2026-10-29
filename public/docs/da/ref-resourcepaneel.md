# Ressourcepanel

Ressourcepanelet er der, hvor du administrerer ressourcer: hvem og hvad der er til rådighed, med hvilken kapacitet og på hvilken kalender. Histogrammet under Gantt-diagrammet og overallokering hører til det. Denne artikel forklarer for hvert felt og hver knap, hvad den gør, hvad standarden er, og hvad du lægger mærke til. Sådan opretter og tildeler du ressourcer, se [Administrer ressourcer](docs://howto-resources-beheren) og [Tildel ressourcer med en kurve](docs://howto-resource-toewijzen); løsning af overallokering står i [Løs overallokering](docs://howto-overbezetting-oplossen).

## Hvor du finder det

- **Fuldt panel** — *Ressourcer › Administrer › Ressourcer* eller *Visning › Paneler › Ressourcer*. Det overtager arbejdsområdet; krydset øverst til højre lukker det.
- **Ressourcedock** — *Ressourcer › Administrer › Ressourcedock* eller *Visning › Paneler › Ressourcedock*: en kompakt liste i højre kolonne ved siden af Gantt-diagrammet. Se nedenfor.
- **Histogram** — *Ressourcer › Histogram › Histogram* eller *Visning › Paneler › Histogram*: en stribe under Gantt-diagrammet. Se nedenfor.
- **Visninger** — hvis dit projekt hører til et bibliotek, har panelet øverst til højre et valg mellem *Bibliotek*, *Projekt* og *Belægning*. Uden bibliotek er der kun projekttabellen. Hver gang du åbner det, starter panelet på *Projekt*, så du ikke uopdaget havner i det fælles bibliotek.

## Ny ressource

- **Opret ressource i projektet** (i visningen *Bibliotek* hedder knappen *Opret ressource i biblioteket*) — knap øverst til højre. Åbner en kladderække nederst i tabellen. Der oprettes intet, før du skriver et navn og forlader rækken (eller trykker på Enter). Klikker du et tomt sted eller trykker på Esc, forbliver der intet: ingen ressource og intet trin under *Fortryd*. Du kan udfylde felterne i vilkårlig rækkefølge; alt gemmes på én gang. Enter eller pil ned gemmer rækken og åbner en ny kladderække; Shift+Enter eller pil op gemmer den og går tilbage til tabellen. Kladderækken har ikke udvidelsespilen for kapacitet, blyantsikonet for kalender og skraldespanden, fordi de virker på en ressource, der endnu ikke findes. Knappen *Opret ressource* under *Ressourcer › Administrer* gør det samme.
- **Navigation i tabellen** — i tabellen flytter Enter og Shift+Enter samt pil op og pil ned markøren mellem rækker. Enter på den sidste række åbner en ny kladderække.

## Visningen Projekt

Tabellen over det, dette projekt bruger. Hver række er en ressource. Ændringer af tekst og standardsats træder i kraft, så snart du forlader feltet, og tæller som ét trin under *Fortryd*.

- **Farve** — en farvevælger. Standard: den første ledige farve fra paletten. Virkning: farven på ressourceaccenten under bjælkerne i Gantt-diagrammet (*Visning › Oprindelige planer & fremdrift › Ressourceaccent*) og på farveprøven i docken.
- **Navn** — ressourcens navn. Et tomt navn gemmes ikke; feltet sættes til det gamle navn.
- **Type** — *Arbejde*, *Udstyr*, *Materiale*, *Underentreprenør* eller *Arbejdsskift*. Standard for en ny ressource: *Arbejde*. Virkning: *Materiale* har en *Enhed* og tæller ikke med i summen *Alle ressourcer* i histogrammet; udjævning springer materiale over. *Arbejdsskift* kan vælges i feltet *Arbejdsskift* hos andre ressourcer. De andre typer beregnes på samme måde.
- **Maksimalt antal enheder** — hvor meget af ressourcen der er til rådighed pr. dag, et tal over 0 (brøktal er tilladt). Standard: 1. Virkning: kapaciteten pr. dag. Er belastningen højere, er ressourcen overallokeret. Pilen ved siden af folder *Tidsfaseret kapacitet* ud; tallet ved pilen er antallet af trin.
- **Tidsfaseret kapacitet** — trin med *Fra* (en dato) og *Maksimalt antal enheder*. *Tilføj trin* tilføjer et trin med i dag og 1. Uden trin står der *Ingen trin — det faste maksimale antal enheder gælder altid.* Virkning: fra datoen for et trin gælder dets *Maksimalt antal enheder* i stedet for den faste værdi; det sidste trin med en dato på eller før en dag har forrang.
- **Kalender** — en liste med *Projektkalender* (standard), projektets kalendere og *+ Ressourcekalender* for en ny. Blyanten (*Rediger…*) åbner den valgte kalender og er slået fra for *Projektkalender*. Virkning: de dage, ressourcen arbejder. På en fridag er kapaciteten 0. Er der planlagt arbejde den dag, bliver ressourcen overallokeret med årsagen *Arbejder ikke denne dag ifølge kalender "…"*. Ressourcekalenderen ændrer ikke datoerne for en opgave. Se [Kalendervinduer](docs://ref-kalenders).
- **Standardsats/time** — omkostningen pr. time. Tom betyder ingen sats; et ugyldigt tal falder tilbage. Virkning: ingen indflydelse på tidsplanen eller belastningen. Satsen bestemmer kolonnen *I alt*, gemmes i IFC-filen og skrives med ved eksport til MS Project (standardsats) og Primavera P6 XML (pris pr. enhed).
- **I alt** — skrivebeskyttet: de belastede timer × satsen, med to decimaler; *—* uden sats eller belastning. Nederst står en linje *I alt*, der lægger alle ressourcer sammen. Timerne kommer fra den sidste beregning og tæller tildelingsenheder × timer pr. dag i opgavens kalender. Er det forældet? Tryk *Beregn*.
- **Enhed** — måleenheden for materialet, for eksempel `m³`. Kan kun udfyldes for typen *Materiale* (værktøjstip *Kan kun udfyldes for ressourcer af typen Materiale.*). Virkning: en etiket; den regner ikke.
- **Arbejdsskift** — det arbejdsskift ressourcen hører til, valgt blandt ressourcerne af typen *Arbejdsskift*. Standard: *Ingen*. Virkning: kun gruppering; kapaciteten og belastningen for et arbejdsskift er ikke summen af dets medlemmer.
- **Slet** (skraldespanden) — sletter ressourcen. Har den tildelinger, spørger appen først *'…' har … tildeling(er) — slet?* med et flueben for at bekræfte og et kryds for at annullere.
- **Til biblioteket** — kun når projektet hører til et bibliotek, og kun for en ressource med et navn, der endnu ikke kommer fra biblioteket. Lægger den i biblioteket eller kobler den til et eksisterende element med samme navn og melder, hvad der skete (*Tilføjet.*, *Fandtes allerede i biblioteket. Nu koblet.* eller *Koblet til det eksisterende bibliotekselement. Værdierne afviger, se markeringen.*).
- **Frakobl fra biblioteket** — frakoblingsikonet på en ressource, der kommer fra biblioteket. Fjerner herkomsten, hvorefter alle felter er frie igen.

Uden ressourcer står der *Ingen ressourcer endnu. Tilføj en for at komme i gang.* Hører projektet til et bibliotek, står der *Dette projekt bruger endnu ingen ressourcer fra biblioteket.* med et hint.

### Ressourcer fra biblioteket

En ressource fra biblioteket har et lille bibliotekssikon (*Fra biblioteket*). Dens *Navn*, *Type*, *Standardsats/time* og *Enhed* er så almindelig tekst (*Bibliotekets værdi — rediger den i biblioteksvisningen, eller frakobl denne ressource fra biblioteket.*), fordi biblioteket bestemmer, hvad ressourcen er. *Farve*, *Maksimalt antal enheder*, kapacitetstrinnene, *Kalender* og *Arbejdsskift* kan stadig redigeres, fordi projektet bestemmer, hvor meget og hvornår. Der kan vises to mærkater: *afviger — beslut* (et klik åbner vinduet *Sammenkæd ressourcebibliotek*) og *ikke længere i biblioteket*, med knappen *Fjern fra projekt*.

## Visningen Bibliotek

Kun når projektet hører til et bibliotek. Se [Brug af ressourcebiblioteket](docs://howto-resourcebibliotheek-gebruiken) og [Administrer og del biblioteker](docs://howto-bibliotheken-beheren). Øverst står en farvet besked: *Dette redigerer biblioteket og gælder for alle projekter — kan ikke fortrydes.* Tabellen har de samme felter som visningen *Projekt*, med disse forskelle:

- Der er ingen kolonne *I alt*: den er en beregning for ét projekt.
- Kolonnen *Arbejdsskift* vises, så snart biblioteket har ressourcer.
- Kolonnen *Kalender* tilbyder bibliotekets kalendere, med *Ingen kalender* som standard.
- **Tildel til projekt** — lægger ressourcen i projektet med en kopi af dens kalender. Melder *Tilføjet.* eller *Findes allerede i projektet.*
- **Slet** — spørger *Fjern '…' fra biblioteket? Dette gælder for alle projekter og kan ikke fortrydes.*
- Uden ressourcer står der *Ingen ressourcer i poolen endnu.*

## Visningen Belægning

En skrivebeskyttet visning af alle åbne dokumenter: hvilke bibliotekressourcer der er booket hvor. Der er ingen knap til en ny ressource. Se [Brug belægningsoversigten](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabel** — pr. bibliotekressource: *Navn*, *Dokumenter* (antallet af dokumenter den indgår i), *Periode* og *Top / kapacitet* (den højeste samlede belastning mod kapaciteten på den dag). En rød *N dage overallokeret* betyder, at ressourcen på tværs af flere dokumenter har mere end sin kapacitet. Pilen ved siden af et navn folder dokumenterne ud, hver med periode og top; et klik på en række viser histogrammet for den ressource (*Vælg en ressource for at se histogrammet.*).
- **Hvad tæller med** — kun dokumenter, der er åbnet i dette program (*Dette overblik ser kun de dokumenter, der er åbnet i dette program.*). Et dokument, der ikke er beregnet, får en besked på sin linje. Det aktive dokument tæller med de sidst beregnede tal (*Forældet: dette er de senest beregnede tal — tryk F5 i dette dokument.*). Et andet dokument beregnes på forhånd af oversigten (*Allerede beregnet til dette overblik — selve dokumentet viser ældre datoer, indtil du trykker F5 dér eller slår “Beregn automatisk” til.*); er *Beregn automatisk* slået til, beregner oversigten de dokumenter for alvor. Lykkes beregningen ikke, tæller dokumentet ikke med (*Tæller ikke med: tidsplanen er ikke beregnet — aktiver dette dokument og tryk F5.*). Uden bookede ressourcer står der *Ingen bibliotekressourcer booket i de åbne dokumenter.*
- **Rækkefølge** — overallokerede ressourcer står øverst, med flest konfliktdage først og derefter alfabetisk.

## Ressourcedocken

En kompakt liste i højre kolonne, ved siden af panelet *Egenskaber*. Pr. ressource: en farveprøve, navnet (skrivebeskyttet), en rød trekant *Overallokeret*, så snart ressourcen har mindst én overallokeret dag, og *Maksimalt antal enheder* til redigering. Er der et opgavevalg, vises kun ressourcerne for disse opgaver. I headeren står *Udvid til fuldt panel* (åbner det fulde panel) og *Luk dock*. Uden ressourcer står der *Ingen ressourcer endnu. Tilføj en for at komme i gang.*

## Histogrammet

En stribe under Gantt-diagrammet, der viser en ressources belastning pr. dag. Slå den til eller fra med *Ressourcer › Histogram › Histogram* eller *Visning › Paneler › Histogram*. Standard: fra; dit valg huskes. Højden er 160 pixels som standard og kan trækkes i kanten mellem Gantt-diagrammet og histogrammet.

- **Vælger** — til venstre, under opgavetabellen, står en liste: *Alle ressourcer* øverst og under den én linje pr. ressource. Et klik vælger linjen, piletasterne bevæger sig op og ned i listen, og *Ressourcer › Histogram › Forrige* og *Næste* gør det samme. En rød prik ved en linje betyder, at ressourcen har mindst én overallokeret dag; for *Alle ressourcer* kigger prikken kun på ressourcer, der ikke er materiale. Er der et opgavevalg, indeholder listen kun ressourcerne for disse opgaver; ligger din valgte ressource uden for den, viser striben midlertidigt *Alle ressourcer* for valget.
- **Søjler** — én søjle pr. dag: belastningen i *tildelingsenheder*. En linje viser kapaciteten; den del af søjlen, der er over kapaciteten, er rød. Øverst til venstre står den højeste værdi med *tildelingsenheder*. *Alle ressourcer* lægger belastningen og kapaciteten for alle ressourcer sammen, undtagen materiale.
- **Værktøjstip** — hold musen stille et øjeblik over en dag: *N opgaver bidrager på {date}* med navnene på højst otte opgaver. For en valgt ressource og en dag, hvor dens kalender ikke arbejder, står der også *Arbejder ikke denne dag ifølge kalender "…"*.
- **Meddelelser i stribe** — *Tryk F5 for at genberegne og vise belastningen*, når der ikke er nogen belastning, *Ingen ressourcer endnu* uden ressourcer, og *⚠ Tidsplanen er forældet — genberegn (F5)* øverst til højre, når tidsplanen er forældet.
- **Hvad tæller med** — tildelingsenhederne pr. dag for hver tildeling, fordelt over opgavens arbejdsdage efter *Kurve* (eller *Rediger timefordeling*); kun opgaver uden underopgaver og ingen milepæle. Belastningen opdateres efter *Beregn* og efter ændringer af ressourcer og tildelinger; ændrer du datoerne for opgaver, tæller det først efter *Beregn*.

## Overallokering

En ressource er overallokeret på en dag, hvis dens belastning er højere end dens kapacitet. Kapaciteten er *Maksimalt antal enheder* (med kapacitetstrinnene) på en arbejdsdag i dens kalender og 0 på en fridag. Materiale tæller med her. Årsagen er enten for lidt kapacitet eller en dag, hvor ressourcen ikke arbejder ifølge sin kalender.

Her ser du det:

- **Ressourcer › Overallokering** — antallet af overallokerede ressourcer, eller *Ingen*.
- **Statuslinje** — *N ressource(r) overallokeret*; et klik åbner panelet *Advarsler*.
- **Advarsler** — én linje pr. ressource: *Overallokeret på N dag(e) (første – sidste)*, med *ressourcen arbejder ikke på disse dage ifølge sin kalender* tilføjet, hvis alle dage er fridage, eller *heraf N dag(e), hvor ressourcen ikke arbejder ifølge sin kalender* ved en blanding. Se [Meddelelser og advarsler](docs://ref-meldingen).
- **Histogram** — de røde dele af søjlerne og den røde prik i vælgeren.
- **Dock** — trekanten *Overallokeret*.

Udjævning kan løse overallokering ved at lade opgaver starte senere. Som standard kan projektslutdatoen flytte sig; med *udjævning* bliver den inden for slækken. Udjævning kan ikke løse en ressource, der skal arbejde på en fridag. Se [Udjævning](docs://uitleg-nivelleren).
