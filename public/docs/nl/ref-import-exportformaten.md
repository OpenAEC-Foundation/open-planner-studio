# Import- en exportformaten

Per bestandsformaat: of je het kunt openen, opslaan en exporteren, wat er wel en niet meegaat en met welk rekenprofiel het opent. Het waarom achter dit alles, en een voorbeeld met getallen, staat in [Bestanden en formaten](docs://uitleg-bestanden).

## In één oogopslag

**Openen** kan met IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` en `.xer`. Een bestand met een andere extensie behandelt de app als IFC.

**Opslaan** schrijft altijd IFC. Alleen een geopend IFC-bestand wordt het opslagdoel; een project uit een ander formaat heeft na het openen nog geen bestand en *Opslaan* vraagt dan waar het IFC-bestand moet komen.

**Exporteren** kan naar IFC 4x3, MS Project XML, Primavera P6 XML, CSV en twee voortgangsbladen (Excel en CSV). Een export verandert je project niet.

**Alleen lezen** zijn `.mpp` en `.xer`: de app kan ze openen, niet schrijven.

**PDF** komt alleen uit een rapport (zie [Rapporttypes](docs://ref-rapporttypes)). De app leest geen PDF.

**Waar.** Openen: *Start › Bestand › Openen*, *Bestand › Openen* of Ctrl+O. Exporteren: *Start › Bestand › Exporteren* of *Bestand › Exporteren*. Een ingevuld voortgangsblad lees je in via *Bestand › Importeren*, of met de knop *Voortgang bijwerken uit een blad* in de lintgroep *Voortgang* op de tabbladen *Planning*, *Tabel* en *Rapport*.

**Rekenprofiel bij openen.** Elk formaat opent met een rekenprofiel; wat dat is, staat in [Rekenopties en conventies](docs://ref-rekenopties-en-conventies). `.xer` opent met *Primavera P6*, `.mpp` met *Microsoft Project*, en CSV, MS Project XML en P6 XML met *Open Planner Studio*. IFC houdt het profiel dat in het bestand staat. Bij `.xer` en `.mpp` meldt de app dat het project zo rekent. Alleen IFC neemt het rekenprofiel en de reken-opties mee; van de reken-opties schrijft MS Project XML hooguit de kritiek-drempel. Een heropende export van een ander formaat rekent als *Open Planner Studio*.

## IFC

**Openen** — ja, `.ifc`. De app leest IFC 4.3. Rekenprofiel: dat uit het bestand.

**Opslaan** — ja, en het is het enige formaat dat opslaat. *Opslaan* schrijft je hele project als IFC-bestand. Het bestand wordt het opslagdoel.

**Exporteren** — ja, als *IFC 4x3* (met de toelichting *BuildingSMART standaard. 4D-koppeling met BIM-modellen.*). Standaardnaam: de projectnaam met de extensie `.ifc`. Is je project gekoppeld aan een resourcebibliotheek, dan staat in *Bestand › Exporteren* onder de kaarten het vakje *Bibliotheekbestand ernaast opslaan*. Aangevinkt vraagt de app na het project ook om een plek voor *projectnaam-bibliotheek.ifc*. Het vakje staat niet in de lijst op het tabblad *Start*.

**Wat meegaat** — alles wat bij het project hoort: taken met structuur, duur, datums en voortgang; relaties met lag; constraints en deadlines; kalenders; resources en toewijzingen, ook de urenverdeling; baselines; activiteitcodes en eigen velden; aantekeningen; externe koppelingen naar andere projecten; onderbrekingen; werkregels en taaktypen; de projectinstellingen zoals de statusdatum, de voortgangsmodus, het rekenprofiel en de reken-opties; de koppeling met een resourcebibliotheek. Bij een project uit een `.xer` gaat ook het oorspronkelijke bronbestand mee. Een eigen taaktype staat erin als het IFC-type `USERDEFINED` met de naam in het veld ObjectType, zodat andere IFC-programma's de taak gewoon lezen; daarnaast bewaart de app het vaste id van het type, zodat hernoemen de koppeling niet breekt. Opent iemand het bestand op een andere computer, dan staat het type daar onder *Uit dit project*, niet in diens eigen *Mijn taaktypen*.

**Wat niet meegaat** — hoe je het scherm hebt ingesteld (zoom, scrollpositie, geselecteerde taak, ingeklapte fasen, gekozen filter en groepering) en de app-instellingen ([Instellingen](docs://ref-instellingen)). Het tabblad *IFC* toont de IFC-tekst van je project.

## MS Project XML (MSPDI)

**Openen** — ja. De app herkent een `.xml`-bestand als MS Project XML aan het hoofdelement `Project` in de namespace van MS Project (of zonder namespace). Rekenprofiel: *Open Planner Studio*.

**Opslaan** — nee. Zo'n project krijgt geen opslagdoel.

**Exporteren** — ja, als *MS Project XML* (*Te openen in Microsoft Project. Volledige WBS-structuur.*). Standaardnaam: de projectnaam met `.xml`.

**Wat meegaat** — taken met structuur (niveau en WBS), duur, datums en voortgang; relaties met lag, ook in uren of procenten; constraints, ook de deadline; kalenders, ook taak- en resourcekalenders; resources en toewijzingen, ook de curve of urenverdeling; de statusdatum; de kritiek-drempel, als een heel aantal werkdagen van 0 of meer bij *Totale speling ≤ drempel*; de beschrijving van een taak (als notitie); de werkregel van een taak (als MS Project-taaktype); een eigen taaktype, in een vrij veld (`ExtendedAttribute`) dat de app terugleest en dat MS Project mag negeren. Van je baselines gaat alleen de actieve mee, als baseline 0. Een taak in uren behoudt haar eenheid, en een mijlpaal haar soort (start, einde of automatisch).

**Wat niet meegaat** — aantekeningen (de checklist bij een taak), externe koppelingen naar andere projecten, activiteitcodes en eigen velden, een tweede constraint, de markering *Handmatig gepland*, de nivelleervertraging, het hervat- en stoppunt bij een uit-volgorde-taak, de conventies *Restwerk hervat na de al verstreken duur* en *Niet-gestarte taken niet naar de statusdatum* van een MS Project-profiel, en de overige reken-opties. Onderbroken taken zonder urenverdeling gaan zonder hun onderbrekingen mee.

**Wat verandert onderweg** — een constraint *Moet starten op (MSO)* of *Moet eindigen op (MFO)* zonder de keuze *Verplicht (pin logica)* wordt *Start niet eerder dan (SNET)* of *Eindig niet eerder dan (FNET)*. Een hammock wordt een gewone taak met berekende datums.

## MS Project-bestand (`.mpp`)

**Openen** — ja, van MS Project 2010 tot en met 2021. Rekenprofiel: *Microsoft Project*. De app leest het bestand alleen: ze verandert je `.mpp` nooit. Een bestand van MS Project 2007 of ouder, en een bestand met wachtwoord, weigert ze met een melding die verwijst naar de XML-export van MS Project.

**Opslaan** — nee, en er is geen opslagdoel: *Opslaan* schrijft een nieuw IFC-bestand.

**Exporteren** — nee.

**Wat meegaat** — taken met structuur, duur en constraints; relaties met lag; kalenders; resources en toewijzingen; voortgang; een WBS-code die je in MS Project zelf invulde. De datums en speling die MS Project zelf uitrekende, leest de app ook, voor de weergave *Datums zoals opgeslagen*.

**Wat niet meegaat** — baselines, kosten en tarieven, aantekeningen en de eigen velden van MS Project. Zie [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen).

**Herkomst en licentie** — de `.mpp`-lezer is geschreven voor Open Planner Studio en afgeleid van de broncode en structuurkennis van MPXJ (`github.com/joniles/mpxj`, Jon Iles e.a.), een Java-bibliotheek onder LGPL-2.1. Structuur en veldconstanten zijn naar TypeScript overgezet. Open Planner Studio zelf is open source onder LGPL-3.0. De `.xer`-lezer is geen overname: daarvoor is MPXJ alleen als bron van begrip geraadpleegd.

## Primavera P6 XML

**Openen** — ja. De app herkent een `.xml`-bestand als P6 XML aan het hoofdelement `APIBusinessObjects`. Rekenprofiel: *Open Planner Studio*.

**Opslaan** — nee.

**Exporteren** — ja, als *Primavera P6 XML* (*Voor Oracle Primavera P6.*). Standaardnaam: de projectnaam met `.xml`, dus dezelfde naam als een MS Project XML-export: geef ze zelf een verschillende naam.

**Wat meegaat** — WBS-structuur en taken met duur, datums en voortgang; relaties met lag; constraints (ook een tweede, als zachte constraint); kalenders; resources en toewijzingen; de statusdatum (als `DataDate`); een eigen taaktype, in een eigen veld `OPS Custom Task Type` dat de app terugleest en dat P6 mag negeren.

**Wat niet meegaat** — baselines en deadlines; activiteitcodes, eigen velden, aantekeningen en externe koppelingen; de reken-opties; een werkende kalenderuitzondering (een uitzondering die van een dag een werkdag maakt). P6 kent geen lag in procenten: de app rekent die om naar een vast aantal dagen. Een lag in kalenderdagen wordt een lag in werktijd: 3 kalenderdagen worden 3 werkdagen. Een hammock wordt een gewone taak, een handmatig geplande taak een gewone taak met berekende datums en een nivelleervertraging van minder dan een dag valt weg.

## Primavera-bestand (`.xer`)

**Openen** — ja. Rekenprofiel: *Primavera P6*. De app leest het bestand alleen: ze schrijft geen `.xer` en verandert je bestand nooit. Ze opent één tabblad per project met taken. Een bestand zonder activiteiten of met beschadigde tabellen weigert ze met een melding.

**Opslaan** — nee, en er is geen opslagdoel: *Opslaan* schrijft een nieuw IFC-bestand, met het oorspronkelijke `.xer` erin.

**Exporteren** — nee. Exporteer je een project uit een `.xer` naar CSV, MS Project XML of P6 XML, dan meldt de app dat XER-broninformatie verloren gaat, ook als je het project tussendoor als IFC hebt opgeslagen. Naar IFC gaat niets verloren.

**Wat meegaat** — de WBS-structuur en activiteiten met duur, datums, constraints en voortgang; relaties met lag; kalenders; resources met toewijzingen; activiteitcodes; eigen velden (UDF's); aantekeningen; de planningsinstellingen van P6. Een activiteit van het type *Level of Effort* wordt een hammock. Een baselineproject wordt de actieve baseline van het project dat ernaar verwijst. Een relatie tussen twee projecten bewaart de app als brongegeven.

**Wat niet meegaat** — een project zonder activiteiten, en een relatie tussen twee projecten als echte relatie in je planning. Zie [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

## CSV

**Openen** — ja. De app leest `;` en `,` als scheidingsteken. Kolomkoppen herkent ze in het Engels en het Nederlands (bijvoorbeeld `Name` of `Naam`, `Duration` of `Duur`, `Predecessors` of `Voorgangers`). Datums mogen als *jjjj-mm-dd*, *dd-mm-jjjj* of *dd/mm/jjjj*. Een voorganger schrijf je als WBS-code, relatietype en lag, bijvoorbeeld `1.2FS+2d`. Rekenprofiel: *Open Planner Studio*. Het project heet *CSV Import*. Een `Task Type` dat geen van de vaste codes is (zoals `CONSTRUCTION` of `INSTALLATION`, die de app zelf schrijft), wordt een eigen taaktype onder *Uit dit project*, niet in *Mijn taaktypen*; met `OPS Custom Task Type ID` blijft het id van een eigen type behouden.

**Opslaan** — nee.

**Exporteren** — ja, als *CSV (;)* (*Universele tabel-export. Alle taken met datums en duur.*), op de kaart *CSV (puntkomma-gescheiden)*. Het bestand heeft een puntkomma als scheidingsteken, staat in UTF-8 met een BOM en heeft Engelse kolomkoppen.

**Wat meegaat** — per taak deze kolommen: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` en `Description`. Voltooiing staat in hele procenten.

**Wat niet meegaat** — resources, toewijzingen, kalenders, constraints, deadlines, baselines en de statusdatum. Staan de datums in de weergave *Datums zoals opgeslagen*, dan laat de export `Critical` en `Total Float` leeg voor taken waarvan het bronbestand dat niet vastlegde.

## Voortgangsblad (Excel en CSV)

**Openen** — ja, via *Bestand › Importeren* (*Voortgang bijwerken uit een blad*) of via de knop met die naam in de lintgroep *Voortgang* op *Planning*, *Tabel* en *Rapport*. De app leest `.xlsx` en `.csv`, tot 16 MB en 50.000 rijen. Dit opent geen project: het werkt de voortgang van je geopende project bij. Zie [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren).

**Opslaan** — nee.

**Exporteren** — ja, als *Voortgangsblad (Excel)* (*Voortgang (Excel)* in de lijst) en *Voortgangsblad (CSV)* (*Voortgang (CSV)*). Standaardnaam: *projectnaam-voortgang*. De knop *Voortgangsblad exporteren* in dezelfde lintgroep maakt het Excel-blad met één klik. Het Excel-blad heeft vaste kolombreedtes, vergrendelde velden en een datumcontrole; het CSV-blad is dezelfde inhoud als platte tekst.

**Wat meegaat** — de kolommen `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` en `Actual Finish`. Bij het inlezen gebruikt de app `Completion (%)`, `Actual Start` en `Actual Finish`; `Start` en `Finish` dienen alleen om de datumnotatie te herkennen en veranderen je planning niet. Rijen koppelt de app aan taken op het `OPS Task ID`, of anders op een unieke WBS-code.

**Wat niet meegaat** — alles buiten deze kolommen: duur, relaties, resources en de rest van je planning. Een verzameltaak krijgt geen voortgang uit het blad.

## PDF

**Openen** — nee.

**Opslaan** — nee.

**Exporteren** — ja, uit een rapport: op het tabblad *Rapport* de knop *Exporteer PDF*. De app stuurt een rapport niet zelf naar een printer; de weg naar papier loopt via de PDF. De inhoud hangt van het rapporttype af: zie [Rapporttypes](docs://ref-rapporttypes) en [Een rapport maken en afdrukken](docs://howto-rapport-maken-en-afdrukken).

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): waarom IFC het eigen formaat is en wat een export verliest, met een voorbeeld.
- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): de stappen.
- [Exporteren](docs://howto-exporteren): een formaat kiezen en de meldingen na een export.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): waarom een geopend bestand andere datums kan tonen.
- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): de rekenprofielen.
