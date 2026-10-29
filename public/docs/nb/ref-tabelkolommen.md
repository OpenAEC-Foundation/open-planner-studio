# Tabellkolonner

Aktivitetstabellen har 86 faste kolonner, pluss én kolonne per aktivitetskode og egendefinert felt i prosjektet og åtte kolonner per grunnlinje. Denne artikkelen sier for hver kolonne hva den viser, om du kan redigere den, og i hvilken form verdien skrives. Hvordan du velger og ordner kolonner, beskrives i [Tilpasse tabellkolonner](docs://howto-tabelkolommen-aanpassen).

## Hvor du velger kolonner

Aktivitetstabellen ved siden av Gantt-diagrammet og tabellen på fanen *Tabell* har hver sitt eget kolonnevalg. Plusstegnet til høyre i overskriften åpner kolonnevelgeren (vindutittel *Velg kolonne*). På *Tabell* kan du også bruke *Tabell › Kolonner › Kolonner…*. Velgeren viser kolonnene per kategori: *Aktivitet*, *Tidsplan*, *Begrensninger*, *Avhengigheter*, *Ressurser*, *Fremdrift*, *Beregnet*, *Grunnlinje*, *Egendefinert* og *Teknisk*. Du søker på navn, og *Sist brukt* står øverst. *Gjenopprett standard* gjenoppretter standardkolonnene.

Som standard viser aktivitetstabellen ved siden av Gantt-diagrammet *WBS*, *Aktivitetsnavn* og *Varighet*. Tabellen på fanen *Tabell* viser *WBS*, *Aktivitetsnavn*, *Varighet*, *Start*, *Slutt*, *Arbeidskategori*, *Kritisk*, *Totalslakk* og *Fremdrift*, pluss én kolonne per aktivitetskode og egendefinert felt i prosjektet.

## Hvordan verdier leses og redigeres

- **Beregnede kolonner** — kolonnene i kategorien *Beregnet* og en del andre er skrivebeskyttede: de kommer fra beregningen. Prøver du å redigere en skrivebeskyttet celle, sier appen *Denne beregnede kolonnen kan ikke redigeres.* Den teksten gjelder for alle skrivebeskyttede celler, også når kolonnen ikke er beregnet. Er de utdaterte fordi du har endret noe, står *utdatert* ved siden av dem til du trykker på *Beregn*.
- **Datoer** — vises i notasjonen du valgte under *Appinnstillinger*, fanen *Utseende*, overskriften *Datoformat*.
- **Varigheter og slakk** — en varighet vises i enheten for aktiviteten (`5d`, `12h`), eller etter *Varighetsvisning* på samme fane (*Automatisk (egen enhet per aktivitet)*, *Alltid dager* eller *Alltid timer*). Slakk vises i arbeidsdager med to desimaler og desimalskilletegnet for språket ditt.
- **Ja/nei** — en ja/nei-verdi vises som *Ja* eller *Nei*. En tom verdi vises som en strek (—).
- **Redigering** — skriv inn eller velg en verdi. En ugyldig verdi blir avvist med en begrunnelse under cellen, for eksempel *Skriv inn en gyldig varighet, for eksempel 5d eller 8t.* eller *Skriv inn en prosentverdi mellom 0 og 100.* Liming av flere celler skjer celle for celle. Skrivebeskyttede celler hoppes over, og appen melder hvor mange.

## Aktivitet

- **Aktivitetsnavn** — navnet på aktiviteten. Kan redigeres; må fylles ut. En hovedaktivitet vises med fet skrift og en lys bakgrunnstone i navnecellen. En milepæl vises med fet skrift i milepælfargen (samme fargefamilie som milepælen i Gantt-diagrammet). En vanlig aktivitet forblir uendret. Det er bare formatering: velge, dra og redigere fungerer likt.
- **Beskrivelse** — beskrivelsen. Kan redigeres; fri tekst.
- **WBS** — WBS-koden. Kan redigeres og må fylles ut, men er skrivebeskyttet mens *WBS auto* er på.
- **Arbeidskategori** — arbeidskategorien (*Bygg*, *Installasjon*, *Riving*, *Logistikk*, *Kontroll/inspeksjon*, *Flytting*, *Renovering*, *Vedlikehold* eller *Annet*). Kan redigeres med en liste.
- **Egendefinert arbeidskategori** — den egendefinerte arbeidskategorien fra prosjektet, eller en strek. Kan redigeres med en liste over prosjektets egendefinerte arbeidskategorier.
- **Farge** — den lagrede fargen til aktiviteten, som en fargekode, for eksempel `#1a73e8`. Kan redigeres med en fargevelger. Den lagres i IFC-filen, men ingen stolpe eller rapport bruker den. Du stiller inn stolpefarger under *Visning › Grunnlinjer og fremdrift › Stolpefarger*.
- **Notater** — notatene som `✓ text; ○ text`. Kan redigeres så lenge det er høyst ett notat (du redigerer da teksten). Med flere notater er de skrivebeskyttede.

## Tidsplan

- **Milepæl** — om aktiviteten er en milepæl. Kan redigeres. Slår du på det, blir varigheten 0. Appen avviser det for en hovedaktivitet og for en aktivitet med tilordninger.
- **Milepæltype** — *Startmilepæl* eller *Sluttmilepæl*, eller en strek for automatisk. Kan bare redigeres på en milepæl.
- **Obligatorisk milepæl** — flagget *Obligatorisk (kontraktuelt)*. Kan bare redigeres på en milepæl.
- **Prioritet for utjevning** — et heltall fra 0 til 1000, standard 500. Kan redigeres. 1000 låser aktiviteten for utjevning.
- **Delingshull** — antall avbrudd, som `Split gaps: 2`, eller en strek. Skrivebeskyttet; du redigerer dem i panelet *Egenskaper*.
- **Aktivitetstype** — aktivitetstypen for aktiviteten; tom betyr prosjektstandarden. Kan redigeres med en liste, men er tom og skrivebeskyttet på en milepæl, hovedaktivitet eller hengekøye. Den vises bare i velgeren når aktivitetstypene er synlige (*Bruk aktivitetstyper*, eller filen har aktivitetstyper).
- **Hengekøye (utledet varighet)** — om aktiviteten er en hengekøye. Kan redigeres, unntatt på en milepæl eller hovedaktivitet.
- **Kalender** — ID-en til aktivitetens egen kalender; tom (—) betyr prosjektkalenderen. Du skriver inn eller velger en ID fra forslagene; en ukjent ID blir avvist. Merk: cellen viser for øyeblikket den interne ID-en i stedet for navnet. Velg helst en kalender i panelet *Egenskaper*.
- **Varighetstype** — *Arbeidstid* (varigheten telles i arbeidsdager eller arbeidstimer i kalenderen) eller *Forløpt tid* (varigheten telles i sammenhengende klokketid, uten kalender). Kan redigeres.
- **Varighetsenhet** — *Dager* eller *Timer*. Kan redigeres, unntatt på en hovedaktivitet, hengekøye eller milepæl. Skifte fungerer bare hvis omregningen er eksakt og *Slå på timeplanlegging* er på.
- **Varighet** — varigheten til aktiviteten, i enheten for aktiviteten eller etter *Varighetsvisning*. Kan redigeres: skriv inn `5d`, `12h` eller `1h 30m`, eller et tall i enheten for aktiviteten. Skrivebeskyttet på en hovedaktivitet, en hengekøye og en milepæl med varighet 0.
- **Start** — den viste starten, samme dato som stolpen i Gantt-diagrammet. For en aktivitet som er startet, er det den faktiske starten. Kan redigeres. En aktivitet med en forgjenger som du gir en ny start, får begrensningen *Start ikke tidligere enn (SNET)* på den datoen. Skrivebeskyttet på en hovedaktivitet eller hengekøye, med mindre den er manuelt planlagt, og på en aktivitet som er startet (*Denne aktiviteten er startet; starten er den faktiske starten. Endre den via fremdriften.*).
- **Slutt** — den viste sluttdatoen. For en ferdig aktivitet er det den faktiske slutten. Kan redigeres: en ny slutt blir en ny varighet. Appen avviser det for en milepæl, en aktivitet i forløpt tid og en aktivitet med avbrudd, og for en slutt før starten (*Slutten ligger før starten.*). Skrivebeskyttet på en hovedaktivitet eller hengekøye, med mindre den er manuelt planlagt, og på en ferdig aktivitet (*Denne aktiviteten er ferdig; slutten er den faktiske slutten. Endre den via fremdriften.*).
- **Planlagt start** — ankerpunktet for planleggingen som beregningen starter fra (ikke nødvendigvis den viste starten). Kan redigeres; samme effekt som å skrive inn i *Start*.
- **Planlagt slutt** — den angitte sluttdatoen. Kan bare redigeres på en manuelt planlagt aktivitet. Ellers sier appen *Planlagt slutt gjelder bare for en manuelt planlagt aktivitet. Endre slutt i kolonnen Slutt eller i varigheten.*

## Begrensninger

- **Begrensningstype** — typen begrensning, fra *Så tidlig som mulig (ASAP)* til *Må slutte på (MFO)*. Kan redigeres; en aktivitet uten begrensning viser *ASAP*.
- **Begrensningsdato** — datoen for begrensningen. Kan redigeres.
- **Hard begrensning** — flagget *Obligatorisk (fastlåsing)*. Kan bare redigeres på *MSO* og *MFO*.
- **Type sekundær begrensning** — typen for den andre grensen, eller en strek. Kan redigeres. Tabellen tilbyr alle typer, men en kombinasjon som ikke er tillatt, blir avvist: den må være *SNET*, *FNET*, *SNLT* eller *FNLT*, den primære begrensningen må være en grense (ikke *ASAP*, *ALAP*, *MSO*, *MFO* eller en hard begrensning), og de to grensene må ligge på motsatte sider (en nedre grense *SNET*/*FNET* med en øvre grense *SNLT*/*FNLT*, eller omvendt).
- **Dato for sekundær begrensning** — datoen for den andre grensen. Kan redigeres.
- **Tidsfrist** — måldatoen for slutten. Kan redigeres.

## Avhengigheter

- **Forgjengere** — forgjengerne, som `WBS type±forsinkelse`, adskilt med `; `, for eksempel `1.2 FS+2d`. Kan redigeres ved å skrive inn samme form. Du legger ikke til en kobling mellom prosjekter her, men med *Tidsplan › Avhengigheter › Koble › Legg til kobling mellom prosjekter…*.
- **Etterfølgere** — etterfølgerne, i samme form. Kan redigeres.
- **Styrende avhengighet** — avhengighetene som bestemmer datoen for denne aktiviteten, som `← 1.2` (forgjenger) eller `→ 1.4` (etterfølger). Skrivebeskyttet; utdatert til du trykker på *Beregn*.
- **Fri slakk** (i kategorien *Avhengigheter*) — den frie slakken per avhengighet, som `← 1.2: 3d`. Ikke den samme kolonnen som *Fri slakk* under *Beregnet*, som viser slakken til selve aktiviteten. Skrivebeskyttet.
- **Advarsler** — advarsler per avhengighet, for eksempel *Utenfor rekkefølge* eller *Ikke med i beregningen*. Skrivebeskyttet. Se [Meldinger og advarsler](docs://ref-meldingen).

## Ressurser

- **Tilordnede ressurser** — navnene på de tilordnede ressursene, adskilt med komma. Kan redigeres: legger du til et navn, tilordnes ressursen med 1 tildelingsenhet per dag. Fjerner du et navn, fjernes tilordningen. Skrivebeskyttet på en milepæl eller hovedaktivitet.
- **Tildelingsenheter per dag** — tildelingsenhetene per ressurs, som `Name: 1; Name: 0.5`, med høyst to desimaler. Den lagrede verdien forblir eksakt. Kan redigeres på en aktivitet med tilordninger.
- **Planlagte tildelingsenheter per dag** — de planlagte tildelingsenhetene per ressurs, som `Name: 1.11`, med høyst to desimaler, likt som *Tildelingsenheter per dag*. Bare for en tilordning fra Primavera P6 med en annen gjenstående tildeling. *Tildelingsenheter per dag* viser da den gjenstående tildelingen. Skrivebeskyttet.
- **Tilordningskurve** — kurven per ressurs, som `Name: Uniform`. Kan redigeres på en aktivitet med tilordninger.
- **Start for arbeidsvindu** og **Slutt for arbeidsvindu** — arbeidsvinduet per ressurs, fra en importert fil, som `Name: date`. Skrivebeskyttet.
- **Planlagt arbeid (timer)** og **Faktisk arbeid (timer)** — det planlagte og faktiske arbeidet per ressurs i timer, som `Name: 617.14`, med høyst to desimaler, fra en importert fil. Skrivebeskyttet.
- **Gjenstående arbeid (timer)** — det gjenstående arbeidet per ressurs i timer, som `Name: 6` eller `Name: 26.67`: det lagrede arbeidet, ellers gjenstående varighet × tildelingsenheter. Kan redigeres på en aktivitet med tilordninger der en aktivitetstype gjelder, med komma eller punktum som desimaltegn. Vises bare i velgeren når aktivitetstypene er synlige. Et gult ⚠ i cellen betyr at det lagrede arbeidet avviker fra tildelingsenheter × gjenstående varighet, som ⚠ ved *Arbeid (gjenst.)* i aktivitetspanelet.

## Fremdrift

- **Status** — *Ikke startet*, *Pågår* eller *Fullført*. Kan redigeres, unntatt på en hovedaktivitet.
- **Fremdrift** — fullføringsgraden, som `40%`. Kan redigeres med et tall fra 0 til 100, unntatt på en hovedaktivitet.
- **Faktisk start** — datoen aktiviteten startet. Kan redigeres, unntatt på en hovedaktivitet.
- **Faktisk slutt** — datoen aktiviteten ble ferdig. Kan redigeres, unntatt på en hovedaktivitet.
- **Faktisk varighet** — den faktiske varigheten, som et tall. Kan redigeres, unntatt på en hovedaktivitet.
- **Gjenstående** — den gjenstående varigheten, i enheten for aktiviteten. Kan redigeres, unntatt på en hovedaktivitet.
- **Fortsettelsesdato** og **Stoppdato** — fortsettelsen og stoppet for en pågående aktivitet fra en MS Project-fil eller Primavera-fil. Skrivebeskyttet.

Kolonnene for fremdrift følger appens fremdriftsregler: en faktisk dato etter statusdatoen blir avvist. På en hovedaktivitet sier appen *Fremdriften til en hovedaktivitet utledes fra delaktivitetene og kan ikke endres her.*

## Beregnet

Alle kolonner i denne kategorien er skrivebeskyttede.

- **Utjevningsforsinkelse** — hvor mange arbeidsdager utjevning forsinket aktiviteten. En strek hvis det ikke er brukt utjevning.
- **Tidligste start** og **Tidligste slutt** — de tidligste datoene fra beregningen. For en aktivitet som er startet, kan de avvike fra *Start* og *Slutt*: beregningsprofilen *Primavera P6* setter den tidligste starten for en aktivitet som pågår eller er ferdig, på statusdatoen.
- **Seneste start** og **Seneste slutt** — de seneste datoene aktiviteten fortsatt kan starte eller slutte på, uten å forsinke prosjektet.
- **Fri slakk** — antall arbeidsdager aktiviteten kan skli uten å forsinke en etterfølger.
- **Totalslakk** — antall arbeidsdager aktiviteten kan skli uten å forsinke prosjektslutten. Negativ hvis en begrensning eller tidsfrist ikke kan nås.
- **Kritisk** — *Ja* hvis aktiviteten ligger på den kritiske linjen.
- **Interfererende slakk** — totalslakk minus fri slakk.
- **Nesten kritisk** — *Ja* for en nesten kritisk aktivitet. Fylles bare ut hvis *Marker nesten kritisk* er på (*Prosjektinnstillinger*, blokken *Beregningsprofil og beregningsalternativer*). Ellers en strek.
- **Slakksti** — nummeret på slakkstien, 1 for den mest kritiske. Fylles bare ut hvis *Flere slakkstier* er på. Ellers en strek.
- **Kilde for registrerte datoer** — så lenge appen viser datoene fra filen: *Delvis ikke registrert* på en aktivitet som filen ikke har alle opplysninger om. Vises bare i velgeren i den visningen. På en tidsakse uten registrering vises *Ikke registrert* i kolonnene for seneste datoer og slakk.

Se [Kritisk linje og slakk](docs://uitleg-kritiek-pad).

## Grunnlinje

For hver grunnlinje i prosjektet legges det til kolonner, med navnet på grunnlinjen foran kolonnenavnet (`<baseline> — Scheduled start`). De er skrivebeskyttede. En aktivitet som ikke er med i grunnlinjen, viser en strek med verktøytipset *Ikke med i denne grunnlinjen*.

- **Planlagt start**, **Planlagt slutt** og **Varighet** — starten, slutten og varigheten slik grunnlinjen registrerte dem.
- **Startavvik** og **Sluttavvik** — antall arbeidsdager mellom grunnlinjen og den viste starten eller slutten, i prosjektkalenderen; positivt hvis aktiviteten er senere.
- **Varighetsavvik** — den nåværende varigheten minus varigheten i grunnlinjen, i arbeidsdager.

## Egendefinert

- **Aktivitetskode** — én kolonne per aktivitetskode, med navnet på koden. Viser koden for den valgte verdien. Kan redigeres: du skriver inn koden eller velger den fra forslagene. En ukjent kode blir avvist, og hvis en kode finnes mer enn én gang, ber appen deg velge den fra listen.
- **Egendefinert felt** — én kolonne per egendefinert felt, med navnet sitt. Inndata passer til typen: tekst, tall, heltall, kostnad, dato eller ja/nei. Kan redigeres.

Disse kolonnene hører til prosjektet som koden eller feltet ligger i. Se [Koder og egendefinerte felt](docs://howto-codes-en-velden).

## Teknisk

Alle kolonner i denne kategorien er skrivebeskyttede. De viser data som appen lagrer, men ikke viser i en vanlig kolonne, for eksempel for å kontrollere en import.

- **Aktivitets-ID** — den interne ID-en til aktiviteten.
- **Overordnet aktivitets-ID** og **Underordnede aktivitets-ID-er** — ID-ene til den overordnede og de underordnede aktivitetene.
- **Ressurs-ID-er** — ID-ene til ressursene på aktiviteten.
- **Tilordnings-ID**, **Aktivitets-ID for tilordning** og **Ressurs-ID for tilordning** — ID-ene til tilordningen, aktiviteten og ressursen for denne aktiviteten.
- **Varighet (minutter)** og **Gjenstående (minutter)** — varigheten og den gjenstående varigheten i minutter; fylles bare ut på en aktivitet i timer.
- **Utjevningsforsinkelse (minutter)** og **Forløpt utjevningsforsinkelse** — utjevningsforsinkelsen fra MS Project i minutter, og om den telles i klokketid.
- **Manuelt planlagt** — om aktiviteten er manuelt planlagt.
- **Aktivitetstype i MS Project (import)** og **Innsatsdrevet** — aktivitetstypen og flagget for innsatsdrevet slik MS Project hadde dem.
- **Primavera P6-opphav** — kildefeltene fra en Primavera-fil, som `key: value`.
- **Eksplisitt hovedaktivitet** — om aktiviteten er en eksplisitt hovedaktivitet uten delaktiviteter (fra en Primavera-fil).
- **Tidsfordelt sluttgulv**, **Tidsfordelt startanker**, **Tidsfordelte varighetssegmenter** og **Tidsfordelte konturer** — fordelingen per time fra en MS Project-fil, som datoer og antall.
- **Data for aktivitetskoder**, **Data for egendefinerte felt** og **Notatdata** — antall kodetilordninger, egendefinerte felt og notater.
- **Data for interne avhengigheter** og **Data for koblinger mellom prosjekter** — antall interne avhengigheter og koblinger mellom prosjekter.
- Per grunnlinje står **Milepæl** og **Milepæltype** også her, slik grunnlinjen registrerte dem.
