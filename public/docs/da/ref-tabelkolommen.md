# Tabelkolonner

Opgavetabellen har 86 faste kolonner, plus én kolonne pr. opgavekode og brugerdefineret felt i projektet og otte kolonner pr. oprindelig plan. Denne artikel beskriver for hver kolonne, hvad den viser, om du kan redigere den, og i hvilken form værdien skrives. Hvordan du vælger og ordner kolonner, står i [Tilpas tabelkolonner](docs://howto-tabelkolommen-aanpassen).

## Hvor du vælger kolonner

Opgavetabellen ved siden af Gantt-diagrammet og tabellen på fanen *Tabel* har hver sit eget kolonnevalg. Plustegnet til højre i overskriften åbner kolonnevælgeren (vinduetitel *Vælg kolonne*). På *Tabel* kan du også bruge *Tabel › Kolonner › Kolonner…*. Vælgeren viser kolonnerne pr. kategori: *Opgave*, *Tidsplan*, *Begrænsninger*, *Afhængigheder*, *Ressourcer*, *Fremdrift*, *Beregnet*, *Oprindelig plan*, *Brugerdefineret* og *Teknisk*. Du søger på navn, og *Senest brugt* står øverst. *Nulstil til standard* gendanner standardkolonnerne.

Som standard viser tabellen ved siden af Gantt-diagrammet *WBS*, *Opgavenavn* og *Varighed*. Tabellen på fanen *Tabel* viser *WBS*, *Opgavenavn*, *Varighed*, *Start*, *Slutdato*, *Arbejdskategori*, *Kritisk*, *Samlet slæk* og *Fremdrift*, plus en kolonne pr. opgavekode og brugerdefineret felt i projektet.

## Sådan læses og redigeres værdier

- **Beregnede kolonner** — kolonnerne i kategorien *Beregnet* og en række andre er skrivebeskyttede: de kommer fra beregningen. Hvis du prøver at redigere en skrivebeskyttet celle, siger appen *Denne beregnede kolonne kan ikke redigeres*. Den tekst er den generelle besked for alle skrivebeskyttede celler, også når kolonnen ikke er beregnet. Hvis værdierne er forældede, fordi du har ændret noget, vises *forældet* ved siden af dem, indtil du trykker på *Beregn*.
- **Datoer** — vises i den notation, du valgte under *App-indstillinger*, fanen *Udseende*, overskriften *Datoformat*.
- **Varigheder og slæk** — en varighed vises i opgavens enhed (`5d`, `12h`), eller efter *Varighedsvisning* på samme fane (*Automatisk (egen enhed pr. opgave)*, *Altid dage* eller *Altid timer*). Slæk vises i arbejdsdage med to decimaler og decimaltegnet for dit sprog.
- **Ja/nej** — en ja/nej-værdi vises som *Ja* eller *Nej*; en tom værdi vises som en tankestreg (—).
- **Redigering** — skriv eller vælg en værdi. En ugyldig værdi afvises med en begrundelse under cellen, for eksempel *Indtast en gyldig varighed, for eksempel 5d eller 8t*, eller *Indtast en procentdel mellem 0 og 100*. Indsætter du en blok celler, sker det celle for celle. Skrivebeskyttede celler springes over, og appen oplyser, hvor mange.

## Opgave

- **Opgavenavn** — navnet på opgaven. Kan redigeres; feltet er påkrævet. En hovedopgave vises med fed skrift og en lys baggrundstone i navnecellen. En milepæl vises med fed skrift i milepælsfarven (samme farvefamilie som milepælen i Gantt-diagrammet). En almindelig opgave forbliver, som den er. Det er kun formatering: markering, trækning og redigering virker på samme måde.
- **Beskrivelse** — beskrivelsen. Kan redigeres; fri tekst.
- **WBS** — WBS-koden. Kan redigeres og er påkrævet, men skrivebeskyttet, så længe *WBS auto* er slået til.
- **Arbejdskategori** — arbejdskategorien (*Byggeri*, *Installation*, *Nedrivning*, *Logistik*, *Kontrol/inspektion*, *Flytning*, *Renovation*, *Vedligeholdelse* eller *Andet*). Kan redigeres med en liste.
- **Brugerdefineret arbejdskategori** — den brugerdefinerede arbejdskategori fra projektet, eller en tankestreg. Kan redigeres med en liste over projektets brugerdefinerede arbejdskategorier.
- **Farve** — den gemte farve for opgaven, som en farvekode, for eksempel `#1a73e8`. Kan redigeres med en farvevælger. Den gemmes i IFC-filen, men ingen bjælke eller rapport bruger den. Bjælkefarver angiver du under *Visning › Oprindelige planer & fremdrift › Bjælkefarver*.
- **Noter** — noterne som `✓ tekst; ○ tekst`. Kan redigeres, så længe der højst er én note (du redigerer så dens tekst). Med flere noter er feltet skrivebeskyttet.

## Tidsplan

- **Milepæl** — om opgaven er en milepæl. Kan redigeres. Slår du den til, bliver varigheden 0. Appen afviser det for en hovedopgave og for en opgave med tildelinger.
- **Milepælstype** — *Startmilepæl* eller *Slutmilepæl*, eller en tankestreg for automatisk. Kan kun redigeres på en milepæl.
- **Obligatorisk milepæl** — markeringen *Obligatorisk (kontraktuel)*. Kan kun redigeres på en milepæl.
- **Udjævningsprioritet** — et helt tal fra 0 til 1000, standard 500. Kan redigeres. 1000 fastlåser opgaven for udjævning.
- **Splithuller** — antallet af huller, som `Splithuller: 2`, eller en tankestreg. Skrivebeskyttet; du redigerer dem i panelet *Egenskaber*.
- **Opgavetype** — opgavetypen for opgaven. Et tomt felt betyder projektets standard. Kan redigeres med en liste, men er tom og skrivebeskyttet på en milepæl, hovedopgave eller hængekøje. Den vises kun i vælgeren, når opgavetyper er synlige (*Brug opgavetyper*, eller når filen indeholder opgavetyper).
- **Hængekøje (afledt varighed)** — om opgaven er en hængekøje. Kan redigeres, undtagen på en milepæl eller hovedopgave.
- **Kalender** — id'et for opgavens egen kalender. En tom værdi (—) betyder projektkalenderen. Du skriver eller vælger et id fra forslagene; et ukendt id afvises. Bemærk: cellen viser i øjeblikket det interne id i stedet for navnet. Vælg hellere en kalender i panelet *Egenskaber*.
- **Varighedstype** — *Arbejdstid* (varigheden tæller i arbejdsdage eller arbejdstimer i kalenderen) eller *Forløbet varighed* (varigheden tæller i sammenhængende klokketid, uden kalender). Kan redigeres.
- **Varighedsenhed** — *Dage* eller *Timer*. Kan redigeres, undtagen på en hovedopgave, hængekøje eller milepæl. Skiftet lykkes kun, hvis omregningen er præcis, og *Slå timeplanlægning til* er markeret.
- **Varighed** — varigheden af opgaven, i opgavens enhed eller efter *Varighedsvisning*. Kan redigeres: skriv `5d`, `12h` eller `1h 30m`, eller et tal i opgavens enhed. Skrivebeskyttet på en hovedopgave, en hængekøje og en milepæl med varighed 0.
- **Start** — den viste startdato, samme dato som Gantt-bjælken. For en opgave, der er startet, er det den faktiske start. Kan redigeres. Giver du en opgave med en foregående opgave en ny start, får opgaven begrænsningen *Start ikke tidligere end (SNET)* på den dato. Skrivebeskyttet på en hovedopgave eller hængekøje, medmindre opgaven er manuelt planlagt, og på en opgave, der er startet (*Denne opgave er startet; startdatoen er en faktisk startdato. Ændr den via fremdriften*).
- **Slutdato** — den viste slutdato. For en færdig opgave er det en faktisk slutdato. Kan redigeres: en ny slutdato giver en ny varighed. Appen afviser den for en milepæl, en opgave i forløbet varighed og en opgave med splithuller, og for en slutdato før startdatoen (*Slutdatoen ligger før startdatoen*). Skrivebeskyttet på en hovedopgave eller hængekøje, medmindre opgaven er manuelt planlagt, og på en færdig opgave (*Denne opgave er færdig, så slutdatoen er en faktisk slutdato. Ændr den via fremdriften*).
- **Planlagt start** — ankerpunktet, som beregningen starter fra (ikke nødvendigvis den viste start). Kan redigeres; det har samme effekt som at skrive i *Start*.
- **Planlagt slutdato** — den indtastede slutdato. Kan kun redigeres på en manuelt planlagt opgave. Ellers siger appen *Planlagt slutdato gælder kun for en manuelt planlagt opgave. Ændr slutdatoen via kolonnen Slutdato eller via varigheden*.

## Begrænsninger

- **Begrænsningstype** — typen af begrænsningen, fra *Så tidligt som muligt (ASAP)* til *Skal slutte den (MFO)*. Kan redigeres. En opgave uden begrænsning viser *ASAP*.
- **Begrænsningsdato** — datoen for begrænsningen. Kan redigeres.
- **Hård begrænsning** — markeringen *Obligatorisk (pin-logik)*. Kan kun redigeres på *MSO* og *MFO*.
- **Sekundær begrænsningstype** — typen af den anden grænse, eller en tankestreg. Kan redigeres. Tabellen tilbyder alle typer, men en kombination, som ikke er tilladt, afvises: den skal være *SNET*, *FNET*, *SNLT* eller *FNLT*, den primære begrænsning skal være en grænse (ikke *ASAP*, *ALAP*, *MSO*, *MFO* eller en hård begrænsning), og de to skal begrænse hver sin side (en nedre grænse *SNET*/*FNET* med en øvre grænse *SNLT*/*FNLT*, eller omvendt).
- **Sekundær begrænsningsdato** — datoen for den anden grænse. Kan redigeres.
- **Deadline** — måldatoen for slutdatoen. Kan redigeres.

## Afhængigheder

- **Foregående opgaver** — de foregående opgaver, som `WBS type±forsinkelse`, adskilt af `; `, for eksempel `1.2 FS+2d`. Kan redigeres ved at skrive i samme form. En ekstern afhængighed tilføjer du ikke her, men med *Tidsplan › Afhængigheder › Sammenkæd › Tilføj ekstern afhængighed…*.
- **Efterfølgende opgaver** — de efterfølgende opgaver, i samme form. Kan redigeres.
- **Bestemmende afhængigheder** — afhængighederne, der bestemmer datoen for denne opgave, som `← 1.2` (foregående opgave) eller `→ 1.4` (efterfølgende opgave). Skrivebeskyttet; kolonnen er forældet, indtil du trykker på *Beregn*.
- **Tilladt slæk** (i kategorien *Afhængigheder*) — den tilladte slæk pr. afhængighed, som `← 1.2: 3d`. Det er ikke den samme kolonne som *Tilladt slæk* under *Beregnet*, som viser slækken for opgaven selv. Skrivebeskyttet.
- **Advarsler** — advarsler pr. afhængighed, for eksempel *Ude af rækkefølge* eller *Ikke medregnet i beregningen*. Skrivebeskyttet. Se [Meddelelser og advarsler](docs://ref-meldingen).

## Ressourcer

- **Tildelte ressourcer** — navnene på de tildelte ressourcer, adskilt af komma. Kan redigeres: et navn tilføjes, og ressourcen tildeles med 1 tildelingsenhed pr. dag; et navn fjernes, og tildelingen fjernes. Skrivebeskyttet på en milepæl eller hovedopgave.
- **Tildelingsenheder pr. dag** — tildelingsenhederne pr. ressource, som `Navn: 1; Navn: 0.5`, med højst to decimaler. Den gemte værdi forbliver nøjagtig. Kan redigeres på en opgave med tildelinger.
- **Planlagte tildelingsenheder pr. dag** — den planlagte sats pr. ressource, som `Name: 1.11`, med højst to decimaler, ligesom *Tildelingsenheder pr. dag*. Kun for en tildeling fra Primavera P6 med en anden resterende sats; *Tildelingsenheder pr. dag* viser da den resterende sats. Skrivebeskyttet.
- **Tildelingskurve** — kurven pr. ressource, som `Navn: Uniform`. Kan redigeres på en opgave med tildelinger.
- **Arbejdsvindue startdato** og **Arbejdsvindue slutdato** — arbejdsvinduet pr. ressource, fra en importeret fil, som `Navn: dato`. Skrivebeskyttet.
- **Planlagt arbejde (timer)** og **Faktisk arbejde (timer)** — det planlagte og faktiske arbejde pr. ressource i timer, som `Navn: 617.14`, med højst to decimaler, fra en importeret fil. Skrivebeskyttet.
- **Resterende arbejde (timer)** — det resterende arbejde pr. ressource i timer, som `Navn: 6` eller `Navn: 26.67`: det gemte arbejde, ellers resterende varighed × tildelingsenheder. Kan redigeres på en opgave med tildelinger, hvor en opgavetype gælder, med komma eller punktum som decimaltegn. Den vises kun i vælgeren, når opgavetyperne er synlige. En gul ⚠ i cellen betyder, at det gemte arbejde afviger fra tildelingsenheder × resterende varighed, som ⚠ ved *Arbejde (rest.)* i opgavepanelet.

## Fremdrift

- **Status** — *Ikke startet*, *I gang* eller *Fuldført*. Kan redigeres, undtagen på en hovedopgave.
- **Fremdrift** — procentdelen, som `40%`. Kan redigeres med et tal fra 0 til 100, undtagen på en hovedopgave.
- **Faktisk startdato** — datoen, hvor opgaven begyndte. Kan redigeres, undtagen på en hovedopgave.
- **Faktisk slutdato** — datoen, hvor opgaven blev færdig. Kan redigeres, undtagen på en hovedopgave.
- **Faktisk varighed** — den faktiske varighed, som et tal. Kan redigeres, undtagen på en hovedopgave.
- **Resterende** — den resterende varighed, i opgavens enhed. Kan redigeres, undtagen på en hovedopgave.
- **Genoptagelsesdato** og **Stopdato** — genoptagelsen og stoppet af en kørende opgave fra en MS Project- eller Primavera-fil. Skrivebeskyttet.

Fremdriftskolonnerne følger appens regler for fremdrift: en faktisk dato efter statusdatoen afvises. På en hovedopgave siger appen *Fremdriften for en hovedopgave afledes af dens underopgaver og kan ikke ændres her*.

## Beregnet

Alle kolonner i denne kategori er skrivebeskyttede.

- **Udjævningsforskydning** — hvor mange arbejdsdage udjævningen forsinkede opgaven. En tankestreg, hvis der ikke er anvendt udjævning.
- **Tidligste startdato** og **Tidligste slutdato** — de tidligste datoer fra beregningen. For en opgave, der er startet, kan de afvige fra *Start* og *Slutdato*: beregningsprofilen *Primavera P6* sætter den tidligste startdato for en opgave, der er i gang eller færdig, på statusdatoen.
- **Seneste startdato** og **Seneste slutdato** — de seneste datoer, hvor opgaven stadig må begynde eller slutte uden at forsinke projektet.
- **Tilladt slæk** — de arbejdsdage, opgaven må glide uden at forsinke en efterfølgende opgave.
- **Samlet slæk** — de arbejdsdage, opgaven må glide uden at forsinke projektslutdatoen. Negativ, hvis en begrænsning eller deadline ikke kan overholdes.
- **Kritisk** — *Ja*, hvis opgaven ligger på den kritiske vej.
- **Interfererende slæk** — samlet slæk minus tilladt slæk.
- **Næsten kritisk** — *Ja* for en næsten kritisk opgave. Feltet udfyldes kun, hvis *Markér næsten kritisk* er slået til (*Projektindstillinger*, blok *Beregningsprofil og beregningsindstillinger*). Ellers vises en tankestreg.
- **Slækssti** — nummeret på slækstien; 1 for den mest kritiske. Udfyldes kun, hvis *Flere slækstier* er slået til. Ellers vises en tankestreg.
- **Kilde for registrerede datoer** — så længe appen viser datoerne fra filen: *Delvist ikke registreret* på en opgave, hvor filen ikke indeholder alt. Vises kun i vælgeren i den visning. På en ikke-registreret akse vises *Ikke registreret* i kolonnerne for seneste datoer og slæk.

Se [Kritisk vej og slæk](docs://uitleg-kritiek-pad).

## Oprindelig plan

For hver oprindelig plan i projektet tilføjes kolonner, med navnet på den oprindelige plan foran kolonnenavnet (`<baseline> — Planlagt start`). De er skrivebeskyttede. En opgave, der ikke findes i den oprindelige plan, viser en tankestreg med hjælpeteksten *Ikke til stede i denne oprindelige plan*.

- **Planlagt start**, **Planlagt slutdato** og **Varighed** — startdatoen, slutdatoen og varigheden, som den oprindelige plan registrerede dem.
- **Startafvigelse** og **Slutafvigelse** — antallet af arbejdsdage mellem den oprindelige plan og den viste start eller slutdato, i projektets kalender. Positiv, hvis opgaven er senere.
- **Varighedsafvigelse** — den aktuelle varighed minus varigheden i den oprindelige plan, i arbejdsdage.

## Brugerdefineret

- **Opgavekode** — én kolonne pr. opgavekode, med navnet på koden. Viser koden for den valgte værdi. Kan redigeres: du skriver koden eller vælger den fra forslagene. En ukendt kode afvises. Hvis en kode forekommer mere end én gang, beder appen dig vælge den fra listen.
- **Brugerdefineret felt** — én kolonne pr. brugerdefineret felt, med dets navn. Inputtet passer til typen: tekst, tal, heltal, omkostning, dato eller ja/nej. Kan redigeres.

Disse kolonner hører til det projekt, koden eller feltet findes i. Se [Koder og brugerdefinerede felter](docs://howto-codes-en-velden).

## Teknisk

Alle kolonner i denne kategori er skrivebeskyttede. De viser data, som appen gemmer, men ikke viser i en almindelig kolonne, for eksempel til kontrol af en import.

- **Opgave-id** — det interne id for opgaven.
- **Overordnet opgave-id** og **Underopgave-id'er** — id'erne for den overordnede opgave og for underopgaverne.
- **Ressource-id'er** — id'erne for ressourcerne på opgaven.
- **Tildelings-id**, **Tildelings-opgave-id** og **Tildelings-ressource-id** — id'erne for tildelingerne, opgaverne og ressourcerne på denne opgave.
- **Varighed (minutter)** og **Resterende (minutter)** — varigheden og den resterende varighed i minutter. Udfyldes kun på en opgave i timer.
- **Udjævningsforskydning (minutter)** og **Forløbet udjævningsforskydning** — udjævningsforskydningen fra MS Project i minutter, og om den tæller i klokketid.
- **Manuelt planlagt** — om opgaven er manuelt planlagt.
- **MS Project-opgavetype (import)** og **Indsatsbaseret** — opgavetypen og markeringen for indsatsbaseret planlægning, som MS Project havde dem.
- **Primavera P6-herkomst** — kildefelterne fra en Primavera-fil, som `key: value`.
- **Eksplicit hovedopgave** — om opgaven er en eksplicit hovedopgave uden underopgaver (fra en Primavera-fil).
- **Tidsfordelt slutgulv**, **Tidsfordelt startanker**, **Tidsfordelte varighedssegmenter** og **Tidsfordelte profiler** — fordelingen over timer fra en MS Project-fil, som datoer og tal.
- **Opgavekodedata**, **Brugerdefineret feltdata** og **Notedata** — antallet af kodetildelinger, brugerdefinerede felter og noter.
- **Intern afhængighedsdata** og **Ekstern afhængighedsdata** — antallet af interne og eksterne afhængigheder.
- For hver oprindelig plan findes også **Milepæl** og **Milepælstype**, som den oprindelige plan registrerede dem.
