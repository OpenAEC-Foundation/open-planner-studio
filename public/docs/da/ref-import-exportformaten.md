# Import- og eksportformater

For hvert filformat: om du kan åbne, gemme og eksportere det, hvad der følger med og ikke følger med, og med hvilken beregningsprofil det åbner. Begrundelsen bag alt dette, og et eksempel med tal, står i [Filer og formater](docs://uitleg-bestanden).

## Overblik

**Åbning** fungerer med IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` og `.xer`. En fil med en anden filendelse behandler appen som IFC.

**Gemning** skriver altid IFC. Kun en åbnet IFC-fil bliver mål for gemning. Et projekt fra et andet format har ingen fil efter åbning. Så spørger *Gem*, hvor IFC-filen skal gemmes.

**Eksport** fungerer til IFC, MS Project XML, Primavera P6 XML, CSV og to fremdriftsark (Excel og CSV). En eksport ændrer ikke dit projekt.

**Skrivebeskyttet** er `.mpp` og `.xer`. Appen kan åbne dem, men ikke skrive dem.

**PDF** kommer kun fra en rapport (se [Rapporttyper](docs://ref-rapporttypes)). Appen læser ikke PDF.

**Hvor.** Åbning: *Start › Fil › Åbn*, *Fil › Åbn* eller Ctrl+O. Eksport: *Start › Fil › Eksporter* eller *Fil › Eksporter*. Du læser et udfyldt fremdriftsark ind via *Fil › Importer*, eller med knappen *Opdater fremdrift fra et ark* i båndgruppen *Fremdrift* på fanerne *Tidsplan*, *Tabel* og *Rapport*.

**Beregningsprofil ved åbning.** Hvert format åbnes med en beregningsprofil. Hvad det er, står i [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies). `.xer` åbnes med *Primavera P6*, `.mpp` med *Microsoft Project*, og CSV, MS Project XML og P6 XML med *Open Planner Studio*. IFC bevarer den profil, der er gemt i filen. For `.xer` og `.mpp` melder appen, at projektet beregnes på denne måde. Kun IFC bærer beregningsprofilen og beregningsindstillingerne. Af beregningsindstillingerne skriver MS Project XML højst grænseværdien for kritisk. En genåbnet eksport af et andet format beregnes som *Open Planner Studio*.

## IFC

**Åbn** — ja, `.ifc`. Appen læser IFC4 og IFC 4.3 (også ADD2). En fil i et andet skema, for eksempel IFC2X3, åbnes også. Ved første gem vælger du så et skema, som appen kan skrive (se [Valg af IFC-skema](docs://howto-ifc-schema-kiezen)). Beregningsprofil: den i filen.

**Gem** — ja, og det er det eneste format, der kan gemmes. *Gem* skriver hele dit projekt som IFC-fil, i projektets IFC-skema (som standard IFC 4.3 ADD2). Filen bliver mål for gemning.

**Eksport** — ja, som *IFC*, i projektets IFC-skema (standard IFC 4.3 ADD2). Standardnavn: projektnavnet med filendelsen `.ifc`. Hvis dit projekt er koblet til et ressourcebibliotek, står afkrydsningsfeltet *Gem biblioteksfilen ved siden af* under kortene i *Fil › Eksporter*. Når det er afkrydset, spørger appen efter et sted til *projektnavn-bibliotek.ifc*, efter projektet. Afkrydsningsfeltet står ikke på listen på fanen *Start*.

**Hvad følger med** — alt, der hører til projektet: opgaver med struktur, varighed, datoer og fremdrift; afhængigheder med forsinkelse; begrænsninger og deadlines; kalendere; ressourcer og tildelinger, inklusive fordelingen i timer; oprindelige planer; opgavekoder og brugerdefinerede felter; noter; eksterne afhængigheder til andre projekter; afbrydelser; opgavetyper og egne arbejdskategorier; projektindstillingerne, som statusdato, fremdriftsmetode, beregningsprofil og beregningsindstillinger; forbindelsen med et ressourcebibliotek. For et projekt fra en `.xer` følger også den originale kildefil med. En egen arbejdskategori bliver gemt som IFC-typen `USERDEFINED` med sit navn i feltet ObjectType. Så læser andre IFC-programmer opgaven normalt. Appen gemmer også arbejdskategoriens faste id, så omdøbning ikke bryder forbindelsen. Hvis en anden åbner filen på en anden computer, vises arbejdskategorien der under *Fra dette projekt* og ikke under vedkommendes egne *Mine arbejdskategorier*.

**Hvad følger ikke med** — hvordan du har sat skærmen op (zoom, rulleposition, valgt opgave, sammenfoldede faser, valgt filter og gruppering) og appindstillingerne ([Appindstillinger](docs://ref-instellingen)). Fanen *IFC* er en editor med IFC-teksten for dit projekt. *Generér IFC* opdaterer teksten, *Kopiér* lægger den på udklipsholderen, og *Anvend* indlæser teksten som dit projekt og erstatter projektet i den fane.

## MS Project XML (MSPDI)

**Åbn** — ja. Appen genkender en `.xml`-fil som MS Project XML på rodelementet `Project` i MS Project-navnerummet (eller uden navnerum). Beregningsprofil: *Open Planner Studio*. Efter åbningen fortæller appen dig i één melding, hvad den ikke har taget med; se [Åbn en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Gem** — nej. Et sådant projekt får ingen mål for gemning.

**Eksport** — ja, som *MS Project XML* (*Kan åbnes i Microsoft Project. Fuld WBS-struktur.*). Standardnavn: projektnavnet med `.xml`.

**Hvad følger med** — opgaver med struktur (niveau og WBS), varighed, datoer og fremdrift; afhængigheder med forsinkelse, også i timer eller procent; begrænsninger, inklusive deadline; kalendere, inklusive opgave- og ressourcekalendere; ressourcer og tildelinger, inklusive kurven eller fordelingen i timer; statusdatoen; grænseværdien for kritisk som et helt antal arbejdsdage på 0 eller mere, med *Samlet slæk ≤ grænseværdi*; beskrivelsen af en opgave (som note); opgavetypen for en opgave (som MS Project-opgavetype); en egen arbejdskategori i et frit felt (`ExtendedAttribute`), som appen læser tilbage, og som MS Project måske ignorerer. Af dine oprindelige planer følger kun den aktive med, som oprindelig plan 0. En opgave i timer beholder sin enhed, og en milepæl beholder sin type (start, slut eller automatisk).

**Hvad følger ikke med** — noter (tjeklisten på en opgave), eksterne afhængigheder til andre projekter, opgavekoder og brugerdefinerede felter, en anden begrænsning, markeringen *Manuelt planlagt*, udjævningsforskydningen, genoptagelses- og stoppunktet for en opgave med fremdrift uden for rækkefølge, konventionerne *Resterende arbejde genoptages efter forløbet varighed* og *Flyt ikke ikke-startede opgaver til statusdatoen* i en MS Project-profil, og de andre beregningsindstillinger. Opgaver med afbrydelser uden timefordeling følger med, men uden deres afbrydelser.

**Helligdage ved åbning.** En afledt kalender arver undtagelserne fra sin basiskalender. En kalender med sin egen arbejdsuge og uden undtagelser får ingen helligdage. Kun en enkel kalender, uden basiskalender, arbejdsuge og undtagelser, beholder de standard hollandske helligdage. Mangler helligdage, så kan din slutdato være anderledes: se [Generér helligdage og byggeferie](docs://howto-feestdagen-genereren).

**Hvad ændrer sig undervejs** — en begrænsning *Skal starte den (MSO)* eller *Skal slutte den (MFO)* uden valget *Obligatorisk (pin-logik)* bliver til *Start ikke tidligere end (SNET)* eller *Afslut ikke tidligere end (FNET)*. En hængekøje bliver en almindelig opgave med beregnede datoer. MS Project XML gemmer kun timer pr. dag for projektkalenderen. En anden kalender med egne timer pr. dag får sin arbejdstid som timer pr. dag, når du åbner filen: 8 timer pr. dag med arbejdstider på 10 timer bliver til 10. En opgave i dage på en sådan kalender bliver dermed kortere, for eksempel 4 dage i stedet for 5.

## MS Project-fil (`.mpp`)

**Åbn** — ja, fra MS Project 2010 til og med 2021. Beregningsprofil: *Microsoft Project*. Appen læser kun filen. Den ændrer aldrig din `.mpp`. En fil fra MS Project 2007 eller ældre og en adgangskodebeskyttet fil afviser den med en besked, der henviser til XML-eksporten fra MS Project. Efter åbningen fortæller appen dig i én besked, hvad den ikke har taget med.

**Gem** — nej, og der er ingen mål for gemning: *Gem* skriver en ny IFC-fil.

**Eksport** — nej.

**Hvad følger med** — opgaver med struktur, varighed og begrænsninger; afhængigheder med forsinkelse; kalendere; ressourcer og tildelinger; fremdrift; en WBS-kode, som du selv har udfyldt i MS Project. De datoer og den slæk, som MS Project selv har beregnet, læses også med, for visningen *Datoer som registreret*.

**Hvad følger ikke med** — oprindelige planer, omkostninger og standardsatser, noter, hyperlinks, de brugerdefinerede felter i MS Project, forbindelsen til delprojekter og eksterne opgaver samt grænseværdien for kritisk. Se [Åbn en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Oprindelse og licens** — `.mpp`-læseren er skrevet til Open Planner Studio og er afledt af kildekoden og strukturkendskabet i MPXJ (`github.com/joniles/mpxj`, Jon Iles m.fl.), et Java-bibliotek under LGPL-2.1. Struktur og feltkonstanter er overført til TypeScript. Open Planner Studio selv er open source under LGPL-3.0. `.xer`-læseren er ikke en afledt version: MPXJ er der kun brugt som kilde til forståelse.

## Primavera P6 XML

**Åbn** — ja. Appen genkender en `.xml`-fil som P6 XML på rodelementet `APIBusinessObjects`. Beregningsprofil: *Open Planner Studio*.

**Flere projekter i én fil.** Hvert projekt med opgaver åbnes på sin egen fane, med navnet *Projektnavn (Projekt-ID)*. Appen springer et projekt uden opgaver over. Den aktive fane er projektet med flest opgaver. Appen tager ikke en afhængighed til et andet projekt med, og heller ikke en opgave, som ikke hører til et projekt. Efter åbningen melder appen, hvor mange projekter den har åbnet.

**Helligdage ved åbning.** Her gælder de samme regler som for MS Project XML: en kalender med sin egen arbejdsuge og uden undtagelser får ingen helligdage.

**Oprindelige planer.** En `<BaselineProject>` i filen bliver en oprindelig plan for sit projekt. Den oprindelige plan, som P6 markerer som aktiv, er også aktiv i appen.

**Sats for en tildeling.** Hvis der er arbejde tilbage, bliver den resterende enhedssats (`RemainingUnitsPerTime`) til *Enh./dag*. Ellers bliver det den planlagte sats (`PlannedUnitsPerTime`). For materiale forbliver den planlagte sats. Appen beregner intet igen, når den åbner filen. Ved eksport til P6 XML skriver den den planlagte sats som `PlannedUnitsPerTime`. Den skriver den resterende sats som `RemainingUnitsPerTime` kun, når tildelingen har en separat planlagt sats.

**Ingen læsbare opgaver.** Hvis appen ikke finder nogen opgave, den kan læse, åbner den ikke en fane. Den melder det, med årsagen når den kender den. Eksempler: opgaver uden `ObjectId`, eller XER-kolonnenavne i en XML-fil. Eksportér projektet så fra P6 igen som P6 XML, eller åbn det som `.xer`.

**Gem** — nej.

**Eksport** — ja, som *Primavera P6 XML* (*Til Oracle Primavera P6.*). Standardnavn: projektnavnet med `.xml`, med projekt-ID'et i parentes, hvis projektet har et. En MS Project XML-eksport får det samme navn, så giv dem selv forskellige navne.

**Projektnavn og projekt-ID.** Appen holder projekt-ID'et fra P6 adskilt fra projektnavnet, ligesom ved en `.xer`. *Projektindstillinger* viser kun navnet, for eksempel *Bid for Facility Extension*. Fanen viser *Bid for Facility Extension (OZB-05)*. Hvis du omdøber projektet til *Hall extension*, hedder fanen *Hall extension (OZB-05)*. Ved eksport til P6 XML skriver appen *OZB-05* tilbage som projekt-ID og *Hall extension* som navn. Så genkender P6 projektet. Et projekt fra en `.xer` tager også sit projekt-ID med. Projekt-ID'et bliver, når du gemmer projektet som IFC. Parenteser i selve navnet, som *New build (phase 2)*, bliver i navnet. Et projekt uden projekt-ID får ved eksport et eget unikt ID fra appen, som begynder med *OPS:*.

**Hvad følger med** — WBS-struktur og opgaver med varighed, datoer og fremdrift; afhængigheder med forsinkelse; begrænsninger (også en anden, som blød begrænsning); kalendere; ressourcer og tildelinger; statusdatoen (som `DataDate`); en egen arbejdskategori i et eget felt, `OPS Custom Task Type`, som appen læser tilbage, og som P6 måske ignorerer.

**Hvad følger ikke med** — oprindelige planer og deadlines; opgavekoder, brugerdefinerede felter, noter og eksterne afhængigheder; beregningsindstillingerne; navnene på helligdage. P6 har ikke et navn pr. fridag: efter genåbning hedder en helligdag *Holiday* og en arbejdsundtagelse *Working exception*. Fridage lige efter hinanden kommer tilbage som ét interval. Appen forkorter et navn eller en kode, der er længere end P6 tillader: et opgavenavn til 120 tegn, et opgave-ID eller WBS-kode til 40 og et WBS- eller projektnavn til 100. Den melder, hvor mange navne og koder den har forkortet. P6 har ingen forsinkelse i procent: appen omregner den til et fast antal dage. En forsinkelse i kalenderdage bliver en forsinkelse i arbejdstid: 3 kalenderdage bliver til 3 arbejdsdage. En hængekøje bliver en almindelig opgave, en manuelt planlagt opgave bliver en almindelig opgave med beregnede datoer, og en udjævningsforskydning på under en dag udelades.

## Primavera-fil (`.xer`)

**Åbn** — ja. Beregningsprofil: *Primavera P6*. Appen læser kun filen. Den skriver ikke `.xer` og ændrer aldrig din fil. Den åbner én fane pr. projekt med opgaver. En fil uden opgaver eller med beskadigede tabeller afviser den med en meddelelse.

**Gem** — nej, og der er intet gemmemål: *Gem* skriver en ny IFC-fil med den originale `.xer` indeni.

**Eksport** — nej. Hvis du eksporterer et projekt fra en `.xer` til CSV, MS Project XML eller P6 XML, melder appen, at XER-kildeoplysninger går tabt. Det gælder også, hvis du undervejs har gemt projektet som IFC. Til IFC går intet tabt.

**Hvad følger med** — WBS-strukturen og opgaver med varighed, datoer, begrænsninger og fremdrift; afhængigheder med forsinkelse; kalendere; ressourcer med tildelinger; opgavekoder; brugerdefinerede felter (UDF'er); noter; P6-planindstillingerne. En opgave af typen *Level of Effort* bliver en hængekøje. Et projekt, der er en oprindelig plan, bliver til den aktive oprindelige plan i det projekt, der henviser til det. En afhængighed mellem to projekter bevarer appen som kildedata.

**Tildelingens hastighed.** Hvis der er resterende arbejde, bliver den resterende hastighed (`remain_qty_per_hr`) til *Enh./dag*. Ellers er det den planlagte hastighed (`target_qty_per_hr`). Det planlagte, faktiske og resterende arbejde forbliver som i filen. For materiale forbliver den planlagte hastighed.

**En fri lørdag eller søndag, som ikke står i filen.** Nogle P6-eksporter flytter en fri weekenddag i en blok af flere fridage til fredagen før eller mandagen efter. Hvis kalenderen arbejder lørdag eller søndag, ville den dag fejlagtigt blive en arbejdsdag. Ser appen dette mønster i en blok af mindst tre fridage, gør den weekenddagen fri alligevel. I kalenderen hedder dagen *Kalenderundtagelse (rekonstruktion af weekend)*. Den tæller med i linjen *N kalenderfund.* i meddelelsen. På en kalender, der ikke arbejder i weekenden, ændres intet.

**Slæk op til projektslutdatoen, uden slutdato.** Er indstillingen i P6 slået til, så slæk beregnes op til projektslutdatoen, men har filen ingen slutdato for projektet og ingen planlagt slutdato for en opgave? Så slår appen indstillingen *Beregn slæk op til projektslutdatoen* fra. Appen beregner så de seneste datoer tilbage fra den seneste tidligste slutdato. Det tæller med i linjen *N P6-planindstillinger brugte en sikker reserve.*

**Afsluttede opgaver på statusdatoen.** Nogle filer registrerer ikke de faktiske datoer for en afsluttet opgave, men et vindue på statusdatoen. I visningen *Datoer som registreret* er en sådan opgave en smal bjælke på statusdatoen. Flytter genberegning den til et andet sted, tæller den med i det antal opgaver, som stripen angiver. Konventionen *Færdiggjort opgave i statusdatoens vindue* beregner et sådant vindue. Kun med den konvention får en afsluttet opgave en reel slæk, via beregningsindstillingen *Fuldført opgave: seneste datoer fra statusdatoen*. Denne konvention er en tilnærmelse: appen har kun set denne adfærd i P3-output, og Primavera bekræfter det ingen steder. Derfor er den slået fra i alle indbyggede profiler, også under *Primavera P6*. Du slår den til i blokken *Beregningsprofil og beregningsindstillinger*. Projektet får så en egen profil. Se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies).

**Tal med komma som decimalskilletegn.** P6 registrerer decimalskilletegnet og tusindskilletegnet i tabellen `CURRTYPE`. Appen læser disse tegn, før den omregner varigheder, arbejde og slæk. Mangler oplysningen, bruger appen et punktum som decimalskilletegn. Indeholder filen stadig tal med decimalkomma, åbner appen intet. Så åbnes en tidsplan med fejlagtigt læste tal aldrig.

**Hvad følger ikke med** — et projekt uden opgaver, og en afhængighed mellem to projekter som en rigtig afhængighed i din tidsplan. Se [Åbn en Primavera P6-fil (.xer)](docs://howto-xer-openen).

## CSV

**Åbn** — ja. Appen læser `;` og `,` som skilletegn. Den genkender kolonneoverskrifter på engelsk og nederlandsk (for eksempel `Name` eller `Naam`, `Duration` eller `Duur`, `Predecessors` eller `Voorgangers`). Datoer kan være *åååå-mm-dd*, *dd-mm-åååå* eller *dd/mm/åååå*. Du skriver en foregående opgave som WBS-kode, afhængighedstype og forsinkelse, for eksempel `1.2FS+2d`. Beregningsprofil: *Open Planner Studio*. Projektet hedder *CSV Import*. Kolonnen `Task Type` indeholder arbejdskategorien, ikke opgavetypen. Appen læser også overskrifterne `Werksoort` og `Work category`. En `Task Type`, som ikke er en af de faste koder (som `CONSTRUCTION` eller `INSTALLATION`, som appen selv skriver), bliver en brugerdefineret arbejdskategori under *Fra dette projekt*, ikke under *Mine arbejdskategorier*. Med `OPS Custom Task Type ID` bevares id'et for en brugerdefineret arbejdskategori.

**Gem** — nej.

**Eksport** — ja, som *CSV (;)* (*Universel tabeleksport. Alle opgaver med datoer og varighed.*), på kortet *CSV (semikolonsepareret)*. Filen bruger semikolon som skilletegn, er i UTF-8 med BOM og har engelske kolonneoverskrifter.

**Hvad følger med** — pr. opgave disse kolonner: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` og `Description`. Kolonnen `Task Type` indeholder arbejdskategorien. Færdiggørelsesgraden angives i hele procenter. En forsinkelse i timer får appens timetegn: `1.2FS+2h` på engelsk, `1.2FS+2u` på hollandsk. Åbning læser begge former.

**Hvad følger ikke med** — ressourcer, tildelinger, kalendere, begrænsninger, deadlines, oprindelige planer og statusdatoen. Hvis datoerne står i visningen *Datoer som registreret*, lader eksporten `Critical` og `Total Float` være tomme for opgaver, hvis kildefilen ikke registrerede det.

## Fremdriftsark (Excel og CSV)

**Åbn** — ja, via *Fil › Importer* (*Opdater fremdrift fra et regneark*) eller via knappen med det navn i båndgruppen *Fremdrift* på *Tidsplan*, *Tabel* og *Rapport*. Appen læser `.xlsx` og `.csv`, op til 16 MB og 50.000 rækker. Dette åbner ikke et projekt. Det opdaterer fremdriften i dit åbne projekt. Se [Importer fremdrift fra et regneark](docs://howto-voortgang-importeren).

**Gem** — nej.

**Eksport** — ja, som *Fremdriftsark (Excel)* (*Fremdrift (Excel)* i listen) og *Fremdriftsark (CSV)* (*Fremdrift (CSV)*). Standardnavn: *projektnavn-fremdrift*. Knappen *Eksportér fremdriftsark* i samme båndgruppe laver Excel-arket med ét klik. Excel-arket har faste kolonnebredder, låste felter og datokontrol. CSV-arket har samme indhold som ren tekst.

**Hvad følger med** — kolonnerne `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` og `Actual Finish`. Når appen læser arket ind, bruger den `Completion (%)`, `Actual Start` og `Actual Finish`. `Start` og `Finish` tjener kun til at genkende datoformatet. De ændrer ikke din tidsplan. Appen kobler rækker til opgaver via `OPS Task ID`, ellers via en unik WBS-kode.

**Hvad følger ikke med** — alt uden for disse kolonner: varighed, afhængigheder, ressourcer og resten af din tidsplan. En hovedopgave får ingen fremdrift fra arket.

## PDF

**Åbn** — nej.

**Gem** — nej.

**Eksport** — ja, fra en rapport: på fanen *Rapport* knappen *Eksporter PDF*. Appen sender ikke selv en rapport til en printer. Vejen til papir går via PDF-filen. Indholdet afhænger af rapporttypen. Se [Rapporttyper](docs://ref-rapporttypes) og [Lav og udskriv en rapport](docs://howto-rapport-maken-en-afdrukken).

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor IFC er appens eget format, og hvad en eksport går glip af, med et eksempel.
- [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan): trinnene.
- [Eksport](docs://howto-exporteren): valg af format og meldingerne efter en eksport.
- [Datoer som registreret](docs://uitleg-datums-zoals-opgeslagen): hvorfor en åbnet fil kan vise andre datoer.
- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): beregningsprofilerne.
