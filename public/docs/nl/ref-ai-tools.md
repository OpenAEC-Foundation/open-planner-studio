# AI-tools (planner_*)

Alle tools die een AI-assistent via de bridge kan aanroepen, per groep, met wat ze doen en wat ze weigeren. Ze beginnen allemaal met `planner_`. De koppelprompt in het venster *Verbindingsgegevens* noemt het actuele aantal, en de assistent krijgt de volledige lijst met beschrijvingen van de bridge zelf (`tools/list`). Waarom de koppeling zo werkt, staat in [Hoe de AI-koppeling werkt](docs://uitleg-ai-koppeling). Hoe je hem aanzet, staat in [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen).

## Hoe je deze lijst leest

**Lezen** betekent: de tool wijzigt niets. Dat werkt ook tijdens *Pauzeren* en *Alleen lezen*. Een open dialoog blokkeert wel (zie onder *Wanneer een tool wordt geweigerd*). Een leestool geeft altijd actuele datums: is de planning verouderd, dan rekent hij eerst door, ook tijdens *Pauzeren* en *Alleen lezen*: die houden wijzigingen tegen, niet het doorrekenen bij het lezen. Zit jij midden in een bewerking (een balk slepen, typen in een veld), dan rekent hij niet door; de assistent krijgt dan de datums van vóór jouw bewerking met een melding dat ze verouderd zijn. Staat het project in de weergave *Datums zoals opgeslagen*, dan rekent hij niet door; de assistent krijgt dan de opgeslagen datums met een melding dat ze niet zijn doorgerekend.

**Wijzigen** betekent: de tool verandert je project. Hij wordt geweigerd tijdens *Pauzeren*, *Alleen lezen* en bij een open dialoog. Dat geldt ook voor de tools zonder label hieronder (`planner_undo`, `planner_redo`, de bestandstools en de documenttools, behalve `planner_list_documents`). Elke wijziging is één stap in je ongedaan-maakgeschiedenis. Verandert er projectdata, dan rekent de app de planning daarna zelf door; jij hoeft niet op *Bereken* te drukken. Vóór de eerste wijziging per document schrijft de app een backup, als *Auto-backup* aan staat.

**Bulk** betekent: één aanroep kan meerdere items bevatten. Een ongeldig item wordt dan geweigerd met een reden, en de geldige items blijven staan. Het antwoord noemt de geweigerde items.

## Lezen: planning

- `planner_get_project_info` (lezen) — projectgegevens en kengetallen: aantal taken, relaties, resources en mijlpalen, de statusdatum, het projecteinde en de projectduur, of de planning verouderd is, het rekenprofiel en een samenvatting van de kalenders. Een goede eerste aanroep.
- `planner_get_project_overview` (lezen) — de hele WBS-boom in één antwoord: per taak id, WBS, naam, duur, vroege datums, voortgang, kritiek, en de uitgaande relaties met hun relatie-id.
- `planner_list_tasks` (lezen) — taken met filters (kritiek, status, datumvenster, taken zonder relaties) en paginering.
- `planner_get_task` (lezen) — één taak in detail: datums, speling, voortgang, constraints, deadline, kalender, toewijzingen, voorgangers en opvolgers, onderbrekingen.
- `planner_get_critical_path` (lezen) — de kritieke taken met hun totale speling, en de relaties die het pad bepalen.
- `planner_list_resources` (lezen) — resources met capaciteit, tarief, kalender, ploeg, beschikbaarheid en een samenvatting van hun toewijzingen. Komt een resource uit een bibliotheek, dan staat erbij welke velden vastliggen.
- `planner_get_resource_histogram` (lezen) — belasting tegenover capaciteit per resource, per dag, week of maand (standaard week). Zonder venster en zonder resources geeft hij een samenvatting per resource; met een venster of resources de volledige reeksen en de taken die een overbezetting veroorzaken.
- `planner_get_calendars` (lezen) — alle kalenders met hun volledige definitie en door hoeveel taken en resources ze gebruikt worden.

## Lezen: baselines en afwijking

- `planner_list_baselines` (lezen) — de opgeslagen baselines en welke actief is.
- `planner_compare_baseline` (lezen) — het huidige plan tegenover de actieve baseline: alleen de afwijkende taken en het verschil in projecteinde, in werkdagen op de huidige projectkalender. Zonder actieve baseline weigert hij.
- `planner_analyze_delay` (lezen) — vertragingsanalyse tegen de actieve baseline: het verschil in oplevering en de kritieke taken die verschoven zijn. Zonder actieve baseline weigert hij.

## Taken en structuur

- `planner_add_tasks` (wijzigen, bulk) — taken aanmaken, ook een geneste WBS in één aanroep. Elke taak krijgt een eigen tijdelijke naam (`tmp-…`) zodat een kind naar zijn ouder kan verwijzen. Zonder duur krijgt een taak 5 werkdagen. Een mijlpaal heeft duur 0. Alle taken van één aanroep slagen samen of falen samen.
- `planner_update_tasks` (wijzigen, bulk) — velden van bestaande taken wijzigen: naam, omschrijving, duur met eenheid (dagen of uren), duurtype, taaktype, mijlpaal, verplicht, prioriteit, constraint, deadline, kalender en werkregel. Daarnaast een voortgangspad: percentage voltooid, werkelijke start en werkelijk einde. Elke andere sleutel wordt geweigerd met een reden.
- `planner_delete_tasks` (wijzigen) — taken verwijderen, inclusief hun hele subboom, relaties en toewijzingen. Het antwoord noemt precies wat er is meegegaan.
- `planner_move_task` (wijzigen) — een taak onder een andere ouder zetten, met een positie. Een kringverwijzing of een taak onder zichzelf zetten wordt geweigerd.
- `planner_set_task_splits` (wijzigen) — de onderbrekingen van één taak zetten: na hoeveel werkdagen (of werkuren) werk, en hoeveel werkdagen (of werkuren) pauze. Een lege lijst heft alle onderbrekingen op. Zie [Een taak splitsen](docs://howto-taak-splitsen).

## Relaties

- `planner_add_dependencies` (wijzigen, bulk) — relaties leggen met type (`FS`, `SS`, `FF`, `SF` of de lange vorm) en lag, bijvoorbeeld `+2d`.
- `planner_update_dependencies` (wijzigen, bulk) — type, lag, voorganger of opvolger van een bestaande relatie wijzigen, op het relatie-id. Dat is één stap, in plaats van verwijderen en opnieuw leggen.
- `planner_remove_dependencies` (wijzigen, bulk) — relaties verwijderen op relatie-id.

## Project en kalenders

- `planner_update_project` (wijzigen) — naam, omschrijving, auteur, opdrachtgever, startdatum, einddatum, statusdatum, voortgangsmodus en de projectstandaard voor de werkregel. De startdatum is het anker voor nieuwe taken. Zet de assistent hem later, dan schuiven alleen losse taken mee (zonder voorganger en zonder constraint met een ondergrens, zoals *Start niet eerder dan*) en meldt het antwoord hoeveel als `anchorsClamped`; de rest van de planning blijft staan, zie [Nieuw project en Projectinfo](docs://ref-projectinfo). De statusdatum is geen label maar de peildatum van de berekening: op een planning zonder voortgang schuift alles mee. De einddatum is alleen metadata.
- `planner_move_project` (wijzigen) — de hele bestaande planning naar een nieuwe startdatum verschuiven. De kalenders schuiven niet mee, dus het einde kan met een ander aantal dagen verspringen dan de start. Baselines blijven staan, tenzij de assistent ze uitdrukkelijk mee laat schuiven. Zie [Project verplaatsen](docs://howto-project-verplaatsen).
- `planner_update_calendar` (wijzigen, bulk) — kalenders wijzigen of aanmaken: werkdagen, werkuren, pauze, uurbanden, feestdagen (genereren voor een land en regio of letterlijk opgeven) en werkende uitzonderingen. Welke kalender de projectkalender is, kan hij niet wijzigen.

## Resources en inzet

- `planner_manage_resources` (wijzigen, bulk) — resources aanmaken, wijzigen of verwijderen: naam, type (arbeid, materieel, materiaal, onderaannemer of ploeg), omschrijving, maximale inzet, kosten per uur, eenheid, kalender, ploeg en beschikbaarheid in de tijd. Verwijderen met toewijzingen weigert hij totdat de assistent het uitdrukkelijk bevestigt. Bij een resource uit een bibliotheek zijn naam, type, omschrijving, uurtarief en eenheid vast.
- `planner_manage_assignments` (wijzigen, bulk) — toewijzingen toevoegen, wijzigen, verplaatsen of verwijderen: inzet per werkdag, curve en resterend werk. Alleen op een bladtaak, en dezelfde resource maar één keer per taak. Wat een inzetwijziging met de duur doet, hangt af van de werkregel van de taak, zoals in [Werkregels: duur, inzet en werk](docs://uitleg-werkregels).
- `planner_level_resources` (wijzigen) — overbezetting nivelleren. Standaard binnen de speling, zodat de einddatum blijft staan; met `constrainToFloat: false` mag het einde opschuiven. Met een proefrun krijgt de assistent eerst een voorbeeld zonder iets te wijzigen. Materiaal slaat hij over. Zie [Nivelleren](docs://uitleg-nivelleren).
- `planner_clear_leveling` (wijzigen) — alle nivelleervertragingen wissen.

## Baselines beheren

- `planner_save_baseline` (wijzigen) — de huidige planning als baseline opslaan en meteen actief maken. Verouderde datums rekent hij eerst door. Kan niet in een draaiboek.
- `planner_activate_baseline` (wijzigen) — een baseline actief maken, of geen enkele.
- `planner_rename_baseline` (wijzigen) — een baseline hernoemen.
- `planner_delete_baseline` (wijzigen) — één baseline verwijderen. Was het de actieve, dan wordt de laatst overgebleven baseline actief, of geen als er niets overblijft.

## Ongedaan maken

- `planner_undo` en `planner_redo` — één stap ongedaan maken of opnieuw doen in het actieve document. De geschiedenis is dezelfde als die van jou. Het antwoord zegt of er echt iets is teruggedraaid.

## Documenten en bestanden

- `planner_list_documents` (lezen) — alle geopende documenten met titel, of ze actief en gewijzigd zijn, het aantal taken, de projectstart en het berekende einde.
- `planner_new_document` — een nieuw, leeg document in een eigen tabblad, zonder het venster *Nieuw project*.
- `planner_duplicate_document` — het actieve document kopiëren naar een nieuw tabblad, voor een wat-als of een tendervariant. De kopie is losgekoppeld en heeft geen bestandspad.
- `planner_switch_document` — een ander document actief maken. Ook de manier om na een wissel van tabblad door jou te bevestigen op welk document de assistent werkt.
- `planner_import_schedule` — een planningsbestand van schijf openen als document: `.ifc`, `.xml` (Primavera P6 of MS Project, herkend op inhoud), `.csv`, `.xer` en `.mpp` (MS Project 2010 tot en met 2021). Er wordt niets samengevoegd met het huidige plan. Een CSV heeft geen kalender, dus datums kunnen verschuiven. Alleen binnen je gebruikersmap. Na een CSV-, XML- of `.mpp`-import heeft het document geen opslagdoel; alleen een IFC neemt zijn pad over.
- `planner_export_ifc` — het actieve document als IFC 4.3-bestand wegschrijven. Alleen binnen je gebruikersmap, en een bestaand bestand wordt alleen overschreven op uitdrukkelijk verzoek. Het project blijft als niet opgeslagen staan.

## Gids en bronherkomst

- `planner_get_planning_guide` (lezen) — de Engelse gids voor assistenten (de principes van [Goed plannen](docs://gids-goed-plannen), met bij elk principe de tools), de twee skills *goed-plannen* (een planning opzetten) en *progress-update* (de voortgang bijwerken), of alles. Kies met `part`: `guide`, `skill` (beide skills) of `both`; standaard `both`. Geeft per skill de plekken waar hij hoort en de downloadadressen. De parameter `language` wordt nog geaccepteerd voor oudere assistenten, maar de tekst is altijd Engels. Raakt de planning niet aan.
- `planner_inspect_xer_provenance` (lezen) — de bewaarde bronsemantiek van een geopend Primavera P6-bestand (`.xer`) inzien: wat het bestand bevatte, met tellingen van de import en diagnostiek. Standaard blijven vrije tekstvelden uit het bestand onzichtbaar; de assistent moet daar uitdrukkelijk om vragen. Ook resourcenamen blijven standaard verborgen, omdat een P6-resource meestal een persoon is; de resourcecodes blijven wel zichtbaar. De assistent moet je eerst om toestemming vragen voordat hij de namen opvraagt, want die gaan dan naar de AI-aanbieder. Kan niet in een draaiboek.

## Het draaiboek

- `planner_batch` — een draaiboek van maximaal 100 stappen als één wijziging uitvoeren: één ongedaan-maakstap, één herberekening, één backup. Valt een stap structureel om, dan draait het hele draaiboek terug en het antwoord zegt per stap wat is uitgevoerd, mislukt of niet bereikt. Tijdelijke namen (`tmp-…`) uit `planner_add_tasks` gelden in latere stappen. Niet toegestaan als stap: `planner_batch` zelf, undo en redo, de document- en bestandstools, `planner_save_baseline`, `planner_get_planning_guide` en `planner_inspect_xer_provenance`. Een draaiboek is geen scripttaal: er zijn geen variabelen, voorwaarden of lussen.

## Wanneer een tool wordt geweigerd

De assistent krijgt dan een antwoord met een foutcode en een uitleg.

- `PAUSED` — *Pauzeren* staat aan.
- `READ_ONLY` — *Alleen lezen* staat aan.
- `DIALOG_OPEN` — er staat een dialoog open. Dat telt ook voor lezen, behalve bij `planner_get_planning_guide`. Het antwoord noemt wat openstaat met de interne naam, bijvoorbeeld `showTaskDialog`.
- `DOC_DRIFT` — jij wisselde van tabblad terwijl de assistent werkte. Hij moet met `planner_switch_document` bevestigen op welk document hij werkt.
- `VALIDATION` — de argumenten kloppen niet met het schema, of de gevraagde wijziging mag niet. Het antwoord noemt het veld.
- `NOT_FOUND` — een id of document bestaat niet.
- `CYCLE` — de wijziging zou een kringverwijzing maken. Alles van die aanroep wordt teruggedraaid.
- `SCOPE` — het bestandspad ligt buiten je gebruikersmap.
- `BACKUP_FAILED` — de backup vóór de wijziging mislukte; de wijziging is niet uitgevoerd.
- `INTERNAL` — een onverwachte fout bij het uitvoeren van een tool, bijvoorbeeld een bestandsbewerking die mislukte. Het antwoord geeft de oorspronkelijke foutmelding.
- `STALE_PRECONDITION` — staat in het contract van de bridge, maar geen van de huidige tools geeft deze code terug.

Een aanvraag die langer dan 110 seconden in de wachtrij stond, voert de app niet meer uit: de client heeft dan al een time-out gekregen, en uitvoeren zou bij een nieuwe poging dubbel wijzigen. Een aanroep die langer dan 120 seconden duurt, krijgt een time-out van de bridge.

## Wat de assistent niet kan instellen

Per taak kan de assistent niet zetten: hammock, handmatig plannen, een tweede constraint, aantekeningen, kleur, activiteitcodes, eigen velden, externe koppelingen en nivelleervertraging met de hand. De WBS-code berekent de app zelf. Op projectniveau kan hij het rekenprofiel en de reken-opties niet wijzigen. Instellingen, thema, taal, extensies en updates zijn niet bereikbaar, en ook de resourcebibliotheek niet. Rapporten, layouts, filters en weergave heeft hij evenmin. Waarom, staat in [Hoe de AI-koppeling werkt](docs://uitleg-ai-koppeling).

## Wat de app bewaart

- **Het token** staat op deze computer, in de opgeslagen instellingen van de app. Het is 64 tekens lang en willekeurig. *Nieuw token* vervangt het.
- **De poort** staat standaard op 3877 en is alleen te wijzigen als de bridge gestopt is.
- **Het activiteitenpaneel** bewaart de laatste 500 aanroepen, alleen zolang de app open is. Argumenten en antwoorden worden na 20 kB per veld afgekapt. *Wissen* leegt de lijst.
- **De backups** staan in de map `ai-backups` in de gegevensmap van de app; *Backup-map openen* brengt je erheen. Ze heten `<projectnaam>-<tijdstempel>.ifc`. Een opgeslagen projectbestand heeft over alle sessies heen één map; een document dat je nooit hebt opgeslagen krijgt per sessie een eigen map. Er wordt één backup per document per keer dat je de bridge start gemaakt, plus de backups die je zelf maakt met *Nu backup maken*.
- **Het uitdunnen** gebeurt vanzelf, per map. Van de laatste 7 dagen blijven ze allemaal staan, tot 20 stuks; wat de lopende sessie maakte, blijft altijd staan. Daarna blijft er één per week over tot 30 dagen oud, één per maand tot een jaar, en daarna één per jaar. De backups van een document dat je nooit hebt opgeslagen verdwijnen na een jaar helemaal. Bestanden in de map die niet van de app zijn, raakt de app niet aan.

## Zie ook

- [Hoe de AI-koppeling werkt](docs://uitleg-ai-koppeling): waarom de bridge zo is ingericht en wat de assistent wel en niet mag.
- [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen): bridge starten, koppelen, skill installeren.
- [Instellingen](docs://ref-instellingen): de twee AI-schakelaars.
- [Meldingen en waarschuwingen](docs://ref-meldingen): de AI-bol in de statusbalk.
