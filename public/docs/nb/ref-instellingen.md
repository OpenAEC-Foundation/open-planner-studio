# Innstillinger

Alle innstillinger i appen: hva de gjør, standardverdien, hva som endres og hvor du finner dem. For beregningsalternativene for et prosjekt (beregningsprofil, hva som regnes som kritisk) se [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): de hører til filen for prosjektet, ikke til appen.

## Hvor du finner dem og hvordan de fungerer

Innstillingspanelet finnes på tre steder, og overalt er det samme panelet: tannhjulet øverst i vinduet, *Innstillinger › Prosjekt › Appinnstillinger* og *Fil › Appinnstillinger*. Panelet har tre faner: *Utseende*, *Tidsplan* og *Avansert*. Hver innstilling nedenfor nevner bare fanen.

En endring virker med en gang. Det finnes ingen knapp *Bruk* og ingen knapp *Avbryt*.

**Gjelder hele appen, ikke per prosjekt.** Alle innstillinger i denne artikkelen gjelder for alle prosjektene dine og hører til denne enheten. Appen lagrer dem i lageret til appen eller nettleseren din, ikke i prosjektfilen. Derfor ser en annen som åpner filen din sine egne innstillinger. En nettleser der du tømmer lageret, starter igjen med standardverdiene.

## Fanen *Utseende*

**Tema** — fargeskjemaet for grensesnittet. Velg mellom *Mørk*, *Lys* og *Høy kontrast*. Standard: *Mørk*. Virkning: fargene i hele grensesnittet, også Gantt og histogrammet. Hvor: *Utseende*.

**Følg systemtema** — lar fargeinnstillingen i operativsystemet bestemme. Standard: av. Virkning: appen er *Lys* eller *Mørk*, avhengig av systemet; de tre temakortene er da slått av. *Høy kontrast* følger ikke systemet: du velger den selv. Slår du dette av, blir temaet som var på skjermen da, værende. Hvor: *Utseende*, under *Tema*.

**Språk** — språket i grensesnittet. Standard: språket i nettleseren eller systemet hvis appen kjenner det, ellers engelsk. Virkning: alle tekster i appen; språkene er sortert etter kortkoden. Arabisk og persisk speiler grensesnittet fra høyre til venstre. Du velger språket for hjelpeartiklene separat, under *Dokumentasjonsspråk* i *Fil › Hjelp*. Hvor: *Utseende*.

**Skrifttype** — skrifttypen for hele grensesnittet. Velg mellom *Standard*, *System*, *Med serif* og *Monospace*. Standard: *Standard*. Virkning: overskrifter og tekst i vinduet, og teksten i Gantt og i histogrammet. En nettapp følger ikke skrifttypen i systemet av seg selv; derfor velger du den her. Hvor: *Utseende*.

**Tekststørrelse** — skala for grensesnittet. Velg mellom 90%, 100%, 110% og 125%. Standard: 100%. Virkning: teksten og oppsettet i båndet, panelene og dialogene blir større eller mindre, og radhøyden i tabellen og i Gantt følger med. Det finnes ingen valg over 125%, fordi knappeteksten i båndet da brytes over flere linjer. Hvor: *Utseende*.

**Datoformat** — hvordan datoer vises i appen. Velg mellom *dd-mm-åååå*, *mm-dd-åååå* og *åååå-mm-dd*. Standard: *dd-mm-åååå*. Virkning: datoer i tabellen, dialogene, rapportene og utskriften. Filer og beregninger endres ikke: bare visningen. Hvor: *Utseende*.

**Tidsformat** — hvordan klokkeslett vises i appen. Velg mellom *24 timer (13:00)* og *12 timer (1:00 PM)*. Standard: *24 timer (13:00)*. Virkning: klokkeslettene i kalendervinduet, dato og klokkeslett for timebaserte aktiviteter (i tabellen, ved delinger og i meldinger) og tidsskalaen *Time* i Gantt. I et tidsfelt kan du skrive begge formene: *13:00*, *1300*, *13*, *1:00 PM* eller *1 pm*. Midnatt som slutten på dagen er *24:00* eller *12:00 AM*. Filer og beregninger endres ikke: de bruker fortsatt 24-timers form. Hvor: *Utseende*.

