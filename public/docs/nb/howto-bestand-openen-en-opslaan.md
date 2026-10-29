# Åpne og lagre en fil

Mål: åpne et prosjekt fra en fil og behold endringene dine.

## Når du trenger dette

Du starter dagen med prosjektet fra i går, du får en fil fra en kollega eller fra et annet program, eller du vil lagre en mellomtilstand før du endrer noe stort. Hva appen lagrer i en fil, og hvorfor bare IFC lagrer hele prosjektet ditt, forklares i [Filer og formater](docs://uitleg-bestanden).

## Trinn

### Åpne en fil

1. Velg *Hjem › Fil › Åpne*, eller *Fil › Åpne*, eller trykk Ctrl+O (⌘+O på en Mac). Gruppen *Fil* finnes også på fanen *Tabell*.
2. Velg filen. Du åpner én fil om gangen. På skrivebordet og i nettlesere med tilgang til filer, for eksempel Chrome og Edge, viser vinduet en liste med filtyper: *Alle støttede*, *IFC-filer*, *CSV-filer*, *XML-filer*, *MS Project-filer* og *Primavera XER-filer*.
3. Prosjektet åpnes i en ny fane. Hvis den gjeldende fanen fortsatt var tom og uendret, åpnes prosjektet i den.
4. Hvis filen ikke er IFC, vises et vindu med en kort forklaring av det formatet. Et grønt felt forklarer hva appen tok over, et gult felt hva som ikke ble med eller bare delvis ble med, og et blått felt hvordan lagring og skriving tilbake til filen fungerer. *Les mer* åpner veiledningen for formatet. Klikk på *Forstått* for å lukke vinduet. Sett først haket i *Ikke vis igjen for …* hvis du ikke vil se denne forklaringen for formatet lenger. Du slår den på igjen i [Appinnstillinger](docs://ref-instellingen), på fanen *Avansert*.

En IFC-fil gir filnavnet sitt til fanen. Et prosjekt fra et annet format får prosjektnavnet sitt.

Appen åpner `.ifc`, `.csv`, `.xml` (MS Project-XML eller Primavera P6-XML), `.mpp` og `.xer`. For de to siste finnes egne trinn i [Åpne en MS Project-fil (.mpp)](docs://howto-mpp-openen) og [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen).

### Åpne et nylig prosjekt

Velg *Hjem › Fil › Nylig* og klikk på en fil i listen, eller velg *Fil › Nylig*. Listen beholder de ti siste filene du åpnet, lagret eller eksporterte. Også her følges en fil som ikke er IFC, av forklaringen av formatet. Skrivebordsappen viser stien for hver fil, en nettleser viser bare navnet.

Hvis appen ikke lenger kan lese en fil i listen, for eksempel fordi du har flyttet den, forsvinner den fra listen uten melding. I nettlesere uten filtilgang, for eksempel Firefox, forblir *Nylig* tom.

### Åpne et eksempel

Velg *Fil › Eksempler* og klikk på et eksempelprosjekt. Det åpnes i en fane, uten fil: *Lagre* spør derfor hvor du vil beholde det.

### Lagre

Velg *Hjem › Fil › Lagre* eller *Fil › Lagre*, eller trykk Ctrl+S. Hva som skjer da, avhenger av prosjektet ditt:

1. Hvis prosjektet allerede har en fil, fordi du åpnet en IFC-fil eller lagret den før, skriver appen til den filen. Det vises ikke noe vindu, med ett unntak: ved første lagring av en fil med et IFC-skjema som ikke er IFC 4.3 ADD2. Da spør appen først *Hvilket IFC-skjema vil du lagre i?* Se [Velge IFC-skjema](docs://howto-ifc-schema-kiezen).
2. Hvis prosjektet ikke har en fil ennå, spør appen hvor den skal lagres. Den foreslår prosjektnavnet med `.ifc`. Deretter er den filen prosjektets fil.
3. Hvis nettleseren din bare lagrer via en nedlasting (som Firefox), havner filen i nedlastingsmappen din, og hver lagring lager en ny nedlasting. Første gang i en økt ser du meldingen *Lagret som nedlasting: «navn.ifc» ligger i nedlastingsmappen din. Denne nettleseren lar ikke appen skrive til et eget sted, så hver lagring lager en ny nedlasting. I Chrome, Edge eller skrivebordsappen oppdaterer Lagre bare den samme filen.*
4. Hvis nettleseren ikke kan skrive tilbake til prosjektets fil, spør appen igjen hvor filen skal legges, hver gang du lagrer. Det ser ut som *Lagre som*, men det er en begrensning i nettleseren. Første gang i en økt forklarer meldingen *Denne nettleseren lar ikke appen skrive tilbake til «navn.ifc».* dette, med en lenke til [Filer](docs://uitleg-bestanden).

Etter lagring forsvinner markeringen *Ikke lagret*: prikken på fanen, stjernen foran prosjektnavnet øverst og teksten *Ikke lagret* nederst til høyre i statuslinjen.

### Lagre under et annet navn

Velg *Hjem › Fil › Lagre som* eller *Fil › Lagre som*, eller trykk Ctrl+Shift+S. Velg et navn og en plass (i Firefox laster appen i stedet ned en ny fil). Deretter jobber prosjektet med denne nye filen: neste *Lagre* skriver dit. Den gamle filen forblir som den var da du sist lagret.

### Lukke et prosjekt

Klikk på krysset på fanen, eller velg *Fil › Lukk prosjekt*. Hvis prosjektet har endringer som du ikke har lagret, spør appen: *Ikke lagrede endringer: «navn» har endringer som ikke er lagret ennå.* Du velger *Avbryt* (prosjektet forblir åpent), *Ikke lagre* (prosjektet lukkes, og endringene dine er borte) eller *Lagre* (lagre først, og lukk deretter). Hvis du lukker hele appen på skrivebordet (med lukkeknappen, Alt+F4 eller menyen i operativsystemet ditt), spør den dette for hvert prosjekt med endringer. *Avbryt*, eller en lagring som mislykkes, stopper lukkingen. Etter en slik normal lukking rydder appen opp gjenopprettingskopiene for den økten, så gjenopprettingsvinduet vises bare etter et reelt krasj. Hvis et prosjekt har endringer og du lukker nettleserfanen eller -vinduet, ber nettleseren om bekreftelse.

## Fallgruver og hva appen gjør da

**En åpnet IFC-fil er med én gang prosjektets fil.** *Lagre* overskriver den filen, også hvis den kommer fra et annet program. Hvis du vil beholde originalen, velg *Lagre som* først.

**Andre formater overskrives aldri.** En `.csv`, `.xml`, `.mpp` eller `.xer` har ingen fil etter åpning. *Lagre* skriver en ny IFC-fil og lar originalen være urørt.

**I Firefox lager hver lagring en ny fil.** Appen kan ikke skrive til filen din der. Den laster ned en ny fil hver gang, med prosjektnavnet som filnavn og ikke navnet på filen du åpnet.

**Chrome og Edge ber om tillatelse.** Ved første *Lagre* av en fil du åpnet, spør nettleseren om appen har lov til å skrive til den. Hvis du sier nei, åpner appen et vindu der du velger en ny fil. I Chrome og Edge får du også det vinduet hvis skriving til den eksisterende filen mislykkes, for eksempel fordi filen er forsvunnet eller låst.

**En melding om dupliserte ID-er eller avhengigheter som ikke telles.** Etter åpning kan en melding bli stående på skjermen. Hvis den sier *Objekter med en duplisert ID i denne filen*, fikk hvert dupliserte objekt sin egen ID, og referanser peker på den første forekomsten. Kontroller da avhengigheter og tilordninger. Hvis den sier *avhengighet(er) kunne ikke tas med i beregningen*, lå avhengigheten på en hovedaktivitet og har ingen effekt, for eksempel en aktivitet koblet til sin egen hovedaktivitet. Filen selv forblir uendret. Se [Avhengigheter](docs://uitleg-relaties) for hva en avhengighet på en hovedaktivitet gjør.

**Lagring kan mislykkes.** Hvis selve lagringen gir en feil, melder appen *Kunne ikke lagre*, med årsaken. Prosjektet forblir åpent og er fortsatt markert *Ikke lagret*.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hva som er i en IFC-fil, og hvordan appen behandler formater.
- [Slå på automatisk lagring](docs://howto-automatisch-opslaan): la appen oppdatere filen din selv.
- [Velge IFC-skjema](docs://howto-ifc-schema-kiezen): hva spørsmålet *Hvilket IFC-skjema vil du lagre i?* betyr.
- [Eksportere](docs://howto-exporteren): lage en kopi i et annet format.
- [Gjenopprette etter et krasj](docs://howto-herstellen-na-een-crash): hva du gjør hvis appen ikke ble avsluttet på en ordentlig måte.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format hva som blir med, og hva som ikke blir det.
