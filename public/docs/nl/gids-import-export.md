# Im-/export

Open Planner Studio bewaart een project standaard als IFC — geen los projectbestand ernaast. Maar
soms moet een planning ook buiten de app leven: in Primavera P6, in Microsoft Project, of als
platte tabel voor een spreadsheet. Deze gids legt uit wat het native IFC-formaat inhoudt, wat elk
exportformaat wél en niet meeneemt, en waar je importeren/exporteren in de app terugvindt.

## Wat je hier leert

- Wat "IFC is het native formaat" precies betekent voor openen en opslaan.
- Wat er wél en niet meegaat bij export naar MS Project (MSPDI) en Primavera P6 XML.
- Wat de CSV-export bevat — en wat bewust wordt weggelaten.
- Waar je importeert en exporteert: **Backstage → Exporteren** en **Backstage → Importeren**.
- Hoe extensies extra importformaten kunnen toevoegen.

## IFC: het native formaat

Een Open Planner Studio-project ís een IFC 4x3-bestand (buildingSMART-standaard). Er bestaat geen
apart JSON- of projectbestand ernaast: **Opslaan** en **Openen** (Backstage, of **Ctrl+S**/**Ctrl+O**)
schrijven en lezen rechtstreeks IFC. Dat betekent dat alles wat je in de app doet — taken, WBS,
relaties met constraints, resources en toewijzingen, kalenders (project- én resourcekalenders),
baselines, voortgang, aantekeningen, activiteitscodes en aangepaste velden, externe koppelingen
tussen projecten — in hetzelfde bestand terechtkomt en bij een volgende **Openen** weer volledig
terugkomt. Als je een nieuwe soort projectdata in de app tegenkomt, kun je ervan uitgaan dat die
door IFC round-trippt; als iets níet round-trippt, staat dat hieronder expliciet vermeld.

IFC is ook de manier waarop deze app aansluit bij de rest van de OpenAEC-gereedschapskist: hetzelfde
bestand kan door BIM-software gelezen worden voor de 4D-koppeling (planning naast het bouwmodel).

## Exporteren naar andere formaten

Open **Backstage → Exporteren** voor vier formaten:

- **CSV (puntkomma-gescheiden)** — universele tabel-export. Alle taken met datums en duur.
- **MS Project XML** — te openen in Microsoft Project. Volledige WBS-structuur.
- **Primavera P6 XML** — voor Oracle Primavera P6.
- **IFC 4x3** — de BuildingSMART-standaard, dezelfde als het native formaat (handig als "opslaan als"
  naar een apart bestand, of om een kopie te delen zonder de rest van je open documenten te raken).

Elk formaat heeft zijn eigen beperkingen: hoe rijker het doelformaat, hoe meer er meegaat, maar
geen van de drie externe formaten is een volledige spiegel van IFC.

### CSV

De CSV-export bevat **alleen de takentabel**: WBS-code, naam, duur (dagen), start, einde,
voorgangers (als tekstcode, bijvoorbeeld `2.1FS+3d`), taaktype, status, voltooiing (%), werkelijke
start/einde, kritiek (ja/nee), totale speling en omschrijving. Er gaan bewust **geen resources,
toewijzingen, kalenders of baselines** mee — CSV is puur een taken-tabel voor wie de planning in
een spreadsheet wil bekijken of bewerken, niet een volwaardige projectuitwisseling. Bij het
terug-**importeren** van een CSV-bestand blijven baselines dus leeg (er was niets om ze uit te
lezen). Ook zonder waarschuwing verdwijnen: de vlag dat een taak **handmatig gepland** is, de
sub-dag-precisie van een **nivelleervertraging**, **taak-splitsen** en **resume/stop**-
hervattingsdata uit een `.mpp`-import — CSV heeft alleen plaats voor Start/Einde als platte datums,
dus die extra informatie past er sowieso niet in. De rauwe Start/Einde-datums van een handmatig
geplande taak blijven wél gewoon staan; alleen het feit dát ze handmatig zijn, gaat verloren.

### MS Project XML (MSPDI)

MSPDI is aanzienlijk rijker dan CSV: resources, toewijzingen (inclusief belastingscurve), kalenders
en baselines gaan wél mee. Toch is niet alles in MSPDI uit te drukken. Bij het exporteren waarschuwt
de app in de ontwikkelaarsconsole (`console.warn`) zodra iets verloren gaat, met precies hoeveel
items het raakt:

- **Externe koppelingen** tussen projecten worden weggelaten (de "spookweergave" van de andere
  taak blijft alleen in-app zichtbaar).
- **Zachte Start On/Finish On-beperkingen** (soft `MSO`/`MFO`) worden gedegradeerd naar SNET/FNET —
  de MSPDI-codes 2/3 zijn namelijk *hard* (Must), dus de bovengrens van de zachte variant gaat
  verloren. Harde `MSO`/`MFO` exporteren wel exact.
- **Secundaire beperkingen** gaan verloren — MSPDI kent maar één beperkingsveld per taak.
- **Hammock-taken** (afgeleide duur) worden geëxporteerd als een gewone taak met de berekende
  datums — MSPDI heeft geen native hammock/LOE-type.
- **Taakaantekeningen** worden bewust **niet** geëxporteerd, ook al heeft MSPDI een `<Notes>`-veld:
  onze aantekeningen zijn een afvink-checklist-vorm die niet zuiver naar platte tekst vertaalt.
- **Handmatig geplande taken** (`.mpp`-import) gaan zonder het native `<Manual>`-element mee — de datums zelf staan er wél (ze zitten al in
  Start/Finish), alleen het feit dát MS Project ze als "Handmatig gepland" zou tonen niet.
- De **sub-dag-precisie** van een nivelleervertraging gaat verloren — MSPDI kent geen native
  `<LevelingDelay>`/`<LevelingDelayFormat>`-element voor onze minutennauwkeurige waarde.
- **Gecontoureerde toewijzingen** gaan sinds de contour-engine wél native mee: de dagverdeling van
  elke toewijzing met een contour (uit een `.mpp`-, MSPDI- of P6-import) wordt als
  `<TimephasedData>` per werkdag geschreven, met het contourtype *Contoured*, en bij het importeren
  van een MSPDI-bestand weer teruggelezen — inclusief de onderbrekingen die erin zitten. Alleen een
  **gesplitste taak zonder contourdata** (bijvoorbeeld een pauze die de nivelleerder heeft
  ingevoegd) gaat zonder dat element mee: de berekende datums staan er wél, de onderbreking zelf
  niet.
- **Resume/stop** (een taak die buiten de gewone voortgangslogica om is hervat) heeft geen native
  `<Resume>`/`<Stop>`-element.
- De **kritiek-pad-definitie** (near-critical-modus/drempel) en overige planningsopties zijn niet
  native uitdrukbaar in MSPDI en gaan dus verloren — die blijven alleen via IFC bewaard.

### Primavera P6 XML

Dezelfde soort afweging als MSPDI, met een paar P6-specifieke eigenaardigheden:

- **Externe koppelingen** en **hammock-taken** worden op dezelfde manier weggelaten/vereenvoudigd
  als bij MSPDI, elk met een waarschuwing.
- **Taakaantekeningen** worden ook hier weggelaten — P6-XML heeft er geen geschikt veld voor.
- **Procent-lag** op een relatie (bijvoorbeeld 40% van de voorgangerduur) wordt "uitgebakken" naar
  een vast aantal dagen, want P6 kent geen procent-lag.
- **Kalenderdag-lag** (lag in doorlooptijd-dagen in plaats van werkdagen) wordt geëxporteerd als
  een gewone uren-lag — P6 heeft geen aparte lag-eenheid per relatie.
- **Belastingscurves** gaan schema-native mee als P6-resourcecurve (een `<ResourceCurve>`-object
  met 21 waarden, waarnaar de toewijzing verwijst), inclusief de LATE_PEAK-curve met haar eigen
  vorm; een eigen P6-curve die geen van de zes OPS-vormen is, komt bij het importeren exact terug
  (de app rekent er dan mee, ook al toont de curvekeuze in de UI hem als "uniform").
- **Werkende kalenderuitzonderingen** (een dag die normaal vrij is maar expliciet als werkend is
  aangemerkt, bijvoorbeeld een ingeroosterde zaterdag) worden weggelaten — P6-XML kent geen
  schemaveld om zoiets per datum aan te geven. P6 modelleert een structureel afwijkend weekpatroon
  zelf via een aparte werkweek-instelling, niet via losse datums, dus een automatische vertaling
  zou het hele weekpatroon wijzigen in plaats van alleen de ene datum — dat wordt bewust niet
  gegokt. De app waarschuwt (met het aantal) zodra dit een bestand raakt.
- **Handmatig geplande taken** (`.mpp`-import) gaan hier verder dan bij MSPDI: P6 kent het begrip
  "handmatig gepland" niet, dus zo'n taak exporteert als een gewone taak met berekende datums — in
  tegenstelling tot MSPDI blijven de rauwe, opgeslagen datums zelf hier dus niet gegarandeerd staan.
- De **sub-dag-precisie** van een nivelleervertraging gaat verloren — niet uitdrukbaar in P6-XML.
- **Gecontoureerde toewijzingen** gaan native mee als spreiding op de toewijzing (P6's eigen
  `PlannedCurve`/`RemainingCurve`/`ActualCurve`-notatie, verankerd op de taakstart) en worden bij het
  importeren weer teruggelezen, inclusief onderbrekingen. Alleen een **gesplitste taak zonder
  contourdata** wordt zonder die spreiding geëxporteerd.
- **Resume/stop** (een taak die buiten de gewone voortgangslogica om is hervat) wordt weggelaten —
  niet uitdrukbaar in P6-XML.
- Planningsopties (net als bij MSPDI) worden niet geëxporteerd.

Deze waarschuwingen zijn geen slordigheid — ze zijn een bewuste, expliciete keuze: liever een
zichtbare waarschuwing per weggelaten item dan een stil dataverlies. Open bijvoorbeeld de showcase
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (die heeft
taakaantekeningen en een relatie met procent-lag) en exporteer naar P6 of MS Project XML: de
ontwikkelaarsconsole toont dan exact welke items zijn weggelaten of vereenvoudigd, met het aantal.

## Importeren

**Bestand → Openen** (of **Backstage → Openen**) accepteert `.ifc`-, `.csv`-, `.xml`-, `.mpp`- en
`.xer`-bestanden. Bij een `.xml`-bestand herkent de app zelf of het een Primavera P6- of een MS
Project-bestand is, aan de hand van de inhoud. Zoals hierboven beschreven: een CSV- of Primavera P6 XML-import
levert een project op **zonder baselines** (die stonden er niet in), terwijl IFC en MSPDI
baselines wél meebrengen.

Een `.xer`-bestand is Primavera P6's eigen uitwisselingsformaat. De app leest het rechtstreeks,
maar schrijft geen `.xer` terug: na een bewerking sla je op als IFC. Eén XER kan meerdere huidige
projecten en baselineprojecten bevatten; de huidige projecten openen als afzonderlijke documenten
en bijbehorende baselines blijven aan hun project gekoppeld. Zie
[Primavera P6 (.xer) openen](docs://gids-xer-import) voor de projectselectie, tekencodering,
P6-getalnotatie en de bewaarde brondata.

Een `.mpp`-bestand (het native Microsoft Project-formaat, Project 2010 t/m 2021) is een aparte
route: die import is **alleen-lezen** — er bestaat geen `.mpp`-export, dus terugexporteren naar
MS Project loopt via MSPDI-XML. Zie de gids [MS Project (.mpp) openen](docs://gids-msproject-import)
voor wat er meekomt en wat de beperkingen zijn.

Een kleine, technische kanttekening voor wie een taak met een **doorlooptijd-duur** ("elapsed",
24/7-planning, negeert vrije dagen) importeert vanuit een bron die alleen een **datum** opgeeft
zonder tijdstip — CSV, Primavera P6, een datumveld in IFC, of de AI-assistent — en die taak op een
**uren-kalender** valt: zo'n taak start dan op middernacht (00:00) van de opgegeven datum, niet op
het eerste werk-instant van die dag. Dit is bewust: een expliciet ingelezen tijdstip wordt nooit
naar een andere kalenderdag verplaatst. Bij `.mpp`-import speelt dit niet, want dat formaat levert
altijd een volledig tijdstip mee.

## Extensie-importers

Naast de vaste formaten hierboven kunnen geïnstalleerde extensies eigen importers toevoegen —
bijvoorbeeld voor een formaat dat hier niet standaard wordt ondersteund. Die verschijnen in
**Backstage → Importeren**, elk met een eigen naam, omschrijving en bijbehorende bestandsextensies;
zonder geïnstalleerde import-extensies is die sectie leeg. Kijk in **Backstage → Extensies** welke
extensies beschikbaar zijn.

## Verder lezen

- Baselines gaan alleen mee via IFC en MS Project XML, niet via CSV of Primavera P6 XML — lees de gids
  [Baselines & voortgang](docs://gids-baselines-voortgang) voor hoe je een baseline vastlegt.
- Resources, toewijzingen en belastingscurves — lees de gids
  [Resources, histogram & nivellering](docs://gids-resources-histogram) voor hoe die tot stand komen
  vóór je exporteert.