**Visning av varighet** — i hvilken enhet varigheten til en aktivitet vises. Velg mellom *Automatisk (egen enhet per aktivitet)*, *Alltid dager* og *Alltid timer*. Standard: *Automatisk (egen enhet per aktivitet)*. Virkning: i aktivitetstabellen, stolpeetikettene i Gantt, verktøytipset, utskriften og rapportene. Med *Automatisk* viser en dagbasert aktivitet dager, og en timebasert aktivitet viser timer. Med *Alltid dager* eller *Alltid timer* regner appen om med antall timer per dag i kalenderen til aktiviteten. Hvis enheten for aktiviteten er en annen, setter appen aktivitetens egen enhet etter i parentes, for eksempel `2.25d(18h)`. Bare visningen endres; aktiviteten beholder sin egen enhet. Hvor: *Utseende*.

**Stil for bytte av dokument** — hvordan du bytter mellom åpne prosjekter. Velg mellom *Vannrette faner*, *Loddrette faner* og *Pille*. Standard: *Vannrette faner*. Virkning: *Vannrette faner* setter en fanelinje under båndet; *Loddrette faner* setter en prosjektlinje til venstre; *Pille* setter en liten prosjektknapp i tittellinjen. Hvor: *Utseende*.

### Gantt-delen

**Vis bare arbeidsdager** — komprimerer tidsaksen. Standard: av. Virkning: helger og helligdager fra prosjektkalenderen hoppes over, så en aktivitet på 5 arbeidsdager er nøyaktig 5 dager bred. Snarveiene for *Gå til i dag* og *Tilpass til prosjekt* teller da også i arbeidsdager. Rapporten har en egen avmerkingsboks med samme navn, som er uavhengig av denne innstillingen. Hvor: *Utseende*, under *Gantt › Tidsakse*.

**Vis kvarter når du zoomer langt inn** — en ekstra fin tidsskala. Standard: av. Virkning: du kan zoome lenger inn, og tidsskalaen får en ekstra rad for kvarter. Når du drar stolpen for en timebasert aktivitet, kan den feste seg til kvarter i stedet for hele timer. Du ser dette bare når *Slå på timeplanlegging* er på. Hvor: *Utseende*, under *Gantt › Kvarterzoom*.

**Stolper ved avbrudd** — om en timebasert aktivitet tegnes i tidsbånd. Velg mellom *Aldri dele*, *Del ved valg* og *Del alltid*. Standard: *Del ved valg*. Virkning: stolpen for en timebasert aktivitet tegnes da per tidsbånd i stedet for som én sammenhengende blokk. *Del ved valg* gjør det bare for den valgte aktiviteten. Det gjelder bare timebaserte aktiviteter. En virkelig delt aktivitet (med *Del aktivitet*) viser avbruddet uansett denne innstillingen. Hvor: *Utseende*, under *Gantt*.

**Rulling og zoom › Modus** — hva rullehjulet gjør over Gantt-diagrammet. Velg mellom *Posisjon*, *Taster* og *Zoom + dra*. Standard: *Zoom + dra*. Virkning: med *Zoom + dra* zoomer rullehjulet rundt markøren, Shift+rullehjul ruller gjennom radene, du flytter tidslinjen ved å dra i bakgrunnen, og Ctrl+dra (Cmd på Mac) tegner en markeringsboks. Med *Posisjon* avhenger funksjonen av rullehjulet av hvor markøren er; Ctrl+rullehjul zoomer alltid, og Shift+rullehjul ruller alltid horisontalt. Med *Taster* velger du selv hvilken tast som gjør hva. Valget gjelder også for den andre tidslinjen i delt visning. Hvor: *Utseende*, under *Gantt › Rulling og zoom*.

**Rulling og zoom › Skjermdeling** — hvor markøren er for hvilken funksjon. Synlig bare i modusen *Posisjon*. Velg mellom *Venstre/høyre*, *Øverst/nederst* og *Øvre høyre hjørne*. Standard: *Venstre/høyre*. Virkning: med *Venstre/høyre* ruller rullehjulet loddrett over venstre halvdel og vannrett over høyre halvdel. Med *Øverst/nederst* ruller rullehjulet vannrett over de øverste 30% (nær tidsskalaen) og loddrett under det. Med *Øvre høyre hjørne* ruller rullehjulet vannrett i øvre høyre kvadrant og loddrett i resten. Hvor: *Utseende*, under *Gantt › Rulling og zoom*.

