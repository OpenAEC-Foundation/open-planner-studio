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
lezen).

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
- De **LATE_PEAK**-belastingscurve heeft geen P6-equivalent en wordt geëxporteerd als de dichtstbij
  liggende benadering ("Early Peak").
- Planningsopties (net als bij MSPDI) worden niet geëxporteerd.

Deze waarschuwingen zijn geen slordigheid — ze zijn een bewuste, expliciete keuze: liever een
zichtbare waarschuwing per weggelaten item dan een stil dataverlies. Open bijvoorbeeld de showcase
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (die heeft
taakaantekeningen en een relatie met procent-lag) en exporteer naar P6 of MS Project XML: de
ontwikkelaarsconsole toont dan exact welke items zijn weggelaten of vereenvoudigd, met het aantal.

## Importeren

**Bestand → Openen** (of **Backstage → Openen**) accepteert `.ifc`-, `.csv`- en `.xml`-bestanden.
Bij een `.xml`-bestand herkent de app zelf of het een Primavera P6- of een MS Project-bestand is,
aan de hand van de inhoud. Zoals hierboven beschreven: een CSV- of P6-import levert een project
op **zonder baselines** (die stonden er niet in), terwijl IFC en MSPDI baselines wél meebrengen.

## Extensie-importers

Naast de vaste formaten hierboven kunnen geïnstalleerde extensies eigen importers toevoegen —
bijvoorbeeld voor een formaat dat hier niet standaard wordt ondersteund. Die verschijnen in
**Backstage → Importeren**, elk met een eigen naam, omschrijving en bijbehorende bestandsextensies;
zonder geïnstalleerde import-extensies is die sectie leeg. Kijk in **Backstage → Extensies** welke
extensies beschikbaar zijn.

## Verder lezen

- Baselines gaan alleen mee via IFC en MS Project XML, niet via CSV of P6 — lees de gids
  [Baselines & voortgang](docs://gids-baselines-voortgang) voor hoe je een baseline vastlegt.
- Resources, toewijzingen en belastingscurves — lees de gids
  [Resources, histogram & nivellering](docs://gids-resources-histogram) voor hoe die tot stand komen
  vóór je exporteert.
