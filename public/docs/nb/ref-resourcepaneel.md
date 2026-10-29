# Ressurspanel

Ressurspanelet er der du administrerer ressurser: hvem og hva som er tilgjengelig, med hvilken kapasitet og på hvilken kalender. Histogrammet under Gantt-diagrammet og overallokering hører til panelet. Denne artikkelen forklarer for hvert felt og hver knapp hva det gjør, hva standardverdien er, og hva du ser av det. Hvordan du oppretter og tilordner ressurser, står i [Administrere ressurser](docs://howto-resources-beheren) og [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen). Hvordan du løser overallokering, står i [Løse overallokering](docs://howto-overbezetting-oplossen).

## Hvor du finner det

- **Fullt panel** — *Ressurser › Administrer › Ressurser* eller *Visning › Paneler › Ressurser*. Det tar hele arbeidsflaten. Krysset øverst til høyre lukker det.
- **Ressursdokk** — *Ressurser › Administrer › Ressursdokk* eller *Visning › Paneler › Ressursdokk*: en kompakt liste i den høyre kolonnen, ved siden av Gantt-diagrammet. Se nedenfor.
- **Histogram** — *Ressurser › Histogram › Histogram* eller *Visning › Paneler › Histogram*: en stripe under Gantt-diagrammet. Se nedenfor.
- **Visninger** — hører prosjektet til et ressursbibliotek, har den øverste høyre delen av panelet et valg mellom *Bibliotek*, *Prosjekt* og *Belegg*. Uten bibliotek finnes bare prosjekttabellen. Hver gang du åpner panelet, starter det på *Prosjekt*. Slik havner du ikke i det delte biblioteket uten at du merker det.

## Ny ressurs

- **Ny ressurs i prosjektet** (i visningen *Bibliotek* heter den *Legg til ny ressurs i biblioteket*) — knapp øverst til høyre. Den åpner en utkastrad nederst i tabellen. Ingen ressurs opprettes før du skriver et navn og forlater raden, eller trykker Enter. Klikker du bort uten navn, eller trykker du Esc, blir ingenting igjen: ingen ressurs og ingen trinn under *Angre*. Du kan fylle inn feltene i en valgfri rekkefølge. Alt lagres samtidig. Enter eller pil ned lagrer raden og åpner en ny utkastrad. Shift+Enter eller pil opp lagrer raden og går tilbake til tabellen. Utkastraden har ikke pilen for kapasitet, blyanten for kalender eller søppelbøtta. De virker på en ressurs som ikke finnes ennå. Knappen *Ny ressurs* under *Ressurser › Administrer* gjør det samme.
- **Navigasjon i tabellen** — i tabellen flytter Enter og Shift+Enter, samt piltastene opp og ned, markøren mellom radene. Enter på den siste raden åpner en ny utkastrad.

## Prosjektvisningen

Tabellen over det prosjektet bruker. Hver rad er en ressurs. Endringer i tekst og standardsats gjelder så snart du forlater feltet. Hver endring telles som ett trinn under *Angre*.

- **Farge** — en fargevelger. Standard: den første ledige fargen fra paletten. Effekt: fargen på ressursmarkeringen under Gantt-stolpene (*Visning › Grunnlinjer og fremdrift › Ressursmarkering*) og på fargeflekken i ressursdokken.
- **Navn** — navnet på ressursen. Et tomt navn lagres ikke. Feltet settes til det gamle navnet.
- **Type** — *Arbeid*, *Utstyr*, *Materiale*, *Underentreprenør* eller *Mannskap*. Standard for en ny ressurs: *Arbeid*. Effekt: *Materiale* har en *Enhet* og teller ikke med i summen *Alle ressurser* i histogrammet. Utjevning hopper over materiale. Du kan velge en ressurs av typen *Mannskap* som mannskap for andre ressurser. De andre typene beregnes likt.
- **Maksimalt antall** — hvor mye av ressursen som er tilgjengelig per dag, et tall over 0 (brøktall er tillatt). Standard: 1. Effekt: kapasiteten per dag. Er belastningen høyere, er ressursen overallokert. Pilen ved siden av åpner *Tidsfasert kapasitet*. Tallet ved pilen er antall trinn.
- **Tidsfasert kapasitet** — trinn med *Fra* (en dato) og *Maksimalt antall*. Klikker du på *Legg til trinn*, legges det til et trinn med i dag og 1. Uten trinn står det *Ingen trinn — fast maksimalt antall gjelder alltid*. Effekt: fra datoen i et trinn gjelder dets *Maksimalt antall* i stedet for den faste verdien. Det siste trinnet med en dato på eller før en dag, vinner.
- **Kalender** — en liste med *Prosjektkalender* (standard), kalenderne i prosjektet og *+ Ressurskalender* for en ny. Blyanten (*Rediger*) åpner den valgte kalenderen. Den er ikke aktiv for *Prosjektkalender*. Effekt: dagene ressursen arbeider. På en fridag er kapasiteten 0. Er det planlagt arbeid da, er ressursen overallokert, med årsaken *Arbeider ikke denne dagen i følge kalenderen “…”*. Ressurskalenderen endrer ikke datoene for en aktivitet. Se [Kalendervinduer](docs://ref-kalenders).
- **Standardsats/time** — kostnaden per time. Tomt felt betyr ingen sats. Et ugyldig tall settes til den forrige verdien. Effekt: ingen påvirkning på tidsplanen eller belastningen. Satsen bestemmer kolonnen *Totalt*, lagres i IFC-filen og skrives med ved eksport til MS Project (standardsats) og Primavera P6 XML (pris per enhet).
- **Totalt** — skrivebeskyttet: de belastede timene × satsen, med to desimaler. Uten sats eller belastning står *—*. Nederst legger en linje *Totalt* sammen alle ressursene. Timene kommer fra den siste beregningen. De telles som tildelingsenheter × timer per dag i kalenderen for aktiviteten. Er tallene utdatert? Velg *Beregn*.
- **Enhet** — måleenheten for materialet, for eksempel `m³`. Du kan bare fylle den inn for typen *Materiale* (verktøytips: *Gjelder bare for ressurser av typen Materiale*). Effekt: en etikett. Den regner ikke.
- **Mannskap** — mannskapet ressursen tilhører, valgt blant ressursene av typen *Mannskap*. Standard: *Ingen*. Effekt: bare gruppering. Kapasiteten og belastningen til et mannskap er ikke summen av medlemmene.
- **Slett** (søppelbøtta) — sletter ressursen. Har den tilordninger, spør appen først *'…' har … tilordning(er). Vil du slette?* med en hake for å bekrefte og et kryss for å avbryte.
- **Til biblioteket** — bare når prosjektet hører til et ressursbibliotek, og for en ressurs med et navn som ikke allerede kommer fra biblioteket. Legger den i biblioteket, eller kobler den til et eksisterende element med samme navn. Appen viser hva som skjedde (*Lagt til*, *Fantes allerede i biblioteket — nå koblet*, eller *Koblet til det eksisterende bibliotekselementet — verdiene er ulike, se markeringen*).
- **Koble fra biblioteket** — ikonet for å koble fra, på en ressurs som kommer fra biblioteket. Det fjerner opphavet. Deretter kan alle felt endres fritt.

Uten ressurser står det *Ingen ressurser ennå. Legg til en for å komme i gang.* Hører prosjektet til et bibliotek, står det *Dette prosjektet bruker ennå ingen ressurser fra biblioteket* med et tips.

### Ressurser fra biblioteket

En ressurs som kommer fra biblioteket, har et lite bibliotekikon (*Fra biblioteket*). Dens *Navn*, *Type*, *Standardsats/time* og *Enhet* er da vanlig tekst (*Bibliotekverdi. Rediger den i bibliotekvisningen, eller koble denne ressursen fra biblioteket.*), fordi biblioteket bestemmer hva ressursen er. *Farge*, *Maksimalt antall*, trinnene for kapasitet, *Kalender* og *Mannskap* kan du fortsatt endre, fordi prosjektet bestemmer hvor mye og når. To merker kan vises: *avviker — avgjør* (et klikk åpner vinduet *Koble til ressursbiblioteket*) og *ikke lenger i biblioteket*, med knappen *Fjern fra prosjekt*.

## Bibliotekvisningen

Bare når prosjektet hører til et ressursbibliotek. Se [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken) og [Administrere og dele ressursbiblioteker](docs://howto-bibliotheken-beheren). Øverst står et farget varsel: *Dette endrer biblioteket og gjelder alle prosjekter — kan ikke angres.* Tabellen har de samme feltene som visningen *Prosjekt*, med disse forskjellene:

- Det finnes ingen kolonne *Totalt*. Den er en beregning for ett prosjekt.
- Kolonnen *Mannskap* vises så snart biblioteket har ressurser.
- Kolonnen *Kalender* tilbyr kalenderne i biblioteket, med *Ingen kalender* som standard.
- **Tilordne til prosjekt** — legger ressursen i prosjektet, med en kopi av kalenderen. Appen melder *Lagt til* eller *Ligger allerede i prosjektet*.
- **Slett** — spør: *Vil du fjerne '…' fra biblioteket? Dette gjelder alle prosjekter og kan ikke angres*.
- Uten ressurser står det *Ingen ressurser i biblioteket ennå*.

## Beleggvisningen

En skrivebeskyttet visning over alle åpne dokumenter. Den viser hvilke bibliotekressurser som er booket hvor. Det finnes ingen knapp for en ny ressurs. Se [Bruke oversikten over belegg](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabell** — per bibliotekressurs: *Navn*, *Dokumenter* (antallet dokumenter den er i), *Periode* og *Topp / Kapasitet* (den høyeste samlede belastningen mot kapasiteten den dagen). En rød *N dager med overallokering* betyr at ressursen over flere dokumenter har mer enn kapasiteten sin. Pilen ved siden av et navn viser dokumentene, hver med periode og topp. Et klikk på en rad viser histogrammet for den ressursen (*Velg en ressurs for å se histogrammet*).
- **Hva telles** — bare dokumenter som er åpne i dette programmet (*Denne oversikten ser bare dokumentene som er åpnet i dette programmet*). Et dokument som ikke er beregnet, får en melding på linjen sin. Det aktive dokumentet telles med de sist beregnede tallene (*Utdatert: dette er de sist beregnede tallene. Trykk F5 i dette dokumentet*). Et annet dokument beregnes på forhånd av oversikten (*Beregnet på forhånd for denne oversikten. Selve dokumentet viser eldre datoer til du trykker F5 der, eller slår på “Beregn automatisk”*). Er *Beregne automatisk* på, beregner oversikten de dokumentene virkelig. Mislykkes beregningen, telles dokumentet ikke med (*Telles ikke med: tidsplanen er ikke beregnet. Aktiver dette dokumentet og trykk F5*). Uten bookede ressurser står det *Ingen bibliotekressurser er booket i de åpne dokumentene*.
- **Rekkefølge** — ressurser med dobbeltbookinger står øverst, med flest konfliktdager først, deretter alfabetisk.

## Ressursdokken

En kompakt liste i den høyre kolonnen, ved siden av panelet *Egenskaper*. Per ressurs: en fargeflekk, navnet (skrivebeskyttet), en rød trekant *Overallokert* så snart ressursen har minst én overallokert dag, og *Maksimalt antall* som du kan redigere. Er det valgt aktiviteter, vises bare ressursene for disse. I toppen står *Vis fullt panel* (åpner det fulle panelet) og *Lukk dokken*. Uten ressurser står det *Ingen ressurser ennå. Legg til en for å komme i gang.*

## Histogrammet

En stripe under Gantt-diagrammet som viser belastningen per dag for en ressurs. Slå den av eller på med *Ressurser › Histogram › Histogram* eller *Visning › Paneler › Histogram*. Standard: av. Valget ditt blir husket. Høyden er 160 piksler som standard. Du kan dra den i kanten mellom Gantt-diagrammet og histogrammet.

- **Velger** — til venstre, under aktivitetstabellen, står en liste: *Alle ressurser* øverst, og under den én linje per ressurs. Et klikk velger linjen. Piltastene går gjennom den, og *Ressurser › Histogram › Forrige* og *Neste* gjør det samme. En rød prikk ved en linje betyr at den ressursen har minst én overallokert dag. For *Alle ressurser* ser prikken bare på ressurser som ikke er materiale. Er det valgt aktiviteter, inneholder listen bare ressursene for disse. Ligger den valgte ressursen utenfor, viser stripen midlertidig *Alle ressurser* for utvalget.
- **Stolper** — én stolpe per dag: belastningen i *tildelingsenheter*. En linje viser kapasiteten. Den delen av stolpen som er over kapasiteten, er rød. Øverst til venstre står den høyeste verdien, med *tildelingsenheter*. *Alle ressurser* legger sammen belastningen og kapasiteten for alle ressurser, unntatt materiale.
- **Verktøytips** — hold musepekeren stille en stund over en dag: *N aktiviteter bidrar på {date}*, med navnene på høyst åtte aktiviteter. For en valgt ressurs og en dag den kalenderen ikke arbeider, står det også *Arbeider ikke denne dagen i følge kalenderen “…”*.
- **Meldinger i stripen** — *Trykk F5 for å omberegne og vise belastingen* når det ikke finnes belastning, *Ingen ressurser ennå* uten ressurser, og *⚠ Tidsplanen er utdatert — omberegn (F5)* øverst til høyre når tidsplanen er utdatert.
- **Hva telles** — enhetene per dag for hver tilordning, fordelt over arbeidsdagene for aktiviteten etter *Kurve* (eller *Rediger timefordeling*). Bare aktiviteter på lavest nivå telles, og ingen milepæler. Belastningen oppdateres etter *Beregn* og etter endringer i ressurser og tilordninger. Endrer du datoene for aktiviteter, telles det først etter *Beregn*.

## Overallokering

En ressurs er overallokert på en dag når belastningen er høyere enn kapasiteten. Kapasiteten er *Maksimalt antall* (med trinnene for kapasitet) på en arbeidsdag i kalenderen, og 0 på en fridag. Materiale teller også med her. Årsaken er enten for lite kapasitet, eller en dag der ressursen ikke arbeider ifølge kalenderen.

Her ser du det:

- **Ressurser › Overallokering** — antallet overallokerte ressurser, eller *Ingen*.
- **Statuslinje** — *N ressurs(er) med overallokering*. Et klikk åpner panelet *Advarsler*.
- **Advarsler** — en linje per ressurs: *Overallokering på N dag(er) (første – siste)*, med *ressursen arbeider ikke disse dagene ifølge kalenderen* lagt til hvis alle dagene er fridager. Ved en blanding står det *av dem er N dag(er) ressursen ikke arbeider ifølge kalenderen*. Se [Meldinger og advarsler](docs://ref-meldingen).
- **Histogram** — de røde delene av stolpene og den røde prikken i velgeren.
- **Ressursdokken** — trekanten *Overallokert*.

Utjevning kan løse overallokering ved å la aktiviteter starte senere. Som standard kan prosjektslutten flytte seg. Med *utjevning* holder den seg innenfor slakken. Utjevning kan ikke løse en ressurs som må arbeide på en fridag. Se [Utjevning](docs://uitleg-nivelleren).