**Rulling og zoom › Vertikalt, Horisontalt, Zoom** — hvilken tast som hører til hvilken rullehjulfunksjon. Synlig bare i modusen *Taster*. For hver funksjon velger du mellom *Rulling*, *Ctrl + rulling* eller *Shift + rulling*. Standard: *Vertikalt* er *Rulling*, *Zoom* er *Ctrl + rulling* og *Horisontalt* er *Shift + rulling*. Virkning: velger du en tast som allerede er i bruk, bytter den plass med funksjonen som hadde den. Hvor: *Utseende*, under *Gantt › Rulling og zoom*.

## Fanen *Tidsplan*

**Slå på byggmodus** — byggrettede startverdier for nye prosjekter. Standard: på. Virkning: på gir et nytt prosjekt kalenderen *Bouwkalender NL* med de nederlandske helligdagene, lar deg velge en bygghelligdag når du lager helligdager, tilbyr fasemalene *Boligbygging* og *Yrkesbygg / rehabilitering*, og gir nye aktiviteter arbeidskategorien *Bygg*. Av gir kalenderen *Standaardkalender* uten helligdager, bare malen *Tom* og arbeidskategorien *Annet*. En ny aktivitet under en overordnet aktivitet som har en arbeidskategori, overtar først den arbeidskategorien; *Bygg* eller *Annet* gjelder etter det. Eksisterende aktiviteter og kalendere endres ikke. Hvor: *Tidsplan*.

