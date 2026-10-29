# Filer og formater

Hvad er der egentlig i den fil, du gemmer? Og hvad sker der med din tidsplan, når du eksporterer den til et andet pakkeprogram? I denne artikel læser du, hvordan appen håndterer filer: IFC som sit eget format, de andre formater som oversættere, hvad en eksport efterlader, og hvordan Gem, AutoSave og genoprettelse efter nedbrud adskiller sig. Eksemplet til sidst viser med tal, hvad en eksport gør.

## Begrebet

Open Planner Studio har ét eget filformat: **IFC**, et åbent udvekslingsformat for byggeinformation fra buildingSMART. Appen skriver IFC-schemaet for projektet, som standard IFC 4.3 ADD2 (se [Valg af IFC-schema](docs://howto-ifc-schema-kiezen)); i eksportlisten hedder det *IFC*. Der er ikke et andet, proprietært projektformat. *Gem* skriver dit hele projekt som en IFC-fil (`.ifc`), og *Åbn* læser en sådan fil tilbage. Vil du se, hvad der står i filen? Fanen *IFC* er en editor, der viser IFC-teksten for dit projekt. *Generér IFC* opdaterer teksten, og *Kopiér* lægger den på udklipsholderen. Ændrer du teksten, indlæser *Anvend* den som dit projekt. Det erstatter helt projektet i den fane.

Alle andre formater er **adaptere**: oversættere mellem modellen i et andet program og modellen i appen. Appen læser CSV, MS Project XML, Primavera P6 XML, MS Project-filer (`.mpp`) og Primavera-filer (`.xer`). Den skriver CSV, MS Project XML, Primavera P6 XML og to fremdriftsark. Du kan ikke eksportere til `.mpp` eller `.xer`.

Hvorfor er den forskel vigtig? En oversætter kan kun overføre det, begge sider kender. IFC-filen i appen gemmer alt, der hører til dit projekt. Alle andre formater mangler en del af det, og den del bliver tilbage.

## Sådan håndterer appen filer

### Hvad åbning gør

Appen vælger læseren efter filendelsen: `.ifc`, `.csv`, `.xml`, `.mpp` eller `.xer`. Ved en `.xml`-fil kigger den inde i filen for at se, om det er MS Project XML eller Primavera P6 XML. En ukendt filendelse behandles som IFC. Er filen ikke en IFC-fil, viser appen *Kunne ikke åbne filen* med årsagen.

Hver fil åbner i sin egen fane. Undtagelsen er en fane, der stadig er tom og uændret: den fane overtager filen. Én Primavera-fil kan give flere faner, én for hvert projekt med opgaver.

Efter åbning genberegner appen altid. Kommer filen fra et andet program, kan datoerne afvige fra det, filen angav. Det beskrives i [Datoer som gemt](docs://uitleg-datums-zoals-opgeslagen).

Kun en IFC-fil bliver **gemmemålet**: den fil, *Gem* skriver tilbage til. En CSV-, XML-, `.mpp`- eller `.xer`-fil bliver ikke gemmemål. Et sådant projekt har efter åbning ingen fil. *Gem* spørger så, hvor den nye IFC-fil skal gemmes. På den måde overskriver Ctrl+S aldrig din oprindelige fil med IFC-tekst.

### Hvad gemning skriver

*Gem* skriver altid hele projektet. Dette er med i filen:

- opgaver med struktur, varighed, datoer og fremdrift;
- afhængigheder med forsinkelse, begrænsninger og deadlines;
- kalendere, ressourcer og tildelinger, inklusive kurverne;
- oprindelige planer, opgavekoder, brugerdefinerede felter og noter;
- eksterne afhængigheder til andre projekter;
- projektindstillingerne, såsom statusdatoen, beregningsprofilen og beregningsindstillingerne;
- linket til et bibliotek for ressourcer.

Det, du indstiller på skærmen, hører ikke til projektet og er ikke med: zoom, rulleposition, den valgte opgave og de sammenfoldede faser. Dine appindstillinger, såsom sprog og tema, står heller ikke i filen. Appen gemmer dem selv, i appen eller i din browser.

En eksport til et andet format ændrer ikke dit projekt. Efter en eksport har projektet stadig samme gemmemål, og det er stadig markeret som *Ikke gemt*, hvis det var det før.

### Hvad en eksport mister

Hver adapter overfører det, som dens format kender.

**MS Project XML** overfører opgaver, afhængigheder, kalendere, ressourcer, tildelinger, begrænsninger, deadlines og statusdatoen. Af dine oprindelige planer følger kun den aktive med. Opgavekoder, brugerdefinerede felter, noter og eksterne afhængigheder følger ikke med. En anden begrænsning på en opgave følger ikke med. En begrænsning *Skal starte den (MSO)* eller *Skal slutte den (MFO)* uden valget *Obligatorisk (pin-logik)* kommer tilbage som *Start ikke tidligere end (SNET)* eller *Afslut ikke tidligere end (FNET)*. *Manuelt planlagt* og *Udjævningsforskydning* for en opgave kommer ikke tilbage. En hængekøje bliver en almindelig opgave med beregnede datoer.

**Primavera P6 XML** overfører opgaver, afhængigheder, kalendere, ressourcer, tildelinger, begrænsninger og statusdatoen. Oprindelige planer og deadlines følger ikke med, og opgavekoder, brugerdefinerede felter, noter og eksterne afhængigheder følger heller ikke med. Også her bliver en hængekøje en almindelig opgave. P6 kender ikke forsinkelse i procent: appen omregner en sådan forsinkelse til et fast antal dage. En forsinkelse i kalenderdage bliver en forsinkelse i arbejdsdage.

**CSV** er en opgaveliste. Filen har disse kolonner for hver opgave: task id, WBS, level, name, duration, start, finish, predecessors, work category, id'et for en brugerdefineret arbejdskategori (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float og description. Ressourcer, tildelinger, kalendere, begrænsninger, deadlines, oprindelige planer og statusdatoen står ikke i den. Kolonneoverskrifterne er altid på engelsk.

**Kun IFC bevarer beregningsprofilen og beregningsindstillingerne.** Hvis du eksporterer til CSV, MS Project XML eller Primavera P6 XML, står profilen ikke i filen. Af beregningsindstillingerne skriver MS Project XML højst den kritiske grænseværdi. En sådan fil åbnes igen som *Open Planner Studio*. Blev dit projekt beregnet med *Primavera P6* eller *Microsoft Project*, for eksempel fordi det kom fra en `.xer`- eller `.mpp`-fil, kan datoerne derfor ændre sig. Hvad en beregningsprofil er, forklares i [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen).

Kommer dit projekt fra en Primavera-fil (`.xer`), også hvis du undervejs har gemt det som IFC, viser appen efter en eksport til CSV, MS Project XML eller P6 XML: *Ved eksport til CSV går XER-kildeoplysninger tabt.* Ved MS Project XML står der *MSPDI* i stedet for *CSV*, ved P6 XML står der *P6*. Ved IFC får du ikke den besked: IFC-filen gemmer Primaveras kildefil med. Se [Åbning af en Primavera P6-fil (.xer)](docs://howto-xer-openen).

Appen gør to ting mere ved en eksport. Er tidsplanen forældet, genberegner den først og eksporterer bagefter. Og den eksporterer ikke en tidsplan med en cirkulær afhængighed. Du får i stedet en besked med løkken, for eksempel *Cirkulær afhængighed mellem opgaver: Set up site → Demolish existing extension → Set up site*.

### Gem, AutoSave og genoprettelse efter nedbrud

Det er tre forskellige ting. De ligner hinanden, men de gemmer et andet sted.

**Gem** er noget, du gør. Appen skriver dit projekt til din fil og fjerner markeringen *Ikke gemt*.

**AutoSave** er som standard slået fra, og du slår det selv til for hvert projekt. Appen skriver så uden vindue til den samme fil, når der er ændringer, højst hvert tiende sekund. Det virker kun, hvis projektet allerede har en fil. Se [Slå AutoSave til](docs://howto-automatisch-opslaan).

**Genoprettelse efter nedbrud** er altid slået til. Så snart der sker en ændring et sted, gemmer appen også højst hvert tiende sekund en genoprettelseskopi af alle åbne projekter, også dem du selv ikke har ændret. Den kopi står ikke i din projektfil: i desktopappen står den i appens datamappe, i browseren i browserens lager. Ved næste start tilbyder appen den kopi. Du kan læse mere om det i [Genoprettelse efter et nedbrud](docs://howto-herstellen-na-een-crash). Genoprettelse efter nedbrud skriver aldrig til din projektfil.

Fordi en kopi højst gemmes hvert tiende sekund, kan du ved et nedbrud miste de sidste sekunders arbejde.

### Desktop og browser

Desktopappen og browserversionen gør det samme med dit projekt, men de skriver filer på forskellig måde.

På desktop arbejder appen med rigtige stier. *Gem* skriver direkte til din fil. Normalt skriver appen først til en midlertidig fil ved siden af (`.ops-save.tmp`) og erstatter først dernæst din fil, så et nedbrud midt i skrivningen ikke ødelægger din gamle fil. Lukker du appen med ændringer, spørger den for hvert projekt, om du vil gemme. Ved en ren afslutning rydder den sine genoprettelseskopier.

I en browser, som kan gemme filer hvor som helst (for eksempel Chrome og Edge), får du et almindeligt vindue til åbning og gemning. Derefter skriver *Gem* direkte til filen. For en fil du har åbnet, spørger browseren én gang om tilladelse. Listen *Seneste* virker, men kun med filnavne.

I en browser uden den mulighed (for eksempel Firefox) åbner appen en fil via filvælgeren og gemmer via en download. Med *Gem* forklarer meddelelsen *Gemt som download: 'name.ifc' ligger i din downloadmappe. …* det én gang per sessie. Med *Gem som* og ved eksport ser du *Gemt som download: 'name.ifc' ligger nu i din downloadmappe. Dette miljø tillader ikke, at appen skriver direkte til den valgte placering.* Kan browseren vise et gemvindue, men ikke skrive tilbage til projektets fil, spørger *Gem* hver gang efter et sted. En besked forklarer også det én gang per sessie. *Fil › Seneste* findes, men åbner en tom side, og AutoSave er ikke tilgængelig. Du får den samme besked i ethvert miljø, der ikke lader appen skrive til det sted, du valgte.

## Eksempel: eksport af eksempelprojektet

Tag eksemplet *Refurbishment & Extension of a Family Home* (*Fil › Eksempler*). Det har 20 opgaver, heraf 4 faser og 2 milepæle, og 16 afhængigheder. Der er 6 ressourcer med 8 tildelinger, 1 oprindelig plan og et link til *Demo resource library*. Opgaven *Demolish existing extension* har begrænsningen *Start ikke tidligere end (SNET)* på 14. maj 2027, og *Handover inspection* har en deadline den 29. juli 2027. Tidsplanen slutter den 7. juli 2027.

Sådan kommer projektet tilbage fra hvert format, målt efter at eksportfilen er åbnet igen:

- Med IFC-filen får du alt tilbage: 20 opgaver, 16 afhængigheder, 6 ressourcer, 8 tildelinger, den oprindelige plan, begrænsningen, deadlinen og linket til biblioteket. Tidsplanen slutter igen den 7. juli 2027.
- MS Project XML-filen får også alt tilbage, undtagen linket til biblioteket. Tidsplanen slutter den 7. juli 2027.
- P6 XML-filen får opgaverne, afhængighederne, ressourcerne, tildelingerne og begrænsningen tilbage. Den oprindelige plan og deadlinen mangler. Tidsplanen slutter stadig den 7. juli 2027, fordi begrænsningen stadig er med.
- CSV-filen får 20 opgaver og 16 afhængigheder tilbage. Ressourcer, tildelinger, oprindelig plan, begrænsning og deadline mangler, og projektet hedder *CSV Import*. Uden begrænsningen rykker arbejdet frem: tidsplanen slutter den 2. juli 2027, fem kalenderdage tidligere.

Uden den begrænsning slutter eksemplet selv også den 2. juli 2027. Forskellen skyldes altså begrænsningen, som CSV-filen ikke overfører.

## Konsekvenser og misforståelser

**En eksport er ikke en backup.** Kun IFC bevarer alt. Vil du beholde dit projekt, så gem det som IFC. Eksporter kun, når en anden har brug for det andet format.

**Åbner du en eksport igen, får du ikke altid den samme tidsplan.** Appen genberegner altid ved åbning, med den beregningsprofil, der hører til formatet. Mangler der logik, som begrænsningen i CSV-eksemplet, eller beregner profilen anderledes, ændrer resultatet sig.

**En eksport står også i Seneste.** På desktop og i browsere med filadgang havner en eksport i *Seneste*, ligesom et gemt projekt (fremdriftsarkene gør ikke). Åbner du den der, åbner den som en import af det format.

**Gem er ikke det samme som genoprettelse efter nedbrud.** Genoprettelse efter nedbrud hjælper efter et nedbrud, men erstatter ikke at gemme. Gem derfor, før du lukker en fane eller appen.

## Se også

- [Åbning og gemning af en fil](docs://howto-bestand-openen-en-opslaan): trinene til åbn, gem og gem som.
- [Eksport](docs://howto-exporteren): at vælge et format og hvad du får.
- [Datoer som gemt](docs://uitleg-datums-zoals-opgeslagen): hvorfor en importeret tidsplan kan vise andre datoer.
- [Begrænsninger og deadlines](docs://uitleg-constraints): hvad en begrænsning gør, og dermed hvad der forsvinder, hvis den mangler.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): hvad en forsinkelse er, og hvordan appen beregner den.
- [Oprettelse af en hængekøje](docs://howto-hammock): hvad en hængekøje er, og hvad en eksport skriver den som, nemlig en almindelig opgave.
- [Koder og brugerdefinerede felter](docs://howto-codes-en-velden): opgavekoder og brugerdefinerede felter, som kun IFC bevarer.
- [Eksterne afhængigheder til et andet projekt](docs://howto-externe-relaties): links, som MS Project XML og P6 XML ikke bærer med.
- [Gem og administrer en oprindelig plan](docs://howto-baseline-opslaan-en-beheren): oprindelige planer, hvoraf MS Project XML kun bærer den aktive med.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format, hvad der overføres, og hvad der ikke overføres.
