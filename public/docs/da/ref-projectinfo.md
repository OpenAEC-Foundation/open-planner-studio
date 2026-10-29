# Nyt projekt og Projektindstillinger

Felterne i vinduet *Nyt projekt* og i *Projektindstillinger*: hvad hvert felt gør, hvad standarden er, og hvor det får virkning. De er to sider af samme formular. *Nyt projekt* opretter et nyt projekt og har et par ekstra felter. *Projektindstillinger* ændrer det projekt, du har åbent.

## Åbning

**Nyt projekt** — *Fil › Ny*, Ctrl+N, eller plustegnet til højre for dokumentfanerne (*Start et projekt*, derefter *Opret nyt projekt*). Vinduet åbnes med markøren i *Projektnavn*.

**Projektindstillinger** — *Indstillinger › Projekt › Projektindstillinger* åbner formularen som et vindue med titlen *Projektindstillinger*. *Fil › Projektindstillinger* viser den samme formular i skærmbilledet *Fil*. Blokken *Beregningsprofil og beregningsindstillinger* står nederst på begge steder. Hvad der står i den, står i [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies).

## Opret, Anvend og annuller

**Opret** (i *Nyt projekt*) opretter projektet. Hvis den aktuelle fane er tom og uændret, bruger appen den fane. Ellers åbnes projektet i en ny fane. **Anvend** (i *Projektindstillinger*) skriver dine ændringer til projektet.

