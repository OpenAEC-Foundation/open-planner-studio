# MS Project (.mpp) openen

Naast MS Project XML (MSPDI) kan Open Planner Studio ook het native `.mpp`-bestand van Microsoft
Project rechtstreeks openen — zonder dat je eerst iets hoeft te exporteren. De lezer is een eigen,
in TypeScript geschreven implementatie van het MPP14-containerformaat (Project 2010 t/m 2021).
Deze gids legt uit wat er meekomt, wat de grenzen zijn, en wat er gebeurt als je zo'n bestand
opslaat.

## Wat je hier leert

- Hoe je een `.mpp`-bestand opent, en via welke wegen dat werkt.
- Wat er precies meekomt: taken, relaties, kalenders, resources en toewijzingen.
- Hoe nauwkeurig de ingelezen start- en einddatums zijn, en hoe splitsen, nivellering, handmatig
  plannen en resource-contouring daarbij worden meegerekend.
- Wat er met voortgang gebeurt: MS Project se eigen hervattingsconventie voor lopende taken.
- Eén bekende beperking bij kalenders: werkweken (een tijdelijk afwijkend weekpatroon).
- Wat er bewust niet meekomt, en wat je krijgt bij een niet-ondersteund bestand.
- Wat er gebeurt als je een geopend `.mpp`-bestand opslaat of terugexporteert.

## Wat er meekomt

Bij het openen van een `.mpp`-bestand leest Open Planner Studio:

- **Taken**, inclusief de hiërarchie (samenvattende taken/subtaken) en de WBS-codering.
- **Relaties** in alle vier de soorten (eind-start, start-start, eind-eind, start-eind), met lag —
  zowel in werkdagen als in doorlooptijd-dagen ("elapsed"), en ook procent-lag.
- **Kalenders**: werkdagen, werktijden per dag en de concrete uitzonderingsdatums (vrije dagen).
- **Resources**, van het type Werk of Materiaal. Het type Kosten bestaat in MS Project ook, maar
  wordt — net als bij de bestaande MSPDI-import — behandeld als Werk.
- **Toewijzingen** van resources aan taken, inclusief voortgang (percentage voltooid, werkelijke
  start/einde waar aanwezig).

Dit is dezelfde veldenset als de bestaande MS Project XML-import (MSPDI), op de uitzonderingen na
die hieronder staan.

