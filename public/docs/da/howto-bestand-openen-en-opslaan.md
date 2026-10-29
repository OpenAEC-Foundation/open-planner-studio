# Åbn en fil og gem den

Mål: åbn et projekt fra en fil og behold dine ændringer.

## Hvornår har du brug for dette

Du starter dagen med gårsdagens projekt. Du får en fil fra en kollega eller fra en anden pakke, eller du vil gemme en mellemtilstand, før du ændrer noget stort. Hvad appen gemmer i en fil, og hvorfor kun IFC gemmer hele dit projekt, forklares i [Filer og formater](docs://uitleg-bestanden).

## Trin

### Åbn en fil

1. Vælg *Start › Fil › Åbn*, eller *Fil › Åbn*, eller tryk på Ctrl+O (⌘+O på en Mac). Gruppen *Fil* findes også på fanen *Tabel*.
2. Vælg filen. Du åbner én fil ad gangen. På desktopappen og i browsere med filadgang, for eksempel Chrome og Edge, viser vinduet en liste med filtyper: *Alle understøttede*, *IFC-filer*, *CSV-filer*, *XML-filer*, *MS Project-filer* og *Primavera XER-filer*.
3. Projektet åbnes i en ny fane. Hvis den aktuelle fane stadig var tom og uændret, åbnes projektet i den.
4. Hvis filen ikke er IFC, vises et vindue med en kort forklaring af det format. En grøn boks siger, hvad appen har overtaget, en gul boks, hvad der ikke er medtaget eller kun delvist, og en blå boks, hvordan gemning og tilbageskrivning virker. *Læs mere* åbner vejledningen for det format. Klik på *Forstået* for at lukke vinduet. Sæt først flueben i *Vis ikke igen for …*, hvis du ikke længere vil se denne forklaring for det format. Du slår den til igen under [Appindstillinger](docs://ref-instellingen), på fanen *Avanceret*.

En IFC-fil giver sit filnavn til fanen. Et projekt fra et andet format får sit projektnavn.

Appen åbner `.ifc`, `.csv`, `.xml` (MS Project XML eller Primavera P6 XML), `.mpp` og `.xer`. For de to sidste er der egne trin i [Åbning af en MS Project-fil (.mpp)](docs://howto-mpp-openen) og [Åbning af en Primavera P6-fil (.xer)](docs://howto-xer-openen).

### Åbn et nyligt projekt

Vælg *Start › Fil › Seneste* og klik på en fil i listen, eller vælg *Fil › Seneste*. Listen gemmer de sidste ti filer, du åbnede, gemte eller eksporterede. Også her følges en fil, der ikke er IFC, af forklaringen på formatet. Desktopappen viser stien til hver fil. En browser viser kun navnet.

Kan appen ikke længere læse en fil på listen, for eksempel fordi du har flyttet den, forsvinder den fra listen uden besked. I browsere uden filadgang, som Firefox, forbliver *Seneste* tom.

### Åbn et eksempel

Vælg *Fil › Eksempler* og klik på et eksempelprojekt. Det åbnes i en fane, uden fil. *Gem* spørger derfor, hvor du vil gemme det.

### Gem

Vælg *Start › Fil › Gem* eller *Fil › Gem*, eller tryk på Ctrl+S. Hvad der så sker, afhænger af dit projekt:

1. Har projektet allerede en fil, fordi du åbnede en IFC-fil eller gemte den før, så skriver appen til den fil. Der vises ikke noget vindue, undtagen ved den første gemning af en fil med et IFC-skema, der ikke er IFC 4.3 ADD2. Så spørger appen først *Hvilket IFC-skema vil du gemme i?* Se [Valg af IFC-skema](docs://howto-ifc-schema-kiezen).
2. Har projektet endnu ingen fil, spørger appen, hvor den skal ligge. Den foreslår projektnavnet med `.ifc`. Derefter er den fil projektets fil.
3. Gemmer din browser kun via en download (som Firefox), havner filen i din downloadmappe, og hver gemning laver en ny download. Første gang i en session ser du beskeden *Gemt som download: 'name.ifc' ligger i din downloadmappe. Denne browser lader appen ikke skrive til et eget sted, så hver gemning laver en ny download. I Chrome, Edge eller desktopappen opdaterer Gem blot den samme fil.*
4. Kan din browser ikke skrive tilbage til projektets fil, spørger appen hver gang du gemmer, hvor filen skal ligge. Det ligner *Gem som*, men det er en begrænsning i browseren. Første gang i en session forklarer beskeden dette, med et link til [Filer](docs://uitleg-bestanden): *Denne browser lader ikke appen skrive tilbage til 'name.ifc'.*

Efter at du har gemt, forsvinder markeringen *Ikke gemt*: prikken på fanen, stjernen før projektnavnet øverst og teksten *Ikke gemt* nederst til højre i statuslinjen.

### Gem under et andet navn

Vælg *Start › Fil › Gem som* eller *Fil › Gem som*, eller tryk på Ctrl+Shift+S. Vælg et navn og et sted (i Firefox downloader appen i stedet en ny fil). Derefter arbejder projektet med den nye fil: det næste *Gem* skriver dertil. Den gamle fil forbliver, som den var, da du sidst gemte.

### Luk et projekt

Klik på krydset på fanen, eller vælg *Fil › Luk projekt*. Har projektet ændringer, du ikke har gemt, spørger appen: *Ikke gemte ændringer: 'name' har ændringer, som endnu ikke er gemt.* Du vælger *Annuller* (projektet forbliver åbent), *Gem ikke* (projektet lukkes, og dine ændringer er væk) eller *Gem* (gem først, luk derefter). Lukker du hele appen på desktoppen (med lukkeknappen, Alt+F4 eller menuen i dit styresystem), spørger den dette for hvert projekt med ændringer. *Annuller*, eller en gemning, der mislykkes, stopper lukningen. Efter en sådan normal lukning rydder appen op i gendannelseskopierne fra den session, så gendannelsesvinduet kun vises efter et rigtigt nedbrud. Har et projekt ændringer, og lukker du browserfanen eller browservinduet, beder browseren om bekræftelse.

## Faldgruber og hvad appen så gør

**En åbnet IFC-fil er med det samme dit projekts fil.** *Gem* overskriver den fil, også hvis den stammer fra et andet program. Vil du beholde originalen, vælger du først *Gem som*.

**Andre formater overskrives aldrig.** En `.csv`, `.xml`, `.mpp` eller `.xer` har ingen fil, efter at den er åbnet. *Gem* skriver en ny IFC-fil og lader originalen være urørt.

**I Firefox laver hver gemning en ny fil.** Appen kan ikke skrive i din fil der. Den downloader hver gang en ny fil med projektnavnet som filnavn og ikke navnet på den fil, du åbnede.

**Chrome og Edge spørger om tilladelse.** Ved den første *Gem* af en fil, du har åbnet, spørger browseren, om appen må skrive til den. Afviser du, åbner appen et vindue, hvor du vælger en ny fil. I Chrome og Edge får du det vindue også, hvis skrivningen til den eksisterende fil mislykkes, for eksempel fordi filen er forsvundet eller låst.

**En besked om dubleret id eller afhængigheder, der ikke tæller.** Efter åbningen kan en besked blive stående på skærmen. Står der *Objekter med dubleret id i denne fil*, har hvert dubleret objekt fået sit eget id, og referencer peger på den første forekomst. Kontrollér så afhængigheder og tildelinger. Står der *afhængighed(er) kunne ikke medtages i beregningen*, sad afhængigheden på en hovedopgave og har ingen virkning, for eksempel en opgave, der er sammenkædet med sin egen hovedopgave. Selve filen forbliver uændret. Se [Afhængigheder](docs://uitleg-relaties) for hvad en afhængighed på en hovedopgave gør.

**Gemning kan mislykkes.** Giver selve gemningen en fejl, melder appen *Kunne ikke gemme* med årsagen. Dit projekt forbliver åbent og er stadig markeret *Ikke gemt*.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvad der er i en IFC-fil, og hvordan appen behandler formater.
- [Slå automatisk gemning til](docs://howto-automatisch-opslaan): lad appen opdatere din fil selv.
- [Valg af IFC-skema](docs://howto-ifc-schema-kiezen): hvad spørgsmålet *Hvilket IFC-skema vil du gemme i?* betyder.
- [Eksport](docs://howto-exporteren): at lave en kopi i et andet format.
- [Gendannelse efter et nedbrud](docs://howto-herstellen-na-een-crash): hvad du gør, hvis appen ikke lukkede rent.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format, hvad der overføres, og hvad der ikke overføres.