- **Kun ved Anvend.** Du skriver i et udkast. Projektet ændres først, når du klikker på *Anvend*. *Anvend* skriver kun det, du faktisk har ændret, i ét trin i *Fortryd*. Klikker du på *Anvend* uden at ændre noget, sker der intet, og der tilføjes ikke et trin.
- **Annuller, krydset og Esc** lukker vinduet uden at gemme noget. Et klik ved siden af vinduet lukker det ikke. Det du har skrevet, bliver.
- **Enter** gør det samme som *Opret* eller *Anvend*, undtagen i feltet *Beskrivelse* og i en åben rullemenu.
- **I skærmbilledet Fil** viser *Projektindstillinger* *Ændringer er ikke anvendt — klik på Anvend for at gemme dem.* nederst, så længe dit udkast afviger. Forlader du skærmbilledet, spørger appen, om du vil anvende, forkaste eller annullere. Se [Båndet, fane for fane](docs://ref-lint).
- **En egen beregningsprofil uden navn** blokerer *Anvend* og *Opret*. Giv den et navn, eller forkast ændringen.

## Felter i begge vinduer

**Projektnavn** — navnet på projektet i titellinjen, på fanen og i filnavnet, når du gemmer. Standard: tom. Et tomt felt er tilladt. Projektet kaldes så *Ny tidsplan*, vist med grå tekst i feltet. Hvor: hele skærmbilledet.

**Beskrivelse** — fri tekst. Standard: tom. Virkning: gemmes med projektet, i IFC-filen og i eksporten til Primavera P6 XML. Den har ingen indflydelse på tidsplanen.

**Forfatter** — fri tekst. Standard: tom. Virkning: den kommer i IFC-filen og vises som *Forfatter:* i sidehovedet på en rapport. Der kan du ikke skrive den om.

**Ressourcebibliotek** — hvilket ressourcebibliotek projektet er koblet til. Vælg mellem *intet bibliotek (frit projekt)*, dine eksisterende biblioteker og *+ Opret nyt ressourcebibliotek…*. Standard: i *Nyt projekt* standardbiblioteket, i *Projektindstillinger* den nuværende kobling. Virkning: se [Brug af ressourcebiblioteket](docs://howto-resourcebibliotheek-gebruiken). Med *+ Opret nyt ressourcebibliotek…* skriver du et navn i et felt nedenfor. Biblioteket oprettes først ved *Opret* eller *Anvend*. Annullerer du, bliver der intet tilbage. En kobling i *Projektindstillinger* ændres kun, hvis du selv rører dette felt.

**Kunde/organisation** — fri tekst. Standard: tom. Virkning: den kommer i IFC-filen og vises som *Virksomhed:* i sidehovedet på en rapport.

**Startdato** — projektets start. Standard: i *Nyt projekt* i dag. Hvad feltet gør, står nedenfor under *Hvad startdatoen gør*.

**Slutdato** — den planlagte slutdato for projektet. Standard: tom. Virkning: en oplysning, ikke et krav. Appen planlægger ikke hen imod denne dato. Den vises i sidehovedet på en rapport og i eksporter. Den bestemmer også, til hvilket år helligdagene genereres. Kun for en Primavera-fil med indstillingen *Beregn slæk op til projektslutdatoen* (se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies)) udføres slækberegningen op til denne dato.

**Standardenhed for nye opgaver** — kun synlig, når *Slå timeplanlægning til* er slået til. Vælg mellem *Dage* og *Timer*. Standard: *Dage*. Virkning og betingelser: se [Slå timeplanlægning til](docs://howto-urenplanning-aanzetten).

**Beregningsprofil og beregningsindstillinger** — i *Projektindstillinger* hele blokken. I *Nyt projekt* kun rullemenuen *Beregningsprofil* med *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. Standard: *Open Planner Studio*. Når du vælger en profil, sætter den også standardindstillingerne for den profil. Se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies).

## Kun i Projektindstillinger

**IFC-schema ved gemning** — hvilket IFC-schema der står i sidehovedet på den gemte fil. Valg mellem *IFC 4.3 ADD2 (standard)*, *IFC 4.3* og *IFC4*. Standard: *IFC 4.3 ADD2 (standard)*. For en åbnet IFC-fil er standarden schemaet for den fil. Virkning: kun sidehovedet på filen ændres, ikke indholdet. Brug det til at samle tidsplanen med en bygningsmodel i samme schema. Har en åbnet fil et andet schema end standarden, spørger appen første gang du gemmer, om du vil beholde det schema. Et valg her gælder som svar. Et andet valg her er ikke et trin i *Fortryd*, for schemaet hører til filen. Se [Valg af IFC-schema](docs://howto-ifc-schema-kiezen).

## Kun i vinduet Nyt projekt

**Fase-skabelon** — hvilke faser projektet starter med. Vælg mellem *Tom*, *Boligbyggeri* og *Erhvervsbyggeri / renovering*. Standard: *Tom*. Virkning: *Tom* giver et projekt uden opgaver. De to andre sætter otte fase-opgaver klar. Hver har en varighed på 5 i projektets standardenhed (5 arbejdsdage, eller 5 timer hvis du vælger *Timer* under *Standardenhed for nye opgaver*), og de har ingen afhængigheder. Du omdøber, flytter og udvider dem selv. For *Boligbyggeri* er det: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking og Oplevering. For *Erhvervsbyggeri / renovering*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen og Oplevering. Navnene er data i dit projekt og forbliver på nederlandsk, også når appen vises i et andet sprog. Er *Slå byggetilstand til* fra, så findes kun *Tom*. Se [Appindstillinger](docs://ref-instellingen).

**Arbejdsskift** — kun synlig, når *Slå timeplanlægning til* er slået til. Vælg mellem *Dagarbejdsskift*, *2 arbejdsskift*, *3 arbejdsskift* og *24/7*. Standard: *Dagarbejdsskift*. Virkning: *Dagarbejdsskift* lader standardkalenderen være, som den er. Det er en almindelig dagkalender fra mandag til fredag. De tre andre sætter tidsbånd op i projektets kalender, ligesom knapperne med samme navn i vinduet *Kalendere*. Hvilke tidspunkter det er, står i [Indstil arbejdstider](docs://howto-werktijden-instellen). Ved *Dagarbejdsskift* kan *Timer* ikke vælges under *Standardenhed for nye opgaver*, fordi en dagkalender har ingen tidsbånd.

**Helligdagssæt** — hvilke helligdage projektkalenderen får. Ved *Land* vælger du *Nederlandene* (standard), *Tyskland*, *Belgien*, *Frankrig*, *Storbritannien*, *Østrig*, *Schweiz*, *Ingen helligdage* eller *Brugerdefineret…*. Har landet regioner, tilføjes en rullemenu *Region*. For *Nederlandene* vælger du også, hvis *Slå byggetilstand til* er slået til, *Byggeferie*: *Ingen* (standard), *Nord*, *Midt* eller *Syd*. Under det står en linje som *36 helligdage, 2025–2029*. Den udvider du for at se listen. Årene går fra året før startdatoen til året efter slutdatoen. Har der ingen slutdato, går de til tre år efter startåret. *Brugerdefineret…* giver en kalender uden helligdage. Den åbner vinduet *Kalendere* lige efter oprettelsen, så du kan udfylde dem selv. Projektkalenderen hedder *Bouwkalender NL*, eller *Standaardkalender* hvis *Slå byggetilstand til* er fra. Valget er så også *Ingen helligdage*. Hvordan generatoren virker, står i [Generer helligdage og byggeferie](docs://howto-feestdagen-genereren).

## Hvad startdatoen gør

Startdatoen er udgangspunktet for projektet. Tre regler:

- **Nye opgaver begynder på startdatoen.** En opgave, du tilføjer, får projektstartdatoen som sin planlagte start.
- **En opgave med en foregående opgave begynder aldrig før startdatoen.** Er slutdatoen for den foregående opgave tidligere, venter opgaven til startdatoen. En opgave *uden* foregående opgave beholder sin egen dato, også hvis den ligger før startdatoen. Det er nødvendigt for at vise en tidsplan fra Microsoft Project eller Primavera, sådan som det oprindelige program viser den. En begrænsning *Skal starte den (MSO)* eller *Skal slutte den (MFO)* bryder begge regler. En sådan opgave står på sin dato, også hvis den falder før startdatoen.
- **Et senere startdato flytter løse opgaver med.** Sætter du startdatoen senere i *Projektindstillinger* og klikker på *Anvend*, flyttes opgaver til den nye dato i samme trin i *Fortryd*. Det gælder opgaver uden foregående opgave og uden en begrænsning, der sætter en nedre grænse (*start ikke tidligere end*, *skal starte den*, *afslut ikke tidligere end* eller *skal slutte den*). Kun opgaver, der ligger før den nye dato, flyttes. Appen siger, hvor mange opgaver der blev flyttet. Det sker kun, når du selv ændrer startdatoen, og aldrig når du åbner en fil. At sætte startdatoen senere flytter ikke resten af tidsplanen. Det gør *Flyt projekt*, se [Flytning af et projekt](docs://howto-project-verplaatsen).

## Se også

- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): blokken *Beregningsprofil og beregningsindstillinger*.
- [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen): hvorfor en profil ændrer resultatet.
- [Flytning af et projekt](docs://howto-project-verplaatsen): hele tidsplanen til en anden start.
- [Tilføj opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen): at begynde med de første opgaver.
- [Generer helligdage og byggeferie](docs://howto-feestdagen-genereren): helligdagssættet i detaljer.
- [Valg af IFC-schema](docs://howto-ifc-schema-kiezen): at gemme til en bygningsmodel i IFC4.
