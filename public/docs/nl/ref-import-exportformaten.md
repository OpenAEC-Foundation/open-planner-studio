# Import- en exportformaten

Per bestandsformaat: of je het kunt openen, opslaan en exporteren, wat er wel en niet meegaat en met welk rekenprofiel het opent. Het waarom achter dit alles, en een voorbeeld met getallen, staat in [Bestanden en formaten](docs://uitleg-bestanden).

## In één oogopslag

**Openen** kan met IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` en `.xer`. Een bestand met een andere extensie behandelt de app als IFC.

**Opslaan** schrijft altijd IFC. Alleen een geopend IFC-bestand wordt het opslagdoel; een project uit een ander formaat heeft na het openen nog geen bestand en *Opslaan* vraagt dan waar het IFC-bestand moet komen.

**Exporteren** kan naar IFC, MS Project XML, Primavera P6 XML, Primavera XER (`.xer`), CSV en een voortgangsblad (Excel). Een export verandert je project niet.

**Alleen lezen** is `.mpp`: de app kan het openen, niet schrijven. Een `.xer` kan de app openen en exporteren, maar *Opslaan* schrijft nooit naar een `.xer`.

**PDF** komt alleen uit een rapport (zie [Rapporttypes](docs://ref-rapporttypes)). De app leest geen PDF.

**Waar.** Openen: *Start › Bestand › Openen*, *Bestand › Openen* of Ctrl+O. Exporteren: *Start › Bestand › Exporteren* of *Bestand › Exporteren*. Een ingevuld voortgangsblad lees je in via *Bestand › Importeren*, of met de knop *Voortgang bijwerken uit een blad* in de lintgroep *Voortgang* op de tabbladen *Planning*, *Tabel* en *Rapport*.

**Rekenprofiel bij openen.** Elk formaat opent met een rekenprofiel; wat dat is, staat in [Rekenopties en conventies](docs://ref-rekenopties-en-conventies). `.xer` opent met *Primavera P6*, `.mpp` met *Microsoft Project*, en CSV, MS Project XML en P6 XML met *Open Planner Studio*. IFC houdt het profiel dat in het bestand staat. Bij `.xer` en `.mpp` meldt de app dat het project zo rekent. Alleen IFC neemt het rekenprofiel en de reken-opties mee; van de reken-opties schrijft MS Project XML hooguit de kritiek-drempel, en een `.xer` de planningsinstellingen van P6. Een heropende `.xer`-export rekent als *Primavera P6*, een heropende export van een ander formaat als *Open Planner Studio*.

## IFC

**Openen** — ja, `.ifc`. De app leest IFC4 en IFC 4.3 (ook ADD2). Een bestand in een ander schema, zoals IFC2X3, opent ook. Bij het eerste opslaan kies je dan een schema dat de app kan schrijven (zie [Het IFC-schema kiezen](docs://howto-ifc-schema-kiezen)). Rekenprofiel: dat uit het bestand.

**Opslaan** — ja, en het is het enige formaat dat opslaat. *Opslaan* schrijft je hele project als IFC-bestand, in het IFC-schema van het project (standaard IFC 4.3 ADD2). Het bestand wordt het opslagdoel.

**Exporteren** — ja, als *IFC*, in het IFC-schema van het project (standaard IFC 4.3 ADD2). Standaardnaam: de projectnaam met de extensie `.ifc`. Is je project gekoppeld aan een resourcebibliotheek, dan staat in *Bestand › Exporteren* onder de kaarten het vakje *Bibliotheekbestand ernaast opslaan*. Aangevinkt vraagt de app na het project ook om een plek voor *projectnaam-bibliotheek.ifc*. Het vakje staat niet in de lijst op het tabblad *Start*.

**Wat meegaat** — alles wat bij het project hoort: taken met structuur, duur, datums en voortgang; relaties met lag; constraints en deadlines; kalenders; resources en toewijzingen, ook de urenverdeling; baselines; activiteitcodes en eigen velden; aantekeningen; externe koppelingen naar andere projecten; onderbrekingen; taaktypes en eigen werksoorten; de projectinstellingen zoals de statusdatum, de voortgangsmodus, het rekenprofiel en de reken-opties; de koppeling met een resourcebibliotheek. Bij een project uit een `.xer` gaat ook het oorspronkelijke bronbestand mee. Een eigen werksoort staat erin als het IFC-type `USERDEFINED` met de naam in het veld ObjectType, zodat andere IFC-programma's de taak gewoon lezen; daarnaast bewaart de app het vaste id van de werksoort, zodat hernoemen de koppeling niet breekt. Opent iemand het bestand op een andere computer, dan staat de werksoort daar onder *Uit dit project*, niet in diens eigen *Mijn werksoorten*.

**Planomvang in andere IFC-programma’s.** Het werkplan en werkschema bevatten de vroegste getoonde taakstart en het laatste getoonde taakeinde, ook van fasen. Een gestarte taak telt vanaf haar werkelijke start; een voltooide taak tot haar werkelijke einde. Anders gelden de berekende datums, of vóór berekenen de invoerdatums. In *Datums zoals opgeslagen* geldt de planning die je op dat moment ziet. Opslaan rekent niet opnieuw. De start- en einddatum die je zelf in *Projectinstellingen* hebt ingevuld, blijven apart bewaard, ook als ze leeg zijn.

**Wat niet meegaat** — hoe je het scherm hebt ingesteld (zoom, scrollpositie, geselecteerde taak, ingeklapte fasen, gekozen filter en groepering) en de app-instellingen ([App-instellingen](docs://ref-instellingen)). Het tabblad *IFC* is een editor met de IFC-tekst van je project. *Genereer IFC* ververst haar en *Kopieer* zet haar op het klembord. *Toepassen* vervangt de inhoud van het huidige project als één stap voor *Ongedaan maken*. De bibliotheekkoppeling en het bestand waarnaar je opslaat blijven behouden. De bewerking staat op *Niet opgeslagen* totdat je opslaat.

## MS Project XML (MSPDI)

**Openen** — ja. De app herkent een `.xml`-bestand als MS Project XML aan het hoofdelement `Project` in de namespace van MS Project (of zonder namespace). Rekenprofiel: *Open Planner Studio*. Na het openen zegt de app in één melding wat ze niet heeft overgenomen; zie [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen).

**Onleesbare taakdatums.** Een waarde zoals `NA` geldt als een ontbrekende datum. De rest van het bestand opent gewoon. Een ontbrekende geplande start gebruikt de projectstart, of anders de vroegste leesbare taakstart. Voor een ontbrekend einde gelden dezelfde regels als bij een leeg datumveld. Een onleesbare werkelijke datum, constraintdatum, deadline of datum in de opgeslagen rekenuitvoer wordt niet als datum overgenomen.

**Opslaan** — nee. Zo'n project krijgt geen opslagdoel.

**Exporteren** — ja, als *MS Project XML* (*Te openen in Microsoft Project. Volledige WBS-structuur.*). Standaardnaam: de projectnaam met `.xml`.

**Wat meegaat** — taken met structuur (niveau en WBS), duur, datums en voortgang; relaties met lag, ook in uren of procenten; constraints, ook de deadline; kalenders, ook taak- en resourcekalenders; resources en toewijzingen, ook de capaciteit per periode en de curve of urenverdeling; de statusdatum; de kritiek-drempel, als een heel aantal werkdagen van 0 of meer of 0 uur, bij *Totale speling ≤ drempel*; de beschrijving van een taak (als notitie); het taaktype van een taak (als MS Project-taaktype); een eigen werksoort, in een vrij veld (`ExtendedAttribute`) dat de app terugleest en dat MS Project mag negeren. Van je baselines gaat alleen de actieve mee, als baseline 0. Een taak in uren behoudt haar eenheid, en een mijlpaal haar soort (start, einde of automatisch).

**Wat niet meegaat** — aantekeningen (de checklist bij een taak), externe koppelingen naar andere projecten, activiteitcodes en eigen velden, een tweede constraint, de markering *Handmatig gepland*, de nivelleervertraging, het hervat- en stoppunt bij een uit-volgorde-taak, de conventies *Restwerk hervat na de al verstreken duur* en *Niet-gestarte taken niet naar de statusdatum* van een MS Project-profiel, en de overige reken-opties. Onderbroken taken zonder urenverdeling gaan zonder hun onderbrekingen mee.

**Feestdagen bij openen.** Een afgeleide kalender erft de uitzonderingen van zijn basiskalender. Een kalender met een eigen werkweek en zonder uitzonderingen krijgt geen feestdagen. Alleen een kale kalender, zonder basiskalender, werkweek of uitzonderingen, houdt de Nederlandse standaardfeestdagen. Ontbreken er feestdagen, dan kan je einddatum afwijken: zie [Feestdagen en bouwvak genereren](docs://howto-feestdagen-genereren).

**Wat verandert onderweg** — een constraint *Moet starten op (MSO)* of *Moet eindigen op (MFO)* zonder de keuze *Verplicht (pin logica)* wordt *Start niet eerder dan (SNET)* of *Eindig niet eerder dan (FNET)*. Een hammock wordt een gewone taak met berekende datums. MS Project XML kent de uren per dag alleen voor de projectkalender. Een andere kalender met eigen uren per dag krijgt bij openen de werktijd als uren per dag: 8 uur per dag bij werktijden van 10 uur wordt 10. Een taak in dagen uit MS Project of uit een oudere versie van de app wordt op zo'n kalender dan korter, bijvoorbeeld 4 dagen in plaats van 5. Een bestand van deze versie van de app houdt de dagen: een taak van 5 dagen blijft 5 dagen. Ook een rest en een lag in dagen komen dan precies terug: 2,5 dagen met 1,5 dag rest blijft 2,5 dagen met 1,5 dag rest.

## MS Project-bestand (`.mpp`)

**Openen** — ja, van MS Project 2010 tot en met 2021. Rekenprofiel: *Microsoft Project*. De app leest het bestand alleen: ze verandert je `.mpp` nooit. Een bestand van MS Project 2007 of ouder, en een bestand met wachtwoord, weigert ze met een melding die verwijst naar de XML-export van MS Project. Na het openen zegt de app in één melding wat ze niet heeft overgenomen.

**Opslaan** — nee, en er is geen opslagdoel: *Opslaan* schrijft een nieuw IFC-bestand.

**Exporteren** — nee.

**Wat meegaat** — taken met structuur, duur en constraints; relaties met lag; kalenders; resources en toewijzingen; voortgang; een WBS-code die je in MS Project zelf invulde. De datums en speling die MS Project zelf uitrekende, leest de app ook, voor de weergave *Datums zoals opgeslagen*.

**Wat niet meegaat** — baselines, kosten en tarieven, aantekeningen, hyperlinks, de eigen velden van MS Project, de koppeling van subprojecten en externe taken, en de drempel voor kritiek. Zie [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen).

**Herkomst en licentie** — de `.mpp`-lezer is geschreven voor Open Planner Studio en afgeleid van de broncode en structuurkennis van MPXJ (`github.com/joniles/mpxj`, Jon Iles e.a.), een Java-bibliotheek onder LGPL-2.1. Structuur en veldconstanten zijn naar TypeScript overgezet. Open Planner Studio zelf is open source onder LGPL-3.0. De `.xer`-lezer is geen overname: daarvoor is MPXJ alleen als bron van begrip geraadpleegd.

## Primavera P6 XML

**Openen** — ja. De app herkent een `.xml`-bestand als P6 XML aan het hoofdelement `APIBusinessObjects`. Rekenprofiel: *Open Planner Studio*. Een melding zegt dat het project met dat profiel rekent, niet met de instellingen van P6.

**Onleesbare taakdatums.** Hiervoor gelden dezelfde regels als bij MS Project XML: een onleesbare datum geldt als ontbrekend en breekt het openen niet af.

**Meerdere projecten in één bestand.** Elk project met activiteiten opent in een eigen tabblad, met de naam *Projectnaam (Project-ID)*. Een project zonder activiteiten slaat de app over. Het actieve tabblad is het project met de meeste activiteiten. Een relatie naar een ander project neemt de app niet mee, en ook geen activiteit die bij geen project hoort. Na het openen meldt de app hoeveel projecten ze opende.

**Feestdagen bij openen.** Hier gelden dezelfde regels als bij MS Project XML: een kalender met een eigen werkweek en zonder uitzonderingen krijgt geen feestdagen.

**Baselines.** Een `<BaselineProject>` in het bestand wordt een baseline van zijn project. De baseline die P6 als actief aanwijst, is ook in de app actief.

**Tempo van een toewijzing.** Is er nog werk te doen, dan wordt het resterende tempo (`RemainingUnitsPerTime`) de *Eenh./dag*. Anders is dat het begrote tempo (`PlannedUnitsPerTime`). Bij materiaal blijft het begrote tempo staan. De app rekent bij openen niets om. Bij een export naar P6 XML schrijft ze het begrote tempo als `PlannedUnitsPerTime`. Het resterende tempo schrijft ze als `RemainingUnitsPerTime`, maar alleen als de toewijzing een apart begroot tempo heeft.

**Geen leesbare activiteiten.** Vindt de app geen activiteit die ze kan lezen, dan opent ze geen tabblad. Ze meldt dat, met de reden als die bekend is. Voorbeelden: activiteiten zonder `ObjectId`, of XER-kolomnamen in een XML-bestand. Exporteer het project dan opnieuw uit P6 als P6 XML, of open het als `.xer`.

**Opslaan** — nee.

**Exporteren** — ja, als *Primavera P6 XML* (*Voor Oracle Primavera P6.*). Standaardnaam: de projectnaam met `.xml`, met het project-ID tussen haakjes als het project er een heeft. Een MS Project XML-export krijgt dezelfde naam: geef ze zelf een verschillende naam.

**Projectnaam en project-ID.** De app bewaart het project-ID uit P6 apart van de projectnaam, net als bij een `.xer`. In *Projectinstellingen* staat alleen de naam, bijvoorbeeld *Bid for Facility Extension*. Het tabblad toont *Bid for Facility Extension (OZB-05)*. Hernoem je het project naar *Uitbreiding hal*, dan heet het tabblad *Uitbreiding hal (OZB-05)*. Bij een export naar P6 XML gaat *OZB-05* terug als project-ID en *Uitbreiding hal* als naam. Zo herkent P6 het project. Een project uit een `.xer` krijgt zijn project-ID ook mee. Het project-ID blijft bewaard als je het project opslaat als IFC. Haakjes in de naam zelf, zoals *Nieuwbouw (fase 2)*, blijven in de naam. Een project zonder project-ID krijgt bij de export een eigen, uniek ID van de app, dat begint met *OPS:*.

**Wat meegaat** — WBS-structuur en taken met duur, datums en voortgang; relaties met lag; constraints (ook een tweede, als zachte constraint); kalenders; resources en toewijzingen; de statusdatum (als `DataDate`); een eigen werksoort, in een eigen veld `OPS Custom Task Type` dat de app terugleest en dat P6 mag negeren.

**Wat niet meegaat** — baselines en deadlines; activiteitcodes, eigen velden, aantekeningen en externe koppelingen; de reken-opties; de namen van feestdagen. P6 kent per vrije dag geen naam: na heropenen heet een feestdag *Holiday* en een werkende uitzondering *Working exception*. Aansluitende vrije dagen komen terug als één reeks. Een naam of code die langer is dan P6 toestaat, kort de app in: een activiteitnaam tot 120 tekens, een activiteit-ID of WBS-code tot 40, een WBS- of projectnaam tot 100. Ze meldt hoeveel namen en codes ze inkortte. P6 kent geen lag in procenten: de app rekent die om naar een vaste lag in werktijd, uit de duur van de voorganger. 50 % van een voorganger van 24 uur wordt een lag van 12 uur. Een lag in kalenderdagen wordt in P6 een lag in werktijd: 3 kalenderdagen worden 3 werkdagen. Open je het bestand weer in de app, dan krijg je de 3 kalenderdagen terug. Ook een duur, rest en lag in dagen komen dan precies terug. Een hammock wordt een gewone taak, een handmatig geplande taak een gewone taak met berekende datums en een nivelleervertraging van minder dan een dag valt weg.

## Primavera-bestand (`.xer`)

**Openen** — ja. Rekenprofiel: *Primavera P6*. De app verandert je bestand nooit. Ze opent één tabblad per project met taken. Een bestand zonder activiteiten of met beschadigde tabellen weigert ze met een melding.

**Opslaan** — nee, en er is geen opslagdoel: *Opslaan* schrijft een nieuw IFC-bestand, met het oorspronkelijke `.xer` erin.

**Exporteren** — ja, als *Primavera P6 XER* (*Voor Oracle Primavera P6, als .xer-bestand.*). Standaardnaam: de projectnaam met `.xer`, met het project-ID tussen haakjes als het project er een heeft. Heeft het project geen project-ID, dan schrijft de app de projectnaam als project-ID (hooguit 40 tekens). Activiteit-ID's en WBS-codes zijn in P6 uniek en hooguit 40 tekens; een lege, dubbele of te lange code past de app aan en ze meldt hoeveel. Exporteer je een project uit een `.xer` naar CSV, MS Project XML of P6 XML, dan meldt de app dat XER-broninformatie verloren gaat, ook als je het project tussendoor als IFC hebt opgeslagen. Naar IFC gaat niets verloren.

**Wat de export meeneemt** — de WBS-structuur; activiteiten met duur, geplande en werkelijke datums, voortgang en twee constraints; relaties met lag; kalenders met werktijden, vrije dagen en werkende uitzonderingen; resources (arbeid, materieel en materiaal) met tarief en beschikbaarheid; toewijzingen met tempo, werk en urenverdeling; aantekeningen; de statusdatum; de planningsinstellingen van P6. De berekende datums en de speling staan er ook in. P6 toont ze tot je het project in P6 opnieuw doorrekent.

**Wat de export niet meeneemt** — baselines, deadlines, activiteitcodes, eigen velden, externe relaties, beschrijvingen van taken, het vinkje bij een aantekening en de namen van vrije dagen. Een relatie met een samenvattingstaak wordt een relatie tussen de taken eronder. Een lag in procenten wordt een vaste lag, een lag in kalenderdagen een lag in werkuren. Een onderbreking valt weg. Na de export meldt de app *De XER-export is opgeslagen. Dit ging niet of niet precies mee:*, met per soort een regel en het aantal.

**Tekens.** De app schrijft het bestand in Windows-1252, zoals P6. Past een teken daar niet in, zoals *Ł*, dan schrijft ze het hele bestand in UTF-8 en meldt ze hoeveel tekens het zijn. Controleer de tekst dan na de import in P6.

**Terug openen.** Een `.xer` uit de app opent weer als *Primavera P6*. Een taak in dagen komt terug in dagen, een taak in uren in uren. Daarvoor schrijft de app eigen velden in het bestand, net als bij de export naar P6 XML. Elke activiteit krijgt *OPS_TaskDurationUnit*, en waar nodig een veld voor een duur of lag met een breuk. Heeft het project een eigen *Projectstandaard* voor het taaktype, dan krijgt het project *OPS_DefaultWorkRule*. Een activiteit die het taaktype van het project erft, krijgt *OPS_InheritedWorkRule*: na heropenen erft ze weer. Een resource met een vaste *Max. eenheden* krijgt *OPS_FlatCapacity*. Materiaal met stappen in de capaciteit krijgt *OPS_CapacitySteps*: P6 telt de capaciteit per uur, de app per dag. P6 toont ze als gewone eigen velden; de app toont ze niet. Voeg je in P6 een activiteit toe, dan opent de app die activiteit in uren, zoals elke activiteit uit P6. De andere activiteiten houden hun eenheid. De kalenders leest de app zoals in elk P6-bestand. Een kalender zonder eigen werktijdblokken krijgt na heropenen werktijdblokken (uurplanning). Datums en speling kunnen dan afwijken; de melding na de export noemt hoeveel kalenders het zijn.

**Niet getest in P6 zelf.** De app toetst de export door hem zelf terug te lezen. Een import in Primavera P6 zelf is nog niet getest.

**Wat meegaat** — de WBS-structuur en activiteiten met duur, datums, constraints en voortgang; relaties met lag; kalenders; resources met toewijzingen; activiteitcodes; eigen velden (UDF's); aantekeningen; de planningsinstellingen van P6. Een activiteit van het type *Level of Effort* wordt een hammock. Een baselineproject wordt de actieve baseline van het project dat ernaar verwijst. Een relatie tussen twee projecten bewaart de app als brongegeven.

**Tempo van een toewijzing.** Is er nog werk te doen, dan wordt het resterende tempo (`remain_qty_per_hr`) de *Eenh./dag*. Anders is dat het begrote tempo (`target_qty_per_hr`). Het begrote werk, het verrichte werk en het resterende werk blijven zoals in het bestand. Bij materiaal blijft het begrote tempo staan.

**Een vrije zaterdag of zondag die niet in het bestand staat.** Sommige P6-exports schuiven een vrije weekenddag in een blok van meer vrije dagen naar de vrijdag ervoor of de maandag erna. Werkt de kalender op zaterdag of zondag, dan zou die dag zo ten onrechte een werkdag worden. Ziet de app dat patroon in een blok van minstens drie vrije dagen, dan maakt ze die weekenddag alsnog vrij. De dag heet in de kalender *Calendar exception (weekend reconstruction)* en telt mee in de regel *N kalenderbevindingen.* van de melding. Op een kalender die in het weekend niet werkt, verandert er niets.

**Speling tot het projecteinde, zonder einddatum.** Staat in P6 de optie aan om de speling tot het projecteinde te rekenen, maar staat in het bestand geen einddatum voor het project en geen geplande einddatum voor een activiteit? Dan zet de app de optie *Speling rekenen tot de einddatum van het project* uit. De late datums rekent ze dan terug vanaf het laatste vroege einde. Dat telt mee in de regel *N P6-planningsinstellingen met veilige terugval.*

**Voltooide activiteiten op de statusdatum.** Sommige bestanden leggen voor een voltooide activiteit niet haar werkelijke datums vast, maar een venster op de statusdatum. In de weergave *Datums zoals opgeslagen* staat zo'n activiteit dan als een smalle balk op de statusdatum. Komt ze na herberekenen op een andere plek, dan telt ze mee in het aantal taken dat de strook noemt. De conventie *Voltooide taak in het statusdatumvenster* rekent zo'n venster na, en alleen met die conventie krijgt een voltooide taak via de reken-optie *Voltooide taak: late datums vanaf de statusdatum* een echte speling. Deze conventie is een benadering: de app zag dit gedrag alleen in P3-uitvoer, en Primavera bevestigt het nergens. Daarom staat ze in elk ingebouwd profiel uit, ook onder *Primavera P6*. Je zet haar aan in het blok *Rekenprofiel en reken-opties*; het project krijgt dan een eigen profiel. Zie [Rekenopties en conventies](docs://ref-rekenopties-en-conventies).

**Getallen met een komma als decimaalteken.** P6 legt het decimaalteken en het scheidingsteken voor duizendtallen vast in de tabel `CURRTYPE`. De app leest die tekens voordat ze duren, werk en speling omzet. Ontbreekt die informatie, dan gebruikt de app een punt als decimaalteken. Staan er dan toch getallen met een decimale komma in het bestand, dan opent de app niets. Zo opent er nooit een planning met verkeerd gelezen getallen.

**Wat niet meegaat** — een project zonder activiteiten, en een relatie tussen twee projecten als echte relatie in je planning. Zie [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen).

## CSV

**Openen** — ja. De app leest `;` en `,` als scheidingsteken. Kolomkoppen herkent ze in het Engels en het Nederlands (bijvoorbeeld `Name` of `Naam`, `Duration` of `Duur`, `Predecessors` of `Voorgangers`). Datums mogen als *jjjj-mm-dd*, *dd-mm-jjjj* of *dd/mm/jjjj*. Een voorganger schrijf je als WBS-code, relatietype en lag, bijvoorbeeld `1.2FS+2d`. Rekenprofiel: *Open Planner Studio*. Het project heet *CSV Import*. De kolom `Task Type` bevat de werksoort, niet het taaktype; de koppen `Werksoort` en `Work category` leest de app ook. Een `Task Type` dat geen van de vaste codes is (zoals `CONSTRUCTION` of `INSTALLATION`, die de app zelf schrijft), wordt een eigen werksoort onder *Uit dit project*, niet in *Mijn werksoorten*; met `OPS Custom Task Type ID` blijft het id van een eigen werksoort behouden.

Een gevulde datumcel in een onherkende vorm stopt het openen van de hele CSV. De foutmelding noemt de CSV-rij, kolomkop en celwaarde; pas die cel aan naar een van de drie vormen en open het bestand opnieuw. De rijtelling telt de kop mee, slaat lege records over en telt een cel met regeleinden als één record. Dit geldt voor Start, Einde, Werkelijke start en Werkelijk einde. Een ontbrekende of lege datum blijft toegestaan: de geplande start valt terug op de vroegste aanwezige taakstart (zonder enige start op vandaag), en het geplande einde wordt waar mogelijk uit start en duur afgeleid. Lege werkelijke datums volgen de gewone voortgangsregels.

**Opslaan** — nee.

**Exporteren** — ja, als *CSV (;)* (*Universele tabel-export. Alle taken met datums en duur.*), op de kaart *CSV (puntkomma-gescheiden)*. Het bestand heeft een puntkomma als scheidingsteken, staat in UTF-8 met een BOM en heeft Engelse kolomkoppen.

**Wat meegaat** — per taak deze kolommen: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` en `Description`. De kolom `Task Type` bevat de werksoort. Voltooiing staat in hele procenten. Een lag in uren krijgt het uurteken van de taal van de app: `1.2FS+2u` in het Nederlands, `1.2FS+2h` in het Engels. Openen leest beide.

**Wat niet meegaat** — resources, toewijzingen, kalenders, constraints, deadlines, baselines en de statusdatum. Staan de datums in de weergave *Datums zoals opgeslagen*, dan laat de export `Critical` en `Total Float` leeg voor taken waarvan het bronbestand dat niet vastlegde.

## Voortgangsblad (Excel)

**Openen** — ja, via *Bestand › Importeren* (*Voortgang bijwerken uit een blad*) of via de knop met die naam in de lintgroep *Voortgang* op *Planning*, *Tabel* en *Rapport*. De app leest alleen `.xlsx`, tot 16 MB en 50.000 rijen. Een `.csv` wordt niet gelezen; de app vraagt het blad als `.xlsx` op te slaan. Dit opent geen project: het werkt de voortgang van je geopende project bij. Zie [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren).

**Opslaan** — nee.

**Exporteren** — ja, als *Voortgangsblad (Excel)* (*Voortgang (Excel)* in de lijst). Standaardnaam: *projectnaam-voortgang*. De knop *Voortgangsblad exporteren* in dezelfde lintgroep maakt het blad met één klik. Het blad heeft vaste kolombreedtes, vergrendelde velden en een datumcontrole.

**Wat meegaat** — de kolommen `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` en `Actual Finish`. Bij het inlezen gebruikt de app `Completion (%)`, `Actual Start` en `Actual Finish`; `Start` en `Finish` dienen alleen om de datumnotatie te herkennen en veranderen je planning niet. Rijen koppelt de app aan taken op het `OPS Task ID`, of anders op een unieke WBS-code. Het blad heeft ook een verborgen kolom `OPS Export` met de stand bij de export; de app vergelijkt daarmee wat er sindsdien veranderde en schrijft die kolom nooit naar een taak.

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
