# Primavera P6 (.xer) openen

Een `.xer`-bestand is het uitwisselingsformaat van Primavera P6. Open Planner Studio kan zo'n bestand rechtstreeks openen; een tussenstap via P6 XML of een externe omzetter is niet nodig. Deze gids legt uit wat de import doet, welke gegevens bewaard blijven en waar de grenzen van het huidige P6-model liggen.

## Wat je hier leert

- Hoe één XER-bestand meerdere projectdocumenten kan openen.
- Hoe huidige projecten, lege projecten en baselineprojecten worden behandeld.
- Welke kalender-, resource-, voortgangs- en metadata-informatie wordt ingelezen.
- Hoe tekencodering en de P6-getalnotatie veilig worden bepaald.
- Wat opslaan als IFC betekent en welke P6-functies nog geen eigen rekenmodel hebben.

## Openen en documenten

Open een `.xer`-bestand via **Bestand → Openen** of **Ctrl+O**. Eén export kan meerdere P6-projecten bevatten. Open Planner Studio opent ieder niet-leeg huidig project als een afzonderlijk document; het document met de meeste activiteiten wordt actief. Lege projecten krijgen geen zinloos tabblad.

Na één bestandsactie verschijnt één informatieve melding, ook wanneer er veel documenten openen. Die melding noemt de werkelijk gevonden en geopende projecten, lege projecten, baselines en eventuele terugvallen. Bij een volgende XER-bestandsactie krijg je opnieuw één eigen melding.

Een P6-baselineproject wordt niet als los, planbaar document geopend. Als het bij een geopend huidig project hoort, wordt het als baseline bij dat document bewaard. Een verwijzing naar een baseline die niet in het bestand staat wordt niet verzonnen: die blijft buiten de baselineverzameling en wordt in de melding geteld. Een zelfverwijzing, een kring van baselineverwijzingen of een selectie die anders geen enkel document zou openen, schakelt de uitsluiting veilig terug: de betrokken projecten openen dan gewoon als huidige documenten. Dat beschermt je tegen een stil leeg scherm en maakt de terugval zichtbaar.

Relaties tussen twee verschillende P6-projecten worden als externe bronlinks bewaard. De app rekent ze niet door als gewone relaties, omdat elk geopend document een zelfstandige planning is.

## Wat er uit P6 meekomt

De import leest onder meer:

- **Projecten, WBS, activiteiten en mijlpalen**, inclusief P6-activiteits- en duurtypen.
- **Relaties, lags, constraints, voortgang en actuals**, plus P6-suspend/resume-datums waar ze in het bronbestand staan.
- **Project- en resourcekalenders**, werktijden en uitzonderingen. Uren en kloktijden blijven daarbij gegevens van de kalender in plaats van een projectbrede gok.
- **Resources, tarieven en toewijzingen**.
- **Activity codes, UDF's en notities**, inclusief hun bronstructuur en koppelingen aan activiteiten.

De rauwe P6-brongegevens die Open Planner Studio leest, blijven onderdeel van het document. Ze reizen mee door tabwissels, undo, herstel en opslaan. Dat is iets anders dan beloven dat iedere P6-functie al een gelijkwaardig bewerk- of rekenmodel heeft: waar zo'n motor ontbreekt, bewaren we de brondata in plaats van haar stil weg te gooien.

## Tekencodering en getallen

XER noemt zijn tekencodering niet betrouwbaar in het bestand. Een UTF-BOM wordt gevolgd; zonder BOM gebruikt de lezer geldige UTF-8 en valt hij anders terug op Windows-1252. Is zo'n niet-ASCII-keuze nodig, dan staat de gebruikte codering in de openingsmelding. De app probeert geen regels te raden of als "overgeslagen" voor te stellen.

P6 kan de decimaal- en duizendtallenscheiding in de `CURRTYPE`-tabel vastleggen, zowel als letterlijk teken als met symbolische tokens zoals `ds_Period` en `dg_Comma`. Die notatie wordt gelezen vóór duren, werk en float worden omgezet. Ontbreekt `CURRTYPE`, dan is punt de veilige standaard. Lijkt een waarde een komma-decimaal terwijl die broninformatie ontbreekt, dan stopt de import met een gerichte fout in plaats van een mogelijk verkeerd schema te openen.

## Opslaan en uitwisselen

Een XER-import is een **import**, geen XER-editor of XER-exporter. Wanneer je daarna opslaat, schrijft Open Planner Studio een IFC-bestand. Dat IFC is het eigen projectbestand en bewaart de gelezen XER-brondata naast de gegevens waarmee de app werkt. Het oorspronkelijke `.xer`-bestand wordt nooit stil overschreven.

Voor uitwisseling naar Primavera bestaat de bestaande **Primavera P6 XML**-export. Dat is een ander formaat met eigen beperkingen; zie [Im-/export](docs://gids-import-export). Bewaar daarom altijd ook het IFC-bestand wanneer je een bewerkt project later opnieuw wilt openen.

## Grenzen die zichtbaar blijven

Een paar P6-begrippen zijn al opgeslagen, maar hebben nog geen volledig gelijkwaardig rekenmodel:

- **`TT_Rsrc`** (resource-dependent activity) en **`TT_WBS`** worden als P6-brontype bewaard. De solver heeft nog geen afzonderlijke P6-rekenmodus voor deze typen.
- Een P6-resourcecurve met 21 punten wordt als bronverdeling bewaard. Een herkenbare vorm kan voor het histogram naar de dichtstbijzijnde ingebouwde curve worden vertaald, maar de oorspronkelijke 21-puntsvorm wordt na een bewerking nog niet opnieuw berekend.
- De bestaande **P6 XML**-lezer en deze XER-lezer hebben nog niet dezelfde volledige veldendekking. XER kan daarom gegevens bevatten die P6 XML in de app nog niet leest of schrijft.

Deze grenzen verwijderen geen brongegevens. Als XER-specifieke brondata aanwezig is, levert de exportcode bij CSV, MS Project XML of Primavera P6 XML een getypeerd verliesresultaat. De huidige interface toont dat resultaat nog niet als afzonderlijke melding; opslaan als IFC bewaart de brondata.

## Verder lezen

- [Kalenders & uren-planning](docs://gids-kalenders-uren) legt uit hoe werktijden en uitzonderingen de planning sturen.
- [Resources, histogram & nivellering](docs://gids-resources-histogram) behandelt resources, toewijzingen en belasting in Open Planner Studio.
- [Baselines & voortgang](docs://gids-baselines-voortgang) legt het gebruik van baselines na import uit.
- [Im-/export](docs://gids-import-export) vergelijkt IFC, CSV, MS Project XML en Primavera P6 XML.