Voor **urenprojecten** (taken die MS Project op uur- of minuutniveau plant, of een kalender met
bijvoorbeeld een lunchpauze) komen duren en werktijden op die precisie mee: een taak van 2 uur komt
niet meer op 0 dagen uit, en start-/eindtijden behouden hun echte tijdstip in plaats van alleen de
datum. Open Planner Studio herkent dit automatisch, per kalender — je hoeft niets aan te zetten. Zie
[Kalenders & uren-planning](docs://gids-kalenders-uren) voor hoe uren-modus in de rest van de app
werkt.

## Openen

Een `.mpp`-bestand open je op precies dezelfde manieren als elk ander projectbestand:

- **Bestand → Openen** (of **Ctrl+O**), gewoon een `.mpp`-bestand kiezen.
- Via **recente bestanden** zodra je er eerder één hebt geopend.
- Via de AI-assistent, met de tool `planner_import_schedule` (zie de gids
  [AI-assistent koppelen (MCP)](docs://gids-ai-mcp)).

Het bestand komt — net als bij elke import — in een **nieuw document** terecht, tenzij het actieve
tabblad nog leeg en ongewijzigd is.

## Datumgetrouwheid

Open Planner Studio rekent een geopend `.mpp`-bestand door met dezelfde kalenderlogica als MS
Project zelf (werkdagen, werktijden per dag, vrije dagen, en — bij een urenproject — de precieze
kloktijd). Onderbroken taken, nivellering, handmatig geplande taken en gecontoureerde
(resource-gedreven) toewijzingen worden daarbij niet als afwijkende uitzondering behandeld, maar
als volwaardig geïmplementeerd gedrag — zie de vier secties hieronder voor wat dat concreet
betekent. Over het volledige testcorpus (216 leesbare bestanden / 3413 taken, van publiek
MPXJ- en OzBuild-testmateriaal tot praktijkprojecten) komt de start- en einddatum exact overeen met
MS Project, tot op de minuut bij een urenproject — voor elk bestand in het corpus, zonder resterende
afwijking. Een geautomatiseerde test bewaakt dat: zodra een wijziging ook maar één datum in het
corpus zou laten afwijken, faalt de testsuite. Twijfel je bij een specifiek bestand dat niet in het
corpus zit, controleer dan de kritieke taken tegen MS Project na het openen.

Bevat het bestand taken met een onderbroken, genivelleerde of resource-gedreven planning, dan
verschijnt daarover eenmalig een informatieve melding bij het openen — geen waarschuwing, want die
taken worden gewoon correct doorgerekend; de melding vertelt alleen dát het bestand ze bevat.

### Gesplitste taken

Een taak die MS Project heeft opgesplitst in werkonderbrekingen (bijvoorbeeld 3 dagen werk, een
pauze van 2 dagen ertussen, dan verder) leest Open Planner Studio als zodanig: de onderbrekingen
komen uit het bestand, en de Gantt-balk toont ze als losse blokken met een dun verbindingslijntje —
**altijd zichtbaar**, ongeacht de instelling **Taakbalken bij onderbrekingen** (Instellingen-tab,
⚙-popup of Backstage → Instellingen). Een werkonderbreking is data, geen weergavevoorkeur; die
instelling stuurt uitsluitend of taken zónder eigen splits toch al opgeknipt getekend worden op
niet-werkdagen (kalender-necking). Print- en pdf-voorbeeld tonen dezelfde onderbroken balken. Rekenen gebeurt
segment-bewust: het restwerk telt door na elk gat, ook bij een taak die al gedeeltelijk is
uitgevoerd.

### Handmatig geplande taken

Een taak die in MS Project op **Handmatig gepland** stond, houdt in Open Planner Studio haar eigen
opgeslagen start- en einddatum — rauw, zonder kalendersnap en zonder dat een relatie of constraint
ze verschuift; ook een harde Moet-starten/eindigen-op-pin op zo'n taak is dan een dode letter. Haar
opvolgers rekenen gewoon normaal door vanaf die datums, via de gewone relatie-regels (zie de gids
[Relaties & constraints](docs://gids-relaties-constraints)). Zulke taken hebben daardoor per
constructie geen speling (totale en vrije speling 0) en gelden in de standaardinstelling als
kritiek — ze tonen dus geen normale speling zoals een automatisch geplande taak dat wel doet.
Herberekenen (**F5**) verandert niets aan een handmatig geplande taak: dat is precies het punt.

### Nivellering

Heeft MS Project een taak een nivelleervertraging ("leveling delay") gegeven, dan telt Open Planner
Studio die mee als een echte verschuiving van de vroege start — tot op de minuut bij een
urenproject, inclusief een eventuele doorlooptijd-vertraging (die telt 24/7 door, niet alleen op
werktijd). De vertraging werkt door in beide richtingen van de berekening, dus de speling van de
taak (en van taken die erop wachten) blijft na een nivellering kloppen.

### Gecontoureerde toewijzingen

Heeft een resource-toewijzing in MS Project een eigen werkverdeling gekregen die afwijkt van een
platte, gelijkmatige verdeling (resource-contouring: bijvoorbeeld een oplopende belasting, een
halve kracht in de eerste week, of een taak die over een langere periode is uitgesmeerd dan haar
duur op zichzelf zou vragen), dan leest Open Planner Studio die verdeling volledig mee. Bij het
openen volgen de datums MS Project se eigen opgeslagen antwoord, en de contour-engine gebruikt de
gelezen dagverdeling als echte data: het resource-histogram, de overallocatie-detectie, de
nivelleerder en het bezettingsoverzicht tonen en rekenen met de werkelijke uren per dag van de
toewijzing — een halve kracht op maandag staat er als een halve kracht, niet afgerond en niet
gelijkmatig uitgesmeerd. Een dag zonder werk binnen de contour (een onderbreking) draagt geen
belasting.

Bewerk je zo'n taak vervolgens zelf, dan reist de verdeling mee. Verandert de duur, dan rekt of
krimpt Open Planner Studio de contour proportioneel mee met de nieuwe duur (dezelfde regel die
MS Project voor een gecontourde toewijzing hanteert); al verricht werk blijft daarbij staan en
alleen het resterende deel wordt herschaald. Een taak waarvan MS Project het taaktype op *Vast werk*
had staan, houdt haar totale werk vast en verandert alleen de inzet per dag. Een verplaatsing in
de tijd, een kalenderwissel of een andere toewijzing raakt de verdeling niet. Wat er bij zo'n
bewerking wél loslaat, is het bij import gelezen *datumvenster* van MS Project: de einddatum van
de taak komt daarna uit Open Planner Studio se eigen berekening (duur plus eventuele
onderbrekingen) in plaats van uit MS Project se opgeslagen antwoord. De eerste keer dat dit binnen
een geopend document gebeurt, verschijnt daarover een informatieve melding met een link naar deze
sectie; latere bewerkingen in hetzelfde document melden zich niet nog eens. Het eigenschappenpaneel
van de taak toont of het datumvenster nog actief door MS Project gestuurd wordt, of dat die
sturing na een bewerking is losgelaten — met dezelfde link. De oorspronkelijk gelezen verdeling
blijft altijd in het bestand bewaard, ook ná opslaan.

De contour gaat ook mee naar buiten: een export naar MS Project XML schrijft de dagverdeling als
native `TimephasedData` (en het contourtype *Contoured*), een export naar Primavera P6 XML als
spreiding op de toewijzing; beide formaten leest Open Planner Studio ook weer terug. Zie de gids
*Importeren en exporteren* voor de details per formaat. Wil je de gelezen verdeling zelf per dag
bijstellen, een eigen verdeling maken of een contour loslaten, dan kan dat via de knop
**Urenverdeling…** naast de toewijzing — zie de gids [Resources & histogram](docs://gids-resources-histogram),
sectie De urenverdeling zelf bewerken.

## Mijlpalen: MS Project se eigen finish-grens-conventie voor eindmijlpalen

Een mijlpaal waarvan het veld **Soort mijlpaal** op **Eindmijlpaal** staat (zie de gids [Plannen &
WBS](docs://gids-plannen-wbs), sectie Mijlpaal-soorten) en die via een eind-start-relatie
aan een voorganger hangt, ankert op de finish-grens van die voorganger zélf, in plaats van op het
eerstvolgende werkmoment erna. Bij een **urenkalender** (zie hierboven) betekent dat de **exacte
eindklokstand** van de voorganger — bijvoorbeeld dinsdag 17:00, als de voorganger dan eindigt — in
plaats van woensdag 08:00. In **dagmodus** bestaat hetzelfde onderscheid, alleen dag-granulair: de
eindmijlpaal landt op dezelfde werkdag als de voorganger eindigt, in plaats van op de eerstvolgende
werkdag. Dat is MS Project se eigen conventie voor eindmijlpalen, en Open Planner Studio volgt 'm
overal waar dit type mijlpaal voorkomt, niet alleen bij een `.mpp`-import — ook een eindmijlpaal in
een handmatig aangemaakt project gedraagt zich zo. De standaardwaarde van **Soort mijlpaal** is
**Automatisch**: zo'n mijlpaal (en een expliciete **Startmijlpaal**) landt gewoon op het
eerstvolgende werkmoment, net als een gewone taak — deze conventie geldt uitsluitend voor een
mijlpaal die je zelf op **Eindmijlpaal** hebt gezet. Een gewone taak (met een eigen duur) ná
diezelfde voorganger start sowieso altijd op het eerstvolgende werkmoment.

Heeft een mijlpaal in het bronbestand zelf een duur groter dan 0, dan blijft het vinkje **Mijlpaal**
aan staan, maar plant Open Planner Studio 'm gewoon als een taak met die duur — zie de gids
[Plannen & WBS](docs://gids-plannen-wbs), sectie Mijlpaal-soorten.

## Voortgang: MS Project se eigen hervattingsconventie

Voor een taak die al **gedeeltelijk is uitgevoerd** wanneer je het `.mpp`-bestand opent, bepaalt
Open Planner Studio het hervattingspunt van het resterende werk op dezelfde manier als MS Project
zelf: op basis van de werkelijke starttijd plus de reeds verstreken tijd, in plaats van (zoals bij
een project uit Primavera P6 of een ander formaat) op basis van de statusdatum of de druk van
voorgaande taken. Je merkt dit meestal niet — de twee benaderingen komen op de meeste taken op
hetzelfde uit — maar het is de reden waarom een `.mpp`-geïmporteerde taak soms een net iets ander
hervattingspunt toont dan een verder identieke taak die uit P6 of MS Project XML afkomstig is. Deze
instelling is een permanente eigenschap van het project: ze blijft ook na **Opslaan** (als IFC) en
een volgende **Openen** intact, zonder dat er ergens een schakelaar voor te vinden is.

## Kalenderuitzonderingen en werkweken

Concrete, eenmalige uitzonderingsdatums in een kalender (een specifieke vrije dag op een vaste
datum) komen mee, en dat geldt ook voor **jaarlijks terugkerende** uitzonderingen mét een
herhaalregel — bijvoorbeeld een feestdag als Kerst die in MS Project is ingesteld om elk jaar
automatisch terug te komen. Open Planner Studio expandeert zo'n herhaalregel zelf naar de concrete
datums binnen de projectperiode; je hoeft hier zelf niets voor te doen. Dit geldt zowel voor gewone
vrije dagen als voor **werkende uitzonderingen** (een dag die normaal vrij is, maar in de kalender
expliciet als werkend is aangemerkt — bijvoorbeeld een ingeroosterde zaterdag).

Wat wél een bekende beperking blijft, zijn **werkweken** — in MS Project een manier om voor een
bepaald datumbereik een afwijkend weekpatroon aan een kalender toe te kennen (bijvoorbeeld "vanaf
1 juli werkt dit team ook op zaterdag"). Alleen het standaard weekpatroon en de losse
uitzonderingsdagen komen mee; een tijdelijk afwijkend weekpatroon niet. Dit raakt in de praktijk
weinig bestanden — de meeste MS Project-kalenders gebruiken geen werkweken — maar controleer een
kalender met een bekend afwijkend patroon voor de zekerheid na het openen, bij **Planning →
Kalender** — zie de gids [Kalenders & uren-planning](docs://gids-kalenders-uren).

## Wat niet meekomt

De `.mpp`-import is **alleen-lezen**: er bestaat geen `.mpp`-exportformaat, ook niet bij het
brondocument (MPXJ) waarop de lezer is gebaseerd. Daarnaast:

- **Geen baselines**, custom fields, outline codes, subprojecten of kostenvelden. De veldenset is
  exact wat de MSPDI-import ook levert, min baselines.
- **Oudere `.mpp`-formaten** (MPP8/9/12 — Project 98 t/m 2007) worden herkend maar niet gelezen:
  je krijgt een duidelijke foutmelding met de suggestie om het bestand in MS Project als XML te
  exporteren (**Bestand → Opslaan als → XML**) en dát bestand te openen.
- **Wachtwoord-versleutelde bestanden** geven dezelfde foutmelding met dezelfde suggestie — de
  inhoud wordt niet ontsleuteld.

## Opslaan en exporteren

Zoals overal in Open Planner Studio schrijft **Opslaan** altijd IFC — er is geen apart
`.mpp`-projectformaat om in terug te schrijven. Omdat een geopend `.mpp`-bestand (net als een
geopende `.csv` of MS Project XML) daardoor geen eigen opslagdoel krijgt, is **Ctrl+S** op zo'n
document altijd **opslaan-als**: je bronbestand wordt nooit stilzwijgend overschreven met
IFC-inhoud. Wil je de planning weer terug naar MS Project brengen, gebruik dan
**Backstage → Exporteren → MS Project XML** — zie de gids [Im-/export](docs://gids-import-export)
voor wat daarbij wel en niet meegaat.

## Herkomst

De `.mpp`-lezer is afgeleid van de broncode en structuurkennis van MPXJ (`github.com/joniles/mpxj`,
Jon Iles e.a.), een Java-bibliotheek onder LGPL-2.1 — net als Open Planner Studio zelf open source
onder LGPL-3.0.

## Verder lezen

- Wat elk export- en importformaat wél en niet meeneemt: [Im-/export](docs://gids-import-export).
- Werkdagen, werktijden en feestdagen na het openen controleren:
  [Kalenders & uren-planning](docs://gids-kalenders-uren).
