# Beskeder og advarsler

Appen fortæller dig, hvad der sker, på fire steder: statuslinjen nederst, panelet *Advarsler* til højre, de beskeder, der kort vises nederst på skærmen, og strimlerne under båndet. Denne artikel forklarer for hvert sted, hvad du ser, hvornår det vises, og hvad du kan gøre ved det. Hvorfor en tidsplan er kritisk eller overallokeret, står i [Kritisk vej og slæk](docs://uitleg-kritiek-pad). At løse overallokering står i [Løsning af overallokering](docs://howto-overbezetting-oplossen). At oprette afhængigheder står i [Oprettelse af afhængigheder](docs://howto-relaties-leggen).

## Forskellen mellem de fire

- **Statuslinje** — en fast linje med tællere. De kommer fra den sidste beregning og bliver, indtil du beregner igen.
- **Panelet *Advarsler*** — listen bag disse tællere, med alt, hvad den sidste beregning fandt. Et klik fører dig til opgaven, afhængigheden eller ressourcen. Listen er afledt af den sidste beregning; intet gemmes.
- **Beskeder** — korte beskeder om noget, du lige har gjort (gemning mislykkedes, afhængighed afvist, import læst). Infomeldinger forsvinder igen. Fejlmeldinger bliver, til du lukker dem. De står ikke i panelet.
- **Strimlen under båndet** — en farvet strimmel med en forklaring og en knap. Den hører til en tilstand i dokumentet eller til en tilstand i appen, og den bliver vist, så længe tilstanden gælder. Se *Strimlerne under båndet*.

## Statuslinjen

Statuslinjen nederst viser fra venstre mod højre:

- **Opgaver:** — antallet af bladopgaver (hovedopgaver tæller ikke med).
- **Milepæle:** — antallet af milepæle.
- **Kritisk vej: N opgaver, N arbejdsdage** — antallet af kritiske opgaver og projektets varighed. Kun synlig efter en beregning.
- **Projektslutdato:** — projektslutdatoen fra beregningen. Kun synlig efter en beregning; et tomt projekt har ingen.
- **N deadline(r) overskredet**, **N overtrådt begrænsning(er)**, **N afhængighed(er) uden for rækkefølge** og **N ressource(r) overallokeret** — hver en knap med et advarselstegn. Hver knap er kun synlig, når tælleren er over 0, og der er en beregning. Et klik åbner panelet *Advarsler* (tooltip: *Åbn advarselspanelet (detaljer og navigation)*). Står du på fanen *IFC* eller *Rapport*, springer appen samtidig til *Start*, fordi den højre kolonne ikke findes der. Tælleren *ressource(r) overallokeret* opdateres også efter ændringer i ressourcer og tildelinger. De andre tællere ændrer sig kun efter *Beregn*. De fire tællere er et udvalg: det, panelet viser derudover (afkortet forskud, ignoreret afhængighed, hængekøje uden slutbestemmende afhængighed, begrænset slutdato, tidsplanfejl), står ikke i statuslinjen.
- **Forældet — tryk F5 for at genberegne** — med et advarselstegn (tooltip: *Tidsplan forældet — tryk F5 for at genberegne*). Den vises, så snart du ændrer noget, der påvirker tidsplanen, og du ikke har genberegnet. Hvis *Beregn automatisk* er til, vises den ikke, medmindre beregningen gav en fejl. Så vises den.
- **Valg: N opgave(r)** — antallet af valgte opgaver. Kun synlig, når du har valgt noget.
- **Skala:** og **Zoom: Npx/dag** — tidsskalaen for tidslinjen og zoomniveauet. Skalaen følger af zoomen.
- **Ikke gemt** — så længe dokumentet har ændringer, der ikke er i filen.
- **AI** — en farvet prik med ordet AI, kun når AI-tilstand er til. Tooltippen siger *AI-bro:* med *Fra*, *Aktiv på port N*, *Port N er optaget* eller *Fejl*. Et klik åbner fanen *AI*.
- **Debugterminal** — en terminalknap, kun når debugterminalen er slået til. Den viser eller skjuler terminalen (*Vis debugterminal* / *Skjul debugterminal*).

## Panelet *Advarsler*

- **Åbning** — *Tidsplan › Tidsplan › Advarsler*, *Visning › Paneler › Advarsler*, eller en tæller i statuslinjen. Panelet står i højre kolonne, under *Egenskaber* og ressourcedokken, og det udvider en sammenklappet kolonne. Som standard er det lukket, og det huskes ikke mellem sessioner. Du trækker i kanten for at ændre højden, når panelet står under andre paneler. Den højde huskes. Krydset øverst til højre lukker panelet (*Luk advarsler*).
- **Overskriftslinje** — *N fejl, N advarsel(er)*. Hvis der endnu ikke er beregnet noget, står der *Ikke beregnet endnu. Tryk på Beregn (F5) for at køre kontrollerne.*
- **Beregn** — en knap i overskriftslinjen. Den er synlig, så længe tidsplanen er forældet eller endnu ikke er beregnet. Den gør det samme som *Beregn* i båndet.
- **Advarselstegn i overskriftslinjen** — vises, når tidsplanen er forældet, med tooltip *Tidsplanen er forældet. Denne liste stammer fra den sidste beregning. Genberegn (F5).* Listen skjules ikke. Den markeres kun som forældet.
- **Tom liste** — *Ingen advarsler. Tidsplanen opfylder alle kontroller.*
- **En linje** — øverst står stedet (opgave, afhængighed, ressource eller projekt), og under det står beskrivelsen. En fejl har et eget ottekantet tegn, og en advarsel et trekantet tegn. En opgave vises som `WBS-navn`. En afhængighed vises som `foregående opgave → efterfølgende opgave (FS+2d)`, med type og forsinkelse. Et klik går til stedet (tooltip: *Gå til: …*), se nedenfor. Linjen, der hører til din aktive opgave (for en afhængighed: den efterfølgende opgave) eller til den ressource, der er valgt i histogrammet, er fremhævet.
- **Rækkefølge** — fejl kommer først. Derefter kommer de pr. type i rækkefølgen på listen nedenfor. Inden for en type gælder dokumentets rækkefølge. For en afhængighed gælder den efterfølgende opgaves position, og for en ressource gælder ressourcelistens rækkefølge. En opgave, afhængighed eller ressource, der er slettet efter den sidste beregning, forsvinder fra listen.

### Typer advarsler

- **Tidsplanfejl** — *Tidsplanen kunne ikke beregnes: …* med årsagen efter, se nedenfor. Et klik: ved en cyklus vælger appen alle opgaver i cyklussen og springer til den første. Ved andre fejl er der intet at springe til, og linjen er ikke en knap.
- **Deadline overskredet** — *Deadline {date} overskredet. Tidligste slutdato {date}*. Opgaven har en deadline, og beregningen overholder den ikke. Et klik springer til opgaven. For at løse det: ret logikken eller varigheden, eller flyt deadlinen.
- **Overtrådt begrænsning** — *Begrænsning {type and date} overstyres af logikken (negativ slæk)*. Begrænsningen kan ikke overholdes uden at bryde logikken, og slækken er negativ. Et klik springer til opgaven. Se [Begrænsninger](docs://uitleg-constraints).
- **Fremdrift uden for rækkefølge** — *Uden for rækkefølge: fremdriften i den efterfølgende opgave strider mod afhængigheden*. Fremdriften i den efterfølgende opgave passer ikke til afhængighedens type. Et eksempel er en efterfølgende opgave, der allerede er i gang, mens den foregående opgave endnu ikke er færdig, under en afhængighed af typen slut til start. Et klik vælger begge opgaver, med den efterfølgende opgave aktiv. Kontrollér de faktiske datoer eller afhængigheden.
- **Forskud afkortet** — *Forskud afkortet af projektstartdatoen. Afhængigheden er ikke fuldt udnyttet*. Forskuddet i afhængigheden går før projektstartdatoen. Et klik vælger begge opgaver.
- **Afhængighed ignoreret** — *Afhængighed ignoreret: foregående opgave eller efterfølgende opgave mangler, eller er ikke en bladopgave*. Beregningen bruger ikke afhængigheden. Et klik vælger de opgaver, der stadig findes. Se [Afhængigheder](docs://uitleg-relaties).
- **Hængekøje uden slutbestemmende afhængighed** — *Hængekøje uden slutbestemmende afhængighed (ingen FF/SF-foregående opgave). Varigheden sættes til nul*. Et klik springer til opgaven. Se [Hængekøjeopgaver](docs://howto-hammock).
- **Slutdato begrænset** — *Slutdato begrænset: kalenderen efterlader ingen brugbar periode for opgaven*. Beregningen nåede grænsen for det antal dage, den søger igennem. Det kan ske, for eksempel når kalenderen har en meget lang, sammenhængende periode med fridage. Et klik springer til opgaven. Se [Kalendere og arbejdsdage](docs://uitleg-kalenders).
- **Overallokering** — *Overallokeret på N dag(e) (første – sidste)*, med *ressourcen arbejder ikke disse dage ifølge sin kalender* tilføjet, hvis alle dagene er fridage. Ved en blanding står der i stedet *hvoraf N dag(e) ressourcen ikke arbejder ifølge sin kalender*. Et klik vælger opgaverne med en tildeling på den ressource, slår histogrammet til og vælger ressourcen i det. Fra *Tabel*, *IFC* eller *Rapport* springer appen til *Ressourcer*. Se [Ressourcepanel](docs://ref-resourcepaneel).

### Årsager til en tidsplanfejl

- *Cirkulær afhængighed mellem opgaver: {path}* — afhængighederne danner en cyklus. Opgaverne står i stien. Vend eller fjern én afhængighed.
- *Kalenderen har ingen arbejdsdage angivet* — giv kalenderen mindst én arbejdsdag. Se [Kalendervinduer](docs://ref-kalenders).
- *Ugyldig varighed i dage for opgave '{task}'* og *Ugyldig varighed i timer for opgave '{task}'* — opgavens varighed er ikke et gyldigt tal.
- *Timeopgave '{task}' har ingen gyldige arbejdstimer i sin kalender* — en opgave i timer i en kalender uden arbejdstimer.
- *Ugyldig startdato for opgave '{task}'* — opgavens startdato er ikke gyldig.

## Strimlerne under båndet

En strimmel ligger lige under båndet, over arbejdsområdet. Den har en tekst og én knap. En strimmel for en tilstand har intet kryds. Du lukker de andre med krydset. De fem strimler:

- **Afhængighedstilstand** — *Afhængighedstilstand: træk i Gantt fra én bjælke til en anden for at oprette en afhængighed. Esc stopper*. Den bliver vist, så længe afhængighedstilstanden er slået til. Knap: *Stop*. Se [Oprettelse af afhængigheder](docs://howto-relaties-leggen).
- **Opdelingstilstand** — *Klik på en bjælke på den dag afbrydelsen starter, og træk til højre for længden. Esc stopper*. Den bliver vist, så længe *Opdel opgave* er slået til. Knap: *Stop*.
- **Timeplanlægning i filen** — *Denne fil indeholder timeplanlægning*. Den vises, når en åbnet fil indeholder timeplanlægning, og *Slå timeplanlægning til* er slået fra. Knap: *Slå timeplanlægning til*. Se [Aktivering af timeplanlægning](docs://howto-urenplanning-aanzetten).
- **Struktur låst** — *Ikke tilgængelig under filtrering/gruppering/sortering*. Den vises, når du ikke kan indrykke eller udrykke en opgave, fordi opgavetabellen er filtreret, grupperet eller sorteret. Knap: *Ryd*, som fjerner filteret, grupperingen og sorteringen.
- **Datoer som gemt** — Den vises, når du åbner en fil, og den genberegnede tidsplan har flyttet datoer. Teksten er: *Genberegningen flyttede N af M opgaver væk fra datoerne i filen.* Knap: *Vis gemte datoer*. Mens visningen er aktiv, står der: *Du ser datoerne, som de er gemt i filen …* Knap: *Genberegn*. Se [Datoer som gemt](docs://uitleg-datums-zoals-opgeslagen).

## Meddelelser

Meddelelser vises nederst på skærmen, også i tabellen, i Backstage og i præsentationstilstand. En meddelelse er en *fejl* eller *info*. En fejl er rød og forbliver, til du klikker på krydset. En info forsvinder efter 5 sekunder (en meddelelse med meget forklaring forbliver længere), og tiderne starter forfra, så snart stakken ændrer sig. Hver meddelelse har et kryds øverst til højre (værktøjstip *Luk meddelelse*), som lukker den med det samme. Et klik på teksten i meddelelsen gør ingenting. En afvisning er altid en fejl: en meddelelse om, at appen ikke har udført noget, du gjorde, for eksempel en afvist afhængighed, varighed, start eller milepæl. Så overser du den ikke, selvom du kigger væk et øjeblik. En afvisning forsvinder efter Ctrl+Z eller Ctrl+Y, og når du går til et andet dokument, fordi den så ikke længere er korrekt. En anden fejl, for eksempel *Kunne ikke gemme*, forbliver. Det gælder også, når resten af samme handling lykkedes, for eksempel når du indsætter i flere celler. Er flere opgaver involveret, står der på en linje nedenunder, hvilke opgaver der ikke er ændret, for eksempel *Ikke ændret: Foundation, Masonry.* Med mere end fem slutter linjen med *og N flere opgaver*. Den samme afvisning samles i én linje med en tæller, når den gentages. Højst tre vises samtidig. Kommer der en fjerde, går den ældste info først. Er der ingen info, går den ældste afvisning, dernæst den ældste fastholdte meddelelse ved åbning, og først dernæst den ældste fejl. Så skubber en info eller en afvisning aldrig en anden fejl ud, for eksempel *Kunne ikke gemme*. Stakken flytter sig væk fra knapperne i en åben dialog og fra fastlåste handlingslinjer. En meddelelse ved åbning af en fil forbliver også, til du klikker på krydset, hvis appen har udfyldt, erstattet, repareret eller udeladt data under åbningen: en linje om parser- eller kalenderfund, problemer med talformat, værdier med reserveværdi, P6-planindstillinger med en sikker reserve, en beskyttende reserve for den oprindelige plan, ignorerede henvisninger til oprindelige planer, opgaver uden planlagt start som har fået en start, afhængigheder mellem projekter eller opgaver uden projekt, som ikke er overtaget (P6 XML), noget fra en MS Project-fil, som ikke er overtaget (MS Project XML og `.mpp`), eller et ubrugeligt XER-kildearkiv, samt meddelelserne om dobbelte id'er og afhængigheder, som ikke beregnes. Indeholder den kun information uden en sådan ændring (for eksempel antal projekter, dokumenter eller tegnkodning), forsvinder meddelelsen efter 5 sekunder.

- **Tæller ×N** — en meddelelse med en fast nøgle samler en gentagelse til én linje med en tæller, for eksempel en gemmefejl, der kommer igen, eller en afvist afhængighed, som du gentager. Ikke alle meddelelser gør det.
- **Læs mere** — nogle meddelelser har et link *Læs mere* eller et eget emne (for eksempel *Opgavetyper forklaret*) til vejledningen under Backstage › Hjælp.
- **Handlingsknap** — meddelelsen om beregningsprofilen har en knap *Åbn beregningsprofil* til Projektinfo.

Listen nedenfor er et udvalg, samlet per emne. Hvor det ikke står anderledes, er det en info.

### Gemning, åbning og gendannelse

- **Gemning mislykkedes** (fejl) — *Kunne ikke gemme* med årsagen under. Ved gemning, gem som og eksport af en rapport.
- **Gemt som download** (info) — *Gemt som download: '{name}' ligger nu i downloadmappen. …* Ved *Gem som* og eksport, når omgivelserne ikke lader appen skrive direkte til det sted, du valgte. To gemte downloads lige efter hinanden samles.
- **Gemt som download (forklaring)** (info, 15 sekunder) — *Gemt som download: '{name}' ligger i downloadmappen. Denne browser lader ikke appen skrive til et eget sted, …* Ved *Gem* i en browser, der kun gemmer via en download. Én gang per session, med et link til forklaringen om filer.
- **Browseren skriver ikke tilbage** (info, 15 sekunder) — *Denne browser lader ikke appen skrive tilbage til '{name}'. …* Ved *Gem* af et projekt med en fil, når browseren må spørge om et sted igen. Én gang per session, med et link til forklaringen om filer.
- **Automatisk gem mislykkedes** (fejl) — *Automatisk gem mislykkedes* med årsagen. Gælder for automatisk gemning til filen og for genoprettelse efter nedbrud.
- **Biblioteket kunne ikke gemmes** (fejl) — *Biblioteket kunne ikke gemmes*, når du gemmer biblioteket med ressourcer.
- **Åbning af fil mislykkedes** (fejl) — *Kunne ikke åbne filen* med årsagen. For eksempel en nyligt brugt fil eller en importeret fil.
- **Gammel eller beskyttet .mpp** (fejl) — *Denne .mpp-fil bruger et ældre format (Project 2007 eller tidligere)…* eller *Denne .mpp-fil er beskyttet med adgangskode…*, begge med rådet om at eksportere filen som XML i MS Project og åbne den fil.
- **Ugyldig XER-fil** (fejl) — en af teksterne *XER…*, for eksempel *Dette er ikke en gyldig eller understøttet XER-fil.* eller *XER-filen indeholder en tabel to gange.*, med årsagen tilføjet.
- **IFC kunne ikke læses** (fejl) — *IFC kunne ikke læses* med årsagen, i IFC-visningen.
- **Gendannelse** (fejl) — *Den genoprettede fil kunne ikke læses*, *Gendannelse mislykkedes* og *N genoprettelsesfiler kunne ikke indlæses og blev sprunget over.* Ved gendannelse efter en uventet lukning.
- **Gren gemt som skabelon** (info) — *Gren gemt som skabelon '{name}'*.
- **Meddelelse fra en udvidelse** (info, eller fejl hvis udvidelsen melder en fejl) — *Udvidelse {name}: {message}*. En udvidelse kan vise højst tre nye pr. 10 sekunder, så den ikke fylder stakken. Mislykkes et trin i vejledningen fra en udvidelse, står der *Et trin fra udvidelsen {name} gav en fejl. Vejledningen fortsætter.*, og kan en projektfil fra en udvidelse ikke åbnes, står der *Projektfilen {file} fra udvidelsen {name} kunne ikke åbnes.* Begge er fejl.
- **En ændring kom imellem** (fejl) — *En ændring fra AI-assistenten eller en udvidelse kom imellem. …* Når du annullerer opgavedialogen, mens AI-assistenten eller en udvidelse i mellemtiden har ændret noget: opgaveredigeringerne fra før den ændring bliver ikke tilbageført og forbliver som almindelige trin under *Fortryd*.

### Beregning

- **Tidsplanen kunne ikke beregnes** (fejl) — *Tidsplanen kunne ikke beregnes* med årsagen under den (se *Årsager til en tidsplanfejl*). Ved *Beregn*, når du skifter dokument, og når du åbner en fil.
- **Statusdato sat til i dag** (info) — *Statusdato sat til i dag ({date}).* Når du registrerer fremdrift i et projekt uden statusdato. Appen måler fremdriften op til statusdatoen, så uden en statusdato kan den ikke behandle fremdriften. Du angiver en anden dato under *Tidsplan › Oprindelige planer & fremdrift › Statusdato*. Med et link *Læs mere* til [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang).
- **Varighed kortere end det udførte arbejde** (fejl) — *'{name}' er allerede {N}% gennemført. En varighed, der er kortere end det gennemførte arbejde, er ikke mulig. Varigheden er ikke ændret.*

### Afhængigheder og hierarki

- **Afhængighed afvist** (fejl) — *Denne afhængighed findes allerede*, *En afhængighed mellem en opgave og dens egen (over)ordnede hovedopgave er ikke tilladt.* eller *Denne afhængighed ville skabe en cyklus i tidsplanen ({cycle}), og den er ikke oprettet.* Cyklussen nævner opgaverne, så du ved, hvilken afhængighed du skal fjerne eller vende først.
- **Flytning afvist** (fejl) — *Denne flytning ville skabe en cyklus i tidsplanen ({cycle}): afhængighederne for en hovedopgave gælder også for dens underopgaver. Der er ikke ændret noget.*
- **Afhængigheder falder ud efter en flytning** (info) — *Efter flytningen forbinder N afhængigheder en opgave med sin egen hovedopgave; de tæller ikke længere med i beregningen.*
- **Afhængigheder sprunget over ved indsætning** (fejl) — *N afhængigheder blev ikke oprettet: ugyldig forbindelse…*, når du indsætter en gren. En linje nedenunder siger, hvilke afhængigheder, for eksempel *Ikke oprettet: Foundation → Masonry.*
- **Afhængigheder ikke medregnet efter import** (info) — *N afhængighed(er) kunne ikke medregnes. Tjek kolonnerne Foregående opgaver og Efterfølgende opgaver.*
- **Dobbelte id'er efter import** (info) — *Objekter med et dobbelt id i denne fil: N. De har fået hvert sit eget id…*

### Redigering af opgaver

- **Start gemt som begrænsning** (info) — *'{name}' starter tidligst {date} (SNET).* Når du ændrer starten af en opgave med en foregående opgave. Den foregående opgave bestemmer starten, så appen gemmer din dato som en begrænsning af typen *Start ikke tidligere end* (SNET). Efter genberegning (F5) starter opgaven ikke før den dato. Havde opgaven allerede en sådan begrænsning, står der *'{name}' starter nu tidligst {date} (SNET).*; for flere opgaver på én gang står der et antal. Med et link *Læs mere* til [Begrænsninger og deadlines](docs://uitleg-constraints).
- **Start ikke anvendt** (fejl) — *Den nye start af '{name}' blev ikke anvendt: opgaven har en foregående opgave, og både den foregående opgave og begrænsningen {type} {date} bestemmer dens start. Ændr den begrænsning for at flytte starten.*
- **Milepæl afvist** (fejl) — *'{task}' har ressource-tildelinger og kan ikke blive en milepæl. Slet tildelingerne først.* eller *'{task}' er en hovedopgave med underopgaver og kan ikke blive en milepæl.* Ved omdannelse i opgavedialogen, i egenskabspanelet, i genvejsmenuen og i tabellen.
- **Tildelinger flyttet til en underopgave** (info) — *Tildelingen er flyttet til underopgaven '{child}'.* eller *N tildelinger er flyttet til underopgaven '{child}'.* Når en udvidelse giver underopgaver til en opgave med tildelinger. Den opgave bliver en hovedopgave, og en hovedopgave har ikke selv tildelinger. Derfor flyttes de til den første nye underopgave. I selve appen vælger du det i vinduet *Opgave bliver en hovedopgave*; denne meddelelse vises ikke. Med et link *Læs mere* til [Tilpas strukturen](docs://howto-structuur-aanpassen).
- **Milepælsmarkering fjernet** (info) — *'{phase}' er ikke længere en milepæl.* Når en milepæl får underopgaver. En milepæl er et tidspunkt uden underopgaver; med underopgaver bliver den en hovedopgave. Med et link *Læs mere* til [Tilpas strukturen](docs://howto-structuur-aanpassen).
- **Spørgsmålet er forældet** (fejl) — *Opgaverne eller tildelingerne er ændret, mens spørgsmålet var åbent. Der er ikke ændret noget. Prøv igen.* Når du vælger i vinduet *Opgave bliver en hovedopgave*, men spørgsmålet ikke længere passer.
- **Hovedopgave afvist** (fejl) — *'{phase}' kan ikke blive en hovedopgave: …* med årsagen, og *Der er ikke ændret noget.* Når en udvidelse giver underopgaver til en opgave med tildelinger, og tildelingerne ikke kan gå til den første nye underopgave. I selve appen vises denne meddelelse ikke: dér spørger vinduet *Opgave bliver en hovedopgave*, hvad der skal ske, og *Flyt* er da deaktiveret.
- **Celler sprunget over ved indsætning** (fejl) — *N celler sprunget over: de er skrivebeskyttede (fx en automatisk nummereret WBS-kode eller en beregnet kolonne).*
- **Referencer ryddet ved indsætning** (info) — *N referencer fandtes ikke i dette dokument og er blevet ryddet (opgavekalendere, egne arbejdskategorier, opgavekoder eller brugerdefinerede felter fra kildedokumentet).*
- **Strukturen er låst** (fejl, rød stribe under båndet) — *Ikke tilgængelig under filtrering/gruppering/sortering*, med knappen *Ryd*. Når listen er filtreret, grupperet eller sorteret: når du indrykker, udrykker og trækker, og med *Indsæt over* og *Indsæt under* (højreklikmenuen eller genvejstasten). Stripen forbliver, til du klikker på krydset, bruger Ctrl+Z eller Ctrl+Y, eller går til et andet dokument. Se [Tilpas strukturen](docs://howto-structuur-aanpassen).
- **Opgave tilføjet bagerst** (fejl) — *Den nye opgave står bagerst. Under filtrering, gruppering eller sortering kan appen ikke sætte den under din markering.* Med knappen *Ryd*. Med *Opgave* og *Milepæl ▾*, når en opgave er valgt, og listen er filtreret, grupperet eller sorteret. Opgaven tilføjes, men nederst. *Ryd* fjerner filter, gruppering og sortering og lukker meddelelsen. Se [Tilføj opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen).
- **Opgavetype tilpassede varigheder** (info) — *Efter ændringen af kalenderen har opgavetypen tilpasset varigheden af N opgaver (arbejdet bliver, timer pr. dag ændrede sig).* Med et link *Opgavetyper forklaret*.

### Primavera P6 XML

- **P6 XML-fil åbnet** (info) — *P6 XML-fil åbnet: N projektdokumenter.* Efter åbning af en P6 XML-fil.
- **Ikke importeret** (forbliver) — *N afhængigheder mellem projekter er ikke overtaget som afhængigheder.* og *N opgaver uden projekt er ikke indlæst.* Tjek, om din tidsplan er komplet.
- **Tom eller ubrugelig** (fejl) — intet åbnes. Tre årsager: *Denne fil indeholder ingen opgaver, som appen kan læse.*, *Opgaverne har intet ObjectId. …* og *Filen bruger XER-kolonnenavne … Åbn selve .xer-filen.*

### Primavera (XER)

- **XER-fil åbnet** (info) — *XER-fil åbnet: N projektdokumenter.* Én meddelelse per fil, også hvis filen åbner flere projekter, med et link *Læs mere* og detaljelinjer under den. Altid *N projekter fundet.* Kun når tallet er over 0: *N tomme projekter sprunget over.*, *N projekter med oprindelig plan udeladt.*, *N oprindelige planer materialiseret.*, *N løse henvisninger til oprindelig plan ignoreret.*, *Der blev brugt en beskyttende reserve for den oprindelige plan.* og *N eksterne afhængigheder bevaret.* Kun ved en anden tegnkodning end UTF-8: *Tegnkodning valgt: {encoding}.* Desuden, når tallet er over 0: *N parserfund.*, *N kalenderfund.*, *N problemer med talformat.*, *N værdier med reserveværdi.* og *N P6-planindstillinger brugte en sikker reserve.*
- **Datoer som Primavera gemte dem** (detaljelinje i samme meddelelse) — *N opgaver viser datoerne, som Primavera gemte dem (ikke genberegnet).* N tæller alle opgaver, som filen har gemt datoer for, også dem der ikke afviger. Eller, hvis tilstanden ikke blev slået til: *N opgaver afviger fra datoerne i filen — du kan vise dem.*
- **XER-kildearkiv ubrugeligt** (info) — *XER-kildearkivet i denne fil er ubrugeligt og er udeladt. Selve projektet er fuldt åbnet.* med årsagen (for eksempel *Årsag: kontrolsummen passer ikke til kildebytes. Arkivet er beskadiget.*) og følgen (*Tidsplanen, beregningsprofilen og alle projektdata fra IFC er komplet. …*). Når du åbner en IFC-fil, hvor et tidligere gemt XER-kildearkiv ikke kan bruges. Også ved gendannelse efter en uventet lukning, hvis lageret til gendannelse ikke længere har kildearkivet.
- **Eksport mister XER-oplysninger** (info) — *Ved eksport til {format} går XER-kildeoplysninger tabt.* Efter en vellykket eksport til et andet format end IFC af et projekt med data, som kun findes i en XER-fil. Med et link *Læs mere*.

### Import, eksport og beregningsprofil

- **Datoer som i filen** (info) — *N opgaver viser datoerne, som de står i filen (ikke genberegnet).* (N tæller alle opgaver med gemte datoer) eller *N opgaver afviger fra datoerne i filen — du kan vise dem.* Ved åbning af en fil med gemte datoer.
- **Arbejde og opgavetyper synlige** (info) — *Denne fil indeholder gemt arbejde eller opgavetyper; opgavetypen og det resterende arbejde vises for dette projekt.*
- **MS Project-tidsplan læst** (info) — *Denne MS Project-fil indeholder N opgaver med afbrydelser, udjævning eller ressourcestyret tidsplan. De indlæses og vises sådan.*
- **Afbrydelser ikke eksporteret** (info) — *N opgaver med afbrydelser er eksporteret uden afbrydelser: MS Project og P6 kender afbrydelser kun som fordeling af arbejde.* Ved eksport til MS Project eller Primavera.
- **Projektstart flyttet** (info) — *N opgaver flyttede med projektstarten.* Når du sætter projektstarten senere. Kun opgaver uden foregående opgave og uden en begrænsning, der ville ligge før den nye startdato, flyttes til den dato. Med et link *Læs mere* til [Nyt projekt og Projektinfo](docs://ref-projectinfo).
- **Datovindue styrer ikke længere** (info) — *MS Projects datovindue styrer ikke længere N opgaver efter denne redigering; …* Én gang per dokument.
- **Udjævningsforskydning afrundet** (info) — *Udjævning runder MS Projects minutpræcise udjævningsforskydning for N opgaver af til hele arbejdsdage.* Én gang per dokument.
- **Beregningsprofil anvendt** (info) — *Dit projekt beregnes som {profile}. Ændr det via Fil → Projektinfo → Beregningsprofil og beregningsindstillinger.* Med knappen *Åbn beregningsprofil*. Efter anvendelse af en profil står der, om nødvendigt, *Efter anvendelsen er N opgaver forskudt.*
