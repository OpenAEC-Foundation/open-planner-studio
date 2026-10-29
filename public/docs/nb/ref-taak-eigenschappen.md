# Dialogen for aktivitet og egenskapspanelet

Du kan redigere en aktivitet på to steder: i vinduet *Rediger aktivitet* og i panelet *Egenskaper*. De deler nesten alle felt. Denne artikkelen beskriver for hvert felt hva det gjør, hva standardverdien er og hva du merker av det. Hvordan du oppretter og setter opp en aktivitet, står i [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen). Hvorfor beregningen blir som den blir, står i [Kritisk linje og slakk](docs://uitleg-kritiek-pad).

## De to stedene

- **Rediger aktivitet** — vinduet for den første valgte aktiviteten. Åpne det med F2, med et dobbeltklikk på en stolpe i Gantt, eller ved å høyreklikke en aktivitet i Gantt eller tabellen og velge *Rediger...*. Endringene dine blir i et utkast til du klikker på *Lagre* (Enter). *Avbryt* (Esc) kaster dem bort. *Lagre* er deaktivert så lenge navnet er tomt. Lagring telles som ett trinn for *Angre*, også for det du gjorde i seksjonene *Aktivitetstype*, *Avhengigheter*, *Tilordninger* og *Koder og felt*. Disse virker allerede på prosjektet mens du redigerer, og *Avbryt* angrer dem.
- **Egenskaper** — panelet i høyre kolonne, for den aktive aktiviteten. Hver endring virker med én gang. Endringer etter hverandre i samme felt telles som ett trinn for *Angre*. Uten aktivitet står det *Velg en aktivitet for å se egenskapene.* Slå det på eller av med *Visning › Paneler › Egenskaper*. Standard: på. Panelet står ved siden av Gantt og på fanen *Tabell*, ikke på *IFC* og *Rapport*, og ikke under det fulle ressurspanelet.

Bare i vinduet: *Overordnet aktivitet* og knappene *Lagre* og *Avbryt*. Bare i panelet: søppelbøtta *Slett aktivitet*, knappen *Beregn* nederst, seksjonen *Avbrudd*, de tre markørene under *Aktivitetstype* (lang ikke-arbeidsperiode, MS Project, lagrede datoer) og å legge til avhengigheter og hoppe til en koblet aktivitet i *Avhengigheter*. Alle andre felt finnes på begge steder. Vinduet viser *Avhengigheter*, *Tilordninger* og *Koder og felt* bare for en eksisterende aktivitet.

Hvis du endrer noe som påvirker datoene, trykk *Beregn*. Beregning skjer ikke av seg selv med mindre *Beregne automatisk* er på.

## Generelt

- **Navn** (i vinduet *Navn \**) — navnet på aktiviteten i Gantt, tabellen og rapportene. Må fylles ut: et tomt navn blir ikke lagret. Standard for en ny aktivitet: *Ny aktivitet*.
- **WBS-kode** — strukturkoden for aktiviteten, for eksempel `RB-301`. Må fylles ut. Med *Tidsplan › Struktur › WBS auto* er feltet deaktivert (verktøytips: *WBS-koder nummereres automatisk (Planning → Struktur)*), fordi appen da styrer kodene.
- **Beskrivelse** — fri tekst. Påvirker ikke beregningen. Du kan vise den som kolonnen *Beskrivelse* i tabellen.
- **Arbeidskategori** — arbeidskategorien til aktiviteten. Listen har gruppene *Innebygde arbeidskategorier* (*Bygg*, *Installasjon*, *Riving*, *Logistikk*, *Kontroll/inspeksjon*, *Flytting*, *Renovering*, *Vedlikehold*), *Mine arbeidskategorier* og *Fra dette prosjektet*. *Annet* vises bare hvis aktiviteten allerede har den arbeidskategorien. Nederst står *+ Ny arbeidskategori…* og *Administrer arbeidskategorier…*. Standard: arbeidskategorien til overordnet aktivitet, ellers *Bygg* (byggemodus på, standard) eller *Annet*. Virkning: ingen påvirkning på beregningen. Du kan gruppere og filtrere på den, og fargelegge stolpene etter den. Appen beholder en egen arbeidskategori på enheten din. Når du velger den, kommer en kopi inn i prosjektet (*Fra dette prosjektet*). Skriver du et navn under *+ Ny arbeidskategori…* som allerede står i *Mine arbeidskategorier*, også med andre store bokstaver, lager appen ikke en ny arbeidskategori. Den velger den eksisterende. I *Administrer arbeidskategorier…* redigerer eller fjerner du bare dine egne arbeidskategorier. Et tomt navn eller et navn som finnes fra før blir ikke lagret. Fjerner du en arbeidskategori som det åpne prosjektet bruker, spør appen først, og prosjektkopien blir værende. En arbeidskategori under *Fra dette prosjektet*, for eksempel fra en annens fil, kommer bare i din egen liste når du klikker *Legg til i mine arbeidskategorier* i *Administrer arbeidskategorier…*.
- **Kalender** — kalenderen som aktiviteten bruker til varighet, sluttdato og slakk. Standard: *Prosjektkalender: {name}*. Virkning: en aktivitet med egen kalender arbeider andre dager enn prosjektkalenderen. Etter en endring omberegner *Beregn* datoene. Se [Kalendere og arbeidsdager](docs://uitleg-kalenders).
- **Overordnet aktivitet** (bare i vinduet) — flytter aktiviteten under en annen aktivitet. Standard: den nåværende overordnede aktiviteten. *- Ingen (rot) -* plasserer den på øverste nivå. Et valg som ville lage en syklus i avhengighetene, blir avvist ved *Lagre* med en melding, og vinduet forblir åpent.

## Notater

- **Notater** — en sjekkliste på aktiviteten. *Legg til notat* legger til en linje. Haken (*Ferdig*) krysser den ut. Søppelbøtta (*Fjern*) sletter den. Uten linjer står det *Ingen notater ennå.* Påvirker ikke beregningen. Kolonnen *Notater* i tabellen viser dem med ✓ eller ○ foran.

## Milepæl

- **Milepæl** — gjør aktiviteten til en milepæl. Standard: av. Virkning: varigheten blir 0. Appen avviser det for en hovedaktivitet (en aktivitet med delaktiviteter) og for en aktivitet med tilordninger til ressurser, med en melding. Fjern tilordningene først. Fjerner du haken igjen, forsvinner *Milepæltype* og *Obligatorisk (kontraktuelt)*.
- **Milepæltype** (bare for en milepæl) — *Automatisk*, *Startmilepæl* eller *Sluttmilepæl*. Standard: *Automatisk*. Virkning: en startmilepæl står i begynnelsen av en dag, en sluttmilepæl i slutten. Med *Automatisk* regnes milepælen som startmilepæl når den er forgjenger, altså i begynnelsen av dagen.
- **Obligatorisk (kontraktuelt)** (bare for en milepæl) — markerer en kontraktuell milepæl, for eksempel en inspeksjon eller overlevering. Standard: av. Virkning: en markering for Gantt og rapporter. Den låser ikke en dato. Det gjør du med en begrensning eller tidsfrist.

## Tid

- **Start** (i vinduet *Startdato*) — viser starten, samme dato som stolpen i Gantt og kolonnen *Start*, ikke det rå planleggingsankeret. For en aktivitet som har startet, er det den faktiske starten, og feltet er skrivebeskyttet. Endre *Faktisk start* i stedet. Ellers er det den beregnede starten. Må fylles ut: et tomt felt faller tilbake. Virkning når du skriver inn: den nye datoen blir det planlagte ankeret (kolonnen *Planlagt start*). Har aktiviteten en forgjenger og har den ikke startet ennå, lagrer appen den nye starten som begrensningen *Start ikke tidligere enn (SNET)* på den datoen (eller flytter en eksisterende SNET), med en melding. Etter *Beregn* starter aktiviteten derfor ikke tidligere. Finnes det en begrensning annet enn *ASAP* eller *SNET*, bruker appen ikke starten og sier hvilken begrensning som bestemmer starten.
- **Varighet** — hvor lenge aktiviteten arbeider. Skriv `5d` for dager, eller `12h` eller `1h 30m` for timer (`u`, `hour` og `hours` virker også). Et tall uten enhet telles i aktivitetens enhet. Dager er alltid hele; timer kan ha desimaler. Ugyldig inntasting gir *Skriv inn et heltall dager eller timer, for eksempel 2d eller 12t.* og feltet hopper tilbake. Standard for ny aktivitet: 5 dager (milepæl 0). Feltet er deaktivert for hovedaktivitet, hengekøye og milepæl med varighet 0: varigheten følger av andre aktiviteter, eller er null. En aktivitet i timer er deaktivert så lenge *Slå på timeplanlegging* er av; det finnes en knapp med det navnet. Virkning: etter *Beregn* bestemmer varigheten sluttdatoen i aktivitetens kalender. Har aktiviteten ressurser og en aktivitetstype, avgjør typen om arbeid eller enheter endrer seg. Er aktiviteten allerede delvis utført, avviser appen en varighet som er kortere enn utført arbeid. Se [Dager og timer](docs://uitleg-dagen-en-uren).
- **Varighetsenhet** — et valg mellom *Dager* og *Timer*, med en infoknapp ved siden av. Bare synlig når *Slå på timeplanlegging* og *Tillat blandet dag/timeplanlegging* er på (den siste er på som standard når timeplanlegging er på). Virkning: velger du en annen enhet, konverterer appen varigheten med en gang hvis resultatet er eksakt. *Angre* setter det tilbake i ett steg. Passer det ikke eksakt, beholdes enheten, og appen sier det. En kalender uten gyldig arbeidstid avviser byttet.
- **Aktivitetstype** — hvilket hjørne av varighet × enheter = arbeid som holdes fast når en av de tre endres. Valg: *Prosjektstandard (Fast varighet og faste tildelingsenheter)*, *Fast varighet og faste tildelingsenheter*, *Fast varighet og fast arbeid*, *Fast arbeid* og *Faste enheter*. Standard: prosjektstandarden. Infoikonet ved siden av feltet forklarer aktivitetstypen som gjelder nå; i den åpne rullelisten har hvert valg et slikt infoikon. For en aktivitet fra MS Project tar forklaringen den lagrede innstillingen for innsatsdrevet med i betraktning. Bare synlig når *Bruk aktivitetstyper* er på (*Appinnstillinger*, fanen *Tidsplan*, overskriften *Beregning*) eller når selve filen har aktivitetstyper eller lagret arbeid, og bare for en vanlig aktivitet: ikke en hovedaktivitet, milepæl, hengekøye eller aktivitet i forløpt tid. Se [Aktivitetstyper: varighet, enheter og arbeid](docs://uitleg-werkregels).

## Hengekøye

- **Hengekøye (avledet varighet)** — lar varigheten følge av to andre aktiviteter i stedet for å ha en egen. Standard: av. Bare for en vanlig aktivitet, altså ikke for en milepæl eller hovedaktivitet. Når den er på: *Startstyrende avhengighet* viser forgjengerne med en avhengighet av typen slutt-til-start eller start-til-start, *Sluttstyrende avhengighet* viser dem med slutt-til-slutt eller start-til-slutt, hver med avhengighetstypen etter seg. Har du ingen sluttstyrende avhengighet, står det *Ingen sluttstyrende avhengighet (FF/SF). Spennet blir da null i lengde.* og varigheten er null. Se [Lage en hengekøye](docs://howto-hammock).

## Begrensning og tidsfrist

For en hovedaktivitet har en begrensning eller tidsfrist ingen virkning. Beregningen regner bare ut aktiviteter uten delaktiviteter. Datoene for en hovedaktivitet følger av delaktivitetene.

- **Begrensning** — en datogrense for aktiviteten. Valg: *Så tidlig som mulig (ASAP)*, *Så sent som mulig (ALAP)*, *Start ikke tidligere enn (SNET)*, *Start ikke senere enn (SNLT)*, *Slutt ikke tidligere enn (FNET)*, *Slutt ikke senere enn (FNLT)*, *Må starte på (MSO)* og *Må slutte på (MFO)*. Standard: *ASAP*, som er ingen begrensning. Velger du ASAP, forsvinner alle begrensningene for aktiviteten. Velger du ALAP, forsvinner den sekundære. Virkning etter *Beregn*: en grense flytter aktiviteten eller gjør slakken negativ. Se [Begrensninger og tidsfrister](docs://uitleg-constraints).
- **Begrensningsdato** — datoen som hører til begrensningen. Synlig for alle begrensninger unntatt *ALAP*. Må fylles ut. En ny begrensning får den planlagte starten som dato.
- **Obligatorisk (låselogikk)** — bare for *MSO* og *MFO*. Standard: av. På: datoen er hard, overstyrer avhengighetene og låser stolpen selv før forgjengerne. Et brudd gir negativ slakk oppstrøms. Første gang du slår det på, vises en forklaring én gang.
- **Sekundær begrensning** og **Sekundær dato** — en andre grense, bare én av *SNET*, *FNET*, *SNLT* eller *FNLT* (eller *(ingen)*). Synlig så snart det finnes en primær begrensning som ikke er ASAP, ALAP eller en hard låsing. Alltid myk. En ugyldig kombinasjon får en rød ramme og en grunn: en sekundær begrensning kan ikke være hard, ikke sammen med MSO/MFO eller en hard låsing, ikke sammen med ASAP/ALAP, må være en grense, og primær og sekundær kan ikke begrense samme side. Et gyldig par er for eksempel SNET med FNLT.
- **Tidsfrist** — en måldato for slutten. Tom = ingen tidsfrist. Virkning: aktiviteten flytter ikke på grunn av den. Er tidligste slutt senere, blir slakken negativ, og appen melder *Tidsfrist … oversittet — tidligste slutt …*.

## Fremdrift

- **Fremdrift (%)** — en glidebryter fra 0 til 100. Standard: 0. Virkning: over 0 fyller appen inn en manglende *Faktisk start*, og 100 fyller inn *Faktisk slutt*. Statusen følger: *Ikke startet* uten faktisk start, *Pågår* med faktisk start og *Fullført* med faktisk slutt. Gjenstående varighet (*Gjenstående*) er varighet × (1 − fremdrift), avrundet til hele dager for en aktivitet i dager og til hele minutter for en aktivitet i timer. Utført arbeid måles fram til statusdatoen. Finnes det ingen statusdato ennå, setter appen den til i dag og sier det. For en hovedaktivitet er feltet deaktivert: fremdriften følger av delaktivitetene etter *Beregn* (*Avledet fra delaktivitetene. Endre fremdriften der. Hovedaktiviteten oppdateres etter at du har beregnet (F5).*).
- **Faktisk start** — datoen aktiviteten virkelig startet. En dato etter statusdatoen blir avvist. I aktivitetstabellen og i spørsmålet *Oppgi faktisk start* blir også en dato etter faktisk slutt avvist. Er aktiviteten planlagt å starte først etter statusdatoen og får den nå fremdrift, spør vinduet *Oppgi faktisk start*. For en milepæl er det ett felt *Faktisk dato* i stedet for *Faktisk start* og *Faktisk slutt*.
- **Faktisk slutt** — datoen aktiviteten virkelig var ferdig. Å fylle den inn setter fremdriften til 100 og statusen til *Fullført*. Å tømme den setter fremdriften tilbake til 0 og statusen til *Pågår*. En dato etter statusdatoen blir avvist, som ved *Faktisk start*.
- **Gjenstående** — skrivebeskyttet (ikke for en milepæl): hvor mye varighet som gjenstår, i aktivitetens enhet.

Vinduet bruker disse reglene på utkastet. De teller først etter *Lagre*. Se [Fremdrift, statusdato og grunnlinje](docs://uitleg-voortgang).

## CPM-resultat

- **CPM-resultat** — visning du bare kan lese, av siste beregning: *Tidligste start*, *Tidligste slutt*, *Seneste start*, *Seneste slutt*, *Totalslakk*, *Fri slakk*, *Interfererende slakk* og *Kritisk linje* (*Ja* eller *Nei*). Slakk er i arbeidsdager med to desimaler. Er den utdatert eller ikke beregnet ennå? Trykk *Beregn*.

## Avhengigheter

- **Avhengigheter** — avhengighetene til denne aktiviteten, én linje per avhengighet: den koblede aktiviteten (i panelet WBS-koden, eller navnet hvis den mangler; i vinduet navnet), et lynikon hvis avhengigheten er styrende (*Styrende avhengighet (driving)*, etter en beregning), avhengighetstypen (*FS*, *SS*, *FF* eller *SF*), forsinkelsen og en søppelbøtte. I panelet er WBS-koden en knapp: peker du på den, vises aktiviteten, og klikker du, hopper du til den. Et lite merke foran koden viser rollen: et gullfarget rundt merke for en forgjenger og et lilla firkantet merke for en etterfølger, med samme farger som i [Spore en sti](docs://howto-pad-traceren). Rollen står også i navnet på knappen, for en skjermleser. I vinduet er det vanlig tekst, og du ser bare seksjonen hvis aktiviteten har avhengigheter.
- **Forsinkelse** — skriv et tall med en enhet: `2d` arbeidsdager, `3ed` kalenderdager, `2u` eller `2h` arbeidstimer, `3eu` eller `3eh` kalendertimer, `50%` en prosentandel av forgjengerens varighet, `-25e%` en prosentandel i kalendertid. Et minustegn gjør det til en ledetid. Uten enhet telles det som arbeidsdager. En ugyldig verdi gjør feltet rødt, og det faller tilbake. Se [Avhengigheter og forsinkelse](docs://uitleg-relaties).
- **Legg til avhengighet** (bare i panelet) — åpner en utkastrad. Under *Retning* velger du *Forgjenger* eller *Etterfølger*, finner aktiviteten med *Søk etter aktivitet…* på WBS eller navn, velger typen og forsinkelsen, og bekrefter med *Lagre avhengighet* (eller *Avbryt*). Et duplikat eller en avhengighet med aktivitetens egen overordnede aktivitet blir avvist med en melding, og raden blir stående.

## Avbrudd

Bare i panelet, og ikke for en milepæl, hovedaktivitet, hengekøye, aktivitet i forløpt tid, manuelt planlagt aktivitet eller en aktivitet som er for kort til et avbrudd.

- **Avbrudd** — avbrudd i arbeidet i aktiviteten. Én linje per avbrudd: *etter* (hvor mye arbeid det er før avbruddet), *avbrudd* (lengden) og enheten (*arbeidsdager*, og for en aktivitet i timer *timer*), med fra–til for stykket etter det under. Et avbrudd laget av utjevning vises med merket *utjevning*. Et avbrudd med lengde 0 fjerner det. Søppelkassen per linje (*Fjern avbrudd*) fjerner det også. Effekt: stolpen tegnes avbrutt, og etter *Beregn* flytter slutten seg med lengden på avbruddet.
- **Legg til avbrudd** — legger til et avbrudd på én enhet midt i det lengste stykket. Deaktivert når det ikke er plass til et avbrudd.
- **Fjern alle avbrudd** — vises når avbruddene kommer fra en kildefil i en form som ikke kan redigeres her (*Disse avbruddene kommer fra kildefilen i en form som ikke kan redigeres her*.). Da ser du bare datoene.

Se [Dele en aktivitet](docs://howto-taak-splitsen).

## Tilordninger

- **Tilordninger** — ressursene på denne aktiviteten. Hver ressurs står på én linje: en pil, et lite kvadrat i ressursens farge, navnet, *Tildelingsenheter*, *Arbeid (t)* og en søppelkasse (*Fjern*). En overskrift over linjene navngir kolonnene. Klikk på navnet for å vise *Kurve*, knappen *Rediger timefordeling…* og *Flytt til…* under det. Klikk igjen for å skjule dem. Har tilordningen en kurve som ikke er *Jevn*, eller en egen timefordeling, vises et stolpeikon ved navnet, også når linjen er skjult. Nederst står en liste *Tildel ressurs*; den tildeler ressursen med 1 tildelingsenhet per dag. Uten ressurser står det *Opprett ressurser først (fanen Ressurser)*. Når alle er tildelt, står det *Alle ressurser er allerede tildelt*. For en milepæl eller hovedaktivitet står det at tildeling ikke er mulig.
- **Tildelingsenheter** — hvor mye av ressursen aktiviteten bruker per dag (tildelingsenheter per dag), et tall over 0. Feltet viser høyst to desimaler; den nøyaktige verdien står i verktøytipset. Du kan skrive et komma eller et punktum. Virkning: belastningen i histogrammet og overallokeringen, og med en aktivitetstype endres også arbeidet. Kommer tildelingen fra Primavera P6 (`.xer` eller P6 XML) og er det arbeid igjen, er dette den gjenstående satsen (*Gjenstående enheter/tid* i P6). Den planlagte satsen blir lagret i tabellkolonnen *Planlagte tildelingsenheter per dag*.
- **Arbeid (t)** — gjenstående arbeid i timer for denne ressursen. Bare synlig når aktivitetstypene er synlige og aktiviteten har en; for materiale står det en strek. Låsen i overskriften viser hvilket hjørne aktivitetstypen beskytter (*Beskyttet av aktivitetstypen …*). Varseltrekanten i feltet (*Avviker fra tildelingsenheter × varighet*) betyr at det lagrede arbeidet ikke er lik tildelingsenheter × gjenstående varighet; histogrammet følger da det lagrede arbeidet.
- **Kurve** — hvordan arbeidet er fordelt over varigheten: *Jevn*, *Tidlig belastet*, *Sent belastet*, *Klokkeformet*, *Tidlig topp*, *Sen topp*, *Dobbel topp* eller *Skilpadde*. Standard: *Jevn*. Har tilordningen en egen timefordeling, står det *Kontur*, og listen er deaktivert; en importert kurve heter *Importert kurve*.
- **Rediger timefordeling…** — åpner timefordelingen per arbeidsdag for denne tilordningen. Se [Justere timefordelingen](docs://howto-urenverdeling-aanpassen).
- **Flytt til…** — flytter tilordningen til en annen aktivitet uten delaktiviteter som ikke har ressursen ennå. Bare synlig når en slik aktivitet finnes.

## Koder og felt

- **Koder og felt** — bare synlig når prosjektet har aktivitetskoder eller egendefinerte felt. Hver aktivitetskode er en liste med *(ingen)* og verdiene som `kode — beskrivelse`; per type velger du høyst én verdi. Hvert egendefinert felt har et inndatafelt som passer til typen: *Tekst*, *Tall*, *Heltall*, *Kostnad*, *Dato* eller *Ja/nei*. Effekt: ingen effekt på beregningen; du kan gruppere og filtrere på dem og vise dem som kolonner. Se [Koder og egendefinerte felt](docs://howto-codes-en-velden).

## Markører under aktivitetstypen

Bare i panelet, og bare når de gjelder.

- **Lang ikke-arbeidsperiode** — *Denne aktiviteten går over en ikke-arbeidsperiode på … dager (… til og med …).*, eller med navnet på helligdagen eller byggeferien lagt til. Vises når aktiviteten går over en sammenhengende periode på 8 dager eller mer som inneholder minst én helligdag. Det er en advarsel, ikke en avvisning; kontroller om tidsplanen skal være slik.
- **MS Project-markør** — en blokk *Følger timefordelingen fra MS Project*, *MS Project-datovinduet brukes ikke lenger etter redigering — …* eller *Egen timefordeling*, med *Les mer*. Det viser om timefordelingen fra en MS Project-fil fortsatt styrer datoene.
- **Lagrede datoer** — en blokk øverst under *Tid*, rett over *Start*, så lenge appen viser datoene fra filen. Oransje: *Du ser datoene som lå i filen, ikke appens beregning.* (for en Primavera-fil *Du ser datoene Primavera lagret, ikke appens beregning.*), med *Ved å omberegne endres denne aktiviteten.* eller *Ved å omberegne forblir denne aktiviteten uendret.* under seg. Inneholder filen ikke alt for denne aktiviteten, følger en tredje linje med de manglende verdiene: *Filen inneholder ikke alt for denne aktiviteten. Mangler: …* (for Primavera *Primavera lagret ikke alt for denne aktiviteten. Mangler: …*). Blokken forblir oransje. Med *Les mer*. Se [Lagrede datoer](docs://uitleg-datums-zoals-opgeslagen).

## Topp og bunn av panelet

- **Slett aktivitet** — søppelkassen ved siden av overskriften *Aktivitet*; sletter denne aktiviteten sammen med delaktivitetene, som ett trinn under *Angre*. Tidsplanen din er ikke oppdatert før du trykker på *Beregn*.
- **Beregn** — knappen nederst; samme beregning som *Hjem › Tidsplan › Beregn*.

## Det du ikke finner her

- **Utjevningsprioritet** — finnes ikke i vinduet eller panelet. Du stiller den ved å høyreklikke og velge *Prioritet* (*Lav* = 100, *Normal* = 500, *Høy* = 900), eller ved å skrive et tall fra 0 til 1000 i kolonnen *Utjevningsprioritet*. Standard: 500. Effekt: utjevning holder først aktiviteter med høyere prioritet på plass; 1000 låser aktiviteten, slik at utjevning aldri flytter den. Se [Utjevning](docs://uitleg-nivelleren).
- **Andre aktivitetsdata** — resten av det en aktivitet har, for eksempel kolonnene *Manuelt planlagt*, *Farge* og de tekniske kolonnene, finnes bare i tabellen. Se [Tabellkolonner](docs://ref-tabelkolommen).