**Slå på timeplanlegging** — planlegging i arbeidstimer ved siden av arbeidsdager. Standard: av. Virkning: tidsskalaen *Time* vises under *Visning › Tidsskala*, i vinduet *Kalendere* kan en vanlig kalender få tidsbånd (tidsbåndet *Arbeidstider*; en kalender som allerede har tidsbånd, viser alltid tidsbåndet), og vinduet *Opprett nytt prosjekt* får valgene *Skift* og *Standardenhet for nye aktiviteter*. *Prosjektinnstillinger* får også valget *Standardenhet for nye aktiviteter*. Av: appen jobber på dagnivå. Aktiviteter som allerede er i timer, blir og tas med i beregningen; du kan bare endre varigheten deres når du slår på timeplanlegging. Hvor: *Tidsplan*, under *Timeplanlegging*. Se [Slik slår du på timeplanlegging](docs://howto-urenplanning-aanzetten).

**Tillat blandet dag/timeplanlegging** — om du velger enheten per aktivitet. Vises bare når *Slå på timeplanlegging* er på. Standard: på. Virkning: på viser nedtrekkslisten *Varighetsenhet* ved siden av varigheten til hver aktivitet. Av skjuler nedtrekkslisten. Hvor: *Tidsplan*, under *Timeplanlegging*. Se [Dager og timer](docs://uitleg-dagen-en-uren).

**Uken starter på** — den første dagen i uken. Velg mellom *Mandag* og *Søndag*. Standard: *Mandag*. Virkning: oppsettet for ukene og ukenumrene på tidsskalaen i Gantt og i rapportene (utskriften av Gantt-diagrammet), og rekkefølgen på ukedagene i vinduet *Kalendere*. Hvor: *Tidsplan*.

**Beregne automatisk** — omberegner tidsplanen så snart den er utdatert. Standard: av. Virkning: av betyr at du trykker på *Beregn* (F5) selv. På gjør at appen omberegner tidsplanen innen en brøkdel av et sekund etter en endring i aktiviteter, avhengigheter eller kalender. Mens du drar, eller mens du skriver i et felt, venter appen og beregner én gang når du er ferdig. Etter en mislykket beregning beregner den først igjen når du har endret noe. Hvor: *Tidsplan*, under *Beregning*.

**Bruk aktivitetstyper** — feltene for aktivitetstype og arbeid i appen. Standard: av. Virkning: på viser feltet *Aktivitetstype* på en aktivitet og arbeidskolonnen for tilordningene, og gjør kolonnen *Aktivitetstype* i tabellen tilgjengelig. Av skjuler dem; varighet og tildelingsenheter blir, og arbeidet følger med. Et prosjekt som allerede har data om aktivitetstype eller arbeid, for eksempel fra en `.mpp`- eller `.xer`-fil, viser alltid dem, også når innstillingen er av. Hvor: *Tidsplan*, under *Beregning*. Se [Aktivitetstyper: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels).

## Fanen *Avansert*

**Vis forklaring etter å ha åpnet** — én avmerkingsboks per format: *Primavera-fil (.xer)*, *MS Project-fil (.mpp)*, *MS Project XML*, *Primavera P6 XML* og *CSV-fil*. Standard: alle på. Virkning: på viser et vindu med en kort forklaring av formatet etter at du har åpnet en slik fil: hva appen tok med, hva den ikke tok med, og hvordan lagring og tilbakeskriving fungerer. *Ikke vis igjen for …* i det vinduet fjerner avmerkingen her; her slår du den på igjen. En IFC-fil, et eksempel og et prosjekt som en KI-assistent eller en utvidelse åpner, får aldri denne forklaringen. Hvor: *Avansert*, under *Vis forklaring etter å ha åpnet*. Se [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan).

**Slå på KI-modus** — lar en KI-assistent jobbe med tidsplanen din. Standard: av. Virkning: på viser fanen *AI* med MCP-bridgen, så en KI-assistent kan jobbe med tidsplanen din via Model Context Protocol. Av skjuler fanen og stopper bridgen. Hvor: *Avansert*, under *KI-modus*. Se [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

**Start bridgen automatisk** — starter MCP-bridgen når appen starter. Kan bare slås på når *Slå på KI-modus* er på. Standard: av. Virkning: bridgen er aktiv med en gang, så en KI-klient kan koble seg til uten at du først åpner fanen *AI*. Dette fungerer bare i skrivebordsappen, og bare én gang per oppstart: slår du bridgen av selv etterpå, starter den ikke igjen. Hvor: *Avansert*, under *KI-modus*.

**Slå på feilsøkingsterminal** — et loggpanel for feilsøking. Standard: av. Virkning: på setter en terminalknapp i statuslinjen, som viser eller skjuler loggpanelet. Av lukker panelet. Hvor: *Avansert*, under *Feilsøkingsterminal*.

**Benchmark…** — måler ytelsen til beregningsmotoren. Virkning: åpner et vindu der du kan generere en testtidsplan i en valgt størrelse, og kjernefasene måles. Prosjektet du har åpent, blir ikke endret. Det er en knapp, ikke en innstilling: det er ingenting å huske. Hvor: *Avansert*, under *Benchmark*.

**Statistikk…** — hvor ofte appen er lastet ned. Virkning: åpner vinduet *Nedlastingsstatistikk* med offentlige tall fra GitHub Releases; ingenting samles inn fra deg. Det er en knapp, ikke en innstilling. Hvor: *Avansert*, under *Statistikk*. I vinduet:

- *Nedlastinger per operativsystem* — for hvert system viser kolonnene *Nedlastinger*, *Installasjonsfiler* (det en person laster ned) og *Oppdateringer* (det oppdateringsfunksjonen i appen henter), med en linje *Totalt*. På Linux kan de to ikke skilles: oppdateringsfunksjonen henter den samme `.deb`-, `.rpm`- eller `.AppImage`-filen som folk også laster ned selv, så der teller bare snap-filen som installasjonsfil. Under den står *Oppdateringskontroller fra appen*: hvor ofte oppdateringsfunksjonen i en installert app har hentet versjonsfilen fra GitHub for å se etter en ny versjon. Dette er kontroller, ikke installasjoner.
- *Per release* — de samme nedlastingene per versjon, med datoen; først de seks nyeste, med *Vis alle … releaser* for resten.
- *Kilde* — datoen for tallene (GitHub Releases, oppdatert ukentlig) og *Oppdater nå*. Appen husker hentede tall i en halv time. Hvis hentingen mislykkes, sier vinduet det. Installasjoner via Snap Store går ikke gjennom GitHub og mangler.

**Start omvisningen** — den innledende omvisningen igjen. Virkning: lukker vinduet *Appinnstillinger* og starter omvisningen fra det første trinnet. Hvor: *Avansert*, under *Omvisning*.

**Versjon** — versjonsnummeret til appen, med to knapper. *Se etter oppdateringer* åpner oppdateringsvinduet. *Hva er nytt* viser nyhetene for den gjeldende versjonen. Hvor: *Avansert*, under *Versjon*.

**Vis klassiske visningsknapper** — en erstattet funksjon, under *Eldre funksjoner*. Standard: av. Virkning: på setter en gruppe *Visning* tilbake på fanen *Visning*, med de separate knappene *Kolonner…*, *Filter…*, *Grupper…* og *Sorter…*. De er erstattet av plusset i tabelloverskriften, oppsettknappene og oppsettvinduet. Hvor: *Avansert*, under *Eldre funksjoner*.

## Visningsvalg som appen husker utenfor panelet

Appen lagrer også disse valgene på denne enheten. Du velger dem likevel direkte på elementet, ikke i innstillingspanelet.

**Grunnlinjeoverlegg** — den aktive grunnlinjen som en tynn stolpe under aktivitetsstolpen. Standard: på. Hvor: *Visning › Grunnlinjer og fremdrift › Grunnlinjeoverlegg*.

**Fremdriftslinje** — sikksakklinjen for fremdrift ved statusdatoen. Standard: på. Effekt: linjen vises bare når prosjektet har en statusdato, og den erstatter da den separate statusdatolinjen. Hvor: *Visning › Grunnlinjer og fremdrift › Fremdriftslinje*.

**Statusdatolinje** — en prikket linje ved statusdatoen. Standard: på. Effekt: hvis fremdriftslinjen er på, tegner den selv markeringen. Hvor: *Visning › Grunnlinjer og fremdrift › Statusdatolinje*.

**Ressursmarkering** — en tynn stripe i ressursfargen under aktivitetsstolpen. Standard: av. Hvor: *Visning › Grunnlinjer og fremdrift › Ressursmarkering*.

**Slakkbånd** — slakken som et bånd bak ikke-kritiske stolper. Ikke for fullførte aktiviteter. Standard: på. Hvor: *Visning › Grunnlinjer og fremdrift › Slakkbånd*.

**Stolpefarger** — hva fargen på en stolpe avhenger av. Velg blant *Kritisk linje*, *Per aktivitet — automatisk* og *Etter kategori*. Standard: *Kritisk linje*. Effekt: gjelder samtidig for Gantt og rapporten. Hvor: *Visning › Grunnlinjer og fremdrift › Stolpefarger*.

**Histogram** — histogramstripen under Gantt. Standard: av. Hvor: *Ressurser › Histogram › Histogram*, *Visning › Paneler › Histogram* eller Ctrl+Shift+H. Du stiller inn høyden på stripen (standard 160 piksler, mellom 80 og 480) ved å dra kanten.

**Minikart** — et oversiktskart over tidslinjen. Standard: av. Hvor: *Visning › Presentasjon › Minikart*.

**Minimer båndet** — et kompakt bånd. Standard: av. Hvor: pilknappen nederst til høyre i båndet.

**Bredde på aktivitetstabellen** — standard 350 piksler, mellom 150 og 800. Du stiller den inn ved å dra skilleren ved siden av tabellen, eller med venstrepil og høyrepil når skilleren har fokus.

**Bredde på høyre panel** — standard 280 piksler, mellom 200 og 900. Du stiller den inn ved å dra kanten av panelet.

**Høyde på *Egenskaper* og *Advarsler* i høyre panel** — standard 240 og 220 piksler, mellom 120 og 2000. *Egenskaper* har den høyden også når ressurslisten er åpen. Du stiller høyden med håndtaket mellom delene. Appen husker ikke om delene er åpne eller lukket.

**Også husket, beskrevet andre steder** — kolonnene i tabellen ([Tilpasse tabellkolonner](docs://howto-tabelkolommen-aanpassen)), oppsettene dine ([Opprette og bruke et oppsett](docs://howto-layouts-gebruiken)), rapportvalgene ([Rapporttyper](docs://ref-rapporttypes)), de egne malene dine for beregningsprofiler ([Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies)) og *Dokumentasjonsspråk* i Hjelp (*Fil › Hjelp*) lagrer appen også på denne enheten, ikke i prosjektfilen.

## Se også

- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): alternativene som hører til et prosjekt.
- [Slik slår du på timeplanlegging](docs://howto-urenplanning-aanzetten): trinnene for bryteren *Slå på timeplanlegging*.
- [Dager og timer](docs://uitleg-dagen-en-uren): hvordan appen teller dager og timer.
- [Aktivitetstyper: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels): hva *Bruk aktivitetstyper* gjør synlig.
- [Hurtigtaster](docs://ref-sneltoetsen): alle taster i appen, også dem for zoom og rulling.
